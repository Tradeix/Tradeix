'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Portfolio } from '@/types'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import { useApp } from '@/lib/app-context'
import { usePortfolio } from '@/lib/portfolio-context'
import { t } from '@/lib/translations'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'

const MARKET_ICONS: Record<string, string> = { forex: '💱', stocks: '📈', crypto: '₿', commodities: '🥇', other: '📊' }

const PORTFOLIO_COLORS = [
  { id: 'green',  primary: '#10b981' },
  { id: 'blue',   primary: '#3b82f6' },
  { id: 'purple', primary: '#8b5cf6' },
  { id: 'red',    primary: '#ef4444' },
  { id: 'amber',  primary: '#f59e0b' },
  { id: 'cyan',   primary: '#06b6d4' },
  { id: 'pink',   primary: '#ec4899' },
  { id: 'teal',   primary: '#14b8a6' },
  { id: 'indigo', primary: '#6366f1' },
  { id: 'rose',   primary: '#f43f5e' },
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
  const { setActivePortfolio } = usePortfolio()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [portfolioStats, setPortfolioStats] = useState<Record<string, PortfolioStats>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [pendingOpenNew, setPendingOpenNew] = useState(false)
  const [maxBannerDismissed, setMaxBannerDismissed] = useState(false)
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
    else {
      toast.success(language === 'he' ? 'התיק הועבר לארכיון' : 'Portfolio archived')
      // Optimistic: drop from local list immediately so the empty state
      // shows without waiting for the loadPortfolios refetch.
      setPortfolios(prev => prev.filter(p => p.id !== id))
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('portfolios').delete().eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה במחיקה' : 'Delete error')
    else {
      toast.success(language === 'he' ? 'התיק נמחק' : 'Portfolio deleted')
      setConfirmDelete(null)
      setPortfolios(prev => prev.filter(p => p.id !== id))
      router.refresh()
    }
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

  const getColor = (id: string) => PORTFOLIO_COLORS.find(c => c.id === id)?.primary || '#10b981'

  const maxPortfolios = isPro ? 3 : 1
  const atMaxPortfolios = portfolios.length >= maxPortfolios

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={tr.portfoliosTitle}
        subtitle={language === 'he' ? 'ניהול תיקי המסחר שלך' : 'Manage your trading portfolios'}
        icon="cases"
        action={!atMaxPortfolios ? (
          <button
            type="button"
            onClick={openNewForm}
            className="btn-press"
            style={{
              flexShrink: 0, background: '#10b981', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              fontFamily: 'Heebo, sans-serif', transition: 'background 0.15s, transform 0.1s',
            }}
          >
            <Icon name="add" size={16} />
            {tr.newPortfolioBtn}
          </button>
        ) : undefined}
      />

      {/* ── MAX-LIMIT BANNER ── */}
      {atMaxPortfolios && !loading && !maxBannerDismissed && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <Icon name="info" size={18} color="#f59e0b" />
          <div style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: 'var(--text2)', lineHeight: 1.5 }}>
            {isPro
              ? (language === 'he' ? 'הגעת למקסימום של 3 תיקים פעילים. כדי להוסיף תיק חדש, מחק או העבר לארכיון אחד מהקיימים.' : 'You have reached the maximum of 3 active portfolios. Delete or archive one to add a new one.')
              : (language === 'he' ? 'תכנית חינמית מוגבלת לתיק אחד. שדרג ל-PRO כדי לפתוח עד 3 תיקים.' : 'Free plan is limited to 1 portfolio. Upgrade to PRO to create up to 3.')}
          </div>
          <button
            onClick={() => setMaxBannerDismissed(true)}
            aria-label={language === 'he' ? 'סגור' : 'Close'}
            style={{
              flexShrink: 0, width: '28px', height: '28px', borderRadius: '8px',
              background: 'transparent', border: 'none',
              color: 'var(--text3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
          >
            <Icon name="close" size={16} color="currentColor" />
          </button>
        </div>
      )}

      {/* ── POPUP FORM (new / edit) ── */}
      {showForm && (
        <div className="app-modal-overlay" onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', animation: 'overlayIn 0.2s ease' }}>
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" style={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '520px', position: 'relative', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {/* Close button */}
            <button onClick={() => setShowForm(false)} style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontFamily: 'Heebo, sans-serif' }}>✕</button>

            <div style={{ fontSize: '19px', fontWeight: '900', marginBottom: '24px', color: 'var(--text)' }}>
              {editingId ? tr.editPortfolio : tr.newPortfolioForm}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }} className="form-grid">
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.portfolioName.replace(' *', '')}</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={tr.portfolioNamePlaceholder} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.marketType}</label>
                <div className="select-wrap">
                  <select value={form.market_type} onChange={e => setForm(p => ({ ...p, market_type: e.target.value }))}>
                    {Object.entries(MARKET_LABELS[language]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.initialCapital}</label>
              <input type="number" value={form.initial_capital} onChange={e => setForm(p => ({ ...p, initial_capital: e.target.value }))} placeholder="10,000" />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.portfolioColor}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PORTFOLIO_COLORS.map(c => {
                  const active = form.color === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, color: c.id }))}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: c.primary, cursor: 'pointer',
                        border: active ? '2px solid #fff' : '2px solid transparent',
                        boxShadow: active ? `0 0 0 2px ${c.primary}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', padding: 0,
                      }}
                    >
                      {active && <Icon name="check" size={13} color="#fff" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Icon name="save" size={16} color="#fff" /> {saving ? tr.saving : tr.save}</button>
          </div>
        </div>
      )}

      {/* ── CONFIRM DELETE ── */}
      {confirmDelete && (
        <div className="app-modal-overlay app-modal-overlay--top" onClick={() => setConfirmDelete(null)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', animation: 'overlayIn 0.2s ease' }}>
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center', animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="delete_forever" size={28} color="#ef4444" />
            </div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--text)', marginBottom: '10px' }}>
              {language === 'he' ? 'מחיקת תיק' : 'Delete Portfolio'}
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
          <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px', color: 'var(--text)' }}>{tr.noPortfoliosYet}</div>
          <div style={{ fontSize: '14px', color: 'var(--text3)' }}>{tr.noPortfoliosDesc}</div>
        </div>
      ) : (
        <div className="portfolios-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
          {portfolios.map((p, idx) => {
            const color = getColor((p as any).color || 'blue')
            const s = portfolioStats[p.id]
            const pnlPos = (s?.totalPnl || 0) >= 0
            return (
              <div
                key={p.id}
                className="card-hover trade-row-anim portfolio-card"
                style={{
                  background: 'var(--bg2)',
                  border: `1px solid ${color}30`,
                  borderTop: `3px solid ${color}`,
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  position: 'relative',
                  overflow: 'hidden',
                  animationDelay: `${idx * 0.08}s`,
                }}
              >
                {/* Subtle color glow */}
                <div style={{ position: 'absolute', top: '-30px', insetInlineEnd: '-30px', width: '120px', height: '120px', background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`, pointerEvents: 'none' }} />

                {/* Header: color tile + name + market */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '12px',
                    background: `${color}1f`, border: `1px solid ${color}50`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon name="cases" size={19} color={color} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      onClick={() => { setActivePortfolio(p); router.push('/dashboard') }}
                      title={p.name}
                      style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'color 0.15s', lineHeight: 1.2 }}
                      onMouseOver={e => (e.currentTarget.style.color = color)}
                      onMouseOut={e => (e.currentTarget.style.color = 'var(--text)')}
                    >{p.name}</div>
                    <div style={{ fontSize: '11px', color, fontWeight: '700', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {MARKET_LABELS[language][p.market_type]}
                    </div>
                  </div>
                </div>

                {/* Trades + Win-rate strip */}
                {s && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'center', background: 'var(--bg3)', borderRadius: '10px', padding: '10px 12px', position: 'relative' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{language === 'he' ? 'עסקאות' : 'Trades'}</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text)', marginTop: '2px' }}>{s.totalTrades}</div>
                    </div>
                    <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{language === 'he' ? 'אחוז זכייה' : 'Win rate'}</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>{s.winRate.toFixed(0)}%</div>
                    </div>
                  </div>
                )}

                {/* P&L block */}
                {s && (
                  <div style={{
                    background: pnlPos ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${pnlPos ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}`,
                    borderRadius: '12px', padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    position: 'relative',
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>P&L</span>
                    <span dir="ltr" style={{ fontSize: '19px', fontWeight: '900', color: pnlPos ? '#22c55e' : '#ef4444' }}>
                      {pnlPos ? '+' : ''}${s.totalPnl.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="portfolio-actions" style={{ display: 'flex', gap: '6px', marginTop: 'auto', position: 'relative' }}>
                  <button onClick={() => startEdit(p)} title={tr.edit} style={{ flex: 1, height: '36px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    <Icon name="edit" size={16} />
                  </button>
                  {isPro && (
                    <button onClick={() => handleArchive(p.id)} title={language === 'he' ? 'העבר לארכיון' : 'Archive'} style={{ flex: 1, height: '36px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                      <Icon name="inventory_2" size={16} />
                    </button>
                  )}
                  <button onClick={() => setConfirmDelete(p.id)} title={language === 'he' ? 'מחק תיק' : 'Delete'} style={{ flex: 1, height: '36px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .form-grid { grid-template-columns: 1fr !important; }
          .portfolios-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 640px) {
          .portfolios-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .portfolio-card { padding: 16px !important; }
          .portfolio-card .portfolio-actions button { height: 40px !important; }
          .portfolio-card .portfolio-actions button svg { width: 18px !important; height: 18px !important; }
        }
      `}</style>
    </div>
  )
}
