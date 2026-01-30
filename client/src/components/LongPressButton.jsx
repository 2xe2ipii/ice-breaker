import { useState, useRef, useEffect } from 'react';

export default function LongPressButton({ onClick, label, colorClass, disabled, selected }) {
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (pressing && !disabled && !selected) {
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(intervalRef.current);
            onClick();
            return 100;
          }
          // +1% every 15ms = 1.5 seconds total duration
          return prev + 1; 
        });
      }, 15);
    } else {
      setProgress(0);
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [pressing, disabled, selected]);

  if (selected) {
    return (
      <div className={`w-full h-24 rounded flex items-center justify-center text-xl font-bold text-white ring-4 ring-white ${colorClass}`}>
        LOCKED IN
      </div>
    );
  }

  return (
    <button
      className={`relative w-full h-24 rounded overflow-hidden border border-slate-600 bg-slate-800 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
      onMouseDown={() => setPressing(true)}
      onMouseUp={() => setPressing(false)}
      onMouseLeave={() => setPressing(false)}
      onTouchStart={() => setPressing(true)}
      onTouchEnd={() => setPressing(false)}
      disabled={disabled}
    >
      <div 
        className={`absolute left-0 top-0 bottom-0 ${colorClass} opacity-80 transition-all duration-75 ease-linear`} 
        style={{ width: `${progress}%` }}
      />
      <div className="relative z-10 text-white font-bold text-xl tracking-widest uppercase pointer-events-none">
        {progress > 15 ? 'HOLD TO CONFIRM...' : label}
      </div>
    </button>
  );
}