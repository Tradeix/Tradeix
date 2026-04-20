import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/lib/app-context'
import AppToaster from '@/components/AppToaster'

export const metadata: Metadata = {
  title: 'TRADEIX — יומן מסחר חכם',
  description: 'עקוב, נתח ושפר את ביצועי המסחר שלך עם TRADEIX',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <AppProvider>
          {children}
          <AppToaster />
        </AppProvider>
      </body>
    </html>
  )
}
