import { useState } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import Loader from '../components/Loader';

export default function HostView() {
  const { gameState, playerList, timer, authError, isConnected, actions } = useGameSocket(true);
  const [password, setPassword] = useState('');

  if (!isConnected) return (
    <div className="h-screen w-full flex items-center justify-center bg-white">
        <Loader text="Connecting..." />
    </div>
  );

  // --- LOGIN SCREEN ---
  if (!gameState) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white flex-col p-8 selection:bg-[#fffd00]">
        <h1 className="text-6xl font-black italic uppercase mb-12 transform -skew-x-6 tracking-tighter">
            HOST
        </h1>
        <div className="w-full max-w-md space-y-6">
            <input 
                type="password"
                className="w-full border-4 border-black p-6 text-3xl font-black text-center focus:outline-none focus:shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-all placeholder:text-gray-200"
                placeholder="PASSWORD"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && actions.loginHost(password)}
            />
            <button 
                onClick={() => actions.loginHost(password)}
                className="w-full py-6 bg-black text-[#fffd00] text-3xl font-black uppercase tracking-widest border-4 border-black hover:bg-slate-800 active:translate-y-1 transition-all shadow-[8px_8px_0px_rgba(0,0,0,0.2)]"
            >
                LOGIN
            </button>
            {authError && (
                <div className="bg-rose-500 text-white p-4 text-center font-bold border-4 border-black uppercase tracking-widest animate-pulse">
                    {authError}
                </div>
            )}
        </div>
      </div>
    );
  }

  const handleReset = () => {
    if (confirm('Reset Game? All players will be kicked.')) actions.adminReset();
  };

  const totalVotes = (gameState.roundVotes?.REAL || 0) + (gameState.roundVotes?.AI || 0);
  const realHeight = totalVotes === 0 ? 50 : ((gameState.roundVotes?.REAL || 0) / totalVotes) * 100;
  const aiHeight = totalVotes === 0 ? 50 : ((gameState.roundVotes?.AI || 0) / totalVotes) * 100;

  const currentImageSrc = gameState.currentImage || `/assets/q${gameState.currentRoundIndex + 1}.webp`;

  return (
    <div className="h-[100dvh] w-full bg-white text-black font-sans flex flex-col overflow-hidden selection:bg-[#fffd00]">
      
      {/* Added pr-12 to fix text clipping on the right */}
      <div className="h-24 border-b-4 border-black flex justify-between items-center px-10 pr-12 bg-white shrink-0">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic transform -skew-x-6">
            REAL OR AI?
        </h1>
        <div className="flex items-center gap-8">
             <div className="text-gray-400 font-bold uppercase tracking-widest text-lg">
                Round {gameState.currentRoundIndex + 1} / {gameState.totalRounds || '?'}
             </div>
             <button onClick={handleReset} className="text-sm font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700 border-2 border-rose-500 px-4 py-2 rounded hover:bg-rose-50 transition-all">
                Reset
             </button>
        </div>
      </div>

      <div className="flex-1 flex w-full h-full relative overflow-hidden">
        
        {gameState.status === 'LOBBY' && (
           <div className="w-full h-full flex">
              {/* LEFT: QR CODE AREA */}
              <div className="w-7/12 border-r-4 border-black flex flex-col items-center justify-center p-12 bg-[#00fffd]/10">
                  <div className="flex flex-col items-center gap-8">
                      <div className="bg-white border-4 border-black p-4 shadow-[12px_12px_0px_rgba(0,0,0,1)] w-[400px] h-[400px] flex items-center justify-center bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=http://localhost:5173')] bg-contain bg-no-repeat bg-center">
                          {/* Placeholder image handled by CSS bg-image. In prod, replace localhost with window.location.host */}
                      </div>
                      <div className="bg-black text-[#fffd00] px-8 py-4 transform -skew-x-6 shadow-[8px_8px_0px_rgba(0,0,0,0.2)]">
                          <p className="text-xl font-bold uppercase tracking-widest mb-1 text-center">Join at:</p>
                          <p className="text-5xl font-black tracking-tighter">
                            {window.location.host}
                          </p>
                      </div>
                  </div>
              </div>

              {/* RIGHT: PLAYER LIST */}
              <div className="w-5/12 flex flex-col bg-white">
                  <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                      <div className="flex justify-between items-baseline mb-6 border-b-4 border-black pb-4 sticky top-0 bg-white z-10">
                        <h3 className="text-3xl font-black uppercase italic tracking-tighter">
                            Players
                        </h3>
                        <span className="text-xl font-bold text-gray-400">{playerList.length} JOINED</span>
                      </div>
                      
                      <div className="flex flex-col gap-3">
                        {playerList.map((p, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 transition-colors border-2 border-transparent hover:border-black rounded-lg">
                                <div className={`w-4 h-4 rounded-full border-2 border-black ${p.connected ? 'bg-[#00fffd] shadow-[2px_2px_0px_rgba(0,0,0,1)]' : 'bg-gray-300'}`} />
                                <span className="font-bold text-2xl uppercase truncate tracking-tight">{p.name}</span>
                            </div>
                        ))}
                        {playerList.length === 0 && (
                            <div className="text-gray-400 text-xl font-medium italic text-center mt-10">Waiting for players...</div>
                        )}
                      </div>
                  </div>
                  <div className="p-8 border-t-4 border-black bg-gray-50">
                      <button onClick={actions.adminStart} className="w-full py-6 bg-black text-white hover:bg-slate-800 font-black text-3xl uppercase tracking-widest shadow-[8px_8px_0px_rgba(0,0,0,0.2)] hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all">
                        Start Game
                      </button>
                  </div>
              </div>
           </div>
        )}

        {gameState.status === 'QUESTION' && (
          <div className="w-full h-full grid grid-cols-[120px_1fr_120px]">
             
             <div className="h-full border-r-4 border-black flex flex-col">
                <div 
                    className="bg-[#fd00ff] w-full border-b-4 border-black transition-all duration-500 relative flex items-center justify-center" 
                    style={{ height: `${aiHeight}%` }}
                >
                    <span className="absolute -rotate-90 text-white font-black text-2xl tracking-widest whitespace-nowrap">
                        AI ({gameState.roundVotes?.AI || 0})
                    </span>
                </div>
                <div 
                    className="bg-[#00fffd] w-full flex-1 transition-all duration-500 relative flex items-center justify-center"
                >
                    <span className="absolute -rotate-90 text-black font-black text-2xl tracking-widest whitespace-nowrap">
                        REAL ({gameState.roundVotes?.REAL || 0})
                    </span>
                </div>
             </div>

             <div className="h-full bg-gray-50 relative flex items-center justify-center p-12 overflow-hidden">
                <div className="w-full h-full relative flex items-center justify-center bg-white border-4 border-black rounded-[3rem] shadow-[12px_12px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <img src={currentImageSrc} className="absolute inset-0 w-full h-full object-contain p-4" />
                </div>
             </div>

             <div className="h-full border-l-4 border-black flex flex-col items-center justify-center bg-white">
                 <div className="w-20 h-20 rounded-full border-4 border-black flex items-center justify-center font-black text-4xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                    {timer}
                 </div>
             </div>
          </div>
        )}

        {gameState.status === 'REVEAL' && gameState.result && (
           <div className="w-full h-full flex flex-col items-center justify-center bg-white p-8">
              
              <div className="flex items-center gap-6 mb-8 animate-in slide-in-from-top-10 duration-500">
                  <h2 className="text-5xl font-black uppercase italic">The Answer Is</h2>
                  <div className={`px-10 py-4 text-6xl font-black uppercase border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] transform -skew-x-6 ${gameState.result.correctAnswer === 'AI' ? 'bg-[#fd00ff] text-white' : 'bg-[#00fffd] text-black'}`}>
                    {gameState.result.correctAnswer}
                  </div>
              </div>

              <div className="flex-1 w-full max-w-5xl border-4 border-black rounded-[2rem] bg-gray-100 overflow-hidden relative shadow-[12px_12px_0px_rgba(0,0,0,1)] mb-8">
                  <img src={currentImageSrc} className="absolute inset-0 w-full h-full object-contain p-6" />
              </div>

              <div className="flex gap-6 h-20">
                  <button onClick={actions.adminShowScores} className="px-10 h-full bg-white border-4 border-black hover:bg-gray-50 text-black font-bold text-xl uppercase tracking-widest shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
                    View Leaderboard
                  </button>
                  <button onClick={actions.adminNext} className="px-10 h-full bg-black text-[#fffd00] border-4 border-black font-black text-xl uppercase tracking-widest shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
                    Next Round
                  </button>
              </div>
           </div>
        )}

        {(gameState.status === 'LEADERBOARD' || gameState.status === 'GAME_OVER') && gameState.result && (
           <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-[#fffd00]">
              <div className="bg-white border-4 border-black p-12 shadow-[16px_16px_0px_rgba(0,0,0,1)] w-full max-w-4xl max-h-full flex flex-col">
                  <h1 className="text-6xl font-black mb-8 italic uppercase text-center border-b-4 border-black pb-6">
                    {gameState.status === 'GAME_OVER' ? 'FINAL STANDINGS' : 'LEADERBOARD'}
                  </h1>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                      {gameState.result.leaderboard.map((p, i) => (
                        <div key={i} className="flex items-center py-4 border-b-2 border-gray-100 last:border-0">
                            <span className="w-16 text-4xl font-black italic text-gray-300">#{i+1}</span>
                            <span className="flex-1 text-3xl font-bold uppercase truncate px-4">{p.name}</span>
                            <span className="text-4xl font-mono font-black text-[#fd00ff]">{p.score}</span>
                        </div>
                      ))}
                  </div>

                  <div className="mt-8 pt-6 border-t-4 border-black flex justify-center">
                    {gameState.status !== 'GAME_OVER' ? (
                         <button onClick={actions.adminNext} className="px-12 py-4 bg-black text-white font-black text-2xl uppercase tracking-widest hover:-translate-y-1 shadow-[6px_6px_0px_rgba(0,0,0,0.2)] transition-all">
                            Next Round
                         </button>
                    ) : (
                         <button onClick={handleReset} className="px-12 py-4 bg-rose-500 text-white font-black text-2xl uppercase tracking-widest hover:-translate-y-1 shadow-[6px_6px_0px_rgba(0,0,0,1)] border-4 border-black transition-all">
                            Reset Game
                         </button>
                    )}
                  </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}