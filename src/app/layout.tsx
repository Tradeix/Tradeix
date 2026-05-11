import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/lib/app-context'
import AppToaster from '@/components/AppToaster'

export const metadata: Metadata = {
  title: 'TRADEIX — Smart Trading Journal',
  description: 'Track, analyze, and improve your trading performance with TRADEIX',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <AppProvider>
          {children}
          <AppToaster />
        </AppProvider>
      </body>
    </html>
  )
}
