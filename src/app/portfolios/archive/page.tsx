'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Portfolio } from '@/types'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import { useApp } from '@/lib/app-context'
import Link from 'next/link'

const MARKET_ICONS: Record<string, string> = { forex: '💱', stocks: '📈', crypto: '₿', commodities: '🥇', other: '📊' }
const PORTFOLIO_COLORS = [
  { id: 'blue', primary: '#4a7fff' }, { id: 'purple', primary: '#8b5cf6' },
  { id: 'green', primary: '#10b981' }, { id: 'red', primary: '#ef4444' },
  { id: 'amber', primary: '#f59e0b' }, { id: 'cyan', primary: '#06b6d4' },
  { id: 'pink', primary: '#ec4899' }, { id: 'gray', primary: '#6b7280' },
]
const MARKET_LABELS: Record<string, Record<string, string>> = {
  he: { forex: 'פורקס', stocks: 'מניות', crypto: 'קריפטו', commodities: 'סחורות', other: 'אחר' },
  en: { forex: 'Forex', stocks: 'Stocks', crypto: 'Crypto', commodities: 'Commodities', other: 'Other' },
}

interface PortfolioStats {
  totalTrades: number
  wins: number
  totalPnl: number
  winRate: number
}

export default function ArchivePage() {
  const { language } = useApp()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [stats, setStats] = useState<Record<string, PortfolioStats>>({})
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
      // Load stats for each portfolio
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

  async function handleRestore(id: string) {
    const { error } = await supabase.from('portfolios').update({ archived: false }).eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה בשחזור' : 'Restore error')
    else { toast.success(language === 'he' ? 'התיק שוחזר ✓' : 'Portfolio restored ✓'); loadArchived() }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('portfolios').delete().eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה במחיקה' : 'Delete error')
    else { toast.success(language === 'he' ? 'התיק נמחק לצמיתות ✓' : 'Portfolio deleted forever ✓'); setConfirmDelete(null); loadArchived() }
  }

  const getColor = (id: string) => PORTFOLIO_COLORS.find(c => c.id === id)?.primary || '#4a7fff'

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={language === 'he' ? 'ארכיון תיקים' : 'Portfolio Archive'}
        subtitle={language === 'he' ? 'תיקים שהועברו לארכיון' : 'Archived portfolios'}
        icon="inventory_2"
        action={
          <Link href="/portfolios" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', padding: '10px 18px', borderRadius: '12px', textDecoration: 'none', fontSize: '12px', fontWeight: '700', fontFamily: 'Heebo, sans-serif' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>arrow_back</span>
            {language === 'he' ? 'חזרה לתיקים' : 'Back to Portfolios'}
          </Link>
        }
      />

      {/* Confirm Delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center' }} className="fade-up">
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>delete_forever</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px' }}>
              {language === 'he' ? 'מחיקה לצמיתות' : 'Permanent Delete'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '6px', lineHeight: 1.6 }}>
              {language === 'he' ? 'פעולה זו תמחק את התיק וכל העסקאות בו לצמיתות.' : 'This will permanently delete the portfolio and all its trades.'}
            </div>
            <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '700', marginBottom: '24px' }}>
              {language === 'he' ? '⚠ לא ניתן לשחזר פעולה זו!' : '⚠ This action cannot be undone!'}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => handleDelete(confirmDelete)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', padding: '11px 24px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                {language === 'he' ? 'כן, מחק לצמיתות' : 'Yes, Delete Forever'}
              </button>
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost">{language === 'he' ? 'ביטול' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTopColor: '#4a7fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : portfolios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '56px', color: 'rgba(74,127,255,0.15)', display: 'block', marginBottom: '16px', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 48" }}>inventory_2</span>
          <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', marginBottom: '8px' }}>
            {language === 'he' ? 'הארכיון ריק' : 'Archive is empty'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
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

            return (
              <div key={p.id} style={{ background: 'var(--glass-bg)', border: `1px solid ${color}22`, borderRadius: '16px', overflow: 'hidden', transition: 'all 0.3s' }}>

                {/* Main row */}
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', opacity: 0.7 }}>
                    {MARKET_ICONS[p.market_type] || '📊'}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, opacity: 0.6, flexShrink: 0 }} />
                      <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text)', opacity: 0.8 }}>{p.name}</div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: '6px' }}>
                        {language === 'he' ? 'ארכיון' : 'ARCHIVED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '600' }}>
                      {MARKET_LABELS[language][p.market_type]}
                      {s && ` • ${s.totalTrades} ${language === 'he' ? 'עסקאות' : 'trades'} • ${s.winRate.toFixed(0)}% WIN`}
                    </div>
                  </div>

                  {/* Stats summary */}
                  {s && (
                    <div style={{ textAlign: 'center', paddingInline: '16px', borderInline: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: pnlPos ? '#22c55e' : '#ef4444' }}>
                        {pnlPos ? '+' : ''}${s.totalPnl.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P&L</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Stats toggle */}
                    <button onClick={() => setExpandedId(isExpanded ? null : p.id)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: isExpanded ? 'rgba(74,127,255,0.15)' : 'var(--bg3)', border: `1px solid ${isExpanded ? 'rgba(74,127,255,0.3)' : 'var(--border)'}`, color: isExpanded ? '#4a7fff' : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>{isExpanded ? 'expand_less' : 'bar_chart'}</span>
                    </button>

                    {/* Restore */}
                    <button onClick={() => handleRestore(p.id)} title={language === 'he' ? 'שחזר תיק' : 'Restore'} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(16,185,129,0.08)'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>restore</span>
                      {language === 'he' ? 'שחזר' : 'Restore'}
                    </button>

                    {/* Delete forever */}
                    <button onClick={() => setConfirmDelete(p.id)} title={language === 'he' ? 'מחק לצמיתות' : 'Delete forever'} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>delete_forever</span>
                    </button>
                  </div>
                </div>

                {/* Expanded stats */}
                {isExpanded && s && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }} className="fade-up">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      {[
                        { label: language === 'he' ? 'עסקאות' : 'Trades', value: s.totalTrades, color: 'var(--text2)' },
                        { label: language === 'he' ? 'ניצחונות' : 'Wins', value: s.wins, color: '#22c55e' },
                        { label: language === 'he' ? 'אחוז הצלחה' : 'Win Rate', value: `${s.winRate.toFixed(1)}%`, color: '#4a7fff' },
                        { label: 'P&L', value: `${s.totalPnl >= 0 ? '+' : ''}$${s.totalPnl.toLocaleString()}`, color: s.totalPnl >= 0 ? '#22c55e' : '#ef4444' },
                      ].map(({ label, value, color: c }) => (
                        <div key={label} style={{ background: 'var(--bg3)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>{label}</div>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: c }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
