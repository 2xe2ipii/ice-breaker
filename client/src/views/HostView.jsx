import { useGameSocket } from '../hooks/useGameSocket';
import Loader from '../components/Loader';

export default function HostView() {
  const { gameState, playerList, timer, actions } = useGameSocket(true);

  if (!gameState) return (
    <div className="h-screen w-full flex items-center justify-center bg-white">
        <Loader text="Connecting..." />
    </div>
  );

  const handleReset = () => {
    if (confirm('Reset Game? All players will be kicked.')) actions.adminReset();
  };

  const totalVotes = (gameState.roundVotes?.REAL || 0) + (gameState.roundVotes?.AI || 0);
  const realPercent = totalVotes === 0 ? 50 : ((gameState.roundVotes?.REAL || 0) / totalVotes) * 100;

  const getPillColor = (index) => {
    const colors = ['bg-[#00fffd]', 'bg-[#fd00ff]', 'bg-[#fffd00]'];
    return colors[index % 3];
  };

  // Safe image path: uses server path if available, falls back to local ID
  const currentImageSrc = gameState.currentImage || `/assets/q${gameState.currentRoundIndex + 1}.webp`;

  return (
    <div className="h-[100dvh] w-full bg-white text-slate-900 font-sans flex flex-col overflow-hidden">
      
      {/* HEADER: Added shrink-0 so it never gets squashed */}
      <div className="px-8 py-6 flex justify-between items-center z-10 shrink-0">
        <h1 className="text-3xl font-black tracking-tighter uppercase italic transform -skew-x-6">
            REAL OR AI?
        </h1>
        <div className="flex items-center gap-6">
             <div className="text-slate-400 font-medium uppercase tracking-widest text-sm">
                Round {gameState.currentRoundIndex + 1} / {gameState.totalRounds || '?'}
             </div>
             <button onClick={handleReset} className="text-xs font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600">
                Reset
             </button>
        </div>
      </div>

      {/* MAIN CONTENT: flex-1 with min-h-0 is CRITICAL for scrolling/containment */}
      <div className="flex-1 flex flex-col p-6 items-center justify-center w-full max-w-[95%] mx-auto min-h-0">
        
        {/* 1. LOBBY */}
        {gameState.status === 'LOBBY' && (
           <div className="w-full flex flex-col h-full min-h-0">
              <div className="flex justify-between items-end mb-8 border-b-4 border-black pb-6 shrink-0">
                  <div>
                    <h2 className="text-6xl font-black mb-2">LOBBY</h2>
                    <p className="text-slate-500 font-medium text-xl">Waiting for players...</p>
                  </div>
                  <button onClick={actions.adminStart} className="px-12 py-6 bg-black text-white hover:bg-slate-800 font-bold rounded-xl text-2xl uppercase tracking-widest transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 active:translate-y-0 active:shadow-none border-4 border-black">
                    Start Round
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                 <div className="flex flex-wrap gap-3 content-start">
                    {playerList.map((p, i) => (
                        <div key={i} className={`${getPillColor(i)} px-6 py-3 rounded-full border-2 border-black font-bold text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all`}>
                            {p.name}
                        </div>
                    ))}
                    {playerList.length === 0 && (
                        <span className="text-slate-400 italic text-xl">Use your phone to join...</span>
                    )}
                 </div>
              </div>
              <div className="mt-4 text-right font-bold text-slate-400 uppercase tracking-widest shrink-0">
                {playerList.length} Players Joined
              </div>
           </div>
        )}

        {/* 2. QUESTION */}
        {gameState.status === 'QUESTION' && (
          <div className="w-full h-full flex flex-col relative min-h-0">
             
             {/* IMAGE CONTAINER: flex-1 + min-h-0 + relative */}
             <div className="flex-1 bg-gray-50 rounded-3xl border-4 border-black relative mb-6 overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-0">
                
                {/* ABSOLUTE IMAGE: This forces the image to respect the parent's size */}
                <img src={currentImageSrc} className="absolute inset-0 w-full h-full object-contain p-4" />
                
                {/* Timer (Absolute) */}
                <div className="absolute top-6 right-6 w-20 h-20 bg-white border-4 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10">
                    <span className="text-3xl font-black">{timer}</span>
                </div>
             </div>
             
             {/* Vote Bar: shrink-0 ensures it never gets pushed off screen */}
             <div className="h-24 w-full bg-white rounded-xl flex overflow-hidden border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative shrink-0">
                <div 
                    className="bg-[#00fffd] flex items-center justify-center text-black font-black text-2xl tracking-widest transition-all duration-300 border-r-4 border-black whitespace-nowrap overflow-hidden" 
                    style={{ width: `${realPercent}%` }}
                >
                  REAL ({gameState.roundVotes?.REAL || 0})
                </div>
                <div className="bg-[#fd00ff] flex items-center justify-center text-white font-black text-2xl tracking-widest transition-all duration-300 flex-1 whitespace-nowrap overflow-hidden">
                   AI ({gameState.roundVotes?.AI || 0})
                </div>
             </div>
          </div>
        )}

        {/* 3. REVEAL */}
        {gameState.status === 'REVEAL' && gameState.result && (
           <div className="w-full h-full flex flex-col items-center min-h-0">
              
              <div className="mb-4 text-center shrink-0">
                  <h1 className="text-5xl font-black uppercase">
                    THE ANSWER IS <span className={`px-6 py-2 ml-4 ${gameState.result.correctAnswer === 'AI' ? 'bg-[#fd00ff] text-white' : 'bg-[#00fffd] text-black'} border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl`}>{gameState.result.correctAnswer}</span>
                  </h1>
              </div>
              
              <div className="flex-1 w-full bg-gray-50 rounded-3xl border-4 border-black relative overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-0">
                  <img src={currentImageSrc} className="absolute inset-0 w-full h-full object-contain p-4" />
              </div>

              <div className="mt-8 flex gap-4 shrink-0">
                  <button onClick={actions.adminShowScores} className="px-10 py-4 bg-white border-4 border-black hover:bg-gray-100 text-black font-bold rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-xl transition-all hover:-translate-y-1">
                    View Leaderboard
                  </button>
                  <button onClick={actions.adminNext} className="px-10 py-4 bg-black text-white hover:bg-slate-800 border-4 border-black font-bold rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-xl transition-all hover:-translate-y-1">
                    Next Round
                  </button>
              </div>
           </div>
        )}

        {/* 4. LEADERBOARD */}
        {(gameState.status === 'LEADERBOARD' || gameState.status === 'GAME_OVER') && gameState.result && (
           <div className="w-full h-full flex flex-col items-center min-h-0">
              <h1 className="text-6xl font-black mb-6 italic uppercase transform -skew-x-6 shrink-0">
                {gameState.status === 'GAME_OVER' ? 'FINAL STANDINGS' : 'LEADERBOARD'}
              </h1>

              {/* Scrollable container with min-h-0 */}
              <div className="w-full max-w-4xl flex-1 overflow-y-auto pr-4 custom-scrollbar bg-white rounded-3xl border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8 min-h-0">
                  {gameState.result.leaderboard.map((p, i, arr) => {
                      const isTied = i > 0 && p.score === arr[i-1].score;
                      let rank = i + 1;
                      if (isTied) {
                          let tempIndex = i;
                          while (tempIndex > 0 && arr[tempIndex-1].score === p.score) {
                              tempIndex--;
                          }
                          rank = tempIndex + 1;
                      }

                      return (
                        <div key={i} className="flex items-center py-4 border-b-2 border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <div className="w-24 text-5xl font-black text-slate-200 italic">
                                #{rank}
                            </div>
                            <div className="flex-1 text-2xl font-bold uppercase">
                                {p.name}
                            </div>
                            <div className="text-3xl font-mono font-black text-[#fd00ff]">
                                {p.score}
                            </div>
                        </div>
                      );
                  })}
              </div>

              <div className="mt-6 shrink-0">
                {gameState.status !== 'GAME_OVER' ? (
                     <button onClick={actions.adminNext} className="px-12 py-5 bg-[#fffd00] text-black border-4 border-black font-bold rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-2xl transition-all hover:-translate-y-1 active:translate-y-0 active:shadow-none">
                        Next Round
                     </button>
                ) : (
                     <button onClick={handleReset} className="px-12 py-5 bg-rose-500 text-white border-4 border-black font-bold rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-2xl transition-all">
                        Reset Game
                     </button>
                )}
              </div>
           </div>
        )}
      </div>
    </div>
  );
}