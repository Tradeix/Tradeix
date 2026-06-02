'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'
import { useApp } from '@/lib/app-context'
import { formatMoney, formatSignedMoney } from '@/lib/currency'

const COPY = {
  he: {
    nav: [
      { id: 'features', label: 'תכונות' },
      { id: 'pricing', label: 'מחירים' },
      { id: 'faq', label: 'שאלות נפוצות' },
    ],
    hero: {
      titleLead: 'יומן מסחר חכם',
      titleAccent: 'ששם את הנתונים שלך',
      titleTail: 'במרכז.',
      subtitle: 'UPLOTRADE מרכז את העסקאות, מנתח גרפים עם AI ומציג לך סטטיסטיקות ברורות כדי להבין מה עובד, מה חוזר על עצמו, ואיפה להשתפר.',
      portfolioValue: 'שווי תיק נוכחי',
    },
    featuresHeader: {
      eyebrow: 'מה יש בפנים',
      title: 'כלים שגורמים לך לחזור על מה שעובד',
      subtitle: 'הכל באתר אחד: קליטת עסקאות, ניתוח, סטטיסטיקה וגלריית תוצאות.',
    },
    features: [
      { icon: 'auto_awesome', title: 'ניתוח AI מתקדם', desc: 'העלה צילום של גרף וה-AI יזהה אוטומטית את הצמד, הכניסה, היציאה וה-SL.' },
      { icon: 'monitoring', title: 'סטטיסטיקות עומק', desc: 'אחוז זכייה, Profit Factor, Drawdown, גרף הון ולוח חודשי של P&L.' },
      { icon: 'psychology', title: 'ניהול אסטרטגיות', desc: 'בנה אסטרטגיות, תייג עסקאות ועקוב אחרי הביצועים של כל אחת בנפרד.' },
      { icon: 'cases', title: 'תיקים מרובים', desc: 'נהל עד 3 תיקים פעילים במנוי PRO: פורקס, מניות, קריפטו, חוזים ועוד.' },
      { icon: 'event_available', title: 'ניתוח לפי ימים', desc: 'גלה באיזה יום בשבוע אתה הכי חזק וקבל תובנות לבניית שגרת מסחר חכמה.' },
      { icon: 'photo_library', title: 'גלריית הוכחות', desc: 'שמור צילומי payouts, תעודות מבחן, צילומי מסך ופרטי גישה במקום אחד.' },
    ],
    ai: {
      eyebrow: 'AI Engine',
      titleLead: 'AI ש',
      titleAccent: 'קורא גרפים',
      titleTail: '— לא עוד יומן ידני.',
      subtitle: 'מבוסס על מודל הראייה של Anthropic Claude. מצילום בודד: שש נקודות נתונים, פחות משלוש שניות, אפס הקלדה.',
      detected: 'זוהה אוטומטית',
      fields: [
        ['שם הצמד', 'EUR/USD'],
        ['מחיר כניסה', '1.0823'],
        ['מחיר יציאה', '1.0867'],
        ['Stop Loss', '1.0795'],
        ['כיוון', 'LONG'],
        ['יחס R / R', '1 : 1.6'],
      ],
      stats: [
        ['< 3s', 'זמן ניתוח'],
        ['6+', 'נקודות נתונים'],
        ['100%', 'ניתן לעריכה'],
      ],
      steps: [
        { icon: 'photo_camera', title: 'צלם את הגרף' },
        { icon: 'auto_awesome', title: 'ה-AI מנתח' },
        { icon: 'show_chart', title: 'עקוב והשתפר' },
      ],
    },
    pricing: {
      eyebrow: 'מחירים',
      title: 'תכנית פשוטה. בלי שלבי ביניים.',
      subtitle: 'תתחיל בחינם. תשדרג ל-PRO ברגע שתרצה את כל הכלים.',
      popular: 'מומלץ',
      free: {
        name: 'חינמי',
        price: '$0',
        period: 'לתמיד',
        desc: 'בשביל להתחיל לבנות שגרה',
        perks: ['תיק מסחר אחד', 'עד 20 עסקאות', 'דשבורד בסיסי', 'הוספה ידנית של עסקאות'],
        locked: ['ניתוח AI של גרפים', 'עמוד סטטיסטיקות מתקדם', 'אסטרטגיות', 'ארכיון תיקים'],
      },
      pro: {
        name: 'PRO',
        price: '$20',
        period: 'לחודש',
        desc: 'הכל פתוח. בלי הגבלות.',
        perks: ['עד 3 תיקים פעילים', 'עסקאות ללא הגבלה', 'ניתוח AI מלא של גרפים', 'עמוד סטטיסטיקות מתקדם', 'מערכת אסטרטגיות', 'ארכיון תיקים שלם', 'גלריית הוכחות', 'תמיכת PRO'],
      },
    },
    faqHeader: { eyebrow: 'שאלות נפוצות', title: 'כל מה שצריך לדעת' },
    faqs: [
      ['מה זה UPLOTRADE?', 'יומן מסחר חכם שמלווה אותך לאורך הקריירה שלך: מנתח גרפים בעזרת AI, מציג סטטיסטיקות מתקדמות ועוזר לזהות מה עובד לך ומה לא.'],
      ['איך ה-AI עובד?', 'מודלי vision של Anthropic מזהים מתוך צילום מסך את הצמד, מחיר הכניסה, מחיר היציאה וה-Stop Loss. תמיד אפשר לערוך ידנית לפני שמירה.'],
      ['האם הנתונים שלי בטוחים?', 'כן. הנתונים מאוחסנים ב-Supabase עם הצפנה והרשאות ברמת המשתמש. רק אתה רואה את העסקאות שלך.'],
      ['אפשר לבטל בכל זמן?', 'כן. ביטול המנוי נעשה מתוך הגדרות החשבון, וה-PRO ימשיך לפעול עד סוף תקופת החיוב הנוכחית.'],
      ['מתאים גם לסוחרים מתחילים?', 'בהחלט. הממשק נקי בכוונה: אתה מעלה עסקאות ו-UPLOTRADE עושה את עבודת הסטטיסטיקות.'],
      ['אפשר להשתמש בנייד?', 'כן. הדשבורד, הוספת עסקה וניתוח גרפים עובדים גם במובייל.'],
    ],
    footer: 'כל הזכויות שמורות.',
  },
  en: {
    nav: [
      { id: 'features', label: 'Features' },
      { id: 'pricing', label: 'Pricing' },
      { id: 'faq', label: 'FAQ' },
    ],
    hero: {
      titleLead: 'A smarter trading journal',
      titleAccent: 'built around your data',
      titleTail: '.',
      subtitle: 'UPLOTRADE brings your trades, AI chart analysis, and performance stats into one focused workspace so you can see what works and improve with clarity.',
      portfolioValue: 'Current portfolio value',
    },
    featuresHeader: {
      eyebrow: 'What is inside',
      title: 'Tools that help you repeat what works',
      subtitle: 'Trade capture, analysis, statistics, and result gallery in one focused workspace.',
    },
    features: [
      { icon: 'auto_awesome', title: 'Advanced AI analysis', desc: 'Upload a chart screenshot and AI detects the symbol, entry, exit, and SL automatically.' },
      { icon: 'monitoring', title: 'Deep statistics', desc: 'Win rate, Profit Factor, Drawdown, equity curve, and monthly P&L calendar.' },
      { icon: 'psychology', title: 'Strategy tracking', desc: 'Build strategies, tag trades, and track each setup separately.' },
      { icon: 'cases', title: 'Multiple portfolios', desc: 'Manage up to 3 active PRO portfolios: forex, stocks, crypto, futures, and more.' },
      { icon: 'event_available', title: 'Day-of-week analysis', desc: 'See which trading days perform best and shape a smarter routine.' },
      { icon: 'photo_library', title: 'Proof gallery', desc: 'Keep payout screenshots, certificates, chart screenshots, and access details in one place.' },
    ],
    ai: {
      eyebrow: 'AI Engine',
      titleLead: 'AI that ',
      titleAccent: 'reads charts',
      titleTail: '— no more manual journal.',
      subtitle: 'Powered by Anthropic Claude vision. One screenshot, six data points, under three seconds, zero typing.',
      detected: 'Automatically detected',
      fields: [
        ['Symbol', 'EUR/USD'],
        ['Entry price', '1.0823'],
        ['Exit price', '1.0867'],
        ['Stop Loss', '1.0795'],
        ['Direction', 'LONG'],
        ['R / R ratio', '1 : 1.6'],
      ],
      stats: [
        ['< 3s', 'Analysis time'],
        ['6+', 'Data points'],
        ['100%', 'Editable'],
      ],
      steps: [
        { icon: 'photo_camera', title: 'Capture the chart' },
        { icon: 'auto_awesome', title: 'AI analyzes it' },
        { icon: 'show_chart', title: 'Track and improve' },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'Start free. Grow into PRO.',
      subtitle: 'UPLOTRADE is built so every trader can begin journaling first. When you need advanced tools, the PRO upgrade waits inside the dashboard.',
      popular: 'Recommended',
      free: {
        name: 'Free',
        price: '$0',
        period: 'forever',
        desc: 'For building your first routine',
        perks: ['One trading portfolio', 'Up to 20 trades', 'Basic dashboard', 'Manual trade entry'],
        locked: ['AI chart analysis', 'Advanced statistics page', 'Strategies', 'Portfolio archive'],
      },
      pro: {
        name: 'PRO',
        price: '$20',
        period: 'per month',
        desc: 'Everything unlocked. No limits.',
        perks: ['Up to 3 active portfolios', 'Unlimited trades', 'Full AI chart analysis', 'Advanced statistics page', 'Strategy system', 'Full portfolio archive', 'Proof gallery', 'PRO support'],
      },
    },
    faqHeader: { eyebrow: 'FAQ', title: 'Everything you need to know' },
    faqs: [
      ['What is UPLOTRADE?', 'A smart trading journal that analyzes charts with AI, shows advanced statistics, and helps you understand what is working and what is not.'],
      ['How does the AI work?', 'Anthropic vision models detect the symbol, entry, exit, and Stop Loss from a chart screenshot. You can always edit the data before saving.'],
      ['Is my data secure?', 'Yes. Your data is stored in Supabase with encryption and user-level permissions. Only you can access your trades.'],
      ['Can I cancel anytime?', 'Yes. You can cancel from account settings, and PRO stays active until the end of the current billing period.'],
      ['Is it good for beginners?', 'Absolutely. The interface is intentionally clean: you upload trades and UPLOTRADE handles the statistics.'],
      ['Can I use it on mobile?', 'Yes. Dashboard, trade entry, and chart analysis all work on mobile.'],
    ],
    footer: 'All rights reserved.',
  },
} as const

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [scrolled, setScrolled] = useState(false)
  const router = useRouter()
  const { language, currency } = useApp()
  const copy = COPY[language]
  const isHe = language === 'he'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const targets = document.querySelectorAll('[data-animate]')
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          ;(entry.target as HTMLElement).dataset.visible = 'true'
          io.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    targets.forEach(target => io.observe(target))
    return () => io.disconnect()
  }, [language])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' })
  }

  const goLogin = () => router.push('/auth/login')

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Heebo, Manrope, sans-serif', minHeight: '100vh', overflow: 'hidden' }}>
      <div className="lp-grid-bg" />

      <nav className={`lp-nav ${scrolled ? 'lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <a href="#hero" onClick={e => { e.preventDefault(); scrollTo('hero') }} className="lp-logo">
            <LogoMark size={34} />
            <span>UPLOTRADE</span>
          </a>

          <div className="lp-nav-links">
            {copy.nav.map(item => (
              <a key={item.id} href={`#${item.id}`} onClick={e => { e.preventDefault(); scrollTo(item.id) }}>
                {item.label}
              </a>
            ))}
          </div>

          <button onClick={goLogin} className="lp-nav-cta">
            {isHe ? 'הרשם עכשיו בחינם' : 'Join free now'}
          </button>
        </div>
      </nav>

      <main>
        <section id="hero" className="lp-hero">
          <div className="lp-hero-inner">
            <h1 data-animate>
              {copy.hero.titleLead}{' '}
              <span>{copy.hero.titleAccent}</span>
              {' '}{copy.hero.titleTail}
            </h1>

            <p data-animate className="lp-subtitle">{copy.hero.subtitle}</p>

            <div data-animate className="lp-preview">
              <div className="lp-shot-shadow" aria-hidden="true" />
              <div className="lp-dashboard-frame">
                <div className="lp-dashboard-shot">
                  <aside className="lp-shot-sidebar" aria-hidden="true">
                    <LogoMark size={30} />
                    {['space_dashboard', 'add_chart', 'monitoring', 'photo_library', 'settings'].map((icon, index) => (
                      <span key={icon} className={index === 0 ? 'active' : ''}>
                        <Icon name={icon} size={15} color={index === 0 ? '#22c55e' : 'var(--text3)'} />
                      </span>
                    ))}
                  </aside>

                  <div className="lp-shot-main">
                    <header className="lp-shot-header">
                      <div>
                        <small>UPLOTRADE</small>
                        <h3>{isHe ? 'דשבורד מסחר' : 'Trading dashboard'}</h3>
                      </div>
                      <div className="lp-shot-tabs" dir="ltr">
                        <span className="active">1M</span>
                        <span>3M</span>
                        <span>ALL</span>
                      </div>
                    </header>

                    <div className="lp-shot-grid">
                      <section className="lp-shot-panel balance">
                        <div className="lp-shot-section-title">
                          <span>
                            <Icon name="space_dashboard" size={14} color="#0f8d63" />
                            {isHe ? 'סקירה כללית' : 'Overview'}
                          </span>
                          <strong>Forex</strong>
                        </div>

                        <div className="lp-shot-balance-row">
                          <div>
                            <small>{copy.hero.portfolioValue}</small>
                            <b dir="ltr">{formatMoney(254890, currency)}</b>
                          </div>
                          <div>
                            <small>{isHe ? 'תשואה' : 'Return'}</small>
                            <b dir="ltr">+12.4%</b>
                          </div>
                        </div>

                        <div className="lp-shot-stat-row">
                          {[
                            ['TRADES', '142'],
                            ['PROFIT FACTOR', '2.34'],
                            ['WIN RATE', '67%'],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <small>{label}</small>
                              <strong dir="ltr">{value}</strong>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="lp-shot-panel performance">
                        <div className="lp-shot-section-title">
                          <span>
                            <Icon name="monitoring" size={14} color="#0f8d63" />
                            {isHe ? 'נתוני ביצועים' : 'Performance'}
                          </span>
                        </div>
                        <div className="lp-shot-winrate">
                          <svg viewBox="0 0 184 104" aria-hidden="true">
                            <path d="M 20 88 A 72 72 0 0 1 164 88" pathLength={100} />
                            <path d="M 20 88 A 72 72 0 0 1 164 88" pathLength={100} />
                          </svg>
                          <strong dir="ltr">67%</strong>
                        </div>
                        <div className="lp-shot-metric-pair">
                          <span dir="ltr">{formatSignedMoney(8240, currency)}</span>
                          <span dir="ltr">2.34 PF</span>
                        </div>
                      </section>

                      <section className="lp-shot-panel chart">
                        <div className="lp-shot-chart-title">
                          <span>{isHe ? 'עקומת הון' : 'Equity curve'}</span>
                          <strong dir="ltr">{formatSignedMoney(24890, currency)}</strong>
                        </div>
                        <div className="lp-shot-chart" dir="ltr">
                          <span />
                          <svg viewBox="0 0 680 170" preserveAspectRatio="none" aria-hidden="true">
                            <path d="M0 128 C70 120 98 86 150 92 C215 99 230 52 300 62 C372 72 398 34 466 44 C548 56 592 22 680 28" />
                            <path d="M0 128 C70 120 98 86 150 92 C215 99 230 52 300 62 C372 72 398 34 466 44 C548 56 592 22 680 28 L680 170 L0 170 Z" />
                          </svg>
                        </div>
                      </section>

                      <section className="lp-shot-panel trades">
                        <div className="lp-shot-section-title">
                          <span>
                            <Icon name="show_chart" size={14} color="#0f8d63" />
                            {isHe ? 'עסקאות אחרונות' : 'Recent trades'}
                          </span>
                          <strong>LIVE</strong>
                        </div>
                        {[
                          ['EUR/USD', 'LONG', 420],
                          ['NASDAQ', 'BUY', 310],
                          ['BTC/USD', 'SHORT', -95],
                        ].map(([symbol, side, pnl]) => (
                          <div key={symbol} className="lp-shot-trade">
                            <span>{symbol}</span>
                            <small>{side}</small>
                            <strong dir="ltr" className={(pnl as number) < 0 ? 'loss' : ''}>{formatSignedMoney(pnl as number, currency)}</strong>
                          </div>
                        ))}
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="lp-section">
          <SectionTitle eyebrow={copy.featuresHeader.eyebrow} title={copy.featuresHeader.title} subtitle={copy.featuresHeader.subtitle} />
          <div className="lp-feature-grid">
            {copy.features.map((feature, index) => (
              <article key={index} data-animate className="lp-card">
                <div className="lp-card-icon">
                  <Icon name={feature.icon} size={24} color="#0f8d63" />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="lp-section narrow">
          <SectionTitle eyebrow={copy.pricing.eyebrow} title={copy.pricing.title} subtitle={copy.pricing.subtitle} />
          <div className="lp-pricing-grid">
            <PlanCard plan={copy.pricing.free} isPro={false} />
            <PlanCard plan={copy.pricing.pro} isPro popular={copy.pricing.popular} />
          </div>
        </section>

        <section id="faq" className="lp-section faq">
          <SectionTitle eyebrow={copy.faqHeader.eyebrow} title={copy.faqHeader.title} />
          <div className="lp-faq-list">
            {copy.faqs.map(([question, answer], index) => {
              const open = openFaq === index
              return (
                <article key={question} data-animate className={`lp-faq ${open ? 'open' : ''}`}>
                  <button onClick={() => setOpenFaq(open ? null : index)}>
                    <span>{question}</span>
                    <Icon name="expand_more" size={16} color={open ? '#0f8d63' : 'var(--text2)'} />
                  </button>
                  <div><p>{answer}</p></div>
                </article>
              )
            })}
          </div>
        </section>

        <footer className="lp-footer">
          <div>
            <LogoMark size={26} />
            <strong>UPLOTRADE</strong>
          </div>
          <p>© {new Date().getFullYear()} UPLOTRADE. {copy.footer}</p>
        </footer>
      </main>

      <style jsx global>{`
        .lp-grid-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(circle at 14% 10%, rgba(56,189,248,0.18), transparent 28rem),
            radial-gradient(circle at 86% 8%, rgba(168,85,247,0.20), transparent 30rem),
            radial-gradient(circle at 18% 48%, rgba(54,203,97,0.13), transparent 32rem),
            radial-gradient(circle at 84% 62%, rgba(168,85,247,0.14), transparent 34rem),
            radial-gradient(circle at 42% 92%, rgba(54,203,97,0.10), transparent 30rem),
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(180deg, rgba(0,0,0,0.18), transparent 24%, rgba(0,0,0,0.22)),
            var(--bg);
          background-size: auto, auto, auto, auto, auto, 64px 64px, 64px 64px, auto, auto;
        }
        .lp-nav {
          position: fixed;
          top: 0;
          inset-inline: 0;
          height: 78px;
          z-index: 50;
          transition: all 0.25s ease;
          border-bottom: 1px solid transparent;
        }
        .lp-nav-scrolled {
          background: rgba(7,10,15,0.82);
          backdrop-filter: blur(18px);
          border-bottom-color: rgba(255,255,255,0.08);
        }
        .lp-nav-inner {
          max-width: 1280px;
          height: 100%;
          margin: 0 auto;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }
        .lp-logo, .lp-footer > div {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text);
          text-decoration: none;
          font-family: Manrope, Heebo, sans-serif;
          font-weight: 800;
          letter-spacing: 0;
        }
        .lp-logo > span { font-size: 21px; }
        .lp-logo span span, .lp-footer span { color: #0f8d63; }
        .lp-nav-links {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 5px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          background: rgba(255,255,255,0.035);
        }
        .lp-nav-links a {
          padding: 8px 15px;
          border-radius: 999px;
          color: var(--text2);
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          transition: color 0.15s, background 0.15s;
        }
        .lp-nav-links a:hover {
          color: var(--text);
          background: rgba(255,255,255,0.07);
        }
        .lp-nav-cta {
          position: relative;
          isolation: isolate;
          min-height: 42px;
          padding: 0 20px;
          border: 1px solid rgba(54,203,97,0.38);
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(54,203,97,0.95), rgba(15,141,99,0.92));
          color: #fff;
          font: 900 14px Heebo, Manrope, sans-serif;
          cursor: pointer;
          overflow: hidden;
          box-shadow: 0 12px 34px rgba(15,141,99,0.36), 0 0 0 1px rgba(255,255,255,0.08) inset;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          white-space: nowrap;
        }
        .lp-nav-cta::before {
          content: '';
          position: absolute;
          inset: -2px;
          z-index: -1;
          background: linear-gradient(90deg, #38bdf8, #a855f7, #36cb61, #38bdf8);
          background-size: 220% 100%;
          opacity: 0;
          transition: opacity 0.18s ease;
        }
        .lp-nav-cta::after {
          content: '';
          position: absolute;
          top: -40%;
          bottom: -40%;
          width: 34px;
          inset-inline-start: -44px;
          transform: rotate(18deg);
          background: rgba(255,255,255,0.34);
          filter: blur(2px);
          transition: inset-inline-start 0.45s ease;
        }
        .lp-nav-cta:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.34);
          box-shadow: 0 18px 46px rgba(54,203,97,0.42), 0 0 28px rgba(168,85,247,0.22);
        }
        .lp-nav-cta:hover::before {
          opacity: 1;
          animation: lpCtaGlow 2.6s linear infinite;
        }
        .lp-nav-cta:hover::after {
          inset-inline-start: calc(100% + 44px);
        }
        main {
          position: relative;
          z-index: 1;
        }
        .lp-hero {
          min-height: 92svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 112px 24px 62px;
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }
        .lp-hero::after {
          content: '';
          position: absolute;
          inset: auto 0 0;
          height: 26%;
          z-index: -1;
          background: linear-gradient(180deg, transparent, rgba(7,10,15,0.18));
        }
        .lp-hero-inner {
          width: 100%;
          max-width: 1120px;
          text-align: center;
          display: grid;
          justify-items: center;
          position: relative;
        }
        .lp-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 12px;
          font-weight: 800;
          color: #0f8d63;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 18px;
          backdrop-filter: blur(14px);
        }
        .lp-hero h1 {
          margin: 0 0 16px;
          color: var(--text);
          font-size: clamp(40px, 5.15vw, 68px);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: 0;
          max-width: 920px;
          text-wrap: balance;
        }
        .lp-hero h1 span, .lp-ai-head h2 span {
          background: linear-gradient(90deg, #31d18d 0%, #0f8d63 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-subtitle {
          max-width: 720px;
          margin: 0 auto 26px;
          color: var(--text2);
          font-size: 17px;
          font-weight: 650;
          line-height: 1.7;
        }
        .lp-cta-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 34px;
        }
        .lp-primary, .lp-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 12px;
          padding: 15px 32px;
          font-family: Heebo, Manrope, sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .lp-primary {
          background: #0f8d63;
          color: #fff;
          border: none;
          box-shadow: 0 8px 32px rgba(15,141,99,0.45);
        }
        .lp-primary.small {
          padding: 9px 22px;
          border-radius: 10px;
          font-size: 14px;
          box-shadow: 0 4px 16px rgba(15,141,99,0.35);
        }
        .lp-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(15,141,99,0.6);
        }
        .lp-secondary {
          background: transparent;
          color: var(--text);
          border: 1px solid rgba(255,255,255,0.18);
        }
        .lp-secondary:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.3);
        }
        .lp-preview, .lp-ai-card {
          background: rgba(7,10,15,0.78);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 22px;
          box-shadow: 0 32px 90px rgba(0,0,0,0.46);
          overflow: hidden;
          position: relative;
          backdrop-filter: blur(18px);
        }
        .lp-preview {
          width: min(100%, 940px);
          margin: 10px auto 0;
          padding: 0;
          text-align: start;
          display: block;
          overflow: visible;
          border: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
          perspective: none;
        }
        .lp-preview::before {
          display: none;
        }
        .lp-shot-shadow {
          position: absolute;
          inset: 14% 8% -8% 10%;
          background: radial-gradient(closest-side, rgba(34,197,94,0.22), transparent 72%);
          filter: blur(34px);
          transform: none;
          pointer-events: none;
        }
        .lp-dashboard-frame {
          position: relative;
          transform: none;
          transform-origin: 50% 50%;
          clip-path: none;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 24px 70px rgba(0,0,0,0.46), 0 0 0 1px rgba(34,197,94,0.06);
          overflow: hidden;
          background: #070a0f;
        }
        .lp-dashboard-frame::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(56,189,248,0.10), transparent 24%),
            linear-gradient(270deg, rgba(168,85,247,0.12), transparent 26%),
            linear-gradient(180deg, rgba(255,255,255,0.09), transparent 22%);
        }
        .lp-dashboard-shot {
          min-height: 334px;
          display: grid;
          grid-template-columns: 70px minmax(0, 1fr);
          background:
            radial-gradient(circle at 12% 5%, rgba(15,141,99,0.16), transparent 28%),
            linear-gradient(135deg, rgba(9,18,25,0.98), rgba(7,10,15,0.98) 48%, rgba(20,13,35,0.98));
          transform: none;
          transform-origin: center;
          margin-inline: 0;
          padding-inline: 0;
        }
        .lp-shot-sidebar {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 13px;
          padding: 22px 0;
          border-inline-end: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.025);
        }
        .lp-shot-sidebar > svg {
          margin-bottom: 10px;
        }
        .lp-shot-sidebar span {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          border: 1px solid transparent;
        }
        .lp-shot-sidebar span.active {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.28);
        }
        .lp-shot-main {
          min-width: 0;
          padding: 20px;
        }
        .lp-shot-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }
        .lp-shot-header small {
          display: block;
          color: var(--text3);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          margin-bottom: 4px;
        }
        .lp-shot-header h3 {
          margin: 0;
          color: var(--text);
          font-size: 25px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 1.1;
        }
        .lp-shot-tabs {
          display: inline-flex;
          gap: 3px;
          padding: 4px;
          border-radius: 12px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .lp-shot-tabs span {
          min-width: 38px;
          padding: 7px 10px;
          border-radius: 9px;
          color: var(--text3);
          text-align: center;
          font-size: 11px;
          font-weight: 900;
        }
        .lp-shot-tabs span.active {
          background: #0f8d63;
          color: #fff;
        }
        .lp-shot-grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          grid-template-rows: 134px 142px;
          gap: 14px;
        }
        .lp-shot-panel {
          min-width: 0;
          overflow: hidden;
          border-radius: 15px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .lp-shot-panel.balance {
          padding: 14px 16px;
        }
        .lp-shot-panel.performance {
          padding: 14px 16px;
        }
        .lp-shot-panel.chart {
          padding: 13px 15px;
        }
        .lp-shot-panel.trades {
          padding: 14px 16px;
        }
        .lp-shot-section-title, .lp-shot-chart-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--text2);
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 10px;
        }
        .lp-shot-section-title span {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .lp-shot-section-title strong, .lp-shot-chart-title strong {
          color: #0f8d63;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }
        .lp-shot-balance-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-block: 1px solid rgba(255,255,255,0.09);
          margin-bottom: 10px;
        }
        .lp-shot-balance-row div {
          min-width: 0;
          padding: 10px 14px;
          text-align: center;
        }
        .lp-shot-balance-row div + div {
          border-inline-start: 1px solid rgba(255,255,255,0.09);
        }
        .lp-shot-balance-row small, .lp-shot-stat-row small {
          display: block;
          color: var(--text3);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .lp-shot-balance-row b {
          color: #22c55e;
          font-size: 23px;
          font-weight: 900;
          line-height: 1;
        }
        .lp-shot-stat-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .lp-shot-stat-row div {
          text-align: center;
        }
        .lp-shot-stat-row strong {
          color: var(--text);
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
        }
        .lp-shot-winrate {
          position: relative;
          height: 68px;
          max-width: 168px;
          margin: 0 auto 7px;
        }
        .lp-shot-winrate svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .lp-shot-winrate path:first-child {
          fill: none;
          stroke: rgba(255,255,255,0.09);
          stroke-width: 8;
          stroke-linecap: round;
        }
        .lp-shot-winrate path:last-child {
          fill: none;
          stroke: #22c55e;
          stroke-width: 9;
          stroke-linecap: round;
          stroke-dasharray: 67 100;
        }
        .lp-shot-winrate strong {
          position: absolute;
          inset-inline: 0;
          top: 27px;
          color: var(--text);
          text-align: center;
          font-size: 28px;
          font-weight: 900;
          line-height: 1;
        }
        .lp-shot-metric-pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .lp-shot-metric-pair span {
          padding: 8px 10px;
          border-radius: 9px;
          background: rgba(34,197,94,0.10);
          border: 1px solid rgba(34,197,94,0.18);
          color: #22c55e;
          font-size: 14px;
          font-weight: 900;
          text-align: center;
        }
        .lp-shot-panel.chart {
          grid-column: 1 / 2;
        }
        .lp-shot-panel.trades {
          grid-column: 2 / 3;
        }
        .lp-shot-chart-title span {
          color: var(--text2);
          font-weight: 900;
        }
        .lp-shot-chart {
          height: 92px;
          position: relative;
          overflow: hidden;
          border-radius: 13px;
          background:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 38px 38px;
        }
        .lp-shot-chart span {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(56,189,248,0.08), rgba(168,85,247,0.08), rgba(34,197,94,0.08));
        }
        .lp-shot-chart svg {
          position: absolute;
          inset: 12px 14px 8px;
          width: calc(100% - 28px);
          height: calc(100% - 20px);
        }
        .lp-shot-chart path:first-child {
          fill: none;
          stroke: #36cb61;
          stroke-width: 4;
          stroke-linecap: round;
        }
        .lp-shot-chart path:last-child {
          fill: rgba(54,203,97,0.14);
          stroke: none;
        }
        .lp-shot-trade {
          display: grid;
          grid-template-columns: minmax(72px, 1fr) auto auto;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid rgba(255,255,255,0.075);
          color: var(--text2);
          font-size: 13px;
          font-weight: 900;
        }
        .lp-shot-trade small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .lp-shot-trade strong {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }
        .lp-shot-trade strong.loss {
          color: #ef4444;
        }
        .lp-dashboard-rail {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 16px 0;
          border-radius: 16px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .lp-dashboard-rail span {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: transparent;
          border: 1px solid transparent;
        }
        .lp-dashboard-rail span.active {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.28);
          box-shadow: 0 10px 28px rgba(34,197,94,0.14);
        }
        .lp-dashboard-shell {
          position: relative;
          z-index: 1;
          min-width: 0;
          display: grid;
          gap: 12px;
        }
        .lp-dashboard-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 4px 4px 0;
        }
        .lp-dashboard-top h3 {
          margin: 0;
          color: var(--text);
          font-size: 24px;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: 0;
        }
        .lp-kicker {
          color: var(--text3);
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }
        .lp-dashboard-period {
          display: inline-flex;
          gap: 3px;
          padding: 4px;
          border-radius: 12px;
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .lp-dashboard-period span {
          min-width: 36px;
          padding: 7px 9px;
          border-radius: 9px;
          color: var(--text3);
          text-align: center;
          font-size: 11px;
          font-weight: 900;
        }
        .lp-dashboard-period span.active {
          color: #fff;
          background: #0f8d63;
        }
        .lp-dashboard-grid {
          display: grid;
          grid-template-columns: 1.35fr 0.75fr 0.75fr;
          gap: 12px;
        }
        .lp-balance-card, .lp-performance-card, .lp-trades-card {
          min-width: 0;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .lp-balance-card {
          grid-row: span 2;
          padding: 18px;
          display: flex;
          flex-direction: column;
        }
        .lp-balance-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .lp-balance-head span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .lp-balance-head strong {
          padding: 7px 11px;
          border-radius: 9px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }
        .lp-money {
          color: #22c55e;
          font-size: 42px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0;
        }
        .lp-preview-stats div, .lp-card, .lp-faq, .lp-steps div {
          background: transparent;
          border: 0;
          border-radius: 0;
        }
        .lp-preview-stats div {
          padding: 14px 18px;
          text-align: center;
          border-inline-start: 1px solid rgba(255,255,255,0.08);
        }
        .lp-preview-stats div:first-child {
          border-inline-start: 0;
        }
        .lp-preview-stats small {
          display: block;
          color: var(--text3);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }
        .lp-preview-stats strong {
          font-size: 22px;
          font-weight: 900;
        }
        .lp-equity-line {
          flex: 1;
          min-height: 152px;
          margin-top: 16px;
          position: relative;
          border-radius: 14px;
          background:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 42px 42px;
          overflow: hidden;
        }
        .lp-equity-line span {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(56,189,248,0.08), rgba(168,85,247,0.08), rgba(54,203,97,0.08));
        }
        .lp-equity-line svg {
          position: absolute;
          inset: 14px 18px 10px;
          width: calc(100% - 36px);
          height: calc(100% - 24px);
        }
        .lp-equity-line path:first-child {
          fill: none;
          stroke: #36cb61;
          stroke-width: 4;
          stroke-linecap: round;
        }
        .lp-equity-line path:last-child {
          fill: rgba(54,203,97,0.13);
          stroke: none;
        }
        .lp-performance-card {
          min-height: 126px;
          padding: 16px;
          display: grid;
          align-content: space-between;
          gap: 12px;
        }
        .lp-card-label {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .lp-performance-card > strong {
          color: var(--text);
          font-size: 31px;
          font-weight: 900;
          line-height: 1;
        }
        .lp-mini-meter {
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .lp-mini-meter span {
          display: block;
          width: 67%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #ef4444 0 24%, #22c55e 24% 100%);
        }
        .lp-mini-bars {
          height: 36px;
          display: flex;
          align-items: end;
          gap: 6px;
        }
        .lp-mini-bars span {
          flex: 1;
          min-width: 6px;
          border-radius: 6px 6px 0 0;
          background: linear-gradient(180deg, #22c55e, rgba(34,197,94,0.18));
        }
        .lp-trades-card {
          grid-column: span 2;
          padding: 15px 16px;
        }
        .lp-trades-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .lp-trades-head span {
          color: var(--text2);
          font-size: 14px;
          font-weight: 900;
        }
        .lp-trades-head strong {
          color: var(--text);
          font-size: 20px;
          font-weight: 900;
        }
        .lp-trade-row {
          display: grid;
          grid-template-columns: minmax(74px, 1fr) auto auto;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-top: 1px solid rgba(255,255,255,0.07);
          color: var(--text2);
          font-size: 13px;
          font-weight: 800;
        }
        .lp-trade-row small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .lp-trade-row strong {
          color: #22c55e;
          font-size: 13px;
          font-weight: 900;
        }
        .lp-trade-row strong.loss { color: #ef4444; }
        .lp-section {
          max-width: 1180px;
          margin: 0 auto;
          padding: 92px 24px;
          scroll-margin-top: 96px;
        }
        .lp-section.narrow { max-width: 960px; }
        .lp-section.faq { max-width: 780px; }
        .lp-section-title, .lp-ai-head {
          text-align: center;
          margin: 0 auto 40px;
          display: grid;
          justify-items: center;
          gap: 12px;
          max-width: 780px;
        }
        .lp-section-title small, .lp-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          padding: 6px 13px;
          border-radius: 999px;
          background: rgba(54,203,97,0.10);
          border: 1px solid rgba(54,203,97,0.22);
          color: #36cb61;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          line-height: 1;
        }
        .lp-section-title h2, .lp-ai-head h2 {
          max-width: 760px;
          margin: 0;
          font-size: clamp(34px, 4vw, 48px);
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: 0;
          text-wrap: balance;
        }
        .lp-section-title p, .lp-ai-head p {
          max-width: 660px;
          margin: 0;
          color: var(--text2);
          font-size: 16px;
          font-weight: 600;
          line-height: 1.65;
          text-wrap: balance;
        }
        .lp-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          border-top: 1px solid rgba(255,255,255,0.09);
          border-inline-start: 1px solid rgba(255,255,255,0.09);
        }
        .lp-card {
          padding: 30px;
          min-height: 238px;
          display: grid;
          align-content: start;
          justify-items: center;
          text-align: center;
          border-inline-end: 1px solid rgba(255,255,255,0.09);
          border-bottom: 1px solid rgba(255,255,255,0.09);
          transition: background 0.25s ease, transform 0.25s ease;
        }
        .lp-card:hover {
          transform: translateY(-3px);
          background: rgba(255,255,255,0.035);
        }
        .lp-card-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(54,203,97,0.10);
          border: 1px solid rgba(54,203,97,0.24);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 18px;
        }
        .lp-card h3 {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 900;
        }
        .lp-card p {
          margin: 0;
          color: var(--text2);
          font-size: 14px;
          line-height: 1.6;
        }
        .lp-ai-head { margin-bottom: 44px; }
        .lp-chip.pulse span, .lp-analyzing span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #0f8d63;
          box-shadow: 0 0 10px #0f8d63;
          animation: lpPulseDot 1.8s ease-in-out infinite;
        }
        .lp-ai-card {
          display: grid;
          grid-template-columns: 1.25fr 1fr;
          gap: 28px;
          padding: 18px;
          border-color: rgba(255,255,255,0.12);
          background:
            linear-gradient(135deg, rgba(56,189,248,0.08), transparent 36%),
            linear-gradient(225deg, rgba(168,85,247,0.08), transparent 36%),
            rgba(7,10,15,0.74);
        }
        .lp-chart {
          min-height: 340px;
          background: #06080d;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          position: relative;
          overflow: hidden;
          background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .lp-chart-title {
          position: absolute;
          top: 14px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 2;
        }
        .lp-chart-title strong { color: var(--text); font-size: 13px; }
        .lp-chart-title span {
          color: #22c55e;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 900;
        }
        .lp-chart-title small { color: var(--text3); font-weight: 800; }
        .lp-chart svg {
          position: absolute;
          inset: 44px 16px 16px;
          width: calc(100% - 32px);
          height: calc(100% - 60px);
        }
        .lp-chart svg line { stroke: rgba(255,255,255,0.25); stroke-dasharray: 4 4; }
        .lp-chart svg path:last-of-type { stroke: #22c55e; stroke-width: 2; }
        .lp-chart svg circle:first-of-type { fill: var(--text); stroke: #0a0c12; stroke-width: 2; }
        .lp-chart svg circle:last-of-type { fill: #22c55e; stroke: #0a0c12; stroke-width: 2; }
        .lp-scan {
          position: absolute;
          inset-inline: 16px;
          top: 44px;
          height: 50px;
          background: linear-gradient(180deg, transparent, rgba(15,141,99,0.22), transparent);
          border-top: 1px solid rgba(15,141,99,0.55);
          border-bottom: 1px solid rgba(15,141,99,0.55);
          animation: lpAiScan 3.6s ease-in-out infinite;
        }
        .lp-analyzing {
          position: absolute;
          bottom: 14px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(15,141,99,0.14);
          border: 1px solid rgba(15,141,99,0.35);
          color: #0f8d63;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .lp-fields {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
        }
        .lp-detected {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #0f8d63;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .lp-field {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          background: transparent;
          border: 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          border-radius: 0;
          padding: 12px 2px;
          animation: lpFieldFadeIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .lp-field span {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text2);
          font-size: 13px;
          font-weight: 700;
        }
        .lp-field span svg {
          background: rgba(15,141,99,0.2);
          border: 1px solid rgba(15,141,99,0.5);
          border-radius: 50%;
          padding: 3px;
          box-sizing: content-box;
        }
        .lp-field strong {
          color: var(--text);
          font: 900 14px Manrope, Heebo, sans-serif;
        }
        .lp-ai-stats {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.10);
        }
        .lp-ai-stats div {
          text-align: center;
        }
        .lp-ai-stats strong {
          display: block;
          color: #0f8d63;
          font: 900 28px Manrope, Heebo, sans-serif;
          line-height: 1;
          margin-bottom: 4px;
        }
        .lp-ai-stats span {
          color: var(--text3);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .lp-steps {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 32px;
        }
        .lp-steps div {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 16px;
          border-radius: 999px;
          color: var(--text2);
          font-size: 13px;
          font-weight: 800;
        }
        .lp-steps span {
          color: #0f8d63;
          background: rgba(15,141,99,0.15);
          border: 1px solid rgba(15,141,99,0.35);
          border-radius: 999px;
          padding: 1px 7px;
          font-size: 10px;
          font-weight: 900;
        }
        .lp-pricing-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 26px;
          overflow: hidden;
          background: rgba(255,255,255,0.025);
        }
        .lp-plan {
          position: relative;
          padding: 36px;
          border-radius: 0;
          background: transparent;
          border: 0;
          display: grid;
          justify-items: center;
          text-align: center;
        }
        .lp-plan.pro {
          background:
            linear-gradient(135deg, rgba(56,189,248,0.08), transparent 34%),
            linear-gradient(225deg, rgba(168,85,247,0.10), transparent 32%),
            rgba(54,203,97,0.055);
          border-inline-start: 1px solid rgba(255,255,255,0.10);
          box-shadow: none;
          overflow: hidden;
        }
        .lp-badge {
          position: absolute;
          top: 14px;
          inset-inline-end: 14px;
          color: #0f8d63;
          background: rgba(15,141,99,0.18);
          border: 1px solid rgba(15,141,99,0.45);
          border-radius: 6px;
          padding: 4px 9px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .lp-plan h3 {
          margin: 0 0 8px;
          color: var(--text3);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .lp-plan.pro h3 { color: #0f8d63; }
        .lp-price-row {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .lp-price-row strong {
          color: var(--text);
          font: 900 46px Manrope, Heebo, sans-serif;
          line-height: 1;
        }
        .lp-price-row span, .lp-plan-desc {
          color: var(--text3);
          font-size: 14px;
          font-weight: 700;
        }
        .lp-plan-desc { margin-bottom: 24px; }
        .lp-plan button {
          width: 100%;
          margin-bottom: 24px;
        }
        .lp-plan-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lp-plan-list div {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--text2);
          font-size: 14px;
          font-weight: 700;
          text-align: center;
        }
        .lp-plan.pro .lp-plan-list div { color: var(--text); }
        .lp-plan-list div.locked {
          color: var(--text3);
          opacity: 0.62;
        }
        .lp-faq-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          border-top: 1px solid rgba(255,255,255,0.09);
        }
        .lp-faq {
          overflow: hidden;
          transition: border-color 0.2s ease;
          border-bottom: 1px solid rgba(255,255,255,0.09);
        }
        .lp-faq.open { border-color: rgba(15,141,99,0.35); }
        .lp-faq button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 20px 22px;
          background: transparent;
          border: none;
          color: var(--text);
          cursor: pointer;
          text-align: inherit;
          font: 800 16px Heebo, Manrope, sans-serif;
        }
        .lp-faq button svg {
          flex: 0 0 auto;
          transition: transform 0.25s ease;
        }
        .lp-faq.open button svg { transform: rotate(180deg); }
        .lp-faq > div {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
        }
        .lp-faq.open > div { max-height: 260px; }
        .lp-faq p {
          margin: 0;
          padding: 0 22px 20px;
          color: var(--text2);
          font-size: 14px;
          line-height: 1.7;
        }
        .lp-footer {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .lp-footer strong { color: var(--text); font-size: 17px; }
        .lp-footer p {
          margin: 0;
          color: var(--text3);
          font-size: 13px;
          font-weight: 600;
        }
        [data-animate] {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1), transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
        }
        [data-animate][data-visible="true"] {
          opacity: 1;
          transform: translateY(0);
        }
        .lp-hero [data-animate] {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes lpPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.5); }
        }
        @keyframes lpAiScan {
          0% { transform: translateY(-50px); }
          50% { transform: translateY(calc(100% + 220px)); }
          100% { transform: translateY(-50px); }
        }
        @keyframes lpFieldFadeIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        [dir="rtl"] .lp-field { animation-name: lpFieldFadeInRtl; }
        @keyframes lpFieldFadeInRtl {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes lpCtaGlow {
          to { background-position: 220% 0; }
        }
        @media (max-width: 900px) {
          .lp-nav-links { display: none; }
          .lp-nav-inner { padding: 0 18px; }
          .lp-hero h1 { font-size: 44px; }
          .lp-subtitle { font-size: 16px; }
          .lp-section-title h2, .lp-ai-head h2 { font-size: clamp(31px, 5.4vw, 40px); }
          .lp-feature-grid, .lp-pricing-grid { grid-template-columns: 1fr; }
          .lp-ai-card { grid-template-columns: 1fr; padding: 24px; }
          .lp-chart { min-height: 250px; }
          .lp-ai-stats { grid-template-columns: 1fr; }
          .lp-preview { width: min(100%, 780px); }
          .lp-dashboard-frame {
            transform: none;
            clip-path: none;
          }
          .lp-dashboard-shot {
            min-height: 520px;
            grid-template-columns: 58px minmax(0, 1fr);
            transform: none;
            margin-inline: 0;
            padding-inline: 0;
          }
          .lp-shot-main { padding: 18px; }
          .lp-shot-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
          }
          .lp-shot-panel.chart, .lp-shot-panel.trades { grid-column: auto; }
          .lp-dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .lp-balance-card {
            grid-column: 1 / -1;
            grid-row: auto;
          }
          .lp-trades-card { grid-column: 1 / -1; }
        }
        @media (max-width: 560px) {
          .lp-primary, .lp-secondary { width: 100%; padding-inline: 20px; }
          .lp-hero h1 { font-size: 36px; }
          .lp-footer { align-items: flex-start; flex-direction: column; }
          .lp-dashboard-top {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }
        }
        @media (max-width: 640px) {
          .lp-grid-bg { background-size: auto, auto, auto, auto, auto, 42px 42px, 42px 42px, auto, auto; }
          .lp-nav {
            height: 66px;
            background: rgba(7,10,15,0.86);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .lp-nav-inner { padding: 0 14px; gap: 10px; }
          .lp-logo { gap: 8px; min-width: 0; }
          .lp-logo svg { width: 30px; height: 30px; }
          .lp-logo > span { font-size: 16px; line-height: 1; }
          .lp-nav-cta {
            min-height: 38px;
            padding: 0 13px;
            font-size: 12px;
          }
          .lp-primary.small {
            min-height: 40px;
            padding: 9px 15px;
            border-radius: 10px;
            font-size: 13px;
            white-space: nowrap;
          }
          .lp-hero {
            min-height: auto;
            padding: 92px 12px 42px;
            align-items: flex-start;
          }
          .lp-hero::after { height: 18%; }
          .lp-hero-inner { max-width: 100%; }
          .lp-chip {
            max-width: calc(100vw - 44px);
            justify-content: center;
            padding: 6px 11px;
            font-size: 10px;
            line-height: 1.2;
          }
          .lp-hero h1 {
            max-width: 350px;
            margin-bottom: 14px;
            font-size: clamp(34px, 10vw, 42px);
            line-height: 1.03;
          }
          .lp-subtitle {
            max-width: 330px;
            margin-bottom: 22px;
            font-size: 15px;
            line-height: 1.55;
          }
          .lp-cta-row {
            width: min(100%, 330px);
            gap: 10px;
            margin-bottom: 22px;
          }
          .lp-primary, .lp-secondary {
            width: 100%;
            min-height: 48px;
            padding: 12px 18px;
            border-radius: 12px;
            font-size: 15px;
          }
          .lp-preview {
            width: min(100%, 360px);
            margin-top: 14px;
            padding: 0;
            border-radius: 18px;
          }
          .lp-shot-shadow { inset: 18% 0 -6%; }
          .lp-dashboard-frame {
            border-radius: 18px;
            transform: none;
            clip-path: none;
          }
          .lp-dashboard-shot {
            min-height: 560px;
            grid-template-columns: 1fr;
            transform: none;
            margin-inline: 0;
            padding-inline: 0;
          }
          .lp-shot-sidebar {
            flex-direction: row;
            justify-content: center;
            gap: 9px;
            padding: 9px 14px;
            border-inline-end: 0;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .lp-shot-sidebar > svg { display: none; }
          .lp-shot-sidebar span {
            width: 30px;
            height: 30px;
            border-radius: 9px;
          }
          .lp-shot-main { padding: 14px; }
          .lp-shot-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 12px;
          }
          .lp-shot-header h3 { font-size: 20px; }
          .lp-shot-tabs span {
            min-width: 32px;
            padding: 6px 8px;
            font-size: 10px;
          }
          .lp-shot-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
            gap: 10px;
          }
          .lp-shot-panel.balance, .lp-shot-panel.performance, .lp-shot-panel.chart, .lp-shot-panel.trades {
            grid-column: auto;
            padding: 12px;
          }
          .lp-shot-balance-row { margin-bottom: 10px; }
          .lp-shot-balance-row div { padding: 11px 8px; }
          .lp-shot-balance-row b { font-size: 22px; }
          .lp-shot-stat-row { gap: 6px; }
          .lp-shot-stat-row small { font-size: 8px; }
          .lp-shot-stat-row strong { font-size: 15px; }
          .lp-shot-winrate {
            height: 68px;
            max-width: 142px;
          }
          .lp-shot-winrate strong {
            top: 27px;
            font-size: 26px;
          }
          .lp-shot-chart { height: 96px; }
          .lp-shot-trade {
            grid-template-columns: minmax(66px, 1fr) auto auto;
            gap: 8px;
            padding: 8px 0;
            font-size: 12px;
          }
          .lp-dashboard-rail {
            flex-direction: row;
            justify-content: center;
            padding: 8px;
            border-radius: 14px;
          }
          .lp-dashboard-rail span { width: 32px; height: 32px; border-radius: 10px; }
          .lp-dashboard-shell { gap: 10px; }
          .lp-dashboard-top { padding: 0; }
          .lp-dashboard-top h3 { font-size: 19px; }
          .lp-kicker { font-size: 10px; }
          .lp-money { font-size: 32px; }
          .lp-dashboard-period span {
            min-width: 32px;
            padding: 6px 8px;
            font-size: 10px;
          }
          .lp-dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .lp-balance-card {
            grid-column: 1 / -1;
            grid-row: auto;
            padding: 14px;
          }
          .lp-balance-head { margin-bottom: 8px; }
          .lp-balance-head span { font-size: 10px; }
          .lp-balance-head strong { padding: 6px 9px; font-size: 12px; }
          .lp-equity-line {
            height: 92px;
            margin-top: 12px;
            border-radius: 14px;
          }
          .lp-performance-card {
            min-height: 112px;
            padding: 12px;
            gap: 8px;
          }
          .lp-card-label { font-size: 9px; gap: 6px; }
          .lp-performance-card > strong { font-size: 25px; }
          .lp-mini-bars { height: 28px; gap: 4px; }
          .lp-trades-card {
            grid-column: 1 / -1;
            padding: 12px;
          }
          .lp-trade-row {
            grid-template-columns: minmax(68px, 1fr) auto auto;
            gap: 8px;
            font-size: 12px;
          }
          .lp-section { padding: 58px 16px; }
          .lp-section-title, .lp-ai-head {
            max-width: 340px;
            margin-bottom: 30px;
            gap: 10px;
          }
          .lp-section-title small, .lp-chip {
            min-height: 28px;
            padding: 6px 11px;
            font-size: 10px;
          }
          .lp-section-title h2, .lp-ai-head h2 {
            font-size: clamp(27px, 8vw, 34px);
            line-height: 1.12;
          }
          .lp-section-title p, .lp-ai-head p {
            font-size: 14px;
            line-height: 1.6;
          }
          .lp-feature-grid {
            display: grid;
            grid-template-columns: 1fr;
            border: 1px solid rgba(255,255,255,0.09);
            border-bottom: 0;
            border-radius: 20px;
            overflow: hidden;
          }
          .lp-card {
            min-height: auto;
            padding: 24px 18px;
            border-inline-end: 0;
          }
          .lp-card h3 { font-size: 18px; }
          .lp-card p { max-width: 292px; }
          .lp-ai-card {
            padding: 14px;
            gap: 18px;
            border-radius: 20px;
          }
          .lp-chart {
            min-height: 210px;
            border-radius: 15px;
          }
          .lp-fields { gap: 0; }
          .lp-field { padding: 11px 0; }
          .lp-ai-stats {
            gap: 0;
            padding-top: 14px;
          }
          .lp-ai-stats div {
            padding: 12px 0;
            border-top: 1px solid rgba(255,255,255,0.08);
          }
          .lp-ai-stats div:first-child { border-top: 0; }
          .lp-steps {
            width: min(100%, 340px);
            margin: 20px auto 0;
            display: grid;
            grid-template-columns: 1fr;
          }
          .lp-steps div {
            justify-content: center;
            min-height: 42px;
          }
          .lp-pricing-grid { border-radius: 20px; }
          .lp-plan { padding: 30px 20px; }
          .lp-plan.pro { border-top: 1px solid rgba(255,255,255,0.10); }
          .lp-price-row strong { font-size: 40px; }
          .lp-plan-list { width: 100%; }
          .lp-faq-list {
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.09);
            border-bottom: 0;
          }
          .lp-faq button {
            padding: 18px 16px;
            font-size: 15px;
          }
          .lp-footer {
            justify-content: center;
            text-align: center;
            padding: 28px 18px 34px;
          }
        }
      `}</style>
    </div>
  )
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div data-animate className="lp-section-title">
      <small>{eyebrow}</small>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  )
}

function PlanCard({
  plan,
  isPro,
  popular,
}: {
  plan: {
    name: string
    price: string
    period: string
    desc: string
    perks: readonly string[]
    locked?: readonly string[]
  }
  isPro: boolean
  popular?: string
}) {
  return (
    <article data-animate className={`lp-plan ${isPro ? 'pro' : ''}`}>
      {popular ? <div className="lp-badge">{popular}</div> : null}
      <h3>{plan.name}</h3>
      <div className="lp-price-row">
        <strong dir="ltr">{plan.price}</strong>
        <span>{plan.period}</span>
      </div>
      <div className="lp-plan-desc">{plan.desc}</div>
      <div className="lp-plan-list">
        {plan.perks.map(perk => (
          <div key={perk}>
            <Icon name={isPro ? 'check_circle' : 'check'} size={16} color="#0f8d63" />
            {perk}
          </div>
        ))}
        {plan.locked?.map(item => (
          <div key={item} className="locked">
            <Icon name="lock" size={14} color="var(--text3)" />
            {item}
          </div>
        ))}
      </div>
    </article>
  )
}

function LogoMark({ size }: { size: number }) {
  return (
    <img src="/uplotrade-mark-cropped.png" alt="" aria-hidden="true" style={{ width: size * 1.18, height: size, objectFit: 'contain', flexShrink: 0 }} />
  )
}
