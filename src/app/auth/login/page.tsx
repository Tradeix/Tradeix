'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', top: '20%', right: '30%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: '#0f8d630a', filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', left: '30%',
          width: '300px', height: '300px', borderRadius: '50%',
          background: '#0f8d630a', filter: 'blur(80px)',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #0f8d63, #0f8d63)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '27px', fontWeight: '700', color: '#fff',
            margin: '0 auto 16px',
            boxShadow: '0 0 40px #0f8d6333',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}>TX</div>
          <div style={{ fontSize: '29px', fontWeight: '700', letterSpacing: '2px' }}>
            <span style={{
              background: 'linear-gradient(90deg, #0f8d63, #0f8d63)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>TRADE</span>
            <span style={{ color: 'var(--text)' }}>IX</span>
          </div>
          <div style={{ fontSize: '15px', color: 'var(--text3)', marginTop: '8px' }}>
            יומן מסחר חכם עם ניתוח AI
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '32px',
        }}>
          <div style={{ fontSize: '21px', fontWeight: '600', marginBottom: '8px', textAlign: 'center' }}>
            ברוך הבא
          </div>
          <div style={{ fontSize: '15px', color: 'var(--text3)', marginBottom: '28px', textAlign: 'center' }}>
            התחבר כדי לנהל את יומן המסחר שלך
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px',
              color: 'var(--text)',
              fontSize: '16px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              transition: 'all 0.2s',
              fontFamily: 'Rubik, sans-serif',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseOver={e => !loading && ((e.target as HTMLElement).style.borderColor = 'var(--border2)')}
            onMouseOut={e => ((e.target as HTMLElement).style.borderColor = 'var(--border)')}
          >
            {loading ? (
              <div style={{
                width: '20px', height: '20px', border: '2px solid var(--border)',
                borderTopColor: 'var(--blue)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'מתחבר...' : 'התחבר עם Google'}
          </button>

          <div style={{
            marginTop: '20px', padding: '12px', background: 'var(--bg3)',
            borderRadius: '8px', fontSize: '13px', color: 'var(--text3)',
            textAlign: 'center', lineHeight: '1.6',
          }}>
            בהתחברות אתה מסכים לתנאי השימוש ומדיניות הפרטיות
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text3)' }}>
          TRADEIX © 2024 • כל הזכויות שמורות
        </div>
      </div>
    </div>
  )
}
