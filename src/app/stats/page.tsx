'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import PageHeader from '@/components/PageHeader'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns'
import Link from 'next/link'

export default function StatsPage() {
  const { activePortfolio } = usePortfolio()
  const { language } = useApp()
  const tr = t[language]
  const [trades, setTrades] = useState<Trade[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

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
  trades.forEach(t => {
    const d = new Date(t.traded_at)
    if (d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()) {
      monthlyPnl[d.getDate()] = (monthlyPnl[d.getDate()] || 0) + t.pnl
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

  if (!activePortfolio && !loading) {
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
      <div style={{ ...glass, padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '-0.01em' }}>
            {tr.monthlyCalendar} — {format(currentMonth, language === 'he' ? 'MMMM yyyy' : 'MMMM yyyy')}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }}>‹</button>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }}>›</button>
          </div>
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
            return (
              <div key={day} style={{ background: pnl ? (pnl > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') : 'var(--bg3)', border: `1px solid ${pnl ? (pnl > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'var(--border)'}`, borderRadius: '8px', minHeight: '56px', padding: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text2)', marginBottom: '4px' }}>{day}</div>
                {pnl !== undefined && (
                  <div style={{ fontSize: '11px', fontWeight: '800', color: pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    {pnl >= 0 ? '+' : ''}${pnl}
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
