'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { Trade, Stats } from '@/types'
import TradeModal from '@/components/TradeModal'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import Icon from '@/components/Icon'

const ACCENT = '#4a7fff'

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
  const [equityCurve, setEquityCurve] = useState<{date: string; value: number}[]>([])
  const [portfolioValue, setPortfolioValue] = useState({ currentValue: 0, allTimePnl: 0, totalReturn: 0, maxDrawdown: 0 })
  const [userName, setUserName] = useState('')
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
  const todayIndex = Math.floor(Date.now() / 86400000) % QUOTES_HE.length
  const dailyQuote = language === 'he' ? QUOTES_HE[todayIndex] : QUOTES_EN[todayIndex]

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserName(user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || '')
    })
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
      const { data: allTrades } = await supabase.from('trades').select('pnl, traded_at').eq('portfolio_id', activePortfolio!.id).gte('traded_at', startDate).order('traded_at', { ascending: true })
      if (allTrades && allTrades.length > 0) {
        const curve = allTrades.reduce((acc: any[], x: any, i: number) => {
          const prev = i === 0 ? 0 : acc[i-1].value
          acc.push({ date: new Date(x.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day:'2-digit', month:'2-digit' }), value: Math.round(prev + (x.pnl || 0)) })
          return acc
        }, [])
        setEquityCurve(curve)
      } else { setEquityCurve([]) }
    } finally {}
  }

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', fontFamily: 'Heebo, sans-serif' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon name="folder_open" size={32} color="var(--text3)" />
        </div>
        <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
          {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '28px' }}>
          {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
        </div>
        <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: '#10b981', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
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
      {userName && (
        <div className="welcome-section section-anim" style={{
          marginBottom: '28px',
          padding: '24px 28px',
          borderRadius: 'var(--radius)',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(74,127,255,0.06) 100%)',
          border: '1px solid rgba(16,185,129,0.12)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: '-30px', right: language === 'he' ? 'auto' : '-30px', left: language === 'he' ? '-30px' : 'auto', width: '140px', height: '140px', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Icon name="waving_hand" size={22} color="#10b981" />
              <h2 className="welcome-title" style={{
                fontSize: '20px', fontWeight: '700', margin: 0,
                color: 'var(--text)', letterSpacing: '-0.01em',
                fontFamily: 'Heebo, sans-serif',
              }}>
                {language === 'he' ? `ברוכים השבים, ${userName}` : `Welcome back, ${userName}`}
              </h2>
            </div>
            <p className="welcome-quote" style={{
              fontSize: '13.5px', fontWeight: '400', color: 'var(--text3)',
              margin: 0, lineHeight: 1.6, fontStyle: 'italic',
              fontFamily: 'Heebo, sans-serif',
            }}>
              "{dailyQuote}"
            </p>
          </div>
        </div>
      )}

      {/* ── OVERVIEW TITLE ── */}
      <div className="section-anim" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div className="section-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="space_dashboard" size={20} color="#10b981" />
        </div>
        <div>
          <h2 className="section-title" style={{ fontSize: '22px', fontWeight: '600', margin: 0, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.15, fontFamily: 'Heebo, sans-serif' }}>{tr.overview}</h2>
          <p className="section-subtitle" style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text3)', margin: '4px 0 0', lineHeight: 1.4, fontFamily: 'Heebo, sans-serif' }}>
            {language === 'he' ? 'מבט כולל על ביצועי התיק שלך' : 'A complete look at your portfolio performance'}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TOP ROW — Balance (left) + Equity Chart (right)
          ══════════════════════════════════════════════ */}
      <div className="top-row section-anim anim-delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '16px', marginBottom: '40px' }}>

        {/* ── LEFT: Total Balance Card ── */}
        <div className="card-hover balance-card" style={{ ...card, padding: '0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.15)', position: 'relative' }}>
          {/* Green glow effect */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Portfolio name header */}
          <div className="bal-header" style={{ padding: '20px 28px 16px', borderBottom: '1px solid rgba(16,185,129,0.08)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="bal-icon" style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="account_balance" size={22} color="#10b981" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bal-name" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activePortfolio?.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '6px' }}>{mktLabel}</span>
                  {initialCapital > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text2)' }}>
                      {language === 'he' ? 'קרן' : 'Capital'}: <span style={{ color: 'var(--text)' }}>${initialCapital.toLocaleString()}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Balance section */}
          <div className="bal-section" style={{ padding: '20px 28px', position: 'relative' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {language === 'he' ? 'שווי תיק נוכחי' : 'Total Balance'}
            </div>
            <div dir="ltr" className="bal-amount" style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text)' }}>
              ${(portfolioValue.currentValue > 0 ? portfolioValue.currentValue : initialCapital).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Mini stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'rgba(16,185,129,0.06)', marginTop: 'auto' }}>
            <div style={{ background: 'var(--bg2)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>P&L</div>
              <div dir="ltr" className="bal-mini-val" style={{ fontSize: '16px', fontWeight: '700', color: portfolioPositive ? '#22c55e' : '#ef4444' }}>
                {portfolioValue.allTimePnl >= 0 ? '+' : '-'}${Math.abs(portfolioValue.allTimePnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROI</div>
              <div dir="ltr" className="bal-mini-val" style={{ fontSize: '16px', fontWeight: '700', color: portfolioPositive ? '#22c55e' : '#ef4444' }}>
                {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(1)}%
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drawdown</div>
              <div className="bal-mini-val" style={{ fontSize: '16px', fontWeight: '700', color: portfolioValue.maxDrawdown > 15 ? '#ef4444' : portfolioValue.maxDrawdown > 5 ? '#f59e0b' : '#22c55e' }}>
                -{portfolioValue.maxDrawdown.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Equity Curve Card ── */}
        <div className="card-hover equity-card" style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* Subtle glow */}
          <div style={{ position: 'absolute', top: '-60px', right: '20%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Header */}
          <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="show_chart" size={18} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', lineHeight: 1.2 }}>{tr.equityCurve}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text3)', fontWeight: '500', marginTop: '1px' }}>{tr.performanceTimeline}</div>
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '3px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tr.totalPnl}</div>
              <div dir="ltr" style={{ fontSize: '22px', fontWeight: '800', color: pnlPositive ? '#10b981' : '#ef4444', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {pnlPositive ? '+' : '-'}${Math.abs(stats.totalPnl).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={{ flex: 1, minHeight: '180px', padding: '12px 8px 0 0' }}>
            {equityCurve.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={equityCurve} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eqGradGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="50%" stopColor="#10b981" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} width={55} tickFormatter={(v: number) => `$${v}`} dx={-4} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg2)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', fontSize: '12px', fontFamily: 'Heebo', color: 'var(--text)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', padding: '10px 14px' }}
                    formatter={(v: any) => [`$${v}`, tr.cumulativePnl]}
                    cursor={{ stroke: 'rgba(16,185,129,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} fill="url(#eqGradGreen)" dot={false} activeDot={{ r: 5, fill: '#10b981', stroke: 'var(--bg2)', strokeWidth: 2.5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '190px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="show_chart" size={26} color="var(--text3)" />
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text3)', margin: 0 }}>{tr.noDataAddTrades}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          STAT CARDS ROW — with time filter
          ══════════════════════════════════════════════ */}
      <div className="section-anim anim-delay-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="section-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="monitoring" size={20} color="#10b981" />
          </div>
          <div>
            <h2 className="section-title" style={{ fontSize: '22px', fontWeight: '600', margin: 0, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.15, fontFamily: 'Heebo, sans-serif' }}>{language === 'he' ? 'נתוני ביצועים' : 'Performance'}</h2>
            <p className="section-subtitle" style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text3)', margin: '4px 0 0', lineHeight: 1.4, fontFamily: 'Heebo, sans-serif' }}>
              {language === 'he' ? 'סטטיסטיקות מסחר לפי תקופה' : 'Trading statistics by period'}
            </p>
          </div>
        </div>
        <div className="time-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginInlineStart: 'auto' }}>
          <span className="data-by-label" style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text3)' }}>{language === 'he' ? 'נתונים לפי:' : 'Data by:'}</span>
          <div style={{ display: 'flex', background: 'var(--bg3)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border)', gap: '2px' }}>
            {TIME_FILTERS.map((label, i) => (
              <button key={i} onClick={() => setTimeFilter(i)} style={{
                padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '500',
                cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
                background: timeFilter === i ? '#10b981' : 'transparent',
                color: timeFilter === i ? '#fff' : 'var(--text3)',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="stats-hero" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '40px' }}>
        {[
          { label: `${tr.total} ${tr.trades}`, value: stats.totalTrades, icon: 'receipt_long', color: ACCENT,
            sub: <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '2px 8px', borderRadius: '6px' }}>{stats.wins}W</span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: '6px' }}>{stats.losses}L</span>
            </div> },
          { label: tr.winRate, value: `${stats.winRate.toFixed(0)}%`, icon: 'emoji_events', color: '#22c55e' },
          { label: tr.portfolioPerformance, value: `${pnlPositive ? '+' : ''}$${stats.totalPnl.toLocaleString()}`, icon: pnlPositive ? 'trending_up' : 'trending_down', color: pnlPositive ? '#22c55e' : '#ef4444' },
          { label: tr.profitFactor, value: stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—', icon: 'analytics', color: '#8b5cf6' },
        ].map((s, i) => (
          <div key={i} className={`stat-card card-hover stat-anim anim-delay-${i + 4}`} style={{ ...card, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text3)' }}>{s.label}</span>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={17} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: typeof s.value === 'string' && s.value.startsWith('+') ? s.color : typeof s.value === 'string' && s.value.startsWith('-') ? '#ef4444' : 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
            {s.sub || null}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          RECENT TRADES
          ══════════════════════════════════════════════ */}
      <div className="section-anim anim-delay-8" style={{ ...card, overflow: 'hidden' }}>
        {/* Header */}
        <div className="trades-section-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>{tr.recentTrades}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '500' }}>{tr.liveActivity}</div>
          </div>
          <Link href="/trades" style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 16px', borderRadius: '8px',
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
            color: '#10b981',
            fontSize: '12px', fontWeight: '600', textDecoration: 'none',
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
              <p style={{ fontSize: '13px', color: 'var(--text3)', margin: 0 }}>
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
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', lineHeight: 1 }}>{trade.symbol}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '500', marginTop: '3px' }}>{tr.pair}</div>
                </div>
              </div>
              <div className="trade-col-rr" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: ACCENT }}>1:{trade.rr_ratio?.toFixed(1) || '—'}</div>
                <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '2px' }}>RR</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div dir="ltr" style={{ fontSize: '14px', fontWeight: '700', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>{trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl)}</div>
                <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '2px' }}>P&L</div>
              </div>
              <div className="trade-col-date" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text2)' }}>{new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit' })}</div>
                <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '2px' }}>{tr.dateLabel}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ padding: '4px 12px', borderRadius: '8px', background: trade.outcome === 'win' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: trade.outcome === 'win' ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
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
          .top-row { grid-template-columns: 1fr !important; }
          .stats-hero { grid-template-columns: 1fr 1fr !important; }
          .time-filter-bar { flex: 1 !important; justify-content: flex-end !important; }
          .time-filter-bar button { flex: 1 !important; }
          .data-by-label { display: none !important; }
          .recent-trade-row { grid-template-columns: 1fr 110px 90px !important; }
          .trade-col-rr, .trade-col-date { display: none !important; }
        }
        @media (max-width: 640px) {
          .stats-hero { gap: 8px !important; }
          .stat-card { padding: 14px !important; }
          .stat-card > div:first-child > div { width: 28px !important; height: 28px !important; }
          .recent-trade-row { grid-template-columns: 1fr 90px 72px !important; gap: 6px !important; }
          .trades-section-header { padding: 14px !important; }
          .balance-card .bal-amount { font-size: 28px !important; }
          .balance-card .bal-header { padding: 14px 16px 12px !important; }
          .balance-card .bal-section { padding: 14px 16px !important; text-align: center !important; }
          .balance-card .bal-icon { width: 36px !important; height: 36px !important; }
          .balance-card .bal-name { font-size: 16px !important; }
          .balance-card .bal-mini-val { font-size: 13px !important; }
          .section-anim.anim-delay-3 { flex-wrap: wrap !important; gap: 10px !important; }
          .welcome-section { padding: 18px 16px !important; margin-bottom: 20px !important; }
          .welcome-title { font-size: 17px !important; }
          .welcome-quote { font-size: 12.5px !important; }
          .section-title { font-size: 18px !important; }
          .section-subtitle { display: none !important; }
          .section-icon { width: 36px !important; height: 36px !important; }
        }
      `}</style>
    </div>
  )
}
