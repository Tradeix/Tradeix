'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import toast from 'react-hot-toast'
import Icon from '@/components/Icon'

const PRO_FEATURES = {
  he: [
    { label: 'ניתוח AI לגרפים', icon: 'auto_awesome' },
    { label: 'עסקאות ללא הגבלה', icon: 'all_inclusive' },
    { label: 'סטטיסטיקות מלאות', icon: 'monitoring' },
    { label: 'עד 3 תיקי מסחר', icon: 'cases' },
    { label: 'ניהול אסטרטגיות', icon: 'psychology' },
    { label: 'ארכיון תיקים מלא', icon: 'inventory_2' },
  ],
  en: [
    { label: 'AI chart analysis', icon: 'auto_awesome' },
    { label: 'Unlimited trades', icon: 'all_inclusive' },
    { label: 'Full statistics', icon: 'monitoring' },
    { label: 'Up to 3 portfolios', icon: 'cases' },
    { label: 'Strategy tracking', icon: 'psychology' },
    { label: 'Full portfolio archive', icon: 'inventory_2' },
  ],
}

const TRUST_ITEMS = {
  he: ['תשלום מאובטח', 'הפעלה מיידית', 'ביטול בכל זמן'],
  en: ['Secure checkout', 'Instant activation', 'Cancel anytime'],
}

