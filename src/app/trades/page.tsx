'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Strategy, Trade } from '@/types'
import Link from 'next/link'
import TradeModal from '@/components/TradeModal'
import PageHeader from '@/components/PageHeader'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Icon from '@/components/Icon'

const PAGE_SIZE = 6

function FilterGroup({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px', color: 'var(--text2)', fontSize: '12px', fontWeight: '900', letterSpacing: '0.05em' }}>
        <Icon name={icon} size={14} color="#0f8d63" />
        {title}
      </div>
      {children}
    </div>
  )
}

function FilterChip({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: string; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      minWidth: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      padding: '8px 11px', borderRadius: '10px',
      border: active ? '1px solid rgba(15,141,99,0.48)' : '1px solid var(--border2)',
      background: active ? 'rgba(15,141,99,0.22)' : 'var(--modal-bg)',
      backgroundColor: active ? 'rgba(15,141,99,0.22)' : 'var(--modal-bg)',
      color: active ? '#0f8d63' : 'var(--text3)',
      fontFamily: 'Heebo, sans-serif', fontSize: '12px', fontWeight: '800',
      cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {icon && <Icon name={icon} size={13} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
    </button>
  )
}

export default function TradesPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language, isPro } = useApp()
  const router = useRouter()
  const tr = t[language]
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all')
  const [timeFilter, setTimeFilter] = useState(0) // 0=all 1=daily 2=weekly 3=monthly
  const [strategyFilter, setStrategyFilter] = useState('all')
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const supabase = createClient()
  const isRTL = language === 'he'

  useEffect(() => { if (activePortfolio) { setPage(0); loadTrades(0, filter, timeFilter, strategyFilter) } }, [activePortfolio, filter, timeFilter, strategyFilter])

  useEffect(() => {
    if (!activePortfolio || !isPro) {
      setStrategies([])
      setStrategyFilter('all')
      return
    }
    supabase.from('strategies').select('*').eq('portfolio_id', activePortfolio.id).order('name').then(({ data }) => {
      setStrategies(data || [])
    })
  }, [activePortfolio, isPro])

  // Realtime subscription
  useEffect(() => {
    if (!activePortfolio) return
    const channel = supabase
      .channel('trades-page-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `portfolio_id=eq.${activePortfolio.id}` }, () => {
        loadTrades(page, filter, timeFilter, strategyFilter)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activePortfolio, page, filter, timeFilter, strategyFilter])

  function getStartDate(f: number): string | null {
    if (f === 0) return null
    const now = new Date()
    if (f === 1) { const d = new Date(now); d.setHours(0,0,0,0); return d.toISOString() }
    if (f === 2) { const d = new Date(now); d.setDate(d.getDate()-7); d.setHours(0,0,0,0); return d.toISOString() }
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }

  async function loadTrades(p: number, outcomeFilter = filter, tf = timeFilter, sf = strategyFilter) {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const from = p * PAGE_SIZE
    let query = supabase.from('trades').select('*', { count: 'exact' })
      .eq('portfolio_id', activePortfolio!.id)
      .order('created_at', { ascending: false })
      .order('traded_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (outcomeFilter !== 'all') query = (query as any).eq('outcome', outcomeFilter)
    const startDate = getStartDate(tf)
    if (startDate) query = (query as any).gte('traded_at', startDate)
    if (isPro && sf !== 'all') query = (query as any).eq('strategy_id', sf)
    const { data, count } = await query
    if (data) setTrades(data)
    if (count !== null) setTotal(count)
    setLoading(false)
  }

  function changePage(delta: number) {
    const next = page + delta
    setPage(next)
    loadTrades(next, filter, timeFilter, strategyFilter)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const canOlder   = page < totalPages - 1
  const canNewer   = page > 0
  const olderIcon  = 'chevron_left'
  const newerIcon  = 'chevron_right'

  const OUTCOME_FILTERS = [
    { key: 'win', label: 'WIN', icon: 'trending_up' },
    { key: 'loss', label: 'LOSS', icon: 'trending_down' },
  ]
  const TIME_LABELS = [
    language === 'he' ? 'הכל' : 'All',
    tr.daily, tr.weekly, tr.monthly,
  ]

  const activeFilterCount = (filter !== 'all' ? 1 : 0) + (timeFilter > 0 ? 1 : 0) + (strategyFilter !== 'all' ? 1 : 0)

  const isLong = (d: string) => d === 'long'
  const paginationArrows = total > PAGE_SIZE ? (
    <div className="trades-page-arrows" aria-label={language === 'he' ? 'דפדוף עסקאות' : 'Trade pagination'}>
      <button className="trades-page-btn app-arrow-btn" onClick={() => changePage(1)} disabled={!canOlder} aria-label={language === 'he' ? 'עסקאות ישנות יותר' : 'Older trades'}>
        <Icon name={olderIcon} size={18} />
      </button>
      <button className="trades-page-btn app-arrow-btn" onClick={() => changePage(-1)} disabled={!canNewer} aria-label={language === 'he' ? 'עסקאות חדשות יותר' : 'Newer trades'}>
        <Icon name={newerIcon} size={18} />
      </button>
    </div>
  ) : <div className="trades-page-arrows-placeholder" />

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

      <div className="trades-top-controls section-anim anim-delay-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px', direction: 'ltr', position: 'relative', zIndex: 3000, overflow: 'visible' }}>
        {paginationArrows}
        <div className="trades-filter-slot" style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0, direction: isRTL ? 'rtl' : 'ltr' }}>
      {isPro && (
        <div className="trades-filter-shell" style={{ position: 'relative', zIndex: 3100, isolation: 'isolate', display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
          <button onClick={() => setFilterMenuOpen(v => !v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 15px', borderRadius: '12px',
            background: filterMenuOpen ? 'rgba(15,141,99,0.14)' : 'var(--bg3)',
            border: filterMenuOpen ? '1px solid rgba(15,141,99,0.38)' : '1px solid var(--border)',
            color: filterMenuOpen ? '#0f8d63' : 'var(--text2)',
            fontSize: '13px', fontWeight: '800', cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif', transition: 'all 0.18s',
          }}>
            <Icon name="tune" size={16} />
            {language === 'he' ? 'פילטרים' : 'Filters'}
            {activeFilterCount > 0 && (
              <span style={{ minWidth: '20px', height: '20px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0f8d63', color: '#fff', fontSize: '11px', fontWeight: '900' }}>
                {activeFilterCount}
              </span>
            )}
            <Icon name={filterMenuOpen ? 'expand_less' : 'expand_more'} size={16} />
          </button>

          {filterMenuOpen && (
            <div className="trades-filter-popover" style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 3200,
              width: 'min(100vw - 32px, 430px)', padding: '16px',
              borderRadius: '18px', border: '1px solid var(--border2)',
              background: 'var(--modal-bg)', backgroundColor: 'var(--modal-bg)',
              boxShadow: '0 22px 60px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.04) inset',
              pointerEvents: 'auto',
            }}>
              <FilterGroup title={language === 'he' ? 'זמן' : 'Time'} icon="calendar_today">
                <div className="filter-chip-grid">
                  {TIME_LABELS.map((label, i) => (
                    <FilterChip key={i} active={timeFilter === i} onClick={() => { setTimeFilter(timeFilter === i ? 0 : i); setPage(0) }}>
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup title={language === 'he' ? 'תוצאה' : 'Outcome'} icon="trending_up">
                <div className="filter-chip-grid">
                  <FilterChip active={filter === 'all'} onClick={() => { setFilter('all'); setPage(0) }}>
                    {language === 'he' ? 'הכל' : 'All'}
                  </FilterChip>
                  {OUTCOME_FILTERS.map(({ key, label, icon }) => (
                    <FilterChip key={key} active={filter === key} onClick={() => { setFilter(filter === key ? 'all' : key as 'win' | 'loss'); setPage(0) }} icon={icon}>
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup title={language === 'he' ? 'אסטרטגיית מסחר' : 'Trading strategy'} icon="psychology">
                {strategies.length > 0 ? (
                  <div className="filter-chip-grid strategy-filter-grid">
                    {strategies.map(strategy => (
                      <FilterChip key={strategy.id} active={strategyFilter === strategy.id} onClick={() => { setStrategyFilter(strategyFilter === strategy.id ? 'all' : strategy.id); setPage(0) }}>
                        {strategy.name}
                      </FilterChip>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '12px 14px', borderRadius: '12px', border: '1px dashed var(--border2)', color: 'var(--text3)', fontSize: '13px', fontWeight: '700', textAlign: 'center' }}>
                    {language === 'he' ? 'אין כרגע אסטרטגיות קיימות' : 'No strategies exist yet'}
                  </div>
                )}
              </FilterGroup>

              {activeFilterCount > 0 && (
                <button onClick={() => { setFilter('all'); setTimeFilter(0); setStrategyFilter('all'); setPage(0) }} style={{
                  width: '100%', marginTop: '2px', padding: '10px 12px',
                  borderRadius: '12px', border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text2)',
                  fontFamily: 'Heebo, sans-serif', fontSize: '13px', fontWeight: '800',
                  cursor: 'pointer',
                }}>
                  {language === 'he' ? 'נקה פילטרים' : 'Clear filters'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters — always visible */}
      {!isPro && <div className="trades-filter-row" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 0, gap: '8px' }}>
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
      </div>}
        </div>
      </div>

      {/* Trades list */}
      <div className="section-anim anim-delay-2 trades-list-shell" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
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
              <div className="trade-col-symbol" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'נכס' : 'Symbol'}</div>
              <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוצאה' : 'WIN/LOSS'}</div>
              <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תאריך' : 'Date'}</div>
              <div className="trade-col-rr" style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RR</div>
              <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P&L</div>
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
                    {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
                  </span>
                </div>

                {/* Date */}
                <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text2)' }}>
                  {new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>

                {/* RR */}
                <div className="trade-col-rr" dir="ltr" style={{ textAlign: 'center', fontSize: '14px', fontWeight: '800', color: trade.outcome === 'win' && trade.rr_ratio != null ? '#22c55e' : 'var(--text3)' }}>{trade.outcome === 'win' && trade.rr_ratio != null ? `1 : ${trade.rr_ratio.toFixed(1)}` : '—'}</div>

                {/* P&L */}
                <div dir="ltr" style={{ textAlign: 'center', fontSize: '16px', fontWeight: '700', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                  {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTrade && <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={() => { setSelectedTrade(null); loadTrades(page, filter, timeFilter, strategyFilter); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .trades-page-arrows,
        .trades-page-arrows-placeholder {
          min-width: 84px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          direction: ltr;
        }
        .trades-page-btn {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: var(--bg3);
          border: 1px solid var(--border);
          color: var(--text2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.18s, opacity 0.18s;
        }
        .trades-page-btn:not(:disabled):hover {
          background: rgba(15,141,99,0.16);
          border-color: rgba(15,141,99,0.45);
          color: #0f8d63;
          transform: translateY(-1px);
        }
        .trades-page-btn:disabled {
          opacity: 0.25;
          cursor: default;
        }
        .filter-chip-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .strategy-filter-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-height: 180px;
          overflow: auto;
          padding-inline-end: 2px;
        }
        @media (max-width: 1024px) {
          .trade-row { grid-template-columns: minmax(0, 1fr) 100px 100px 110px !important; gap: 8px !important; }
          .trade-col-rr { display: none !important; }
        }
        @media (max-width: 640px) {
          .trades-top-controls { align-items: stretch !important; gap: 10px !important; }
          .trades-page-arrows,
          .trades-page-arrows-placeholder { min-width: 82px !important; }
          .trades-filter-shell { justify-content: stretch !important; }
          .trades-filter-shell > button { width: 100%; justify-content: center !important; }
          .trades-filter-popover { inset-inline: 0 !important; width: 100% !important; }
          .filter-chip-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .strategy-filter-grid { grid-template-columns: 1fr !important; }
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
