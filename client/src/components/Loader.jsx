export default function Loader({ text }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
      <p className="text-slate-400 text-sm tracking-widest uppercase">{text}</p>
    </div>
  );
}