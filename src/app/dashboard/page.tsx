'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { Trade, Stats } from '@/types'
import TradeModal from '@/components/TradeModal'
import Link from 'next/link'
import Icon from '@/components/Icon'

const ACCENT = '#0f8d63'
const EMPTY_STATS: Stats = {
  totalTrades: 0, wins: 0, losses: 0, winRate: 0,
  totalPnl: 0, profitFactor: 0, avgRR: 0, bestTrade: 0, worstTrade: 0,
}

export default function DashboardPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language } = useApp()
  const router = useRouter()
  const tr = t[language]
  const [timeFilter, setTimeFilter] = useState(2)
  const [trades, setTrades] = useState<Trade[]>([])
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [portfolioValue, setPortfolioValue] = useState({ currentValue: 0, allTimePnl: 0, totalReturn: 0, maxDrawdown: 0 })
  const [userName, setUserName] = useState('')
  const activePortfolioIdRef = useRef<string | null>(null)
  const supabase = createClient()

  const QUOTES_HE = [
    'תכנן את העסקה שלך, ותסחור את התוכנית.',
    'הפסדים הם חלק מהמשחק – ניהול סיכונים הוא המפתח.',
    'סבלנות היא הכלי החזק ביותר של סוחר.',
    'אל תרדוף אחרי עסקאות – תן להן לבוא אליך.',
    'היומן שלך הוא המורה הכי טוב שיש לך.',
    'עקביות מנצחת מוטיבציה כל יום.',
    'שלוט ברגשות שלך, ותשלוט בתוצאות.',
    'כל עסקה היא שיעור – למד ממנה.',
    'אל תסחור כדי להרוויח, תסחור כדי לשפר.',
    'הצלחה במסחר נמדדת לאורך זמן, לא בעסקה בודדת.',
    'עדיף לפספס עסקה מאשר להפסיד כסף.',
    'הרגל טוב הוא יותר חשוב מאסטרטגיה מושלמת.',
    'אל תשווה את עצמך לאחרים – התחרה בעצמך.',
    'המשמעת שלך היא היתרון שלך בשוק.',
    'תתחיל כל יום מסחר עם ראש נקי ותוכנית ברורה.',
  ]
  const QUOTES_EN = [
    'Plan your trade, and trade your plan.',
    'Losses are part of the game – risk management is key.',
    'Patience is a trader\'s most powerful tool.',
    'Don\'t chase trades – let them come to you.',
    'Your journal is the best teacher you have.',
    'Consistency beats motivation every day.',
    'Control your emotions, control your results.',
    'Every trade is a lesson – learn from it.',
    'Don\'t trade to earn, trade to improve.',
    'Trading success is measured over time, not in a single trade.',
    'Better to miss a trade than to lose money.',
    'A good habit is more important than a perfect strategy.',
    'Don\'t compare yourself to others – compete with yourself.',
    'Your discipline is your edge in the market.',
    'Start each trading day with a clear mind and a clear plan.',
  ]
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES_HE.length))
  const currentQuote = language === 'he' ? QUOTES_HE[quoteIndex] : QUOTES_EN[quoteIndex]

  function getGreeting(): string {
    const h = new Date().getHours()
    if (language === 'he') {
      if (h >= 5 && h < 12) return 'בוקר טוב'
      if (h >= 12 && h < 17) return 'צהריים טובים'
      if (h >= 17 && h < 21) return 'ערב טוב'
      return 'לילה טוב'
    }
    if (h >= 5 && h < 12) return 'Good morning'
    if (h >= 12 && h < 17) return 'Good afternoon'
    if (h >= 17 && h < 21) return 'Good evening'
    return 'Good night'
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || '')
      }
    })
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % QUOTES_HE.length)
    }, 18000)
    return () => clearInterval(interval)
  }, [])

  const TIME_FILTERS = [tr.daily, tr.weekly, tr.monthly, tr.yearly]

  function getStartDate(filter: number): string {
    const now = new Date()
    if (filter === 0) { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString() }
    else if (filter === 1) { const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d.toISOString() }
    else if (filter === 2) { return new Date(now.getFullYear(), now.getMonth(), 1).toISOString() }
    else { return new Date(now.getFullYear(), 0, 1).toISOString() }
  }

  useEffect(() => {
    if (!activePortfolio) {
      activePortfolioIdRef.current = null
      setTrades([])
      setStats(EMPTY_STATS)
      setPortfolioValue({ currentValue: 0, allTimePnl: 0, totalReturn: 0, maxDrawdown: 0 })
      return
    }
    activePortfolioIdRef.current = activePortfolio.id
    setTrades([])
    setStats(EMPTY_STATS)
    setPortfolioValue({
      currentValue: activePortfolio.initial_capital || 0,
      allTimePnl: 0,
      totalReturn: 0,
      maxDrawdown: 0,
    })
    loadRecentTrades(activePortfolio.id)
  }, [activePortfolio])

  useEffect(() => {
    if (!activePortfolio) return
    loadStats(activePortfolio.id, timeFilter)
  }, [activePortfolio, timeFilter])

  useEffect(() => {
    if (!activePortfolio) return
    const channel = supabase
      .channel('dashboard-trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `portfolio_id=eq.${activePortfolio.id}` }, () => { loadRecentTrades(activePortfolio.id); loadStats(activePortfolio.id, timeFilter) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activePortfolio, timeFilter])

  async function loadRecentTrades(portfolioId = activePortfolio?.id) {
    if (!portfolioId) return
    const { data: tradeData } = await supabase.from('trades').select('*').eq('portfolio_id', portfolioId).order('created_at', { ascending: false }).limit(10)
    if (tradeData && activePortfolioIdRef.current === portfolioId) setTrades(tradeData)
  }

  async function loadStats(portfolioId = activePortfolio?.id, filter = timeFilter) {
    if (!portfolioId) return
    try {
      const startDate = getStartDate(filter)
      const { data: all } = await supabase.from('trades').select('pnl, outcome').eq('portfolio_id', portfolioId).gte('traded_at', startDate)
      if (activePortfolioIdRef.current !== portfolioId) return
      if (all && all.length > 0) {
        const wins = all.filter((x: any) => x.outcome === 'win')
        const losses = all.filter((x: any) => x.outcome === 'loss')
        const totalPnl = all.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
        const gp = wins.reduce((s: number, x: any) => s + x.pnl, 0)
        const gl = Math.abs(losses.reduce((s: number, x: any) => s + x.pnl, 0))
        setStats({ totalTrades: all.length, wins: wins.length, losses: losses.length, winRate: (wins.length / all.length) * 100, totalPnl, profitFactor: gl > 0 ? gp / gl : 0, avgRR: 0, bestTrade: Math.max(...all.map((x: any) => x.pnl || 0)), worstTrade: Math.min(...all.map((x: any) => x.pnl || 0)) })
      } else {
        setStats(EMPTY_STATS)
      }
      const { data: allTimeTrades } = await supabase.from('trades').select('pnl, traded_at').eq('portfolio_id', portfolioId).order('traded_at', { ascending: true })
      if (activePortfolioIdRef.current !== portfolioId) return
      if (allTimeTrades) {
        const allTimePnl = allTimeTrades.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
        const initialCapital = activePortfolio!.initial_capital || 0
        const currentValue = initialCapital + allTimePnl
        const totalReturn = initialCapital > 0 ? (allTimePnl / initialCapital) * 100 : 0
        let peak = initialCapital, maxDD = 0, running = initialCapital
        for (const t of allTimeTrades) { running += (t.pnl || 0); if (running > peak) peak = running; if (peak > 0) { const dd = ((peak - running) / peak) * 100; if (dd > maxDD) maxDD = dd } }
        setPortfolioValue({ currentValue, allTimePnl, totalReturn, maxDrawdown: maxDD })
      }
    } finally {}
  }

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', fontFamily: 'Heebo, sans-serif' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon name="folder_open" size={32} color="var(--text3)" />
        </div>
        <div style={{ fontSize: '21px', fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
          {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
        </div>
        <div style={{ fontSize: '15px', color: 'var(--text3)', marginBottom: '28px' }}>
          {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
        </div>
        <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: '#0f8d63', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
          {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
        </button>
      </div>
    )
  }

  const pnlPositive = stats.totalPnl >= 0
  const initialCapital = activePortfolio?.initial_capital || 0
  const portfolioPositive = portfolioValue.allTimePnl >= 0
  const marketTypeLabels: Record<string, string> = { forex: 'FOREX', stocks: 'STOCKS', futures: 'FUTURES', cfd: 'CFD', other: 'OTHER', crypto: 'Crypto', commodities: 'Commodities' }
  const mktLabel = marketTypeLabels[activePortfolio?.market_type || 'other'] || 'Other'

  // Portfolio color (chosen swatch) — drives the Total Balance card border
  const PORTFOLIO_COLOR_MAP: Record<string, string> = {
    green: '#0f8d63', blue: '#3b82f6', purple: '#8b5cf6', red: '#ef4444',
    amber: '#f59e0b', cyan: '#06b6d4', pink: '#ec4899', teal: '#14b8a6',
    indigo: '#6366f1', rose: '#f43f5e',
  }
  const portfolioColor = PORTFOLIO_COLOR_MAP[(activePortfolio as any)?.color || 'green'] || '#0f8d63'
  const winRateColor = stats.winRate >= 60 ? '#22c55e' : stats.winRate >= 40 ? '#f59e0b' : '#ef4444'
  const winRateGlow = stats.winRate >= 60 ? 'rgba(34,197,94,0.16)' : stats.winRate >= 40 ? 'rgba(245,158,11,0.16)' : 'rgba(239,68,68,0.16)'
  const winRateArc = Math.max(0, Math.min(100, stats.winRate))

  /* ── card base style ── */
  const card: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', color: 'var(--text)' }}>

      {/* ── WELCOME SECTION ── */}
      {userName && (() => {
        const now = new Date()
        const dateLabel = now.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
        return (
        <div className="welcome-section section-anim" style={{
          marginBottom: '28px',
          padding: '24px',
          borderRadius: '22px',
          background: `
            linear-gradient(135deg, rgba(255,255,255,0.028) 0%, rgba(255,255,255,0.008) 44%, rgba(15,141,99,0.055) 100%),
            radial-gradient(circle at 8% 12%, rgba(15,141,99,0.11), transparent 31%),
            var(--bg2)
          `,
          border: '1px solid rgba(255,255,255,0.065)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 18px 55px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.045)',
          minHeight: '148px',
        }}>
          {/* Decorative glow */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)', backgroundSize: '34px 34px', maskImage: 'linear-gradient(90deg, transparent 0%, #000 18%, #000 82%, transparent 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '-90px', insetInlineEnd: '-70px', width: '290px', height: '290px', background: 'radial-gradient(circle, rgba(15,141,99,0.14) 0%, rgba(15,141,99,0.045) 34%, transparent 68%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-120px', insetInlineStart: '8%', width: '300px', height: '220px', background: 'radial-gradient(circle, rgba(255,255,255,0.035) 0%, transparent 62%)', pointerEvents: 'none' }} />

          <div className="welcome-inner" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
            <div className="welcome-profile" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div className="welcome-meta-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px', flexWrap: 'wrap' }}>
                <span className="welcome-date" style={{
                  fontSize: '13px', fontWeight: '700', color: 'var(--text3)',
                  letterSpacing: '0.01em',
                }}>
                  {dateLabel}
                </span>
              </div>
                <h2 className="welcome-title" style={{
                  fontSize: '31px', fontWeight: '900', margin: 0,
                  color: 'var(--text)', letterSpacing: '-0.02em',
                  fontFamily: 'Heebo, sans-serif', lineHeight: 1.04,
                  textShadow: '0 10px 28px rgba(0,0,0,0.22)',
                }}>
                  {getGreeting()}, {userName}
                </h2>
            </div>
            </div>

              <div className="welcome-quote-wrap" style={{
                width: 'min(42%, 520px)',
                minWidth: '320px',
                padding: '18px 20px',
                borderRadius: '18px',
                background: 'rgba(2,4,7,0.48)',
                border: '1px solid rgba(255,255,255,0.055)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035), 0 10px 28px rgba(0,0,0,0.16)',
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#0f8d63', fontSize: '12px', fontWeight: '900', letterSpacing: '0.08em' }}>
                  <Icon name="auto_awesome" size={15} color="#0f8d63" />
                  FOCUS
                </div>
                <p className="welcome-quote" key={quoteIndex} style={{
                  fontSize: '15.5px', fontWeight: '700', color: 'rgba(238,240,246,0.82)',
                  margin: 0, lineHeight: 1.55,
                  fontFamily: 'Heebo, sans-serif',
                  animation: 'quoteFade 18s ease-in-out',
                }}>
                  {currentQuote}
                </p>
              </div>
            </div>
        </div>
        )
      })()}

      {/* ══════════════════════════════════════════════
          OVERVIEW + PERFORMANCE — side-by-side on desktop,
          stacked on tablet/mobile
          ══════════════════════════════════════════════ */}
      <div className="overview-perf-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px', alignItems: 'stretch' }}>

      <div className="overview-col" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── OVERVIEW TITLE ── */}
      <div className="section-anim" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div className="section-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="space_dashboard" size={20} color="#0f8d63" />
        </div>
        <div>
          <h2 className="section-title" style={{ fontSize: '23px', fontWeight: '600', margin: 0, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.15, fontFamily: 'Heebo, sans-serif' }}>{tr.overview}</h2>
          <p className="section-subtitle" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text3)', margin: '4px 0 0', lineHeight: 1.4, fontFamily: 'Heebo, sans-serif' }}>
            {language === 'he' ? 'מבט כולל על ביצועי התיק שלך' : 'A complete look at your portfolio performance'}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TOP ROW — Balance Card
          ══════════════════════════════════════════════ */}
      <div className="top-row section-anim anim-delay-1" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── Total Balance Card — redesigned ──
            Glowing portfolio-color dot next to the name (no full border),
            big "current value" headline with a +X.X% return pill,
            small "principal" hint under the headline, and a 3-tile row
            (Trades / Profit Factor / Win Rate) at the bottom. */}
        <div className="card-hover balance-card" style={{ ...card, flex: 1, padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* Soft glow keyed to portfolio color in the top corner */}
          <div style={{ position: 'absolute', top: '-50px', insetInlineStart: '-30px', width: '220px', height: '220px', background: `radial-gradient(circle, ${portfolioColor}15, transparent 65%)`, pointerEvents: 'none' }} />

          {/* Top — name + capital + value + return badge */}
          <div className="bal-header" style={{ padding: '24px 26px 22px', position: 'relative' }}>
            {/* Name row — glowing dot + portfolio name + market pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{
                width: '12px', height: '12px', borderRadius: '50%',
                background: portfolioColor,
                boxShadow: `0 0 14px ${portfolioColor}, 0 0 26px ${portfolioColor}77`,
                flexShrink: 0,
                animation: 'pulseGlow 2.4s ease-in-out infinite',
              }} />
              <span className="bal-name" style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activePortfolio?.name}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f8d63', background: 'rgba(15,141,99,0.12)', border: '1px solid rgba(15,141,99,0.25)', padding: '3px 10px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {mktLabel}
              </span>
              {initialCapital > 0 && (
                <span style={{
                  marginInlineStart: 'auto',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', fontWeight: '700',
                  color: 'var(--text2)',
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  padding: '5px 12px', borderRadius: '999px',
                }}>
                  <Icon name="payments" size={13} color="var(--text3)" />
                  {language === 'he' ? 'קרן' : 'Capital'}
                  <span dir="ltr" style={{ color: 'var(--text)', fontWeight: '900' }}>${initialCapital.toLocaleString()}</span>
                </span>
              )}
            </div>

            {/* Value + Return — symmetric 2-column layout. In RTL the first
                cell sits on the right, so "Current value" is first and the
                return cell is second (visually appears on the left). */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'stretch' }} className="bal-value-grid">
              {/* Current value (right side in RTL) */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '16px 18px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                minHeight: '110px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--text2)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <Icon name="account_balance_wallet" size={14} color="#0f8d63" />
                  {language === 'he' ? 'שווי תיק נוכחי' : 'Current value'}
                </div>
                <div dir="ltr" className="bal-amount" style={{ fontSize: '36px', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1, color: portfolioPositive ? '#22c55e' : '#ef4444', fontFamily: 'Heebo, sans-serif' }}>
                  ${(portfolioValue.currentValue > 0 ? portfolioValue.currentValue : initialCapital).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* Return (left side in RTL) */}
              <div style={{
                background: portfolioPositive ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${portfolioPositive ? 'rgba(34,197,94,0.32)' : 'rgba(239,68,68,0.32)'}`,
                borderRadius: '14px',
                padding: '16px 18px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                minHeight: '110px',
                boxShadow: `0 0 22px ${portfolioPositive ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)'} inset`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <Icon name={portfolioPositive ? 'trending_up' : 'trending_down'} size={14} color={portfolioPositive ? '#22c55e' : '#ef4444'} />
                  {language === 'he' ? 'תשואה' : 'Return'}
                </div>
                <div dir="ltr" style={{ fontSize: '36px', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1, color: portfolioPositive ? '#22c55e' : '#ef4444', fontFamily: 'Heebo, sans-serif' }}>
                  {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Bottom — 3 stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '0 16px 16px', marginTop: 'auto' }}>
            {[
              { label: language === 'he' ? 'עסקאות' : 'Trades', value: stats.totalTrades, color: 'var(--text)' },
              { label: 'Profit Factor', value: stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—', color: '#0f8d63' },
              { label: language === 'he' ? 'אחוז זכייה' : 'Win Rate', value: stats.totalTrades > 0 ? `${stats.winRate.toFixed(0)}%` : '—', color: stats.winRate >= 50 ? '#22c55e' : '#ef4444' },
            ].map((t, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px 10px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.13em', marginBottom: '6px' }}>
                  {t.label}
                </div>
                <div dir="ltr" style={{ fontSize: '20px', fontWeight: '900', color: t.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {t.value}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      </div>

      <div className="perf-col" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ══════════════════════════════════════════════
          STAT CARDS ROW — with time filter
          ══════════════════════════════════════════════ */}
      <div className="section-anim anim-delay-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="section-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="monitoring" size={20} color="#0f8d63" />
          </div>
          <div>
            <h2 className="section-title" style={{ fontSize: '23px', fontWeight: '600', margin: 0, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.15, fontFamily: 'Heebo, sans-serif' }}>{language === 'he' ? 'נתוני ביצועים' : 'Performance'}</h2>
            <p className="section-subtitle" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text3)', margin: '4px 0 0', lineHeight: 1.4, fontFamily: 'Heebo, sans-serif' }}>
              {language === 'he' ? 'סטטיסטיקות מסחר לפי תקופה' : 'Trading statistics by period'}
            </p>
          </div>
        </div>
        <div className="time-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginInlineStart: 'auto' }}>
          <div style={{ display: 'flex', background: 'var(--bg3)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border)', gap: '2px' }}>
            {TIME_FILTERS.map((label, i) => (
              <button key={i} onClick={() => setTimeFilter(i)} style={{
                padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '500',
                cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
                background: timeFilter === i ? '#0f8d63' : 'transparent',
                color: timeFilter === i ? '#fff' : 'var(--text3)',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      {stats.totalTrades === 0 ? (
        <div style={{ ...card, padding: '48px 24px', textAlign: 'center', flex: 1, minHeight: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="receipt_long" size={32} color="var(--bg4)" style={{ display: 'block', margin: '0 auto 8px' }} />
          <p style={{ fontSize: '14px', color: 'var(--text3)', margin: 0 }}>
            {language === 'he' ? 'אין עסקאות קיימות במערכת לקריאת נתונים' : 'No trades to read data from'}
          </p>
        </div>
      ) : (
      <div className="stats-hero" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', flex: 1, alignContent: 'stretch' }}>
        <div className="stat-card card-hover stat-anim anim-delay-4" style={{ ...card, padding: '18px 18px 16px', overflow: 'hidden', position: 'relative', gridColumn: '1 / -1' }}>
          <div style={{ position: 'absolute', top: '-48px', insetInlineEnd: '-42px', width: '150px', height: '150px', background: `radial-gradient(circle, ${winRateGlow}, transparent 68%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text2)' }}>{tr.winRate}</span>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: winRateGlow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="emoji_events" size={17} color={winRateColor} />
            </div>
          </div>
          <div className="winrate-meter-wrap" style={{ position: 'relative', height: '98px', margin: '2px auto 6px', maxWidth: '170px' }}>
            <svg viewBox="0 0 184 104" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }} aria-hidden="true">
              <path d="M 20 88 A 72 72 0 0 1 164 88" pathLength={100} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="8" strokeLinecap="round" />
              <path d="M 20 88 A 72 72 0 0 1 164 88" pathLength={100} fill="none" stroke="rgba(239,68,68,0.85)" strokeWidth="9" strokeLinecap="round" />
              <path d="M 20 88 A 72 72 0 0 1 164 88" pathLength={100} fill="none" stroke="#22c55e" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${winRateArc} 100`} />
            </svg>
            <div dir="ltr" style={{ position: 'absolute', insetInline: 0, top: '43px', textAlign: 'center', fontSize: '34px', fontWeight: '900', color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {stats.winRate.toFixed(0)}%
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <div title={language === 'he' ? 'עסקאות מנצחות' : 'Won deals'} dir="ltr" style={{ minWidth: '46px', textAlign: 'center', fontSize: '15px', fontWeight: '900', color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: '9px', padding: '4px 10px', lineHeight: 1 }}>
              {stats.wins}
            </div>
            <div title={language === 'he' ? 'עסקאות מפסידות' : 'Lost deals'} dir="ltr" style={{ minWidth: '46px', textAlign: 'center', fontSize: '15px', fontWeight: '900', color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '9px', padding: '4px 10px', lineHeight: 1 }}>
              {stats.losses}
            </div>
          </div>
        </div>
        {[
          { label: tr.portfolioPerformance, value: `${pnlPositive ? '+' : '-'}$${Math.abs(stats.totalPnl).toLocaleString()}`, icon: pnlPositive ? 'trending_up' : 'trending_down', color: pnlPositive ? '#22c55e' : '#ef4444' },
          { label: tr.profitFactor, value: stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—', icon: 'analytics', color: '#0f8d63' },
        ].map((s, i) => (
          <div key={i} className={`stat-card card-hover stat-anim anim-delay-${i + 5}`} style={{ ...card, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <span style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text2)' }}>{s.label}</span>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={17} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: '29px', fontWeight: '700', color: typeof s.value === 'string' && s.value.startsWith('+') ? s.color : typeof s.value === 'string' && s.value.startsWith('-') ? '#ef4444' : 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>
      )}
      </div>

      </div>

      {/* ══════════════════════════════════════════════
          RECENT TRADES
          ══════════════════════════════════════════════ */}
      <div className="section-anim anim-delay-8" style={{ ...card, overflow: 'hidden' }}>
        {/* Header */}
        <div className="trades-section-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(15,141,99,0.1)', border: '1px solid rgba(15,141,99,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="show_chart" size={19} color="#0f8d63" strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>{tr.recentTrades}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '500' }}>{tr.liveActivity}</div>
            </div>
          </div>
          <Link href="/trades" style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 16px', borderRadius: '8px',
            background: 'rgba(15,141,99,0.08)', border: '1px solid rgba(15,141,99,0.2)',
            color: '#0f8d63',
            fontSize: '13px', fontWeight: '600', textDecoration: 'none',
            transition: 'all 0.15s',
          }}>
            {language === 'he' ? 'לכל העסקאות' : 'View All'}
            <Icon name={language === 'he' ? 'chevron_left' : 'chevron_right'} size={15} />
          </Link>
        </div>

        {/* Trades list */}
        <div style={{ padding: '4px 12px' }}>
          {trades.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <Icon name="receipt_long" size={32} color="var(--bg4)" style={{ display: 'block', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: 'var(--text3)', margin: 0 }}>
                {timeFilter === 0 ? (language === 'he' ? 'לא ביצעת עסקאות היום' : 'No trades today')
                  : timeFilter === 1 ? (language === 'he' ? 'לא ביצעת עסקאות השבוע' : 'No trades this week')
                  : timeFilter === 2 ? (language === 'he' ? 'לא ביצעת עסקאות החודש' : 'No trades this month')
                  : timeFilter === 3 ? (language === 'he' ? 'לא ביצעת עסקאות השנה' : 'No trades this year')
                  : tr.noMoreTrades}
              </p>
            </div>
          ) : (
            <>
              {/* Column header row */}
              <div className="recent-trade-row trade-header-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 100px 90px 80px 110px', alignItems: 'center', gap: '12px', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <div className="trade-col-symbol" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'נכס' : 'Symbol'}</div>
                <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוצאה' : 'WIN/LOSS'}</div>
                <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תאריך' : 'Date'}</div>
                <div className="trade-col-rr" style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RR</div>
                <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P&L</div>
              </div>

              {trades.map((trade, idx) => (
                <div key={trade.id} onClick={() => setSelectedTrade(trade)} className="recent-trade-row trade-row-anim"
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 100px 90px 80px 110px', alignItems: 'center', gap: '12px', padding: '14px 10px', cursor: 'pointer', transition: 'background 0.12s, transform 0.2s', borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none', borderRadius: '8px', animationDelay: `${0.4 + idx * 0.06}s` }}
                  onMouseOver={e => { e.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="trade-col-symbol" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0, background: trade.direction === 'long' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={trade.direction === 'long' ? 'trending_up' : 'trending_down'} size={16} color={trade.direction === 'long' ? '#22c55e' : '#ef4444'} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{trade.symbol}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ padding: '4px 12px', borderRadius: '8px', background: trade.outcome === 'win' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: trade.outcome === 'win' ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '500', color: 'var(--text2)' }}>{new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit' })}</div>
                  <div className="trade-col-rr" dir="ltr" style={{ textAlign: 'center', fontSize: '14px', fontWeight: '600', color: trade.outcome === 'win' && trade.rr_ratio != null ? '#22c55e' : 'var(--text3)' }}>{trade.outcome === 'win' && trade.rr_ratio != null ? `1 : ${trade.rr_ratio.toFixed(1)}` : '—'}</div>
                  <div dir="ltr" style={{ textAlign: 'center', fontSize: '15px', fontWeight: '700', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>{trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl)}</div>
                </div>
              ))}
            </>
          )}
        </div>

      </div>

      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadRecentTrades(); loadStats(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .overview-perf-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .stats-hero { grid-template-columns: 1fr 1fr !important; }
          .time-filter-bar { flex: 1 !important; justify-content: flex-end !important; }
          .time-filter-bar button { flex: 1 !important; }
          .data-by-label { display: none !important; }
          .recent-trade-row { grid-template-columns: minmax(0, 1fr) 100px 90px 110px !important; }
          .trade-col-rr { display: none !important; }
        }
        @media (max-width: 640px) {
          .stats-hero { gap: 8px !important; }
          .stat-card { padding: 14px !important; }
          .stat-card > div:first-child > div { width: 28px !important; height: 28px !important; }
          .recent-trade-row { grid-template-columns: minmax(0, 1.2fr) 80px 80px 90px !important; gap: 6px !important; padding-inline: 8px !important; }
          .recent-trade-row .trade-col-symbol { gap: 8px !important; min-width: 0 !important; overflow: hidden !important; }
          .recent-trade-row .trade-col-symbol > div:first-child { width: 30px !important; height: 30px !important; border-radius: 9px !important; flex-shrink: 0 !important; }
          .recent-trade-row .trade-col-symbol > div:last-child { font-size: 13px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; min-width: 0 !important; }
          .trades-section-header { padding: 14px !important; }
          .balance-card .bal-amount { font-size: 29px !important; }
          .balance-card .bal-header { padding: 14px 16px 12px !important; }
          .balance-card .bal-section { padding: 14px 16px !important; text-align: center !important; }
          .balance-card .bal-icon { width: 36px !important; height: 36px !important; }
          .balance-card .bal-name { font-size: 17px !important; }
          .balance-card .bal-mini-val { font-size: 14px !important; }
          .section-anim.anim-delay-3 { flex-wrap: wrap !important; gap: 10px !important; }
          .welcome-section { padding: 18px 16px !important; margin-bottom: 20px !important; }
          .welcome-inner { flex-direction: column !important; align-items: stretch !important; gap: 16px !important; }
          .welcome-profile { gap: 12px !important; }
          .welcome-tile { width: 54px !important; height: 54px !important; border-radius: 15px !important; }
          .welcome-tile > span { font-size: 23px !important; }
          .welcome-title { font-size: 22px !important; }
          .welcome-date { font-size: 12px !important; }
          .welcome-meta-row { margin-bottom: 7px !important; }
          .welcome-quote-wrap { width: 100% !important; min-width: 0 !important; padding: 14px 15px !important; border-radius: 14px !important; }
          .welcome-quote { font-size: 13.5px !important; }
          .section-title { font-size: 19px !important; }
          .section-subtitle { display: none !important; }
          .section-icon { width: 36px !important; height: 36px !important; }
        }
        @keyframes quoteFade {
          0% { opacity: 0; transform: translateY(6px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
