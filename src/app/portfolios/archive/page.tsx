'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Portfolio, Trade } from '@/types'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import { useApp } from '@/lib/app-context'
import Link from 'next/link'
import Icon from '@/components/Icon'
import TradeModal from '@/components/TradeModal'

const MARKET_ICONS: Record<string, string> = { forex: '💱', stocks: '📈', crypto: '₿', commodities: '🥇', other: '📊' }
const PORTFOLIO_COLORS = [
  { id: 'green', primary: '#10b981' }, { id: 'blue', primary: '#4b5563' },
  { id: 'purple', primary: '#9ca3af' }, { id: 'gray', primary: '#6b7280' },
  { id: 'cyan', primary: '#374151' }, { id: 'pink', primary: '#d1d5db' },
  { id: 'red', primary: '#ef4444' }, { id: 'amber', primary: '#f59e0b' },
]
const MARKET_LABELS: Record<string, Record<string, string>> = {
  he: { forex: 'פורקס', stocks: 'מניות', crypto: 'קריפטו', commodities: 'סחורות', other: 'אחר' },
  en: { forex: 'Forex', stocks: 'Stocks', crypto: 'Crypto', commodities: 'Commodities', other: 'Other' },
}

const PAGE_SIZE = 6

interface PortfolioStats {
  totalTrades: number
  wins: number
  totalPnl: number
  winRate: number
}

