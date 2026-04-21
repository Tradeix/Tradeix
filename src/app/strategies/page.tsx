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

  const card: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }

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
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="psychology" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: 'var(--text)' }}>
            {tr.noStrategiesYet}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px' }}>
            {tr.noStrategiesDesc}
          </div>
          <button onClick={openNew} style={{
            background: '#10b981', color: '#fff', padding: '12px 28px',
            borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: '700',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>
            <Icon name="add" size={16} color="#fff" />
            {tr.newStrategy}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {strategies.map(s => {
            const color = getColorHex(s.color)
            const isExpanded = expandedId === s.id
            return (
              <div key={s.id} className="card-hover" style={{ ...card, overflow: 'hidden', borderColor: isExpanded ? `${color}30` : undefined }}>
                {/* Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  style={{
                    padding: '18px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: `${color}15`, border: `1px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="psychology" size={20} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>{s.name}</div>
                    {s.plan && (
                      <div style={{ fontSize: '12px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.plan}
                      </div>
                    )}
                  </div>
                  <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={20} color="var(--text3)" />
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                    {s.plan && (
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          {tr.strategyPlan}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.plan}</div>
                      </div>
                    )}
                    {s.details && (
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                          {tr.strategyDetails}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.details}</div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                      <button onClick={() => startEdit(s)} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 16px', borderRadius: '8px',
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
                            padding: '8px 16px', borderRadius: '8px',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444', fontSize: '12px', fontWeight: '700',
                            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                          }}>
                            {language === 'he' ? 'כן, מחק' : 'Yes, delete'}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} style={{
                            padding: '8px 14px', borderRadius: '8px',
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
                          padding: '8px 16px', borderRadius: '8px',
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
                  background: '#10b981', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '12px',
                  fontSize: '14px', fontWeight: '700', cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'Heebo, sans-serif', opacity: saving ? 0.7 : 1,
                  transition: 'opacity 0.15s',
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
    </div>
  )
}
