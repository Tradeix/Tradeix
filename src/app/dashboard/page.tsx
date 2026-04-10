'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trade, Portfolio, Stats } from '@/types'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const TIME_FILTERS = ['יום', 'שבוע', 'חודש', 'שנה']

export default function DashboardPage() {
  const [timeFilter, setTimeFilter] = useState('חודש')
  const [trades, setTrades] = useState<Trade[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [activePortfolio, setActivePortfolio] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalTrades: 0, wins: 0, losses: 0,
    winRate: 0, totalPnl: 0,
    profitFactor: 0, avgRR: 0,
    bestTrade: 0, worstTrade: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [activePortfolio, timeFilter])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load portfolios
      const { data: portfolioData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (portfolioData) {
        setPortfolios(portfolioData)
        if (!activePortfolio && portfolioData.length > 0) {
          setActivePortfolio(portfolioData[0].id)
        }
      }

      if (activePortfolio) {
        // Load trades for active portfolio
        let query = supabase
          .from('trades')
          .select('*')
          .eq('portfolio_id', activePortfolio)
          .order('traded_at', { ascending: false })
          .limit(5)

        const { data: tradeData } = await query
        if (tradeData) setTrades(tradeData)

        // Calculate stats
        const { data: allTrades } = await supabase
          .from('trades')
          .select('pnl, outcome')
          .eq('portfolio_id', activePortfolio)

        if (allTrades && allTrades.length > 0) {
          const wins = allTrades.filter(t => t.outcome === 'win')
          const losses = allTrades.filter(t => t.outcome === 'loss')
          const totalPnl = allTrades.reduce((s, t) => s + t.pnl, 0)
          const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
          const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
          setStats({
            totalTrades: allTrades.length,
            wins: wins.length,
            losses: losses.length,
            winRate: (wins.length / allTrades.length) * 100,
            totalPnl,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 999,
            avgRR: 2.3,
            bestTrade: Math.max(...allTrades.map(t => t.pnl)),
            worstTrade: Math.min(...allTrades.map(t => t.pnl)),
          })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ label, value, color, badge }: any) => (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '16px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${color}, transparent)`,
      }} />
      <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      {badge && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
          marginTop: '6px',
          background: badge.positive ? '#10b98122' : '#ef444422',
          color: badge.positive ? 'var(--green)' : 'var(--red)',
        }}>
          {badge.text}
        </div>
      )}
    </div>
  )

  if (portfolios.length === 0 && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>📁</div>
        <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>אין תיקים פתוחים</div>
        <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '24px' }}>
          צור תיק ראשון כדי להתחיל להעלות עסקאות ולראות סטטיסטיקות
        </div>
        <Link href="/portfolios" className="btn-primary" style={{
          background: 'linear-gradient(135deg, var(--blue), var(--blue2))',
          color: '#fff', padding: '12px 24px', borderRadius: 'var(--radius-sm)',
          textDecoration: 'none', fontSize: '14px', fontWeight: '500',
          boxShadow: '0 0 20px var(--blueglow)',
        }}>
          + צור תיק חדש
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Time filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '20px', fontWeight: '600' }}>דשבורד</div>
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '3px', gap: '2px', border: '1px solid var(--border)' }}>
          {TIME_FILTERS.map(t => (
            <button key={t} onClick={() => setTimeFilter(t)} style={{
              padding: '4px 12px', borderRadius: '6px', fontSize: '12px',
              cursor: 'pointer', border: 'none', fontFamily: 'Rubik, sans-serif',
              background: timeFilter === t ? 'var(--bg4)' : 'transparent',
              color: timeFilter === t ? 'var(--text)' : 'var(--text2)',
              fontWeight: timeFilter === t ? '500' : '400',
              transition: 'all 0.2s',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}
        className="stats-grid">
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color="var(--blue)" badge={{ text: '↑ +3.2%', positive: true }} />
        <StatCard label='P&L סה"כ' value={`${stats.totalPnl > 0 ? '+' : ''}$${stats.totalPnl.toLocaleString()}`} color="var(--green)" badge={{ text: '↑ +$320', positive: true }} />
        <StatCard label="עסקאות" value={stats.totalTrades} color="var(--text)" />
        <StatCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} color="var(--purple)" badge={{ text: '↑ מצויין', positive: true }} />
      </div>

      {/* Wins vs Losses bar */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
          <span style={{ color: 'var(--green)', fontWeight: '500' }}>✓ {stats.wins} WIN</span>
          <span style={{ color: 'var(--text3)', fontSize: '12px' }}>יחס ניצחונות</span>
          <span style={{ color: 'var(--red)', fontWeight: '500' }}>✕ {stats.losses} LOSS</span>
        </div>
        <div style={{ height: '8px', background: 'var(--bg4)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '4px',
            background: 'linear-gradient(90deg, var(--green), var(--blue))',
            width: `${stats.winRate}%`, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Equity Chart */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>עקומת הון</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>מאי 2024</div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={DEMO_EQUITY}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Rubik' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'Rubik' }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Rubik' }}
              formatter={(v: any) => [`$${v.toLocaleString()}`, 'הון']}
            />
            <Line type="monotone" dataKey="value" stroke="var(--blue)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Portfolio tabs + recent trades */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: '600' }}>עסקאות אחרונות</div>
        <Link href="/add-trade" style={{
          background: 'linear-gradient(135deg, var(--blue), var(--blue2))',
          color: '#fff', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
          textDecoration: 'none', fontSize: '13px', fontWeight: '500',
          boxShadow: '0 0 20px var(--blueglow)',
        }}>＋ עסקה חדשה</Link>
      </div>

      {/* Portfolio tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
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
        <Link href="/portfolios" style={{
          padding: '6px 14px', borderRadius: '20px', fontSize: '13px',
          border: '1px dashed var(--border)', color: 'var(--text3)',
          textDecoration: 'none', display: 'flex', alignItems: 'center',
        }}>+ תיק חדש</Link>
      </div>

      {/* Trades table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1fr 100px 100px 80px 80px',
          padding: '12px 16px', background: 'var(--bg3)',
          borderBottom: '1px solid var(--border)',
          fontSize: '11px', color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: '0.6px', gap: '8px',
        }}>
          <div />
          <div>סמל</div>
          <div>כניסה</div>
          <div>P&L</div>
          <div>RR</div>
          <div>סטטוס</div>
        </div>

        {trades.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '14px' }}>
            אין עסקאות עדיין —{' '}
            <Link href="/add-trade" style={{ color: 'var(--blue)', textDecoration: 'none' }}>הוסף עסקה ראשונה</Link>
          </div>
        ) : (
          trades.map(trade => (
            <div key={trade.id} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 100px 100px 80px 80px',
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              fontSize: '13px', gap: '8px', alignItems: 'center',
              cursor: 'pointer', transition: 'background 0.2s',
            }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '600',
                background: trade.direction === 'long' ? '#10b98122' : '#ef444422',
                color: trade.direction === 'long' ? 'var(--green)' : 'var(--red)',
              }}>
                {trade.direction === 'long' ? 'L' : 'S'}
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{trade.symbol}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                  {trade.direction === 'long' ? 'Long' : 'Short'}
                </div>
              </div>
              <div>{trade.entry_price}</div>
              <div style={{ fontWeight: '600', color: trade.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
              </div>
              <div style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                fontSize: '11px', fontWeight: '500',
                background: 'var(--bg4)', color: 'var(--text2)',
              }}>
                1:{trade.rr_ratio.toFixed(1)}
              </div>
              <div style={{ fontSize: '12px', color: trade.outcome === 'win' ? 'var(--green)' : 'var(--red)' }}>
                {trade.outcome === 'win' ? '✓ WIN' : '✕ LOSS'}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
