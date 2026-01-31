import { useGameSocket } from '../hooks/useGameSocket';
import Loader from '../components/Loader';
import GameLayout from '../components/GameLayout';

export default function HostView() {
  // Pass true to identify as Host
  const { gameState, playerList, actions } = useGameSocket(true);

  if (!gameState) return (
    <GameLayout className="items-center justify-center">
        <Loader text="Connecting to Server..." />
    </GameLayout>
  );

  const handleReset = () => {
    if (confirm('Are you sure you want to reset everything? This will kick all players.')) actions.adminReset();
  };

  // Helper to calculate percentages
  const totalVotes = (gameState.roundVotes?.HUMAN || 0) + (gameState.roundVotes?.AI || 0);
  const humanPercent = totalVotes === 0 ? 50 : ((gameState.roundVotes?.HUMAN || 0) / totalVotes) * 100;

  return (
    <GameLayout className="relative overflow-hidden">
      {/* HEADER */}
      <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center z-10 shadow-md">
        <h1 className="text-xl font-bold tracking-widest uppercase text-white">
            Real or AI? <span className="text-slate-600 text-sm ml-2">HOST PANEL</span>
        </h1>
        <div className="flex items-center gap-6">
             <div className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                Round {gameState.currentRoundIndex + 1} / {gameState.totalRounds || '?'}
             </div>
             <button onClick={handleReset} className="bg-rose-900/50 hover:bg-rose-700 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors border border-rose-800">
                Reset Game
             </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 items-center justify-center w-full max-w-7xl mx-auto">
        
        {/* 1. LOBBY */}
        {gameState.status === 'LOBBY' && (
           <div className="w-full flex flex-col items-center h-full">
              <div className="text-center mb-8 space-y-4">
                  <h2 className="text-5xl font-bold text-white tracking-tight">
                    Join the Game
                  </h2>
                  <p className="text-slate-400 text-xl">
                    Scan the QR code or go to the URL to join.
                  </p>
                  <button onClick={actions.adminStart} className="px-12 py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xl transition-all uppercase tracking-widest text-2xl animate-pulse">
                    Start Round {gameState.currentRoundIndex + 1}
                  </button>
              </div>

              {/* LIVE PLAYER LIST */}
              <div className="w-full flex-1 bg-slate-900/50 rounded-xl border border-slate-800 p-6 overflow-hidden flex flex-col">
                 <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest">Lobby ({playerList.length} Players)</h3>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 overflow-y-auto pr-2 custom-scrollbar">
                    {playerList.map((p, i) => (
                        <div key={i} className="bg-slate-800 p-3 rounded flex items-center gap-2 border border-slate-700">
                            <div className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                            <span className="truncate font-mono text-sm">{p.name}</span>
                        </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {/* 2. QUESTION PHASE */}
        {gameState.status === 'QUESTION' && (
          <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
             <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 relative flex items-center justify-center mb-6 overflow-hidden">
                {/* Image is pre-fetched so it should snap in instantly */}
                <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="max-h-[70vh] w-auto object-contain shadow-2xl" />
                
                {/* Timer Widget */}
                <div className="absolute top-6 right-6 w-24 h-24 bg-slate-900/90 backdrop-blur border-4 border-indigo-500 rounded-full flex items-center justify-center shadow-2xl z-20">
                    <span className={`text-4xl font-bold ${gameState.timeLeft <= 5 ? 'text-rose-500' : 'text-white'}`}>
                        {gameState.timeLeft}
                    </span>
                </div>
             </div>
             
             {/* Live Vote Bar */}
             <div className="h-20 w-full bg-slate-800 rounded-lg flex overflow-hidden font-bold text-lg tracking-widest border-2 border-slate-700 relative shadow-lg">
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none mix-blend-difference text-white opacity-50">
                    {totalVotes} VOTES
                </div>
                <div className="bg-indigo-600 flex items-center justify-center text-white transition-all duration-300 relative" style={{ width: `${humanPercent}%` }}>
                  <span className="z-20 drop-shadow-md">HUMAN ({gameState.roundVotes?.HUMAN || 0})</span>
                </div>
                <div className="bg-slate-700 flex items-center justify-center text-slate-300 transition-all duration-300 flex-1 relative">
                   <span className="z-20 drop-shadow-md">AI ({gameState.roundVotes?.AI || 0})</span>
                </div>
             </div>
          </div>
        )}

        {/* 3. REVEAL & 4. GAME OVER */}
        {(gameState.status === 'REVEAL' || gameState.status === 'LEADERBOARD' || gameState.status === 'GAME_OVER') && gameState.result && (
           <div className="w-full h-full flex flex-col items-center animate-in zoom-in-95 duration-300">
              
              {/* Header: Answer or Game Over */}
              <div className="text-center mb-6">
                  {gameState.status === 'GAME_OVER' ? (
                      <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">FINAL STANDINGS</h1>
                  ) : (
                      <h1 className="text-6xl font-black text-white mb-2">
                        IT WAS <span className={gameState.result.correctAnswer === 'AI' ? 'text-indigo-500' : 'text-emerald-500'}>{gameState.result.correctAnswer}</span>
                      </h1>
                  )}
              </div>
              
              {/* If just Reveal, show image + small leaderboard. If Game Over, show big leaderboard */}
              {gameState.status === 'REVEAL' && (
                  <div className="flex-1 w-full flex gap-8 min-h-0">
                      <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-4">
                          <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="max-h-full object-contain" />
                      </div>
                      <div className="w-1/3 bg-slate-800/80 rounded-xl border border-slate-700 p-6 overflow-hidden flex flex-col">
                          <h3 className="text-slate-400 font-bold uppercase tracking-widest mb-4 border-b border-slate-600 pb-2">Top 5 Players</h3>
                          <div className="space-y-3">
                            {gameState.result.leaderboard.map((p, i) => (
                                <div key={i} className="flex justify-between items-center text-lg">
                                    <span className="font-bold">#{i+1} {p.name}</span>
                                    <span className="text-emerald-400 font-mono">{p.score}</span>
                                </div>
                            ))}
                          </div>
                      </div>
                  </div>
              )}

              {/* Leaderboard / Game Over View */}
              {(gameState.status === 'LEADERBOARD' || gameState.status === 'GAME_OVER') && (
                  <div className="w-full max-w-4xl bg-slate-800 rounded-xl border border-slate-700 p-8 shadow-2xl">
                      {gameState.result.leaderboard.map((p, i) => (
                        <div key={i} className={`flex justify-between items-center py-4 border-b border-slate-700 last:border-0 ${i === 0 ? 'text-2xl text-yellow-400 font-bold' : 'text-xl text-white'}`}>
                            <div className="flex items-center gap-4">
                                <span className="opacity-50 w-8">#{i+1}</span>
                                <span>{p.name}</span>
                                {i === 0 && <span>👑</span>}
                            </div>
                            <span className="font-mono">{p.score} pts</span>
                        </div>
                      ))}
                  </div>
              )}

              {/* Control Buttons */}
              <div className="mt-8 flex gap-4">
                  {gameState.status === 'REVEAL' && (
                      <button onClick={actions.adminShowScores} className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded uppercase tracking-widest border border-slate-500 transition-colors">
                        Show Full Leaderboard
                      </button>
                  )}
                  
                  {gameState.status !== 'GAME_OVER' && (
                     <button onClick={actions.adminNext} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg uppercase tracking-widest transition-colors">
                        {gameState.status === 'REVEAL' ? 'Next Round' : 'Next Question'}
                     </button>
                  )}

                  {gameState.status === 'GAME_OVER' && (
                     <button onClick={handleReset} className="px-10 py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded shadow-lg uppercase tracking-widest transition-colors">
                        End Game & Reset
                     </button>
                  )}
              </div>
           </div>
        )}
      </div>
    </GameLayout>
  );
}