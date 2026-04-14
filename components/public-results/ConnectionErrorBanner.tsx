export function ConnectionErrorBanner() {
  return (
    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-4 py-2 mb-4">
      <p className="font-cond text-[10px] font-bold text-yellow-400 uppercase tracking-[.1em]">
        Live scores unavailable — reload to retry
      </p>
    </div>
  )
}
