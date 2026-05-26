'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { formatMoney, formatSignedMoney } from '@/lib/currency'
import { t } from '@/lib/translations'
import { Trade, Stats } from '@/types'
import TradeModal from '@/components/TradeModal'
import Link from 'next/link'
import Icon from '@/components/Icon'

const ACCENT = '#0f8d63'
const POSITIVE = '#16a34a'
const EMPTY_STATS: Stats = {
  totalTrades: 0, wins: 0, losses: 0, winRate: 0,
  totalPnl: 0, profitFactor: 0, avgRR: 0, bestTrade: 0, worstTrade: 0,
}

function calculateStats(rows: any[]): Stats {
  if (!rows.length) return EMPTY_STATS
  const wins = rows.filter((x: any) => x.outcome === 'win')
  const losses = rows.filter((x: any) => x.outcome === 'loss')
  const totalPnl = rows.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
  const gp = wins.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
  const gl = Math.abs(losses.reduce((s: number, x: any) => s + (x.pnl || 0), 0))

  return {
    totalTrades: rows.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / rows.length) * 100,
    totalPnl,
    profitFactor: gl > 0 ? gp / gl : 0,
    avgRR: 0,
    bestTrade: Math.max(...rows.map((x: any) => x.pnl || 0)),
    worstTrade: Math.min(...rows.map((x: any) => x.pnl || 0)),
  }
}

