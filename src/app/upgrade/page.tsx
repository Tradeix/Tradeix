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
  const { language, isPro, isTemporaryPro, isAdmin, upgradeToPro, cancelSubscription, subscriptionLoading } = useApp()
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
  const hasActivePaidPlan = isAdmin || (isPro && !isTemporaryPro)

  return (
    <div className="upgrade-shell" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <section className="upgrade-card">
        <div className="upgrade-glow upgrade-glow-a" />
        <div className="upgrade-glow upgrade-glow-b" />

        <div className="upgrade-copy">
          <div className="upgrade-mark">
            <Icon name="bolt" size={26} color="#0f8d63" />
          </div>

          <div className="upgrade-headline">
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
                {item}
              </span>
            ))}
          </div>

          <div className="upgrade-features">
            {proList.map(feature => (
              <div key={feature.label}>
                <Icon name="check" size={15} color="#36cb61" />
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

          <div className="price-strip">
            <div className="plan-badge">
              {isYearly
                ? (language === 'he' ? 'קבל חודשיים מתנה!' : 'Get 2 months free!')
                : (language === 'he' ? 'גמיש חודשי' : 'Flexible monthly')}
            </div>

            <div className="price-row" dir="ltr">
              <strong>{price}</strong>
              <span>{period}</span>
            </div>

          </div>

          {hasActivePaidPlan ? (
            <div className="active-plan">
              <div>
                <Icon name="verified" size={19} color="#36cb61" />
                {isAdmin
                  ? (language === 'he' ? 'גישת ADMIN פעילה' : 'ADMIN access is active')
                  : (language === 'he' ? 'המנוי שלך כבר פעיל' : 'Your plan is already active')}
              </div>
              {!isAdmin && (
                <button onClick={handleCancel} disabled={loading}>
                  {loading
                    ? (language === 'he' ? 'פותח...' : 'Opening...')
                    : (language === 'he' ? 'נהל / בטל מנוי' : 'Manage / cancel plan')}
                </button>
              )}
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
                  {language === 'he'
                    ? isYearly ? 'הפעל מנוי PRO שנתי' : 'הפעל מנוי PRO חודשי'
                    : isYearly ? 'Activate yearly PRO plan' : 'Activate monthly PRO plan'}
                </>
              )}
            </button>
          )}

        </div>
      </section>

      <style>{`
        .upgrade-shell {
          min-height: calc(100vh - 132px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 0;
          font-family: Heebo, sans-serif;
        }

        .upgrade-card {
          width: min(100%, 1080px);
          min-height: 460px;
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(390px, 0.88fr);
          gap: 34px;
          padding: 30px;
          border-radius: 26px;
          border: 1px solid rgba(15,141,99,0.24);
          background:
            radial-gradient(circle at 12% 12%, rgba(0,154,203,0.10), transparent 32%),
            radial-gradient(circle at 82% 12%, rgba(184,82,255,0.10), transparent 34%),
            linear-gradient(135deg, rgba(15,141,99,0.075), rgba(255,255,255,0.018));
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
          background: rgba(15,141,99,0.17);
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
          align-items: flex-start;
          text-align: start;
          gap: 16px;
          min-width: 0;
        }

        .upgrade-mark {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          border: 1px solid rgba(15,141,99,0.30);
          background: rgba(15,141,99,0.10);
        }

        .upgrade-eyebrow {
          color: #0f8d63;
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
          line-height: 1.55;
          font-weight: 650;
        }

        .upgrade-proof {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          gap: 14px;
        }

        .upgrade-proof span {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          color: #36cb61;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .upgrade-proof span::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #36cb61;
          margin-inline-end: 7px;
        }

        .upgrade-features {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px 18px;
          max-width: 620px;
          padding-top: 4px;
          width: 100%;
        }

        .upgrade-features div {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 28px;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--text2);
          font-size: 13px;
          font-weight: 800;
        }

        .upgrade-panel {
          align-self: center;
          display: grid;
          gap: 18px;
          padding-inline-start: 30px;
          border-inline-start: 1px solid rgba(15,141,99,0.24);
        }

        [data-theme="light"] .upgrade-panel {
          border-inline-start-color: rgba(15,141,99,0.28);
        }

        .billing-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 0;
          border-radius: 18px;
          border: none;
          background: transparent;
          margin-bottom: 0;
        }

        .billing-toggle button {
          position: relative;
          min-height: 76px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: color-mix(in srgb, var(--bg3) 74%, transparent);
          color: var(--text2);
          cursor: pointer;
          font-family: Heebo, sans-serif;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }

        .billing-toggle button:hover {
          transform: translateY(-1px);
          border-color: rgba(15,141,99,0.36);
        }

        .billing-toggle button[data-active="1"] {
          border-color: rgba(15,141,99,0.72);
          background: linear-gradient(135deg, rgba(15,141,99,0.18), rgba(15,141,99,0.055));
          color: #0f8d63;
          box-shadow: 0 14px 34px rgba(15,141,99,0.11);
        }

        .billing-toggle strong,
        .billing-toggle span {
          display: block;
        }

        .billing-toggle strong {
          position: relative;
          width: fit-content;
          margin-inline: auto;
          font-size: 14px;
          font-weight: 950;
          margin-bottom: 9px;
        }

        .billing-toggle strong::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: -5px;
          height: 3px;
          border-radius: 999px;
          background: #0f8d63;
          opacity: 0;
          transform: scaleX(0.55);
          transition: opacity 0.16s ease, transform 0.16s ease;
        }

        .billing-toggle button[data-active="1"] strong::after {
          opacity: 1;
          transform: scaleX(1);
        }

        .billing-toggle span {
          font-size: 11px;
          font-weight: 850;
          opacity: 0.78;
        }

        .price-strip {
          text-align: center;
          display: grid;
          grid-template-columns: 1fr;
          align-items: center;
          justify-items: center;
          gap: 12px 18px;
          padding-block: 2px;
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
          grid-column: 1 / -1;
          justify-self: center;
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
          background: linear-gradient(135deg, #0f8d63, #12a875);
          box-shadow: 0 16px 42px rgba(15,141,99,0.34);
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
            width: min(100%, 720px);
          }

          .upgrade-copy {
            align-items: center;
            text-align: center;
            gap: 14px;
          }

          .upgrade-mark {
            align-self: center;
            justify-self: center;
            margin-inline: auto;
          }

          .upgrade-copy h1 {
            font-size: 32px;
            margin-inline: auto;
          }

          .upgrade-copy p {
            font-size: 13px;
            margin-inline: auto;
          }

          .upgrade-proof {
            justify-content: center;
          }

          .upgrade-features {
            grid-template-columns: 1fr 1fr;
          }

          .upgrade-panel {
            border-inline-start: 0;
            padding-inline-start: 0;
            border-top: 1px solid rgba(15,141,99,0.20);
            padding-top: 16px;
          }
        }

        @media (max-width: 560px) {
          .upgrade-shell {
            display: block;
            min-height: 0;
            padding: 0 0 14px;
          }

          .upgrade-card {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 14px;
            border-radius: 18px;
            border-color: rgba(15,141,99,0.18);
            background:
              linear-gradient(180deg, rgba(15,141,99,0.075), rgba(255,255,255,0.012));
            box-shadow: 0 14px 44px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05);
          }

          .upgrade-glow {
            display: none;
          }

          .upgrade-copy {
            display: contents;
          }

          .upgrade-mark {
            order: 1;
            align-self: center;
            justify-self: center;
            margin-inline: auto;
            width: 40px;
            height: 40px;
            border-radius: 12px;
          }

          .upgrade-headline {
            order: 2;
          }

          .upgrade-eyebrow {
            font-size: 10px;
            margin-bottom: 6px;
          }

          .upgrade-copy h1 {
            font-size: 26px;
            line-height: 1.05;
            max-width: 320px;
          }

          .upgrade-copy p {
            font-size: 12px;
            line-height: 1.45;
            margin-top: 8px;
            max-width: 340px;
          }

          .upgrade-proof {
            order: 3;
            display: flex;
            flex-wrap: nowrap;
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 2px;
            scrollbar-width: none;
          }

          .upgrade-proof::-webkit-scrollbar {
            display: none;
          }

          .upgrade-proof span {
            flex: 0 0 auto;
            min-height: 26px;
            padding: 0 10px;
            border-radius: 999px;
            background: rgba(54,203,97,0.08);
            border: 1px solid rgba(54,203,97,0.16);
            font-size: 10px;
          }

          .upgrade-proof span::before {
            width: 5px;
            height: 5px;
            margin-inline-end: 5px;
          }

          .upgrade-features {
            order: 5;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            padding-top: 2px;
          }

          .upgrade-features div {
            min-height: 38px;
            align-items: flex-start;
            gap: 6px;
            padding: 8px;
            border-radius: 12px;
            background: rgba(255,255,255,0.026);
            border: 1px solid rgba(255,255,255,0.055);
            font-size: 11px;
            line-height: 1.25;
            font-weight: 850;
          }

          .upgrade-panel {
            order: 4;
            border-inline-start: 0;
            padding-inline-start: 0;
            border-top: 1px solid rgba(15,141,99,0.20);
            border-bottom: 1px solid rgba(15,141,99,0.16);
            padding: 12px 0;
            gap: 12px;
          }

          .billing-toggle {
            gap: 8px;
          }

          .billing-toggle button {
            min-height: 58px;
            border-radius: 14px;
          }

          .billing-toggle strong {
            font-size: 13px;
            margin-bottom: 7px;
          }

          .billing-toggle strong::after {
            bottom: -4px;
            height: 2px;
          }

          .billing-toggle span {
            font-size: 10px;
          }

          .price-strip {
            grid-template-columns: 1fr;
            gap: 8px;
            align-items: center;
            justify-items: center;
          }

          .plan-badge {
            min-height: 24px;
            padding: 4px 9px;
            font-size: 10px;
          }

          .price-row strong {
            font-size: 40px;
          }

          .price-row span {
            font-size: 11px;
            padding-bottom: 3px;
          }

          .upgrade-cta,
          .active-plan button {
            min-height: 48px;
            border-radius: 14px;
            font-size: 14px;
          }

          .active-plan > div {
            min-height: 44px;
            font-size: 12px;
          }

        }

        @media (max-width: 380px) {
          .upgrade-card {
            padding: 12px;
          }

          .upgrade-copy h1 {
            font-size: 23px;
          }

          .upgrade-copy p {
            font-size: 11.5px;
          }

          .upgrade-features {
            grid-template-columns: 1fr;
          }

          .price-row strong {
            font-size: 34px;
          }
        }
      `}</style>
    </div>
  )
}
