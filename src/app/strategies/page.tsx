'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Strategy } from '@/types'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { usePortfolio } from '@/lib/portfolio-context'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'

const STRATEGY_COLORS = [
  { name: 'green', hex: '#0f8d63' },
  { name: 'blue', hex: '#4b5563' },
  { name: 'purple', hex: '#9ca3af' },
  { name: 'gray', hex: '#6b7280' },
  { name: 'cyan', hex: '#374151' },
  { name: 'pink', hex: '#d1d5db' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'red', hex: '#ef4444' },
]

function getColorHex(_name: string) {
  // Strategies all render in a neutral light gray now — no per-strategy
  // accent color. Kept the function signature so call sites don't change.
  return '#9ca3af'
}

type StrategyStats = {
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  profitFactor: number
  bestTrade: number
  worstTrade: number
  avgPnl: number
}

const EMPTY_STATS: StrategyStats = {
  totalTrades: 0, wins: 0, losses: 0, winRate: 0,
  totalPnl: 0, profitFactor: 0, bestTrade: 0, worstTrade: 0, avgPnl: 0,
}

export default function StrategiesPage() {
  const { language } = useApp()
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const router = useRouter()
  const tr = t[language]
  const supabase = createClient()
  const isRTL = language === 'he'

  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [strategyStats, setStrategyStats] = useState<Record<string, StrategyStats>>({})
  const [loadingStats, setLoadingStats] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', plan: '', details: '', color: 'blue',
  })

  useEffect(() => {
    if (activePortfolio) loadStrategies()
  }, [activePortfolio])

  async function loadStrategies() {
    setLoading(true)
    const { data } = await supabase
      .from('strategies')
      .select('*')
      .eq('portfolio_id', activePortfolio!.id)
      .order('created_at', { ascending: false })
    if (data) {
      setStrategies(data)
      // Eager-load every strategy's stats so the collapsed view can show
      // PNL and WIN-rate without waiting for the user to expand a card.
      const statsMap: Record<string, StrategyStats> = {}
      for (const s of data) {
        const { data: trades } = await supabase
          .from('trades').select('pnl, outcome')
          .eq('portfolio_id', activePortfolio!.id)
          .eq('strategy_id', s.id)
        if (trades && trades.length > 0) {
          const wins = trades.filter((x: any) => x.outcome === 'win')
          const losses = trades.filter((x: any) => x.outcome === 'loss')
          const totalPnl = trades.reduce((sum: number, x: any) => sum + (x.pnl || 0), 0)
          const grossProfit = wins.reduce((sum: number, x: any) => sum + (x.pnl || 0), 0)
          const grossLoss = Math.abs(losses.reduce((sum: number, x: any) => sum + (x.pnl || 0), 0))
          statsMap[s.id] = {
            totalTrades: trades.length,
            wins: wins.length,
            losses: losses.length,
            winRate: (wins.length / trades.length) * 100,
            totalPnl,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
            bestTrade: Math.max(...trades.map((x: any) => x.pnl || 0)),
            worstTrade: Math.min(...trades.map((x: any) => x.pnl || 0)),
            avgPnl: totalPnl / trades.length,
          }
        } else {
          statsMap[s.id] = EMPTY_STATS
        }
      }
      setStrategyStats(statsMap)
    }
    setLoading(false)
  }

  async function loadStrategyStats(strategyId: string) {
    if (strategyStats[strategyId]) return
    setLoadingStats(strategyId)
    const { data: trades } = await supabase
      .from('trades')
      .select('pnl, outcome')
      .eq('portfolio_id', activePortfolio!.id)
      .eq('strategy_id', strategyId)

    if (trades && trades.length > 0) {
      const wins = trades.filter((x: any) => x.outcome === 'win')
      const losses = trades.filter((x: any) => x.outcome === 'loss')
      const totalPnl = trades.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
      const grossProfit = wins.reduce((s: number, x: any) => s + (x.pnl || 0), 0)
      const grossLoss = Math.abs(losses.reduce((s: number, x: any) => s + (x.pnl || 0), 0))
      setStrategyStats(prev => ({
        ...prev,
        [strategyId]: {
          totalTrades: trades.length,
          wins: wins.length,
          losses: losses.length,
          winRate: (wins.length / trades.length) * 100,
          totalPnl,
          profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
          bestTrade: Math.max(...trades.map((x: any) => x.pnl || 0)),
          worstTrade: Math.min(...trades.map((x: any) => x.pnl || 0)),
          avgPnl: totalPnl / trades.length,
        },
      }))
    } else {
      setStrategyStats(prev => ({ ...prev, [strategyId]: EMPTY_STATS }))
    }
    setLoadingStats(null)
  }

  function handleExpand(id: string) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next) loadStrategyStats(next)
  }

  function openNew() {
    setEditingId(null)
    setForm({ name: '', plan: '', details: '', color: 'blue' })
    setShowForm(true)
  }

  function startEdit(s: Strategy) {
    setForm({ name: s.name, plan: s.plan || '', details: s.details || '', color: s.color || 'blue' })
    setEditingId(s.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(language === 'he' ? 'נא להזין שם לאסטרטגיה' : 'Please enter a strategy name')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editingId) {
      const { error } = await supabase.from('strategies').update({
        name: form.name, plan: form.plan, details: form.details, color: form.color,
      }).eq('id', editingId)
      if (error) toast.error(language === 'he' ? 'שגיאה בעדכון' : 'Update error')
      else toast.success(language === 'he' ? 'האסטרטגיה עודכנה' : 'Strategy updated')
    } else {
      const { error } = await supabase.from('strategies').insert({
        user_id: user.id,
        portfolio_id: activePortfolio!.id,
        name: form.name, plan: form.plan, details: form.details, color: form.color,
      })
      if (error) toast.error(language === 'he' ? 'שגיאה ביצירת אסטרטגיה' : 'Error creating strategy')
      else toast.success(language === 'he' ? 'אסטרטגיה נוצרה' : 'Strategy created')
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', plan: '', details: '', color: 'blue' })
    loadStrategies()
    router.refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('strategies').delete().eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה במחיקה' : 'Delete error')
    else {
      toast.success(language === 'he' ? 'האסטרטגיה נמחקה' : 'Strategy deleted')
      setConfirmDelete(null)
      // Optimistic update: drop from local state immediately so the empty
      // state appears without waiting for the loadStrategies refetch.
      setStrategies(prev => prev.filter(s => s.id !== id))
      router.refresh()
    }
  }

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div>
        <PageHeader title={tr.strategiesTitle} subtitle={tr.strategiesSubtitle} icon="psychology" />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="folder_open" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '21px', fontWeight: '900', marginBottom: '10px', color: 'var(--text)' }}>
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
    <div>
      <PageHeader
        title={tr.strategiesTitle}
        subtitle={tr.strategiesSubtitle}
        icon="psychology"
        action={strategies.length > 0 ? (
          <button onClick={openNew} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#0f8d63', color: '#fff', border: 'none',
            borderRadius: '10px', padding: '10px 18px',
            fontSize: '14px', fontWeight: '700', cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif', transition: 'opacity 0.15s',
          }}>
            <Icon name="add" size={16} color="#fff" />
            {tr.newStrategy}
          </button>
        ) : undefined}
      />

      {/* ── STRATEGIES LIST ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: '#0f8d63', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', color: 'var(--text3)' }}>{tr.loading}</div>
        </div>
      ) : strategies.length === 0 ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', padding: '64px 24px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(15,141,99,0.12), rgba(15,141,99,0.12))',
            border: '1px solid rgba(15,141,99,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <Icon name="psychology" size={36} color="#0f8d63" />
          </div>
          <div style={{ fontSize: '19px', fontWeight: '700', marginBottom: '8px', color: 'var(--text)' }}>
            {tr.noStrategiesYet}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '24px', maxWidth: '320px', margin: '0 auto 24px' }}>
            {tr.noStrategiesDesc}
          </div>
          <button onClick={openNew} style={{
            background: 'linear-gradient(135deg, #0f8d63, #0a6448)', color: '#fff', padding: '12px 28px',
            borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '700',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            boxShadow: '0 4px 16px rgba(15,141,99,0.3)',
          }}>
            <Icon name="add" size={16} color="#fff" />
            {tr.newStrategy}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {strategies.map((s, sIdx) => {
            const color = getColorHex(s.color)
            const isExpanded = expandedId === s.id
            const stats = strategyStats[s.id] || EMPTY_STATS
            const isStatsLoading = loadingStats === s.id
            const pnlPositive = stats.totalPnl >= 0

            return (
              <div key={s.id} style={{
                background: 'var(--bg2)',
                borderRadius: '16px',
                overflow: 'hidden',
                border: isExpanded ? `1px solid ${color}40` : '1px solid var(--border)',
                transition: 'all 0.25s ease',
                position: 'relative',
              }}>
                {/* Header */}
                <div
                  className="strat-header"
                  onClick={e => { e.currentTarget.style.background = 'transparent'; handleExpand(s.id) }}
                  style={{
                    padding: '20px 24px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '16px',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Strategy icon with glow */}
                  <div style={{ position: 'relative' }}>
                    {isExpanded && (
                      <div style={{
                        position: 'absolute', inset: '-6px',
                        background: `radial-gradient(circle, ${color}20, transparent 70%)`,
                        borderRadius: '50%',
                      }} />
                    )}
                    <div className="strat-icon" style={{
                      width: '46px', height: '46px', borderRadius: '14px',
                      background: `linear-gradient(135deg, ${color}18, ${color}08)`,
                      border: `1.5px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, position: 'relative',
                      transition: 'all 0.25s ease',
                      boxShadow: isExpanded ? `0 4px 20px ${color}20` : 'none',
                    }}>
                      <span style={{
                        fontSize: '17px', fontWeight: '800', color,
                        fontFamily: "'Heebo', sans-serif", letterSpacing: '-0.03em',
                        lineHeight: 1,
                      }}>#{sIdx + 1}</span>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: '3px' }}>
                      <span className="strat-name" style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)' }}>{s.name}</span>
                    </div>
                    {s.plan && (
                      <div className="strat-plan-preview" style={{ fontSize: '13px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                        {s.plan}
                      </div>
                    )}
                  </div>

                  {/* Stats preview — always visible (shows '—' until stats load) */}
                  {!isExpanded && (
                    <div className="strat-preview-stats" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: !strategyStats[s.id] || stats.totalTrades === 0 ? 'var(--text3)' : pnlPositive ? '#22c55e' : '#ef4444' }}>
                          {!strategyStats[s.id] || stats.totalTrades === 0 ? '—' : `${pnlPositive ? '+' : ''}$${stats.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '600' }}>P&L</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: !strategyStats[s.id] || stats.totalTrades === 0 ? 'var(--text3)' : 'var(--text)' }}>
                          {!strategyStats[s.id] || stats.totalTrades === 0 ? '—' : `${stats.winRate.toFixed(0)}%`}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '600' }}>WIN</div>
                      </div>
                    </div>
                  )}

                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: isExpanded ? `${color}12` : 'var(--bg3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease', flexShrink: 0,
                  }}>
                    <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={18} color={isExpanded ? color : 'var(--text3)'} />
                  </div>
                </div>

                {/* ── Expanded content ── */}
                {isExpanded && (
                  <div className="strat-expanded" style={{ padding: '0 24px 24px' }}>

                    {/* ── STRATEGY STATS ── */}
                    <div className="strat-stats-wrap" style={{
                      background: `linear-gradient(135deg, ${color}06, ${color}03)`,
                      border: `1px solid ${color}18`,
                      borderRadius: '14px',
                      padding: '20px',
                      marginBottom: '20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Icon name="monitoring" size={16} color={color} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {language === 'he' ? 'סטטיסטיקות אסטרטגיה' : 'Strategy Statistics'}
                        </span>
                      </div>

                      {isStatsLoading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <div style={{ width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                        </div>
                      ) : stats.totalTrades === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                          <Icon name="show_chart" size={28} color="var(--bg4)" style={{ display: 'block', margin: '0 auto 8px' }} />
                          <div style={{ fontSize: '14px', color: 'var(--text3)' }}>
                            {language === 'he' ? 'אין עסקאות עם אסטרטגיה זו עדיין' : 'No trades with this strategy yet'}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Big P&L + Win Rate row */}
                          <div className="strat-pnl-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                              background: 'var(--bg2)', borderRadius: '12px', padding: '16px',
                              border: '1px solid var(--border)',
                            }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                                {language === 'he' ? 'רווח / הפסד כולל' : 'Total P&L'}
                              </div>
                              <div dir="ltr" className="strat-pnl-big" style={{
                                fontSize: '27px', fontWeight: '800', letterSpacing: '-0.02em',
                                color: pnlPositive ? '#22c55e' : '#ef4444',
                              }}>
                                {pnlPositive ? '+' : '-'}${Math.abs(stats.totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div style={{
                              background: 'var(--bg2)', borderRadius: '12px', padding: '16px',
                              border: '1px solid var(--border)',
                            }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                                Win Rate
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                <span className="strat-pnl-big" style={{
                                  fontSize: '27px', fontWeight: '800', letterSpacing: '-0.02em',
                                  color: stats.winRate >= 50 ? '#22c55e' : '#ef4444',
                                }}>
                                  {stats.winRate.toFixed(0)}%
                                </span>
                              </div>
                              {/* Mini win/loss bar */}
                              <div style={{ display: 'flex', gap: '2px', marginTop: '8px', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ flex: stats.wins, background: '#22c55e', borderRadius: '2px' }} />
                                <div style={{ flex: stats.losses || 0.01, background: '#ef4444', borderRadius: '2px' }} />
                              </div>
                            </div>
                          </div>

                          {/* Detailed stats grid */}
                          <div className="strat-detail-grid" style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px',
                            background: 'var(--border)', borderRadius: '12px', overflow: 'hidden',
                          }}>
                            {[
                              { label: language === 'he' ? 'עסקאות' : 'Trades', value: stats.totalTrades.toString(), icon: 'receipt_long' },
                              { label: language === 'he' ? 'ניצחונות' : 'Wins', value: `${stats.wins}`, icon: 'trending_up', valueColor: '#22c55e' },
                              { label: language === 'he' ? 'הפסדים' : 'Losses', value: `${stats.losses}`, icon: 'trending_down', valueColor: '#ef4444' },
                              { label: 'Profit Factor', value: stats.profitFactor === Infinity ? '∞' : stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—', icon: 'analytics' },
                            ].map((item, i) => (
                              <div key={i} style={{ background: 'var(--bg2)', padding: '14px 12px', textAlign: 'center' }}>
                                <Icon name={item.icon} size={15} color={color} style={{ marginBottom: '6px', opacity: 0.7 }} />
                                <div style={{ fontSize: '17px', fontWeight: '700', color: item.valueColor || 'var(--text)', marginBottom: '2px' }}>{item.value}</div>
                                <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                              </div>
                            ))}
                          </div>

                        </>
                      )}
                    </div>

                    {/* ── PLAN & DETAILS ── */}
                    {(s.plan || s.details) && (
                      <div className="strat-plan-details" style={{ display: 'grid', gridTemplateColumns: s.plan && s.details ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '20px' }}>
                        {s.plan && (
                          <div style={{
                            background: 'var(--bg3)', borderRadius: '12px', padding: '16px',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                              <Icon name="notes" size={14} color={color} />
                              <span style={{ fontSize: '12px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {tr.strategyPlan}
                              </span>
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.plan}</div>
                          </div>
                        )}
                        {s.details && (
                          <div style={{
                            background: 'var(--bg3)', borderRadius: '12px', padding: '16px',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                              <Icon name="info" size={14} color={color} />
                              <span style={{ fontSize: '12px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {tr.strategyDetails}
                              </span>
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.details}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Actions ── */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => startEdit(s)} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '9px 18px', borderRadius: '10px',
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        color: 'var(--text2)', fontSize: '13px', fontWeight: '600',
                        cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
                      }}>
                        <Icon name="edit" size={14} color="var(--text3)" />
                        {tr.edit}
                      </button>
                      {confirmDelete === s.id ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleDelete(s.id)} style={{
                            padding: '9px 18px', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444', fontSize: '13px', fontWeight: '700',
                            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                          }}>
                            {language === 'he' ? 'כן, מחק' : 'Yes, delete'}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} style={{
                            padding: '9px 16px', borderRadius: '10px',
                            background: 'var(--bg3)', border: '1px solid var(--border)',
                            color: 'var(--text3)', fontSize: '13px', fontWeight: '600',
                            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                          }}>
                            {tr.cancel}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(s.id)} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '9px 18px', borderRadius: '10px',
                          background: 'transparent', border: '1px solid var(--border)',
                          color: 'rgba(239,68,68,0.6)', fontSize: '13px', fontWeight: '600',
                          cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
                        }}>
                          <Icon name="delete" size={14} color="currentColor" />
                          {language === 'he' ? 'מחק' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── POPUP MODAL ── */}
      {showForm && (
        <div
          onClick={() => { setShowForm(false); setEditingId(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: '20px', width: '100%', maxWidth: '480px',
              maxHeight: '90vh', overflow: 'auto',
              animation: 'modalIn 0.25s ease',
              boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1,
              borderRadius: '20px 20px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'rgba(15,141,99,0.1)', border: '1px solid rgba(15,141,99,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="psychology" size={18} color="#0f8d63" />
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)' }}>
                  {editingId ? tr.editStrategy : tr.newStrategy}
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingId(null) }}
                style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  color: 'var(--text3)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <Icon name="close" size={16} color="var(--text3)" />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '24px' }}>
              {/* Name */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                  {tr.strategyName}
                </label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={tr.strategyNamePlaceholder} />
              </div>

              {/* Plan */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                  {tr.strategyPlan}
                </label>
                <textarea value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))} placeholder={tr.strategyPlanPlaceholder} rows={3} style={{ resize: 'vertical' }} />
              </div>

              {/* Details */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                  {tr.strategyDetails}
                </label>
                <textarea value={form.details} onChange={e => setForm(p => ({ ...p, details: e.target.value }))} placeholder={tr.strategyDetailsPlaceholder} rows={4} style={{ resize: 'vertical' }} />
              </div>

              {/* Save button */}
              <button onClick={handleSave} disabled={saving} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                background: 'linear-gradient(135deg, #0f8d63, #0a6448)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '12px',
                fontSize: '15px', fontWeight: '700', cursor: saving ? 'wait' : 'pointer',
                fontFamily: 'Heebo, sans-serif', opacity: saving ? 0.7 : 1,
                transition: 'opacity 0.15s',
                boxShadow: '0 4px 16px rgba(15,141,99,0.25)',
              }}>
                <Icon name="save" size={16} color="#fff" /> {saving ? tr.saving : tr.save}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .strat-header { padding: 16px !important; gap: 12px !important; }
          .strat-header .strat-icon { width: 38px !important; height: 38px !important; }
          .strat-header .strat-icon span { font-size: 14px !important; }
          .strat-header .strat-name { font-size: 15px !important; }
          .strat-header .strat-badge { display: none !important; }
          .strat-header .strat-plan-preview { display: none !important; }
          .strat-header .strat-preview-stats { display: none !important; }
          .strat-expanded { padding: 0 16px 16px !important; }
          .strat-expanded .strat-stats-wrap { padding: 14px !important; }
          .strat-expanded .strat-pnl-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .strat-expanded .strat-pnl-big { font-size: 21px !important; }
          .strat-expanded .strat-detail-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .strat-expanded .strat-plan-details { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
