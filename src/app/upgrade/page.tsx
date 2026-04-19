'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/app-context'
import toast from 'react-hot-toast'
import Icon from '@/components/Icon'

const FREE_FEATURES = {
  he: [
    { label: 'תיק מסחר אחד', included: true },
    { label: 'עד 20 עסקאות', included: true },
    { label: 'דשבורד בסיסי', included: true },
    { label: 'ניתוח AI לתמונות', included: true },
    { label: 'עמוד סטטיסטיקות', included: false },
    { label: 'ארכיון תיקים', included: false },
    { label: 'עד 3 תיקים', included: false },
    { label: 'עסקאות ללא הגבלה', included: false },
    { label: 'עדכונים ותכונות חדשות', included: false },
  ],
  en: [
    { label: 'One trading portfolio', included: true },
    { label: 'Up to 20 trades', included: true },
    { label: 'Basic dashboard', included: true },
    { label: 'AI chart analysis', included: true },
    { label: 'Statistics page', included: false },
    { label: 'Portfolio archive', included: false },
    { label: 'Up to 3 portfolios', included: false },
    { label: 'Unlimited trades', included: false },
    { label: 'New features & updates', included: false },
  ],
}

const PRO_FEATURES = {
  he: [
    { label: 'עד 3 תיקים', included: true },
    { label: 'עסקאות ללא הגבלה', included: true },
    { label: 'דשבורד מתקדם', included: true },
    { label: 'ניתוח AI לתמונות', included: true },
    { label: 'עמוד סטטיסטיקות מלא', included: true },
    { label: 'ארכיון תיקים', included: true },
    { label: 'גישה לכל עמודי האתר', included: true },
    { label: 'עדכונים ותכונות חדשות', included: true },
    { label: 'תמיכה מועדפת', included: true },
  ],
  en: [
    { label: 'Up to 3 portfolios', included: true },
    { label: 'Unlimited trades', included: true },
    { label: 'Advanced dashboard', included: true },
    { label: 'AI chart analysis', included: true },
    { label: 'Full statistics page', included: true },
    { label: 'Portfolio archive', included: true },
    { label: 'Access to all pages', included: true },
    { label: 'New features & updates', included: true },
    { label: 'Priority support', included: true },
  ],
}

