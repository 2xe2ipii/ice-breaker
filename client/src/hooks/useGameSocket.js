import { useEffect, useState, useRef } from 'react';
import { socket } from '../socket';

export function useGameSocket(isHost = false) {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [timer, setTimer] = useState(0);
  const [authError, setAuthError] = useState(null);

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
        // Only players request generic state immediately. Hosts must login manually.
        if (!isHost) socket.emit('request_state');
    }
    
    function onDisconnect() { setIsConnected(false); }

    function onStateUpdate(state) {
        setGameState(state);
        if (state.timeLeft) setTimer(state.timeLeft);
    }

    function onHostStateUpdate(state) {
        setGameState(state);
        if (state.players) setPlayerList(state.players);
    }

    function onTimerUpdate(time) {
        setTimer(time);
    }

    function onStatsUpdate(roundVotes) {
        setGameState(prev => {
            if (!prev) return prev;
            return { ...prev, roundVotes };
        });
    }

    function onPlayerDataUpdate(data) {
        if (data.score !== undefined) setMyScore(data.score);
        if (data.myVote !== undefined) setMyVote(data.myVote);
        if (data.roundResult) {
            setFeedback(data.roundResult);
            setTimeout(() => setFeedback(null), 3000); 
        }
    }

    function onVoteRegistered(vote) {
        setMyVote(vote);
    }

    function onNewRound(data) {
        setMyVote(null);
        setFeedback(null);
        if (data.timeLeft) setTimer(data.timeLeft);
    }

    function onPreloadAssets(urls) {
        urls.forEach(url => { const img = new Image(); img.src = url; });
    }

    function onGameReset() {
        localStorage.clear();
        window.location.reload(); 
    }

    function onLoginError(msg) {
        setAuthError(msg);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state_update', onStateUpdate);
    socket.on('host_state_update', onHostStateUpdate);
    socket.on('timer_update', onTimerUpdate);
    socket.on('stats_update', onStatsUpdate);
    socket.on('player_data_update', onPlayerDataUpdate);
    socket.on('vote_registered', onVoteRegistered);
    socket.on('new_round', onNewRound);
    socket.on('preload_assets', onPreloadAssets);
    socket.on('game_reset_event', onGameReset);
    socket.on('login_error', onLoginError);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('state_update', onStateUpdate);
        socket.off('host_state_update', onHostStateUpdate);
        socket.off('timer_update', onTimerUpdate);
        socket.off('stats_update', onStatsUpdate);
        socket.off('player_data_update', onPlayerDataUpdate);
        socket.off('vote_registered', onVoteRegistered);
        socket.off('new_round', onNewRound);
        socket.off('preload_assets', onPreloadAssets);
        socket.off('game_reset_event', onGameReset);
        socket.off('login_error', onLoginError);
    };
  }, [isHost]);

  const joinGame = (name, sessionId) => socket.emit('join_game', { name, sessionId });
  const submitVote = (vote, sessionId) => socket.emit('submit_vote', { vote, sessionId });
  
  const loginHost = (password) => {
      setAuthError(null);
      socket.emit('host_login', password);
  };

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
    timer,
    authError,
    actions: { joinGame, submitVote, loginHost, adminStart, adminShowScores, adminNext, adminReset }
  };
}