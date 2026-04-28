'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/Icon'

const NAV_SECTIONS = [
  { id: 'features',    label: 'תכונות' },
  { id: 'how',         label: 'איך זה עובד' },
  { id: 'pricing',     label: 'מחירים' },
  { id: 'faq',         label: 'שאלות נפוצות' },
]

const FEATURES = [
  { icon: 'auto_awesome',  title: 'ניתוח AI מתקדם',   desc: 'העלה צילום של גרף, וה-AI יזהה אוטומטית את הצמד, הכניסה, היציאה וה-SL.' },
  { icon: 'monitoring',    title: 'סטטיסטיקות עומק',  desc: 'אחוז זכייה, Profit Factor, Drawdown, גרף הון, ולוח שנה חודשי של P&L.' },
  { icon: 'psychology',    title: 'ניהול אסטרטגיות',  desc: 'בנה אסטרטגיות, תייג עסקאות, ועקוב אחרי הביצועים של כל אחת בנפרד.' },
  { icon: 'cases',         title: 'תיקים מרובים',     desc: 'נהל עד 3 תיקים פעילים במנוי PRO — Forex, מניות, קריפטו, סחורות.' },
  { icon: 'event_available', title: 'ניתוח לפי יום',    desc: 'גלה באיזה יום בשבוע אתה הכי חזק וקבל תובנות לבניית שיגרת מסחר חכמה.' },
  { icon: 'photo_library', title: 'גלריית הוכחות',    desc: 'שמור צילומי payouts, תעודות מבחן, צילומי מסך ופרטי גישה במקום אחד.' },
]

const STEPS = [
  { icon: 'photo_camera',   title: 'צלם את הגרף',     desc: 'גרור צילום של ה-trade שלך לתוך הטופס — או הזן ידנית.' },
  { icon: 'auto_awesome',   title: 'ה-AI מנתח',        desc: 'תוך פחות משלוש שניות, הנתונים מזוהים ומסודרים אוטומטית.' },
  { icon: 'show_chart',     title: 'עקוב והשתפר',      desc: 'צבור היסטוריה, גלה דפוסים, ושפר את העקביות שלך לאורך זמן.' },
]

const FAQS = [
  { q: 'מה זה TRADEIX?',                          a: 'יומן מסחר חכם שמלווה אותך לאורך כל הקריירה שלך — מנתח גרפים בעזרת AI, מציג סטטיסטיקות מתקדמות ועוזר לזהות מה עובד לך ומה לא.' },
  { q: 'איך ה-AI עובד?',                          a: 'מודלי vision של Anthropic מזהים את הצמד, מחיר הכניסה, מחיר היציאה וה-Stop Loss מתוך צילום מסך של הגרף. בכל מקרה אתה יכול לערוך ידנית את הנתונים לפני שמירה.' },
  { q: 'האם הנתונים שלי בטוחים?',                  a: 'כן. הנתונים מאוחסנים ב-Supabase עם הצפנה והרשאות ברמת המשתמש. אף אחד מלבדך לא רואה את העסקאות.' },
  { q: 'אפשר לבטל בכל זמן?',                       a: 'כן. ביטול המנוי נעשה בלחיצה אחת מתוך הגדרות החשבון, וה-PRO ימשיך לפעול עד סוף תקופת החיוב הנוכחית.' },
  { q: 'מתאים גם לסוחרים מתחילים?',                 a: 'בהחלט. הממשק נוקה במכוון מסביבת מסחר עמוסה — אתה צריך רק להתחיל להעלות עסקאות, וה-TRADEIX יעשה את הקטע של הסטטיסטיקות.' },
  { q: 'אני יכול להשתמש בנייד?',                   a: 'כן. כל האתר רספונסיבי לחלוטין — דשבורד, הוספת עסקה, ניתוח גרפים, הכל עובד מצוין מהמובייל.' },
]

