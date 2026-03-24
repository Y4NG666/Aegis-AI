export function AppFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 flex h-10 items-center justify-between bg-surface-container px-4 shadow-footer md:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#F9362C]">
        Protocol Pause | Emergency Mode | System Stable
      </p>

      <div className="hidden items-center gap-6 md:flex">
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500 transition-colors hover:bg-[#F9362C] hover:text-white"
        >
          Global Killswitch
        </button>
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500 transition-colors hover:bg-[#F9362C] hover:text-white"
        >
          Diagnostic Log
        </button>
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#F9362C] transition-colors hover:bg-[#F9362C] hover:text-white"
        >
          Network Status
        </button>
      </div>
    </footer>
  );
}
