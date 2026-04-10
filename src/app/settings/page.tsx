'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [language, setLanguage] = useState<'he' | 'en'>('he')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setFullName(user?.user_metadata?.full_name || '')
      setAvatarUrl(user?.user_metadata?.avatar_url || null)
    })
    // Load saved prefs from localStorage
    const savedTheme = localStorage.getItem('tradeix-theme') as 'dark' | 'light' || 'dark'
    const savedLang = localStorage.getItem('tradeix-lang') as 'he' | 'en' || 'he'
    setTheme(savedTheme)
    setLanguage(savedLang)
    applyTheme(savedTheme)
    applyLanguage(savedLang)
  }, [])

  function applyTheme(t: 'dark' | 'light') {
    const root = document.documentElement
    if (t === 'light') {
      root.style.setProperty('--bg', '#f5f5f8')
      root.style.setProperty('--bg2', '#ffffff')
      root.style.setProperty('--bg3', '#f0f0f5')
      root.style.setProperty('--bg4', '#e5e5ec')
      root.style.setProperty('--border', '#e0e0ea')
      root.style.setProperty('--border2', '#d0d0de')
      root.style.setProperty('--text', '#111122')
      root.style.setProperty('--text2', '#444466')
      root.style.setProperty('--text3', '#888899')
    } else {
      root.style.setProperty('--bg', '#0a0b0f')
      root.style.setProperty('--bg2', '#12141a')
      root.style.setProperty('--bg3', '#1a1d26')
      root.style.setProperty('--bg4', '#222636')
      root.style.setProperty('--border', '#2a2f42')
      root.style.setProperty('--border2', '#363d55')
      root.style.setProperty('--text', '#e8eaf6')
      root.style.setProperty('--text2', '#9096b4')
      root.style.setProperty('--text3', '#5a6080')
    }
  }

  function applyLanguage(l: 'he' | 'en') {
    document.documentElement.dir = l === 'en' ? 'ltr' : 'rtl'
    document.documentElement.lang = l
  }

  function handleThemeChange(t: 'dark' | 'light') {
    setTheme(t)
    localStorage.setItem('tradeix-theme', t)
    applyTheme(t)
  }

  function handleLanguageChange(l: 'he' | 'en') {
    setLanguage(l)
    localStorage.setItem('tradeix-lang', l)
    applyLanguage(l)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { toast.error('שגיאה בהעלאת התמונה'); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } })
    toast.success('תמונת פרופיל עודכנה ✓')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updates: any = {}
      if (fullName) updates.data = { full_name: fullName, avatar_url: avatarUrl }
      if (newPassword) updates.password = newPassword
      const { error } = await supabase.auth.updateUser(updates)
      if (error) throw error
      toast.success('ההגדרות נשמרו ✓')
      setNewPassword('')
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const ToggleGroup = ({ options, value, onChange }: any) => (
    <div style={{ display: 'flex', gap: '6px' }}>
      {options.map((opt: any) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: '5px 12px', borderRadius: '20px', fontSize: '12px',
          cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
          border: `1px solid ${value === opt.value ? 'var(--blue)' : 'var(--border)'}`,
          background: value === opt.value ? 'var(--blue3)' : 'transparent',
          color: value === opt.value ? 'var(--blue)' : 'var(--text2)',
          transition: 'all 0.2s',
        }}>{opt.label}</button>
      ))}
    </div>
  )

  const initials = (fullName || user?.email || 'U')[0].toUpperCase()

  return (
    <div>
      <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>הגדרות אישיות</div>

      <div style={{ maxWidth: '500px' }}>
        {/* Profile card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '20px' }}>פרטי חשבון</div>

          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: '76px', height: '76px', borderRadius: '50%',
                background: avatarUrl ? undefined : 'linear-gradient(135deg, var(--blue), var(--purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px', fontWeight: '600', color: '#fff',
                margin: '0 auto 12px', cursor: 'pointer',
                boxShadow: '0 0 30px var(--blueglow)',
                overflow: 'hidden',
                animation: 'pulse-glow 3s ease-in-out infinite',
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            <button onClick={() => fileRef.current?.click()} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 14px' }}>
              ✎ שינוי תמונה
            </button>
          </div>

          {/* Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>שם משתמש</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="השם שלך" />
          </div>

          {/* Email (readonly) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>אימייל</label>
            <input value={user?.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>סיסמא חדשה</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="השאר ריק לשמירה ללא שינוי" />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'שומר...' : '✓ שמור שינויים'}
          </button>
        </div>

        {/* Preferences card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '20px' }}>העדפות</div>

          {/* Language */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>שפה</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>עברית / English</div>
            </div>
            <ToggleGroup
              value={language}
              onChange={handleLanguageChange}
              options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]}
            />
          </div>

          {/* Theme */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>עיצוב</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>כהה / בהיר</div>
            </div>
            <ToggleGroup
              value={theme}
              onChange={handleThemeChange}
              options={[{ value: 'dark', label: '🌙 כהה' }, { value: 'light', label: '☀ בהיר' }]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
