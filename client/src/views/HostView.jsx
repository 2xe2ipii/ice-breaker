import { useGameSocket } from '../hooks/useGameSocket';
import Loader from '../components/Loader';
import GameLayout from '../components/GameLayout';

export default function HostView() {
  const { gameState, stats, timer, result, actions } = useGameSocket();

  if (!gameState) return (
    <GameLayout className="items-center justify-center">
        <Loader text="Loading..." />
    </GameLayout>
  );

  const totalVotes = stats.HUMAN + stats.AI;
  const humanPercent = totalVotes === 0 ? 50 : (stats.HUMAN / totalVotes) * 100;

  const handleReset = () => {
    if (confirm('Are you sure you want to reset everything?')) actions.adminReset();
  };

  return (
    <GameLayout className="relative overflow-hidden">
      {/* HEADER */}
      <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center z-10">
        <h1 className="text-xl font-bold tracking-widest uppercase text-white">Real or AI?</h1>
        <div className="flex items-center gap-6">
             <div className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                Round {gameState.currentRoundIndex + 1}
             </div>
             <button onClick={handleReset} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest">
                Reset Game
             </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 items-center justify-center">
        
        {/* 1. LOBBY */}
        {gameState.status === 'LOBBY' && (
           <div className="text-center space-y-6">
              <h2 className="text-4xl font-bold text-white">Round {gameState.currentRoundIndex + 1}</h2>
              <button onClick={actions.adminStart} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg transition-all uppercase tracking-widest text-lg">
                Start Round
              </button>
           </div>
        )}

        {/* 2. QUESTION */}
        {gameState.status === 'QUESTION' && (
          <div className="w-full max-w-5xl h-full flex flex-col">
             <div className="flex-1 bg-slate-950 rounded border border-slate-800 relative flex items-center justify-center mb-6">
                <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="max-h-[65vh] object-contain" />
                <div className="absolute top-6 right-6 w-20 h-20 bg-slate-900 border-2 border-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-3xl font-bold text-white">{timer}</span>
                </div>
             </div>
             <div className="h-14 w-full bg-slate-800 rounded flex overflow-hidden font-bold text-xs tracking-widest border border-slate-700">
                <div className="bg-indigo-600 flex items-center justify-center text-white transition-all duration-300" style={{ width: `${humanPercent}%` }}>
                  HUMAN ({stats.HUMAN})
                </div>
                <div className="bg-slate-700 flex items-center justify-center text-slate-300 transition-all duration-300 flex-1">
                   AI ({stats.AI})
                </div>
             </div>
          </div>
        )}

        {/* 3. REVEAL (Show Image + Answer) */}
        {gameState.status === 'REVEAL' && result && (
           <div className="w-full max-w-6xl h-full flex flex-col items-center">
              <div className="text-center mb-4">
                  <h1 className="text-5xl font-bold text-white mb-2">The answer is {result.correctAnswer}</h1>
              </div>
              
              {/* SHOW IMAGE AGAIN FOR VERIFICATION */}
              <div className="flex-1 bg-slate-950 rounded border border-slate-800 relative flex items-center justify-center mb-6 w-full">
                  <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="max-h-[50vh] object-contain" />
                  
                  {/* Overlay Badge */}
                  <div className={`absolute bottom-8 px-8 py-4 rounded-full text-4xl font-bold shadow-xl ${result.correctAnswer === 'AI' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                      IT WAS {result.correctAnswer}
                  </div>
              </div>

              <button onClick={actions.adminShowScores} className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded uppercase tracking-widest text-sm transition-colors border border-slate-600">
                Show Leaderboard
              </button>
           </div>
        )}

        {/* 4. LEADERBOARD */}
        {gameState.status === 'LEADERBOARD' && result && (
           <div className="w-full max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-white mb-8 uppercase tracking-widest">Top Players</h2>
              
              <div className="bg-slate-800 border border-slate-700 rounded p-8 text-left mb-8 shadow-xl">
                {result.leaderboard.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-4 border-b border-slate-700 last:border-0">
                    <span className="text-white font-bold text-xl">
                        <span className="text-slate-500 w-10 inline-block">#{i+1}</span>
                        {p.name}
                    </span>
                    <span className="text-emerald-400 font-mono text-xl">{p.score} pts</span>
                  </div>
                ))}
              </div>

              <button onClick={actions.adminNext} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded uppercase tracking-widest text-sm transition-colors shadow-lg">
                Next Round
              </button>
           </div>
        )}
      </div>
    </GameLayout>
  );
}