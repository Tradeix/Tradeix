'use client'

import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '@/lib/app-context'
import type { AppTimezone, Currency } from '@/lib/app-context'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Icon from '@/components/Icon'
import PortfolioSettings from '@/components/PortfolioSettings'

type BillingProfile = {
  subscription_tier: 'free' | 'pro' | null
  subscription_status: string | null
  subscription_renews_at: string | null
  subscription_ends_at: string | null
  subscription_trial_ends_at: string | null
  subscription_billing_period?: 'monthly' | 'yearly' | null
  is_admin?: boolean | null
}

type SettingsSection = 'profile' | 'preferences' | 'support' | 'subscription' | 'portfolios'
type SupportCategory = 'billing' | 'renewal' | 'bug' | 'not_working' | 'other'

const SUPPORT_CATEGORY_OPTIONS: { value: SupportCategory; he: string; en: string }[] = [
  { value: 'billing', he: 'בעיית תשלום', en: 'Payment issue' },
  { value: 'renewal', he: 'חידוש מנוי', en: 'Subscription renewal' },
  { value: 'bug', he: 'באג באתר', en: 'Site bug' },
  { value: 'not_working', he: 'משהו לא עובד', en: 'Something is not working' },
  { value: 'other', he: 'אחר', en: 'Other' },
]

const TIMEZONE_OPTIONS: { value: AppTimezone; he: string; en: string }[] = [
  { value: 'Asia/Jerusalem', he: 'ישראל - ירושלים', en: 'Israel - Jerusalem' },
  { value: 'UTC', he: 'UTC זמן אוניברסלי', en: 'UTC' },
  { value: 'America/New_York', he: 'ניו יורק', en: 'New York' },
  { value: 'America/Chicago', he: 'שיקגו', en: 'Chicago' },
  { value: 'America/Los_Angeles', he: 'לוס אנג׳לס', en: 'Los Angeles' },
  { value: 'Europe/London', he: 'לונדון', en: 'London' },
  { value: 'Europe/Berlin', he: 'ברלין', en: 'Berlin' },
  { value: 'Asia/Dubai', he: 'דובאי', en: 'Dubai' },
]

