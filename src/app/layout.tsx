import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AppProvider } from '@/lib/app-context'

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
        </AppProvider>
        <Toaster
          position="top-center"
          gutter={12}
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1a1d26',
              color: '#e8eaf6',
              border: '1px solid #363d55',
              fontFamily: 'Rubik, sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              padding: '14px 20px',
              borderRadius: '12px',
              boxShadow: '0 8px 32px #00000066',
              minWidth: '280px',
              maxWidth: '420px',
              direction: 'rtl',
              textAlign: 'right',
            },
            success: {
              style: { background: '#0d2218', border: '1px solid #10b98144', color: '#e8eaf6' },
              iconTheme: { primary: '#10b981', secondary: '#0d2218' },
            },
            error: {
              style: { background: '#200f0f', border: '1px solid #ef444444', color: '#e8eaf6' },
              iconTheme: { primary: '#ef4444', secondary: '#200f0f' },
            },
          }}
        />
      </body>
    </html>
  )
}
