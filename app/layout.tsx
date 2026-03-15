import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed, Roboto_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { AppProvider } from '@/lib/store'
import './globals.css'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-barlow-condensed',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-roboto-mono',
})

export const metadata: Metadata = {
  title: 'LeagueOps — Tournament Command Center',
  description: 'Real-time tournament operations management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${robotoMono.variable}`}>
      <body className="bg-surface text-white font-sans antialiased">
        <AppProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#0d2d6b',
                color: '#fff',
                border: '1px solid #2a4080',
                fontFamily: 'var(--font-barlow-condensed)',
                fontWeight: '700',
                letterSpacing: '0.5px',
              },
            }}
          />
        </AppProvider>
      </body>
    </html>
  )
}