export default function DashboardPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language, currency, timezone } = useApp()
  const router = useRouter()
  const tr = t[language]
  const [timeFilter, setTimeFilter] = useState(2)
  const [trades, setTrades] = useState<Trade[]>([])
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [portfolioStats, setPortfolioStats] = useState<Stats>(EMPTY_STATS)
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
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const currentQuote = language === 'he' ? QUOTES_HE[quoteIndex] : QUOTES_EN[quoteIndex]

  function getTimezoneHour(date: Date): number {
    const hourPart = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date).find(part => part.type === 'hour')?.value
    const hour = Number(hourPart)
    return Number.isFinite(hour) ? hour % 24 : date.getHours()
  }

  function getGreeting(): string {
    const h = getTimezoneHour(currentTime)
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

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const TIME_FILTERS = [tr.daily, tr.weekly, tr.monthly, tr.yearly]

  function getDateRange(filter: number): { start: string; end?: string } {
    const now = new Date()
    if (filter === 0) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return { start: d.toISOString() }
    }
    if (filter === 1) {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    if (filter === 2) return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() }
    return { start: new Date(now.getFullYear(), 0, 1).toISOString() }
  }

  useEffect(() => {
    if (!activePortfolio) {
      activePortfolioIdRef.current = null
      setTrades([])
      setStats(EMPTY_STATS)
      setPortfolioStats(EMPTY_STATS)
      setPortfolioValue({ currentValue: 0, allTimePnl: 0, totalReturn: 0, maxDrawdown: 0 })
      return
    }
    activePortfolioIdRef.current = activePortfolio.id
    setTrades([])
    setStats(EMPTY_STATS)
    setPortfolioStats(EMPTY_STATS)
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
      const range = getDateRange(filter)
      let query = supabase.from('trades').select('pnl, outcome').eq('portfolio_id', portfolioId).gte('traded_at', range.start)
      if (range.end) query = query.lte('traded_at', range.end)
      const { data: all } = await query
      if (activePortfolioIdRef.current !== portfolioId) return
      setStats(calculateStats(all || []))
      const { data: allTimeTrades } = await supabase.from('trades').select('pnl, outcome, traded_at').eq('portfolio_id', portfolioId).order('traded_at', { ascending: true })
      if (activePortfolioIdRef.current !== portfolioId) return
      if (allTimeTrades) {
        setPortfolioStats(calculateStats(allTimeTrades))
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
        <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/settings?section=portfolios') }} style={{ background: '#0f8d63', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
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
  const winRateColor = stats.winRate >= 60 ? '#22c55e' : stats.winRate >= 30 ? '#f59e0b' : '#ef4444'
  const winRateGlow = stats.winRate >= 60 ? 'rgba(34,197,94,0.16)' : stats.winRate >= 30 ? 'rgba(245,158,11,0.16)' : 'rgba(239,68,68,0.16)'
  const winRateArc = Math.max(0, Math.min(100, stats.winRate))
  const dashboardValue = portfolioValue.currentValue > 0 ? portfolioValue.currentValue : initialCapital
  const portfolioPnlPositive = portfolioStats.totalPnl >= 0
  const portfolioPnlColor = portfolioPnlPositive ? '#22c55e' : '#ef4444'
  const portfolioWinRateColor = portfolioStats.totalTrades === 0
    ? '#f8fafc'
    : portfolioStats.winRate >= 60
      ? '#22c55e'
      : portfolioStats.winRate >= 30
        ? '#f59e0b'
        : '#ef4444'

  /* ── card base style ── */
  const card: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif', color: 'var(--text)' }}>

      {/* ── WELCOME SECTION ── */}
      {userName && (() => {
        const locale = language === 'he' ? 'he-IL' : 'en-US'
        const dateLabel = currentTime.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone })
        const timeLabel = currentTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: timezone })
        return (
        <div className="welcome-section section-anim" style={{
          marginBottom: '18px',
          padding: '18px 0 10px',
          borderRadius: 0,
          background: 'transparent',
          border: 'none',
          position: 'relative',
          overflow: 'visible',
          boxShadow: 'none',
          minHeight: '104px',
        }}>
          <div className="welcome-inner" style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: language === 'he'
              ? 'minmax(0, 560px) minmax(0, 1fr)'
              : 'minmax(0, 1fr) minmax(0, 560px)',
            alignItems: 'center',
            gap: '24px',
            direction: 'ltr',
          }}>
            <div className="welcome-profile" style={{ display: 'flex', alignItems: 'center', minWidth: 0, gridColumn: language === 'he' ? '2' : '1', justifySelf: language === 'he' ? 'end' : 'start', direction: language === 'he' ? 'rtl' : 'ltr', order: language === 'he' ? 2 : 1 }}>
            <div style={{ minWidth: 0 }}>
                <h2 className="welcome-title" style={{
                  fontSize: '31px', fontWeight: '900', margin: 0,
                  color: 'var(--text)', letterSpacing: '-0.02em',
                  fontFamily: 'Heebo, sans-serif', lineHeight: 1.04,
                  textShadow: '0 10px 28px rgba(0,0,0,0.22)',
                }}>
                  {getGreeting()}, {userName}
                </h2>
                <div className="welcome-meta-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '9px', flexWrap: 'wrap', color: 'rgba(244,247,251,0.86)' }}>
                  <span className="welcome-date" style={{
                    fontSize: '13px', fontWeight: '750', color: 'currentColor',
                    letterSpacing: '0.01em',
                  }}>
                    {dateLabel}
                  </span>
                  <span aria-hidden="true" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(244,247,251,0.48)', flexShrink: 0 }} />
                  <span className="welcome-time" dir="ltr" style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontSize: '13px', fontWeight: '850', color: 'currentColor',
                    letterSpacing: '0.02em',
                  }}>
                    {timeLabel}
                  </span>
                </div>
            </div>
            </div>

              <div className="welcome-quote-wrap" style={{
                maxWidth: '560px',
                minWidth: 0,
                marginLeft: 0,
                marginRight: 0,
                gridColumn: language === 'he' ? '1' : '2',
                justifySelf: language === 'he' ? 'start' : 'end',
                direction: language === 'he' ? 'rtl' : 'ltr',
                order: language === 'he' ? 1 : 2,
                padding: language === 'he' ? '4px 18px 4px 0' : '4px 0 4px 18px',
                borderRight: language === 'he' ? '2px solid rgba(15,141,99,0.8)' : 'none',
                borderLeft: language === 'he' ? 'none' : '2px solid rgba(15,141,99,0.8)',
                position: 'relative',
                textAlign: language === 'he' ? 'right' : 'left',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', marginBottom: '8px', color: '#0f8d63', fontSize: '12px', fontWeight: '900', letterSpacing: '0.08em' }}>
                  <Icon name="auto_awesome" size={15} color="#0f8d63" />
                  {language === 'he' ? 'מוטיבציה יומית' : 'FOCUS'}
                </div>
                <p className="welcome-quote" key={quoteIndex} style={{
                  fontSize: '15.5px', fontWeight: '700', color: 'rgba(238,240,246,0.82)',
                  margin: 0, lineHeight: 1.55,
                  fontFamily: 'Heebo, sans-serif',
                  animation: 'quoteFade 18s ease-in-out',
                  direction: language === 'he' ? 'rtl' : 'ltr',
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
      <div className="welcome-stat-divider section-anim anim-delay-1" aria-hidden="true">
        <span />
        <i />
        <span />
      </div>

      <div className="overview-perf-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '40px', alignItems: 'stretch' }}>

      <div className="overview-col" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
            (Trades / PNL / Win Rate) at the bottom. */}
        <div className="card-hover balance-card" style={{ ...card, flex: 1, padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* Soft glow keyed to portfolio color in the top corner */}
          <div style={{ position: 'absolute', top: '-50px', insetInlineStart: '-30px', width: '220px', height: '220px', background: `radial-gradient(circle, ${portfolioColor}15, transparent 65%)`, pointerEvents: 'none' }} />

          {/* Top — name + capital + value + return badge */}
          <div className="bal-header" style={{ padding: '20px 24px 14px', position: 'relative' }}>
            {/* Name row — glowing dot + portfolio name + market pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
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
                  <span dir="ltr" style={{ color: 'var(--text)', fontWeight: '900' }}>{formatMoney(initialCapital, currency)}</span>
                </span>
              )}
            </div>

            {/* Value + Return — symmetric 2-column layout. In RTL the first
                cell sits on the right, so "Current value" is first and the
                return cell is second (visually appears on the left). */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              alignItems: 'stretch',
              padding: 0,
            }} className="bal-value-grid">
              {/* Current value (right side in RTL) */}
              <div style={{
                padding: '18px 20px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px',
                minHeight: '116px',
                borderRadius: '16px',
                background: 'linear-gradient(145deg, rgba(255,255,255,0.045), rgba(15,141,99,0.035))',
                border: '1px solid rgba(255,255,255,0.075)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontSize: '13px', color: 'var(--text2)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <Icon name="account_balance_wallet" size={14} color="var(--text3)" />
                  {language === 'he' ? 'שווי תיק נוכחי' : 'Current value'}
                </div>
                <div dir="ltr" className="bal-amount" style={{ fontSize: '36px', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text)', fontFamily: 'Heebo, sans-serif', textAlign: 'center' }}>
                  {formatMoney(dashboardValue, currency)}
                </div>
              </div>

              {/* Return (left side in RTL) */}
              <div style={{
                padding: '18px 20px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px',
                minHeight: '116px',
                borderRadius: '16px',
                background: 'linear-gradient(145deg, rgba(22,163,74,0.085), rgba(255,255,255,0.025))',
                border: '1px solid rgba(255,255,255,0.065)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <Icon name={portfolioPositive ? 'trending_up' : 'trending_down'} size={14} color={portfolioPositive ? POSITIVE : '#ef4444'} />
                  {language === 'he' ? 'תשואה' : 'Return'}
                </div>
                <div dir="ltr" style={{ fontSize: '36px', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1, color: portfolioPositive ? POSITIVE : '#ef4444', fontFamily: 'Heebo, sans-serif', textAlign: 'center' }}>
                  {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Bottom — 3 stat tiles */}
          <div className="bal-stats-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0, padding: '18px 0', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(255,255,255,0.014), rgba(255,255,255,0.02))', minHeight: '112px' }}>
            {[
              {
                label: language === 'he' ? 'עסקאות' : 'Trades',
                value: portfolioStats.totalTrades,
                color: '#f8fafc',
                icon: 'receipt_long',
              },
              {
                label: 'PNL',
                value: portfolioStats.totalTrades > 0 ? formatSignedMoney(portfolioStats.totalPnl, currency) : '—',
                color: portfolioPnlColor,
                icon: portfolioPnlPositive ? 'trending_up' : 'trending_down',
              },
              {
                label: language === 'he' ? 'אחוז זכייה' : 'Win Rate',
                value: portfolioStats.totalTrades > 0 ? `${portfolioStats.winRate.toFixed(0)}%` : '—',
                color: portfolioWinRateColor,
                icon: 'speed',
              },
            ].map((t, i) => (
              <div key={i} style={{
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '7px',
                textAlign: 'center',
                borderInlineStart: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                minWidth: 0,
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', color: 'var(--text3)', minWidth: 0 }}>
                  <Icon name={t.icon} size={14} color="currentColor" />
                  <span style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.13em' }}>
                  {t.label}
                  </span>
                </div>
                <div dir="ltr" style={{ fontSize: '23px', fontWeight: '950', color: t.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
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
          { label: tr.portfolioPerformance, value: formatSignedMoney(stats.totalPnl, currency), icon: pnlPositive ? 'trending_up' : 'trending_down', color: pnlPositive ? '#22c55e' : '#ef4444' },
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
          <Link href="/trades" className="view-all-trades-btn" style={{
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
                  <div dir="ltr" style={{ textAlign: 'center', fontSize: '15px', fontWeight: '700', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>{formatSignedMoney(trade.pnl, currency)}</div>
                </div>
              ))}
            </>
          )}
        </div>

      </div>

      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadRecentTrades(); loadStats(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .welcome-stat-divider {
          position: relative;
          height: 28px;
          margin: 0 0 34px;
          opacity: 0.9;
        }
        .welcome-stat-divider span {
          position: absolute;
          inset-inline: 0;
          top: 50%;
          height: 1px;
          background:
            linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 16%, rgba(15,141,99,0.42) 50%, rgba(255,255,255,0.08) 84%, transparent 100%);
          transform: translateY(-50%);
        }
        .welcome-stat-divider span:last-child { display: none; }
        .welcome-stat-divider i {
          position: absolute;
          inset-inline: 18%;
          top: 50%;
          height: 18px;
          border-radius: 999px;
          background: radial-gradient(ellipse at center, rgba(15,141,99,0.18), transparent 72%);
          filter: blur(8px);
          transform: translateY(-50%);
        }

        @media (max-width: 1024px) {
          .overview-perf-grid { grid-template-columns: 1fr !important; gap: 36px !important; align-items: start !important; }
          .overview-col, .perf-col { min-width: 0 !important; }
          .stats-hero { grid-template-columns: 1fr 1fr !important; }
          .time-filter-bar { flex: 1 !important; justify-content: flex-end !important; }
          .time-filter-bar button { flex: 1 !important; }
          .data-by-label { display: none !important; }
          .recent-trade-row { grid-template-columns: minmax(0, 1fr) 100px 90px 110px !important; }
          .trade-col-rr { display: none !important; }
        }
        @media (max-width: 640px) {
          .overview-perf-grid { gap: 58px !important; margin-bottom: 64px !important; }
          .overview-col { margin-bottom: 0 !important; }
          .overview-col .top-row,
          .overview-col .balance-card {
            flex: initial !important;
            min-height: 0 !important;
            height: auto !important;
          }
          .perf-col { padding-top: 2px !important; }
          .stats-hero { gap: 8px !important; }
          .stat-card { padding: 14px !important; }
          .stat-card > div:first-child > div { width: 28px !important; height: 28px !important; }
          .recent-trade-row { grid-template-columns: minmax(0, 1.2fr) 80px 80px 90px !important; gap: 6px !important; padding-inline: 8px !important; }
          .recent-trade-row .trade-col-symbol { gap: 8px !important; min-width: 0 !important; overflow: hidden !important; }
          .recent-trade-row .trade-col-symbol > div:first-child { width: 30px !important; height: 30px !important; border-radius: 9px !important; flex-shrink: 0 !important; }
          .recent-trade-row .trade-col-symbol > div:last-child { font-size: 13px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; min-width: 0 !important; }
          .trades-section-header { padding: 13px 14px !important; gap: 10px !important; }
          .view-all-trades-btn { padding: 6px 11px !important; gap: 4px !important; font-size: 12px !important; border-radius: 9px !important; white-space: nowrap !important; }
          .view-all-trades-btn svg { width: 13px !important; height: 13px !important; }
          .balance-card .bal-amount { font-size: 29px !important; }
          .balance-card .bal-header { padding: 14px 16px 10px !important; }
          .balance-card .bal-value-grid { gap: 8px !important; }
          .balance-card .bal-value-grid > div { min-height: 86px !important; padding: 13px 10px !important; gap: 9px !important; border-radius: 13px !important; }
          .balance-card .bal-stats-grid { min-height: 92px !important; padding: 10px 0 !important; }
          .overview-col, .perf-col { align-self: stretch !important; }
          .balance-card .bal-section { padding: 14px 16px !important; text-align: center !important; }
          .balance-card .bal-icon { width: 36px !important; height: 36px !important; }
          .balance-card .bal-name { font-size: 17px !important; }
          .balance-card .bal-mini-val { font-size: 14px !important; }
          .section-anim.anim-delay-3 { flex-wrap: wrap !important; gap: 12px !important; margin-bottom: 20px !important; }
          .section-anim.anim-delay-8 { margin-top: 10px !important; }
          .welcome-section { padding: 16px 0 14px !important; margin-bottom: 22px !important; min-height: 102px !important; }
          .welcome-inner { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; align-items: center !important; gap: 14px !important; direction: ltr !important; }
          .welcome-profile { order: 2 !important; grid-column: 2 !important; min-width: 0 !important; justify-content: flex-start !important; justify-self: end !important; gap: 12px !important; direction: rtl !important; text-align: right !important; margin-left: auto !important; margin-right: 0 !important; }
          .welcome-profile > div { width: 100% !important; text-align: right !important; }
          .welcome-tile { width: 54px !important; height: 54px !important; border-radius: 15px !important; }
          .welcome-tile > span { font-size: 23px !important; }
          .welcome-title { font-size: clamp(20px, 5vw, 24px) !important; line-height: 1.12 !important; }
          .welcome-date { font-size: 12.5px !important; }
          .welcome-meta-row { width: 100% !important; margin-top: 7px !important; margin-bottom: 0 !important; justify-content: flex-start !important; direction: rtl !important; text-align: right !important; }
          .welcome-date { width: auto !important; text-align: right !important; }
          .welcome-time { font-size: 12.5px !important; }
          .welcome-quote-wrap { order: 1 !important; grid-column: 1 !important; width: 100% !important; max-width: 560px !important; min-width: 0 !important; margin-left: 0 !important; margin-right: 0 !important; justify-self: start !important; align-self: center !important; padding: 3px 12px 3px 0 !important; direction: rtl !important; text-align: right !important; border-right: 2px solid rgba(15,141,99,0.8) !important; border-left: none !important; }
          .welcome-quote-wrap > div { font-size: 10.5px !important; margin-bottom: 6px !important; gap: 5px !important; }
          .welcome-quote-wrap > div svg { width: 12px !important; height: 12px !important; }
          .welcome-quote { font-size: clamp(12px, 3.2vw, 13.5px) !important; line-height: 1.45 !important; }
          .welcome-stat-divider {
            height: 24px !important;
            margin: 4px 0 30px !important;
          }
          .welcome-stat-divider i { inset-inline: 10% !important; }
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
