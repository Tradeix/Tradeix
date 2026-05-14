'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import toast from 'react-hot-toast'
import Icon from '@/components/Icon'

const PRO_FEATURES = {
  he: [
    { label: 'עד 3 תיקים', icon: 'cases' },
    { label: 'עסקאות ללא הגבלה', icon: 'all_inclusive' },
    { label: 'דשבורד מתקדם', icon: 'space_dashboard' },
    { label: 'ניתוח AI לתמונות', icon: 'auto_awesome' },
    { label: 'עמוד סטטיסטיקות מלא', icon: 'monitoring' },
    { label: 'ארכיון תיקים', icon: 'inventory_2' },
    { label: 'עדכונים ותכונות חדשות', icon: 'update' },
    { label: 'תמיכה מועדפת', icon: 'support_agent' },
  ],
  en: [
    { label: 'Up to 3 portfolios', icon: 'cases' },
    { label: 'Unlimited trades', icon: 'all_inclusive' },
    { label: 'Advanced dashboard', icon: 'space_dashboard' },
    { label: 'AI chart analysis', icon: 'auto_awesome' },
    { label: 'Full statistics page', icon: 'monitoring' },
    { label: 'Portfolio archive', icon: 'inventory_2' },
    { label: 'New features & updates', icon: 'update' },
    { label: 'Priority support', icon: 'support_agent' },
  ],
}

