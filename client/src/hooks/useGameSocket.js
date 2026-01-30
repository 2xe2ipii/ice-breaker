import { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';

export function useGameSocket() {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  const [stats, setStats] = useState({ HUMAN: 0, AI: 0 });
  const [timer, setTimer] = useState(0);
  const [result, setResult] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // CRITICAL FIX: Use ref to track vote without re-binding listeners
  const myVoteRef = useRef(null);

  useEffect(() => {
    myVoteRef.current = myVote;
  }, [myVote]);

  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }
    
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    
    socket.on('state_update', (state) => {
        setGameState(state);
    });

    socket.on('stats_update', setStats);
    socket.on('timer_update', setTimer);
    
    socket.on('new_round', () => {
        setMyVote(null);
        setFeedback(null);
        setResult(null);
    });

    socket.on('vote_registered', (v) => {
        setMyVote(v);
    });
    
    socket.on('round_result', (data) => {
        setResult(data);
        // Use Ref to check vote so we don't depend on stale closure
        if (myVoteRef.current) {
            const success = String(myVoteRef.current).toUpperCase() === String(data.correctAnswer).toUpperCase();
            setFeedback(success ? 'Correct' : 'Wrong');
        }
    });

    socket.on('game_reset_event', () => {
        localStorage.clear();
        window.location.reload(); 
    });

    // Manual Handshake
    if (socket.connected) {
        onConnect();
        socket.emit('request_state'); 
    } else {
        socket.connect();
    }
    socket.on('connect', () => socket.emit('request_state'));

    return () => {
        socket.off();
    };
  }, []); // Dependency array is EMPTY now to prevent re-binding

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
    stats,
    timer,
    result,
    myVote,
    feedback,
    actions: { joinGame, submitVote, adminStart, adminShowScores, adminNext, adminReset }
  };
}