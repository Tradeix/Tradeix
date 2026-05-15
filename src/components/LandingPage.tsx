'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'
import { useApp } from '@/lib/app-context'

const COPY = {
  he: {
    nav: [
      { id: 'features', label: 'תכונות' },
      { id: 'how', label: 'איך זה עובד' },
      { id: 'pricing', label: 'מחירים' },
      { id: 'faq', label: 'שאלות נפוצות' },
    ],
    hero: {
      login: 'התחבר',
      eyebrow: 'יומן מסחר חכם עם AI',
      titleLead: 'עקוב, נתח,',
      titleAccent: 'השתפר',
      titleTail: '— בכל עסקה.',
      subtitle: 'UPLOTRADE מנתח את הגרפים שלך באמצעות AI, אוסף את הסטטיסטיקות, ועוזר לך לראות מה באמת עובד בלי טבלאות אקסל ובלי חישובים בראש.',
      primary: 'התחל בחינם',
      secondary: 'איך זה עובד',
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
        cta: 'התחל בחינם',
        desc: 'בשביל להתחיל לבנות שגרה',
        perks: ['תיק מסחר אחד', 'עד 20 עסקאות', 'דשבורד בסיסי', 'הוספה ידנית של עסקאות'],
        locked: ['ניתוח AI של גרפים', 'עמוד סטטיסטיקות מתקדם', 'אסטרטגיות', 'ארכיון תיקים'],
      },
      pro: {
        name: 'PRO',
        price: '$20',
        period: 'לחודש',
        cta: 'שדרג עכשיו',
        desc: 'הכל פתוח. בלי הגבלות.',
        perks: ['עד 3 תיקים פעילים', 'עסקאות ללא הגבלה', 'ניתוח AI מלא של גרפים', 'עמוד סטטיסטיקות מתקדם', 'מערכת אסטרטגיות', 'ארכיון תיקים שלם', 'גלריית הוכחות', 'תמיכת PRO'],
      },
    },
    faqHeader: { eyebrow: 'שאלות נפוצות', title: 'הכל מה שצריך לדעת' },
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
      { id: 'how', label: 'How it works' },
      { id: 'pricing', label: 'Pricing' },
      { id: 'faq', label: 'FAQ' },
    ],
    hero: {
      login: 'Log in',
      eyebrow: 'Smart trading journal with AI',
      titleLead: 'Track, analyze,',
      titleAccent: 'improve',
      titleTail: '— every trade.',
      subtitle: 'UPLOTRADE analyzes your charts with AI, collects your stats, and helps you see what actually works without spreadsheets or mental math.',
      primary: 'Start free',
      secondary: 'How it works',
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
      title: 'Simple plans. No middle tiers.',
      subtitle: 'Start free. Upgrade to PRO when you want every tool unlocked.',
      popular: 'Recommended',
      free: {
        name: 'Free',
        price: '$0',
        period: 'forever',
        cta: 'Start free',
        desc: 'For building your first routine',
        perks: ['One trading portfolio', 'Up to 20 trades', 'Basic dashboard', 'Manual trade entry'],
        locked: ['AI chart analysis', 'Advanced statistics page', 'Strategies', 'Portfolio archive'],
      },
      pro: {
        name: 'PRO',
        price: '$20',
        period: 'per month',
        cta: 'Upgrade now',
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
  const { language } = useApp()
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

          <button onClick={goLogin} className="lp-primary small">
            {copy.hero.login}
          </button>
        </div>
      </nav>

      <main>
        <section id="hero" className="lp-hero">
          <div className="lp-hero-orbit" aria-hidden="true">
            <div className="lp-market-tape">
              {['XAUUSD +2.8%', 'NQ +1.4%', 'EURUSD +0.6%', 'BTC +3.1%', 'ES -0.4%'].map(item => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="lp-hero-inner">
            <div data-animate className="lp-chip">
              <Icon name="auto_awesome" size={14} color="#0f8d63" />
              {copy.hero.eyebrow}
            </div>

            <h1 data-animate>
              {copy.hero.titleLead}{' '}
              <span>{copy.hero.titleAccent}</span>
              {' '}{copy.hero.titleTail}
            </h1>

            <p data-animate className="lp-subtitle">{copy.hero.subtitle}</p>

            <div data-animate className="lp-cta-row">
              <button onClick={goLogin} className="lp-primary">
                <Icon name="rocket_launch" size={18} color="#fff" />
                {copy.hero.primary}
              </button>
              <button onClick={() => scrollTo('how')} className="lp-secondary">
                {copy.hero.secondary}
                <Icon name={isHe ? 'arrow_back' : 'arrow_forward'} size={17} color="currentColor" />
              </button>
            </div>

            <div data-animate className="lp-preview">
              <div className="lp-preview-head">
                <div>
                  <div className="lp-kicker">{copy.hero.portfolioValue}</div>
                  <div dir="ltr" className="lp-money">$254,890</div>
                </div>
                <div dir="ltr" className="lp-growth">+12.4%</div>
              </div>
              <div className="lp-preview-stats">
                {[
                  ['WIN RATE', '67%', '#0f8d63'],
                  ['PROFIT FACTOR', '2.34', '#0f8d63'],
                  ['TRADES', '142', 'var(--text)'],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong style={{ color }}>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="lp-equity-line" dir="ltr">
                <span />
                <svg viewBox="0 0 680 170" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 128 C80 116 90 88 160 96 C230 104 240 48 315 62 C410 78 420 28 505 40 C590 52 600 20 680 26" />
                  <path d="M0 128 C80 116 90 88 160 96 C230 104 240 48 315 62 C410 78 420 28 505 40 C590 52 600 20 680 26 L680 170 L0 170 Z" />
                </svg>
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

        <section id="how" className="lp-section">
          <div data-animate className="lp-ai-head">
            <div className="lp-chip pulse"><span />{copy.ai.eyebrow}</div>
            <h2>{copy.ai.titleLead}<span>{copy.ai.titleAccent}</span> {copy.ai.titleTail}</h2>
            <p>{copy.ai.subtitle}</p>
          </div>

          <div data-animate className="lp-ai-card">
            <div className="lp-chart" dir="ltr">
              <div className="lp-chart-title">
                <strong>EUR/USD</strong>
                <span>LONG</span>
                <small>1H</small>
              </div>
              <svg viewBox="0 0 400 240" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lpPriceGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(34,197,94,0.32)" />
                    <stop offset="100%" stopColor="rgba(34,197,94,0)" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="60" x2="400" y2="60" />
                <line x1="0" y1="140" x2="400" y2="140" />
                <line x1="0" y1="200" x2="400" y2="200" />
                <path d="M 0 162 Q 50 154 100 148 Q 160 132 220 118 Q 280 96 340 78 L 400 60 L 400 240 L 0 240 Z" fill="url(#lpPriceGlow)" />
                <path d="M 0 162 Q 50 154 100 148 Q 160 132 220 118 Q 280 96 340 78 L 400 60" fill="none" />
                <circle cx="6" cy="140" r="5" />
                <circle cx="394" cy="60" r="5" />
              </svg>
              <div className="lp-scan" />
              <div className="lp-analyzing"><span />Analyzing</div>
            </div>

            <div className="lp-fields">
              <div className="lp-detected">
                <Icon name="auto_awesome" size={15} color="#0f8d63" />
                {copy.ai.detected}
              </div>
              {copy.ai.fields.map(([label, value], index) => (
                <div key={label} className="lp-field" style={{ animationDelay: `${0.12 + index * 0.06}s` }}>
                  <span><Icon name="check" size={12} color="#0f8d63" />{label}</span>
                  <strong dir="ltr">{value}</strong>
                </div>
              ))}
            </div>

            <div className="lp-ai-stats">
              {copy.ai.stats.map(([value, label]) => (
                <div key={label}>
                  <strong dir="ltr">{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div data-animate className="lp-steps">
            {copy.ai.steps.map((step, index) => (
              <div key={step.title}>
                <span>0{index + 1}</span>
                <Icon name={step.icon} size={14} color="var(--text2)" />
                {step.title}
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="lp-section narrow">
          <SectionTitle eyebrow={copy.pricing.eyebrow} title={copy.pricing.title} subtitle={copy.pricing.subtitle} />
          <div className="lp-pricing-grid">
            <PlanCard plan={copy.pricing.free} isPro={false} onClick={goLogin} />
            <PlanCard plan={copy.pricing.pro} isPro popular={copy.pricing.popular} onClick={goLogin} />
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
            linear-gradient(180deg, rgba(0,0,0,0.22), transparent 28%),
            linear-gradient(90deg, rgba(20,184,166,0.06), transparent 25%, transparent 75%, rgba(168,85,247,0.07)),
            var(--bg);
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 64px 64px;
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
        main {
          position: relative;
          z-index: 1;
        }
        .lp-hero {
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 118px 24px 74px;
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }
        .lp-hero::before {
          content: '';
          position: absolute;
          inset: 82px 24px 58px;
          z-index: -2;
          border-radius: 34px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            linear-gradient(135deg, rgba(14,165,233,0.12), transparent 28%),
            linear-gradient(225deg, rgba(168,85,247,0.12), transparent 30%),
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 40px 120px rgba(0,0,0,0.38);
        }
        .lp-hero::after {
          content: '';
          position: absolute;
          inset: auto 0 0;
          height: 26%;
          z-index: -1;
          background: linear-gradient(180deg, transparent, var(--bg));
        }
        .lp-hero-orbit {
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
        }
        .lp-market-tape {
          position: absolute;
          top: 114px;
          inset-inline: 58px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          opacity: 0.62;
        }
        .lp-market-tape span {
          color: var(--text3);
          font: 800 11px Manrope, Heebo, sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .lp-hero-inner {
          width: 100%;
          max-width: 1060px;
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
          margin: 0 0 18px;
          color: var(--text);
          font-size: clamp(44px, 6.4vw, 82px);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0;
          max-width: 980px;
          text-wrap: balance;
        }
        .lp-hero h1 span, .lp-ai-head h2 span {
          background: linear-gradient(90deg, #38bdf8 0%, #a855f7 45%, #36cb61 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-subtitle {
          max-width: 640px;
          margin: 0 auto 30px;
          color: var(--text2);
          font-size: 18px;
          font-weight: 500;
          line-height: 1.6;
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
          width: min(100%, 900px);
          margin: 16px auto 0;
          padding: 22px;
          text-align: start;
        }
        .lp-preview::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(56,189,248,0.10), transparent 30%),
            linear-gradient(270deg, rgba(168,85,247,0.10), transparent 30%);
          pointer-events: none;
        }
        .lp-preview-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-bottom: 16px;
          position: relative;
          z-index: 1;
        }
        .lp-kicker {
          color: var(--text3);
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }
        .lp-money {
          color: #22c55e;
          font-size: 42px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0;
        }
        .lp-growth {
          padding: 8px 16px;
          border-radius: 10px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          color: #22c55e;
          font-size: 14px;
          font-weight: 800;
        }
        .lp-preview-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          border-top: 1px solid rgba(255,255,255,0.08);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: relative;
          z-index: 1;
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
          height: 142px;
          margin-top: 18px;
          position: relative;
          z-index: 1;
          border-radius: 18px;
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
        .lp-section {
          max-width: 1180px;
          margin: 0 auto;
          padding: 96px 24px;
        }
        .lp-section.narrow { max-width: 960px; }
        .lp-section.faq { max-width: 780px; }
        .lp-section-title {
          text-align: center;
          margin: 0 auto 46px;
          display: grid;
          justify-items: center;
          gap: 10px;
          max-width: 780px;
        }
        .lp-section-title small {
          display: block;
          color: #36cb61;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .lp-section-title h2, .lp-ai-head h2 {
          margin: 0 0 14px;
          font-size: clamp(32px, 4vw, 54px);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: 0;
          text-wrap: balance;
        }
        .lp-section-title p, .lp-ai-head p {
          max-width: 620px;
          margin: 0;
          color: var(--text2);
          font-size: 17px;
          line-height: 1.6;
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
        .lp-ai-head {
          text-align: center;
          margin: 0 auto 50px;
          display: grid;
          justify-items: center;
          max-width: 780px;
        }
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
        @media (max-width: 900px) {
          .lp-nav-links { display: none; }
          .lp-nav-inner { padding: 0 18px; }
          .lp-hero h1 { font-size: 44px; }
          .lp-subtitle { font-size: 16px; }
          .lp-section-title h2, .lp-ai-head h2 { font-size: 32px; }
          .lp-feature-grid, .lp-pricing-grid { grid-template-columns: 1fr; }
          .lp-ai-card { grid-template-columns: 1fr; padding: 24px; }
          .lp-chart { min-height: 250px; }
          .lp-ai-stats { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .lp-primary, .lp-secondary { width: 100%; padding-inline: 20px; }
          .lp-hero h1 { font-size: 36px; }
          .lp-preview-head, .lp-footer { align-items: flex-start; flex-direction: column; }
          .lp-preview-stats { grid-template-columns: 1fr; }
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
  onClick,
}: {
  plan: {
    name: string
    price: string
    period: string
    cta: string
    desc: string
    perks: readonly string[]
    locked?: readonly string[]
  }
  isPro: boolean
  popular?: string
  onClick: () => void
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
      <button onClick={onClick} className={isPro ? 'lp-primary' : 'lp-secondary'}>
        {plan.cta}
      </button>
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
