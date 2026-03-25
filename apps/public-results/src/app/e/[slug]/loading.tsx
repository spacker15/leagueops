export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Header skeleton */}
      <div className="bg-[#081428] border border-[#1a2d50] rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-[#1a2d50]/40 rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-[#1a2d50]/40 rounded animate-pulse" />
            <div className="h-3 w-32 bg-[#1a2d50]/40 rounded animate-pulse" />
          </div>
        </div>
      </div>
      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b border-[#1a2d50] pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 w-16 bg-[#1a2d50]/40 rounded animate-pulse" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-[#1a2d50]/40 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}
