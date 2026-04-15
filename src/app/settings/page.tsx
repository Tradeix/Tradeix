'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '@/lib/app-context'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { theme, language, setTheme, setLanguage, isPro, subscription, cancelSubscription } = useApp()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelingPro, setCancelingPro] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
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
      toast.success('תמונת פרופיל עודכנה')
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
      toast.success('הפרטים נשמרו')
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

        </div>

        {/* ── CARD 3: Subscription ── */}
        <div style={{
          ...glass, position: 'relative', overflow: 'hidden',
          border: isPro ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(74,127,255,0.15)',
          background: isPro
            ? 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(249,115,22,0.03))'
            : 'var(--glass-bg)',
        }}>
          <div style={{ position: 'absolute', top: '-40px', [language === 'he' ? 'left' : 'right']: '-40px', width: '150px', height: '150px', background: isPro ? 'rgba(245,158,11,0.08)' : 'rgba(74,127,255,0.06)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: isPro ? 'rgba(245,158,11,0.15)' : 'rgba(74,127,255,0.15)', border: `1px solid ${isPro ? 'rgba(245,158,11,0.3)' : 'rgba(74,127,255,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isPro ? '#f59e0b' : '#4a7fff', fontVariationSettings: "'FILL' 1, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>workspace_premium</span>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'הגדרות מנוי' : 'Subscription'}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוכנית וחיוב' : 'Plan & billing'}</div>
            </div>
          </div>

          {/* Current plan badge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: isPro ? 'rgba(245,158,11,0.1)' : 'rgba(74,127,255,0.08)',
            border: `1px solid ${isPro ? 'rgba(245,158,11,0.25)' : 'rgba(74,127,255,0.2)'}`,
            borderRadius: '14px', padding: '14px 16px', marginBottom: '20px',
          }}>
            <div>
              <div style={{ fontSize: '11px', color: isPro ? 'rgba(245,158,11,0.7)' : 'rgba(74,127,255,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                {language === 'he' ? 'תוכנית נוכחית' : 'Current plan'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: isPro ? '#f59e0b' : '#4a7fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isPro ? 'PRO' : (language === 'he' ? 'חינמי' : 'Free')}
                {isPro && <span style={{ fontSize: '12px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '999px', padding: '2px 8px', fontWeight: '700' }}>⚡ פעיל</span>}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '600', marginTop: '2px' }}>
                {isPro ? '$20 / ' + (language === 'he' ? 'חודש' : 'month') : (language === 'he' ? 'ללא עלות' : 'No charge')}
              </div>
            </div>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: isPro ? 'rgba(245,158,11,0.12)' : 'rgba(74,127,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: isPro ? '#f59e0b' : '#4a7fff', fontVariationSettings: "'FILL' 1, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>
                {isPro ? 'bolt' : 'verified'}
              </span>
            </div>
          </div>

          {/* Features list */}
          <div style={{ marginBottom: '24px' }}>
            {(isPro ? [
              { feature: language === 'he' ? 'עד 3 תיקים' : 'Up to 3 portfolios', ok: true },
              { feature: language === 'he' ? 'עסקאות ללא הגבלה' : 'Unlimited trades', ok: true },
              { feature: language === 'he' ? 'עמוד סטטיסטיקות' : 'Statistics page', ok: true },
              { feature: language === 'he' ? 'ארכיון תיקים' : 'Portfolio archive', ok: true },
              { feature: language === 'he' ? 'עדכונים ותכונות חדשות' : 'New features & updates', ok: true },
            ] : [
              { feature: language === 'he' ? 'תיק מסחר אחד' : 'One portfolio', ok: true },
              { feature: language === 'he' ? 'עד 20 עסקאות' : 'Up to 20 trades', ok: true },
              { feature: language === 'he' ? 'עמוד סטטיסטיקות' : 'Statistics page', ok: false },
              { feature: language === 'he' ? 'ארכיון תיקים' : 'Portfolio archive', ok: false },
              { feature: language === 'he' ? 'עסקאות ללא הגבלה' : 'Unlimited trades', ok: false },
            ]).map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: item.ok ? (isPro ? '#f59e0b' : '#22c55e') : 'var(--text3)', fontVariationSettings: "'FILL' 1, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>
                  {item.ok ? 'check_circle' : 'cancel'}
                </span>
                <span style={{ fontSize: '12px', color: item.ok ? 'var(--text2)' : 'var(--text3)', fontWeight: '600', textDecoration: item.ok ? 'none' : 'line-through' }}>
                  {item.feature}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          {isPro ? (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={cancelingPro}
              style={{ width: '100%', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '11px', fontSize: '13px', fontWeight: '700', color: 'rgba(239,68,68,0.7)', cursor: cancelingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: cancelingPro ? 0.6 : 1 }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.04)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = 'rgba(239,68,68,0.7)'; e.currentTarget.style.background = 'transparent' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>cancel</span>
              {cancelingPro ? (language === 'he' ? 'מבטל...' : 'Canceling...') : (language === 'he' ? 'בטל מנוי' : 'Cancel subscription')}
            </button>
          ) : (
            <Link href="/upgrade" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              color: '#fff', border: 'none', borderRadius: '12px', padding: '11px',
              fontSize: '13px', fontWeight: '800', textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(245,158,11,0.3)', transition: 'all 0.2s',
            }}
              onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(245,158,11,0.4)' }}
              onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.3)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' -25, 'opsz' 20" }}>bolt</span>
              {language === 'he' ? 'שדרג ל PRO — $20/חודש' : 'Upgrade to PRO — $20/mo'}
            </Link>
          )}
        </div>
      </div>

      {/* Cancel subscription confirmation modal */}
      {showCancelConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '24px', padding: '36px 32px', maxWidth: '420px', width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 24" }}>warning</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '12px' }}>
              {language === 'he' ? 'לבטל את המנוי?' : 'Cancel subscription?'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', lineHeight: 1.7, marginBottom: '28px' }}>
              {language === 'he'
                ? 'האם אתה בטוח שברצונך לבטל את המנוי?\nכל ההיסטוריה, העסקאות והתוכן שלך יימחקו לצמיתות ולא ניתן יהיה לשחזרם.'
                : 'Are you sure you want to cancel?\nAll your history, trades, and content will be permanently deleted and cannot be recovered.'}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '11px', fontSize: '13px', fontWeight: '700', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
              >
                {language === 'he' ? 'חזור' : 'Go back'}
              </button>
              <button
                onClick={async () => { setShowCancelConfirm(false); setCancelingPro(true); await cancelSubscription(); router.push('/dashboard') }}
                style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px', padding: '11px', fontSize: '13px', fontWeight: '700', color: '#ef4444', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
              >
                {language === 'he' ? 'כן, מחק הכל' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .settings-grid { grid-template-columns: 1fr !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
