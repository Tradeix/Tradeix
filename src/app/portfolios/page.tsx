'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Portfolio } from '@/types'
import toast from 'react-hot-toast'

const MARKET_ICONS: Record<string, string> = {
  forex: '💱', stocks: '📈', crypto: '₿', commodities: '🥇', other: '📊',
}

const MARKET_LABELS: Record<string, string> = {
  forex: 'פורקס', stocks: 'מניות', crypto: 'קריפטו', commodities: 'סחורות', other: 'אחר',
}

const PORTFOLIO_COLORS = [
  { id: 'blue',   label: 'כחול',   primary: '#4a7fff', bg: '#1a3a8f22', border: '#4a7fff44' },
  { id: 'purple', label: 'סגול',   primary: '#8b5cf6', bg: '#7c3aed22', border: '#8b5cf644' },
  { id: 'green',  label: 'ירוק',   primary: '#10b981', bg: '#10b98122', border: '#10b98144' },
  { id: 'red',    label: 'אדום',   primary: '#ef4444', bg: '#ef444422', border: '#ef444444' },
  { id: 'amber',  label: 'זהב',    primary: '#f59e0b', bg: '#f59e0b22', border: '#f59e0b44' },
  { id: 'cyan',   label: 'תכלת',   primary: '#06b6d4', bg: '#06b6d422', border: '#06b6d444' },
  { id: 'pink',   label: 'ורוד',   primary: '#ec4899', bg: '#ec489922', border: '#ec489944' },
  { id: 'gray',   label: 'אפור',   primary: '#6b7280', bg: '#6b728022', border: '#6b728044' },
]

export default function PortfoliosPage() {
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
    if (!form.name.trim()) { toast.error('נא להזין שם לתיק'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editingId) {
      const { error } = await supabase.from('portfolios').update({
        name: form.name,
        market_type: form.market_type,
        initial_capital: parseFloat(form.initial_capital) || 0,
        color: form.color,
      }).eq('id', editingId)
      if (error) toast.error('שגיאה בעדכון')
      else toast.success('התיק עודכן ✓')
    } else {
      const { error } = await supabase.from('portfolios').insert({
        user_id: user.id,
        name: form.name,
        market_type: form.market_type,
        initial_capital: parseFloat(form.initial_capital) || 0,
        currency: 'USD',
        color: form.color,
      })
      if (error) toast.error('שגיאה ביצירת תיק')
      else toast.success('תיק נוצר בהצלחה ✓')
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

  function getColor(colorId: string) {
    return PORTFOLIO_COLORS.find(c => c.id === colorId) || PORTFOLIO_COLORS[0]
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '20px', fontWeight: '600' }}>הגדרות תיקים</div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', market_type: 'forex', initial_capital: '', color: 'blue' }) }}
          className="btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
          ＋ תיק חדש
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '20px' }} className="fade-up">
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
            {editingId ? 'עריכת תיק' : 'תיק חדש'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }} className="form-grid">
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>שם התיק *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="תיק פורקס 2024" />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>סוג שוק</label>
              <select value={form.market_type} onChange={e => setForm(p => ({ ...p, market_type: e.target.value }))}>
                <option value="forex">פורקס</option>
                <option value="stocks">מניות</option>
                <option value="crypto">קריפטו</option>
                <option value="commodities">סחורות</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>הון התחלתי ($)</label>
              <input type="number" value={form.initial_capital} onChange={e => setForm(p => ({ ...p, initial_capital: e.target.value }))} placeholder="10,000" />
            </div>
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '10px', display: 'block' }}>צבע התיק</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PORTFOLIO_COLORS.map(color => (
                <div
                  key={color.id}
                  onClick={() => setForm(p => ({ ...p, color: color.id }))}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: color.primary,
                    cursor: 'pointer',
                    border: form.color === color.id ? `3px solid #fff` : '3px solid transparent',
                    boxShadow: form.color === color.id ? `0 0 0 2px ${color.primary}, 0 0 12px ${color.primary}88` : 'none',
                    transition: 'all 0.2s',
                    transform: form.color === color.id ? 'scale(1.15)' : 'scale(1)',
                  }}
                  title={color.label}
                />
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>
              נבחר: {getColor(form.color).label}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? 'שומר...' : '✓ שמור'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">ביטול</button>
          </div>
        </div>
      )}

      {/* Portfolios list */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>טוען...</div>
      ) : portfolios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>📁</div>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>אין תיקים עדיין</div>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>צור תיק ראשון כדי להתחיל</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {portfolios.map(p => {
            const color = getColor((p as any).color || 'blue')
            return (
              <div key={p.id} style={{
                background: 'var(--bg2)', border: `1px solid ${color.border}`,
                borderRadius: 'var(--radius)', padding: '16px',
                display: 'flex', alignItems: 'center', gap: '16px',
                transition: 'border 0.2s',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                  background: color.bg,
                  border: `1px solid ${color.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px',
                }}>
                  {MARKET_ICONS[p.market_type] || '📊'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: color.primary,
                      boxShadow: `0 0 6px ${color.primary}`,
                      flexShrink: 0,
                    }} />
                    <div style={{ fontWeight: '600', fontSize: '15px' }}>{p.name}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                    {MARKET_LABELS[p.market_type]} • הון התחלתי: ${p.initial_capital?.toLocaleString() || 0}
                  </div>
                </div>
                <button onClick={() => startEdit(p)} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', borderColor: color.border }}>
                  ✎ עריכה
                </button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
