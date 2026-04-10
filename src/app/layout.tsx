import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'TRADEIX — יומן מסחר חכם',
  description: 'עקוב, נתח ושפר את ביצועי המסחר שלך עם TRADEIX',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#12141a',
              color: '#e8eaf6',
              border: '1px solid #2a2f42',
              fontFamily: 'Rubik, sans-serif',
              fontSize: '14px',
            },
          }}
        />
      </body>
    </html>
  )
}
