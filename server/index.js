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

// --- GAME STATE ---
let gameState = {
    status: 'LOBBY', // LOBBY, QUESTION, RESULTS
    currentRoundIndex: 0,
    roundVotes: { AI: 0, HUMAN: 0 },
    timeLeft: 0
};

// Store players separately to persist them by "session ID"
// Format: { "session_uuid": { name: "Neo", score: 0, socketId: "abc", lastVote: null } }
let playersPersistence = {}; 

let timerInterval = null;

io.on('connection', (socket) => {
    // 1. Send Immediate State (Fixes "Connecting..." hang)
    socket.emit('state_update', buildClientState());

    // 2. JOIN WITH SESSION (Fixes Refresh)
    socket.on('join_game', ({ name, sessionId }) => {
        // If this session exists, reconnect them
        if (playersPersistence[sessionId]) {
            playersPersistence[sessionId].socketId = socket.id;
            playersPersistence[sessionId].name = name; // Update name if changed
        } else {
            // Create new player
            playersPersistence[sessionId] = {
                name: name || 'Anon',
                score: 0,
                socketId: socket.id,
                lastVote: null
            };
        }

        // Send them to the "Current" state immediately
        socket.emit('state_update', buildClientState());
        
        // If a round is actively in progress, tell them if they already voted
        const player = playersPersistence[sessionId];
        if (gameState.status === 'QUESTION' && player.lastVote) {
             socket.emit('vote_registered', player.lastVote);
        }

        io.emit('player_count', Object.keys(playersPersistence).length);
    });

    // 3. VOTE
    socket.on('submit_vote', ({ vote, sessionId }) => {
        const player = playersPersistence[sessionId];
        if (gameState.status === 'QUESTION' && player && !player.lastVote) {
            player.lastVote = vote;
            gameState.roundVotes[vote]++;
            io.emit('stats_update', gameState.roundVotes);
            socket.emit('vote_registered', vote);
        }
    });

    // --- ADMIN CONTROLS ---

    socket.on('admin_start_round', () => {
        const roundData = questions[gameState.currentRoundIndex];
        if (!roundData) return;

        gameState.status = 'QUESTION';
        gameState.roundVotes = { AI: 0, HUMAN: 0 };
        gameState.timeLeft = 15;
        
        // Reset votes for this round
        Object.values(playersPersistence).forEach(p => p.lastVote = null);

        io.emit('new_round', { ...roundData, timeLeft: 15 });
        io.emit('state_update', buildClientState());

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            gameState.timeLeft--;
            io.emit('timer_update', gameState.timeLeft);
            if (gameState.timeLeft <= 0) {
                clearInterval(timerInterval);
                revealResults();
            }
        }, 1000);
    });

    socket.on('admin_next_round', () => {
        gameState.currentRoundIndex++;
        // If we run out of questions, cycle back or end? Let's stay in LOBBY for now.
        if (gameState.currentRoundIndex >= questions.length) {
            // Game Over logic could go here, for now just loop or crash safely
            gameState.currentRoundIndex = 0; // Loop back for demo purposes
        }
        gameState.status = 'LOBBY';
        io.emit('state_update', buildClientState());
    });

    socket.on('admin_reset', () => {
        gameState.currentRoundIndex = 0;
        gameState.status = 'LOBBY';
        playersPersistence = {}; // Clear all users
        io.emit('state_update', buildClientState());
    });
});

function revealResults() {
    gameState.status = 'RESULTS';
    const currentQ = questions[gameState.currentRoundIndex];
    
    // Scoring
    Object.values(playersPersistence).forEach(player => {
        if (player.lastVote === currentQ.answer) {
            player.score += 100;
        }
    });

    io.emit('round_result', {
        correctAnswer: currentQ.answer,
        stats: gameState.roundVotes,
        leaderboard: Object.values(playersPersistence)
            .sort((a,b) => b.score - a.score)
            .slice(0, 5)
    });
    io.emit('state_update', buildClientState());
}

// Helper to send clean state object
function buildClientState() {
    return {
        status: gameState.status,
        currentRoundIndex: gameState.currentRoundIndex,
        roundVotes: gameState.roundVotes,
        timeLeft: gameState.timeLeft
    };
}

server.listen(3001, () => console.log('SERVER RUNNING ON 3001'));