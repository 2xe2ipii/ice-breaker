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

const INITIAL_STATE = {
    status: 'LOBBY',
    currentRoundIndex: 0,
    roundVotes: { AI: 0, HUMAN: 0 },
    timeLeft: 0
};

let gameState = { ...INITIAL_STATE };
let playersPersistence = {}; 
let timerInterval = null;

const buildClientState = () => ({
    status: gameState.status,
    currentRoundIndex: gameState.currentRoundIndex,
    roundVotes: gameState.roundVotes,
    timeLeft: gameState.timeLeft
});

io.on('connection', (socket) => {
    // 1. Handshake
    socket.on('request_state', () => {
        socket.emit('state_update', buildClientState());
        io.emit('player_count', Object.keys(playersPersistence).length);
    });

    // 2. Join
    socket.on('join_game', ({ name, sessionId }) => {
        // If this session exists, update the socket ID so we can talk to them
        if (playersPersistence[sessionId]) {
            playersPersistence[sessionId].socketId = socket.id;
            playersPersistence[sessionId].name = name; // Update name if they changed it
        } else {
            // New player
            playersPersistence[sessionId] = {
                name: name || 'Player',
                score: 0,
                lastVote: null,
                socketId: socket.id
            };
        }
        
        socket.emit('state_update', buildClientState());
        io.emit('player_count', Object.keys(playersPersistence).length);
        
        const player = playersPersistence[sessionId];
        if (gameState.status === 'QUESTION' && player.lastVote) {
             socket.emit('vote_registered', player.lastVote);
        }
    });

    // 3. Vote
    socket.on('submit_vote', ({ vote, sessionId }) => {
        const player = playersPersistence[sessionId];
        if (gameState.status === 'QUESTION' && player && !player.lastVote) {
            player.lastVote = vote;
            gameState.roundVotes[vote]++;
            io.emit('stats_update', gameState.roundVotes);
            socket.emit('vote_registered', vote);
        }
    });

    // --- ADMIN ACTIONS ---

    socket.on('admin_start_round', () => {
        const roundData = questions[gameState.currentRoundIndex];
        if (!roundData) {
            console.error("CRITICAL: Question data missing for index", gameState.currentRoundIndex);
            return; 
        }

        console.log(`STARTING ROUND ${gameState.currentRoundIndex + 1}`);

        gameState.status = 'QUESTION';
        gameState.roundVotes = { AI: 0, HUMAN: 0 };
        gameState.timeLeft = 15;
        
        Object.values(playersPersistence).forEach(p => p.lastVote = null);

        io.emit('new_round', { ...roundData, timeLeft: 15 });
        io.emit('state_update', buildClientState());

        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            gameState.timeLeft--;
            io.emit('timer_update', gameState.timeLeft);
            if (gameState.timeLeft <= 0) {
                clearInterval(timerInterval);
                revealAnswer();
            }
        }, 1000);
    });

    socket.on('admin_show_leaderboard', () => {
        gameState.status = 'LEADERBOARD';
        io.emit('state_update', buildClientState());
    });

    socket.on('admin_next_round', () => {
        if (timerInterval) clearInterval(timerInterval);

        gameState.currentRoundIndex++;
        if (gameState.currentRoundIndex >= questions.length) {
            gameState.currentRoundIndex = 0; 
        }
        
        console.log(`MOVING TO LOBBY FOR ROUND ${gameState.currentRoundIndex + 1}`);
        
        gameState.status = 'LOBBY';
        io.emit('state_update', buildClientState());
    });

    // --- THE FIX IS HERE ---
    socket.on('admin_hard_reset', () => {
        if (timerInterval) clearInterval(timerInterval);
        
        // 1. Reset Game State
        gameState = { ...INITIAL_STATE };
        gameState.roundVotes = { AI: 0, HUMAN: 0 };
        
        // 2. NUKE THE PLAYERS (This deletes the ghosts)
        playersPersistence = {}; 
        
        // 3. Tell everyone to get lost (refresh)
        io.emit('game_reset_event');
        io.emit('state_update', buildClientState());
        io.emit('player_count', 0); // Update host count to 0
    });
});

function revealAnswer() {
    if (gameState.status !== 'QUESTION') return;

    gameState.status = 'REVEAL'; 
    const currentQ = questions[gameState.currentRoundIndex];
    
    if (!currentQ) return;

    Object.values(playersPersistence).forEach(player => {
        const playerVote = String(player.lastVote || '').toUpperCase();
        const correct = String(currentQ.answer || '').toUpperCase();
        
        if (playerVote === correct) {
            player.score += 100;
        }
    });

    io.emit('round_result', {
        correctAnswer: currentQ.answer.toUpperCase(),
        stats: gameState.roundVotes,
        leaderboard: Object.values(playersPersistence)
            .sort((a,b) => b.score - a.score)
            .slice(0, 5)
    });
    io.emit('state_update', buildClientState());
}

server.listen(3001, () => console.log('SERVER RUNNING ON 3001'));