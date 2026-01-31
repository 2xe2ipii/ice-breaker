import { useState, useRef, useEffect } from 'react';

export default function LongPressButton({ onClick, label, colorClass, disabled, selected }) {
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    // If already selected, do nothing
    if (selected) return;

    if (pressing && !disabled) {
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(intervalRef.current);
            onClick();
            return 100;
          }
          // Speed: 1.5 seconds to fill
          return prev + 1.5; 
        });
      }, 15);
    } else {
      setProgress(0);
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [pressing, disabled, selected, onClick]);

  // If selected, we show the "Pressed Down" state permanently
  // No shadow, moved down by 4px
  if (selected) {
    return (
      <div className={`w-full h-24 rounded-xl flex items-center justify-center text-3xl font-black text-white border-4 border-black translate-y-[4px] ${colorClass} opacity-100`}>
        {label} <span className="ml-2 text-2xl">✓</span>
      </div>
    );
  }

  return (
    <button
      className={`relative w-full h-24 rounded-xl overflow-hidden border-4 border-black bg-white transition-all 
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:translate-y-[4px] active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
      onMouseDown={() => setPressing(true)}
      onMouseUp={() => setPressing(false)}
      onMouseLeave={() => setPressing(false)}
      onTouchStart={() => setPressing(true)}
      onTouchEnd={() => setPressing(false)}
      disabled={disabled}
    >
      {/* Background Fill Animation */}
      <div 
        className={`absolute left-0 top-0 bottom-0 ${colorClass} transition-all duration-75 ease-linear`} 
        style={{ width: `${progress}%` }}
      />
      
      {/* Label (Always visible) */}
      <div className={`relative z-10 font-black text-3xl tracking-widest uppercase pointer-events-none mix-blend-multiply ${progress > 50 ? 'text-white mix-blend-normal' : 'text-black'}`}>
        {label}
      </div>
    </button>
  );
}