export default function UpgradePage() {
  const { language, isPro, upgradeToPro, cancelSubscription, subscriptionLoading } = useApp()
  const [loading, setLoading] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')

  async function handleUpgrade() {
    setLoading(true)
    try {
      const result = await upgradeToPro(billingPeriod)
      if (result?.reusedSubscription) {
        toast.success(language === 'he' ? 'המנוי חודש על החשבון הקיים שלך' : 'Subscription renewed on your existing account')
        setLoading(false)
      }
    } catch {
      toast.error(language === 'he' ? 'לא הצלחנו לפתוח את התשלום' : 'Could not open checkout')
      setLoading(false)
    }
  }

  async function handleCancel() {
    setLoading(true)
    try {
      await cancelSubscription()
    } catch {
      toast.error(language === 'he' ? 'לא הצלחנו לפתוח את ניהול החיוב' : 'Could not open billing portal')
      setLoading(false)
    }
  }

  const proList = PRO_FEATURES[language]
  const price = billingPeriod === 'yearly' ? '$199' : '$20'
  const priceSuffix = billingPeriod === 'yearly'
    ? (language === 'he' ? 'שנה' : 'year')
    : (language === 'he' ? 'חודש' : 'month')

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', maxWidth: '580px', margin: '0 auto', padding: '20px 0' }}>

      {/* Hero section */}
      <div className="section-anim" style={{ textAlign: 'center', marginBottom: '36px' }}>
        {/* PRO icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.1))',
          border: '1px solid rgba(245,158,11,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 32px rgba(245,158,11,0.15)',
        }}>
          <Icon name="bolt" size={36} color="#f59e0b" />
        </div>

        <h1 style={{
          fontSize: '33px', fontWeight: '900', color: 'var(--text)',
          letterSpacing: '-0.03em', margin: '0 0 10px', lineHeight: 1.15,
        }}>
          {language === 'he' ? 'שדרג ל' : 'Upgrade to '}
          <span style={{ color: '#f59e0b' }}>PRO</span>
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text3)', fontWeight: '500', margin: 0, lineHeight: 1.6 }}>
          {language === 'he'
            ? 'קבל גישה מלאה לכל הכלים שתצטרך לנתח ולשפר את ביצועי המסחר שלך'
            : 'Get full access to all the tools you need to analyze and improve your trading'}
        </p>
      </div>

      {/* Price card */}
      <div className="section-anim anim-delay-1" style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(249,115,22,0.03) 100%)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden',
        marginBottom: '20px',
      }}>
        {/* Glow effects */}
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '180px', height: '180px', background: 'rgba(245,158,11,0.08)', filter: 'blur(70px)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '120px', height: '120px', background: 'rgba(249,115,22,0.06)', filter: 'blur(50px)', borderRadius: '50%', pointerEvents: 'none' }} />

        {/* Price */}
        <div style={{ textAlign: 'center', marginBottom: '28px', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '999px', padding: '5px 14px', marginBottom: '16px' }}>
            <Icon name="workspace_premium" size={14} color="#f59e0b" />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {language === 'he' ? 'מנוי פרימיום' : 'Premium Plan'}
            </span>
          </div>
          {!isPro && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              background: 'rgba(0,0,0,0.12)',
              border: '1px solid rgba(245,158,11,0.16)',
              borderRadius: '18px',
              padding: '10px',
              marginBottom: '22px',
            }}>
              {[
                { value: 'monthly' as const, label: language === 'he' ? 'חודשי' : 'Monthly', sub: '$20' },
                { value: 'yearly' as const, label: language === 'he' ? 'שנתי' : 'Yearly', sub: language === 'he' ? 'חודשיים מתנה' : '2 months free' },
              ].map(plan => {
                const active = billingPeriod === plan.value
                return (
                  <button
                    key={plan.value}
                    type="button"
                    onClick={() => setBillingPeriod(plan.value)}
                    style={{
                      minHeight: '96px',
                      border: active ? '1px solid rgba(245,158,11,0.75)' : '1px solid rgba(255,255,255,0.07)',
                      background: active ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))' : 'rgba(255,255,255,0.025)',
                      color: active ? '#f59e0b' : 'var(--text3)',
                      borderRadius: '16px',
                      padding: '13px 12px',
                      cursor: 'pointer',
                      fontFamily: 'Heebo, sans-serif',
                      fontWeight: '900',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      boxShadow: active ? '0 14px 34px rgba(245,158,11,0.12), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                      transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
                    }}
                    onMouseOver={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.28)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                    onMouseOut={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' } }}
                  >
                    {plan.value === 'yearly' && (
                      <span style={{
                        fontSize: '10px',
                        lineHeight: 1,
                        padding: '5px 11px',
                        borderRadius: '999px',
                        background: 'rgba(15,141,99,0.16)',
                        border: '1px solid rgba(15,141,99,0.28)',
                        color: '#0f8d63',
                        fontWeight: '950',
                      }}>
                        {language === 'he' ? 'מומלץ' : 'Recommended'}
                      </span>
                    )}
                    {plan.value === 'monthly' && (
                      <span aria-hidden="true" style={{ height: '22px', pointerEvents: 'none' }} />
                    )}
                    <span style={{ fontSize: '16px', lineHeight: 1.1, color: active ? '#f59e0b' : 'var(--text2)' }}>{plan.label}</span>
                    <span style={{ fontSize: plan.value === 'monthly' ? '14px' : '12px', opacity: active ? 0.92 : 0.78, lineHeight: 1.2, fontWeight: '800' }}>{plan.sub}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '53px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1 }}>{price}</span>
            <span style={{ fontSize: '15px', color: 'var(--text3)', fontWeight: '600', paddingBottom: '10px' }}>
              / {priceSuffix}
            </span>
          </div>
          {billingPeriod === 'yearly' && !isPro && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#0f8d63', fontWeight: '800' }}>
              {language === 'he' ? 'חודשיים מתנה ביחס למחיר החודשי' : 'Two months free compared with monthly billing'}
            </div>
          )}
        </div>

        {/* Features grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0',
          background: 'rgba(0,0,0,0.15)', borderRadius: '16px',
          border: '1px solid rgba(245,158,11,0.1)', overflow: 'hidden',
          marginBottom: '28px',
        }}>
          {proList.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '13px 16px',
              borderBottom: i < proList.length - 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              borderInlineEnd: i % 2 === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                background: 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={f.icon} size={14} color="#f59e0b" />
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: '600' }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* CTA button */}
        {isPro ? (
          <div>
            <div style={{
              padding: '14px', borderRadius: '14px',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              textAlign: 'center', marginBottom: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <Icon name="bolt" size={16} color="#f59e0b" />
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#f59e0b' }}>
                {language === 'he' ? 'המנוי הפעיל שלך' : 'Your active plan'}
              </span>
            </div>
            <button
              onClick={handleCancel}
              disabled={loading}
              style={{
                width: '100%', background: 'transparent',
                border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px',
                padding: '10px', fontSize: '13px', fontWeight: '700',
                color: 'rgba(239,68,68,0.6)', cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'Heebo, sans-serif', opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.color = '#ef4444' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = 'rgba(239,68,68,0.6)' }}
            >
              {loading ? (language === 'he' ? 'מבטל...' : 'Canceling...') : (language === 'he' ? 'בטל מנוי' : 'Cancel subscription')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={loading || subscriptionLoading}
            className="btn-press"
            style={{
              width: '100%',
              background: loading ? 'rgba(245,158,11,0.5)' : 'linear-gradient(135deg, #f59e0b, #f97316)',
              border: 'none', borderRadius: '16px', padding: '16px',
              fontSize: '17px', fontWeight: '900', color: '#fff',
              cursor: loading ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif',
              boxShadow: '0 8px 32px rgba(245,158,11,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.2s', letterSpacing: '-0.01em',
            }}
            onMouseOver={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(245,158,11,0.45)' } }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(245,158,11,0.35)' }}
          >
            {loading ? (
              <div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <>
                <Icon name="bolt" size={20} />
                {language === 'he' ? 'שדרג ל PRO עכשיו' : 'Upgrade to PRO Now'}
              </>
            )}
          </button>
        )}
      </div>

      {/* Trust badges */}
      <div className="section-anim anim-delay-3" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px',
      }}>
        {[
          { icon: 'shield', label: language === 'he' ? 'מאובטח ובטוח' : 'Secure & Safe', color: '#22c55e' },
          { icon: 'bolt', label: language === 'he' ? 'הפעלה מיידית' : 'Instant Activation', color: '#f59e0b' },
          { icon: 'cancel', label: language === 'he' ? 'ביטול בכל עת' : 'Cancel Anytime', color: '#0f8d63' },
        ].map((badge, i) => (
          <div key={i} style={{
            textAlign: 'center', padding: '16px 12px',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '14px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: `${badge.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <Icon name={badge.icon} size={18} color={badge.color} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text2)' }}>{badge.label}</div>
          </div>
        ))}
      </div>


      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .trust-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
