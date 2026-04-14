'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '@/lib/app-context'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { theme, language, setTheme, setLanguage } = useApp()
  const [user, setUser] = useState<any>(null)
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setNickname(user?.user_metadata?.full_name || '')
      setAvatarUrl(user?.user_metadata?.avatar_url || null)
    })
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } })
      toast.success('תמונת פרופיל עודכנה ✓')
    } catch {
      toast.error('שגיאה בהעלאת התמונה')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave() {
    if (!nickname.trim()) { toast.error('נא להזין כינוי'); return }
    setSaving(true)
    try {
      await supabase.auth.updateUser({ data: { full_name: nickname } })
      await supabase.from('profiles').update({ full_name: nickname }).eq('id', user.id)
      toast.success('הפרטים נשמרו ✓')
    } catch {
      toast.error('שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const initials = (nickname || user?.email || 'U')[0].toUpperCase()

  const glass = {
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '20px',
    padding: '24px',
  }

  const ToggleGroup = ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: any) => void }) => (
    <div style={{ display: 'flex', gap: '6px' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: '7px 18px', borderRadius: '10px', fontSize: '12px',
          cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700',
          border: `1px solid ${value === opt.value ? 'rgba(74,127,255,0.4)' : 'var(--border)'}`,
          background: value === opt.value ? 'rgba(74,127,255,0.15)' : 'var(--bg3)',
          color: value === opt.value ? '#4a7fff' : 'var(--text3)',
          transition: 'all 0.2s',
        }}>{opt.label}</button>
      ))}
    </div>
  )

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={language === 'he' ? 'הגדרות אישיות' : 'Personal Settings'}
        subtitle={language === 'he' ? 'ניהול חשבון והעדפות' : 'Account management & preferences'}
        icon="manage_accounts"
      />

      {/* 3 cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }} className="settings-grid">

        {/* ── CARD 1: Profile ── */}
        <div style={{ ...glass }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(74,127,255,0.15)', border: '1px solid rgba(74,127,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4a7fff', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>person</span>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'פרטי חשבון' : 'Account Details'}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'פרופיל ותמונה' : 'Profile & photo'}</div>
            </div>
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
            <div onClick={() => fileRef.current?.click()} style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: avatarUrl ? undefined : 'linear-gradient(135deg, #4a7fff, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', fontWeight: '700', color: '#fff',
              marginBottom: '10px', cursor: 'pointer', overflow: 'hidden', position: 'relative',
              border: '2px solid rgba(74,127,255,0.3)',
              boxShadow: '0 0 24px rgba(74,127,255,0.2)',
            }}>
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              {uploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            <button onClick={() => fileRef.current?.click()} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 14px', fontSize: '11px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700' }}>
              {language === 'he' ? '✎ שינוי תמונה' : '✎ Change photo'}
            </button>
          </div>

          {/* Nickname */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {language === 'he' ? 'כינוי' : 'Nickname'}
            </label>
            <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder={language === 'he' ? 'הכינוי שלך' : 'Your nickname'} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {language === 'he' ? 'אימייל' : 'Email'}
            </label>
            <input value={user?.email || ''} disabled style={{ opacity: 0.4, cursor: 'not-allowed' }} />
          </div>

          <button onClick={handleSave} disabled={saving} style={{
            width: '100%', background: 'linear-gradient(135deg, #4a7fff, #3366dd)',
            color: '#fff', border: 'none', borderRadius: '12px', padding: '11px',
            fontSize: '13px', fontWeight: '700', cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1, fontFamily: 'Heebo, sans-serif',
            boxShadow: '0 0 20px rgba(74,127,255,0.3)',
          }}>
            {saving ? (language === 'he' ? 'שומר...' : 'Saving...') : (language === 'he' ? '✓ שמור שינויים' : '✓ Save changes')}
          </button>
        </div>

        {/* ── CARD 2: Preferences ── */}
        <div style={{ ...glass }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#8b5cf6', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>tune</span>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'העדפות' : 'Preferences'}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'שפה ועיצוב' : 'Language & theme'}</div>
            </div>
          </div>

          {/* Language */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {language === 'he' ? 'שפה' : 'Language'}
            </div>
            <ToggleGroup
              value={language}
              onChange={setLanguage}
              options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]}
            />
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '8px', fontWeight: '600' }}>
              {language === 'he' ? 'האתר יוצג בכיוון ימין לשמאל' : 'Site will display left to right'}
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '20px' }} />

          {/* Theme */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {language === 'he' ? 'עיצוב' : 'Theme'}
            </div>
            <ToggleGroup
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'dark', label: language === 'he' ? '🌙 כהה' : '🌙 Dark' },
                { value: 'light', label: language === 'he' ? '☀ בהיר' : '☀ Light' },
              ]}
            />
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '8px', fontWeight: '600' }}>
              {language === 'he' ? 'השינוי חל על כל האתר' : 'Change applies to the entire site'}
            </div>
          </div>
        </div>

        {/* ── CARD 3: Subscription ── */}
        <div style={{ ...glass, position: 'relative', overflow: 'hidden', border: '1px solid rgba(74,127,255,0.15)' }}>
          {/* Glow background */}
          <div style={{ position: 'absolute', top: '-40px', left: '-40px', width: '150px', height: '150px', background: 'rgba(74,127,255,0.06)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(74,127,255,0.15)', border: '1px solid rgba(74,127,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4a7fff', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>workspace_premium</span>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'הגדרות מנוי' : 'Subscription'}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוכנית וחיוב' : 'Plan & billing'}</div>
            </div>
          </div>

          {/* Current plan badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(74,127,255,0.08)', border: '1px solid rgba(74,127,255,0.2)', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(74,127,255,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{language === 'he' ? 'תוכנית נוכחית' : 'Current plan'}</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#4a7fff' }}>{language === 'he' ? 'חינמי' : 'Free'}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(74,127,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4a7fff', fontVariationSettings: "'FILL' 1, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>verified</span>
            </div>
          </div>

          {/* Features list */}
          <div style={{ marginBottom: '24px' }}>
            {[
              { feature: language === 'he' ? 'עד 50 עסקאות' : 'Up to 50 trades', included: true },
              { feature: language === 'he' ? 'ניתוח AI בסיסי' : 'Basic AI analysis', included: true },
              { feature: language === 'he' ? 'סטטיסטיקות מתקדמות' : 'Advanced statistics', included: false },
              { feature: language === 'he' ? 'ייצוא נתונים' : 'Data export', included: false },
              { feature: language === 'he' ? 'תיקים ללא הגבלה' : 'Unlimited portfolios', included: false },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: item.included ? '#22c55e' : 'var(--text3)', fontVariationSettings: "'FILL' 1, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>
                  {item.included ? 'check_circle' : 'cancel'}
                </span>
                <span style={{ fontSize: '12px', color: item.included ? 'var(--text2)' : 'var(--text3)', fontWeight: '600' }}>{item.feature}</span>
              </div>
            ))}
          </div>

          {/* Upgrade button */}
          <button style={{
            width: '100%', background: 'linear-gradient(135deg, rgba(74,127,255,0.2), rgba(139,92,246,0.2))',
            color: '#4a7fff', border: '1px solid rgba(74,127,255,0.3)',
            borderRadius: '12px', padding: '11px',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
            onMouseOver={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74,127,255,0.3), rgba(139,92,246,0.3))' }}
            onMouseOut={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74,127,255,0.2), rgba(139,92,246,0.2))' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>rocket_launch</span>
            {language === 'he' ? 'שדרג לפרו' : 'Upgrade to Pro'}
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .settings-grid { grid-template-columns: 1fr !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
