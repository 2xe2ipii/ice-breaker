import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { socket } from './socket';

// --- UTILS ---
const getSessionId = () => {
  let id = localStorage.getItem('game_session_id');
  if (!id) {
    id = Math.random().toString(36).substr(2, 9);
    localStorage.setItem('game_session_id', id);
  }
  return id;
};

// --- COMPONENTS ---

// 1. PLAYER VIEW (The "Controller")
function PlayerView() {
  const [name, setName] = useState(localStorage.getItem('player_name') || '');
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [feedback, setFeedback] = useState(null); 

  useEffect(() => {
    // Re-join automatically if we have a session
    if (localStorage.getItem('joined_before')) {
      setJoined(true);
      socket.emit('join_game', { name, sessionId: getSessionId() });
    }

    socket.on('state_update', setGameState);
    socket.on('new_round', () => { setMyVote(null); setFeedback(null); });
    socket.on('vote_registered', (v) => setMyVote(v));
    socket.on('round_result', ({ correctAnswer }) => {
      setFeedback(myVote === correctAnswer ? 'CORRECT!' : 'OOPS!');
    });

    return () => socket.off();
  }, []);

  const join = () => {
    if(!name) return;
    localStorage.setItem('player_name', name);
    localStorage.setItem('joined_before', 'true');
    socket.emit('join_game', { name, sessionId: getSessionId() });
    setJoined(true);
  };

  const vote = (choice) => {
    socket.emit('submit_vote', { vote: choice, sessionId: getSessionId() });
    setMyVote(choice); 
  };

  // --- THEME: CANDY POP ---
  if (!joined) {
    return (
      <div className="min-h-[100dvh] bg-pink-50 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_0_rgba(0,0,0,0.1)] w-full max-w-sm text-center border-4 border-pink-200">
          <h1 className="text-4xl font-black text-pink-500 mb-2">Hello!</h1>
          <p className="text-gray-400 font-bold mb-6">Join the game</p>
          <input 
            className="bg-gray-100 p-4 text-xl w-full text-center rounded-xl text-gray-700 outline-none focus:ring-4 ring-pink-300 transition-all font-bold"
            placeholder="Your Name"
            value={name} onChange={e => setName(e.target.value)}
          />
        </div>
        <button onClick={join} className="w-full max-w-sm bg-blue-400 hover:bg-blue-500 text-white p-5 text-2xl font-black rounded-2xl shadow-[0_6px_0_rgb(59,130,246)] active:shadow-none active:translate-y-[6px] transition-all">
          LET'S GO!
        </button>
      </div>
    );
  }

  if (gameState?.status === 'LOBBY') {
    return (
      <div className="min-h-[100dvh] bg-blue-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-bounce text-6xl mb-4">🍩</div>
        <h2 className="text-3xl font-black text-blue-400">Waiting for Host...</h2>
        <p className="text-blue-300 font-bold mt-2">Get ready!</p>
      </div>
    );
  }

  if (gameState?.status === 'QUESTION') {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col p-4">
        {/* Image Container */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm border-4 border-slate-100 overflow-hidden flex items-center justify-center mb-4 relative">
             <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="object-contain max-h-full w-full" />
        </div>
        
        {/* Buttons */}
        <div className="grid grid-cols-2 gap-4 h-48 pb-6">
          <button 
            disabled={!!myVote}
            onClick={() => vote('HUMAN')} 
            className={`
              text-2xl font-black rounded-3xl transition-all
              ${myVote === 'HUMAN' 
                ? 'bg-blue-400 text-white ring-4 ring-blue-200 translate-y-[6px] shadow-none' 
                : 'bg-white text-blue-400 shadow-[0_6px_0_#e2e8f0] border-2 border-slate-100'}
              ${myVote && myVote !== 'HUMAN' ? 'opacity-30 grayscale' : ''}
            `}
          >
            HUMAN
          </button>
          <button 
            disabled={!!myVote}
            onClick={() => vote('AI')} 
            className={`
              text-2xl font-black rounded-3xl transition-all
              ${myVote === 'AI' 
                ? 'bg-pink-400 text-white ring-4 ring-pink-200 translate-y-[6px] shadow-none' 
                : 'bg-white text-pink-400 shadow-[0_6px_0_#e2e8f0] border-2 border-slate-100'}
              ${myVote && myVote !== 'AI' ? 'opacity-30 grayscale' : ''}
            `}
          >
            AI
          </button>
        </div>
      </div>
    );
  }

  if (gameState?.status === 'RESULTS') {
    return (
      <div className={`min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center ${feedback === 'CORRECT!' ? 'bg-green-100' : 'bg-red-100'}`}>
        <h1 className={`text-5xl font-black mb-2 ${feedback === 'CORRECT!' ? 'text-green-500' : 'text-red-500'}`}>{feedback}</h1>
        <div className="text-8xl mt-4">{feedback === 'CORRECT!' ? '🎉' : '🫠'}</div>
      </div>
    );
  }

  return <div className="p-10 text-center font-bold text-gray-400">Loading...</div>;
}

