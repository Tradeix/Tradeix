'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import PageHeader from '@/components/PageHeader'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns'

export default function StatsPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language, isPro, subscriptionLoading } = useApp()
  const tr = t[language]
  const [trades, setTrades] = useState<Trade[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function captureCalendar() {
    if (!calendarRef.current || capturing) return
    setCapturing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(calendarRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      })
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `PL-${format(currentMonth, 'yyyy-MM')}.png`
        a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (e) {
      console.error('Screenshot failed', e)
    } finally {
      setCapturing(false)
    }
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
  const firstDay = getDay(startOfMonth(currentMonth))
  const monthlyPnl: Record<number, number> = {}
  const monthlyCount: Record<number, number> = {}
  const monthlyWins: Record<number, number> = {}
  trades.forEach(t => {
    const d = new Date(t.traded_at)
    if (d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()) {
      const day = d.getDate()
      monthlyPnl[day] = (monthlyPnl[day] || 0) + t.pnl
      monthlyCount[day] = (monthlyCount[day] || 0) + 1
      if (t.outcome === 'win') monthlyWins[day] = (monthlyWins[day] || 0) + 1
    }
  })

  const DAY_NAMES = language === 'he'
    ? ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const glass = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px' }

  const StatCard = ({ label, value, color, icon }: any) => (
    <div style={{ ...glass, padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', insetInlineEnd: '-20px', top: '-20px', width: '80px', height: '80px', background: `${color}15`, filter: 'blur(30px)', borderRadius: '50%' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ fontSize: '10px', fontWeight: '800', color: `${color}99`, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{label}</div>
        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color, fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{icon}</span>
        </div>
      </div>
      <div style={{ fontSize: '28px', fontWeight: '900', color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )

  // Free tier paywall
  if (!subscriptionLoading && !isPro) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader title={tr.statsTitle} subtitle={language === 'he' ? 'ניתוח ביצועים מעמיק' : 'Deep performance analysis'} icon="query_stats" />
        <div style={{ textAlign: 'center', padding: '80px 20px', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '24px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#f59e0b', fontVariationSettings: "'FILL' 1, 'wght' 200, 'GRAD' -25, 'opsz' 40" }}>lock</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text)', marginBottom: '12px', letterSpacing: '-0.01em' }}>
            {language === 'he' ? 'עמוד הסטטיסטיקות זמין ל PRO בלבד' : 'Statistics page is PRO only'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '32px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.6 }}>
            {language === 'he'
              ? 'שדרג למנוי PRO כדי לגשת לניתוחים מעמיקים, גרפים ולוח שנה חודשי'
              : 'Upgrade to PRO to access deep analytics, charts and monthly calendar'}
          </div>
          <Link href="/upgrade" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', padding: '14px 32px', borderRadius: '14px', textDecoration: 'none', fontSize: '14px', fontWeight: '800', boxShadow: '0 8px 24px rgba(245,158,11,0.35)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' -25, 'opsz' 20" }}>bolt</span>
            {language === 'he' ? 'שדרג ל PRO — $20/חודש' : 'Upgrade to PRO — $20/mo'}
          </Link>
        </div>
      </div>
    )
  }

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader title={tr.statsTitle} subtitle={language === 'he' ? 'ניתוח ביצועים מעמיק' : 'Deep performance analysis'} icon="query_stats" />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>📁</div>
          <div style={{ fontSize: '20px', fontWeight: '900', marginBottom: '10px', color: 'var(--text)' }}>
            {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px' }}>
            {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
          </div>
          <Link href="/portfolios" style={{ background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', padding: '12px 28px', borderRadius: '12px', textDecoration: 'none', fontSize: '13px', fontWeight: '700', boxShadow: '0 0 24px rgba(74,127,255,0.4)' }}>
            {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={tr.statsTitle}
        subtitle={language === 'he' ? 'ניתוח ביצועים מעמיק' : 'Deep performance analysis'}
        icon="query_stats"
      />

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }} className="stats-grid-4">
        <StatCard label={tr.winRate} value={`${winRate.toFixed(1)}%`} color="#4a7fff" icon="analytics" />
        <StatCard label={tr.totalPnl} value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`} color={totalPnl >= 0 ? '#22c55e' : '#ef4444'} icon="trending_up" />
        <StatCard label={tr.profitFactor} value={profitFactor.toFixed(2)} color="#8b5cf6" icon="security" />
        <StatCard label={tr.trades} value={trades.length} color="var(--text2)" icon="receipt_long" />
        <StatCard label={`${tr.wins} / ${tr.losses}`} value={`${wins.length} / ${losses.length}`} color="#22c55e" icon="scoreboard" />
        <StatCard label={tr.bestTrade} value={`+$${Math.max(0, ...trades.map(t => t.pnl || 0))}`} color="#22c55e" icon="emoji_events" />
        <StatCard label={tr.worstTrade} value={`$${Math.min(0, ...trades.map(t => t.pnl || 0))}`} color="#ef4444" icon="warning" />
        <StatCard label={tr.avgRR} value={trades.length ? `1:${(trades.reduce((s, t) => s + (t.rr_ratio || 0), 0) / trades.length).toFixed(1)}` : '—'} color="#f59e0b" icon="balance" />
      </div>

      {/* Equity chart */}
      <div style={{ ...glass, padding: '28px', marginBottom: '24px' }}>
        <div style={{ fontSize: '16px', fontWeight: '900', marginBottom: '20px', letterSpacing: '-0.01em' }}>{tr.cumulativeEquity}</div>
        {equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={equityCurve}>
              <defs>
                <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a7fff" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#4a7fff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Heebo' }} axisLine={false} tickLine={false} width={55} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px', fontFamily: 'Heebo', color: 'var(--text)' }} formatter={(v: any) => [`$${v}`, 'P&L']} />
              <Area type="monotone" dataKey="value" stroke="#4a7fff" strokeWidth={2.5} fill="url(#grad2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '12px', fontWeight: '700' }}>{tr.noData}</div>
        )}
      </div>

      {/* Calendar */}
      <div ref={calendarRef} className="cal-wrap" style={{ ...glass, padding: '24px' }}>

        {/* Header row: camera right | [prev] title [next] centered */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>

          {/* Left spacer (same width as camera btn to keep center balanced) */}
          <div style={{ width: '36px', flexShrink: 0 }} />

          {/* Center group: arrows tight around the title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
            {/* Prev arrow */}
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.1)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.35)'; e.currentTarget.style.color = '#06b6d4' }}
              onMouseOut={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>chevron_left</span>
            </button>

            {/* Title block */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '3px' }}>
                {tr.monthlyCalendar}
              </div>
              {/* Month name with cyan underline */}
              <div style={{ display: 'inline-block', position: 'relative' }}>
                <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '-0.01em', color: 'var(--text)', textTransform: 'uppercase' }}>
                  {format(currentMonth, 'MMMM yyyy')}
                </div>
                <div style={{ position: 'absolute', bottom: '-3px', left: '10%', right: '10%', height: '2px', background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Next arrow */}
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.1)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.35)'; e.currentTarget.style.color = '#06b6d4' }}
              onMouseOut={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>chevron_right</span>
            </button>
          </div>

          {/* Camera button — right side, cyan */}
          <button
            onClick={captureCalendar}
            disabled={capturing}
            title={language === 'he' ? 'שמור תמונה' : 'Save image'}
            style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: capturing ? 'rgba(6,182,212,0.25)' : 'rgba(6,182,212,0.15)',
              border: '1px solid rgba(6,182,212,0.4)',
              color: '#06b6d4',
              cursor: capturing ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: '0 0 10px rgba(6,182,212,0.2)',
            }}
            onMouseOver={e => { if (!capturing) { e.currentTarget.style.background = 'rgba(6,182,212,0.28)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(6,182,212,0.4)' } }}
            onMouseOut={e => { if (!capturing) { e.currentTarget.style.background = 'rgba(6,182,212,0.15)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(6,182,212,0.2)' } }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px', fontVariationSettings: `'FILL' ${capturing ? 1 : 0}, 'wght' 300, 'GRAD' -25, 'opsz' 20` }}>
              {capturing ? 'hourglass_empty' : 'photo_camera'}
            </span>
          </button>
        </div>

        {/* Day name headers */}
        <div className="cal-grid" style={{ marginBottom: '6px' }}>
          {DAY_NAMES.map(d => (
            <div key={d} className="cal-dayname">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="cal-grid">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const pnl = monthlyPnl[day]
            const count = monthlyCount[day]
            const wins = monthlyWins[day] || 0
            const hasData = pnl !== undefined
            const winRate = count ? Math.round((wins / count) * 100) : 0
            const isGreen = hasData && pnl > 0
            const isRed = hasData && pnl <= 0
            return (
              <div
                key={day}
                className="cal-cell"
                style={{
                  background: isGreen
                    ? 'linear-gradient(145deg, rgba(34,197,94,0.15), rgba(34,197,94,0.07))'
                    : isRed
                      ? 'linear-gradient(145deg, rgba(239,68,68,0.13), rgba(239,68,68,0.06))'
                      : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isGreen ? 'rgba(34,197,94,0.4)' : isRed ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: isGreen ? '0 0 14px rgba(34,197,94,0.14), inset 0 1px 0 rgba(34,197,94,0.15)' : isRed ? '0 0 14px rgba(239,68,68,0.1)' : 'none',
                }}
              >
                {/* Date number */}
                <div className="cal-day" style={{
                  color: isGreen ? 'rgba(34,197,94,0.9)' : isRed ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.22)',
                }}>
                  {day}
                </div>

                {/* P&L + win rate */}
                {hasData && (
                  <div className="cal-body">
                    <div className="cal-pnl" style={{ color: pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                      {pnl >= 0 ? '+' : ''}${Math.abs(pnl) >= 1000 ? (Math.abs(pnl) / 1000).toFixed(1) + 'k' : Math.abs(pnl).toFixed(0)}
                    </div>
                    <div className="cal-wr" style={{
                      color: winRate === 100 ? '#22c55e' : winRate > 50 ? 'rgba(34,197,94,0.75)' : winRate === 50 ? 'rgba(255,255,255,0.4)' : '#ef4444',
                    }}>
                      {winRate}%
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .stats-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }

        /* Calendar grid */
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .cal-dayname {
          font-size: 10px;
          font-weight: 800;
          color: rgba(255,255,255,0.25);
          text-align: center;
          padding: 4px 0 6px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .cal-cell {
          border-radius: 12px;
          min-height: 88px;
          padding: 8px 6px 6px;
          display: flex;
          flex-direction: column;
          transition: all 0.2s;
          cursor: default;
        }
        .cal-day {
          font-size: 13px;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 4px;
          align-self: flex-start;
          padding-inline-start: 2px;
        }
        .cal-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .cal-pnl {
          font-size: 15px;
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1;
          text-align: center;
        }
        .cal-wr {
          font-size: 10px;
          font-weight: 800;
          text-align: center;
          letter-spacing: 0.04em;
        }

        /* Tablet */
        @media (max-width: 640px) {
          .cal-wrap { padding: 16px !important; }
          .cal-grid { gap: 4px; }
          .cal-cell { min-height: 72px; border-radius: 10px; padding: 6px 4px 5px; }
          .cal-day { font-size: 11px; }
          .cal-pnl { font-size: 12px; }
          .cal-wr { font-size: 9px; }
          .cal-dayname { font-size: 9px; letter-spacing: 0.04em; padding-bottom: 4px; }
        }

        /* Mobile */
        @media (max-width: 400px) {
          .cal-wrap { padding: 14px !important; }
          .cal-grid { gap: 3px; }
          .cal-cell { min-height: 58px; border-radius: 8px; padding: 5px 3px 4px; }
          .cal-day { font-size: 10px; }
          .cal-pnl { font-size: 10px; }
          .cal-wr { font-size: 8px; }
          .cal-dayname { font-size: 8px; }
        }
      `}</style>
    </div>
  )
}
