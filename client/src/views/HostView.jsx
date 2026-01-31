import { useGameSocket } from '../hooks/useGameSocket';
import Loader from '../components/Loader';
import GameLayout from '../components/GameLayout';

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

  const totalVotes = (gameState.roundVotes?.HUMAN || 0) + (gameState.roundVotes?.AI || 0);
  const humanPercent = totalVotes === 0 ? 50 : ((gameState.roundVotes?.HUMAN || 0) / totalVotes) * 100;

  // Triadic color cycler for lobby pills
  const getPillColor = (index) => {
    const colors = ['bg-[#00fffd]', 'bg-[#fd00ff]', 'bg-[#fffd00]'];
    return colors[index % 3];
  };

  return (
    <div className="h-[100dvh] w-full bg-white text-slate-900 font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <div className="px-8 py-6 flex justify-between items-center z-10">
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">
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

      <div className="flex-1 flex flex-col p-8 items-center justify-center w-full max-w-[90%] mx-auto">
        
        {/* 1. LOBBY */}
        {gameState.status === 'LOBBY' && (
           <div className="w-full flex flex-col h-full">
              {/* Controls */}
              <div className="flex justify-between items-end mb-8 border-b-4 border-black pb-6">
                  <div>
                    <h2 className="text-6xl font-black mb-2">LOBBY</h2>
                    <p className="text-slate-500 font-medium text-xl">Waiting for players...</p>
                  </div>
                  <button onClick={actions.adminStart} className="px-12 py-6 bg-black text-white hover:bg-slate-800 font-bold rounded-xl text-2xl uppercase tracking-widest transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1">
                    Start Round
                  </button>
              </div>

              {/* Player Chips */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
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
              <div className="mt-4 text-right font-bold text-slate-400 uppercase tracking-widest">
                {playerList.length} Players Joined
              </div>
           </div>
        )}

        {/* 2. QUESTION */}
        {gameState.status === 'QUESTION' && (
          <div className="w-full h-full flex flex-col relative">
             <div className="flex-1 bg-gray-50 rounded-3xl border-4 border-black relative flex items-center justify-center mb-8 overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="max-h-full max-w-full object-contain" />
                
                {/* Timer Widget */}
                <div className="absolute top-8 right-8 w-24 h-24 bg-white border-4 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-4xl font-black">{timer}</span>
                </div>
             </div>
             
             {/* Vote Bar */}
             <div className="h-24 w-full bg-white rounded-xl flex overflow-hidden border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
                <div 
                    className="bg-[#00fffd] flex items-center justify-center text-black font-black text-2xl tracking-widest transition-all duration-300 border-r-4 border-black" 
                    style={{ width: `${humanPercent}%` }}
                >
                  HUMAN
                </div>
                <div className="bg-[#fd00ff] flex items-center justify-center text-black font-black text-2xl tracking-widest transition-all duration-300 flex-1">
                   AI
                </div>
             </div>
          </div>
        )}

        {/* 3. REVEAL (Just Image + Result) */}
        {gameState.status === 'REVEAL' && gameState.result && (
           <div className="w-full h-full flex flex-col items-center">
              
              <div className="mb-6 text-center">
                  <h1 className="text-5xl font-black uppercase">
                    THE ANSWER IS <span className={`px-4 py-1 ${gameState.result.correctAnswer === 'AI' ? 'bg-[#fd00ff]' : 'bg-[#00fffd]'} border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>{gameState.result.correctAnswer}</span>
                  </h1>
              </div>
              
              <div className="flex-1 w-full bg-gray-50 rounded-3xl border-4 border-black flex items-center justify-center p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                  <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="h-full w-auto object-contain" />
              </div>

              <div className="mt-8 flex gap-4">
                  <button onClick={actions.adminShowScores} className="px-10 py-4 bg-white border-4 border-black hover:bg-gray-100 text-black font-bold rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-xl transition-all">
                    View Leaderboard
                  </button>
                  <button onClick={actions.adminNext} className="px-10 py-4 bg-black text-white hover:bg-slate-800 border-4 border-black font-bold rounded-xl shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] uppercase tracking-widest text-xl transition-all">
                    Next Round
                  </button>
              </div>
           </div>
        )}

        {/* 4. LEADERBOARD (Scrollable & Tied Ranks) */}
        {(gameState.status === 'LEADERBOARD' || gameState.status === 'GAME_OVER') && gameState.result && (
           <div className="w-full h-full flex flex-col items-center">
              <h1 className="text-6xl font-black mb-8 italic uppercase">
                {gameState.status === 'GAME_OVER' ? 'FINAL STANDINGS' : 'LEADERBOARD'}
              </h1>

              <div className="w-full max-w-4xl flex-1 overflow-y-auto pr-4 custom-scrollbar bg-white rounded-3xl border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8">
                  {gameState.result.leaderboard.map((p, i, arr) => {
                      // Logic for ties: if score is same as prev, share rank
                      const isTied = i > 0 && p.score === arr[i-1].score;
                      // Display rank logic can be handled in various ways. 
                      // Simple way: Calculate rank based on index, but visually group ties?
                      // Or just show position 1 for all ties?
                      // Let's do: 1, 1, 3 (Standard competition ranking)
                      
                      // Calculate the true rank
                      let rank = i + 1;
                      if (isTied) {
                          // Look back to find the first index with this score
                          let tempIndex = i;
                          while (tempIndex > 0 && arr[tempIndex-1].score === p.score) {
                              tempIndex--;
                          }
                          rank = tempIndex + 1;
                      }

                      return (
                        <div key={i} className="flex items-center py-4 border-b-2 border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <div className="w-20 text-4xl font-black text-slate-300 italic">
                                #{rank}
                            </div>
                            <div className="flex-1 text-2xl font-bold">
                                {p.name}
                            </div>
                            <div className="text-3xl font-mono font-bold text-[#fd00ff]">
                                {p.score}
                            </div>
                        </div>
                      );
                  })}
              </div>

              <div className="mt-8">
                {gameState.status !== 'GAME_OVER' ? (
                     <button onClick={actions.adminNext} className="px-12 py-5 bg-[#fffd00] text-black border-4 border-black font-bold rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-2xl transition-all hover:-translate-y-1">
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