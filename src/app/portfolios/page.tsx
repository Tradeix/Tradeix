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

export default function PortfoliosPage() {
  const { language, isPro } = useApp()
  const tr = t[language]
  const router = useRouter()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { loadPortfolios() }, [])

  async function loadPortfolios() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('portfolios').select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: false })
    if (data) setPortfolios(data)
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
  }

  async function handleArchive(id: string) {
    const { error } = await supabase.from('portfolios').update({ archived: true }).eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה בארכיון' : 'Archive error')
    else { toast.success(language === 'he' ? 'התיק הועבר לארכיון' : 'Portfolio archived'); loadPortfolios() }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('portfolios').delete().eq('id', id)
    if (error) toast.error(language === 'he' ? 'שגיאה במחיקה' : 'Delete error')
    else { toast.success(language === 'he' ? 'התיק נמחק' : 'Portfolio deleted'); setConfirmDelete(null); loadPortfolios() }
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

  const getColor = (id: string) => PORTFOLIO_COLORS.find(c => c.id === id)?.primary || '#4a7fff'

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* Header — title + new button always on one row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', gap: '12px', flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0, background: 'linear-gradient(135deg, rgba(74,127,255,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(74,127,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(74,127,255,0.1)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#4a7fff', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>folder_open</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h2 className="page-header-title" style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.02em', margin: 0, color: 'var(--text)', fontFamily: 'Heebo, sans-serif' }}>{tr.portfoliosTitle}</h2>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingBottom: '2px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#4a7fff', boxShadow: '0 0 6px #4a7fff' }} />
                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#8b5cf6', opacity: 0.6 }} />
                <div style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#4a7fff', opacity: 0.3 }} />
              </div>
            </div>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0, fontFamily: 'Heebo, sans-serif' }}>{language === 'he' ? 'ניהול תיקי המסחר שלך' : 'Manage your trading portfolios'}</p>
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '40px', height: '3px', background: 'linear-gradient(90deg, #4a7fff, #8b5cf6)', borderRadius: '999px' }} />
              <div style={{ width: '8px', height: '3px', background: 'rgba(74,127,255,0.3)', borderRadius: '999px' }} />
              <div style={{ width: '4px', height: '3px', background: 'rgba(74,127,255,0.15)', borderRadius: '999px' }} />
            </div>
          </div>
        </div>
        <button onClick={openNewForm} style={{ flexShrink: 0, background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 0 20px rgba(74,127,255,0.35)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Heebo, sans-serif' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' -25, 'opsz' 20" }}>add</span>
          {tr.newPortfolioBtn}
        </button>
      </div>

      {/* ── POPUP FORM (new / edit) ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '20px' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '520px', position: 'relative', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} className="fade-up">
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
                <select value={form.market_type} onChange={e => setForm(p => ({ ...p, market_type: e.target.value }))}>
                  {Object.entries(MARKET_LABELS[language]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
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
                  <div key={c.id} onClick={() => setForm(p => ({ ...p, color: c.id }))} style={{ width: '34px', height: '34px', borderRadius: '50%', background: c.primary, cursor: 'pointer', border: form.color === c.id ? '3px solid #fff' : '3px solid transparent', boxShadow: form.color === c.id ? `0 0 0 2px ${c.primary}, 0 0 12px ${c.primary}88` : 'none', transition: 'all 0.2s', transform: form.color === c.id ? 'scale(1.15)' : 'scale(1)' }} />
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center' }} className="fade-up">
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>delete_forever</span>
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
          <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>📁</div>
          <div style={{ fontSize: '15px', fontWeight: '800', marginBottom: '8px', color: 'var(--text)' }}>{tr.noPortfoliosYet}</div>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{tr.noPortfoliosDesc}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {portfolios.map(p => {
            const color = getColor((p as any).color || 'blue')
            return (
              <div key={p.id} style={{ background: 'var(--glass-bg)', border: `1px solid ${color}22`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Icon */}
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  {MARKET_ICONS[p.market_type] || '📊'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                    <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {MARKET_LABELS[language][p.market_type]} • {tr.initialCapitalLabel}: ${p.initial_capital?.toLocaleString() || 0}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => startEdit(p)} style={{ background: 'var(--bg3)', border: `1px solid ${color}30`, borderRadius: '10px', padding: '7px 14px', fontSize: '12px', color, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {tr.edit}
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' -25, 'opsz' 20" }}>edit</span>
                  </button>
                  <button onClick={() => setConfirmDelete(p.id)} title={language === 'he' ? 'מחק תיק' : 'Delete'} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)' }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' -25, 'opsz' 20" }}>delete</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@media (max-width: 1024px) { .form-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
