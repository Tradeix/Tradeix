'use client'

import { Toaster } from 'react-hot-toast'
import { useApp } from '@/lib/app-context'

export default function AppToaster() {
  const { theme, language } = useApp()
  const isLight = theme === 'light'

  return (
    <Toaster
      position="top-center"
      gutter={6}
      toastOptions={{
        duration: 2500,
        style: {
          background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(12,14,20,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: isLight ? '#111827' : '#e5e2e1',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`,
          fontFamily: 'Heebo, sans-serif',
          fontSize: '13px',
          fontWeight: '600',
          padding: '10px 16px',
          borderRadius: '10px',
          boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.1)' : '0 4px 20px rgba(0,0,0,0.4)',
          maxWidth: '340px',
          direction: language === 'he' ? 'rtl' : 'ltr',
          gap: '8px',
        },
        success: {
          style: {
            background: isLight ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)',
            border: '1px solid rgba(16,185,129,0.25)',
            color: isLight ? '#111827' : '#e5e2e1',
          },
          iconTheme: { primary: '#10b981', secondary: isLight ? '#ecfdf5' : 'rgba(16,185,129,0.15)' },
        },
        error: {
          style: {
            background: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: isLight ? '#111827' : '#e5e2e1',
          },
          iconTheme: { primary: '#ef4444', secondary: isLight ? '#fef2f2' : 'rgba(239,68,68,0.15)' },
        },
      }}
    />
  )
}
