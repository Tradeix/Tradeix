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
import Link from 'next/link'

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
      <div ref={calendarRef} style={{ ...glass, padding: '24px' }}>
        {/* Header: [prev] [centered title + camera] [next] */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexDirection: language === 'he' ? 'row-reverse' : 'row' }}>
          {/* Prev month arrow */}
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(74,127,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(74,127,255,0.3)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>chevron_left</span>
          </button>

          {/* Center: title + camera */}
          <div style={{ flex: 1, textAlign: 'center', position: 'relative', padding: '0 8px' }}>
            <div style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '-0.01em', color: 'var(--text)' }}>
              {tr.monthlyCalendar}
            </div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            {/* Camera button — absolute top-right of center block */}
            <button
              onClick={captureCalendar}
              disabled={capturing}
              title={language === 'he' ? 'שמור תמונה' : 'Save image'}
              style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [language === 'he' ? 'left' : 'right']: 0, width: '32px', height: '32px', borderRadius: '9px', background: capturing ? 'rgba(74,127,255,0.15)' : 'var(--bg3)', border: '1px solid var(--border)', color: capturing ? '#4a7fff' : 'var(--text3)', cursor: capturing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseOver={e => { if (!capturing) { e.currentTarget.style.background = 'rgba(74,127,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(74,127,255,0.3)'; e.currentTarget.style.color = '#4a7fff' } }}
              onMouseOut={e => { if (!capturing) { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' } }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px', fontVariationSettings: `'FILL' ${capturing ? 1 : 0}, 'wght' 200, 'GRAD' -25, 'opsz' 20` }}>
                {capturing ? 'hourglass_empty' : 'photo_camera'}
              </span>
            </button>
          </div>

          {/* Next month arrow */}
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(74,127,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(74,127,255,0.3)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>chevron_right</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text3)', textAlign: 'center', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const pnl = monthlyPnl[day]
            const count = monthlyCount[day]
            return (
              <div key={day} style={{ background: pnl !== undefined ? (pnl > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'var(--bg3)', border: `1px solid ${pnl !== undefined ? (pnl > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'var(--border)'}`, borderRadius: '10px', minHeight: '72px', padding: '8px 6px 6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', marginBottom: 'auto' }}>{day}</div>
                {pnl !== undefined && (
                  <div style={{ textAlign: 'center', marginTop: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: pnl >= 0 ? '#22c55e' : '#ef4444', letterSpacing: '-0.01em', lineHeight: 1 }}>
                      {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text3)', marginTop: '4px' }}>
                      {count} {language === 'he' ? 'עסקאות' : count === 1 ? 'Trade' : 'Trades'}
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
      `}</style>
    </div>
  )
}
