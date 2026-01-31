import { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';

export function useGameSocket(isHost = false) {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  // Timer State (Separate from gameState to allow frequent updates)
  const [timer, setTimer] = useState(0);

  // Player Specific Data
  const [myScore, setMyScore] = useState(0);
  const [myVote, setMyVote] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Host Specific Data
  const [playerList, setPlayerList] = useState([]);

  const myVoteRef = useRef(null);
  useEffect(() => { myVoteRef.current = myVote; }, [myVote]);

  useEffect(() => {
    function onConnect() { 
        setIsConnected(true);
        if (isHost) socket.emit('host_login');
        socket.emit('request_state');
    }
    
    function onDisconnect() { setIsConnected(false); }

    socket.on('state_update', (state) => {
        setGameState(state);
        // Sync timer with server state initially
        if (state.timeLeft) setTimer(state.timeLeft);
    });

    socket.on('host_state_update', (state) => {
        setGameState(state);
        if (state.players) setPlayerList(state.players);
    });

    // --- CRITICAL FIX: LISTENING TO TIMER UPDATE ---
    socket.on('timer_update', (time) => {
        setTimer(time);
    });

    socket.on('player_data_update', (data) => {
        if (data.score !== undefined) setMyScore(data.score);
        if (data.myVote !== undefined) setMyVote(data.myVote);
        if (data.roundResult) {
            setFeedback(data.roundResult);
            setTimeout(() => setFeedback(null), 3000); 
        }
    });

    socket.on('vote_registered', (vote) => setMyVote(vote));
    
    socket.on('new_round', (data) => {
        setMyVote(null);
        setFeedback(null);
        if (data.timeLeft) setTimer(data.timeLeft);
    });

    socket.on('preload_assets', (urls) => {
        urls.forEach(url => { const img = new Image(); img.src = url; });
    });

    socket.on('game_reset_event', () => {
        localStorage.clear();
        window.location.reload(); 
    });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => socket.off();
  }, [isHost]);

  const joinGame = (name, sessionId) => socket.emit('join_game', { name, sessionId });
  const submitVote = (vote, sessionId) => socket.emit('submit_vote', { vote, sessionId });
  const adminStart = () => socket.emit('admin_start_round');
  const adminShowScores = () => socket.emit('admin_show_leaderboard');
  const adminNext = () => socket.emit('admin_next_round');
  const adminReset = () => socket.emit('admin_hard_reset');

  return {
    isConnected,
    gameState,
    playerList, 
    myScore,
    myVote,
    feedback,
    timer, // EXPORTING TIMER
    actions: { joinGame, submitVote, adminStart, adminShowScores, adminNext, adminReset }
  };
}