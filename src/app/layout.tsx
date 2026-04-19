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
          gutter={6}
          toastOptions={{
            duration: 2500,
            style: {
              background: 'rgba(12,14,20,0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#e5e2e1',
              border: '1px solid rgba(255,255,255,0.06)',
              fontFamily: 'Heebo, sans-serif',
              fontSize: '13px',
              fontWeight: '600',
              padding: '10px 16px',
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              maxWidth: '340px',
              direction: 'rtl',
              gap: '8px',
            },
            success: {
              style: {
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.25)',
              },
              iconTheme: { primary: '#10b981', secondary: 'rgba(16,185,129,0.15)' },
            },
            error: {
              style: {
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.25)',
              },
              iconTheme: { primary: '#ef4444', secondary: 'rgba(239,68,68,0.15)' },
            },
          }}
        />
      </body>
    </html>
  )
}
