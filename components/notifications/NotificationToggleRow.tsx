'use client'

interface Props {
  label: string
  description: string
  emailOn: boolean
  pushOn: boolean
  onEmailChange: (on: boolean) => void
  onPushChange: (on: boolean) => void
}

export function NotificationToggleRow({
  label,
  description,
  emailOn,
  pushOn,
  onEmailChange,
  onPushChange,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      {/* Left: label + description */}
      <div className="flex-1 min-w-0">
        <div className="font-cond text-[13px] font-black text-white">{label}</div>
        <div className="text-[12px] text-muted mt-0.5">{description}</div>
      </div>

      {/* Right: Email toggle + Push toggle */}
      <div className="flex items-center gap-5 flex-shrink-0">
        {/* Email toggle */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-cond text-[10px] font-black tracking-wide text-muted uppercase">
            Email
          </span>
          <button
            role="switch"
            aria-checked={emailOn}
            aria-label={`${label} Email notifications`}
            onClick={() => onEmailChange(!emailOn)}
            className={`relative w-10 h-5 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-navy/50 ${
              emailOn ? 'bg-navy' : 'bg-[#1a2d50]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none ${
                emailOn ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Push toggle */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-cond text-[10px] font-black tracking-wide text-muted uppercase">
            Push
          </span>
          <button
            role="switch"
            aria-checked={pushOn}
            aria-label={`${label} Push notifications`}
            onClick={() => onPushChange(!pushOn)}
            className={`relative w-10 h-5 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-navy/50 ${
              pushOn ? 'bg-navy' : 'bg-[#1a2d50]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none ${
                pushOn ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
