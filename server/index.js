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

// --- STATE ---
const INITIAL_STATE = {
    status: 'LOBBY',           // LOBBY, QUESTION, REVEAL, LEADERBOARD, GAME_OVER
    currentRoundIndex: 0,
    roundVotes: { AI: 0, REAL: 0 }, // CHANGED: HUMAN -> REAL
    timeLeft: 0,
    lastResult: null,          // Persist the result for refreshes
    gameFinished: false        // Track if game is done
};

let gameState = { ...INITIAL_STATE };
let playersPersistence = {}; 
let timerInterval = null;

// --- HELPERS ---

// Global State (Public info for everyone)
const buildGlobalState = () => ({
    status: gameState.status,
    currentRoundIndex: gameState.currentRoundIndex,
    roundVotes: gameState.roundVotes,
    timeLeft: gameState.timeLeft,
    // If we are in REVEAL or LEADERBOARD or GAME_OVER, send the result. Otherwise null.
    result: (gameState.status === 'REVEAL' || gameState.status === 'LEADERBOARD' || gameState.status === 'GAME_OVER') 
            ? gameState.lastResult 
            : null,
    totalRounds: TOTAL_ROUNDS
});

// Host-Specific State (Sensitive info like player lists)
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
    
    // 1. GENERIC STATE REQUEST (Used by Host & Players on reconnect)
    socket.on('request_state', () => {
        socket.emit('state_update', buildGlobalState());
    });

    // 2. PLAYER JOIN
    socket.on('join_game', ({ name, sessionId }) => {
        // Recover or Create Player
        if (playersPersistence[sessionId]) {
            playersPersistence[sessionId].socketId = socket.id;
            playersPersistence[sessionId].name = name; 
        } else {
            playersPersistence[sessionId] = {
                id: sessionId,
                name: name || 'Player',
                score: 0,
                lastVote: null,
                socketId: socket.id
            };
        }
        
        const player = playersPersistence[sessionId];

        // A. Send immediate feedback to this player (Score & Vote status)
        socket.emit('player_data_update', {
            score: player.score,
            myVote: player.lastVote
        });

        // B. PRE-FETCH STRATEGY: Send all image URLs to client for background loading
        const assetUrls = questions.map(q => q.content);
        socket.emit('preload_assets', assetUrls);

        // C. Update Global State for everyone (Player count changed)
        io.emit('state_update', buildGlobalState());
        
        // D. Update Host specifically (Needs the list of names)
        io.to('host_room').emit('host_state_update', buildHostState());
    });

    // 3. HOST JOIN (New event to identify the host)
    socket.on('host_login', () => {
        socket.join('host_room');
        socket.emit('host_state_update', buildHostState());
    });

    // 4. SUBMIT VOTE
    socket.on('submit_vote', ({ vote, sessionId }) => {
        const player = playersPersistence[sessionId];
        
        // Only accept vote if player exists AND round is active AND they haven't voted
        if (gameState.status === 'QUESTION' && player && !player.lastVote) {
            player.lastVote = vote;
            
            // Safety check for vote key
            if (gameState.roundVotes[vote] !== undefined) {
                gameState.roundVotes[vote]++;
            }
            
            // 1. Notify everyone of the bar chart change
            io.emit('stats_update', gameState.roundVotes);
            
            // 2. Confirm vote to the specific player
            socket.emit('vote_registered', vote);
        }
    });

    // --- ADMIN ACTIONS ---

    socket.on('admin_start_round', () => {
        const roundData = questions[gameState.currentRoundIndex];
        if (!roundData) return;

        console.log(`STARTING ROUND ${gameState.currentRoundIndex + 1}`);

        // Reset Round State
        gameState.status = 'QUESTION';
        gameState.roundVotes = { AI: 0, REAL: 0 }; // CHANGED: HUMAN -> REAL
        gameState.timeLeft = ROUND_DURATION;
        gameState.lastResult = null; // Clear previous result
        
        // Clear player votes for this round
        Object.values(playersPersistence).forEach(p => p.lastVote = null);

        // Broadcast New Round
        io.emit('new_round', { ...roundData, timeLeft: ROUND_DURATION });
        io.emit('state_update', buildGlobalState());

        // Start Timer
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
        io.emit('state_update', buildGlobalState());
    });

    socket.on('admin_next_round', () => {
        if (timerInterval) clearInterval(timerInterval);

        const nextIndex = gameState.currentRoundIndex + 1;

        // GAME OVER Logic
        if (nextIndex >= TOTAL_ROUNDS) {
            gameState.status = 'GAME_OVER';
            gameState.gameFinished = true;
            
            // Calculate final standings
            const finalLeaderboard = Object.values(playersPersistence)
                .sort((a,b) => b.score - a.score)
                .slice(0, 10); // Show Top 10 at end
            
            gameState.lastResult = { leaderboard: finalLeaderboard }; // Store for refresh
            
            io.emit('state_update', buildGlobalState());
        } else {
            gameState.currentRoundIndex = nextIndex;
            gameState.status = 'LOBBY'; // Brief pause before host starts next
            io.emit('state_update', buildGlobalState());
        }
    });

    socket.on('admin_hard_reset', () => {
        if (timerInterval) clearInterval(timerInterval);
        
        gameState = { ...INITIAL_STATE };
        gameState.roundVotes = { AI: 0, REAL: 0 }; // CHANGED: HUMAN -> REAL
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

        // Send individual feedback to player (so they see their new total score)
        if (playerSocket) {
            playerSocket.emit('player_data_update', {
                score: player.score,
                roundResult: playerVote === dbAnswer ? 'CORRECT' : 'WRONG'
            });
        }
    });

    // GENERATE RESULT DATA
    // We sort differently for Round Reveal (Top 5) vs Game Over
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