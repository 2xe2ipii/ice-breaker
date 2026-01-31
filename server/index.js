// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const questions = require('./gameData'); 

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- CONSTANTS ---
const TOTAL_ROUNDS = questions.length; 
const ROUND_DURATION = 15; // Seconds
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'admin'; // Simple Auth

// --- STATE ---
const INITIAL_STATE = {
    status: 'LOBBY',           // LOBBY, QUESTION, REVEAL, LEADERBOARD, GAME_OVER
    currentRoundIndex: 0,
    roundVotes: { AI: 0, REAL: 0 }, 
    timeLeft: 0,
    lastResult: null,          
    gameFinished: false        
};

let gameState = { ...INITIAL_STATE };
let playersPersistence = {}; 
let timerInterval = null;
// Track authorized admin sockets
const authorizedHosts = new Set();

// --- HELPERS ---

const buildGlobalState = () => ({
    status: gameState.status,
    currentRoundIndex: gameState.currentRoundIndex,
    roundVotes: gameState.roundVotes,
    timeLeft: gameState.timeLeft,
    // Send image path (handled by mixed extensions fix)
    currentImage: questions[gameState.currentRoundIndex]?.content || null, 
    result: (gameState.status === 'REVEAL' || gameState.status === 'LEADERBOARD' || gameState.status === 'GAME_OVER') 
            ? gameState.lastResult 
            : null,
    totalRounds: TOTAL_ROUNDS
});

const buildHostState = () => ({
    ...buildGlobalState(),
    players: Object.values(playersPersistence).map(p => ({ 
        name: p.name, 
        score: p.score, 
        connected: p.socketId !== null 
    }))
});

// --- SOCKET LOGIC ---

io.on('connection', (socket) => {
    
    // 1. GENERIC STATE REQUEST
    socket.on('request_state', () => {
        socket.emit('state_update', buildGlobalState());
    });

    // 2. PLAYER JOIN
    socket.on('join_game', ({ name, sessionId }) => {
        // SECURITY: Sanitize Input (Max 12 chars, Alphanumeric only-ish)
        const cleanName = String(name || 'Player')
            .trim()
            .slice(0, 12)
            .replace(/[^a-zA-Z0-9 ._-]/g, '') || 'Player';

        // Recover or Create Player
        if (playersPersistence[sessionId]) {
            playersPersistence[sessionId].socketId = socket.id;
            playersPersistence[sessionId].name = cleanName; 
        } else {
            playersPersistence[sessionId] = {
                id: sessionId,
                name: cleanName,
                score: 0,
                lastVote: null,
                socketId: socket.id
            };
        }
        
        const player = playersPersistence[sessionId];

        // Send feedback
        socket.emit('player_data_update', {
            score: player.score,
            myVote: player.lastVote
        });

        const assetUrls = questions.map(q => q.content);
        socket.emit('preload_assets', assetUrls);

        io.emit('state_update', buildGlobalState());
        io.to('host_room').emit('host_state_update', buildHostState());
    });

    // 3. HOST JOIN (Authenticated)
    socket.on('host_login', (password) => {
        if (password === HOST_PASSWORD) {
            authorizedHosts.add(socket.id);
            socket.join('host_room');
            socket.emit('host_state_update', buildHostState());
        } else {
            console.log(`Failed admin login attempt from ${socket.id}`);
        }
    });

    // 4. SUBMIT VOTE
    socket.on('submit_vote', ({ vote, sessionId }) => {
        // SECURITY: Validate Input
        if (!['AI', 'REAL'].includes(vote)) return;

        const player = playersPersistence[sessionId];
        
        if (gameState.status === 'QUESTION' && player && !player.lastVote) {
            player.lastVote = vote;
            
            if (gameState.roundVotes[vote] !== undefined) {
                gameState.roundVotes[vote]++;
            }
            
            io.emit('stats_update', gameState.roundVotes);
            socket.emit('vote_registered', vote);
        }
    });

    // 5. DISCONNECT HANDLING (Fixes "Zombie Players")
    socket.on('disconnect', () => {
        if (authorizedHosts.has(socket.id)) {
            authorizedHosts.delete(socket.id);
        }

        // Mark player as disconnected
        Object.values(playersPersistence).forEach(p => {
            if (p.socketId === socket.id) {
                p.socketId = null;
            }
        });

        // Notify host so UI can update (e.g. show greyed out user)
        io.to('host_room').emit('host_state_update', buildHostState());
    });

    // --- ADMIN ACTIONS (Protected) ---

    socket.on('admin_start_round', () => {
        if (!authorizedHosts.has(socket.id)) return; // Auth Check

        const roundData = questions[gameState.currentRoundIndex];
        if (!roundData) return;

        console.log(`STARTING ROUND ${gameState.currentRoundIndex + 1}`);

        gameState.status = 'QUESTION';
        gameState.roundVotes = { AI: 0, REAL: 0 }; 
        gameState.timeLeft = ROUND_DURATION;
        gameState.lastResult = null; 
        
        Object.values(playersPersistence).forEach(p => p.lastVote = null);

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
                    console.error("Error in revealAnswer:", err);
                    clearInterval(timerInterval); // Ensure timer stops on error
                }
            }
        }, 1000);
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
            gameState.status = 'LOBBY'; 
            io.emit('state_update', buildGlobalState());
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

function revealAnswer() {
    if (gameState.status !== 'QUESTION') return;

    gameState.status = 'REVEAL'; 
    const currentQ = questions[gameState.currentRoundIndex];
    
    // COMPATIBILITY FIX: Map "HUMAN" in data to "REAL"
    let dbAnswer = String(currentQ.answer || '').toUpperCase();
    if (dbAnswer === 'HUMAN') dbAnswer = 'REAL';

    // CALCULATE SCORES
    Object.values(playersPersistence).forEach(player => {
        const playerVote = String(player.lastVote || '').toUpperCase();
        const playerSocket = io.sockets.sockets.get(player.socketId);

        let roundScore = 0;
        if (playerVote === dbAnswer) {
            roundScore = 100; // Base score
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

server.listen(3001, () => console.log('SERVER RUNNING ON 3001'));