const PRICING = {
  free: {
    name: 'חינמי',
    price: '$0',
    period: 'לתמיד',
    cta: 'התחל בחינם',
    perks: [
      'תיק מסחר אחד',
      'עד 20 עסקאות',
      'דשבורד בסיסי',
      'הוספה ידנית של עסקאות',
    ],
    locked: [
      'ניתוח AI של גרפים',
      'עמוד סטטיסטיקות מתקדם',
      'אסטרטגיות',
      'ארכיון תיקים',
    ],
  },
  pro: {
    name: 'PRO',
    price: '$20',
    period: 'לחודש',
    cta: 'שדרג עכשיו',
    perks: [
      'עד 3 תיקים פעילים',
      'עסקאות ללא הגבלה',
      'ניתוח AI מלא של גרפים',
      'עמוד סטטיסטיקות מתקדם',
      'מערכת אסטרטגיות',
      'ארכיון תיקים שלם',
      'גלריית הוכחות',
      'תמיכת PRO',
    ],
  },
}

export default function LandingPage() {
  const [loading, setLoading] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [scrolled, setScrolled] = useState(false)
  const supabase = createClient()

  // Sticky-nav background appears once user scrolls past the hero band
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Reveal-on-scroll for any element with data-animate
  useEffect(() => {
    const targets = document.querySelectorAll('[data-animate]')
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          ;(e.target as HTMLElement).dataset.visible = 'true'
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    targets.forEach(t => io.observe(t))
    return () => io.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const navHeight = 70
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div dir="rtl" style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Heebo, sans-serif', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Animated grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'var(--bg)',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'gridDrift 90s linear infinite',
      }} />

      {/* Two soft green glows */}
      <div style={{ position: 'fixed', top: '10%', insetInlineEnd: '15%', width: '460px', height: '460px', borderRadius: '50%', background: 'rgba(15,141,99,0.10)', filter: 'blur(110px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '50%', insetInlineStart: '12%', width: '380px', height: '380px', borderRadius: '50%', background: 'rgba(15,141,99,0.07)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, insetInlineStart: 0, insetInlineEnd: 0,
        height: '70px', zIndex: 50,
        background: scrolled ? 'rgba(11,13,19,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.25s ease',
      }}>
        <div style={{
          maxWidth: '1280px', margin: '0 auto', height: '100%',
          padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }} className="lp-nav-inner">
          {/* Logo */}
          <a href="#hero" onClick={e => { e.preventDefault(); scrollTo('hero') }} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <svg width="34" height="34" viewBox="0 0 38 38" fill="none">
              <rect width="38" height="38" rx="8" fill="#0f8d63"/>
              <line x1="11" y1="8" x2="11" y2="30" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="8" y="13" width="6" height="10" rx="1.2" fill="rgba(255,255,255,0.55)"/>
              <line x1="19" y1="6" x2="19" y2="28" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="16" y="10" width="6" height="12" rx="1.2" fill="rgba(255,255,255,0.75)"/>
              <line x1="27" y1="9" x2="27" y2="31" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="24" y="14" width="6" height="11" rx="1.2" fill="white"/>
            </svg>
            <span style={{ fontFamily: 'Manrope, Heebo, sans-serif', fontWeight: '800', fontSize: '21px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Trade<span style={{ color: '#0f8d63' }}>IX</span>
            </span>
          </a>

          {/* Section links */}
          <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {NAV_SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={e => { e.preventDefault(); scrollTo(s.id) }}
                style={{
                  padding: '8px 14px', borderRadius: '10px',
                  color: 'var(--text2)', textDecoration: 'none',
                  fontSize: '14px', fontWeight: '600',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseOut={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'transparent' }}
              >
                {s.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="lp-nav-cta"
            style={{
              background: '#0f8d63', color: '#fff', border: 'none',
              borderRadius: '10px', padding: '9px 22px',
              fontSize: '14px', fontWeight: '700', cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'Heebo, sans-serif',
              boxShadow: '0 4px 16px rgba(15,141,99,0.35)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,141,99,0.5)' }}
            onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,141,99,0.35)' }}
          >
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>
        </div>
      </nav>

      <main style={{ position: 'relative', zIndex: 1 }}>
        {/* ── HERO ── */}
        <section id="hero" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px' }}>
          <div style={{ maxWidth: '900px', width: '100%', textAlign: 'center' }}>
            {/* Eyebrow chip */}
            <div data-animate style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '999px',
              background: 'rgba(15,141,99,0.08)',
              border: '1px solid rgba(15,141,99,0.25)',
              fontSize: '12px', fontWeight: '700', color: '#0f8d63',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              marginBottom: '24px',
            }}>
              <Icon name="auto_awesome" size={14} color="#0f8d63" />
              יומן מסחר חכם עם AI
            </div>

            <h1 data-animate className="lp-hero-title" style={{
              fontSize: '64px', fontWeight: '900', lineHeight: 1.05,
              letterSpacing: '-0.03em', margin: '0 0 22px',
              color: 'var(--text)',
            }}>
              עקוב, נתח,{' '}
              <span style={{
                background: 'linear-gradient(90deg, #0f8d63 0%, #14b886 50%, #0f8d63 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>השתפר</span>
              {' '}— בכל עסקה.
            </h1>

            <p data-animate className="lp-hero-sub" style={{
              fontSize: '19px', color: 'var(--text2)',
              maxWidth: '620px', margin: '0 auto 36px',
              lineHeight: 1.6, fontWeight: '500',
            }}>
              TRADEIX מנתח את הגרפים שלך באמצעות AI, אוסף את הסטטיסטיקות, וגורם לך לראות מה באמת עובד — בלי טבלאות אקסל ובלי חשבונות-בראש.
            </p>

            <div data-animate style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{
                  background: '#0f8d63', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '15px 32px',
                  fontSize: '16px', fontWeight: '800', cursor: loading ? 'wait' : 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: '10px',
                  boxShadow: '0 8px 32px rgba(15,141,99,0.45)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(15,141,99,0.6)' }}
                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(15,141,99,0.45)' }}
              >
                {loading ? (
                  <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity="0.85"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity="0.7"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity="0.55"/></svg>
                )}
                {loading ? 'מתחבר...' : 'התחל בחינם עם Google'}
              </button>
              <button
                onClick={() => scrollTo('how')}
                style={{
                  background: 'transparent', color: 'var(--text)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: '12px', padding: '15px 28px',
                  fontSize: '16px', fontWeight: '700', cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
              >
                איך זה עובד ←
              </button>
            </div>

            {/* Floating preview mock */}
            <div data-animate style={{ marginTop: '20px', position: 'relative' }}>
              <div style={{
                background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
                maxWidth: '760px', margin: '0 auto',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: '-100px', insetInlineEnd: '-80px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(15,141,99,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>שווי תיק נוכחי</div>
                    <div dir="ltr" style={{ fontSize: '38px', fontWeight: '900', color: '#22c55e', letterSpacing: '-0.02em', lineHeight: 1 }}>$254,890</div>
                  </div>
                  <div style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: '14px', fontWeight: '800' }} dir="ltr">+12.4%</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'WIN RATE', value: '67%', color: '#0f8d63' },
                    { label: 'PROFIT FACTOR', value: '2.34', color: '#0f8d63' },
                    { label: 'TRADES', value: '142', color: 'var(--text)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>{s.label}</div>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
            <div data-animate style={{ textAlign: 'center', marginBottom: '60px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f8d63', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '12px' }}>
                מה יש בפנים
              </div>
              <h2 className="lp-h2" style={{ fontSize: '44px', fontWeight: '900', letterSpacing: '-0.02em', margin: '0 0 14px', lineHeight: 1.1 }}>
                כלים שגורמים לך לחזור על מה שעובד
              </h2>
              <p style={{ fontSize: '17px', color: 'var(--text2)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
                הכל באתר אחד — מקליטה, ניתוח, סטטיסטיקה, ועד גלריית תוצאות.
              </p>
            </div>

            <div className="lp-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
              {FEATURES.map((f, i) => (
                <div key={i} data-animate className="lp-feature-card" style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: '18px',
                  padding: '28px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
                  cursor: 'default',
                }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(15,141,99,0.45)'; e.currentTarget.style.boxShadow = '0 18px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(15,141,99,0.15)' }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ position: 'absolute', top: '-30px', insetInlineEnd: '-30px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(15,141,99,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    background: 'rgba(15,141,99,0.12)',
                    border: '1px solid rgba(15,141,99,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '18px', position: 'relative',
                  }}>
                    <Icon name={f.icon} size={24} color="#0f8d63" />
                  </div>
                  <div style={{ fontSize: '19px', fontWeight: '800', color: 'var(--text)', marginBottom: '8px', position: 'relative' }}>{f.title}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6, position: 'relative' }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how" style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div data-animate style={{ textAlign: 'center', marginBottom: '60px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f8d63', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '12px' }}>איך זה עובד</div>
              <h2 className="lp-h2" style={{ fontSize: '44px', fontWeight: '900', letterSpacing: '-0.02em', margin: '0 0 14px', lineHeight: 1.1 }}>
                שלוש דקות מהרישום לעסקה הראשונה
              </h2>
            </div>

            <div className="lp-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px', position: 'relative' }}>
              {STEPS.map((s, i) => (
                <div key={i} data-animate style={{
                  background: 'linear-gradient(180deg, var(--bg2) 0%, rgba(11,13,19,0.6) 100%)',
                  border: '1px solid var(--border)',
                  borderRadius: '20px',
                  padding: '32px 24px 28px',
                  textAlign: 'center',
                  position: 'relative',
                }}>
                  <div style={{ position: 'absolute', top: '-18px', insetInlineStart: '50%', transform: 'translateX(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: '#0f8d63', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '900', color: '#fff', boxShadow: '0 6px 18px rgba(15,141,99,0.45)' }}>{i + 1}</div>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '18px',
                    background: 'rgba(15,141,99,0.12)',
                    border: '1px solid rgba(15,141,99,0.28)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '14px auto 18px',
                  }}>
                    <Icon name={s.icon} size={28} color="#0f8d63" />
                  </div>
                  <div style={{ fontSize: '21px', fontWeight: '800', color: 'var(--text)', marginBottom: '8px' }}>{s.title}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            <div data-animate style={{ textAlign: 'center', marginBottom: '60px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f8d63', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '12px' }}>מחירים</div>
              <h2 className="lp-h2" style={{ fontSize: '44px', fontWeight: '900', letterSpacing: '-0.02em', margin: '0 0 14px', lineHeight: 1.1 }}>תכנית פשוטה. בלי שלבי ביניים.</h2>
              <p style={{ fontSize: '17px', color: 'var(--text2)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>תתחיל בחינם. תשדרג ל-PRO ברגע שתרצה את כל הכלים.</p>
            </div>

            <div className="lp-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              {/* FREE */}
              <div data-animate style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '32px',
                position: 'relative',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>{PRICING.free.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                  <div dir="ltr" style={{ fontSize: '46px', fontWeight: '900', letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1 }}>{PRICING.free.price}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text3)', fontWeight: '600' }}>{PRICING.free.period}</div>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '24px' }}>בשביל להתחיל לבנות שיגרה</div>
                <button onClick={handleGoogleLogin} disabled={loading} style={{
                  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)',
                  borderRadius: '12px', padding: '13px',
                  fontSize: '14px', fontWeight: '800', cursor: loading ? 'wait' : 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  marginBottom: '24px',
                  transition: 'background 0.15s ease',
                }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg4)'}
                  onMouseOut={e => e.currentTarget.style.background = 'var(--bg3)'}
                >
                  {PRICING.free.cta}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {PRICING.free.perks.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text2)', fontWeight: '500' }}>
                      <Icon name="check" size={16} color="#0f8d63" />
                      {p}
                    </div>
                  ))}
                  {PRICING.free.locked.map((p, i) => (
                    <div key={'l' + i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text3)', fontWeight: '500', opacity: 0.6 }}>
                      <Icon name="lock" size={14} color="var(--text3)" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>

              {/* PRO */}
              <div data-animate style={{
                background: 'linear-gradient(180deg, rgba(15,141,99,0.08) 0%, var(--bg2) 100%)',
                border: '1px solid rgba(15,141,99,0.45)',
                borderRadius: '20px',
                padding: '32px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(15,141,99,0.18), 0 0 0 1px rgba(15,141,99,0.2)',
              }}>
                <div style={{ position: 'absolute', top: '-50px', insetInlineEnd: '-40px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(15,141,99,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '14px', insetInlineEnd: '14px', fontSize: '10px', fontWeight: '900', letterSpacing: '0.1em', color: '#0f8d63', background: 'rgba(15,141,99,0.18)', border: '1px solid rgba(15,141,99,0.45)', padding: '4px 9px', borderRadius: '6px', textTransform: 'uppercase' }}>הכי פופולרי</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f8d63', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>{PRICING.pro.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                  <div dir="ltr" style={{ fontSize: '46px', fontWeight: '900', letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1 }}>{PRICING.pro.price}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text3)', fontWeight: '600' }}>{PRICING.pro.period}</div>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '24px' }}>הכל פתוח. בלי הגבלות.</div>
                <button onClick={handleGoogleLogin} disabled={loading} style={{
                  width: '100%', background: '#0f8d63', border: 'none', color: '#fff',
                  borderRadius: '12px', padding: '13px',
                  fontSize: '14px', fontWeight: '800', cursor: loading ? 'wait' : 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  marginBottom: '24px',
                  boxShadow: '0 8px 24px rgba(15,141,99,0.4)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(15,141,99,0.55)' }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,141,99,0.4)' }}
                >
                  {PRICING.pro.cta}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {PRICING.pro.perks.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text)', fontWeight: '500' }}>
                      <Icon name="check_circle" size={16} color="#0f8d63" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: '780px', margin: '0 auto' }}>
            <div data-animate style={{ textAlign: 'center', marginBottom: '50px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f8d63', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '12px' }}>שאלות נפוצות</div>
              <h2 className="lp-h2" style={{ fontSize: '44px', fontWeight: '900', letterSpacing: '-0.02em', margin: '0 0 14px', lineHeight: 1.1 }}>הכל מה שצריך לדעת</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {FAQS.map((f, i) => {
                const open = openFaq === i
                return (
                  <div key={i} data-animate style={{
                    background: 'var(--bg2)',
                    border: `1px solid ${open ? 'rgba(15,141,99,0.35)' : 'var(--border)'}`,
                    borderRadius: '14px',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s ease',
                  }}>
                    <button
                      onClick={() => setOpenFaq(open ? null : i)}
                      style={{
                        width: '100%', textAlign: 'inherit',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '20px 22px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
                        fontFamily: 'Heebo, sans-serif',
                      }}
                    >
                      <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>{f.q}</span>
                      <span style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: open ? 'rgba(15,141,99,0.15)' : 'var(--bg3)',
                        border: '1px solid ' + (open ? 'rgba(15,141,99,0.3)' : 'var(--border)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'transform 0.25s ease, background 0.2s ease',
                        transform: open ? 'rotate(180deg)' : 'rotate(0)',
                      }}>
                        <Icon name="expand_more" size={16} color={open ? '#0f8d63' : 'var(--text2)'} />
                      </span>
                    </button>
                    <div style={{
                      maxHeight: open ? '300px' : '0',
                      transition: 'max-height 0.3s ease',
                      overflow: 'hidden',
                    }}>
                      <div style={{ padding: '0 22px 20px', fontSize: '14px', color: 'var(--text2)', lineHeight: 1.7 }}>
                        {f.a}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px', position: 'relative' }}>
          <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="26" height="26" viewBox="0 0 38 38" fill="none">
                <rect width="38" height="38" rx="8" fill="#0f8d63"/>
                <line x1="11" y1="8" x2="11" y2="30" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="8" y="13" width="6" height="10" rx="1.2" fill="rgba(255,255,255,0.55)"/>
                <line x1="19" y1="6" x2="19" y2="28" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="16" y="10" width="6" height="12" rx="1.2" fill="rgba(255,255,255,0.75)"/>
                <line x1="27" y1="9" x2="27" y2="31" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="24" y="14" width="6" height="11" rx="1.2" fill="white"/>
              </svg>
              <span style={{ fontFamily: 'Manrope, Heebo, sans-serif', fontWeight: '800', fontSize: '17px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
                Trade<span style={{ color: '#0f8d63' }}>IX</span>
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: '500' }}>
              © {new Date().getFullYear()} TRADEIX. כל הזכויות שמורות.
            </div>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        [data-animate] {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1), transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
        }
        [data-animate][data-visible="true"] {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes lpGradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @media (max-width: 900px) {
          .lp-nav-links { display: none !important; }
          .lp-nav-inner { padding: 0 18px !important; }
          .lp-feature-grid { grid-template-columns: 1fr 1fr !important; }
          .lp-steps { grid-template-columns: 1fr !important; gap: 36px !important; }
          .lp-pricing-grid { grid-template-columns: 1fr !important; }
          .lp-hero-title { font-size: 44px !important; }
          .lp-hero-sub { font-size: 16px !important; }
          .lp-h2 { font-size: 32px !important; }
        }
        @media (max-width: 560px) {
          .lp-feature-grid { grid-template-columns: 1fr !important; }
          .lp-hero-title { font-size: 36px !important; }
        }
      `}</style>
    </div>
  )
}
