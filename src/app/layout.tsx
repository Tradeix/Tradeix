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
          gutter={10}
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(20,23,34,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: '#e5e2e1',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'Heebo, sans-serif',
              fontSize: '14px',
              fontWeight: '600',
              padding: '13px 18px',
              borderRadius: '14px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              minWidth: '240px',
              maxWidth: '380px',
              direction: 'rtl',
              gap: '10px',
            },
            success: {
              style: {
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#e5e2e1',
                fontFamily: 'Heebo, sans-serif',
              },
              iconTheme: { primary: '#10b981', secondary: 'rgba(16,185,129,0.15)' },
            },
            error: {
              style: {
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#e5e2e1',
                fontFamily: 'Heebo, sans-serif',
              },
              iconTheme: { primary: '#ef4444', secondary: 'rgba(239,68,68,0.15)' },
            },
          }}
        />
      </body>
    </html>
  )
}