export default function UpgradePage() {
  const { language, isPro, upgradeToPro, cancelSubscription, subscriptionLoading } = useApp()
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const isRTL = language === 'he'

  async function handleUpgrade() {
    setLoading(true)
    try {
      await upgradeToPro()
      toast.success(language === 'he' ? 'ברוך הבא למנוי PRO!' : 'Welcome to PRO!')
      router.push('/dashboard')
    } catch {
      toast.error(language === 'he' ? 'שגיאה בשדרוג' : 'Upgrade failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    setLoading(true)
    try {
      await cancelSubscription()
      toast.success(language === 'he' ? 'המנוי בוטל' : 'Subscription canceled')
    } catch {
      toast.error(language === 'he' ? 'שגיאה בביטול' : 'Cancel failed')
    } finally {
      setLoading(false)
    }
  }

  const freeList = FREE_FEATURES[language]
  const proList = PRO_FEATURES[language]

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '999px', padding: '6px 16px', marginBottom: '20px' }}>
          <Icon name="bolt" size={16} color="#f59e0b" />
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {language === 'he' ? 'בחר את תוכנית המנוי שלך' : 'Choose Your Plan'}
          </span>
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.02em', margin: '0 0 12px', lineHeight: 1.1 }}>
          {language === 'he' ? 'שדרג את חווית המסחר שלך' : 'Upgrade Your Trading'}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text3)', fontWeight: '500', margin: 0 }}>
          {language === 'he'
            ? 'קבל גישה מלאה לכל הכלים שתצטרך לנתח ולשפר את ביצועי המסחר שלך'
            : 'Get full access to all the tools you need to analyze and improve your trading performance'}
        </p>
      </div>

      {/* Plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '48px' }} className="plans-grid">

        {/* FREE plan */}
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: '24px', padding: '28px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>
              {language === 'he' ? 'חינמי' : 'Free'}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
              <span style={{ fontSize: '38px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 }}>$0</span>
              <span style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: '600', paddingBottom: '6px' }}>
                {language === 'he' ? '/ לחודש' : '/ month'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text3)', margin: '8px 0 0', fontWeight: '500' }}>
              {language === 'he' ? 'לתחילת הדרך' : 'To get started'}
            </p>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {freeList.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: f.included ? 1 : 0.35 }}>
                <Icon name={f.included ? 'check_circle' : 'cancel'} size={16} color={f.included ? '#22c55e' : 'var(--text3)'} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: '500', textDecoration: f.included ? 'none' : 'line-through' }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>

          {!isPro && (
            <div style={{ marginTop: '24px', padding: '10px 16px', borderRadius: '12px', background: 'rgba(74,127,255,0.06)', border: '1px solid rgba(74,127,255,0.15)', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#4a7fff' }}>
              {language === 'he' ? '✓ התוכנית הנוכחית שלך' : '✓ Your current plan'}
            </div>
          )}
        </div>

        {/* PRO plan */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(249,115,22,0.04) 100%)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '24px', padding: '28px', position: 'relative', overflow: 'hidden',
          boxShadow: '0 0 60px -20px rgba(245,158,11,0.2)',
        }}>
          {/* Popular badge */}
          <div style={{ position: 'absolute', top: '16px', [isRTL ? 'left' : 'right']: '16px', background: 'linear-gradient(135deg, #f59e0b, #f97316)', borderRadius: '999px', padding: '4px 12px', fontSize: '10px', fontWeight: '900', color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {language === 'he' ? 'מומלץ' : 'Popular'}
          </div>
          {/* Glow */}
          <div style={{ position: 'absolute', insetInlineEnd: '-40px', top: '-40px', width: '150px', height: '150px', background: 'rgba(245,158,11,0.1)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>PRO</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
              <span style={{ fontSize: '38px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 }}>$20</span>
              <span style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: '600', paddingBottom: '6px' }}>
                {language === 'he' ? '/ לחודש' : '/ month'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(245,158,11,0.7)', margin: '8px 0 0', fontWeight: '600' }}>
              {language === 'he' ? 'גישה מלאה לכל הכלים' : 'Full access to all tools'}
            </p>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {proList.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon name="check_circle" size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: '500' }}>{f.label}</span>
              </div>
            ))}
          </div>

          {isPro ? (
            <div>
              <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center', fontSize: '13px', fontWeight: '800', color: '#f59e0b', marginBottom: '10px' }}>
                {language === 'he' ? '⚡ המנוי הפעיל שלך' : '⚡ Your active plan'}
              </div>
              <button
                onClick={handleCancel}
                disabled={loading}
                style={{ width: '100%', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: '700', color: 'rgba(239,68,68,0.7)', cursor: loading ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; e.currentTarget.style.color = '#ef4444' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = 'rgba(239,68,68,0.7)' }}
              >
                {loading ? (language === 'he' ? 'מבטל...' : 'Canceling...') : (language === 'he' ? 'בטל מנוי' : 'Cancel subscription')}
              </button>
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading || subscriptionLoading}
              style={{
                width: '100%',
                background: loading ? 'rgba(245,158,11,0.5)' : 'linear-gradient(135deg, #f59e0b, #f97316)',
                border: 'none', borderRadius: '14px', padding: '14px',
                fontSize: '14px', fontWeight: '800', color: '#fff',
                cursor: loading ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif',
                boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(245,158,11,0.45)' }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(245,158,11,0.35)' }}
            >
              {loading ? (
                <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <Icon name="bolt" size={18} />
                  {language === 'he' ? 'שדרג ל PRO עכשיו' : 'Upgrade to PRO Now'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Payment note */}
      <div style={{ textAlign: 'center', padding: '20px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <Icon name="info" size={18} color="rgba(74,127,255,0.5)" />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text2)' }}>
            {language === 'he' ? 'שיטת תשלום' : 'Payment method'}
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
          {language === 'he'
            ? 'מערכת התשלומים תתווסף בקרוב. כרגע השדרוג מופעל ישירות.'
            : 'Payment system coming soon. Upgrade is activated directly for now.'}
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .plans-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
