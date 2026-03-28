'use client'

import { QRCodeSVG } from 'qrcode.react'

interface Props {
  slug: string
  teamId?: number
  teamName?: string
  size?: number
}

export function EventQRCode({ slug, teamId, teamName, size = 128 }: Props) {
  const baseUrl =
    process.env.NEXT_PUBLIC_PUBLIC_RESULTS_URL ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://public-results-gamma.vercel.app')
  const url = teamId
    ? `${baseUrl}/e/${slug}?tab=schedule&view=team&team=${teamId}`
    : `${baseUrl}/e/${slug}`

  const caption = teamName ? `Scan for ${teamName}` : 'Scan to share'

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white rounded-lg p-2">
        <QRCodeSVG
          value={url}
          size={size}
          bgColor="#FFFFFF"
          fgColor="#000000"
          level="M"
          aria-label={teamName ? `QR code for ${teamName} schedule` : `QR code for event`}
        />
      </div>
      <div className="font-cond text-[10px] text-[#5a6e9a] text-center mt-2 uppercase tracking-wide font-bold">
        {caption}
      </div>
    </div>
  )
}