export default function ArchivePage() {
  const { language, isPro, subscriptionLoading } = useApp()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [stats, setStats] = useState<Record<string, PortfolioStats>>({})
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [portfolioTrades, setPortfolioTrades] = useState<Record<string, Trade[]>>({})
  const [tradePage, setTradePage] = useState<Record<string, number>>({})
  const [tradeTotal, setTradeTotal] = useState<Record<string, number>>({})
  const [tradesLoading, setTradesLoading] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const supabase = createClient()

  useEffect(() => { loadArchived() }, [])

  async function loadArchived() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('portfolios').select('*')
      .eq('user_id', user.id).eq('archived', true)
      .order('created_at', { ascending: false })
    if (data) {
      setPortfolios(data)
      const statsMap: Record<string, PortfolioStats> = {}
      for (const p of data) {
        const { data: trades } = await supabase.from('trades').select('pnl, outcome').eq('portfolio_id', p.id)
        if (trades) {
          const wins = trades.filter((t: any) => t.outcome === 'win')
          const totalPnl = trades.reduce((s: number, t: any) => s + (t.pnl || 0), 0)
          statsMap[p.id] = { totalTrades: trades.length, wins: wins.length, totalPnl, winRate: trades.length ? (wins.length / trades.length) * 100 : 0 }
        }
      }
      setStats(statsMap)
    }
    setLoading(false)
  }

  async function loadTrades(portfolioId: string, page: number) {
    setTradesLoading(true)
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count } = await supabase
      .from('trades').select('*', { count: 'exact' })
      .eq('portfolio_id', portfolioId)
      .order('traded_at', { ascending: false })
      .range(from, to)
    if (data) {
      setPortfolioTrades(prev => ({ ...prev, [portfolioId]: data }))
      setTradeTotal(prev => ({ ...prev, [portfolioId]: count || 0 }))
    }
    setTradesLoading(false)
  }

  function toggleExpand(portfolioId: string) {
    if (expandedId === portfolioId) {
      setExpandedId(null)
    } else {
      setExpandedId(portfolioId)
      const currentPage = tradePage[portfolioId] || 0
      loadTrades(portfolioId, currentPage)
    }
  }

  function changePage(portfolioId: string, delta: number) {
    const current = tradePage[portfolioId] || 0
    const next = current + delta
    setTradePage(prev => ({ ...prev, [portfolioId]: next }))
    loadTrades(portfolioId, next)
  }

  async function handleRestore(id: string) {
    const { error } = await supabase.from('portfolios').update({ archived: false }).eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה בשחזור' : 'Restore error')
    else { toast.success(language === 'he' ? 'התיק שוחזר' : 'Portfolio restored'); loadArchived() }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('portfolios').delete().eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה במחיקה' : 'Delete error')
    else { toast.success(language === 'he' ? 'התיק נמחק לצמיתות' : 'Portfolio deleted forever'); setConfirmDelete(null); loadArchived() }
  }

  const getColor = (id: string) => PORTFOLIO_COLORS.find(c => c.id === id)?.primary || '#10b981'

  // Free tier paywall
  if (!subscriptionLoading && !isPro) {
    return (
      <div style={{ fontFamily: 'Heebo, sans-serif' }}>
        <PageHeader title={language === 'he' ? 'ארכיון תיקים' : 'Portfolio Archive'} subtitle={language === 'he' ? 'תיקים מועברים לארכיון' : 'Archived portfolios'} icon="inventory_2" />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '24px' }}>
            <Icon name="lock" size={40} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '25px', fontWeight: '900', color: 'var(--text)', marginBottom: '12px', letterSpacing: '-0.01em' }}>
            {language === 'he' ? 'ארכיון תיקים זמין ל PRO בלבד' : 'Portfolio archive is PRO only'}
          </div>
          <div style={{ fontSize: '15px', color: 'var(--text3)', marginBottom: '32px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.6 }}>
            {language === 'he'
              ? 'שדרג למנוי PRO כדי לגשת לארכיון התיקים ולנהל היסטוריית מסחר מלאה'
              : 'Upgrade to PRO to access the portfolio archive and manage full trading history'}
          </div>
          <Link href="/upgrade" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', padding: '14px 32px', borderRadius: '14px', textDecoration: 'none', fontSize: '15px', fontWeight: '800', boxShadow: '0 8px 24px rgba(245,158,11,0.35)' }}>
            <Icon name="bolt" size={18} />
            {language === 'he' ? 'שדרג ל PRO — $20/חודש' : 'Upgrade to PRO — $20/mo'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={language === 'he' ? 'ארכיון תיקים' : 'Portfolio Archive'}
        subtitle={language === 'he' ? 'תיקים שהועברו לארכיון' : 'Archived portfolios'}
        icon="inventory_2"
      />

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="app-modal-overlay app-modal-overlay--top" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="app-modal-card" data-tight="1" style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="delete_forever" size={28} color="#ef4444" />
            </div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px' }}>
              {language === 'he' ? 'מחיקה לצמיתות' : 'Permanent Delete'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '6px', lineHeight: 1.6 }}>
              {language === 'he' ? 'פעולה זו תמחק את התיק וכל העסקאות בו לצמיתות.' : 'This will permanently delete the portfolio and all its trades.'}
            </div>
            <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: '700', marginBottom: '24px' }}>
              {language === 'he' ? '⚠ לא ניתן לשחזר פעולה זו!' : '⚠ This action cannot be undone!'}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => handleDelete(confirmDelete)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', padding: '11px 24px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                {language === 'he' ? 'כן, מחק לצמיתות' : 'Yes, Delete Forever'}
              </button>
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost">{language === 'he' ? 'ביטול' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : portfolios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="inventory_2" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '21px', fontWeight: '700', color: 'var(--text)', marginBottom: '10px' }}>
            {language === 'he' ? 'הארכיון ריק' : 'Archive is empty'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text3)' }}>
            {language === 'he' ? 'תיקים שתעביר לארכיון יופיעו כאן' : 'Portfolios you archive will appear here'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {portfolios.map(p => {
            const color = getColor((p as any).color || 'blue')
            const s = stats[p.id]
            const isExpanded = expandedId === p.id
            const pnlPos = (s?.totalPnl || 0) >= 0
            const trades = portfolioTrades[p.id] || []
            const page = tradePage[p.id] || 0
            const total = tradeTotal[p.id] || 0
            const totalPages = Math.ceil(total / PAGE_SIZE)

            return (
              <div key={p.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderInlineStart: `3px solid ${color}`, borderRadius: '12px', overflow: 'hidden', transition: 'all 0.3s' }}>

                {/* Main row */}
                <div className="archive-main-row" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text)', opacity: 0.8 }}>{p.name}</div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: '6px' }}>
                        {language === 'he' ? 'ארכיון' : 'ARCHIVED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: '600' }}>
                      {MARKET_LABELS[language][p.market_type]}
                      {s && ` • ${s.totalTrades} ${language === 'he' ? 'עסקאות' : 'trades'} • ${s.winRate.toFixed(0)}% WIN`}
                    </div>
                  </div>

                  {/* Stats summary */}
                  {s && (
                    <div className="archive-pnl" style={{ textAlign: 'center', paddingInline: '16px', borderInline: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '17px', fontWeight: '900', color: pnlPos ? '#22c55e' : '#ef4444' }}>
                        {pnlPos ? '+' : ''}${s.totalPnl.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P&L</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="archive-actions" style={{ display: 'flex', gap: '8px', marginInlineStart: 'auto' }}>
                    {/* Stats toggle */}
                    <button onClick={() => toggleExpand(p.id)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: isExpanded ? 'rgba(16,185,129,0.15)' : 'var(--bg3)', border: `1px solid ${isExpanded ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, color: isExpanded ? '#10b981' : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                      <Icon name={isExpanded ? 'expand_less' : 'bar_chart'} size={16} />
                    </button>

                    {/* Restore */}
                    <button onClick={() => handleRestore(p.id)} title={language === 'he' ? 'שחזר תיק' : 'Restore'} className="archive-restore-btn" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(16,185,129,0.08)'}
                    >
                      <Icon name="restore" size={14} />
                      <span className="restore-label">{language === 'he' ? 'שחזר' : 'Restore'}</span>
                    </button>

                    {/* Delete forever */}
                    <button onClick={() => setConfirmDelete(p.id)} title={language === 'he' ? 'מחק לצמיתות' : 'Delete forever'} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    >
                      <Icon name="delete_forever" size={16} />
                    </button>
                  </div>
                </div>

                {/* Expanded section */}
                {isExpanded && s && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>

                    {/* Stats grid */}
                    <div className="archive-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                      {[
                        { label: language === 'he' ? 'עסקאות' : 'Trades', value: s.totalTrades, color: 'var(--text2)' },
                        { label: language === 'he' ? 'ניצחונות' : 'Wins', value: s.wins, color: '#22c55e' },
                        { label: language === 'he' ? 'אחוז הצלחה' : 'Win Rate', value: `${s.winRate.toFixed(1)}%`, color: '#10b981' },
                        { label: 'P&L', value: `${s.totalPnl >= 0 ? '+' : ''}$${s.totalPnl.toLocaleString()}`, color: s.totalPnl >= 0 ? '#22c55e' : '#ef4444' },
                      ].map(({ label, value, color: c }) => (
                        <div key={label} style={{ background: 'var(--bg3)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>{label}</div>
                          <div style={{ fontSize: '19px', fontWeight: '900', color: c }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Trades section header + pagination */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {language === 'he' ? 'עסקאות אחרונות' : 'Recent Trades'}
                      </div>
                      {totalPages > 1 && (() => {
                        const isRTL    = language === 'he'
                        const canOlder = page < totalPages - 1
                        const canNewer = page > 0
                        const olderIcon = isRTL ? 'chevron_right' : 'chevron_left'
                        const newerIcon = isRTL ? 'chevron_left'  : 'chevron_right'
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => changePage(p.id, 1)}
                              disabled={!canOlder}
                              style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canOlder ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canOlder ? 1 : 0.3, transition: 'all 0.2s' }}
                            >
                              <Icon name={olderIcon} size={16} />
                            </button>
                            <button
                              onClick={() => changePage(p.id, -1)}
                              disabled={!canNewer}
                              style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: canNewer ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canNewer ? 1 : 0.3, transition: 'all 0.2s' }}
                            >
                              <Icon name={newerIcon} size={16} />
                            </button>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Trades list */}
                    <div style={{ background: 'var(--bg3)', borderRadius: '12px', overflow: 'hidden' }}>
                      {tradesLoading ? (
                        <div style={{ padding: '32px', textAlign: 'center' }}>
                          <div style={{ width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                        </div>
                      ) : trades.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '14px', fontWeight: '600' }}>
                          {language === 'he' ? 'אין עסקאות בתיק זה' : 'No trades in this portfolio'}
                        </div>
                      ) : (
                        <>
                          {/* Column header row */}
                          <div className="archive-trade-row trade-header-row" style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px 100px', alignItems: 'center', gap: '8px', padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                            <div className="trade-col-symbol" style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'נכס' : 'Symbol'}</div>
                            <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תוצאה' : 'WIN/LOSS'}</div>
                            <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תאריך' : 'Date'}</div>
                            <div className="trade-col-rr" style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RR</div>
                            <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P&L</div>
                          </div>

                          {trades.map((trade, idx) => (
                            <div key={trade.id} className="archive-trade-row" onClick={() => setSelectedTrade(trade)} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px 100px', alignItems: 'center', gap: '8px', padding: '11px 16px', borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s', cursor: 'pointer' }}
                              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {/* Symbol */}
                              <div className="trade-col-symbol" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0, background: trade.direction === 'long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${trade.direction === 'long' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Icon name={trade.direction === 'long' ? 'trending_up' : 'trending_down'} size={14} color={trade.direction === 'long' ? '#22c55e' : '#ef4444'} />
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)', lineHeight: 1 }}>{trade.symbol}</div>
                              </div>

                              {/* Outcome */}
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '900', background: trade.outcome === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${trade.outcome === 'win' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, color: trade.outcome === 'win' ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                                  {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
                                </span>
                              </div>

                              {/* Date */}
                              <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--text2)' }}>
                                {new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </div>

                              {/* RR */}
                              <div className="trade-col-rr" style={{ textAlign: 'center', fontSize: '13px', fontWeight: '800', color: '#10b981' }}>1:{trade.rr_ratio?.toFixed(1) || '—'}</div>

                              {/* P&L */}
                              <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: '900', color: trade.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                                {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedTrade && (
        <TradeModal trade={selectedTrade} readOnly onClose={() => setSelectedTrade(null)} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .archive-main-row { padding: 12px 14px !important; gap: 10px !important; }
          .archive-restore-btn { padding: 7px 10px !important; }
          .restore-label { display: none; }
          .archive-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .archive-trade-row { grid-template-columns: 1fr 100px 100px 100px !important; gap: 8px !important; padding-inline: 12px !important; }
          .archive-trade-row .trade-col-rr { display: none !important; }
        }
        @media (max-width: 640px) {
          .archive-pnl { padding-inline: 10px !important; }
          .archive-pnl { display: none !important; }
          .archive-trade-row { grid-template-columns: 1fr 80px 80px 90px !important; gap: 6px !important; padding-inline: 10px !important; }
          .archive-trade-row .trade-col-symbol > div:first-child { width: 26px !important; height: 26px !important; }
          .archive-trade-row .trade-col-symbol > div:last-child { font-size: 12px !important; }
        }
      `}</style>
    </div>
  )
}
