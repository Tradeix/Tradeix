import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/lib/app-context'
import AppToaster from '@/components/AppToaster'

export const metadata: Metadata = {
  title: 'UploTrade- יומן המסחר שלי',
  description: 'Track, analyze, and improve your trading performance with UPLOTRADE',
  icons: {
    icon: '/uplotrade-mark-cropped.png',
    shortcut: '/uplotrade-mark-cropped.png',
    apple: '/uplotrade-mark-cropped.png',
  },
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
