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
  { name: 'green', hex: '#10b981' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'purple', hex: '#8b5cf6' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'red', hex: '#ef4444' },
  { name: 'cyan', hex: '#06b6d4' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'gray', hex: '#6b7280' },
]

function getColorHex(name: string) {
  return STRATEGY_COLORS.find(c => c.name === name)?.hex || '#3b82f6'
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
    if (data) setStrategies(data)
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
    else { toast.success(language === 'he' ? 'האסטרטגיה נמחקה' : 'Strategy deleted'); setConfirmDelete(null); loadStrategies(); router.refresh() }
  }

  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div>
        <PageHeader title={tr.strategiesTitle} subtitle={tr.strategiesSubtitle} icon="psychology" />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="folder_open" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', marginBottom: '10px', color: 'var(--text)' }}>
            {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px' }}>
            {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
          </div>
          <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: '#10b981', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
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
        action={
          <button onClick={openNew} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#10b981', color: '#fff', border: 'none',
            borderRadius: '10px', padding: '10px 18px',
            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif', transition: 'opacity 0.15s',
          }}>
            <Icon name="add" size={16} color="#fff" />
            {tr.newStrategy}
          </button>
        }
      />

      {/* ── STRATEGIES LIST ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{tr.loading}</div>
        </div>
      ) : strategies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(16,185,129,0.12))',
            border: '1px solid rgba(139,92,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <Icon name="psychology" size={36} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: 'var(--text)' }}>
            {tr.noStrategiesYet}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px', maxWidth: '320px', margin: '0 auto 24px' }}>
            {tr.noStrategiesDesc}
          </div>
          <button onClick={openNew} style={{
            background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', padding: '12px 28px',
            borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: '700',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
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
                {/* Colored accent line at top */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: `linear-gradient(90deg, ${color}, ${color}80)`,
                  opacity: isExpanded ? 1 : 0,
                  transition: 'opacity 0.25s ease',
                }} />

                {/* Header */}
                <div
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
                    <div style={{
                      width: '46px', height: '46px', borderRadius: '14px',
                      background: `linear-gradient(135deg, ${color}18, ${color}08)`,
                      border: `1.5px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, position: 'relative',
                      transition: 'all 0.25s ease',
                      boxShadow: isExpanded ? `0 4px 20px ${color}20` : 'none',
                    }}>
                      <span style={{
                        fontSize: '16px', fontWeight: '800', color,
                        fontFamily: "'Heebo', sans-serif", letterSpacing: '-0.03em',
                        lineHeight: 1,
                      }}>#{sIdx + 1}</span>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>{s.name}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: '700', color, letterSpacing: '0.05em',
                        background: `${color}12`, padding: '2px 8px', borderRadius: '6px',
                        textTransform: 'uppercase',
                      }}>
                        {language === 'he' ? 'אסטרטגיה' : 'Strategy'}
                      </span>
                    </div>
                    {s.plan && (
                      <div style={{ fontSize: '12px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                        {s.plan}
                      </div>
                    )}
                  </div>

                  {/* Stats preview when collapsed */}
                  {!isExpanded && strategyStats[s.id] && stats.totalTrades > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: pnlPositive ? '#22c55e' : '#ef4444' }}>
                          {pnlPositive ? '+' : ''}${stats.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '600' }}>P&L</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>{stats.winRate.toFixed(0)}%</div>
                        <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: '600' }}>WIN</div>
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
                  <div style={{ padding: '0 24px 24px' }}>

                    {/* ── STRATEGY STATS ── */}
                    <div style={{
                      background: `linear-gradient(135deg, ${color}06, ${color}03)`,
                      border: `1px solid ${color}18`,
                      borderRadius: '14px',
                      padding: '20px',
                      marginBottom: '20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Icon name="monitoring" size={16} color={color} />
                        <span style={{ fontSize: '12px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
                            {language === 'he' ? 'אין עסקאות עם אסטרטגיה זו עדיין' : 'No trades with this strategy yet'}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Big P&L + Win Rate row */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                              background: 'var(--bg2)', borderRadius: '12px', padding: '16px',
                              border: '1px solid var(--border)',
                            }}>
                              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                                {language === 'he' ? 'רווח / הפסד כולל' : 'Total P&L'}
                              </div>
                              <div dir="ltr" style={{
                                fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em',
                                color: pnlPositive ? '#22c55e' : '#ef4444',
                              }}>
                                {pnlPositive ? '+' : '-'}${Math.abs(stats.totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div style={{
                              background: 'var(--bg2)', borderRadius: '12px', padding: '16px',
                              border: '1px solid var(--border)',
                            }}>
                              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                                Win Rate
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                <span style={{
                                  fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em',
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
                          <div style={{
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
                                <div style={{ fontSize: '16px', fontWeight: '700', color: item.valueColor || 'var(--text)', marginBottom: '2px' }}>{item.value}</div>
                                <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                              </div>
                            ))}
                          </div>

                        </>
                      )}
                    </div>

                    {/* ── PLAN & DETAILS ── */}
                    {(s.plan || s.details) && (
                      <div style={{ display: 'grid', gridTemplateColumns: s.plan && s.details ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '20px' }}>
                        {s.plan && (
                          <div style={{
                            background: 'var(--bg3)', borderRadius: '12px', padding: '16px',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                              <Icon name="notes" size={14} color={color} />
                              <span style={{ fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {tr.strategyPlan}
                              </span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.plan}</div>
                          </div>
                        )}
                        {s.details && (
                          <div style={{
                            background: 'var(--bg3)', borderRadius: '12px', padding: '16px',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                              <Icon name="info" size={14} color={color} />
                              <span style={{ fontSize: '11px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {tr.strategyDetails}
                              </span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.details}</div>
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
                        color: 'var(--text2)', fontSize: '12px', fontWeight: '600',
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
                            color: '#ef4444', fontSize: '12px', fontWeight: '700',
                            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                          }}>
                            {language === 'he' ? 'כן, מחק' : 'Yes, delete'}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} style={{
                            padding: '9px 16px', borderRadius: '10px',
                            background: 'var(--bg3)', border: '1px solid var(--border)',
                            color: 'var(--text3)', fontSize: '12px', fontWeight: '600',
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
                          color: 'rgba(239,68,68,0.6)', fontSize: '12px', fontWeight: '600',
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
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="psychology" size={18} color="#10b981" />
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>
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
                <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                  {tr.strategyName}
                </label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={tr.strategyNamePlaceholder} />
              </div>

              {/* Plan */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                  {tr.strategyPlan}
                </label>
                <textarea value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))} placeholder={tr.strategyPlanPlaceholder} rows={3} style={{ resize: 'vertical' }} />
              </div>

              {/* Details */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                  {tr.strategyDetails}
                </label>
                <textarea value={form.details} onChange={e => setForm(p => ({ ...p, details: e.target.value }))} placeholder={tr.strategyDetailsPlaceholder} rows={4} style={{ resize: 'vertical' }} />
              </div>

              {/* Color */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
                  {tr.strategyColor}
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {STRATEGY_COLORS.map(c => (
                    <button key={c.name} onClick={() => setForm(p => ({ ...p, color: c.name }))} style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: c.hex, border: form.color === c.name ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: form.color === c.name ? `0 0 0 2px ${c.hex}` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {form.color === c.name && <Icon name="check" size={14} color="#fff" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleSave} disabled={saving} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '12px',
                  fontSize: '14px', fontWeight: '700', cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'Heebo, sans-serif', opacity: saving ? 0.7 : 1,
                  transition: 'opacity 0.15s',
                  boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
                }}>
                  {saving ? tr.saving : tr.save}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{
                  padding: '12px 22px', background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                  color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  transition: 'all 0.15s',
                }}>
                  {tr.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .strat-stats-grid-detail { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
