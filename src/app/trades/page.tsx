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

const PAGE_SIZE = 6

export default function TradesPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language } = useApp()
  const tr = t[language]
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const supabase = createClient()
  const isRTL = language === 'he'

  useEffect(() => { if (activePortfolio) { setPage(0); loadTrades(0) } }, [activePortfolio, filter])

  // Realtime subscription
  useEffect(() => {
    if (!activePortfolio) return
    const channel = supabase
      .channel('trades-page-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `portfolio_id=eq.${activePortfolio.id}` }, () => {
        loadTrades(page)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activePortfolio, page])

  async function loadTrades(p: number) {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const from = p * PAGE_SIZE
    let query = supabase.from('trades').select('*', { count: 'exact' })
      .eq('portfolio_id', activePortfolio!.id)
      .order('traded_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (filter !== 'all') query = (query as any).eq('outcome', filter)
    const { data, count } = await query
    if (data) setTrades(data)
    if (count !== null) setTotal(count)
    setLoading(false)
  }

  function changePage(delta: number) {
    const next = page + delta
    setPage(next)
    loadTrades(next)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const canBack    = page < totalPages - 1  // › = go back in time (older)
  const canForward = page > 0               // ‹ = go forward (newer)

  const FILTERS = [
    { key: 'all', label: tr.all, icon: 'receipt_long' },
    { key: 'win', label: 'WIN', icon: 'trending_up' },
    { key: 'loss', label: 'LOSS', icon: 'trending_down' },
  ]

  const isLong = (d: string) => d === 'long'

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader
          title={tr.allTradesTitle}
          subtitle={language === 'he' ? 'היסטוריית מסחר מלאה' : 'Full trading history'}
          icon="receipt_long"
        />
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
        title={tr.allTradesTitle}
        subtitle={language === 'he' ? 'היסטוריית מסחר מלאה' : 'Full trading history'}
        icon="receipt_long"
      />

      {/* Filters + pagination row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
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
              {filter === key && <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '1px 6px', fontSize: '10px' }}>{total}</span>}
            </button>
          ))}
        </div>

        {/* Pagination arrows */}
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '600' }}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
            </span>
            <button
              onClick={() => changePage(1)}
              disabled={!canBack}
              style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canBack ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canBack ? 1 : 0.25, transition: 'all 0.2s' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>chevron_right</span>
            </button>
            <button
              onClick={() => changePage(-1)}
              disabled={!canForward}
              style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canForward ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canForward ? 1 : 0.25, transition: 'all 0.2s' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>chevron_left</span>
            </button>
          </div>
        )}
      </div>

      {/* Trades list */}
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
          <div style={{ padding: '8px 12px' }}>
            {trades.map((trade, idx) => (
              <div
                key={trade.id}
                onClick={() => setSelectedTrade(trade)}
                style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 90px 100px', alignItems: 'center', gap: '12px', padding: '14px 8px', borderRadius: '14px', marginBottom: idx < trades.length - 1 ? '2px' : '0', cursor: 'pointer', transition: 'background 0.15s', borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none' }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                className="trade-row"
              >
                {/* Symbol + direction */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: isLong(trade.direction) ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isLong(trade.direction) ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: isLong(trade.direction) ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{isLong(trade.direction) ? 'trending_up' : 'trending_down'}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.01em' }}>{trade.symbol}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                      {language === 'he' ? 'צמד' : 'Pair'}
                    </div>
                  </div>
                </div>

                {/* RR */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#4a7fff' }}>1:{trade.rr_ratio?.toFixed(1) || '—'}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>RR</div>
                </div>

                {/* P&L */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>P&L</div>
                </div>

                {/* Date */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text2)' }}>
                    {new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                    {language === 'he' ? 'תאריך' : 'Date'}
                  </div>
                </div>

                {/* Status */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{ padding: '5px 14px', borderRadius: '999px', fontSize: '10px', fontWeight: '900', background: trade.outcome === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${trade.outcome === 'win' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, color: trade.outcome === 'win' ? '#22c55e' : '#ef4444' }}>
                    {trade.outcome === 'win' ? '✓ WIN' : '✕ LOSS'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadTrades(page) }} />}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .trade-row { grid-template-columns: 1fr 80px 100px !important; }
          .trade-row > div:nth-child(4),
          .trade-row > div:nth-child(5) { display: none !important; }
        }
      `}</style>
    </div>
  )
}
