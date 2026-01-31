import { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';

export function useGameSocket(isHost = false) {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  // Player Specific Data
  const [myScore, setMyScore] = useState(0);
  const [myVote, setMyVote] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Host Specific Data
  const [playerList, setPlayerList] = useState([]);

  // Refs for stale closure prevention
  const myVoteRef = useRef(null);
  useEffect(() => { myVoteRef.current = myVote; }, [myVote]);

  useEffect(() => {
    function onConnect() { 
        setIsConnected(true);
        if (isHost) socket.emit('host_login');
        socket.emit('request_state');
    }
    
    function onDisconnect() { setIsConnected(false); }

    // 1. Generic State Update (Shared)
    socket.on('state_update', (state) => {
        setGameState(state);
    });

    // 2. Host Specific Update (Player List)
    socket.on('host_state_update', (state) => {
        setGameState(state); // Host gets a richer state object
        if (state.players) setPlayerList(state.players);
    });

    // 3. Player Specific Data (Score & Vote Confirmation)
    socket.on('player_data_update', (data) => {
        if (data.score !== undefined) setMyScore(data.score);
        if (data.myVote !== undefined) setMyVote(data.myVote);
        if (data.roundResult) {
            setFeedback(data.roundResult);
            // Clear feedback after 3 seconds so it doesn't stick forever
            setTimeout(() => setFeedback(null), 3000); 
        }
    });

    // 4. Vote Registered Confirmation
    socket.on('vote_registered', (vote) => {
        setMyVote(vote);
    });
    
    // 5. New Round Reset
    socket.on('new_round', () => {
        setMyVote(null);
        setFeedback(null);
    });

    // 6. Preload Assets (The Magic Fix for Lag)
    socket.on('preload_assets', (urls) => {
        console.log('Preloading assets...', urls);
        urls.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    });

    socket.on('game_reset_event', () => {
        localStorage.clear();
        window.location.reload(); 
    });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Initial Handshake
    if (socket.connected) {
        onConnect();
    } else {
        socket.connect();
    }

    return () => {
        socket.off();
    };
  }, [isHost]);

  // Actions
  const joinGame = (name, sessionId) => socket.emit('join_game', { name, sessionId });
  const submitVote = (vote, sessionId) => socket.emit('submit_vote', { vote, sessionId });
  const adminStart = () => socket.emit('admin_start_round');
  const adminShowScores = () => socket.emit('admin_show_leaderboard');
  const adminNext = () => socket.emit('admin_next_round');
  const adminReset = () => socket.emit('admin_hard_reset');

  return {
    isConnected,
    gameState,
    playerList, // New export for Host
    myScore,    // New export for Player
    myVote,
    feedback,
    actions: { joinGame, submitVote, adminStart, adminShowScores, adminNext, adminReset }
  };
}