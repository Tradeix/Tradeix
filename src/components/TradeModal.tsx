'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'

interface TradeModalProps {
  trade: Trade
  onClose: () => void
  onUpdate: () => void
}

export default function TradeModal({ trade, onClose, onUpdate }: TradeModalProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [form, setForm] = useState({
    symbol: trade.symbol,
    direction: trade.direction,
    entry_price: trade.entry_price?.toString() || '',
    exit_price: trade.exit_price?.toString() || '',
    stop_loss: trade.stop_loss?.toString() || '',
    take_profit: trade.take_profit?.toString() || '',
    pnl: trade.pnl?.toString() || '',
    notes: trade.notes || '',
    traded_at: trade.traded_at ? new Date(trade.traded_at).toISOString().split('T')[0] : '',
  })
  const [imageUrl, setImageUrl] = useState<string | null>(trade.image_url || null)
  const { language } = useApp()
  const tr = t[language]
  const supabase = createClient()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('trade-images').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('trade-images').getPublicUrl(path)
      setImageUrl(data.publicUrl)
      await supabase.from('trades').update({ image_url: data.publicUrl }).eq('id', trade.id)
      toast.success(language === 'he' ? 'התמונה הועלתה ✓' : 'Image uploaded ✓')
      onUpdate()
    } catch { toast.error(language === 'he' ? 'שגיאה בהעלאת התמונה' : 'Upload failed') }
    finally { setUploadingImage(false) }
  }, [trade.id, language])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1, maxSize: 10 * 1024 * 1024,
  })

  function calcRR() {
    const e = parseFloat(form.entry_price)
    const s = parseFloat(form.stop_loss)
    const tp = parseFloat(form.take_profit)
    if (isNaN(e) || isNaN(s) || isNaN(tp) || Math.abs(e - s) === 0) return null
    return (Math.abs(tp - e) / Math.abs(e - s)).toFixed(2)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const pnl = parseFloat(form.pnl) || 0
      const rr = calcRR()
      const { error } = await supabase.from('trades').update({
        symbol: form.symbol.toUpperCase(),
        direction: form.direction,
        entry_price: parseFloat(form.entry_price),
        exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
        stop_loss: parseFloat(form.stop_loss),
        take_profit: parseFloat(form.take_profit),
        pnl, rr_ratio: rr ? parseFloat(rr) : trade.rr_ratio,
        notes: form.notes, traded_at: form.traded_at,
        outcome: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
      }).eq('id', trade.id)
      if (error) throw error
      toast.success(language === 'he' ? 'העסקה עודכנה ✓' : 'Trade updated ✓')
      setEditing(false)
      onUpdate()
    } catch { toast.error(language === 'he' ? 'שגיאה בשמירה' : 'Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase.from('trades').delete().eq('id', trade.id)
      if (error) throw error
      toast.success(language === 'he' ? 'העסקה הוסרה ✓' : 'Trade removed ✓')
      onUpdate()
      onClose()
    } catch { toast.error(language === 'he' ? 'שגיאה בהסרה' : 'Delete failed') }
    finally { setDeleting(false) }
  }

  const rr = calcRR()
  const isWin = trade.outcome === 'win'

  const glass = {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, backdropFilter: 'blur(8px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: '560px', maxHeight: '90vh',
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '24px', zIndex: 301, overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        animation: 'fadeUp 0.25s ease',
        fontFamily: 'Heebo, sans-serif',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1, borderRadius: '24px 24px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: trade.direction === 'long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${trade.direction === 'long' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: trade.direction === 'long' ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>
                {trade.direction === 'long' ? 'trending_up' : 'trending_down'}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#e5e2e1', letterSpacing: '-0.01em' }}>{trade.symbol}</div>
              <div style={{ fontSize: '11px', color: 'rgba(208,197,175,0.4)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{trade.direction === 'long' ? (language === 'he' ? 'לונג' : 'Long') : (language === 'he' ? 'שורט' : 'Short')}</span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span>{new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', padding: '6px 14px', fontSize: '12px',
                color: 'rgba(229,226,225,0.7)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>edit</span>
                {tr.editBtn}
              </button>
            )}
            <button onClick={onClose} style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(229,226,225,0.5)', cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Image upload */}
          <div style={{ marginBottom: '20px' }}>
            {imageUrl ? (
              <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <img src={imageUrl} alt="chart" style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', display: 'block', background: 'var(--bg)' }} />
                <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                  <div {...getRootProps()}>
                    <input {...getInputProps()} />
                    <button style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', color: 'rgba(229,226,225,0.8)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700' }}>
                      ✎ {tr.replaceImage}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? 'rgba(74,127,255,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '14px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(74,127,255,0.05)' : 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
                <input {...getInputProps()} />
                {uploadingImage ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#4a7fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: '12px', color: 'rgba(208,197,175,0.4)', fontWeight: '600' }}>{language === 'he' ? 'מעלה...' : 'Uploading...'}</span>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'rgba(74,127,255,0.3)', display: 'block', marginBottom: '8px', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>add_photo_alternate</span>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(229,226,225,0.4)', marginBottom: '2px' }}>{tr.uploadOptional}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(208,197,175,0.25)', fontWeight: '600' }}>{tr.uploadOptionalHint}</div>
                  </>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div className="fade-up">
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(74,127,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '14px' }}>{tr.editDetails}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.pair}</label>
                  <input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.tradeType}</label>
                  <select value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value as any }))}>
                    <option value="long">{tr.directionLong}</option>
                    <option value="short">{tr.directionShort}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.entryPriceLabel}</label>
                  <input value={form.entry_price} onChange={e => setForm(p => ({ ...p, entry_price: e.target.value }))} placeholder="0.0000" />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.exitPrice}</label>
                  <input value={form.exit_price} onChange={e => setForm(p => ({ ...p, exit_price: e.target.value }))} placeholder="0.0000" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.slLabel}</label>
                  <input value={form.stop_loss} onChange={e => setForm(p => ({ ...p, stop_loss: e.target.value }))} placeholder="0.0000" />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.tpLabel}</label>
                  <input value={form.take_profit} onChange={e => setForm(p => ({ ...p, take_profit: e.target.value }))} placeholder="0.0000" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.pnl}</label>
                  <input value={form.pnl} onChange={e => setForm(p => ({ ...p, pnl: e.target.value }))} placeholder="+320" />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.dateLabel}</label>
                  <input type="date" value={form.traded_at} onChange={e => setForm(p => ({ ...p, traded_at: e.target.value }))} />
                </div>
              </div>

              <div style={{ ...glass, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(208,197,175,0.4)', fontWeight: '700' }}>{tr.rrLabel}</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: rr ? '#4a7fff' : 'rgba(255,255,255,0.2)' }}>{rr ? `1:${rr}` : '—'}</div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.notes}</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ resize: 'vertical' }} placeholder={tr.notesPlaceholder} />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Heebo, sans-serif' }}>
                  {saving ? tr.saving : tr.save}
                </button>
                <button onClick={() => setEditing(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '11px 16px', fontSize: '13px', color: 'rgba(229,226,225,0.5)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700' }}>{tr.cancel}</button>
              </div>
            </div>
          ) : (
            <div>
              {/* P&L Banner */}
              <div style={{
                background: isWin ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${isWin ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                borderRadius: '16px', padding: '16px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '12px',
              }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>{tr.outcome}</div>
                  <div style={{ fontSize: '32px', fontWeight: '900', color: isWin ? '#22c55e' : '#ef4444', letterSpacing: '-0.02em', textShadow: isWin ? '0 0 20px rgba(34,197,94,0.4)' : '0 0 20px rgba(239,68,68,0.4)', lineHeight: 1 }}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
                  </div>
                </div>
                <span style={{
                  padding: '6px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: '900',
                  background: isWin ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${isWin ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  color: isWin ? '#22c55e' : '#ef4444',
                }}>{isWin ? '✓ WIN' : '✕ LOSS'}</span>
              </div>

              {/* Date — always visible */}
              <div style={{ ...glass, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.dateLabel}</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(229,226,225,0.8)' }}>
                  {new Date(trade.traded_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>

              {/* Entry / Exit / SL / TP grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '12px' }}>
                {[
                  { label: tr.entryPriceLabel, value: trade.entry_price, color: '#4a7fff' },
                  { label: tr.exitPrice, value: trade.exit_price || '—', color: trade.exit_price ? '#e5e2e1' : 'rgba(208,197,175,0.3)' },
                  { label: tr.slLabel, value: trade.stop_loss, color: '#ef4444' },
                  { label: tr.tpLabel, value: trade.take_profit, color: '#22c55e' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ ...glass, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>{label}</div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* RR */}
              <div style={{ ...glass, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', background: 'linear-gradient(135deg, rgba(74,127,255,0.06), rgba(139,92,246,0.06))', border: '1px solid rgba(74,127,255,0.15)' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(74,127,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '2px' }}>Risk / Reward</div>
                  <div style={{ fontSize: '11px', color: 'rgba(208,197,175,0.3)', fontWeight: '600' }}>{tr.rrBased2}</div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: '900', background: 'linear-gradient(90deg, #4a7fff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  1:{trade.rr_ratio?.toFixed(2)}
                </div>
              </div>

              {/* Notes */}
              {trade.notes && (
                <div style={{ ...glass, padding: '14px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>{tr.notes}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(229,226,225,0.6)', lineHeight: 1.6, fontWeight: '500' }}>{trade.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* DELETE */}
          {!editing && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{
                  width: '100%', background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: '12px', padding: '10px',
                  fontSize: '12px', fontWeight: '700', color: 'rgba(239,68,68,0.6)',
                  cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  transition: 'all 0.2s',
                }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>delete</span>
                  {tr.removeTradeBtn}
                </button>
              ) : (
                <div style={{ ...glass, padding: '16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }} className="fade-up">
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444', marginBottom: '12px', textAlign: 'center' }}>
                    {tr.removeTrdeConfirm}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleDelete} disabled={deleting} style={{
                      flex: 1, background: '#ef4444', color: '#fff',
                      border: 'none', borderRadius: '10px', padding: '10px',
                      fontSize: '13px', fontWeight: '700', cursor: deleting ? 'wait' : 'pointer',
                      fontFamily: 'Heebo, sans-serif', opacity: deleting ? 0.7 : 1,
                    }}>
                      {deleting ? tr.removing : tr.removeYes}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} style={{
                      flex: 1, background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px', padding: '10px',
                      fontSize: '13px', fontWeight: '700', color: 'rgba(229,226,225,0.5)',
                      cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                    }}>{tr.cancel}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fade-up { animation: fadeUp 0.2s ease; }
      `}</style>
    </>
  )
}