// 2. HOST VIEW (TV Display)
function HostView() {
  const [gameState, setGameState] = useState(null);
  const [stats, setStats] = useState({ HUMAN: 0, AI: 0 });
  const [timer, setTimer] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    socket.emit('admin_reset'); 
    socket.on('state_update', setGameState);
    socket.on('stats_update', setStats);
    socket.on('timer_update', setTimer);
    socket.on('round_result', setResult);
    return () => socket.off();
  }, []);

  const startRound = () => socket.emit('admin_start_round');
  const nextRound = () => {
    setResult(null);
    socket.emit('admin_next_round');
  };

  if (!gameState) return <div className="h-screen bg-pink-50 flex items-center justify-center text-3xl font-bold text-pink-300">Connecting...</div>;

  return (
    <div className="h-screen bg-pink-50 text-gray-800 font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <div className="bg-white p-6 shadow-sm flex justify-between items-center z-10">
        <h1 className="text-3xl font-black tracking-tight text-pink-500 uppercase">The Discriminator</h1>
        <div className="text-xl font-bold bg-gray-100 px-4 py-2 rounded-full text-gray-500">
           ROUND {gameState.currentRoundIndex + 1}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative p-8">
        
        {/* LOBBY STATE */}
        {gameState.status === 'LOBBY' && (
           <div className="flex-1 flex flex-col items-center justify-center space-y-8">
              <div className="text-9xl animate-bounce">🤔</div>
              <h2 className="text-6xl font-black text-gray-700">Ready for Round {gameState.currentRoundIndex + 1}?</h2>
              <button onClick={startRound} className="px-12 py-6 bg-pink-500 text-white text-4xl font-black rounded-3xl shadow-[0_8px_0_#be185d] active:translate-y-[8px] active:shadow-none transition-all">
                START ROUND
              </button>
           </div>
        )}

        {/* QUESTION STATE */}
        {gameState.status === 'QUESTION' && (
          <div className="flex-1 flex flex-col h-full">
             
             {/* IMAGE CARD */}
             <div className="flex-1 bg-white rounded-[3rem] shadow-xl border-8 border-white overflow-hidden relative flex items-center justify-center mb-8">
                <img src={`/assets/q${gameState.currentRoundIndex + 1}.webp`} className="max-h-full max-w-full object-contain" />
                
                {/* FLOATING TIMER BADGE */}
                <div className="absolute top-8 right-8 bg-gray-900 text-white w-24 h-24 rounded-full flex items-center justify-center text-5xl font-black shadow-lg border-4 border-white">
                    {timer}
                </div>
             </div>

             {/* STATS BAR (Separate from Image) */}
             <div className="h-24 w-full flex rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                <div 
                   className="bg-blue-400 flex items-center justify-center transition-all duration-500 ease-out text-white text-3xl font-black" 
                   style={{ width: `${(stats.HUMAN + stats.AI) === 0 ? 50 : (stats.HUMAN / (stats.HUMAN + stats.AI)) * 100}%` }}
                >
                  HUMAN {stats.HUMAN}
                </div>
                <div 
                   className="bg-pink-400 flex items-center justify-center transition-all duration-500 ease-out text-white text-3xl font-black flex-1"
                >
                   AI {stats.AI}
                </div>
             </div>
          </div>
        )}

        {/* RESULTS STATE */}
        {gameState.status === 'RESULTS' && result && (
           <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="bg-white p-12 rounded-[3rem] shadow-2xl max-w-4xl w-full">
                  <h2 className="text-2xl font-bold text-gray-400 mb-2">THE ANSWER IS</h2>
                  <h1 className={`text-7xl font-black mb-8 ${result.correctAnswer === 'HUMAN' ? 'text-blue-500' : 'text-pink-500'}`}>
                    {result.correctAnswer}
                  </h1>
                  
                  {/* LEADERBOARD */}
                  <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left">
                    <h3 className="text-xl font-bold text-gray-400 mb-4 uppercase tracking-wider">Top Scorers</h3>
                    {result.leaderboard.map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-0 font-bold text-xl text-gray-700">
                        <div className="flex items-center">
                            <span className="w-8 h-8 rounded-full bg-yellow-300 flex items-center justify-center mr-3 text-sm text-yellow-800">#{i+1}</span>
                            {p.name}
                        </div>
                        <span className="text-pink-500">{p.score}</span>
                      </div>
                    ))}
                  </div>

                  <button onClick={nextRound} className="w-full bg-gray-800 text-white py-6 rounded-2xl text-2xl font-bold shadow-[0_6px_0_#000] active:translate-y-[6px] active:shadow-none">
                    NEXT ROUND
                  </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayerView />} />
        <Route path="/host" element={<HostView />} />
      </Routes>
    </BrowserRouter>
  );
}