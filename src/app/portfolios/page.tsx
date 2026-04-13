'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Portfolio } from '@/types'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'

const MARKET_ICONS: Record<string, string> = { forex: '💱', stocks: '📈', crypto: '₿', commodities: '🥇', other: '📊' }

const PORTFOLIO_COLORS = [
  { id: 'blue', primary: '#4a7fff' }, { id: 'purple', primary: '#8b5cf6' },
  { id: 'green', primary: '#10b981' }, { id: 'red', primary: '#ef4444' },
  { id: 'amber', primary: '#f59e0b' }, { id: 'cyan', primary: '#06b6d4' },
  { id: 'pink', primary: '#ec4899' }, { id: 'gray', primary: '#6b7280' },
]

export default function PortfoliosPage() {
  const { language } = useApp()
  const tr = t[language]
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => { loadPortfolios() }, [])

  async function loadPortfolios() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('portfolios').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (data) setPortfolios(data)
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error(language === 'he' ? 'נא להזין שם לתיק' : 'Please enter a portfolio name'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editingId) {
      const { error } = await supabase.from('portfolios').update({ name: form.name, market_type: form.market_type, initial_capital: parseFloat(form.initial_capital) || 0, color: form.color }).eq('id', editingId)
      if (error) toast.error(language === 'he' ? 'שגיאה בעדכון' : 'Update error')
      else toast.success(language === 'he' ? 'התיק עודכן ✓' : 'Portfolio updated ✓')
    } else {
      const { error } = await supabase.from('portfolios').insert({ user_id: user.id, name: form.name, market_type: form.market_type, initial_capital: parseFloat(form.initial_capital) || 0, currency: 'USD', color: form.color })
      if (error) toast.error(language === 'he' ? 'שגיאה ביצירת תיק' : 'Error creating portfolio')
      else toast.success(language === 'he' ? 'תיק נוצר בהצלחה ✓' : 'Portfolio created ✓')
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' })
    loadPortfolios()
  }

  function startEdit(p: Portfolio) {
    setForm({ name: p.name, market_type: p.market_type, initial_capital: p.initial_capital.toString(), color: (p as any).color || 'blue' })
    setEditingId(p.id)
    setShowForm(true)
  }

  const getColor = (id: string) => PORTFOLIO_COLORS.find(c => c.id === id)?.primary || '#4a7fff'

  const MARKET_LABELS: Record<string, Record<string, string>> = {
    he: { forex: 'פורקס', stocks: 'מניות', crypto: 'קריפטו', commodities: 'סחורות', other: 'אחר' },
    en: { forex: 'Forex', stocks: 'Stocks', crypto: 'Crypto', commodities: 'Commodities', other: 'Other' },
  }

  const glass = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px' }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={tr.portfoliosTitle}
        subtitle={language === 'he' ? 'ניהול תיקי המסחר שלך' : 'Manage your trading portfolios'}
        icon="folder_open"
        action={
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' }) }}
            style={{ background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 0 20px rgba(74,127,255,0.35)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Heebo, sans-serif' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>add</span>
            {tr.newPortfolioBtn}
          </button>
        }
      />

      {/* Form */}
      {showForm && (
        <div style={{ ...glass, padding: '24px', marginBottom: '20px' }} className="fade-up">
          <div style={{ fontSize: '15px', fontWeight: '800', marginBottom: '20px', color: 'var(--text)' }}>
            {editingId ? tr.editPortfolio : tr.newPortfolioForm}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }} className="form-grid">
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
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.initialCapital}</label>
              <input type="number" value={form.initial_capital} onChange={e => setForm(p => ({ ...p, initial_capital: e.target.value }))} placeholder="10,000" />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.portfolioColor}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PORTFOLIO_COLORS.map(c => (
                <div key={c.id} onClick={() => setForm(p => ({ ...p, color: c.id }))} style={{ width: '34px', height: '34px', borderRadius: '50%', background: c.primary, cursor: 'pointer', border: form.color === c.id ? '3px solid #fff' : '3px solid transparent', boxShadow: form.color === c.id ? `0 0 0 2px ${c.primary}, 0 0 12px ${c.primary}88` : 'none', transition: 'all 0.2s', transform: form.color === c.id ? 'scale(1.15)' : 'scale(1)' }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>{saving ? tr.saving : tr.save}</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">{tr.cancel}</button>
          </div>
        </div>
      )}

      {/* List */}
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
              <div key={p.id} style={{ background: 'var(--glass-bg)', border: `1px solid ${color}22`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', transition: 'border 0.2s' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  {MARKET_ICONS[p.market_type] || '📊'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                    <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text)' }}>{p.name}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '600' }}>
                    {MARKET_LABELS[language][p.market_type]} • {tr.initialCapitalLabel}: ${p.initial_capital?.toLocaleString() || 0}
                  </div>
                </div>
                <button onClick={() => startEdit(p)} style={{ background: 'var(--bg3)', border: `1px solid ${color}30`, borderRadius: '10px', padding: '7px 14px', fontSize: '12px', color: color, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700' }}>
                  {tr.edit}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
