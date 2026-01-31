import { useState, useEffect } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import Loader from '../components/Loader';

const safeGetItem = (key) => {
  try { return localStorage.getItem(key); } catch(e) { return null; }
};
const safeSetItem = (key, val) => {
  try { localStorage.setItem(key, val); } catch(e) { console.warn(e); }
};

const getSessionId = () => {
  let id = safeGetItem('game_session_id');
  if (!id) {
    id = Math.random().toString(36).substr(2, 9);
    safeSetItem('game_session_id', id);
  }
  return id;
};

// MOVED OUTSIDE to prevent re-renders losing input focus
const MobileWrapper = ({ children, className = "" }) => (
  <div className={`min-h-[100dvh] w-full bg-slate-900 flex flex-col items-center justify-center`}>
    <div className={`w-full max-w-[450px] h-[100dvh] bg-white shadow-2xl overflow-hidden flex flex-col relative ${className}`}>
      {children}
    </div>
  </div>
);

export default function PlayerView() {
  const { gameState, myScore, myVote, feedback, timer, actions } = useGameSocket();
  const [name, setName] = useState(safeGetItem('player_name') || '');
  const [hasJoined, setHasJoined] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);

  useEffect(() => {
    if (safeGetItem('joined_before')) {
      actions.joinGame(name, getSessionId());
      setHasJoined(true);
    }
  }, []);

  useEffect(() => {
    window.history.pushState(null, null, window.location.pathname);
    const handlePopState = () => {
      window.history.pushState(null, null, window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (gameState?.status === 'QUESTION') {
        setSelectedOption(null);
    }
  }, [gameState?.status, gameState?.currentRoundIndex]);

  const handleJoin = () => {
    if (!name.trim()) return;
    safeSetItem('player_name', name);
    safeSetItem('joined_before', 'true');
    actions.joinGame(name, getSessionId());
    setHasJoined(true);
  };

  const handleLockIn = () => {
    if (selectedOption && !myVote) {
        actions.submitVote(selectedOption, getSessionId());
    }
  };

  if (!hasJoined) {
    return (
      <MobileWrapper>
        <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-8">
            <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-[#00fffd] rounded-full blur-[80px] opacity-40"></div>
            <div className="absolute bottom-[-100px] right-[-100px] w-64 h-64 bg-[#fd00ff] rounded-full blur-[80px] opacity-40"></div>
            
            <h1 className="text-6xl font-black italic uppercase text-center mb-12 transform -skew-x-6 z-10 leading-none">
                REAL<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00fffd] to-[#fd00ff]">OR AI?</span>
            </h1>

            <div className="w-full space-y-6 z-10">
                <input 
                    className="w-full border-b-4 border-black bg-gray-50 text-center text-3xl font-bold py-4 focus:outline-none placeholder:text-gray-300 uppercase tracking-widest"
                    placeholder="NAME"
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    maxLength={12}
                />
                <button 
                    onClick={handleJoin} 
                    className="w-full py-5 bg-black text-[#fffd00] text-2xl font-black uppercase tracking-widest border-4 border-black hover:bg-slate-800 active:scale-95 transition-all shadow-[6px_6px_0px_rgba(0,0,0,0.2)]"
                >
                    ENTER
                </button>
            </div>
        </div>
      </MobileWrapper>
    );
  }

  if (!gameState) {
    return (
      <MobileWrapper className="items-center justify-center">
        <Loader text="Connecting..." />
      </MobileWrapper>
    );
  }

  return (
    <MobileWrapper>
      <div className="bg-white p-4 border-b-4 border-black flex justify-between items-center z-10 sticky top-0">
        <span className="font-bold text-xl truncate max-w-[50%] uppercase tracking-tight">{name}</span>
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Score</span>
            <span className="text-black font-mono font-black text-3xl">{myScore}</span>
        </div>
      </div>

      {feedback && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur animate-in fade-in zoom-in duration-200">
            <h1 className={`text-6xl font-black uppercase tracking-tighter italic ${feedback === 'CORRECT' ? 'text-[#00fffd] drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]' : 'text-[#fd00ff] drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]'}`}>
                {feedback}
            </h1>
        </div>
      )}

      <div className="flex-1 flex flex-col p-6 w-full h-full relative overflow-y-auto">
        
        {/* LOBBY with RULES */}
        {gameState.status === 'LOBBY' && (
           <div className="flex-1 flex flex-col items-center justify-start pt-8 space-y-8">
              
              <div className="text-center">
                  <h2 className="text-4xl font-black uppercase italic mb-2">YOU'RE IN!</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest">
                    Waiting for host...
                  </p>
                  <div className="inline-block bg-black text-[#fffd00] px-4 py-1 rounded-full font-bold mt-4">
                    {gameState.playerCount || 1} Players Joined
                  </div>
              </div>

              <div className="w-full bg-gray-50 border-4 border-black p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
                  <h3 className="text-xl font-black uppercase mb-4 underline decoration-[#00fffd] decoration-4">How to Play</h3>
                  <ul className="space-y-3 font-bold text-sm">
                      <li className="flex gap-3 items-center">
                          <span className="w-8 h-8 flex items-center justify-center bg-black text-white rounded-full shrink-0">1</span>
                          <span>Watch the TV screen for the image.</span>
                      </li>
                      <li className="flex gap-3 items-center">
                          <span className="w-8 h-8 flex items-center justify-center bg-black text-white rounded-full shrink-0">2</span>
                          <span>Decide if it's <span className="text-[#00fffd] bg-black px-1">REAL</span> or <span className="text-[#fd00ff] bg-black px-1">AI</span>.</span>
                      </li>
                      <li className="flex gap-3 items-center">
                          <span className="w-8 h-8 flex items-center justify-center bg-black text-white rounded-full shrink-0">3</span>
                          <span>Lock in your answer before time runs out!</span>
                      </li>
                  </ul>
              </div>
           </div>
        )}

        {/* QUESTION */}
        {gameState.status === 'QUESTION' && (
            <div className="flex flex-col h-full">
                <div className="bg-gray-100 rounded-3xl border-4 border-black overflow-hidden relative shadow-[6px_6px_0px_rgba(0,0,0,1)] mb-6 aspect-square shrink-0">
                    <img src={gameState.currentImage} className="object-cover w-full h-full" />
                    <div className="absolute top-3 right-3 w-14 h-14 bg-white border-4 border-black rounded-full flex items-center justify-center font-black text-2xl shadow-sm">
                        {timer}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button 
                        onClick={() => !myVote && setSelectedOption('REAL')}
                        disabled={!!myVote}
                        className={`py-6 text-xl font-black uppercase tracking-widest border-4 border-black transition-all shadow-[4px_4px_0px_rgba(0,0,0,1)]
                        ${selectedOption === 'REAL' ? 'bg-[#00fffd] translate-y-1 shadow-none' : 'bg-white'}`}
                    >
                        REAL
                    </button>
                    <button 
                        onClick={() => !myVote && setSelectedOption('AI')}
                        disabled={!!myVote}
                        className={`py-6 text-xl font-black uppercase tracking-widest border-4 border-black transition-all shadow-[4px_4px_0px_rgba(0,0,0,1)]
                        ${selectedOption === 'AI' ? 'bg-[#fd00ff] text-white translate-y-1 shadow-none' : 'bg-white'}`}
                    >
                        AI
                    </button>
                </div>

                <button 
                    onClick={handleLockIn}
                    disabled={!selectedOption || !!myVote}
                    className={`w-full py-6 mt-auto text-3xl font-black uppercase tracking-[0.2em] border-4 border-black transition-all
                    ${myVote ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 
                      selectedOption ? 'bg-[#fffd00] shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none' : 'bg-gray-100 text-gray-400'}`}
                >
                    {myVote ? 'LOCKED' : 'LOCK IN'}
                </button>
            </div>
        )}

        {/* REVEAL */}
        {(gameState.status === 'REVEAL' || gameState.status === 'LEADERBOARD') && !feedback && (
            <div className="flex-1 flex flex-col justify-center items-center h-full">
                {/* Fixed Square Image */}
                <div className="w-full aspect-square max-w-[300px] bg-gray-100 rounded-xl border-4 border-black overflow-hidden mb-8 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
                   <img src={gameState.currentImage} className="object-cover w-full h-full grayscale" />
                </div>
                
                <div className="flex flex-col items-center justify-center gap-2 w-full text-center">
                    <span className="text-xl font-bold uppercase tracking-widest text-black">THIS IS</span>
                    <span className={`text-5xl font-black italic uppercase ${gameState.result?.correctAnswer === 'AI' ? 'text-[#fd00ff]' : 'text-[#00fffd]'} drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]`}>
                        {gameState.result?.correctAnswer}
                    </span>
                </div>
            </div>
        )}

        {/* GAME OVER */}
        {gameState.status === 'GAME_OVER' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
                <h1 className="text-6xl font-black text-black italic mb-8 uppercase">GAME OVER</h1>
                <div className="bg-[#fffd00] p-8 border-4 border-black w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <div className="text-black font-bold text-sm uppercase tracking-widest mb-2">Final Score</div>
                    <div className="text-7xl font-mono font-black text-black">{myScore}</div>
                </div>
            </div>
        )}
      </div>
    </MobileWrapper>
  );
}