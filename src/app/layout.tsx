import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FantasyTrack',
  description: 'Track NFL fantasy football player ranking trends',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
