'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import Link from 'next/link'
import TradeModal from '@/components/TradeModal'
import PageHeader from '@/components/PageHeader'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'

export default function TradesPage() {
  const { activePortfolio } = usePortfolio()
  const { language } = useApp()
  const tr = t[language]
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
    { key: 'all', label: tr.all, icon: 'receipt_long' },
    { key: 'win', label: 'WIN', icon: 'trending_up' },
    { key: 'loss', label: 'LOSS', icon: 'trending_down' },
  ]

  const isLong = (d: string) => d === 'long'

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={tr.allTradesTitle}
        subtitle={language === 'he' ? 'היסטוריית מסחר מלאה' : 'Full trading history'}
        icon="receipt_long"
        action={
          <Link href="/add-trade" style={{ background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', padding: '10px 20px', borderRadius: '12px', textDecoration: 'none', fontSize: '12px', fontWeight: '700', boxShadow: '0 0 20px rgba(74,127,255,0.35)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Heebo, sans-serif' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>add</span>
            {tr.addTrade}
          </Link>
        }
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {FILTERS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setFilter(key as any)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 18px', borderRadius: '12px', fontSize: '12px',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700',
            border: `1px solid ${filter === key ? key === 'win' ? 'rgba(34,197,94,0.4)' : key === 'loss' ? 'rgba(239,68,68,0.4)' : 'rgba(74,127,255,0.4)' : 'var(--border)'}`,
            background: filter === key ? key === 'win' ? 'rgba(34,197,94,0.1)' : key === 'loss' ? 'rgba(239,68,68,0.1)' : 'rgba(74,127,255,0.1)' : 'var(--bg3)',
            color: filter === key ? key === 'win' ? '#22c55e' : key === 'loss' ? '#ef4444' : '#4a7fff' : 'var(--text3)',
            transition: 'all 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{icon}</span>
            {label}
            {filter === key && <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '1px 6px', fontSize: '10px' }}>{trades.length}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTopColor: '#4a7fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : trades.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(74,127,255,0.15)', display: 'block', marginBottom: '16px', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 48" }}>receipt_long</span>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)', marginBottom: '8px' }}>{tr.noTradesYet}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '24px' }}>{tr.noTradesDesc}</div>
            <Link href="/add-trade" style={{ background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', padding: '10px 24px', borderRadius: '12px', textDecoration: 'none', fontSize: '13px', fontWeight: '700' }}>{tr.addTradeCta}</Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 110px 120px', padding: '12px 20px', gap: '16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', fontSize: '10px', fontWeight: '800', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              <div>{tr.symbol}</div>
              <div style={{ textAlign: 'center' }}>{tr.entry}</div>
              <div style={{ textAlign: 'center' }}>RR</div>
              <div style={{ textAlign: 'center' }}>P&L</div>
              <div style={{ textAlign: 'center' }}>{tr.status}</div>
            </div>

            {/* Rows */}
            <div style={{ padding: '8px 12px' }}>
              {trades.map((trade, idx) => (
                <div key={trade.id} onClick={() => setSelectedTrade(trade)} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 110px 120px', alignItems: 'center', gap: '16px', padding: '12px 8px', borderRadius: '14px', marginBottom: idx < trades.length - 1 ? '2px' : '0', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: isLong(trade.direction) ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isLong(trade.direction) ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: isLong(trade.direction) ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{isLong(trade.direction) ? 'trending_up' : 'trending_down'}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: '2px' }}>{trade.symbol}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '600' }}>
                        {isLong(trade.direction) ? (language === 'he' ? 'לונג' : 'Long') : (language === 'he' ? 'שורט' : 'Short')} • {new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text2)' }}>{trade.entry_price}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '600', marginTop: '1px' }}>
                      <span style={{ color: 'rgba(239,68,68,0.6)' }}>{trade.stop_loss}</span>{' / '}<span style={{ color: 'rgba(34,197,94,0.6)' }}>{trade.take_profit}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#4a7fff', background: 'rgba(74,127,255,0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(74,127,255,0.15)' }}>1:{trade.rr_ratio?.toFixed(1)}</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>{trade.pnl >= 0 ? '+' : ''}${trade.pnl}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ padding: '5px 14px', borderRadius: '999px', fontSize: '10px', fontWeight: '900', background: trade.outcome === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${trade.outcome === 'win' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, color: trade.outcome === 'win' ? '#22c55e' : '#ef4444' }}>
                      {trade.outcome === 'win' ? '✓ WIN' : '✕ LOSS'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadTrades() }} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
