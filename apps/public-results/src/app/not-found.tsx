import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="font-cond text-[48px] font-black text-[#1a2d50]">404</div>
      <div className="font-cond text-[14px] font-black tracking-[.12em] text-[#5a6e9a] uppercase">
        Event not found
      </div>
      <Link
        href="/"
        className="mt-2 px-5 py-2 bg-[#0B3D91] text-white font-cond text-[12px] font-black tracking-[.12em] uppercase rounded-lg hover:bg-blue-700 transition-colors"
      >
        Back to Events
      </Link>
    </div>
  )
}
