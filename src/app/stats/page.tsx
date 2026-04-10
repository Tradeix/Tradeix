'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trade, Portfolio } from '@/types'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns'

export default function StatsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [activePortfolio, setActivePortfolio] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [activePortfolio])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: pData } = await supabase.from('portfolios').select('*').eq('user_id', user.id)
    if (pData) {
      setPortfolios(pData)
      if (!activePortfolio && pData.length > 0) setActivePortfolio(pData[0].id)
    }

    if (activePortfolio) {
      const { data: tData } = await supabase.from('trades').select('*').eq('portfolio_id', activePortfolio).order('traded_at')
      if (tData) setTrades(tData)
    }
    setLoading(false)
  }

  // Calculate stats
  const wins = trades.filter(t => t.outcome === 'win')
  const losses = trades.filter(t => t.outcome === 'loss')
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

  // Equity curve
  const equityCurve = trades.reduce((acc: any[], t, i) => {
    const prev = i === 0 ? 0 : acc[i - 1].value
    acc.push({ date: format(new Date(t.traded_at), 'dd/MM'), value: prev + t.pnl })
    return acc
  }, [])

  // Monthly PnL per day
  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getDay(startOfMonth(currentMonth))
  const monthlyPnl: Record<number, number> = {}
  trades.forEach(t => {
    const d = new Date(t.traded_at)
    if (d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()) {
      monthlyPnl[d.getDate()] = (monthlyPnl[d.getDate()] || 0) + t.pnl
    }
  })

  const statCards = [
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: 'var(--blue)' },
    { label: 'P&L נטו', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'Profit Factor', value: profitFactor.toFixed(2), color: 'var(--purple)' },
    { label: 'סה"כ עסקאות', value: trades.length, color: 'var(--text)' },
    { label: 'WIN', value: wins.length, color: 'var(--green)' },
    { label: 'LOSS', value: losses.length, color: 'var(--red)' },
    { label: 'עסקה הטובה ביותר', value: `+$${Math.max(0, ...trades.map(t => t.pnl))}`, color: 'var(--green)' },
    { label: 'עסקה הגרועה ביותר', value: `$${Math.min(0, ...trades.map(t => t.pnl))}`, color: 'var(--red)' },
  ]

  const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: '20px', fontWeight: '600' }}>סטטיסטיקות</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {portfolios.map(p => (
            <button key={p.id} onClick={() => setActivePortfolio(p.id)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '13px',
              cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
              border: `1px solid ${activePortfolio === p.id ? 'var(--blue)' : 'var(--border)'}`,
              background: activePortfolio === p.id ? 'var(--blue3)' : 'transparent',
              color: activePortfolio === p.id ? 'var(--blue)' : 'var(--text2)',
              transition: 'all 0.2s',
            }}>{p.name}</button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }} className="stats-grid-4">
        {statCards.map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '16px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color}, transparent)` }} />
            <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Equity Chart */}
      {equityCurve.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>עקומת הון מצטברת</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={equityCurve}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Rubik' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Rubik' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Rubik' }} formatter={(v: any) => [`$${v}`, 'P&L מצטבר']} />
              <Line type="monotone" dataKey="value" stroke="var(--purple)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Calendar */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>
            לוח P&L יומי — {format(currentMonth, 'MMMM yyyy')}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }}>‹</button>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }}>›</button>
          </div>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center', padding: '4px 0', fontWeight: '500' }}>{d}</div>
          ))}
        </div>

        {/* Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const pnl = monthlyPnl[day]
            return (
              <div key={day} style={{
                background: pnl ? (pnl > 0 ? '#10b98110' : '#ef444410') : 'var(--bg3)',
                border: `1px solid ${pnl ? (pnl > 0 ? '#10b98133' : '#ef444433') : 'var(--border)'}`,
                borderRadius: '6px', minHeight: '56px', padding: '6px',
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text2)', marginBottom: '4px' }}>{day}</div>
                {pnl !== undefined && (
                  <div style={{ fontSize: '11px', fontWeight: '600', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
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
        @media (max-width: 480px) { .stats-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </div>
  )
}
