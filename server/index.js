const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const questions = require('./gameData'); 
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const TOTAL_ROUNDS = questions.length; 
const ROUND_DURATION = 15;
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'admin';

const INITIAL_STATE = {
    status: 'LOBBY',
    currentRoundIndex: 0,
    roundVotes: { AI: 0, REAL: 0 }, 
    timeLeft: 0,
    lastResult: null,          
    gameFinished: false        
};

let gameState = { ...INITIAL_STATE };
let playersPersistence = {}; 
let timerInterval = null;
const authorizedHosts = new Set();

const buildGlobalState = () => ({
    status: gameState.status,
    currentRoundIndex: gameState.currentRoundIndex,
    roundVotes: gameState.roundVotes,
    timeLeft: gameState.timeLeft,
    currentImage: questions[gameState.currentRoundIndex]?.content || null, 
    result: (gameState.status === 'REVEAL' || gameState.status === 'LEADERBOARD' || gameState.status === 'GAME_OVER') 
            ? gameState.lastResult 
            : null,
    totalRounds: TOTAL_ROUNDS,
    playerCount: Object.keys(playersPersistence).length
});

const buildHostState = () => ({
    ...buildGlobalState(),
    players: Object.values(playersPersistence).map(p => ({ 
        name: p.name, 
        score: p.score, 
        connected: p.socketId !== null 
    }))
});

// Serve React App
app.use(express.static(path.join(__dirname, '../client/dist')));

// FIX: Use Regex /.*/ instead of string '*' to support Express 5
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

io.on('connection', (socket) => {
    
    socket.on('request_state', () => {
        socket.emit('state_update', buildGlobalState());
    });

    socket.on('join_game', ({ name, sessionId }) => {
        const cleanName = String(name || 'Player')
            .trim()
            .slice(0, 12)
            .replace(/[^a-zA-Z0-9 ._-]/g, '') || 'Player';

        if (playersPersistence[sessionId]) {
            playersPersistence[sessionId].socketId = socket.id;
            playersPersistence[sessionId].name = cleanName; 
        } else {
            playersPersistence[sessionId] = {
                id: sessionId,
                name: cleanName,
                score: 0,
                lastVote: null,
                lastVoteTime: 0,
                socketId: socket.id
            };
        }
        
        const player = playersPersistence[sessionId];

        socket.emit('player_data_update', {
            score: player.score,
            myVote: player.lastVote
        });

        const assetUrls = questions.map(q => q.content);
        socket.emit('preload_assets', assetUrls);

        io.emit('state_update', buildGlobalState());
        io.to('host_room').emit('host_state_update', buildHostState());
    });

    socket.on('host_login', (password) => {
        if (password === HOST_PASSWORD) {
            authorizedHosts.add(socket.id);
            socket.join('host_room');
            socket.emit('host_state_update', buildHostState());
        } else {
            socket.emit('login_error', 'Invalid Password');
        }
    });

    socket.on('submit_vote', ({ vote, sessionId }) => {
        if (!['AI', 'REAL'].includes(vote)) return;

        const player = playersPersistence[sessionId];
        const NOW = Date.now();

        if (player && player.lastVoteTime && NOW - player.lastVoteTime < 500) return;
        
        if (gameState.status === 'QUESTION' && player && !player.lastVote) {
            player.lastVote = vote;
            player.lastVoteTime = NOW;
            
            if (gameState.roundVotes[vote] !== undefined) {
                gameState.roundVotes[vote]++;
            }
            
            io.emit('stats_update', gameState.roundVotes);
            socket.emit('vote_registered', vote);
        }
    });

    socket.on('disconnect', () => {
        if (authorizedHosts.has(socket.id)) {
            authorizedHosts.delete(socket.id);
        }

        Object.values(playersPersistence).forEach(p => {
            if (p.socketId === socket.id) {
                p.socketId = null;
            }
        });

        io.to('host_room').emit('host_state_update', buildHostState());
    });

    socket.on('admin_start_round', () => {
        if (!authorizedHosts.has(socket.id)) return;
        startRoundLogic();
    });

    socket.on('admin_show_leaderboard', () => {
        if (!authorizedHosts.has(socket.id)) return;
        gameState.status = 'LEADERBOARD';
        io.emit('state_update', buildGlobalState());
    });

    socket.on('admin_next_round', () => {
        if (!authorizedHosts.has(socket.id)) return;
        if (timerInterval) clearInterval(timerInterval);

        const nextIndex = gameState.currentRoundIndex + 1;

        if (nextIndex >= TOTAL_ROUNDS) {
            gameState.status = 'GAME_OVER';
            gameState.gameFinished = true;
            
            const finalLeaderboard = Object.values(playersPersistence)
                .sort((a,b) => b.score - a.score)
                .slice(0, 10); 
            
            gameState.lastResult = { leaderboard: finalLeaderboard };
            io.emit('state_update', buildGlobalState());
        } else {
            gameState.currentRoundIndex = nextIndex;
            startRoundLogic();
        }
    });

    socket.on('admin_hard_reset', () => {
        if (!authorizedHosts.has(socket.id)) return;
        if (timerInterval) clearInterval(timerInterval);
        
        gameState = { ...INITIAL_STATE };
        gameState.roundVotes = { AI: 0, REAL: 0 }; 
        playersPersistence = {}; 
        
        io.emit('game_reset_event');
        io.emit('state_update', buildGlobalState());
        io.to('host_room').emit('host_state_update', buildHostState());
    });
});

function startRoundLogic() {
    const roundData = questions[gameState.currentRoundIndex];
    if (!roundData) return;

    gameState.status = 'QUESTION';
    gameState.roundVotes = { AI: 0, REAL: 0 }; 
    gameState.timeLeft = ROUND_DURATION;
    gameState.lastResult = null; 
    
    Object.values(playersPersistence).forEach(p => {
        p.lastVote = null;
        p.lastVoteTime = 0;
    });

    io.emit('new_round', { ...roundData, timeLeft: ROUND_DURATION });
    io.emit('state_update', buildGlobalState());

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        gameState.timeLeft--;
        io.emit('timer_update', gameState.timeLeft);
        
        if (gameState.timeLeft <= 0) {
            clearInterval(timerInterval);
            try {
                revealAnswer();
            } catch (err) {
                console.error("Error revealing:", err);
            }
        }
    }, 1000);
}

function revealAnswer() {
    if (gameState.status !== 'QUESTION') return;

    gameState.status = 'REVEAL'; 
    const currentQ = questions[gameState.currentRoundIndex];
    let dbAnswer = String(currentQ.answer || '').toUpperCase();
    if (dbAnswer === 'HUMAN') dbAnswer = 'REAL';

    Object.values(playersPersistence).forEach(player => {
        const playerVote = String(player.lastVote || '').toUpperCase();
        const playerSocket = io.sockets.sockets.get(player.socketId);

        let roundScore = 0;
        if (playerVote === dbAnswer) {
            roundScore = 100; 
            player.score += roundScore;
        }

        if (playerSocket) {
            playerSocket.emit('player_data_update', {
                score: player.score,
                roundResult: playerVote === dbAnswer ? 'CORRECT' : 'WRONG'
            });
        }
    });

    const leaderboard = Object.values(playersPersistence)
        .sort((a,b) => b.score - a.score)
        .slice(0, 5);

    gameState.lastResult = {
        correctAnswer: dbAnswer,
        stats: gameState.roundVotes,
        leaderboard: leaderboard
    };

    io.emit('round_result', gameState.lastResult);
    io.emit('state_update', buildGlobalState());
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SERVER RUNNING ON ${PORT}`));