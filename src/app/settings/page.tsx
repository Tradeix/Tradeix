'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '@/lib/app-context'
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

  const ToggleGroup = ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: any) => void }) => (
    <div style={{ display: 'flex', gap: '6px' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: '6px 16px', borderRadius: '20px', fontSize: '13px',
          cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
          border: `1px solid ${value === opt.value ? 'var(--blue)' : 'var(--border)'}`,
          background: value === opt.value ? 'var(--blue3)' : 'transparent',
          color: value === opt.value ? 'var(--blue)' : 'var(--text2)',
          fontWeight: value === opt.value ? '500' : '400',
          transition: 'all 0.2s',
        }}>{opt.label}</button>
      ))}
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>
        {language === 'he' ? 'הגדרות אישיות' : 'Personal Settings'}
      </div>

      <div style={{ maxWidth: '480px' }}>
        {/* Profile card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '20px' }}>
            {language === 'he' ? 'פרטי חשבון' : 'Account Details'}
          </div>

          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div onClick={() => fileRef.current?.click()} style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: avatarUrl ? undefined : 'linear-gradient(135deg, var(--blue), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '30px', fontWeight: '600', color: '#fff',
              margin: '0 auto 12px', cursor: 'pointer',
              overflow: 'hidden', position: 'relative',
              boxShadow: '0 0 30px var(--blueglow)',
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
              {uploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            <button onClick={() => fileRef.current?.click()} style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '6px 14px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
            }}>
              {language === 'he' ? '✎ שינוי תמונה' : '✎ Change photo'}
            </button>
          </div>

          {/* Nickname */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>
              {language === 'he' ? 'כינוי' : 'Nickname'}
            </label>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder={language === 'he' ? 'הכינוי שלך' : 'Your nickname'}
            />
          </div>

          {/* Email (readonly) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>
              {language === 'he' ? 'אימייל (Google)' : 'Email (Google)'}
            </label>
            <input value={user?.email || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%', opacity: saving ? 0.7 : 1 }}>
            {saving ? (language === 'he' ? 'שומר...' : 'Saving...') : (language === 'he' ? '✓ שמור שינויים' : '✓ Save changes')}
          </button>
        </div>

        {/* Preferences card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '20px' }}>
            {language === 'he' ? 'העדפות' : 'Preferences'}
          </div>

          {/* Language */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>
                {language === 'he' ? 'שפה' : 'Language'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>עברית / English</div>
            </div>
            <ToggleGroup
              value={language}
              onChange={setLanguage}
              options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]}
            />
          </div>

          {/* Theme */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>
                {language === 'he' ? 'עיצוב' : 'Theme'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                {language === 'he' ? 'כהה / בהיר' : 'Dark / Light'}
              </div>
            </div>
            <ToggleGroup
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'dark', label: language === 'he' ? '🌙 כהה' : '🌙 Dark' },
                { value: 'light', label: language === 'he' ? '☀ בהיר' : '☀ Light' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
