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

  const FILTERS = [
    { key: 'all', label: 'הכל', icon: 'receipt_long' },
    { key: 'win', label: 'WIN', icon: 'trending_up' },
    { key: 'loss', label: 'LOSS', icon: 'trending_down' },
  ]

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title="כל העסקאות"
        subtitle="היסטוריית מסחר מלאה"
        icon="receipt_long"
        action={
          <Link href="/add-trade" style={{
            background: 'linear-gradient(135deg, #4a7fff, #3366dd)',
            color: '#fff', padding: '10px 20px', borderRadius: '12px',
            textDecoration: 'none', fontSize: '12px', fontWeight: '700',
            boxShadow: '0 0 20px rgba(74,127,255,0.35)',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'Heebo, sans-serif',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>add</span>
            עסקה חדשה
          </Link>
        }
      />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {FILTERS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setFilter(key as any)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 18px', borderRadius: '12px', fontSize: '12px',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700',
            border: `1px solid ${filter === key
              ? key === 'win' ? 'rgba(34,197,94,0.4)' : key === 'loss' ? 'rgba(239,68,68,0.4)' : 'rgba(74,127,255,0.4)'
              : 'rgba(255,255,255,0.08)'}`,
            background: filter === key
              ? key === 'win' ? 'rgba(34,197,94,0.1)' : key === 'loss' ? 'rgba(239,68,68,0.1)' : 'rgba(74,127,255,0.1)'
              : 'rgba(255,255,255,0.03)',
            color: filter === key
              ? key === 'win' ? '#22c55e' : key === 'loss' ? '#ef4444' : '#4a7fff'
              : 'rgba(229,226,225,0.35)',
            transition: 'all 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{icon}</span>
            {label}
            {filter === key && <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '1px 6px', fontSize: '10px' }}>{trades.length}</span>}
          </button>
        ))}
      </div>

      {/* Table container */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '20px', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid rgba(255,255,255,0.05)', borderTopColor: '#4a7fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : trades.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(74,127,255,0.15)', display: 'block', marginBottom: '16px', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 48" }}>receipt_long</span>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#e5e2e1', marginBottom: '8px' }}>אין עסקאות עדיין</div>
            <div style={{ fontSize: '12px', color: 'rgba(208,197,175,0.3)', marginBottom: '24px' }}>הוסף את העסקה הראשונה שלך</div>
            <Link href="/add-trade" style={{ background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', padding: '10px 24px', borderRadius: '12px', textDecoration: 'none', fontSize: '13px', fontWeight: '700' }}>＋ הוסף עסקה</Link>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 100px 110px 120px',
              padding: '12px 20px', gap: '16px',
              background: 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              fontSize: '10px', fontWeight: '800', color: 'rgba(208,197,175,0.3)',
              textTransform: 'uppercase', letterSpacing: '0.15em',
            }}>
              <div>נכס</div>
              <div style={{ textAlign: 'center' }}>כניסה</div>
              <div style={{ textAlign: 'center' }}>RR</div>
              <div style={{ textAlign: 'center' }}>P&L</div>
              <div style={{ textAlign: 'center' }}>סטטוס</div>
            </div>

            {/* Trade rows */}
            <div style={{ padding: '8px 12px' }}>
              {trades.map((trade, idx) => (
                <div
                  key={trade.id}
                  onClick={() => setSelectedTrade(trade)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 100px 110px 120px',
                    alignItems: 'center', gap: '16px',
                    padding: '12px 8px',
                    borderRadius: '14px',
                    marginBottom: idx < trades.length - 1 ? '2px' : '0',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Asset */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                      background: trade.direction === 'long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${trade.direction === 'long' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 0.2s',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: trade.direction === 'long' ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>
                        {trade.direction === 'long' ? 'trending_up' : 'trending_down'}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#e5e2e1', letterSpacing: '-0.01em', marginBottom: '2px' }}>{trade.symbol}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(208,197,175,0.35)', fontWeight: '600' }}>
                        {trade.direction === 'long' ? 'לונג' : 'שורט'} • {new Date(trade.traded_at).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                  </div>

                  {/* Entry */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(229,226,225,0.65)' }}>{trade.entry_price}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(208,197,175,0.25)', fontWeight: '600', marginTop: '1px' }}>
                      <span style={{ color: 'rgba(239,68,68,0.5)' }}>{trade.stop_loss}</span>
                      {' / '}
                      <span style={{ color: 'rgba(34,197,94,0.5)' }}>{trade.take_profit}</span>
                    </div>
                  </div>

                  {/* RR */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#4a7fff', background: 'rgba(74,127,255,0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(74,127,255,0.15)' }}>
                      1:{trade.rr_ratio?.toFixed(1)}
                    </span>
                  </div>

                  {/* P&L */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444', textShadow: trade.pnl >= 0 ? '0 0 12px rgba(34,197,94,0.3)' : '0 0 12px rgba(239,68,68,0.3)' }}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      padding: '5px 14px', borderRadius: '999px', fontSize: '10px', fontWeight: '900',
                      background: trade.outcome === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${trade.outcome === 'win' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      color: trade.outcome === 'win' ? '#22c55e' : '#ef4444',
                      letterSpacing: '0.05em',
                    }}>
                      {trade.outcome === 'win' ? '✓ WIN' : '✕ LOSS'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedTrade && (
        <TradeModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onUpdate={() => { setSelectedTrade(null); loadTrades() }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .trades-table { grid-template-columns: 1fr 80px 90px !important; }
        }
      `}</style>
    </div>
  )
}
