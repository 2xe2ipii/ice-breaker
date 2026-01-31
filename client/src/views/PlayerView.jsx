import { useState, useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import LongPressButton from '../components/LongPressButton';
import Loader from '../components/Loader';

// Helper for safe storage access
const safeGetItem = (key) => {
  try { return localStorage.getItem(key); } catch(e) { return null; }
};
const safeSetItem = (key, val) => {
  try { localStorage.setItem(key, val); } catch(e) { console.warn('Storage failed', e); }
};

const getSessionId = () => {
  let id = safeGetItem('game_session_id');
  if (!id) {
    id = Math.random().toString(36).substr(2, 9);
    safeSetItem('game_session_id', id);
  }
  return id;
};

export default function PlayerView() {
  const { gameState, myScore, myVote, feedback, timer, actions } = useGameSocket();
  const [name, setName] = useState(safeGetItem('player_name') || '');
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    if (safeGetItem('joined_before')) {
      actions.joinGame(name, getSessionId());
      setHasJoined(true);
    }
  }, []);

  const handleJoin = () => {
    if (!name.trim()) return;
    safeSetItem('player_name', name);
    safeSetItem('joined_before', 'true');
    actions.joinGame(name, getSessionId());
    setHasJoined(true);
  };

  // ... (Rest of the UI remains exactly the same as previous step)
  if (!hasJoined) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-black italic uppercase mb-8 transform -skew-x-6">Real or AI?</h1>
        <input 
          className="bg-gray-100 border-4 border-black text-black font-bold text-lg p-4 w-full rounded-xl mb-4 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          placeholder="ENTER YOUR NAME"
          value={name} onChange={e => setName(e.target.value)}
        />
        <button onClick={handleJoin} className="w-full bg-[#fffd00] hover:bg-[#ebe900] text-black border-4 border-black p-4 font-bold text-2xl rounded-xl tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none transition-all uppercase">
          JOIN GAME
        </button>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <Loader text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 flex flex-col relative overflow-hidden">
      
      {/* HEADER */}
      <div className="bg-white p-4 border-b-4 border-black flex justify-between items-center z-10 sticky top-0">
        <span className="font-bold text-lg truncate max-w-[50%] uppercase">{name}</span>
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Score</span>
            <span className="text-black font-mono font-black text-2xl">{myScore}</span>
        </div>
      </div>

      {/* FEEDBACK OVERLAY */}
      {feedback && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur animate-in fade-in zoom-in duration-200">
            <h1 className={`text-6xl font-black uppercase tracking-tighter italic ${feedback === 'CORRECT' ? 'text-[#00c9c7]' : 'text-rose-500'} drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]`}>
                {feedback}
            </h1>
        </div>
      )}

      {/* GAME CONTENT */}
      <div className="flex-1 flex flex-col p-4 pb-8 max-w-md mx-auto w-full">
        
        {/* A. LOBBY */}
        {gameState.status === 'LOBBY' && (
           <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 border-4 border-black border-t-[#fd00ff] rounded-full animate-spin"></div>
              <p className="text-slate-900 font-bold text-lg animate-pulse uppercase">
                Waiting for host...
              </p>
           </div>
        )}

        {/* B. QUESTION */}
        {gameState.status === 'QUESTION' && (
            <>
                <div className="bg-gray-100 rounded-2xl border-4 border-black overflow-hidden flex items-center justify-center mb-6 relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] aspect-square">
                    {/* FIX: Use gameState.currentImage */}
                    <img src={gameState.currentImage} className="object-cover h-full w-full" />
                    
                    {/* Timer */}
                    <div className="absolute top-2 right-2 w-12 h-12 bg-white text-black border-4 border-black rounded-full flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {timer}
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-4 justify-end">
                    <LongPressButton 
                        label="REAL" 
                        colorClass="bg-[#00fffd]" // Cyan
                        onClick={() => actions.submitVote('REAL', getSessionId())}
                        selected={myVote === 'REAL'} disabled={!!myVote}
                    />
                    <LongPressButton 
                        label="AI" 
                        colorClass="bg-[#fd00ff]" // Magenta
                        onClick={() => actions.submitVote('AI', getSessionId())}
                        selected={myVote === 'AI'} disabled={!!myVote}
                    />
                </div>
            </>
        )}

        {/* C. REVEAL / LEADERBOARD */}
        {(gameState.status === 'REVEAL' || gameState.status === 'LEADERBOARD') && !feedback && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 animate-in fade-in">
                <div className="text-6xl mb-4">👀</div>
                <h2 className="text-3xl font-black italic uppercase mb-2">Eyes on the TV</h2>
                <p className="text-slate-500 font-medium">Check the results on the big screen.</p>
            </div>
        )}

        {/* D. GAME OVER */}
        {gameState.status === 'GAME_OVER' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <h1 className="text-5xl font-black text-black italic mb-2">GAME OVER</h1>
                <p className="text-slate-500 font-bold mb-8">THANKS FOR PLAYING!</p>
                <div className="bg-[#fffd00] p-8 rounded-2xl border-4 border-black w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <div className="text-black font-bold text-sm uppercase tracking-widest mb-2">Your Final Score</div>
                    <div className="text-6xl font-mono font-black text-black">{myScore}</div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}