export default function UpgradePage() {
  const { language, isPro, upgradeToPro, cancelSubscription, subscriptionLoading } = useApp()
  const [loading, setLoading] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly')

  async function handleUpgrade() {
    setLoading(true)
    try {
      const result = await upgradeToPro(billingPeriod)
      if (result?.reusedSubscription) {
        toast.success(language === 'he' ? 'המנוי חודש על החשבון הקיים שלך' : 'Subscription renewed on your existing account')
        setLoading(false)
      } else if (result?.openedCheckout) {
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
  const trustItems = TRUST_ITEMS[language]
  const isYearly = billingPeriod === 'yearly'
  const price = isYearly ? '$199' : '$20'
  const period = isYearly
    ? (language === 'he' ? 'לשנה' : 'per year')
    : (language === 'he' ? 'לחודש' : 'per month')
  const monthlyEquivalent = language === 'he' ? 'יוצא $16.58 לחודש' : 'Only $16.58/mo'

  return (
    <div className="upgrade-shell" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <section className="upgrade-card">
        <div className="upgrade-glow upgrade-glow-a" />
        <div className="upgrade-glow upgrade-glow-b" />

        <div className="upgrade-copy">
          <div className="upgrade-mark">
            <Icon name="bolt" size={26} color="#f59e0b" />
          </div>

          <div>
            <div className="upgrade-eyebrow">
              {language === 'he' ? 'UPLOTRADE PRO' : 'UPLOTRADE PRO'}
            </div>
            <h1>
              {language === 'he' ? 'קבל יתרון אמיתי בכל עסקה' : 'Get an edge on every trade'}
            </h1>
            <p>
              {language === 'he'
                ? 'פתח את כל הכלים שמראים לך מה באמת עובד: AI, סטטיסטיקות, אסטרטגיות ותיקי מסחר מתקדמים.'
                : 'Unlock the tools that show what really works: AI analysis, advanced statistics, strategies, and portfolios.'}
            </p>
          </div>

          <div className="upgrade-proof">
            {trustItems.map(item => (
              <span key={item}>
                <Icon name="check" size={14} color="#36cb61" />
                {item}
              </span>
            ))}
          </div>

          <div className="upgrade-features">
            {proList.map(feature => (
              <div key={feature.label}>
                <span>
                  <Icon name={feature.icon} size={15} color="#f59e0b" />
                </span>
                {feature.label}
              </div>
            ))}
          </div>
        </div>

        <div className="upgrade-panel">
          <div className="billing-toggle" aria-label={language === 'he' ? 'בחירת מנוי' : 'Choose billing period'}>
            {[
              { value: 'monthly' as const, label: language === 'he' ? 'חודשי' : 'Monthly', sub: '$20' },
              { value: 'yearly' as const, label: language === 'he' ? 'שנתי' : 'Yearly', sub: language === 'he' ? 'מומלץ' : 'Best value' },
            ].map(plan => {
              const active = billingPeriod === plan.value
              return (
                <button
                  key={plan.value}
                  type="button"
                  onClick={() => setBillingPeriod(plan.value)}
                  data-active={active ? '1' : '0'}
                >
                  <strong>{plan.label}</strong>
                  <span>{plan.sub}</span>
                </button>
              )
            })}
          </div>

          <div className="price-box">
            <div className="plan-badge">
              {isYearly
                ? (language === 'he' ? 'חודשיים מתנה' : '2 months free')
                : (language === 'he' ? 'גמיש חודשי' : 'Flexible monthly')}
            </div>

            <div className="price-row" dir="ltr">
              <strong>{price}</strong>
              <span>{period}</span>
            </div>

            <div className="price-note">
              {isYearly ? monthlyEquivalent : (language === 'he' ? 'אפשר לבטל בכל זמן' : 'Cancel anytime')}
            </div>
          </div>

          {isPro ? (
            <div className="active-plan">
              <div>
                <Icon name="verified" size={19} color="#36cb61" />
                {language === 'he' ? 'המנוי שלך כבר פעיל' : 'Your plan is already active'}
              </div>
              <button onClick={handleCancel} disabled={loading}>
                {loading
                  ? (language === 'he' ? 'פותח...' : 'Opening...')
                  : (language === 'he' ? 'נהל / בטל מנוי' : 'Manage / cancel plan')}
              </button>
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading || subscriptionLoading}
              className="upgrade-cta"
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  <Icon name="lock_open" size={19} color="#fff" />
                  {language === 'he' ? 'פתח PRO עכשיו' : 'Unlock PRO now'}
                </>
              )}
            </button>
          )}

          <div className="checkout-hint">
            {language === 'he'
              ? 'התשלום נפתח בפופאפ מאובטח בתוך האתר.'
              : 'Secure checkout opens in a popup inside the site.'}
          </div>
        </div>
      </section>

      <style>{`
        .upgrade-shell {
          min-height: calc(100vh - 132px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 0;
          font-family: Heebo, sans-serif;
        }

        .upgrade-card {
          width: min(100%, 1020px);
          min-height: 500px;
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1.06fr) minmax(340px, 0.72fr);
          gap: 22px;
          padding: 24px;
          border-radius: 26px;
          border: 1px solid rgba(245,158,11,0.24);
          background:
            radial-gradient(circle at 12% 12%, rgba(0,154,203,0.10), transparent 32%),
            radial-gradient(circle at 82% 12%, rgba(184,82,255,0.10), transparent 34%),
            linear-gradient(135deg, rgba(245,158,11,0.075), rgba(255,255,255,0.018));
          box-shadow: 0 24px 90px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07);
        }

        .upgrade-glow {
          position: absolute;
          pointer-events: none;
          border-radius: 999px;
          filter: blur(58px);
          opacity: 0.62;
        }

        .upgrade-glow-a {
          width: 220px;
          height: 220px;
          background: rgba(245,158,11,0.17);
          inset-inline-end: -70px;
          top: -80px;
        }

        .upgrade-glow-b {
          width: 180px;
          height: 180px;
          background: rgba(54,203,97,0.11);
          inset-inline-start: -55px;
          bottom: -70px;
        }

        .upgrade-copy,
        .upgrade-panel {
          position: relative;
          z-index: 1;
        }

        .upgrade-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 18px;
          min-width: 0;
        }

        .upgrade-mark {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          border: 1px solid rgba(245,158,11,0.32);
          background: rgba(245,158,11,0.12);
          box-shadow: 0 18px 42px rgba(245,158,11,0.15);
        }

        .upgrade-eyebrow {
          color: #f59e0b;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .upgrade-copy h1 {
          margin: 0;
          color: var(--text);
          font-size: clamp(34px, 4.2vw, 54px);
          line-height: 0.96;
          font-weight: 950;
          letter-spacing: 0;
          max-width: 640px;
        }

        .upgrade-copy p {
          max-width: 620px;
          margin: 12px 0 0;
          color: var(--text3);
          font-size: 15px;
          line-height: 1.65;
          font-weight: 650;
        }

        .upgrade-proof {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .upgrade-proof span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 34px;
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid rgba(54,203,97,0.18);
          background: rgba(54,203,97,0.075);
          color: var(--text2);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .upgrade-features {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          max-width: 620px;
        }

        .upgrade-features div {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.065);
          background: rgba(255,255,255,0.035);
          color: var(--text2);
          font-size: 13px;
          font-weight: 800;
        }

        .upgrade-features span {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(245,158,11,0.11);
        }

        .upgrade-panel {
          align-self: center;
          padding: 18px;
          border-radius: 22px;
          border: 1px solid rgba(245,158,11,0.26);
          background: rgba(5,8,13,0.48);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 22px 48px rgba(0,0,0,0.20);
        }

        [data-theme="light"] .upgrade-panel {
          background: rgba(255,255,255,0.78);
        }

        .billing-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 8px;
          border-radius: 18px;
          border: 1px solid rgba(245,158,11,0.16);
          background: rgba(0,0,0,0.14);
          margin-bottom: 16px;
        }

        .billing-toggle button {
          min-height: 70px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          color: var(--text2);
          cursor: pointer;
          font-family: Heebo, sans-serif;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }

        .billing-toggle button:hover {
          transform: translateY(-1px);
          border-color: rgba(245,158,11,0.36);
        }

        .billing-toggle button[data-active="1"] {
          border-color: rgba(245,158,11,0.72);
          background: linear-gradient(135deg, rgba(245,158,11,0.20), rgba(245,158,11,0.075));
          color: #f59e0b;
          box-shadow: 0 14px 34px rgba(245,158,11,0.13), inset 0 1px 0 rgba(255,255,255,0.09);
        }

        .billing-toggle strong,
        .billing-toggle span {
          display: block;
        }

        .billing-toggle strong {
          font-size: 14px;
          font-weight: 950;
          margin-bottom: 5px;
        }

        .billing-toggle span {
          font-size: 11px;
          font-weight: 850;
          opacity: 0.78;
        }

        .price-box {
          text-align: center;
          padding: 20px 12px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.045));
          border: 1px solid rgba(245,158,11,0.20);
          margin-bottom: 14px;
        }

        .plan-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(54,203,97,0.12);
          border: 1px solid rgba(54,203,97,0.22);
          color: #36cb61;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 12px;
        }

        .price-row {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 7px;
        }

        .price-row strong {
          color: var(--text);
          font-size: 54px;
          font-weight: 950;
          line-height: 0.9;
          letter-spacing: 0;
        }

        .price-row span {
          color: var(--text3);
          font-size: 13px;
          font-weight: 850;
          padding-bottom: 4px;
        }

        .price-note {
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
          margin-top: 12px;
        }

        .upgrade-cta,
        .active-plan button {
          width: 100%;
          min-height: 52px;
          border: none;
          border-radius: 16px;
          font-family: Heebo, sans-serif;
          font-size: 16px;
          font-weight: 950;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }

        .upgrade-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #fff;
          background: linear-gradient(135deg, #f59e0b, #f97316);
          box-shadow: 0 16px 42px rgba(245,158,11,0.34);
        }

        .upgrade-cta:hover,
        .active-plan button:hover {
          transform: translateY(-2px);
        }

        .upgrade-cta:disabled,
        .active-plan button:disabled {
          cursor: wait;
          opacity: 0.68;
          transform: none;
        }

        .active-plan {
          display: grid;
          gap: 12px;
        }

        .active-plan > div {
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 15px;
          color: #36cb61;
          font-size: 14px;
          font-weight: 900;
          background: rgba(54,203,97,0.10);
          border: 1px solid rgba(54,203,97,0.18);
        }

        .active-plan button {
          color: #ef4444;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
        }

        .checkout-hint {
          margin-top: 12px;
          text-align: center;
          color: var(--text3);
          font-size: 11px;
          font-weight: 750;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          border: 2.5px solid rgba(255,255,255,0.32);
          border-top-color: #fff;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .upgrade-shell {
            min-height: auto;
            padding: 4px 0 18px;
          }

          .upgrade-card {
            grid-template-columns: 1fr;
            min-height: 0;
            gap: 16px;
            padding: 18px;
          }

          .upgrade-copy {
            gap: 14px;
          }

          .upgrade-copy h1 {
            font-size: 32px;
          }

          .upgrade-copy p {
            font-size: 13px;
          }

          .upgrade-features {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 560px) {
          .upgrade-card {
            padding: 14px;
            border-radius: 20px;
          }

          .upgrade-proof {
            display: grid;
            grid-template-columns: 1fr;
          }

          .upgrade-features {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .upgrade-panel {
            padding: 14px;
          }

          .price-row strong {
            font-size: 44px;
          }
        }
      `}</style>
    </div>
  )
}
