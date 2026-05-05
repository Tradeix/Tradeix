'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import PageHeader from '@/components/PageHeader'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { format, getDaysInMonth } from 'date-fns'

const ACCENT = '#0f8d63'

export default function StatsPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language, isPro, subscriptionLoading } = useApp()
  const router = useRouter()
  const tr = t[language]
  const [trades, setTrades] = useState<Trade[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const [hoverDow, setHoverDow] = useState<number | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function captureCalendar() {
    if (!calendarRef.current || capturing) return
    setCapturing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(calendarRef.current, { backgroundColor: null, scale: 2, useCORS: true, logging: false })
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `PL-${format(currentMonth, 'yyyy-MM')}.png`
        a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (e) { console.error('Screenshot failed', e) }
    finally { setCapturing(false) }
  }

  useEffect(() => { if (activePortfolio) loadData() }, [activePortfolio])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('trades').select('*').eq('portfolio_id', activePortfolio!.id).order('traded_at', { ascending: true })
    if (data) setTrades(data)
    setLoading(false)
  }

  const wins = trades.filter(t => t.outcome === 'win')
  const losses = trades.filter(t => t.outcome === 'loss')
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0)
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

  const equityCurve = trades.reduce((acc: any[], t, i) => {
    const prev = i === 0 ? 0 : acc[i - 1].value
    acc.push({ date: format(new Date(t.traded_at), 'dd/MM'), value: Math.round(prev + t.pnl) })
    return acc
  }, [])

  const daysInMonth = getDaysInMonth(currentMonth)
  // Calendar shows weekdays only (Mon–Fri). Find the dow of the first
  // weekday in the month — its column index (dow-1) is our leading offset.
  let firstWeekdayDow = 1
  for (let i = 1; i <= daysInMonth; i++) {
    const dow = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i).getDay()
    if (dow >= 1 && dow <= 5) { firstWeekdayDow = dow; break }
  }
  const leadingEmpty = firstWeekdayDow - 1 // 0..4
  // Build the list of weekday day-numbers we'll render
  const weekdayDays: number[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    const dow = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i).getDay()
    if (dow >= 1 && dow <= 5) weekdayDays.push(i)
  }
  const monthlyPnl: Record<number, number> = {}
  const monthlyCount: Record<number, number> = {}
  trades.forEach(t => {
    const d = new Date(t.traded_at)
    if (d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()) {
      const day = d.getDate()
      monthlyPnl[day] = (monthlyPnl[day] || 0) + t.pnl
      monthlyCount[day] = (monthlyCount[day] || 0) + 1
    }
  })

  const DAY_NAMES = language === 'he'
    ? ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const DAY_NAMES_LONG = language === 'he'
    ? ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Trading days only (Mon–Fri). Sat/Sun are excluded — markets are closed.
  const TRADING_DOWS = [1, 2, 3, 4, 5]

  // Aggregate by day of week. Indexed 0–6 internally so any stray weekend
  // trades still bucket correctly, but the UI only renders Mon–Fri.
  const byDow = Array.from({ length: 7 }, () => ({ count: 0, wins: 0, losses: 0, pnl: 0 }))
  trades.forEach(t => {
    const d = new Date(t.traded_at).getDay()
    byDow[d].count++
    byDow[d].pnl += (t.pnl || 0)
    if (t.outcome === 'win') byDow[d].wins++
    else byDow[d].losses++
  })
  const dowWinRate = (i: number) => {
    const total = byDow[i].wins + byDow[i].losses
    return total > 0 ? (byDow[i].wins / total) * 100 : 0
  }
  // Best / worst day across trading days that have at least one trade
  const dowsWithData = TRADING_DOWS.filter(i => byDow[i].count > 0)
  let bestDow = -1, worstDow = -1
  if (dowsWithData.length > 0) {
    bestDow = dowsWithData.reduce((a, b) => dowWinRate(a) >= dowWinRate(b) ? a : b)
    worstDow = dowsWithData.reduce((a, b) => dowWinRate(a) <= dowWinRate(b) ? a : b)
    if (bestDow === worstDow) worstDow = -1
  }

  const card: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }

  const StatCard = ({ label, value, color, icon, idx = 0 }: any) => (
    <div className="card-hover stat-anim" style={{ ...card, padding: '20px', animationDelay: `${idx * 0.05}s` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text3)' }}>{label}</div>
        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={color} />
        </div>
      </div>
      <div style={{ fontSize: '25px', fontWeight: '700', color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )

  const TooltipRow = ({ label, value, color }: { label: string; value: string; color: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '2px 0' }}>
      <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text3)' }}>{label}</span>
      <span dir="ltr" style={{ fontSize: '11px', fontWeight: '800', color }}>{value}</span>
    </div>
  )

  // Free tier paywall
  if (!subscriptionLoading && !isPro) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader title={tr.statsTitle} subtitle={language === 'he' ? 'ניתוח ביצועים מעמיק' : 'Deep performance analysis'} icon="monitoring" />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', marginBottom: '24px' }}>
            <Icon name="lock" size={32} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '23px', fontWeight: '600', color: 'var(--text)', marginBottom: '12px' }}>
            {language === 'he' ? 'עמוד הסטטיסטיקות זמין ל PRO בלבד' : 'Statistics page is PRO only'}
          </div>
          <div style={{ fontSize: '15px', color: 'var(--text3)', marginBottom: '32px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.6 }}>
            {language === 'he' ? 'שדרג למנוי PRO כדי לגשת לניתוחים מעמיקים, גרפים ולוח שנה חודשי' : 'Upgrade to PRO to access deep analytics, charts and monthly calendar'}
          </div>
          <Link href="/upgrade" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f59e0b', color: '#fff', padding: '12px 28px', borderRadius: '12px', textDecoration: 'none', fontSize: '15px', fontWeight: '600' }}>
            <Icon name="bolt" size={16} />
            {language === 'he' ? 'שדרג ל PRO — $20/חודש' : 'Upgrade to PRO — $20/mo'}
          </Link>
        </div>
      </div>
    )
  }

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader title={tr.statsTitle} subtitle={language === 'he' ? 'ניתוח ביצועים מעמיק' : 'Deep performance analysis'} icon="monitoring" />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="folder_open" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '21px', fontWeight: '600', marginBottom: '10px', color: 'var(--text)' }}>
            {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '24px' }}>
            {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
          </div>
          <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: '#0f8d63', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
            {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
          </button>
        </div>
      </div>
    )
  }

  // Loading state — render a spinner instead of falling through to the
  // empty-state branch. Fixes the brief 'no trades' flash that was showing
  // on every page entry while the trades query was in flight.
  if (loading) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader title={tr.statsTitle} subtitle={language === 'he' ? 'ניתוח ביצועים מעמיק' : 'Deep performance analysis'} icon="monitoring" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 20px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: '#0f8d63', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader title={tr.statsTitle} subtitle={language === 'he' ? 'ניתוח ביצועים מעמיק' : 'Deep performance analysis'} icon="monitoring" />
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Icon name="receipt_long" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>
            {language === 'he' ? 'אין עסקאות לביצוע ניתוח סטטיסטיקות' : 'Not enough trades for statistics'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
            {language === 'he' ? 'הוסף עסקאות לתיק כדי לראות ניתוח ביצועים מעמיק' : 'Add trades to this portfolio to see deep performance analysis'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader title={tr.statsTitle} subtitle={language === 'he' ? 'ניתוח ביצועים מעמיק' : 'Deep performance analysis'} icon="monitoring" />

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }} className="stats-grid-4">
        <StatCard idx={0} label={tr.winRate} value={`${winRate.toFixed(1)}%`} color={ACCENT} icon="speed" />
        <StatCard idx={1} label={tr.totalPnl} value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`} color={totalPnl >= 0 ? '#22c55e' : '#ef4444'} icon="trending_up" />
        <StatCard idx={2} label={tr.profitFactor} value={profitFactor.toFixed(2)} color="#0f8d63" icon="insights" />
        <StatCard idx={3} label={tr.trades} value={trades.length} color="var(--text2)" icon="swap_horiz" />
        <StatCard idx={4} label={`${tr.wins} / ${tr.losses}`} value={`${wins.length} / ${losses.length}`} color="#22c55e" icon="leaderboard" />
        <StatCard idx={5} label={tr.bestTrade} value={`+$${Math.max(0, ...trades.map(t => t.pnl || 0))}`} color="#22c55e" icon="arrow_circle_up" />
        <StatCard idx={6} label={tr.worstTrade} value={`$${Math.min(0, ...trades.map(t => t.pnl || 0))}`} color="#ef4444" icon="arrow_circle_down" />
        <StatCard idx={7} label={tr.avgRR} value={(() => {
          // RR is meaningful on winners only — average over them so a streak
          // of stop-outs doesn't drag the figure down with null contributions.
          const winsWithRR = trades.filter(t => t.outcome === 'win' && t.rr_ratio != null)
          if (!winsWithRR.length) return '—'
          const avg = winsWithRR.reduce((s, t) => s + (t.rr_ratio || 0), 0) / winsWithRR.length
          return <span dir="ltr">{`1 : ${avg.toFixed(1)}`}</span>
        })()} color="#f59e0b" icon="balance" />
      </div>

      {/* Equity chart */}
      <div className="section-anim anim-delay-5" style={{ ...card, marginBottom: '16px', overflow: 'hidden', position: 'relative' }}>
        {/* Subtle glow */}
        <div style={{ position: 'absolute', top: '-60px', right: '20%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(15,141,99,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(15,141,99,0.1)', border: '1px solid rgba(15,141,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="show_chart" size={22} color="#0f8d63" />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{tr.cumulativeEquity}</div>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '3px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tr.totalPnl}</div>
            <div dir="ltr" style={{ fontSize: '23px', fontWeight: '800', color: totalPnl >= 0 ? '#0f8d63' : '#ef4444', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {totalPnl >= 0 ? '+' : '-'}${Math.abs(totalPnl).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div style={{ minHeight: '180px', padding: '12px 0 0 0' }}>
          {equityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={equityCurve} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
                <defs>
                  <linearGradient id="eqGradGreenStats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f8d63" stopOpacity={0.45} />
                    <stop offset="55%" stopColor="#0f8d63" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#0f8d63" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} dy={8} padding={{ left: 10, right: 10 }} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'Heebo' }}
                  axisLine={false} tickLine={false}
                  width={56}
                  dx={-4}
                  padding={{ top: 14, bottom: 10 }}
                  tickFormatter={(v: number) => {
                    const a = Math.abs(v)
                    if (a >= 1000) return `${v < 0 ? '-' : ''}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`
                    return `${v < 0 ? '-' : ''}$${a}`
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ stroke: 'rgba(15,141,99,0.35)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    const val = payload[0].value
                    return (
                      <div style={{ background: 'var(--bg2)', border: '1px solid rgba(15,141,99,0.25)', borderRadius: '12px', fontSize: '13px', fontFamily: 'Heebo', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: '10px 14px' }}>
                        <div style={{ color: 'var(--text3)', fontSize: '11px', marginBottom: '4px' }}>{label}</div>
                        <div dir="ltr" style={{ color: val < 0 ? '#ef4444' : '#0f8d63', fontWeight: 700, fontSize: '15px' }}>${val.toLocaleString()}</div>
                        <div style={{ color: 'var(--text3)', fontSize: '11px', marginTop: '2px' }}>{tr.cumulativePnl}</div>
                      </div>
                    )
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#0f8d63" strokeWidth={2.5} fill="url(#eqGradGreenStats)" dot={false} activeDot={{ r: 5, fill: '#0f8d63', stroke: 'var(--bg2)', strokeWidth: 2.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '190px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(15,141,99,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="show_chart" size={26} color="var(--text3)" />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text3)', margin: 0 }}>{tr.noData}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Win rate by day of week — bar chart ── */}
      <div className="section-anim anim-delay-6 dow-wrap" style={{ ...card, padding: '24px', marginBottom: '16px', position: 'relative', overflow: 'visible' }}>
        <div style={{ position: 'absolute', top: '-50px', insetInlineStart: '15%', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(15,141,99,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(15,141,99,0.1)', border: '1px solid rgba(15,141,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="event_available" size={22} color="#0f8d63" />
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              {language === 'he' ? 'אחוזי הצלחה לפי יום' : 'Win rate by day'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px', fontWeight: '500' }}>
              {language === 'he' ? 'העבר עכבר על עמודה לפירוט' : 'Hover a bar for details'}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div style={{ position: 'relative', zIndex: 1 }} dir={language === 'he' ? 'rtl' : 'ltr'}>
          <div style={{ position: 'relative', height: '260px', display: 'flex' }}>
            {/* Y axis labels */}
            <div style={{ width: '40px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: '4px', fontSize: '11px', color: 'var(--text3)', fontWeight: '600' }}>
              {[100, 75, 50, 25, 0].map(v => (
                <div key={v} style={{ textAlign: 'end', paddingInlineEnd: '8px' }}>{v}%</div>
              ))}
            </div>

            {/* Plot area */}
            <div style={{ flex: 1, position: 'relative', borderInlineStart: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {/* Grid lines */}
              {[25, 50, 75, 100].map(p => (
                <div key={p} style={{ position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, bottom: `${p}%`, height: '1px', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
              ))}

              {/* Bars */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '14px', paddingInline: '12px', paddingBottom: '0' }}>
                {TRADING_DOWS.map(i => {
                  const b = byDow[i]
                  const wr = dowWinRate(i)
                  const has = b.count > 0
                  const isHover = hoverDow === i
                  let color = '#3f3f46'
                  if (has) {
                    if (i === bestDow) color = '#22c55e'
                    else if (i === worstDow) color = '#ef4444'
                    else color = ACCENT
                  }
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHoverDow(i)}
                      onMouseLeave={() => setHoverDow(null)}
                      style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', cursor: has ? 'pointer' : 'default' }}
                    >
                      <div style={{
                        width: '100%', maxWidth: '52px',
                        height: has ? `${Math.max(wr, 1.5)}%` : '3px',
                        background: has ? `linear-gradient(180deg, ${color} 0%, ${color}b8 100%)` : 'var(--bg3)',
                        borderRadius: '8px 8px 0 0',
                        border: has ? `1px solid ${color}` : '1px solid var(--border)',
                        boxShadow: isHover && has ? `0 0 0 2px ${color}33, 0 10px 30px ${color}55` : 'none',
                        transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                        transform: isHover && has ? 'translateY(-2px)' : 'none',
                      }} />

                      {/* Tooltip — anchored to the bottom of the bar slot
                          (right above the X axis labels) so it doesn't float
                          over the chart header. Compact for mobile. */}
                      {isHover && (
                        <div style={{
                          position: 'absolute', bottom: '6px',
                          left: '50%', transform: 'translateX(-50%)',
                          background: '#0f1117', border: `1px solid ${has ? color : 'var(--border)'}`,
                          borderRadius: '10px', padding: '8px 11px', minWidth: '130px',
                          boxShadow: '0 8px 22px rgba(0,0,0,0.55)', zIndex: 10,
                          pointerEvents: 'none',
                          fontFamily: 'Heebo, sans-serif',
                        }}
                          dir={language === 'he' ? 'rtl' : 'ltr'}
                        >
                          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text)', marginBottom: '5px', textAlign: 'start', letterSpacing: '0.02em' }}>
                            {DAY_NAMES_LONG[i]}
                          </div>
                          {!has ? (
                            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '600' }}>
                              {language === 'he' ? 'אין עסקאות' : 'No trades'}
                            </div>
                          ) : (
                            <>
                              <TooltipRow label={language === 'he' ? 'עסקאות' : 'Trades'} value={String(b.count)} color="var(--text)" />
                              <TooltipRow label={language === 'he' ? 'נצחונות' : 'Wins'} value={String(b.wins)} color="#22c55e" />
                              <TooltipRow label={language === 'he' ? 'הפסדים' : 'Losses'} value={String(b.losses)} color="#ef4444" />
                              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                              <TooltipRow label={language === 'he' ? 'אחוז זכייה' : 'Win rate'} value={`${wr.toFixed(0)}%`} color={color} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* X axis labels */}
          <div style={{ display: 'flex', paddingInlineStart: '40px', marginTop: '10px' }}>
            <div style={{ flex: 1, display: 'flex', gap: '14px', paddingInline: '12px' }}>
              {TRADING_DOWS.map(i => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: '700', color: hoverDow === i ? 'var(--text)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'color 0.15s' }}>
                  {DAY_NAMES_LONG[i]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div ref={calendarRef} className="cal-wrap section-anim anim-delay-7" style={{ ...card, padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(15,141,99,0.1)', border: '1px solid rgba(15,141,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="calendar_today" size={22} color="#0f8d63" />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{tr.monthlyCalendar}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--bg3)', border: 'none', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chevron_right" size={18} />
            </button>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', minWidth: '110px', textAlign: 'center' }}>{format(currentMonth, 'MMMM yyyy')}</div>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--bg3)', border: 'none', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chevron_left" size={18} />
            </button>
            <button onClick={captureCalendar} disabled={capturing} title={language === 'he' ? 'שמור תמונה' : 'Save image'}
              style={{
                width: '36px', height: '32px', borderRadius: '10px',
                background: '#0f8d63', border: 'none', color: '#fff',
                cursor: capturing ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginInlineStart: '8px',
                boxShadow: '0 4px 14px rgba(15,141,99,0.4)',
                transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,141,99,0.55)' }}
              onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,141,99,0.4)' }}
            >
              <Icon name={capturing ? 'hourglass_empty' : 'photo_camera'} size={16} color="#fff" />
            </button>
          </div>
        </div>

        <div className="cal-grid" style={{ marginBottom: '4px' }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="cal-dayname">{DAY_NAMES[i]}</div>)}
        </div>

        <div className="cal-grid">
          {Array.from({ length: leadingEmpty }).map((_, i) => <div key={`e-${i}`} />)}
          {weekdayDays.map(day => {
            const pnl = monthlyPnl[day]
            const count = monthlyCount[day]
            const hasData = pnl !== undefined
            const isGreen = hasData && pnl > 0
            const isRed = hasData && pnl < 0
            const isZero = hasData && pnl === 0
            return (
              <div key={day} className="cal-cell" style={{
                background: isGreen ? 'rgba(34,197,94,0.06)' : isRed ? 'rgba(239,68,68,0.06)' : 'var(--bg3)',
                border: `1px solid ${isGreen ? 'rgba(34,197,94,0.12)' : isRed ? 'rgba(239,68,68,0.12)' : 'var(--border)'}`,
              }}>
                <div className="cal-day" style={{ color: isGreen ? 'rgba(34,197,94,0.7)' : isRed ? 'rgba(239,68,68,0.7)' : 'var(--text3)' }}>{day}</div>
                {hasData && (
                  <div className="cal-body">
                    <div className="cal-pnl" style={{ color: isGreen ? '#22c55e' : isRed ? '#ef4444' : 'var(--text3)' }}>
                      {isZero ? '$0' : `${pnl > 0 ? '+' : ''}$${Math.abs(pnl) >= 1000 ? (Math.abs(pnl) / 1000).toFixed(1) + 'k' : Math.abs(pnl).toFixed(0)}`}
                    </div>
                    <div className="cal-wr" style={{ color: 'var(--text3)' }}>{count} TRADE{count !== 1 ? 'S' : ''}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) { .stats-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) {
          .stats-grid-4 { gap: 8px !important; } .stats-grid-4 > div { padding: 14px !important; } .stats-grid-4 > div > div:last-child { font-size: 21px !important; }
          .dow-wrap { padding: 16px !important; }
          .dow-chips { gap: 5px !important; }
          .dow-chips button { padding: 10px 2px !important; }
          .dow-chips button > span:first-child { font-size: 10px !important; }
          .dow-chips button > span:nth-child(2) { font-size: 13px !important; }
          .dow-stats-row { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .cal-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
        .cal-dayname { font-size: 11px; font-weight: 600; color: var(--text3); text-align: center; padding: 4px 0 5px; text-transform: uppercase; letter-spacing: 0.04em; }
        .cal-cell { border-radius: 12px; min-height: 84px; padding: 8px 6px 6px; display: flex; flex-direction: column; cursor: default; }
        .cal-day { font-size: 13px; font-weight: 600; line-height: 1; margin-bottom: 4px; align-self: flex-start; padding-inline-start: 2px; }
        .cal-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; }
        .cal-pnl { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; text-align: center; }
        .cal-wr { font-size: 10px; font-weight: 600; text-align: center; letter-spacing: 0.04em; }
        @media (max-width: 640px) {
          .cal-wrap { padding: 14px !important; }
          .cal-grid { gap: 4px; }
          .cal-cell { min-height: 68px; border-radius: 10px; padding: 5px 4px; }
          .cal-day { font-size: 11px; } .cal-pnl { font-size: 12px; } .cal-wr { font-size: 9px; }
          .cal-dayname { font-size: 10px; }
        }
        @media (max-width: 400px) {
          .cal-wrap { padding: 12px !important; }
          .cal-grid { gap: 3px; }
          .cal-cell { min-height: 56px; border-radius: 8px; padding: 4px 3px; }
          .cal-day { font-size: 10px; } .cal-pnl { font-size: 11px; } .cal-wr { font-size: 9px; }
          .cal-dayname { font-size: 9px; }
        }
      `}</style>
    </div>
  )
}
