import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-[#1a2d50] bg-[#081428]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/results"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-1 h-5 rounded-sm bg-[#D62828]" />
            <span className="font-cond text-[15px] font-black tracking-[.18em] text-white uppercase">
              LeagueOps
            </span>
            <span className="font-cond text-[12px] font-bold tracking-[.1em] text-[#5a6e9a] uppercase">
              Results
            </span>
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      <footer className="border-t border-[#1a2d50] mt-12">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center">
          <span className="font-cond text-[10px] font-black tracking-[.12em] text-[#5a6e9a] uppercase">
            Powered by LeagueOps
          </span>
        </div>
      </footer>
    </div>
  )
}