export default function SettingsPage() {
  const { theme, language, currency, timezone, setTheme, setLanguage, setCurrency, setTimezone, isPro: contextIsPro, isAdmin: contextIsAdmin, cancelSubscription, resumeSubscription } = useApp()
  const [user, setUser] = useState<any>(null)
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null)
  const [nickname, setNickname] = useState('')
  const [savedNickname, setSavedNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelingPro, setCancelingPro] = useState(false)
  const [resumingPro, setResumingPro] = useState<'monthly' | 'yearly' | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showYearlySwitchConfirm, setShowYearlySwitchConfirm] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [pendingLang, setPendingLang] = useState(language)
  const [pendingTheme, setPendingTheme] = useState(theme)
  const [pendingCurrency, setPendingCurrency] = useState<Currency>(currency)
  const [pendingTimezone, setPendingTimezone] = useState<AppTimezone>(timezone)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [syncingBilling, setSyncingBilling] = useState(false)
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>('profile')
  const [mobileSettingsContentOpen, setMobileSettingsContentOpen] = useState(false)
  const [supportForm, setSupportForm] = useState({
    category: 'bug' as SupportCategory,
    fullName: '',
    email: '',
    message: '',
  })
  const [sendingSupportReport, setSendingSupportReport] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const isLight = theme === 'light'
  const hasAccountChanges = nickname !== savedNickname
  const hasPreferenceChanges = pendingLang !== language || pendingTheme !== theme || pendingCurrency !== currency || pendingTimezone !== timezone

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
      const currentNickname = user?.user_metadata?.full_name || ''
      setNickname(currentNickname)
      setSavedNickname(currentNickname)
      setAvatarUrl(user?.user_metadata?.avatar_url || null)
      setSupportForm(prev => ({
        ...prev,
        fullName: prev.fullName || currentNickname || user?.user_metadata?.name || '',
        email: prev.email || user?.email || '',
      }))

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
    setPendingCurrency(currency)
    setPendingTimezone(timezone)
  }, [language, theme, currency, timezone])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('section') === 'portfolios') {
      setActiveSettingsSection('portfolios')
      setMobileSettingsContentOpen(true)
    }
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
      setSavedNickname(nickname)
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
    const nextCurrency = pendingCurrency
    const nextTimezone = pendingTimezone
    setSavingPrefs(true)
    try {
      if (nextTheme !== theme) await setTheme(nextTheme)
      if (nextLang !== language) await setLanguage(nextLang)
      if (nextCurrency !== currency) await setCurrency(nextCurrency)
      if (nextTimezone !== timezone) await setTimezone(nextTimezone)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      toast.success(nextLang === 'he' ? 'ההעדפות נשמרו בהצלחה' : 'Preferences saved successfully')
    } catch {
      toast.error(nextLang === 'he' ? 'שגיאה בשמירה' : 'Save failed')
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handleSubmitSupportReport() {
    const fullName = supportForm.fullName.trim()
    const email = supportForm.email.trim()
    const message = supportForm.message.trim()

    if (!fullName) {
      toast.error(language === 'he' ? 'נא להזין שם מלא' : 'Please enter your full name')
      return
    }
    if (!email || !email.includes('@')) {
      toast.error(language === 'he' ? 'נא להזין מייל תקין' : 'Please enter a valid email')
      return
    }
    if (message.length < 10) {
      toast.error(language === 'he' ? 'נא לפרט קצת יותר על התקלה' : 'Please add a little more detail')
      return
    }

    setSendingSupportReport(true)
    try {
      const response = await fetch('/api/support/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: supportForm.category,
          fullName,
          email,
          message,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Report failed')

      toast.success(language === 'he' ? 'הדיווח נשלח בהצלחה' : 'Report sent successfully')
      setSupportForm(prev => ({ ...prev, category: 'bug', message: '' }))
    } catch (error: any) {
      toast.error(error?.message || (language === 'he' ? 'שליחת הדיווח נכשלה' : 'Report failed'))
    } finally {
      setSendingSupportReport(false)
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
  const remainingLabel = isCanceledButActive
    ? (language === 'he' ? 'זמן שנותר עד מעבר לחינמי' : 'Time left before moving to Free')
    : (language === 'he' ? 'זמן שנותר עד החידוש' : 'Time left until renewal')

  const displayPlanNameLabel = isTemporaryPlan
    ? 'PRO-Trial'
    : isPro
      ? 'PRO'
      : (language === 'he' ? 'חינמי' : 'Free')
  const displayPlanAccent = isTemporaryPlan ? '#ef4444' : '#0f8d63'
  const displayPlanPriceLabel = isTemporaryPlan ? (language === 'he' ? 'זמני' : 'Temporary') : planPriceLabel
  const displayRemainingLabel = isTemporaryPlan ? (language === 'he' ? 'זמן שנותר לניסיון' : 'Trial time left') : remainingLabel
  const hasPaidProPlan = isPro && !isTemporaryPlan

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

  const ToggleGroup = ({ options, value, onChange }: { options: { value: string; label: string; icon?: string }[]; value: string; onChange: (v: any) => void }) => (
    <div style={{ display: 'flex', gap: '6px' }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: '7px 18px', borderRadius: '10px', fontSize: '13px',
          cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700',
          border: `1px solid ${active ? 'rgba(15,141,99,0.4)' : 'var(--border)'}`,
          background: active ? 'rgba(15,141,99,0.15)' : 'var(--bg3)',
          color: active ? '#0f8d63' : 'var(--text3)',
          transition: 'all 0.2s',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
        }}>
          {opt.icon && <Icon name={opt.icon} size={15} color="currentColor" strokeWidth={2} />}
          <span>{opt.label}</span>
        </button>
        )
      })}
    </div>
  )

  const PreferenceOption = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="preference-option">
      <div className="preference-option-title">
        <span className="preference-option-dot" />
        <span>{title}</span>
      </div>
      <div className="preference-option-control">
        {children}
      </div>
    </div>
  )

  const settingsSections = [
    {
      id: 'profile' as SettingsSection,
      icon: 'person',
      title: language === 'he' ? 'פרופיל' : 'Profile',
      subtitle: language === 'he' ? 'פרטים ותמונה' : 'Details & photo',
      group: language === 'he' ? 'משתמש' : 'User',
    },
    {
      id: 'preferences' as SettingsSection,
      icon: 'tune',
      title: language === 'he' ? 'העדפות' : 'Preferences',
      subtitle: language === 'he' ? 'שפה, עיצוב, מטבע וזמן' : 'Language, theme, currency & time',
      group: language === 'he' ? 'כללי' : 'General',
    },
    {
      id: 'portfolios' as SettingsSection,
      icon: 'cases',
      title: language === 'he' ? 'תיקים' : 'Portfolios',
      subtitle: language === 'he' ? 'ניהול תיקי מסחר' : 'Trading portfolio setup',
      group: language === 'he' ? 'כללי' : 'General',
    },
    {
      id: 'support' as SettingsSection,
      icon: 'support_agent',
      title: language === 'he' ? 'דווח על תקלה' : 'Report an issue',
      subtitle: language === 'he' ? 'תשלום, חידוש, באג או משהו שלא עובד' : 'Billing, renewal, bugs or broken flows',
      group: language === 'he' ? 'כללי' : 'General',
    },
    ...(!isAdmin ? [{
      id: 'subscription' as SettingsSection,
      icon: 'workspace_premium',
      title: language === 'he' ? 'מנוי' : 'Subscription',
      subtitle: language === 'he' ? 'תוכנית וחיוב' : 'Plan & billing',
      group: language === 'he' ? 'משתמש' : 'User',
    }] : []),
  ]

  const groupedSettingsSections = settingsSections.reduce<Record<string, typeof settingsSections>>((groups, section) => {
    groups[section.group] = groups[section.group] || []
    groups[section.group].push(section)
    return groups
  }, {})

  const openSettingsSection = (section: SettingsSection) => {
    setActiveSettingsSection(section)
    setMobileSettingsContentOpen(true)
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href)
      if (section === 'portfolios') nextUrl.searchParams.set('section', 'portfolios')
      else nextUrl.searchParams.delete('section')
      window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}`)
    }
  }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', color: 'var(--text)', minHeight: 'calc(100vh - 140px)', position: 'relative', zIndex: 1 }}>
      <PageHeader
        title={language === 'he' ? 'הגדרות' : 'Settings'}
        subtitle={language === 'he' ? 'ניהול חשבון והעדפות' : 'Account management & preferences'}
        icon="settings"
      />

      <div className={`settings-shell ${mobileSettingsContentOpen ? 'settings-shell--content-open' : ''}`}>
        <aside className="settings-sidebar" aria-label={language === 'he' ? 'תפריט הגדרות' : 'Settings menu'}>
          {Object.entries(groupedSettingsSections).map(([group, sections]) => (
            <div className="settings-menu-group" key={group}>
              <div className="settings-menu-label">
                <Icon name={group === (language === 'he' ? 'משתמש' : 'User') ? 'person' : 'settings'} size={17} color="#8ea0d6" />
                <span>{group}</span>
              </div>
              <div className="settings-menu-list">
                {sections.map(section => {
                  const active = activeSettingsSection === section.id
                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={`settings-menu-item ${active ? 'settings-menu-item--active' : ''}`}
                      onClick={() => openSettingsSection(section.id)}
                    >
                      <span className="settings-menu-item-copy">
                        <span>{section.title}</span>
                        <small>{section.subtitle}</small>
                      </span>
                      <Icon name={language === 'he' ? 'chevron_left' : 'chevron_right'} size={18} color="currentColor" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>

        <div className="settings-content">
          <button type="button" className="settings-back-button" onClick={() => setMobileSettingsContentOpen(false)}>
            <Icon name="chevron_left" size={20} color="currentColor" />
            <span>{language === 'he' ? 'חזרה לתפריט הגדרות' : 'Back to settings menu'}</span>
          </button>

        {/* ── CARD 1: Profile ── */}
        {activeSettingsSection === 'profile' && (
        <div style={{ ...glass }} className="settings-card">
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

          {hasAccountChanges && (
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
          )}
        </div>
        )}

        {/* ── CARD 2: Preferences ── */}
        {activeSettingsSection === 'preferences' && (
        <div style={{ ...glass }} className="settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(15,141,99,0.15)', border: '1px solid rgba(15,141,99,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="tune" size={16} color="#0f8d63" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'העדפות' : 'Preferences'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'שפה, עיצוב וזמן' : 'Language, theme & time'}</div>
            </div>
          </div>

          <PreferenceOption
            title={language === 'he' ? 'שפה' : 'Language'}
          >
            <ToggleGroup
              value={pendingLang}
              onChange={setPendingLang}
              options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]}
            />
          </PreferenceOption>

          <PreferenceOption
            title={language === 'he' ? 'עיצוב' : 'Theme'}
          >
            <ToggleGroup
              value={pendingTheme}
              onChange={setPendingTheme}
              options={[
                { value: 'dark', label: language === 'he' ? 'כהה' : 'Dark', icon: 'dark_mode' },
                { value: 'light', label: language === 'he' ? 'בהיר' : 'Light', icon: 'light_mode' },
              ]}
            />
          </PreferenceOption>

          <PreferenceOption
            title={language === 'he' ? 'מטבע' : 'Currency'}
          >
            <ToggleGroup
              value={pendingCurrency}
              onChange={setPendingCurrency}
              options={[
                { value: 'ILS', label: 'ILS', icon: 'currency_ils' },
                { value: 'USD', label: 'USD', icon: 'currency_usd' },
                { value: 'EUR', label: 'EUR', icon: 'currency_eur' },
              ]}
            />
          </PreferenceOption>

          <PreferenceOption
            title={language === 'he' ? 'אזור זמן' : 'Timezone'}
          >
            <select
              className="timezone-select"
              value={pendingTimezone}
              onChange={e => setPendingTimezone(e.target.value as AppTimezone)}
              aria-label={language === 'he' ? 'אזור זמן' : 'Timezone'}
            >
              {TIMEZONE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {language === 'he' ? option.he : option.en}
                </option>
              ))}
            </select>
          </PreferenceOption>

          {hasPreferenceChanges && (
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
          )}
        </div>
        )}

        {/* ── CARD 3: Subscription ── */}
        {activeSettingsSection === 'support' && (
        <div style={{ ...glass }} className="settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(15,141,99,0.15)', border: '1px solid rgba(15,141,99,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="support_agent" size={16} color="#0f8d63" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'דווח על תקלה' : 'Report an issue'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תשלום, חידוש, באג או משהו שלא עובד' : 'Billing, renewal, bugs or broken flows'}</div>
            </div>
          </div>

          <div className="support-form">
            <label className="support-field support-field--full">
              <span>{language === 'he' ? 'סוג התקלה' : 'Issue type'}</span>
              <select
                className="settings-input"
                value={supportForm.category}
                onChange={e => setSupportForm(prev => ({ ...prev, category: e.target.value as SupportCategory }))}
              >
                {SUPPORT_CATEGORY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {language === 'he' ? option.he : option.en}
                  </option>
                ))}
              </select>
            </label>

            <label className="support-field">
              <span>{language === 'he' ? 'שם מלא' : 'Full name'}</span>
              <input
                className="settings-input"
                value={supportForm.fullName}
                onChange={e => setSupportForm(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder={language === 'he' ? 'השם שלך' : 'Your name'}
              />
            </label>

            <label className="support-field">
              <span>{language === 'he' ? 'מייל לחזרה' : 'Reply email'}</span>
              <input
                className="settings-input"
                type="email"
                value={supportForm.email}
                onChange={e => setSupportForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="name@email.com"
              />
            </label>

            <label className="support-field support-field--full">
              <span>{language === 'he' ? 'פירוט התקלה' : 'Issue details'}</span>
              <textarea
                className="settings-input support-textarea"
                value={supportForm.message}
                onChange={e => setSupportForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder={language === 'he' ? 'כתוב כאן מה קרה, באיזה עמוד, ומה ניסית לעשות...' : 'Tell us what happened, where it happened, and what you tried to do...'}
              />
            </label>
          </div>

          <button onClick={handleSubmitSupportReport} disabled={sendingSupportReport} style={{
            width: '100%', background: '#0f8d63',
            color: '#fff', border: 'none', borderRadius: '12px', padding: '11px',
            fontSize: '14px', fontWeight: '700',
            cursor: sendingSupportReport ? 'wait' : 'pointer',
            opacity: sendingSupportReport ? 0.7 : 1,
            fontFamily: 'Heebo, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            marginTop: '16px',
          }}>
            <Icon name="support_agent" size={16} color="#fff" strokeWidth={2.5} />
            {sendingSupportReport ? (language === 'he' ? 'שולח...' : 'Sending...') : (language === 'he' ? 'שליחת דיווח' : 'Send report')}
          </button>
        </div>
        )}

        {activeSettingsSection === 'portfolios' && (
        <div style={{ ...glass }} className="settings-card settings-card--wide">
          <PortfolioSettings embedded />
        </div>
        )}

        {!isAdmin && activeSettingsSection === 'subscription' && (
        <div style={{
          ...glass, position: 'relative', overflow: 'hidden',
        }} className="settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(15,141,99,0.15)', border: '1px solid rgba(15,141,99,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="workspace_premium" size={16} color="#0f8d63" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{language === 'he' ? 'הגדרות מנוי' : 'Subscription'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוכנית וחיוב' : 'Plan & billing'}</div>
            </div>
          </div>

          {/* Current plan badge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: isTemporaryPlan ? 'rgba(239,68,68,0.1)' : 'rgba(15,141,99,0.08)',
            border: `1px solid ${isTemporaryPlan ? 'rgba(239,68,68,0.26)' : 'rgba(15,141,99,0.2)'}`,
            borderRadius: '12px', padding: '12px 14px', marginBottom: '14px',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: isTemporaryPlan ? '#ef4444' : 'rgba(15,141,99,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                {language === 'he' ? 'תוכנית נוכחית' : 'Current plan'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: displayPlanAccent, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {displayPlanNameLabel}
                {isPro && !isTemporaryPlan && <span style={{ fontSize: '13px', background: 'rgba(15,141,99,0.15)', border: '1px solid rgba(15,141,99,0.3)', borderRadius: '999px', padding: '2px 8px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0f8d63' }}><Icon name="bolt" size={12} color="#0f8d63" /> {planPeriodLabel}</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '600', marginTop: '2px' }}>
                {displayPlanPriceLabel}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: isTemporaryPlan ? 'rgba(239,68,68,0.1)' : 'rgba(15,141,99,0.08)', border: `1px solid ${isTemporaryPlan ? 'rgba(239,68,68,0.18)' : 'rgba(15,141,99,0.14)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={isPro ? 'bolt' : 'verified'} size={19} color={displayPlanAccent} />
            </div>
          </div>

          {/* Time remaining — shown for paid PRO and PRO-Trial */}
          {isPro && (
            <div style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
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

          {hasPaidProPlan ? (
            isCanceledButActive ? (
              !isCanceledYearlyButActive ? (
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
                  style={{ width: '100%', minHeight: '70px', background: 'linear-gradient(135deg, rgba(15,141,99,0.20) 0%, rgba(15,141,99,0.08) 100%)', border: '1px solid rgba(16,185,129,0.52)', borderRadius: '16px', padding: '12px', color: '#0f8d63', cursor: resumingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: resumingPro ? 0.65 : 1, boxShadow: '0 12px 28px rgba(15,141,99,0.16), inset 0 1px 0 rgba(255,255,255,0.10)', position: 'relative', overflow: 'hidden' }}
                  onMouseOver={e => { if (!resumingPro) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 34px rgba(15,141,99,0.24), inset 0 1px 0 rgba(255,255,255,0.14)' } }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(15,141,99,0.16), inset 0 1px 0 rgba(255,255,255,0.10)' }}
                >
                  <span style={{ position: 'absolute', top: '7px', insetInlineEnd: '7px', padding: '2px 6px', borderRadius: '999px', background: 'rgba(15,141,99,0.18)', border: '1px solid rgba(15,141,99,0.28)', fontSize: '9px', fontWeight: '900', lineHeight: 1 }}>
                    {language === 'he' ? 'חסכון' : 'Save'}
                  </span>
                  <span style={{ width: '28px', height: '28px', borderRadius: '10px', background: 'rgba(15,141,99,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="calendar_month" size={16} color="#0f8d63" />
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
              ) : null
            ) : (
              <>
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
              width: '100%', background: '#0f8d63',
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
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" style={{ background: 'var(--bg2)', border: '1px solid rgba(15,141,99,0.28)', borderRadius: '24px', padding: '34px 30px', maxWidth: '440px', width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ width: '58px', height: '58px', borderRadius: '18px', background: 'rgba(15,141,99,0.12)', border: '1px solid rgba(15,141,99,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="calendar_month" size={28} color="#0f8d63" />
            </div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text)', marginBottom: '12px' }}>
              {language === 'he' ? 'מעבר למנוי שנתי' : 'Switch to yearly'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text3)', lineHeight: 1.75, marginBottom: '18px' }}>
              {language === 'he'
                ? 'המעבר יתבצע עכשיו. Lemon Squeezy יחשב חיוב יחסי לפי הזמן והקרדיט שנשארו במנוי החודשי. לאחר מכן המנוי יתחדש כמנוי שנתי במחיר $199 לשנה.'
                : 'The switch will happen now. Lemon Squeezy will calculate the prorated charge based on the time and credit left on the monthly plan. After that, the subscription renews yearly at $199/year.'}
            </div>
            <div style={{ background: 'rgba(15,141,99,0.08)', border: '1px solid rgba(15,141,99,0.2)', borderRadius: '14px', padding: '12px 14px', color: '#0f8d63', fontSize: '13px', fontWeight: '800', lineHeight: 1.45, marginBottom: '26px' }}>
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
                style={{ flex: 1, background: '#0f8d63', border: '1px solid rgba(16,185,129,0.55)', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '850', color: '#fff', cursor: resumingPro ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', opacity: resumingPro ? 0.65 : 1 }}
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
        .settings-shell {
          display: grid;
          grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
          margin-bottom: 20px;
        }
        .settings-sidebar {
          position: sticky;
          top: 92px;
          display: grid;
          gap: 22px;
          min-width: 0;
          padding: 18px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012));
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: 0 16px 38px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .settings-menu-group {
          display: grid;
          gap: 12px;
        }
        .settings-menu-group:not(:last-child) {
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(142,160,214,0.14);
        }
        .settings-menu-label {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 2px 2px;
          color: #9aa9e6;
          font-size: 12.5px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-shadow: 0 0 18px rgba(142,160,214,0.16);
        }
        .settings-menu-label::after {
          content: "";
          flex: 1 1 auto;
          height: 1px;
          background: linear-gradient(90deg, rgba(142,160,214,0.34), transparent);
          opacity: 0.88;
        }
        [dir="rtl"] .settings-menu-label::after {
          background: linear-gradient(270deg, rgba(142,160,214,0.34), transparent);
        }
        .settings-menu-label svg {
          color: #9aa9e6;
          stroke-width: 2;
        }
        .settings-menu-list {
          display: grid;
          gap: 8px;
          overflow: visible;
        }
        .settings-menu-item {
          width: 100%;
          min-height: 48px;
          border: 0;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 4px;
          font-family: Heebo, sans-serif;
          text-align: start;
          position: relative;
          transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
        }
        .settings-menu-item::before {
          content: "";
          position: absolute;
          inset-inline-start: -8px;
          top: 9px;
          bottom: 9px;
          width: 3px;
          background: #0f8d63;
          opacity: 0;
        }
        .settings-menu-item-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .settings-menu-item-copy span {
          font-size: 15px;
          font-weight: 900;
          line-height: 1.05;
        }
        .settings-menu-item-copy small {
          color: var(--text3);
          font-size: 10.5px;
          font-weight: 750;
          line-height: 1.25;
        }
        .settings-menu-item--active {
          color: #0f8d63;
        }
        .settings-menu-item--active::before {
          opacity: 1;
        }
        .settings-menu-item--active .settings-menu-item-copy span {
          color: #0f8d63;
          font-weight: 950;
        }
        .settings-menu-item--active small {
          color: rgba(15,141,99,0.72);
        }
        .settings-content {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .settings-card {
          width: min(100%, 760px) !important;
          max-width: 760px !important;
          min-height: 0 !important;
          height: auto !important;
          padding: 20px !important;
        }
        .settings-card--wide {
          width: min(100%, 980px) !important;
          max-width: 980px !important;
        }
        .settings-back-button {
          display: none;
          align-items: center;
          gap: 8px;
          width: fit-content;
          margin: 0 0 14px;
          margin-right: auto;
          margin-left: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: var(--text);
          font-family: Heebo, sans-serif;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          transition: color 0.16s ease;
        }
        .settings-back-button:hover {
          color: #0f8d63;
        }
        .preference-option {
          margin-bottom: 36px;
          padding: 0;
          border: 0;
          background: transparent;
        }
        .preference-option-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: var(--text);
          font-size: 13px;
          font-weight: 950;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .preference-option-title::after {
          content: "";
          flex: 1 1 auto;
          height: 1px;
          background: linear-gradient(90deg, rgba(15,141,99,0.35), transparent);
          opacity: 0.8;
        }
        [dir="rtl"] .preference-option-title::after {
          background: linear-gradient(270deg, rgba(15,141,99,0.35), transparent);
        }
        .preference-option-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #0f8d63;
          box-shadow: 0 0 0 4px rgba(15,141,99,0.12);
          flex: 0 0 auto;
        }
        .preference-option-control {
          display: flex;
          align-items: center;
        }
        .preference-option-control > div {
          flex-wrap: wrap;
        }
        .timezone-select {
          width: 100%;
          min-height: 48px;
          border-radius: 12px;
          border: 1px solid rgba(15,141,99,0.26);
          background: rgba(255,255,255,0.035);
          color: var(--text);
          padding: 0 14px;
          font-family: Heebo, sans-serif;
          font-size: 14px;
          font-weight: 800;
          outline: none;
          cursor: pointer;
        }
        .timezone-select:focus {
          border-color: rgba(15,141,99,0.58);
          box-shadow: 0 0 0 3px rgba(15,141,99,0.12);
        }
        .timezone-select option {
          background: #070b12;
          color: #f4f7fb;
        }
        .support-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .support-field {
          display: grid;
          gap: 7px;
        }
        .support-field--full {
          grid-column: 1 / -1;
        }
        .support-field span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 850;
        }
        .settings-input {
          width: 100%;
          min-height: 48px;
          border-radius: 12px;
          border: 1px solid rgba(15,141,99,0.24);
          background: rgba(255,255,255,0.035);
          color: var(--text);
          padding: 0 14px;
          font-family: Heebo, sans-serif;
          font-size: 14px;
          font-weight: 800;
          outline: none;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .settings-input:focus {
          border-color: rgba(15,141,99,0.58);
          box-shadow: 0 0 0 3px rgba(15,141,99,0.12);
          background: rgba(255,255,255,0.05);
        }
        .settings-input::placeholder {
          color: var(--text3);
          opacity: 0.72;
        }
        .settings-input option {
          background: #070b12;
          color: #f4f7fb;
        }
        .support-textarea {
          min-height: 138px;
          padding: 13px 14px;
          resize: vertical;
          line-height: 1.55;
        }
        .plan-choice-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(132px, 168px));
          justify-content: start;
          gap: 8px;
          margin-top: auto;
          direction: ltr;
        }
        .plan-choice-btn {
          position: relative !important;
          isolation: isolate;
          overflow: hidden !important;
          min-height: 48px !important;
          border-radius: 12px !important;
          padding: 7px 10px !important;
          border-width: 1px !important;
          border-style: solid !important;
          color: #fff !important;
          font-family: Heebo, sans-serif !important;
          cursor: pointer !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 2px !important;
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
          border-radius: 15px;
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
          box-shadow: 0 10px 22px rgba(15,141,99,0.24), inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .plan-choice-btn--yearly {
          border-color: rgba(16,185,129,0.78) !important;
          background:
            radial-gradient(circle at 48% -26%, rgba(187,247,208,0.42), transparent 44%),
            linear-gradient(135deg, #0b7a56 0%, #0f8d63 48%, #35c287 100%) !important;
          box-shadow: 0 10px 22px rgba(15,141,99,0.22), inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .plan-choice-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.08) brightness(1.04);
        }
        .plan-choice-btn:disabled {
          opacity: 0.65 !important;
          cursor: wait !important;
          transform: none;
        }
        .plan-choice-btn svg {
          width: 14px;
          height: 14px;
          color: #fff !important;
          stroke: #fff !important;
          filter: drop-shadow(0 7px 14px rgba(0,0,0,0.24));
        }
        .plan-choice-btn > svg {
          padding: 6px;
          width: 32px;
          height: 32px;
          border-radius: 11px;
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
        .plan-choice-btn--monthly > span:nth-of-type(2),
        .plan-choice-btn--yearly > span:nth-of-type(3) {
          font-size: 11.5px !important;
          line-height: 1.05 !important;
        }
        .plan-choice-btn--monthly > span:nth-of-type(3),
        .plan-choice-btn--yearly > span:nth-of-type(4) {
          font-size: 8.5px !important;
          line-height: 1 !important;
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
          border: 1px solid rgba(16,185,129,0.62) !important;
          color: #fff !important;
          box-shadow:
            0 14px 30px rgba(15,141,99,0.2),
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
            0 20px 38px rgba(15,141,99,0.28),
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
        @media (max-width: 1024px) {
          .settings-shell {
            grid-template-columns: 250px minmax(0, 1fr);
            gap: 14px;
          }
          .settings-sidebar {
            top: 78px;
            padding: 14px;
          }
        }
        @media (max-width: 720px) {
          .settings-shell {
            display: block;
          }
          .settings-sidebar {
            position: relative;
            top: auto;
            padding: 14px;
          }
          .settings-content {
            display: none;
          }
          .settings-shell--content-open .settings-sidebar {
            display: none;
          }
          .settings-shell--content-open .settings-content {
            display: block;
          }
          .settings-back-button {
            display: flex;
            margin-right: auto;
            margin-left: 0;
          }
          .settings-card {
            max-width: none;
          }
          .settings-menu-item {
            min-height: 50px;
            padding: 9px 4px;
          }
        }
        @media (max-width: 520px) {
          .support-form { grid-template-columns: 1fr; }
          .plan-choice-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .plan-choice-btn { min-height: 66px !important; padding: 9px 7px !important; }
          .plan-choice-btn > svg { width: 30px; height: 30px; }
          .plan-choice-btn:has(> svg) > span:nth-of-type(1) { font-size: 11px !important; }
          .plan-choice-btn:has(> svg) > span:nth-of-type(2) { font-size: 8.5px !important; }
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
