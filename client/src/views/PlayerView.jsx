import { useState, useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import LongPressButton from '../components/LongPressButton';
import Loader from '../components/Loader';

const getSessionId = () => {
  let id = localStorage.getItem('game_session_id');
  if (!id) {
    id = Math.random().toString(36).substr(2, 9);
    localStorage.setItem('game_session_id', id);
  }
  return id;
};

export default function PlayerView() {
  const { gameState, myVote, feedback, actions } = useGameSocket();
  const [name, setName] = useState(localStorage.getItem('player_name') || '');
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('joined_before')) {
      actions.joinGame(name, getSessionId());
      setHasJoined(true);
    }
  }, []);

  const handleJoin = () => {
    if (!name.trim()) return;
    localStorage.setItem('player_name', name);
    localStorage.setItem('joined_before', 'true');
    actions.joinGame(name, getSessionId());
    setHasJoined(true);
  };

  if (!hasJoined) {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-white tracking-widest uppercase mb-8 border-b border-indigo-500 pb-2">Real or AI?</h1>
        <input 
          className="bg-slate-800 border border-slate-700 text-white p-4 w-full rounded mb-4 focus:border-indigo-500 outline-none transition-colors"
          placeholder="Enter your name"
          value={name} onChange={e => setName(e.target.value)}
        />
        <button onClick={handleJoin} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-4 font-bold rounded tracking-wider transition-all">
          Join Game
        </button>
      </div>
    );
  }

  if (!gameState || gameState.status === 'LOBBY') {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex items-center justify-center">
        <Loader text="Waiting for host..." />
      </div>
    );
  }

  if (gameState.status === 'QUESTION') {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex flex-col p-4">
        <div className="flex-1 bg-slate-800 rounded border border-slate-700 overflow-hidden flex items-center justify-center mb-6 relative">
             <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="object-contain max-h-full w-full opacity-90" />
             <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-emerald-400 text-xs font-bold border border-emerald-500/30 rounded">LIVE</div>
        </div>
        <div className="space-y-4 pb-8">
            <LongPressButton 
                label="HUMAN" colorClass="bg-indigo-600"
                onClick={() => actions.submitVote('HUMAN', getSessionId())}
                selected={myVote === 'HUMAN'} disabled={!!myVote}
            />
            <LongPressButton 
                label="AI" colorClass="bg-indigo-600"
                onClick={() => actions.submitVote('AI', getSessionId())}
                selected={myVote === 'AI'} disabled={!!myVote}
            />
        </div>
      </div>
    );
  }

  if (gameState.status === 'REVEAL' || gameState.status === 'LEADERBOARD') {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex flex-col items-center justify-center text-center p-6">
        <h2 className={`text-6xl font-bold mb-4 ${feedback === 'Correct' ? 'text-emerald-400' : 'text-rose-500'}`}>
            {feedback === 'Correct' ? 'CORRECT' : 'WRONG'}
        </h2>
        <p className="text-slate-400 text-lg">Look at the screen for the answer.</p>
      </div>
    );
  }

  return null;
}