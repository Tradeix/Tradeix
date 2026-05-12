'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '@/lib/app-context'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Icon from '@/components/Icon'

type BillingProfile = {
  subscription_tier: 'free' | 'pro' | null
  subscription_status: string | null
  subscription_renews_at: string | null
  subscription_ends_at: string | null
  subscription_trial_ends_at: string | null
  subscription_billing_period?: 'monthly' | 'yearly' | null
}

export default function SettingsPage() {
  const { theme, language, setTheme, setLanguage, isPro: contextIsPro, cancelSubscription, resumeSubscription } = useApp()
  const [user, setUser] = useState<any>(null)
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null)
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelingPro, setCancelingPro] = useState(false)
  const [resumingPro, setResumingPro] = useState<'monthly' | 'yearly' | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showYearlySwitchConfirm, setShowYearlySwitchConfirm] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [pendingLang, setPendingLang] = useState(language)
  const [pendingTheme, setPendingTheme] = useState(theme)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [syncingBilling, setSyncingBilling] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const isLight = theme === 'light'

  const refreshBillingProfile = useCallback(async (targetUserId?: string) => {
    const profileUserId = targetUserId || user?.id
    if (!profileUserId) return null

    const response = await fetch('/api/billing/status', { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    const data = payload?.profile || null

    if (data) setBillingProfile(data as BillingProfile)
    return data as BillingProfile | null
  }, [user?.id])

  useEffect(() => {
    let mounted = true

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return
      setUser(user)
      setNickname(user?.user_metadata?.full_name || '')
      setAvatarUrl(user?.user_metadata?.avatar_url || null)

      if (user) {
        const response = await fetch('/api/billing/status', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (mounted && payload?.profile) setBillingProfile(payload.profile as BillingProfile)
      }
    })

    return () => { mounted = false }
  }, [supabase])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`settings-billing-profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        payload => {
          if (payload.new) {
            void refreshBillingProfile(user.id)
          }
        }
      )
      .subscribe()

    const refreshOnFocus = () => { if (document.visibilityState !== 'hidden') void refreshBillingProfile(user.id) }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
    }
  }, [refreshBillingProfile, supabase, user?.id])

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return
    if (sessionStorage.getItem('tradeix-refresh-billing') !== 'yearly') return

    let cancelled = false

    async function syncYearlyBilling() {
      setSyncingBilling(true)

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const profile = await refreshBillingProfile(user.id)
        if (cancelled) return
        const yearlyRenewalSynced = Boolean(
          profile?.subscription_billing_period === 'yearly'
          && profile.subscription_renews_at
          && new Date(profile.subscription_renews_at).getTime() - Date.now() > 1000 * 60 * 60 * 24 * 45
        )
        if (yearlyRenewalSynced) break
        await new Promise(resolve => setTimeout(resolve, 1200))
      }

      sessionStorage.removeItem('tradeix-refresh-billing')
      if (!cancelled) setSyncingBilling(false)
    }

    void syncYearlyBilling()

    return () => {
      cancelled = true
      setSyncingBilling(false)
    }
  }, [refreshBillingProfile, user?.id])

  useEffect(() => {
    setPendingLang(language)
    setPendingTheme(theme)
  }, [language, theme])

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
      toast.success(language === 'he' ? 'תמונת פרופיל עודכנה' : 'Profile photo updated')
    } catch {
      toast.error(language === 'he' ? 'שגיאה בהעלאת התמונה' : 'Error uploading photo')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave() {
    if (!nickname.trim()) { toast.error(language === 'he' ? 'נא להזין כינוי' : 'Please enter a nickname'); return }
    setSaving(true)
    try {
      await supabase.auth.updateUser({ data: { full_name: nickname } })
      await supabase.from('profiles').update({ full_name: nickname }).eq('id', user.id)
      toast.success(language === 'he' ? 'הפרטים נשמרו' : 'Details saved')
    } catch {
      toast.error(language === 'he' ? 'שגיאה בשמירה' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePreferences() {
    const nextLang = pendingLang
    const nextTheme = pendingTheme
    setSavingPrefs(true)
    try {
      if (nextTheme !== theme) await setTheme(nextTheme)
      if (nextLang !== language) await setLanguage(nextLang)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      toast.success(nextLang === 'he' ? 'ההעדפות נשמרו בהצלחה' : 'Preferences saved successfully')
    } catch {
      toast.error(nextLang === 'he' ? 'שגיאה בשמירה' : 'Save failed')
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handleCancelPro() {
    setShowCancelConfirm(false)
    setCancelingPro(true)
    try {
      const payload = await cancelSubscription()
      const cancelled = payload?.subscription

      setBillingProfile(prev => ({
        subscription_tier: prev?.subscription_tier ?? 'pro',
        subscription_status: cancelled?.status || 'cancelled',
        subscription_renews_at: cancelled?.renewsAt ?? prev?.subscription_renews_at ?? null,
        subscription_ends_at: cancelled?.endsAt ?? prev?.subscription_ends_at ?? null,
        subscription_trial_ends_at: cancelled?.trialEndsAt ?? prev?.subscription_trial_ends_at ?? null,
        subscription_billing_period: cancelled?.billingPeriod ?? prev?.subscription_billing_period ?? null,
      }))
      await refreshBillingProfile()

      toast.success(language === 'he'
        ? 'המנוי בוטל. הגישה ל-PRO תישאר עד סוף התקופה ששולמה.'
        : 'Subscription canceled. PRO access remains until the paid period ends.')
    } catch (error: any) {
      toast.error(error?.message || (language === 'he' ? 'שגיאה בביטול המנוי' : 'Subscription cancellation failed'))
    } finally {
      setCancelingPro(false)
    }
  }

  async function handleResumePro(billingPeriod: 'monthly' | 'yearly', redirectAfterSuccess?: string) {
    setResumingPro(billingPeriod)
    try {
      const payload = await resumeSubscription(billingPeriod)
      const resumed = payload?.subscription

      setBillingProfile(prev => {
        const fallbackRenewal = (() => {
          if (resumed?.renewsAt) return resumed.renewsAt
          if (billingPeriod === 'monthly' && prev?.subscription_ends_at) return prev.subscription_ends_at
          const nextDate = new Date()
          nextDate.setFullYear(nextDate.getFullYear() + (billingPeriod === 'yearly' ? 1 : 0))
          nextDate.setMonth(nextDate.getMonth() + (billingPeriod === 'monthly' ? 1 : 0))
          return nextDate.toISOString()
        })()

        return {
          subscription_tier: 'pro',
          subscription_status: resumed?.status || 'active',
          subscription_renews_at: fallbackRenewal,
          subscription_ends_at: resumed?.endsAt ?? null,
          subscription_trial_ends_at: resumed?.trialEndsAt ?? prev?.subscription_trial_ends_at ?? null,
          subscription_billing_period: billingPeriod,
        }
      })
      await refreshBillingProfile()

      toast.success(language === 'he'
        ? billingPeriod === 'yearly'
          ? 'המנוי חודש ועבר לשנתי.'
          : 'המנוי חודש. החיוב הבא ימשיך לפי תאריך החידוש המקורי.'
        : billingPeriod === 'yearly'
          ? 'Subscription resumed and switched to yearly.'
          : 'Subscription resumed. Future billing will continue on the original renewal date.')

      if (redirectAfterSuccess) {
        if (billingPeriod === 'yearly') {
          sessionStorage.setItem('tradeix-refresh-billing', 'yearly')
        }
        window.location.assign(redirectAfterSuccess)
      }
    } catch (error: any) {
      toast.error(error?.message || (language === 'he' ? 'שגיאה בחידוש המנוי' : 'Subscription resume failed'))
    } finally {
      setResumingPro(null)
    }
  }

  const initials = (nickname || user?.email || 'U')[0].toUpperCase()
  const isPro = billingProfile?.subscription_tier ? billingProfile.subscription_tier === 'pro' : contextIsPro
  const renewalDate = billingProfile?.subscription_renews_at || null
  const endsDate = billingProfile?.subscription_ends_at || null
  const trialEndsDate = billingProfile?.subscription_trial_ends_at || null
  const isCanceledButActive = billingProfile?.subscription_status === 'cancelled' && Boolean(endsDate)
  const primaryBillingDate = isCanceledButActive ? endsDate : (renewalDate || trialEndsDate || endsDate)
  const isYearlyPlan = billingProfile?.subscription_billing_period === 'yearly'
    || Boolean(!billingProfile?.subscription_billing_period && primaryBillingDate && new Date(primaryBillingDate).getTime() - Date.now() > 1000 * 60 * 60 * 24 * 45)
  const isCanceledYearlyButActive = isCanceledButActive && isYearlyPlan
  const planPeriodLabel = isYearlyPlan
    ? (language === 'he' ? 'שנתי' : 'Yearly')
    : (language === 'he' ? 'חודשי' : 'Monthly')
  const planPriceLabel = isPro
    ? isYearlyPlan
      ? (language === 'he' ? '$199 / שנה' : '$199 / year')
      : (language === 'he' ? '$20 / חודש' : '$20 / month')
    : (language === 'he' ? 'ללא עלות' : 'No charge')
  const primaryBillingLabel = isCanceledButActive
    ? (language === 'he' ? 'גישה פעילה עד' : 'Access active until')
    : (language === 'he' ? 'החידוש הבא' : 'Next renewal')
  const remainingLabel = isCanceledButActive
    ? (language === 'he' ? 'זמן שנותר עד מעבר לחינמי' : 'Time left before moving to Free')
    : (language === 'he' ? 'זמן שנותר עד החידוש' : 'Time left until renewal')

  function formatBillingDate(value: string | null) {
    if (!value) return language === 'he' ? 'לא זמין כרגע' : 'Not available yet'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return language === 'he' ? 'לא זמין כרגע' : 'Not available yet'
    return date.toLocaleString(language === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatRemainingTime(value: string | null) {
    if (!value) return language === 'he' ? 'לא זמין כרגע' : 'Not available yet'
    const target = new Date(value).getTime()
    if (Number.isNaN(target)) return language === 'he' ? 'לא זמין כרגע' : 'Not available yet'
    const diff = target - Date.now()
    if (diff <= 0) return language === 'he' ? 'התקופה הסתיימה' : 'Period ended'

    const totalHours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    const minutes = Math.floor((diff / (1000 * 60)) % 60)

    if (language === 'he') {
      if (days > 0) return `${days} ימים ו-${hours} שעות`
      if (hours > 0) return `${hours} שעות ו-${minutes} דקות`
      return `${minutes} דקות`
    }

    if (days > 0) return `${days} days and ${hours} hours`
    if (hours > 0) return `${hours} hours and ${minutes} minutes`
    return `${minutes} minutes`
  }

  const glass = {
    background: isLight ? '#ffffff' : 'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))',
    border: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)'}`,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: isLight
      ? '0 10px 28px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.85)'
      : '0 16px 38px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: '420px',
    position: 'relative' as const,
    zIndex: 1,
  }

  const ToggleGroup = ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: any) => void }) => (
    <div style={{ display: 'flex', gap: '6px' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: '7px 18px', borderRadius: '10px', fontSize: '13px',
          cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700',
          border: `1px solid ${value === opt.value ? 'rgba(15,141,99,0.4)' : 'var(--border)'}`,
          background: value === opt.value ? 'rgba(15,141,99,0.15)' : 'var(--bg3)',
          color: value === opt.value ? '#0f8d63' : 'var(--text3)',
          transition: 'all 0.2s',
        }}>{opt.label}</button>
      ))}
    </div>
  )

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', color: 'var(--text)', minHeight: 'calc(100vh - 140px)', position: 'relative', zIndex: 1 }}>
      <PageHeader
        title={language === 'he' ? 'הגדרות' : 'Settings'}
        subtitle={language === 'he' ? 'ניהול חשבון והעדפות' : 'Account management & preferences'}
        icon="settings"
      />

      {/* 3 cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px', marginBottom: '20px', alignItems: 'stretch' }} className="settings-grid">

        {/* ── CARD 1: Profile ── */}
        <div style={{ ...glass }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(15,141,99,0.15)', border: '1px solid rgba(15,141,99,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="person" size={16} color="#0f8d63" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'פרטי חשבון' : 'Account Details'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'פרופיל ותמונה' : 'Profile & photo'}</div>
            </div>
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
            <div onClick={() => fileRef.current?.click()} style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: avatarUrl ? undefined : '#0f8d63',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '27px', fontWeight: '700', color: '#fff',
              marginBottom: '10px', cursor: 'pointer', overflow: 'hidden', position: 'relative',
              border: '2px solid rgba(15,141,99,0.3)',
            }}>
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              {uploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            <button onClick={() => fileRef.current?.click()} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 14px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700' }}>
              {language === 'he' ? '✎ שינוי תמונה' : '✎ Change photo'}
            </button>
          </div>

          {/* Nickname */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {language === 'he' ? 'כינוי' : 'Nickname'}
            </label>
            <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder={language === 'he' ? 'הכינוי שלך' : 'Your nickname'} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {language === 'he' ? 'אימייל' : 'Email'}
            </label>
            <input value={user?.email || ''} disabled style={{ opacity: 0.4, cursor: 'not-allowed' }} />
          </div>

          <button onClick={handleSave} disabled={saving} style={{
            width: '100%', background: '#0f8d63',
            color: '#fff', border: 'none', borderRadius: '12px', padding: '11px',
            fontSize: '14px', fontWeight: '700', cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1, fontFamily: 'Heebo, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            marginTop: 'auto',
          }}>
            <Icon name="check" size={16} color="#fff" strokeWidth={2.5} />
            {saving ? (language === 'he' ? 'שומר...' : 'Saving...') : (language === 'he' ? 'שמור' : 'Save')}
          </button>
        </div>

        {/* ── CARD 2: Preferences ── */}
        <div style={{ ...glass }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(15,141,99,0.15)', border: '1px solid rgba(15,141,99,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="tune" size={16} color="#0f8d63" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'העדפות' : 'Preferences'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'שפה ועיצוב' : 'Language & theme'}</div>
            </div>
          </div>

          {/* Language */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {language === 'he' ? 'שפה' : 'Language'}
            </div>
            <ToggleGroup
              value={pendingLang}
              onChange={setPendingLang}
              options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]}
            />
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', fontWeight: '600' }}>
              {pendingLang === 'he' ? 'האתר יוצג בכיוון ימין לשמאל' : 'Site will display left to right'}
            </div>
          </div>

          {/* Theme */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {language === 'he' ? 'עיצוב' : 'Theme'}
            </div>
            <ToggleGroup
              value={pendingTheme}
              onChange={setPendingTheme}
              options={[{ value: 'dark', label: language === 'he' ? 'כהה' : 'Dark' }, { value: 'light', label: language === 'he' ? 'בהיר' : 'Light' }]}
            />
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', fontWeight: '600' }}>
              {pendingTheme === 'dark'
                ? (language === 'he' ? 'עיצוב כהה' : 'Dark mode')
                : (language === 'he' ? 'עיצוב בהיר' : 'Light mode')}
            </div>
          </div>

          <button onClick={handleSavePreferences} disabled={savingPrefs} style={{
            width: '100%', background: '#0f8d63',
            color: '#fff', border: 'none', borderRadius: '12px', padding: '11px',
            fontSize: '14px', fontWeight: '700',
            cursor: savingPrefs ? 'wait' : 'pointer',
            opacity: savingPrefs ? 0.7 : 1,
            fontFamily: 'Heebo, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            marginTop: 'auto',
          }}>
            <Icon name="check" size={16} color="#fff" strokeWidth={2.5} />
            {savingPrefs ? (language === 'he' ? 'שומר...' : 'Saving...') : (language === 'he' ? 'שמור' : 'Save')}
          </button>
        </div>

        {/* ── CARD 3: Subscription ── */}
        <div style={{
          ...glass, position: 'relative', overflow: 'hidden',
          border: isPro ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(15,141,99,0.15)',
          background: isPro
            ? (isLight ? '#fffbeb' : 'rgba(245,158,11,0.04)')
            : glass.background,
        }}>
          <div style={{ position: 'absolute', top: '-40px', [language === 'he' ? 'left' : 'right']: '-40px', width: '150px', height: '150px', background: isPro ? 'rgba(245,158,11,0.08)' : 'rgba(15,141,99,0.06)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: isPro ? 'rgba(245,158,11,0.15)' : 'rgba(15,141,99,0.15)', border: `1px solid ${isPro ? 'rgba(245,158,11,0.3)' : 'rgba(15,141,99,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="workspace_premium" size={16} color={isPro ? '#f59e0b' : '#0f8d63'} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'הגדרות מנוי' : 'Subscription'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוכנית וחיוב' : 'Plan & billing'}</div>
            </div>
          </div>

          {/* Current plan badge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: isPro ? 'rgba(245,158,11,0.1)' : 'rgba(15,141,99,0.08)',
            border: `1px solid ${isPro ? 'rgba(245,158,11,0.25)' : 'rgba(15,141,99,0.2)'}`,
            borderRadius: '14px', padding: '14px 16px', marginBottom: '20px',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: isPro ? 'rgba(245,158,11,0.7)' : 'rgba(15,141,99,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                {language === 'he' ? 'תוכנית נוכחית' : 'Current plan'}
              </div>
              <div style={{ fontSize: '23px', fontWeight: '900', color: isPro ? '#f59e0b' : '#0f8d63', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isPro ? 'PRO' : (language === 'he' ? 'חינמי' : 'Free')}
                {isPro && <span style={{ fontSize: '13px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '999px', padding: '2px 8px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="bolt" size={12} color="#f59e0b" /> {planPeriodLabel}</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '600', marginTop: '2px' }}>
                {planPriceLabel}
              </div>
            </div>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: isPro ? 'rgba(245,158,11,0.12)' : 'rgba(15,141,99,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={isPro ? 'bolt' : 'verified'} size={22} color={isPro ? '#f59e0b' : '#0f8d63'} />
            </div>
          </div>

          {/* CTA — pinned to bottom for symmetric card heights */}
          {isPro && (
            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.18)',
                border: `1px solid ${isCanceledButActive ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)'}`,
                borderRadius: '14px',
                padding: '13px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {primaryBillingLabel}
                  </span>
                  <Icon name={isCanceledButActive ? 'event_busy' : 'event_repeat'} size={15} color={isCanceledButActive ? '#ef4444' : '#f59e0b'} />
                </div>
                <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: '850', lineHeight: 1.35 }}>
                  {formatBillingDate(primaryBillingDate)}
                </div>
              </div>

              <div style={{
                background: isLight ? 'rgba(255,255,255,0.56)' : 'rgba(255,255,255,0.035)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '13px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {remainingLabel}
                  </span>
                  <Icon name="timer" size={15} color="#0f8d63" />
                </div>
                <div dir={language === 'he' ? 'rtl' : 'ltr'} style={{ fontSize: '22px', color: '#0f8d63', fontWeight: '950', lineHeight: 1 }}>
                  {syncingBilling
                    ? (language === 'he' ? 'מעדכן...' : 'Updating...')
                    : formatRemainingTime(primaryBillingDate)}
                </div>
                {isCanceledButActive && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#ef4444', fontWeight: '700', lineHeight: 1.45 }}>
                    {language === 'he'
                      ? 'המנוי בוטל, אבל הגישה ל-PRO נשארת עד סוף התקופה ששולמה.'
                      : 'Subscription is canceled, but PRO access remains until the paid period ends.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {isPro ? (
            isCanceledButActive ? (
              isCanceledYearlyButActive ? (
                <div style={{
                  marginTop: 'auto',
                  background: isLight ? 'rgba(255,255,255,0.74)' : 'rgba(245,158,11,0.055)',
                  border: '1px solid rgba(245,158,11,0.26)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'grid',
                  gap: '8px',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '950', color: '#f59e0b' }}>
                    {language === 'he' ? 'מנוי שנתי מבוטל' : 'Canceled yearly plan'}
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text3)', fontWeight: '700' }}>
                    {language === 'he'
                      ? 'המנוי השנתי שלך כבר שולם ויישאר פעיל עד סוף התקופה. אפשר לבצע חידוש או מעבר לתוכנית אחרת רק אחרי שהתוקף השנתי יסתיים.'
                      : 'Your yearly plan is already paid and remains active until the period ends. Renewal or plan changes will be available only after the yearly access expires.'}
                  </div>
                </div>
              ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: 'auto' }}>
                <button
                  onClick={() => handleResumePro('monthly')}
                  disabled={Boolean(resumingPro)}
                  style={{ width: '100%', minHeight: '70px', background: 'linear-gradient(135deg, #0f8d63 0%, #12a875 100%)', border: '1px solid rgba(31,210,145,0.55)', borderRadius: '16px', padding: '12px', color: '#fff', cursor: resumingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: resumingPro ? 0.65 : 1, boxShadow: '0 12px 28px rgba(15,141,99,0.28), inset 0 1px 0 rgba(255,255,255,0.18)' }}
                  onMouseOver={e => { if (!resumingPro) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 34px rgba(15,141,99,0.38), inset 0 1px 0 rgba(255,255,255,0.22)' } }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(15,141,99,0.28), inset 0 1px 0 rgba(255,255,255,0.18)' }}
                >
                  <span style={{ width: '28px', height: '28px', borderRadius: '10px', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="autorenew" size={16} color="#fff" />
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '900', lineHeight: 1.1 }}>
                    {resumingPro === 'monthly'
                      ? (language === 'he' ? 'מחדש...' : 'Resuming...')
                      : (language === 'he' ? 'חדש חודשי' : 'Monthly')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '750', opacity: 0.78, lineHeight: 1 }}>
                    {language === 'he' ? '$20 / חודש' : '$20 / mo'}
                  </span>
                </button>
                <button
                  onClick={() => handleResumePro('yearly')}
                  disabled={Boolean(resumingPro)}
                  style={{ width: '100%', minHeight: '70px', background: 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(245,158,11,0.08) 100%)', border: '1px solid rgba(245,158,11,0.52)', borderRadius: '16px', padding: '12px', color: '#f59e0b', cursor: resumingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: resumingPro ? 0.65 : 1, boxShadow: '0 12px 28px rgba(245,158,11,0.16), inset 0 1px 0 rgba(255,255,255,0.10)', position: 'relative', overflow: 'hidden' }}
                  onMouseOver={e => { if (!resumingPro) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 34px rgba(245,158,11,0.24), inset 0 1px 0 rgba(255,255,255,0.14)' } }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(245,158,11,0.16), inset 0 1px 0 rgba(255,255,255,0.10)' }}
                >
                  <span style={{ position: 'absolute', top: '7px', insetInlineEnd: '7px', padding: '2px 6px', borderRadius: '999px', background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.28)', fontSize: '9px', fontWeight: '900', lineHeight: 1 }}>
                    {language === 'he' ? 'חסכון' : 'Save'}
                  </span>
                  <span style={{ width: '28px', height: '28px', borderRadius: '10px', background: 'rgba(245,158,11,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="calendar_month" size={16} color="#f59e0b" />
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '900', lineHeight: 1.1 }}>
                    {resumingPro === 'yearly'
                      ? (language === 'he' ? 'מעביר...' : 'Switching...')
                      : (language === 'he' ? 'חדש שנתי' : 'Yearly')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '750', opacity: 0.78, lineHeight: 1 }}>
                    {language === 'he' ? '$199 / שנה' : '$199 / yr'}
                  </span>
                </button>
              </div>
              )
            ) : (
              <>
              {!isYearlyPlan && (
              <button
                onClick={() => setShowYearlySwitchConfirm(true)}
                disabled={Boolean(resumingPro)}
                style={{ width: '100%', minHeight: '66px', background: 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(245,158,11,0.08) 100%)', border: '1px solid rgba(245,158,11,0.52)', borderRadius: '16px', padding: '12px 14px', color: '#f59e0b', cursor: resumingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', opacity: resumingPro ? 0.65 : 1, boxShadow: '0 12px 28px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.10)', marginTop: 'auto', marginBottom: '10px' }}
                onMouseOver={e => { if (!resumingPro) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 34px rgba(245,158,11,0.24), inset 0 1px 0 rgba(255,255,255,0.14)' } }}
                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.10)' }}
              >
                <span style={{ display: 'grid', gap: '4px', textAlign: language === 'he' ? 'right' : 'left' }}>
                  <span style={{ fontSize: '14px', fontWeight: '950', lineHeight: 1.1 }}>
                    {resumingPro === 'yearly'
                      ? (language === 'he' ? 'מעביר לשנתי...' : 'Switching to yearly...')
                      : (language === 'he' ? 'החלף למנוי שנתי' : 'Switch to yearly')}
                  </span>
                  <span style={{ fontSize: '11px', color: isLight ? '#92400e' : 'rgba(245,158,11,0.78)', fontWeight: '750', lineHeight: 1.25 }}>
                    {language === 'he' ? 'חיוב יחסי עכשיו • $199/שנה בחידוש הבא' : 'Prorated now • $199/yr next renewal'}
                  </span>
                </span>
                <span style={{ minWidth: '34px', height: '34px', borderRadius: '12px', background: 'rgba(245,158,11,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="calendar_month" size={18} color="#f59e0b" />
                </span>
              </button>
              )}
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelingPro}
                style={{ width: '100%', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '700', color: 'rgba(239,68,68,0.7)', cursor: cancelingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: cancelingPro ? 0.6 : 1, marginTop: 'auto' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.04)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = 'rgba(239,68,68,0.7)'; e.currentTarget.style.background = 'transparent' }}
              >
                <Icon name="cancel" size={15} />
                {cancelingPro ? (language === 'he' ? 'מבטל...' : 'Canceling...') : (language === 'he' ? 'בטל מנוי' : 'Cancel subscription')}
              </button>
              </>
            )
          ) : (
            <Link href="/upgrade" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', background: '#f59e0b',
              color: '#fff', border: 'none', borderRadius: '12px', padding: '11px',
              fontSize: '14px', fontWeight: '800', textDecoration: 'none',
              transition: 'all 0.15s',
              marginTop: 'auto',
            }}
              onMouseOver={(e: any) => { e.currentTarget.style.opacity = '0.9' }}
              onMouseOut={(e: any) => { e.currentTarget.style.opacity = '1' }}
            >
              <Icon name="bolt" size={16} />
              {language === 'he' ? 'שדרג ל PRO — $20/חודש' : 'Upgrade to PRO — $20/mo'}
            </Link>
          )}
        </div>
      </div>

      {/* Cancel subscription confirmation modal */}
      {showCancelConfirm && (
        <div className="app-modal-overlay" onClick={() => setShowCancelConfirm(false)} style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '24px', padding: '36px 32px', maxWidth: '420px', width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="warning" size={26} color="#ef4444" />
            </div>
            <div style={{ fontSize: '19px', fontWeight: '800', color: 'var(--text)', marginBottom: '12px' }}>
              {language === 'he' ? 'ביטול מנוי' : 'Cancel subscription'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text3)', lineHeight: 1.7, marginBottom: '28px' }}>
              {language === 'he'
                ? 'החיובים העתידיים יבוטלו עכשיו. הגישה שלך ל-PRO תישאר עד סוף התקופה שכבר שולמה, והנתונים שלך באתר לא יימחקו.'
                : 'Future billing will be canceled now. Your PRO access stays active until the paid period ends, and your site data will not be deleted.'}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '700', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
              >
                {language === 'he' ? 'חזור' : 'Go back'}
              </button>
              <button
                onClick={handleCancelPro}
                style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '700', color: '#ef4444', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
              >
                {language === 'he' ? 'אישור ביטול' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch to yearly confirmation modal */}
      {showYearlySwitchConfirm && (
        <div className="app-modal-overlay" onClick={() => setShowYearlySwitchConfirm(false)} style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" style={{ background: 'var(--bg2)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: '24px', padding: '34px 30px', maxWidth: '440px', width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ width: '58px', height: '58px', borderRadius: '18px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="calendar_month" size={28} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text)', marginBottom: '12px' }}>
              {language === 'he' ? 'מעבר למנוי שנתי' : 'Switch to yearly'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text3)', lineHeight: 1.75, marginBottom: '18px' }}>
              {language === 'he'
                ? 'המעבר יתבצע עכשיו. Lemon Squeezy יחשב חיוב יחסי לפי הזמן והקרדיט שנשארו במנוי החודשי. לאחר מכן המנוי יתחדש כמנוי שנתי במחיר $199 לשנה.'
                : 'The switch will happen now. Lemon Squeezy will calculate the prorated charge based on the time and credit left on the monthly plan. After that, the subscription renews yearly at $199/year.'}
            </div>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '12px 14px', color: '#f59e0b', fontSize: '13px', fontWeight: '800', lineHeight: 1.45, marginBottom: '26px' }}>
              {language === 'he'
                ? 'החיוב המדויק מחושב על ידי Lemon Squeezy ויופיע בחשבונית.'
                : 'The exact amount is calculated by Lemon Squeezy and will appear on the invoice.'}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowYearlySwitchConfirm(false)}
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '750', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}
              >
                {language === 'he' ? 'חזור' : 'Go back'}
              </button>
              <button
                onClick={() => handleResumePro('yearly', 'https://tradeix.vercel.app/settings')}
                disabled={Boolean(resumingPro)}
                style={{ flex: 1, background: '#f59e0b', border: '1px solid rgba(245,158,11,0.55)', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '850', color: '#fff', cursor: resumingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', opacity: resumingPro ? 0.65 : 1 }}
              >
                {resumingPro === 'yearly'
                  ? (language === 'he' ? 'מעביר...' : 'Switching...')
                  : (language === 'he' ? 'אשר מעבר' : 'Confirm switch')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .settings-grid > div { min-width: 0; }
        @media (max-width: 1024px) { .settings-grid { grid-template-columns: 1fr !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
