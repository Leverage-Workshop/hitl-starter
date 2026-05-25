import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HITL Review Console',
  description: 'Human-in-the-loop workflow review console',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
