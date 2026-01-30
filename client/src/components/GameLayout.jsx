export default function GameLayout({ children, className = "" }) {
  return (
    <div className={`min-h-[100dvh] w-full bg-slate-900 text-white font-sans flex flex-col ${className}`}>
      {children}
    </div>
  );
}