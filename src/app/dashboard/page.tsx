'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { Trade, Stats } from '@/types'
import TradeModal from '@/components/TradeModal'
import Link from 'next/link'
import Icon from '@/components/Icon'

const ACCENT = '#10b981'

export default function DashboardPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language } = useApp()
  const router = useRouter()
  const tr = t[language]
  const [timeFilter, setTimeFilter] = useState(2)
  const [trades, setTrades] = useState<Trade[]>([])
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalTrades: 0, wins: 0, losses: 0, winRate: 0,
    totalPnl: 0, profitFactor: 0, avgRR: 0, bestTrade: 0, worstTrade: 0,
  })
  const [portfolioValue, setPortfolioValue] = useState({ currentValue: 0, allTimePnl: 0, totalReturn: 0, maxDrawdown: 0 })
  const [userName, setUserName] = useState('')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
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
        setUserAvatar(user.user_metadata?.avatar_url || null)
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

  useEffect(() => { if (activePortfolio) loadData() }, [activePortfolio, timeFilter])

  useEffect(() => {
    if (!activePortfolio) return
    const channel = supabase
      .channel('dashboard-trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `portfolio_id=eq.${activePortfolio.id}` }, () => { loadData() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activePortfolio])

  async function loadData() {
    try {
      const startDate = getStartDate(timeFilter)
      const { data: tradeData } = await supabase.from('trades').select('*').eq('portfolio_id', activePortfolio!.id).order('created_at', { ascending: false }).limit(10)
      if (tradeData) setTrades(tradeData)
      const { data: all } = await supabase.from('trades').select('pnl, outcome').eq('portfolio_id', activePortfolio!.id).gte('traded_at', startDate)
      if (all && all.length > 0) {
        const wins = all.filter((x: any) => x.outcome === 'win')
        const losses = all.filter((x: any) => x.outcome === 'loss')
        const totalPnl = all.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
        const gp = wins.reduce((s: number, x: any) => s + x.pnl, 0)
        const gl = Math.abs(losses.reduce((s: number, x: any) => s + x.pnl, 0))
        setStats({ totalTrades: all.length, wins: wins.length, losses: losses.length, winRate: (wins.length / all.length) * 100, totalPnl, profitFactor: gl > 0 ? gp / gl : 0, avgRR: 0, bestTrade: Math.max(...all.map((x: any) => x.pnl || 0)), worstTrade: Math.min(...all.map((x: any) => x.pnl || 0)) })
      } else {
        setStats({ totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, profitFactor: 0, avgRR: 0, bestTrade: 0, worstTrade: 0 })
      }
      const { data: allTimeTrades } = await supabase.from('trades').select('pnl, traded_at').eq('portfolio_id', activePortfolio!.id).order('traded_at', { ascending: true })
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
        <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: '#10b981', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
          {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
        </button>
      </div>
    )
  }

  const pnlPositive = stats.totalPnl >= 0
  const initialCapital = activePortfolio?.initial_capital || 0
  const portfolioPositive = portfolioValue.allTimePnl >= 0
  const marketTypeLabels: Record<string, string> = { forex: 'Forex', stocks: 'Stocks', crypto: 'Crypto', commodities: 'Commodities', other: 'Other' }
  const mktLabel = marketTypeLabels[activePortfolio?.market_type || 'other'] || 'Other'

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
          padding: '28px 32px',
          borderRadius: 'var(--radius)',
          background: 'linear-gradient(135deg, var(--bg2) 0%, rgba(16,185,129,0.04) 100%)',
          border: '1px solid var(--border)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{ position: 'absolute', top: '-80px', insetInlineEnd: '-60px', width: '260px', height: '260px', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-40px', insetInlineStart: '-40px', width: '160px', height: '160px', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div className="welcome-inner" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '22px' }}>
            {/* Avatar tile — user photo if available, else initial */}
            <div className="welcome-tile" style={{
              width: '60px', height: '60px', borderRadius: '16px',
              background: userAvatar ? 'var(--bg3)' : 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))',
              border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 0 24px rgba(16,185,129,0.08) inset',
            }}>
              {userAvatar ? (
                <img src={userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{
                  fontSize: '27px', fontWeight: '800', color: '#10b981',
                  letterSpacing: '-0.02em', fontFamily: 'Heebo, sans-serif',
                  textTransform: 'uppercase',
                }}>
                  {userName.charAt(0) || 'U'}
                </span>
              )}
              {/* Wave badge — signals the greeting context */}
              <div className="welcome-wave-badge" style={{
                position: 'absolute', bottom: '-4px', insetInlineEnd: '-4px',
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'var(--bg)', border: '2px solid var(--bg2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="waving_hand" size={13} color="#10b981" />
              </div>
            </div>

            {/* Greeting + meta + quote */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <h2 className="welcome-title" style={{
                  fontSize: '25px', fontWeight: '800', margin: 0,
                  color: 'var(--text)', letterSpacing: '-0.02em',
                  fontFamily: 'Heebo, sans-serif', lineHeight: 1.1,
                }}>
                  {getGreeting()}, {userName}
                </h2>
                <span className="welcome-date" style={{
                  fontSize: '13px', fontWeight: '500', color: 'var(--text3)',
                  letterSpacing: '0.01em',
                }}>
                  {dateLabel}
                </span>
              </div>

              <div className="welcome-quote-wrap" style={{
                marginTop: '14px',
                paddingInlineStart: '14px',
                borderInlineStart: '2px solid rgba(16,185,129,0.35)',
              }}>
                <p className="welcome-quote" key={quoteIndex} style={{
                  fontSize: '15px', fontWeight: '500', color: 'var(--text2)',
                  margin: 0, lineHeight: 1.55,
                  fontFamily: 'Heebo, sans-serif',
                  animation: 'quoteFade 18s ease-in-out',
                }}>
                  {currentQuote}
                </p>
              </div>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ══════════════════════════════════════════════
          OVERVIEW + PERFORMANCE — side-by-side on desktop,
          stacked on tablet/mobile
          ══════════════════════════════════════════════ */}
      <div className="overview-perf-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px', alignItems: 'start' }}>

      <div className="overview-col">
      {/* ── OVERVIEW TITLE ── */}
      <div className="section-anim" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div className="section-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="space_dashboard" size={20} color="#10b981" />
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
      <div className="top-row section-anim anim-delay-1">

        {/* ── Total Balance Card ── */}
        <div className="card-hover balance-card" style={{ ...card, padding: '0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.15)', position: 'relative' }}>
          {/* Green glow effect */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Portfolio name header */}
          <div className="bal-header" style={{ padding: '20px 28px 16px', borderBottom: '1px solid rgba(16,185,129,0.08)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="bal-icon" style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="cases" size={22} color="#10b981" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bal-name" style={{ fontSize: '21px', fontWeight: '800', color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activePortfolio?.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '6px' }}>{mktLabel}</span>
                  {initialCapital > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text2)' }}>
                      {language === 'he' ? 'קרן' : 'Capital'}: <span style={{ color: 'var(--text)' }}>${initialCapital.toLocaleString()}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Balance section */}
          <div className="bal-section" style={{ padding: '20px 28px', position: 'relative' }}>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {language === 'he' ? 'שווי תיק נוכחי' : 'Total Balance'}
            </div>
            <div dir="ltr" className="bal-amount" style={{ fontSize: '41px', fontWeight: '800', letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text)' }}>
              ${(portfolioValue.currentValue > 0 ? portfolioValue.currentValue : initialCapital).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Mini stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'rgba(16,185,129,0.06)', marginTop: 'auto' }}>
            <div style={{ background: 'var(--bg2)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>P&L</div>
              <div dir="ltr" className="bal-mini-val" style={{ fontSize: '17px', fontWeight: '700', color: portfolioPositive ? '#22c55e' : '#ef4444' }}>
                {portfolioValue.allTimePnl >= 0 ? '+' : '-'}${Math.abs(portfolioValue.allTimePnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROI</div>
              <div dir="ltr" className="bal-mini-val" style={{ fontSize: '17px', fontWeight: '700', color: portfolioPositive ? '#22c55e' : '#ef4444' }}>
                {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(1)}%
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drawdown</div>
              <div className="bal-mini-val" style={{ fontSize: '17px', fontWeight: '700', color: portfolioValue.maxDrawdown > 15 ? '#ef4444' : portfolioValue.maxDrawdown > 5 ? '#f59e0b' : '#22c55e' }}>
                -{portfolioValue.maxDrawdown.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

      </div>
      </div>

      <div className="perf-col">
      {/* ══════════════════════════════════════════════
          STAT CARDS ROW — with time filter
          ══════════════════════════════════════════════ */}
      <div className="section-anim anim-delay-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="section-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="monitoring" size={20} color="#10b981" />
          </div>
          <div>
            <h2 className="section-title" style={{ fontSize: '23px', fontWeight: '600', margin: 0, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.15, fontFamily: 'Heebo, sans-serif' }}>{language === 'he' ? 'נתוני ביצועים' : 'Performance'}</h2>
            <p className="section-subtitle" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text3)', margin: '4px 0 0', lineHeight: 1.4, fontFamily: 'Heebo, sans-serif' }}>
              {language === 'he' ? 'סטטיסטיקות מסחר לפי תקופה' : 'Trading statistics by period'}
            </p>
          </div>
        </div>
        <div className="time-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginInlineStart: 'auto' }}>
          <span className="data-by-label" style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text3)' }}>{language === 'he' ? 'נתונים לפי:' : 'Data by:'}</span>
          <div style={{ display: 'flex', background: 'var(--bg3)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border)', gap: '2px' }}>
            {TIME_FILTERS.map((label, i) => (
              <button key={i} onClick={() => setTimeFilter(i)} style={{
                padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '500',
                cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
                background: timeFilter === i ? '#10b981' : 'transparent',
                color: timeFilter === i ? '#fff' : 'var(--text3)',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      {trades.length === 0 ? (
        <div style={{ ...card, padding: '48px', textAlign: 'center' }}>
          <Icon name="receipt_long" size={32} color="var(--bg4)" style={{ display: 'block', margin: '0 auto 8px' }} />
          <p style={{ fontSize: '14px', color: 'var(--text3)', margin: 0 }}>
            {language === 'he' ? 'לא ביצעת עסקאות עדיין' : 'No trades yet'}
          </p>
        </div>
      ) : (
      <div className="stats-hero" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {[
          { label: `${tr.total} ${tr.trades}`, value: stats.totalTrades, icon: 'receipt_long', color: ACCENT,
            sub: <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '2px 8px', borderRadius: '6px' }}>{stats.wins}W</span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: '6px' }}>{stats.losses}L</span>
            </div> },
          { label: tr.winRate, value: `${stats.winRate.toFixed(0)}%`, icon: 'emoji_events', color: '#22c55e' },
          { label: tr.portfolioPerformance, value: `${pnlPositive ? '+' : ''}$${stats.totalPnl.toLocaleString()}`, icon: pnlPositive ? 'trending_up' : 'trending_down', color: pnlPositive ? '#22c55e' : '#ef4444' },
          { label: tr.profitFactor, value: stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—', icon: 'analytics', color: '#10b981' },
        ].map((s, i) => (
          <div key={i} className={`stat-card card-hover stat-anim anim-delay-${i + 4}`} style={{ ...card, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <span style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text2)' }}>{s.label}</span>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={17} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: '29px', fontWeight: '700', color: typeof s.value === 'string' && s.value.startsWith('+') ? s.color : typeof s.value === 'string' && s.value.startsWith('-') ? '#ef4444' : 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
            {s.sub || null}
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
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>{tr.recentTrades}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '500' }}>{tr.liveActivity}</div>
          </div>
          <Link href="/trades" style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 16px', borderRadius: '8px',
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
            color: '#10b981',
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
          ) : trades.map((trade, idx) => (
            <div key={trade.id} onClick={() => setSelectedTrade(trade)} className="recent-trade-row trade-row-anim"
              style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 90px 100px', alignItems: 'center', gap: '12px', padding: '14px 10px', cursor: 'pointer', transition: 'background 0.12s, transform 0.2s', borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none', borderRadius: '8px', animationDelay: `${0.4 + idx * 0.06}s` }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0, background: trade.direction === 'long' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={trade.direction === 'long' ? 'trending_up' : 'trending_down'} size={16} color={trade.direction === 'long' ? '#22c55e' : '#ef4444'} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', lineHeight: 1 }}>{trade.symbol}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '500', marginTop: '3px' }}>{tr.pair}</div>
                </div>
              </div>
              <div className="trade-col-rr" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: ACCENT }}>1:{trade.rr_ratio?.toFixed(1) || '—'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>RR</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div dir="ltr" style={{ fontSize: '15px', fontWeight: '700', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>{trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl)}</div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>P&L</div>
              </div>
              <div className="trade-col-date" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text2)' }}>{new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit' })}</div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{tr.dateLabel}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ padding: '4px 12px', borderRadius: '8px', background: trade.outcome === 'win' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: trade.outcome === 'win' ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                  {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>

      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadData(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .overview-perf-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .stats-hero { grid-template-columns: 1fr 1fr !important; }
          .time-filter-bar { flex: 1 !important; justify-content: flex-end !important; }
          .time-filter-bar button { flex: 1 !important; }
          .data-by-label { display: none !important; }
          .recent-trade-row { grid-template-columns: 1fr 70px 110px 90px !important; }
          .trade-col-rr { display: none !important; }
        }
        @media (max-width: 640px) {
          .stats-hero { gap: 8px !important; }
          .stat-card { padding: 14px !important; }
          .stat-card > div:first-child > div { width: 28px !important; height: 28px !important; }
          .recent-trade-row { grid-template-columns: 1fr 58px 80px 65px !important; gap: 6px !important; }
          .trades-section-header { padding: 14px !important; }
          .balance-card .bal-amount { font-size: 29px !important; }
          .balance-card .bal-header { padding: 14px 16px 12px !important; }
          .balance-card .bal-section { padding: 14px 16px !important; text-align: center !important; }
          .balance-card .bal-icon { width: 36px !important; height: 36px !important; }
          .balance-card .bal-name { font-size: 17px !important; }
          .balance-card .bal-mini-val { font-size: 14px !important; }
          .section-anim.anim-delay-3 { flex-wrap: wrap !important; gap: 10px !important; }
          .welcome-section { padding: 18px 16px !important; margin-bottom: 20px !important; }
          .welcome-inner { gap: 14px !important; }
          .welcome-tile { width: 46px !important; height: 46px !important; border-radius: 13px !important; }
          .welcome-tile > span { font-size: 23px !important; }
          .welcome-title { font-size: 19px !important; }
          .welcome-date { font-size: 12px !important; }
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
