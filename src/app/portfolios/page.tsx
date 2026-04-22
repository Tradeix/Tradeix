'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Portfolio } from '@/types'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'

const MARKET_ICONS: Record<string, string> = { forex: '💱', stocks: '📈', crypto: '₿', commodities: '🥇', other: '📊' }

const PORTFOLIO_COLORS = [
  { id: 'blue', primary: '#3b82f6' }, { id: 'purple', primary: '#8b5cf6' },
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

export default function PortfoliosPage() {
  const { language, isPro } = useApp()
  const tr = t[language]
  const router = useRouter()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [portfolioStats, setPortfolioStats] = useState<Record<string, PortfolioStats>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [pendingOpenNew, setPendingOpenNew] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (localStorage.getItem('tradeix-open-new-portfolio') === '1') {
      localStorage.removeItem('tradeix-open-new-portfolio')
      setPendingOpenNew(true)
    }
    loadPortfolios()
  }, [])

  // Once portfolios load, auto-open the new form if flagged
  useEffect(() => {
    if (pendingOpenNew && !loading) {
      setPendingOpenNew(false)
      openNewForm()
    }
  }, [pendingOpenNew, loading])

  async function loadPortfolios() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('portfolios').select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
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
      setPortfolioStats(statsMap)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error(language === 'he' ? 'נא להזין שם לתיק' : 'Please enter a name'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editingId) {
      const { error } = await supabase.from('portfolios').update({ name: form.name, market_type: form.market_type, initial_capital: parseFloat(form.initial_capital) || 0, color: form.color }).eq('id', editingId)
      if (error) toast.error(language === 'he' ? 'שגיאה בעדכון' : 'Update error')
      else toast.success(language === 'he' ? 'התיק עודכן' : 'Portfolio updated')
    } else {
      const { error } = await supabase.from('portfolios').insert({ user_id: user.id, name: form.name, market_type: form.market_type, initial_capital: parseFloat(form.initial_capital) || 0, currency: 'USD', color: form.color, archived: false })
      if (error) toast.error(language === 'he' ? 'שגיאה ביצירת תיק' : 'Error creating portfolio')
      else toast.success(language === 'he' ? 'תיק נוצר' : 'Portfolio created')
    }
    setSaving(false); setShowForm(false); setEditingId(null)
    setForm({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' })
    loadPortfolios()
    router.refresh()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleArchive(id: string) {
    const { error } = await supabase.from('portfolios').update({ archived: true }).eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה בארכיון' : 'Archive error')
    else { toast.success(language === 'he' ? 'התיק הועבר לארכיון' : 'Portfolio archived'); loadPortfolios(); router.refresh() }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('portfolios').delete().eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה במחיקה' : 'Delete error')
    else { toast.success(language === 'he' ? 'התיק נמחק' : 'Portfolio deleted'); setConfirmDelete(null); loadPortfolios(); router.refresh() }
  }

  function startEdit(p: Portfolio) {
    setForm({ name: p.name, market_type: p.market_type, initial_capital: p.initial_capital.toString(), color: (p as any).color || 'blue' })
    setEditingId(p.id); setShowForm(true)
  }

  function openNewForm() {
    // Free tier: max 1 portfolio
    const maxPortfolios = isPro ? 3 : 1
    if (portfolios.length >= maxPortfolios) {
      if (!isPro) {
        toast.error(language === 'he' ? 'מנוי חינמי מוגבל לתיק אחד — שדרג ל PRO' : 'Free plan is limited to 1 portfolio — upgrade to PRO')
        router.push('/upgrade')
      } else {
        toast.error(language === 'he' ? 'מנוי PRO מוגבל ל-3 תיקים' : 'PRO plan is limited to 3 portfolios')
      }
      return
    }
    setForm({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' })
    setEditingId(null); setShowForm(true)
  }

  const getColor = (id: string) => PORTFOLIO_COLORS.find(c => c.id === id)?.primary || '#3b82f6'

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={tr.portfoliosTitle}
        subtitle={language === 'he' ? 'ניהול תיקי המסחר שלך' : 'Manage your trading portfolios'}
        icon="cases"
        action={(
          <button
            type="button"
            onClick={openNewForm}
            className="btn-press"
            style={{
              flexShrink: 0, background: '#10b981', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '10px 20px', fontSize: '12px', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              fontFamily: 'Heebo, sans-serif', transition: 'background 0.15s, transform 0.1s',
            }}
          >
            <Icon name="add" size={16} />
            {tr.newPortfolioBtn}
          </button>
        )}
      />

      {/* ── POPUP FORM (new / edit) ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px', animation: 'overlayIn 0.2s ease' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '520px', position: 'relative', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {/* Close button */}
            <button onClick={() => setShowForm(false)} style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontFamily: 'Heebo, sans-serif' }}>✕</button>

            <div style={{ fontSize: '18px', fontWeight: '900', marginBottom: '24px', color: 'var(--text)' }}>
              {editingId ? tr.editPortfolio : tr.newPortfolioForm}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }} className="form-grid">
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.portfolioName.replace(' *', '')}</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={tr.portfolioNamePlaceholder} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.marketType}</label>
                <div className="select-wrap">
                  <select value={form.market_type} onChange={e => setForm(p => ({ ...p, market_type: e.target.value }))}>
                    {Object.entries(MARKET_LABELS[language]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.initialCapital}</label>
              <input type="number" value={form.initial_capital} onChange={e => setForm(p => ({ ...p, initial_capital: e.target.value }))} placeholder="10,000" />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.portfolioColor}</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PORTFOLIO_COLORS.map(c => (
                  <div key={c.id} onClick={() => setForm(p => ({ ...p, color: c.id }))} style={{ width: '32px', height: '32px', borderRadius: '50%', background: c.primary, cursor: 'pointer', border: form.color === c.id ? '3px solid #fff' : '3px solid transparent', transition: 'all 0.15s', transform: form.color === c.id ? 'scale(1.1)' : 'scale(1)' }} />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 1, opacity: saving ? 0.7 : 1 }}>{saving ? tr.saving : tr.save}</button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">{tr.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM DELETE ── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', animation: 'overlayIn 0.2s ease' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center', animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="delete_forever" size={28} color="#ef4444" />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px' }}>
              {language === 'he' ? 'מחיקת תיק' : 'Delete Portfolio'}
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
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost">
                {tr.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PORTFOLIO LIST ── */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>{tr.loading}</div>
      ) : portfolios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="folder_open" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', marginBottom: '8px', color: 'var(--text)' }}>{tr.noPortfoliosYet}</div>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{tr.noPortfoliosDesc}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {portfolios.map((p, idx) => {
            const color = getColor((p as any).color || 'blue')
            const s = portfolioStats[p.id]
            const pnlPos = (s?.totalPnl || 0) >= 0
            return (
              <div key={p.id} className="card-hover trade-row-anim portfolio-card" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderInlineStart: `3px solid ${color}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', animationDelay: `${idx * 0.08}s`, flexWrap: 'wrap' }}>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div
                      onClick={() => router.push('/stats')}
                      style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'color 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.color = '#10b981'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text)'}
                    >{p.name}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {MARKET_LABELS[language][p.market_type]}
                    {s && ` • ${s.totalTrades} ${language === 'he' ? 'עסקאות' : 'trades'} • ${s.winRate.toFixed(0)}% WIN`}
                  </div>
                </div>

                {/* Stats summary */}
                {s && (
                  <div className="portfolio-pnl" style={{ textAlign: 'center', paddingInline: '16px', borderInline: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: pnlPos ? '#22c55e' : '#ef4444' }}>
                      {pnlPos ? '+' : ''}${s.totalPnl.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P&L</div>
                  </div>
                )}

                {/* Actions */}
                <div className="portfolio-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => startEdit(p)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                    {tr.edit}
                    <Icon name="edit" size={14} />
                  </button>
                  {isPro && <button onClick={() => handleArchive(p.id)} title={language === 'he' ? 'העבר לארכיון' : 'Archive'} style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    <Icon name="inventory_2" size={15} />
                  </button>}
                  <button onClick={() => setConfirmDelete(p.id)} title={language === 'he' ? 'מחק תיק' : 'Delete'} style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    <Icon name="delete" size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .form-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) {
          .portfolio-card { flex-wrap: wrap !important; gap: 12px !important; padding: 14px 16px !important; }
          .portfolio-card .portfolio-actions { width: 100%; justify-content: flex-end !important; }
          .portfolio-card .portfolio-actions button { padding: 6px 12px !important; }
          .portfolio-pnl { display: none !important; }
        }
      `}</style>
    </div>
  )
}
