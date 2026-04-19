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
  const supabase = createClient()

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
        <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: ACCENT, color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
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

      {/* ── OVERVIEW TITLE ── */}
      <h2 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 24px', color: 'var(--text)', letterSpacing: '-0.03em' }}>{tr.overview}</h2>

      {/* ══════════════════════════════════════════════
          TOP ROW — Balance (left) + Equity Chart (right)
          ══════════════════════════════════════════════ */}
      <div className="top-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '16px', marginBottom: '16px' }}>

        {/* ── LEFT: Total Balance Card ── */}
        <div style={{ ...card, padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {/* Portfolio name + type badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="account_balance" size={18} color={ACCENT} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', lineHeight: 1.1 }}>{activePortfolio?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{mktLabel}</div>
              </div>
            </div>
            {initialCapital > 0 && (
              <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text3)', background: 'var(--bg3)', padding: '4px 10px', borderRadius: '8px' }}>
                {language === 'he' ? 'הון' : 'Capital'}: ${initialCapital.toLocaleString()}
              </span>
            )}
          </div>

          {/* Big balance number */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', fontWeight: '500' }}>
              {language === 'he' ? 'שווי תיק נוכחי' : 'Total Balance'}
            </div>
            <div dir="ltr" style={{ fontSize: '38px', fontWeight: '700', letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text)' }}>
              ${(portfolioValue.currentValue > 0 ? portfolioValue.currentValue : initialCapital).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Return percentage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: portfolioPositive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: '8px' }}>
              <Icon name={portfolioPositive ? 'trending_up' : 'trending_down'} size={14} color={portfolioPositive ? '#22c55e' : '#ef4444'} />
              <span dir="ltr" style={{ fontSize: '13px', fontWeight: '600', color: portfolioPositive ? '#22c55e' : '#ef4444' }}>
                {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(1)}%
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{language === 'he' ? 'תשואה כוללת' : 'all-time return'}</span>
          </div>

          {/* Mini stats row inside balance card */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', fontWeight: '500' }}>P&L</div>
              <div dir="ltr" style={{ fontSize: '15px', fontWeight: '700', color: portfolioPositive ? '#22c55e' : '#ef4444' }}>
                {portfolioValue.allTimePnl >= 0 ? '+' : '-'}${Math.abs(portfolioValue.allTimePnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', fontWeight: '500' }}>ROI</div>
              <div dir="ltr" style={{ fontSize: '15px', fontWeight: '700', color: portfolioPositive ? '#22c55e' : '#ef4444' }}>
                {portfolioValue.totalReturn >= 0 ? '+' : ''}{portfolioValue.totalReturn.toFixed(1)}%
              </div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', fontWeight: '500' }}>Drawdown</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: portfolioValue.maxDrawdown > 15 ? '#ef4444' : portfolioValue.maxDrawdown > 5 ? '#f59e0b' : '#22c55e' }}>
                -{portfolioValue.maxDrawdown.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Equity Curve Card ── */}
        <div style={{ ...card, padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>{tr.equityCurve}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '500' }}>{tr.performanceTimeline}</div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px' }}>{tr.totalPnl}</div>
              <div dir="ltr" style={{ fontSize: '20px', fontWeight: '700', color: pnlPositive ? '#22c55e' : '#ef4444' }}>
                {pnlPositive ? '+' : '-'}${Math.abs(stats.totalPnl).toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '200px' }}>
            {equityCurve.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={equityCurve} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.20} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px', fontFamily: 'Heebo', color: 'var(--text)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} formatter={(v: any) => [`$${v}`, tr.cumulativePnl]} />
                  <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2.5} fill="url(#eqGrad)" dot={false} activeDot={{ r: 4, fill: ACCENT, stroke: 'var(--bg2)', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Icon name="show_chart" size={36} color="var(--bg4)" />
                <p style={{ fontSize: '12px', color: 'var(--text3)', margin: 0 }}>{tr.noDataAddTrades}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          STAT CARDS ROW — with time filter
          ══════════════════════════════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.03em', margin: 0 }}>{language === 'he' ? 'נתוני ביצועים' : 'Performance'}</h2>
        <div className="time-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text3)' }}>{language === 'he' ? 'נתונים לפי:' : 'Data by:'}</span>
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
      <div className="stats-hero" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
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
          <div key={i} className="stat-card" style={{ ...card, padding: '20px' }}>
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
      <div style={{ ...card, overflow: 'hidden' }}>
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
            {language === 'he' ? 'כל העסקאות' : 'View All'}
            <Icon name={language === 'he' ? 'chevron_left' : 'chevron_right'} size={15} />
          </Link>
        </div>

        {/* Trades list */}
        <div style={{ padding: '4px 12px' }}>
          {trades.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <Icon name="receipt_long" size={32} color="var(--bg4)" style={{ display: 'block', marginBottom: '8px' }} />
              <p style={{ fontSize: '13px', color: 'var(--text3)', margin: 0 }}>{tr.noMoreTrades}</p>
            </div>
          ) : trades.map((trade, idx) => (
            <div key={trade.id} onClick={() => setSelectedTrade(trade)} className="recent-trade-row"
              style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 90px 100px', alignItems: 'center', gap: '12px', padding: '14px 10px', cursor: 'pointer', transition: 'background 0.12s', borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none', borderRadius: '8px' }}
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

      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadData() }} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .top-row { grid-template-columns: 1fr !important; }
          .stats-hero { grid-template-columns: 1fr 1fr !important; }
          .time-filter-bar { width: 100% !important; }
          .time-filter-bar button { flex: 1 !important; }
          .recent-trade-row { grid-template-columns: 1fr 110px 90px !important; }
          .trade-col-rr, .trade-col-date { display: none !important; }
        }
        @media (max-width: 640px) {
          .stats-hero { gap: 8px !important; }
          .stat-card { padding: 14px !important; }
          .recent-trade-row { grid-template-columns: 1fr 90px 72px !important; gap: 6px !important; }
          .trades-section-header { padding: 14px !important; }
        }
      `}</style>
    </div>
  )
}
