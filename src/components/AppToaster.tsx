'use client'

import toast, { Toaster, ToastBar } from 'react-hot-toast'
import { useApp } from '@/lib/app-context'
import Icon from '@/components/Icon'

export default function AppToaster() {
  const { theme, language } = useApp()
  const isLight = theme === 'light'

  return (
    <Toaster
      position="top-center"
      gutter={8}
      toastOptions={{
        duration: 2800,
        style: {
          background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(15,17,24,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: isLight ? '#111827' : '#e5e2e1',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`,
          fontFamily: 'Heebo, sans-serif',
          fontSize: '15px',
          fontWeight: '600',
          padding: '12px 18px',
          borderRadius: '14px',
          boxShadow: isLight
            ? '0 8px 32px rgba(0,0,0,0.12)'
            : '0 8px 32px rgba(0,0,0,0.5)',
          maxWidth: '380px',
          direction: language === 'he' ? 'rtl' : 'ltr',
          gap: '10px',
          display: 'flex',
          alignItems: 'center',
        },
        success: {
          icon: (
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="check" size={16} color="#10b981" />
            </div>
          ),
          style: {
            background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(15,17,24,0.97)',
            border: '1px solid rgba(16,185,129,0.2)',
            color: isLight ? '#111827' : '#e5e2e1',
          },
        },
        error: {
          icon: (
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="close" size={16} color="#ef4444" />
            </div>
          ),
          style: {
            background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(15,17,24,0.97)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: isLight ? '#111827' : '#e5e2e1',
          },
        },
      }}
    />
  )
}
