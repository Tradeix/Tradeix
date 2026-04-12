'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import Link from 'next/link'
import TradeModal from '@/components/TradeModal'
import PageHeader from '@/components/PageHeader'
import { usePortfolio } from '@/lib/portfolio-context'

export default function TradesPage() {
  const { activePortfolio } = usePortfolio()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const supabase = createClient()

  useEffect(() => { if (activePortfolio) loadTrades() }, [activePortfolio, filter])

  async function loadTrades() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let query = supabase.from('trades').select('*')
      .eq('portfolio_id', activePortfolio!.id)
      .order('traded_at', { ascending: false })
    if (filter !== 'all') query = query.eq('outcome', filter)
    const { data } = await query
    if (data) setTrades(data)
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="כל העסקאות"
        subtitle="היסטוריית מסחר מלאה"
        icon="receipt_long"
        action={
          <Link href="/add-trade" style={{ background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', padding: '10px 20px', borderRadius: '12px', textDecoration: 'none', fontSize: '12px', fontWeight: '700', boxShadow: '0 0 20px rgba(74,127,255,0.35)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Heebo, sans-serif' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>add</span>
            עסקה חדשה
          </Link>
        }
      />

      {/* Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[{ key: 'all', label: 'הכל' }, { key: 'win', label: '✓ WIN' }, { key: 'loss', label: '✕ LOSS' }].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key as any)} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '13px',
            cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
            border: `1px solid ${filter === key ? 'var(--blue)' : 'var(--border)'}`,
            background: filter === key ? 'var(--blue3)' : 'transparent',
            color: filter === key ? 'var(--blue)' : 'var(--text2)',
            transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1fr 110px 90px 80px 90px 90px',
          padding: '12px 16px', background: 'var(--bg3)',
          borderBottom: '1px solid var(--border)',
          fontSize: '11px', color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: '0.6px', gap: '8px',
        }}>
          <div /><div>סמל</div><div>כניסה</div><div>P&L</div><div>RR</div><div>תאריך</div><div>סטטוס</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>טוען...</div>
        ) : trades.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>📊</div>
            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>אין עסקאות עדיין</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '20px' }}>הוסף את העסקה הראשונה שלך</div>
            <Link href="/add-trade" style={{
              background: 'linear-gradient(135deg, var(--blue), var(--blue2))',
              color: '#fff', padding: '10px 20px', borderRadius: 'var(--radius-sm)',
              textDecoration: 'none', fontSize: '13px', fontWeight: '500',
            }}>＋ הוסף עסקה</Link>
          </div>
        ) : (
          trades.map(trade => (
            <div
              key={trade.id}
              onClick={() => setSelectedTrade(trade)}
              style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 110px 90px 80px 90px 90px',
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
                <div style={{ fontWeight: '600' }}>{trade.symbol}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{trade.direction === 'long' ? 'Long' : 'Short'}</div>
              </div>
              <div style={{ fontSize: '13px' }}>{trade.entry_price}</div>
              <div style={{ fontWeight: '600', color: trade.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
              </div>
              <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: 'var(--bg4)', color: 'var(--text2)' }}>
                1:{trade.rr_ratio?.toFixed(1)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                {new Date(trade.traded_at).toLocaleDateString('he-IL')}
              </div>
              <div style={{ fontSize: '12px', color: trade.outcome === 'win' ? 'var(--green)' : 'var(--red)' }}>
                {trade.outcome === 'win' ? '✓ WIN' : '✕ LOSS'}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTrade && (
        <TradeModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onUpdate={() => { setSelectedTrade(null); loadTrades() }}
        />
      )}
    </div>
  )
}
