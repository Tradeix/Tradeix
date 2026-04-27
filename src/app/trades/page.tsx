'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import Link from 'next/link'
import TradeModal from '@/components/TradeModal'
import PageHeader from '@/components/PageHeader'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Icon from '@/components/Icon'

const PAGE_SIZE = 6

export default function TradesPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language } = useApp()
  const router = useRouter()
  const tr = t[language]
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all')
  const [timeFilter, setTimeFilter] = useState(0) // 0=all 1=daily 2=weekly 3=monthly
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const supabase = createClient()
  const isRTL = language === 'he'

  useEffect(() => { if (activePortfolio) { setPage(0); loadTrades(0, filter, timeFilter) } }, [activePortfolio, filter, timeFilter])

  // Realtime subscription
  useEffect(() => {
    if (!activePortfolio) return
    const channel = supabase
      .channel('trades-page-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `portfolio_id=eq.${activePortfolio.id}` }, () => {
        loadTrades(page, filter, timeFilter)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activePortfolio, page])

  function getStartDate(f: number): string | null {
    if (f === 0) return null
    const now = new Date()
    if (f === 1) { const d = new Date(now); d.setHours(0,0,0,0); return d.toISOString() }
    if (f === 2) { const d = new Date(now); d.setDate(d.getDate()-7); d.setHours(0,0,0,0); return d.toISOString() }
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }

  async function loadTrades(p: number, outcomeFilter = filter, tf = timeFilter) {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const from = p * PAGE_SIZE
    let query = supabase.from('trades').select('*', { count: 'exact' })
      .eq('portfolio_id', activePortfolio!.id)
      .order('traded_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (outcomeFilter !== 'all') query = (query as any).eq('outcome', outcomeFilter)
    const startDate = getStartDate(tf)
    if (startDate) query = (query as any).gte('traded_at', startDate)
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
  const canOlder   = page < totalPages - 1
  const canNewer   = page > 0
  const olderIcon  = isRTL ? 'chevron_right' : 'chevron_left'
  const newerIcon  = isRTL ? 'chevron_left'  : 'chevron_right'

  const OUTCOME_FILTERS = [
    { key: 'win', label: 'WIN', icon: 'trending_up' },
    { key: 'loss', label: 'LOSS', icon: 'trending_down' },
  ]
  const TIME_LABELS = [
    language === 'he' ? 'הכל' : 'All',
    tr.daily, tr.weekly, tr.monthly,
  ]

  const isLong = (d: string) => d === 'long'

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader
          title={tr.allTradesTitle}
          subtitle={language === 'he' ? 'היסטוריית מסחר מלאה' : 'Full trading history'}
          icon="swap_horiz"
        />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="folder_open" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '21px', fontWeight: '700', marginBottom: '10px', color: 'var(--text)' }}>
            {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '24px' }}>
            {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
          </div>
          <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: '#0f8d63', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
            {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={tr.allTradesTitle}
        subtitle={language === 'he' ? 'היסטוריית מסחר מלאה' : 'Full trading history'}
        icon="swap_horiz"
      />

      {/* Filters — always visible */}
      <div className="trades-filter-row section-anim anim-delay-1" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px', gap: '8px' }}>
        {/* Outcome — WIN/LOSS */}
        <div className="trades-outcome-btns" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {OUTCOME_FILTERS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => { setFilter(filter === key ? 'all' : key as any); setPage(0) }} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '7px 14px', borderRadius: '10px', fontSize: '12px',
              cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700',
              border: `1px solid ${filter === key ? key === 'win' ? 'rgba(34,197,94,0.4)' : key === 'loss' ? 'rgba(239,68,68,0.4)' : 'rgba(15,141,99,0.4)' : 'var(--border)'}`,
              background: filter === key ? key === 'win' ? 'rgba(34,197,94,0.1)' : key === 'loss' ? 'rgba(239,68,68,0.1)' : 'rgba(15,141,99,0.1)' : 'var(--bg3)',
              color: filter === key ? key === 'win' ? '#22c55e' : key === 'loss' ? '#ef4444' : '#0f8d63' : 'var(--text3)',
              transition: 'all 0.2s',
            }}>
              <Icon name={icon} size={13} />
              {label}
              {filter === key && <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '1px 6px', fontSize: '11px' }}>{total}</span>}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="trades-filter-sep" style={{ width: '1px', height: '22px', background: 'var(--border)', flexShrink: 0 }} />

        {/* Time filter */}
        <div className="trades-time-filter" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="trades-data-by-label" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
            {language === 'he' ? 'נתונים לפי:' : 'Data by:'}
          </span>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg3)', padding: '2px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          {TIME_LABELS.map((label, i) => (
            <button key={i} onClick={() => { setTimeFilter(i); setPage(0) }} style={{
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
              cursor: 'pointer', border: 'none', fontFamily: 'Heebo, sans-serif',
              background: timeFilter === i ? '#0f8d63' : 'transparent',
              color: timeFilter === i ? '#fff' : 'var(--text3)',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
        </div>
        </div>
      </div>

      {/* Trades list */}
      <div className="section-anim anim-delay-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTopColor: '#0f8d63', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : trades.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Icon name={filter === 'win' ? 'trending_up' : filter === 'loss' ? 'trending_down' : 'receipt_long'} size={48} color={filter === 'win' ? 'rgba(34,197,94,0.15)' : filter === 'loss' ? 'rgba(239,68,68,0.15)' : 'rgba(15,141,99,0.15)'} style={{ display: 'block', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', marginBottom: '8px' }}>
              {filter === 'win' ? (language === 'he' ? 'אין עסקאות מרוויחות' : 'No winning trades')
                : filter === 'loss' ? (language === 'he' ? 'אין עסקאות מפסידות' : 'No losing trades')
                : timeFilter === 1 ? (language === 'he' ? 'לא ביצעת עסקאות היום' : 'No trades today')
                : timeFilter === 2 ? (language === 'he' ? 'לא ביצעת עסקאות השבוע' : 'No trades this week')
                : timeFilter === 3 ? (language === 'he' ? 'לא ביצעת עסקאות החודש' : 'No trades this month')
                : tr.noTradesYet}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px' }}>
              {filter !== 'all' ? (language === 'he' ? 'נסה לשנות את הפילטר' : 'Try changing the filter')
                : timeFilter > 0 ? (language === 'he' ? 'נסה לשנות את טווח הזמן' : 'Try changing the time range')
                : tr.noTradesDesc}
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 12px' }}>
            {/* Column header row */}
            <div className="trade-row trade-header-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 100px 100px 80px 110px', alignItems: 'center', gap: '12px', padding: '8px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
              <div className="trade-col-symbol" style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'נכס' : 'Symbol'}</div>
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוצאה' : 'WIN/LOSS'}</div>
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תאריך' : 'Date'}</div>
              <div className="trade-col-rr" style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RR</div>
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P&L</div>
            </div>

            {trades.map((trade, idx) => (
              <div
                key={trade.id}
                onClick={() => setSelectedTrade(trade)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 100px 100px 80px 110px', alignItems: 'center', gap: '12px', padding: '14px 8px', borderRadius: '14px', marginBottom: idx < trades.length - 1 ? '2px' : '0', cursor: 'pointer', transition: 'background 0.15s, transform 0.2s', borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none', animationDelay: `${idx * 0.05}s` }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                className="trade-row trade-row-anim"
              >
                {/* Symbol + direction */}
                <div className="trade-col-symbol" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: isLong(trade.direction) ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isLong(trade.direction) ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={isLong(trade.direction) ? 'trending_up' : 'trending_down'} size={20} color={isLong(trade.direction) ? '#22c55e' : '#ef4444'} />
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{trade.symbol}</div>
                </div>

                {/* Status */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{ padding: '5px 14px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', background: trade.outcome === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${trade.outcome === 'win' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, color: trade.outcome === 'win' ? '#22c55e' : '#ef4444' }}>
                    {trade.outcome === 'win' ? '✓ WIN' : '✕ LOSS'}
                  </span>
                </div>

                {/* Date */}
                <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text2)' }}>
                  {new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>

                {/* RR */}
                <div className="trade-col-rr" style={{ textAlign: 'center', fontSize: '14px', fontWeight: '800', color: '#0f8d63' }}>1:{trade.rr_ratio?.toFixed(1) || '—'}</div>

                {/* P&L */}
                <div dir="ltr" style={{ textAlign: 'center', fontSize: '16px', fontWeight: '700', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                  {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px 0' }}>
          <button onClick={() => changePage(1)} disabled={!canOlder}
            style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canOlder ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canOlder ? 1 : 0.25, transition: 'all 0.2s' }}>
            <Icon name={olderIcon} size={18} />
          </button>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)' }}>
            {page + 1} / {totalPages}
          </span>
          <button onClick={() => changePage(-1)} disabled={!canNewer}
            style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canNewer ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canNewer ? 1 : 0.25, transition: 'all 0.2s' }}>
            <Icon name={newerIcon} size={18} />
          </button>
        </div>
      )}

      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadTrades(page); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .trade-row { grid-template-columns: minmax(0, 1fr) 100px 100px 110px !important; gap: 8px !important; }
          .trade-col-rr { display: none !important; }
        }
        @media (max-width: 640px) {
          .trade-row { grid-template-columns: minmax(0, 1.2fr) 80px 80px 90px !important; gap: 6px !important; padding: 10px 6px !important; }
          .trade-row .trade-col-symbol { gap: 8px !important; min-width: 0 !important; overflow: hidden !important; }
          .trade-row .trade-col-symbol > div:first-child { width: 32px !important; height: 32px !important; border-radius: 10px !important; flex-shrink: 0 !important; }
          .trade-row .trade-col-symbol > div:last-child { font-size: 13px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; min-width: 0 !important; }
          .trades-filter-row { justify-content: space-between !important; width: 100%; }
          .trades-time-filter { order: -1; }
          .trades-outcome-btns { order: 1; }
          .trades-filter-sep { display: none !important; }
          .trades-data-by-label { display: none !important; }
        }
      `}</style>
    </div>
  )
}
