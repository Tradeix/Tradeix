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
  is_admin?: boolean | null
}

export default function SettingsPage() {
  const { theme, language, setTheme, setLanguage, isPro: contextIsPro, isAdmin: contextIsAdmin, upgradeToPro, cancelSubscription, resumeSubscription } = useApp()
  const [user, setUser] = useState<any>(null)
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null)
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelingPro, setCancelingPro] = useState(false)
  const [resumingPro, setResumingPro] = useState<'monthly' | 'yearly' | null>(null)
  const [upgradingTrial, setUpgradingTrial] = useState<'monthly' | 'yearly' | null>(null)
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

  async function handleTrialUpgrade(billingPeriod: 'monthly' | 'yearly') {
    setUpgradingTrial(billingPeriod)
    try {
      await upgradeToPro(billingPeriod)
    } catch (error: any) {
      toast.error(error?.message || (language === 'he' ? 'שדרוג המנוי נכשל' : 'Subscription upgrade failed'))
    } finally {
      setUpgradingTrial(null)
    }
  }

  const initials = (nickname || user?.email || 'U')[0].toUpperCase()
  const isAdmin = billingProfile?.is_admin === true || contextIsAdmin
  const isPro = isAdmin || (billingProfile?.subscription_tier ? billingProfile.subscription_tier === 'pro' : contextIsPro)
  const renewalDate = billingProfile?.subscription_renews_at || null
  const endsDate = billingProfile?.subscription_ends_at || null
  const trialEndsDate = billingProfile?.subscription_trial_ends_at || null
  const isTemporaryPlan = billingProfile?.subscription_status === 'temporary_trial'
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

  const displayPlanNameLabel = isTemporaryPlan
    ? 'PRO-Trial'
    : isPro
      ? 'PRO'
      : (language === 'he' ? 'חינמי' : 'Free')
  const displayPlanAccent = isTemporaryPlan ? '#ef4444' : isPro ? '#f59e0b' : '#0f8d63'
  const displayPlanPriceLabel = isTemporaryPlan ? (language === 'he' ? 'חינם' : 'Free') : planPriceLabel
  const displayPrimaryBillingLabel = isTemporaryPlan ? (language === 'he' ? 'סיום ניסיון' : 'Trial ends') : primaryBillingLabel
  const displayRemainingLabel = isTemporaryPlan ? (language === 'he' ? 'זמן שנותר לניסיון' : 'Trial time left') : remainingLabel

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
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: '20px', marginBottom: '20px', alignItems: 'stretch' }} className="settings-grid">

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
        {!isAdmin && (
        <div style={{
          ...glass, position: 'relative', overflow: 'hidden',
          border: isTemporaryPlan ? '1px solid rgba(239,68,68,0.32)' : isPro ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(15,141,99,0.15)',
          background: isPro
            ? isTemporaryPlan ? (isLight ? '#fff1f2' : 'rgba(239,68,68,0.04)') : (isLight ? '#fffbeb' : 'rgba(245,158,11,0.04)')
            : glass.background,
        }}>
          <div style={{ position: 'absolute', top: 0, insetInlineStart: 0, insetInlineEnd: 0, height: '1px', background: isTemporaryPlan ? 'rgba(239,68,68,0.34)' : isPro ? 'rgba(245,158,11,0.34)' : 'rgba(15,141,99,0.24)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: isTemporaryPlan ? 'rgba(239,68,68,0.15)' : isPro ? 'rgba(245,158,11,0.15)' : 'rgba(15,141,99,0.15)', border: `1px solid ${isTemporaryPlan ? 'rgba(239,68,68,0.3)' : isPro ? 'rgba(245,158,11,0.3)' : 'rgba(15,141,99,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="workspace_premium" size={16} color={displayPlanAccent} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'הגדרות מנוי' : 'Subscription'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוכנית וחיוב' : 'Plan & billing'}</div>
            </div>
          </div>

          {/* Current plan badge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: isTemporaryPlan ? 'rgba(239,68,68,0.1)' : isPro ? 'rgba(245,158,11,0.1)' : 'rgba(15,141,99,0.08)',
            border: `1px solid ${isTemporaryPlan ? 'rgba(239,68,68,0.26)' : isPro ? 'rgba(245,158,11,0.25)' : 'rgba(15,141,99,0.2)'}`,
            borderRadius: '12px', padding: '12px 14px', marginBottom: '14px',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: isTemporaryPlan ? '#ef4444' : isPro ? 'rgba(245,158,11,0.7)' : 'rgba(15,141,99,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                {language === 'he' ? 'תוכנית נוכחית' : 'Current plan'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: displayPlanAccent, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {displayPlanNameLabel}
                {isPro && !isTemporaryPlan && <span style={{ fontSize: '13px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '999px', padding: '2px 8px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="bolt" size={12} color="#f59e0b" /> {planPeriodLabel}</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '600', marginTop: '2px' }}>
                {displayPlanPriceLabel}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: isTemporaryPlan ? 'rgba(239,68,68,0.1)' : isPro ? 'rgba(245,158,11,0.1)' : 'rgba(15,141,99,0.08)', border: `1px solid ${isTemporaryPlan ? 'rgba(239,68,68,0.18)' : isPro ? 'rgba(245,158,11,0.18)' : 'rgba(15,141,99,0.14)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={isPro ? 'bolt' : 'verified'} size={19} color={displayPlanAccent} />
            </div>
          </div>

          {/* CTA — pinned to bottom for symmetric card heights */}
          {isPro && (
            <div style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
              <div style={{
                background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.18)',
                border: `1px solid ${isCanceledButActive ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.22)'}`,
                borderRadius: '12px',
                padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {displayPrimaryBillingLabel}
                  </span>
                  <Icon name={isCanceledButActive ? 'event_busy' : 'event_repeat'} size={15} color={isCanceledButActive ? '#ef4444' : '#f59e0b'} />
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '850', lineHeight: 1.35 }}>
                  {formatBillingDate(primaryBillingDate)}
                </div>
              </div>

              <div style={{
                background: isLight ? 'rgba(255,255,255,0.56)' : 'rgba(255,255,255,0.035)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {displayRemainingLabel}
                  </span>
                  <Icon name="timer" size={15} color="#0f8d63" />
                </div>
                <div dir={language === 'he' ? 'rtl' : 'ltr'} style={{ fontSize: '20px', color: '#0f8d63', fontWeight: '950', lineHeight: 1 }}>
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
            isTemporaryPlan ? (
              <div className="plan-choice-grid">
                <button
                  className="plan-choice-btn plan-choice-btn--monthly"
                  onClick={() => handleTrialUpgrade('monthly')}
                  disabled={Boolean(upgradingTrial)}
                  style={{ width: '100%', minHeight: '76px', background: 'linear-gradient(135deg, #0f8d63 0%, #12a875 100%)', border: '1px solid rgba(31,210,145,0.55)', borderRadius: '16px', padding: '12px', color: '#fff', cursor: upgradingTrial ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: upgradingTrial ? 0.65 : 1, boxShadow: '0 12px 28px rgba(15,141,99,0.28)' }}
                >
                  <Icon name="bolt" size={18} color="#fff" />
                  <span style={{ fontSize: '13px', fontWeight: '900', lineHeight: 1.1 }}>
                    {upgradingTrial === 'monthly' ? (language === 'he' ? 'פותח...' : 'Opening...') : (language === 'he' ? 'התחל חודשי' : 'Start monthly')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '750', opacity: 0.86, lineHeight: 1 }}>
                    {language === 'he' ? 'גמיש • $20 לחודש' : 'Flexible • $20/month'}
                  </span>
                </button>
                <button
                  className="plan-choice-btn plan-choice-btn--yearly"
                  onClick={() => handleTrialUpgrade('yearly')}
                  disabled={Boolean(upgradingTrial)}
                  style={{ width: '100%', minHeight: '76px', background: 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0.09) 100%)', border: '1px solid rgba(245,158,11,0.52)', borderRadius: '16px', padding: '12px', color: '#f59e0b', cursor: upgradingTrial ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: upgradingTrial ? 0.65 : 1, boxShadow: '0 12px 28px rgba(245,158,11,0.16)' }}
                >
                  <Icon name="calendar_month" size={18} color="#f59e0b" />
                  <span style={{ fontSize: '13px', fontWeight: '900', lineHeight: 1.1 }}>
                    {upgradingTrial === 'yearly' ? (language === 'he' ? 'פותח...' : 'Opening...') : (language === 'he' ? 'קח שנתי וחסוך' : 'Go yearly and save')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '750', opacity: 0.86, lineHeight: 1 }}>
                    {language === 'he' ? 'חסוך $41 • $199 לשנה' : 'Save $41 • $199/year'}
                  </span>
                </button>
              </div>
            ) : isCanceledButActive ? (
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
              <div className="plan-choice-grid">
                <button
                  className="plan-choice-btn plan-choice-btn--monthly"
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
                      : (language === 'he' ? 'חדש חודשי' : 'Resume monthly')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '750', opacity: 0.78, lineHeight: 1 }}>
                    {language === 'he' ? 'המשך גמיש • $20 לחודש' : 'Flexible • $20/month'}
                  </span>
                </button>
                <button
                  className="plan-choice-btn plan-choice-btn--yearly"
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
                      : (language === 'he' ? 'חדש שנתי וחסוך' : 'Resume yearly and save')}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '750', opacity: 0.78, lineHeight: 1 }}>
                    {language === 'he' ? 'חסוך $41 • $199 לשנה' : 'Save $41 • $199/year'}
                  </span>
                </button>
              </div>
              )
            ) : (
              <>
              {!isYearlyPlan && (
              <button
                className="yearly-switch-cta"
                onClick={() => setShowYearlySwitchConfirm(true)}
                disabled={Boolean(resumingPro)}
                style={{ width: '100%', minHeight: '66px', background: 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(245,158,11,0.08) 100%)', border: '1px solid rgba(245,158,11,0.52)', borderRadius: '16px', padding: '12px 14px', color: '#f59e0b', cursor: resumingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', opacity: resumingPro ? 0.65 : 1, boxShadow: '0 12px 28px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.10)', marginTop: 'auto', marginBottom: '10px' }}
              >
                <span className="yearly-switch-sheen" />
                <span className="yearly-switch-icon">
                  <Icon name="calendar_month" size={20} color="#fff" />
                </span>
                <span className="yearly-switch-copy" style={{ textAlign: language === 'he' ? 'right' : 'left' }}>
                  <span className="yearly-switch-title">
                    {resumingPro === 'yearly'
                      ? (language === 'he' ? 'מעביר לשנתי...' : 'Switching to yearly...')
                      : (language === 'he' ? 'עבור לשנתי וחסוך' : 'Switch yearly and save')}
                  </span>
                  <span className="yearly-switch-subtitle">
                    {language === 'he' ? 'חיוב יחסי עכשיו • $199 לשנה בחידוש הבא' : 'Prorated now • $199/year next renewal'}
                  </span>
                </span>
                <span className="yearly-switch-badge">
                  {language === 'he' ? 'חסוך $41' : 'Save $41'}
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
        )}
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
        .plan-choice-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: auto;
        }
        .plan-choice-btn {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          min-height: 104px !important;
          border-radius: 20px !important;
          padding: 16px 12px !important;
          border-width: 1px !important;
          border-style: solid !important;
          color: #fff !important;
          font-family: Heebo, sans-serif !important;
          cursor: pointer !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          transform: translateY(0);
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease, opacity 0.18s ease !important;
        }
        .plan-choice-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          opacity: 1;
        }
        .plan-choice-btn::after {
          content: "";
          position: absolute;
          inset: 1px;
          z-index: -1;
          border-radius: 19px;
          background:
            radial-gradient(circle at 22% 8%, rgba(255,255,255,0.34), transparent 28%),
            linear-gradient(180deg, rgba(255,255,255,0.16), transparent 56%);
          pointer-events: none;
        }
        .plan-choice-btn--monthly {
          border-color: rgba(52,211,153,0.72) !important;
          background:
            radial-gradient(circle at 50% -24%, rgba(187,247,208,0.42), transparent 44%),
            linear-gradient(135deg, #0f8d63 0%, #16a873 48%, #35c287 100%) !important;
          box-shadow: 0 18px 38px rgba(15,141,99,0.34), inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .plan-choice-btn--yearly {
          border-color: rgba(251,191,36,0.78) !important;
          background:
            radial-gradient(circle at 48% -26%, rgba(253,224,71,0.48), transparent 44%),
            linear-gradient(135deg, #7a4a08 0%, #c27803 48%, #f59e0b 100%) !important;
          box-shadow: 0 18px 38px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .plan-choice-btn:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.015);
          filter: saturate(1.08) brightness(1.04);
        }
        .plan-choice-btn:disabled {
          opacity: 0.65 !important;
          cursor: wait !important;
          transform: none;
        }
        .plan-choice-btn svg {
          width: 23px;
          height: 23px;
          color: #fff !important;
          stroke: #fff !important;
          filter: drop-shadow(0 7px 14px rgba(0,0,0,0.24));
        }
        .plan-choice-btn > svg {
          padding: 8px;
          width: 40px;
          height: 40px;
          border-radius: 14px;
          background: rgba(255,255,255,0.17);
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
        }
        .plan-choice-btn span {
          position: relative;
          z-index: 1;
        }
        .plan-choice-btn > span {
          color: #fff !important;
          text-shadow: 0 2px 10px rgba(0,0,0,0.22);
        }
        .yearly-switch-cta {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          min-height: 76px !important;
          border-radius: 16px !important;
          padding: 14px 16px !important;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.13), transparent 28%),
            linear-gradient(135deg, #8a560a 0%, #c27803 56%, #e99a0a 100%) !important;
          border: 1px solid rgba(251,191,36,0.62) !important;
          color: #fff !important;
          box-shadow:
            0 14px 30px rgba(245,158,11,0.2),
            0 0 0 1px rgba(255,255,255,0.05) inset,
            inset 0 1px 0 rgba(255,255,255,0.18) !important;
          transform: translateY(0);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease !important;
        }
        .yearly-switch-cta::before {
          content: "";
          position: absolute;
          inset-inline-start: 0;
          top: 0;
          bottom: 0;
          width: 5px;
          background: rgba(255,255,255,0.58);
          opacity: 0.86;
        }
        .yearly-switch-cta:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          filter: saturate(1.06) brightness(1.03);
          box-shadow:
            0 20px 38px rgba(245,158,11,0.28),
            0 0 0 1px rgba(255,255,255,0.09) inset,
            inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .yearly-switch-cta:disabled {
          cursor: wait !important;
          opacity: 0.68 !important;
          transform: none !important;
        }
        .yearly-switch-sheen {
          position: absolute;
          inset: 0 auto 0 -34%;
          width: 24%;
          transform: skewX(-14deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          opacity: 0;
          pointer-events: none;
        }
        .yearly-switch-cta:hover:not(:disabled) .yearly-switch-sheen {
          animation: yearlySheen 0.78s ease forwards;
        }
        .yearly-switch-icon {
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255,255,255,0.13);
          border: 1px solid rgba(255,255,255,0.16);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .yearly-switch-icon svg {
          stroke: #fff !important;
          filter: drop-shadow(0 8px 14px rgba(0,0,0,0.24));
        }
        .yearly-switch-copy {
          display: grid;
          gap: 5px;
          flex: 1 1 auto;
          min-width: 0;
        }
        .yearly-switch-title {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          line-height: 1.05;
          text-shadow: 0 2px 12px rgba(0,0,0,0.22);
        }
        .yearly-switch-subtitle {
          color: rgba(255,255,255,0.82);
          font-size: 11px;
          font-weight: 850;
          line-height: 1.25;
        }
        .yearly-switch-badge {
          flex: 0 0 auto;
          border-radius: 10px;
          padding: 5px 8px;
          color: #fff;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          font-size: 10px;
          font-weight: 950;
          white-space: nowrap;
        }
        @media (max-width: 1024px) { .settings-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 520px) {
          .plan-choice-grid { grid-template-columns: 1fr; }
          .yearly-switch-cta { align-items: stretch !important; }
          .yearly-switch-badge { align-self: center; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes yearlySheen {
          0% { left: -46%; opacity: 0; }
          18% { opacity: 1; }
          100% { left: 118%; opacity: 0; }
        }
      `}</style>
    </div>
  )
}
