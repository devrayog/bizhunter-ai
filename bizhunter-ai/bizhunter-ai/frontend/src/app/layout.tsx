import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BizHunter AI — Autonomous Business Outreach Agent',
  description: 'AI agent that finds local businesses, pitches them, and builds their websites',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
