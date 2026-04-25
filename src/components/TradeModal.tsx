'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import Icon from '@/components/Icon'

interface TradeModalProps {
  trade: Trade
  onClose: () => void
  onUpdate?: () => void
  readOnly?: boolean
}

export default function TradeModal({ trade, onClose, onUpdate, readOnly = false }: TradeModalProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [pnlError, setPnlError] = useState(false)
  const [form, setForm] = useState({
    symbol: trade.symbol,
    direction: (trade.direction === 'short' ? 'short' : 'long') as 'long' | 'short',
    outcome: (trade.outcome === 'win' ? 'win' : 'loss') as 'win' | 'loss',
    entry_price: trade.entry_price?.toString() || '',
    exit_price: trade.exit_price?.toString() || '',
    stop_loss: trade.stop_loss?.toString() || '',
    pnl: Math.abs(trade.pnl ?? 0).toString(),
    notes: trade.notes || '',
    traded_at: trade.traded_at ? new Date(trade.traded_at).toISOString().split('T')[0] : '',
  })
  const [imageUrl, setImageUrl] = useState<string | null>(trade.image_url || null)
  const [lightbox, setLightbox] = useState(false)
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
      toast.success(language === 'he' ? 'התמונה הועלתה' : 'Image uploaded')
      onUpdate?.()
    } catch { toast.error(language === 'he' ? 'שגיאה בהעלאת התמונה' : 'Upload failed') }
    finally { setUploadingImage(false) }
  }, [trade.id, language])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1, maxSize: 10 * 1024 * 1024,
  })

  async function handleSave() {
    const missingPnl = !form.pnl || form.pnl.trim() === ''
    if (missingPnl) { setPnlError(true); toast.error(language === 'he' ? 'נא למלא P&L' : 'PNL is required'); return }
    setSaving(true)
    try {
      const pnlAbs = Math.abs(parseFloat(form.pnl) || 0)
      const pnl = form.outcome === 'loss' ? -pnlAbs : pnlAbs
      const entryNum = form.entry_price ? parseFloat(form.entry_price) : null
      const exitNum = form.exit_price ? parseFloat(form.exit_price) : null
      const slNum = form.stop_loss ? parseFloat(form.stop_loss) : null
      let rrRatio: number | null = null
      if (entryNum && exitNum && slNum) {
        const reward = form.direction === 'long' ? exitNum - entryNum : entryNum - exitNum
        const risk = form.direction === 'long' ? entryNum - slNum : slNum - entryNum
        if (risk > 0) rrRatio = parseFloat((reward / risk).toFixed(2))
      }
      const { error } = await supabase.from('trades').update({
        symbol: form.symbol.toUpperCase(),
        direction: form.direction,
        entry_price: entryNum,
        exit_price: exitNum,
        stop_loss: slNum,
        pnl,
        rr_ratio: rrRatio,
        notes: form.notes,
        traded_at: form.traded_at,
        outcome: form.outcome,
      }).eq('id', trade.id)
      if (error) throw error
      toast.success(language === 'he' ? 'העסקה עודכנה' : 'Trade updated')
      setEditing(false)
      onUpdate?.()
      router.refresh()
    } catch { toast.error(language === 'he' ? 'שגיאה בשמירה' : 'Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase.from('trades').delete().eq('id', trade.id)
      if (error) throw error
      toast.success(language === 'he' ? 'העסקה הוסרה' : 'Trade removed')
      onUpdate?.()
      onClose()
      router.refresh()
    } catch { toast.error(language === 'he' ? 'שגיאה בהסרה' : 'Delete failed') }
    finally { setDeleting(false) }
  }

  const isWin = editing ? form.outcome === 'win' : trade.outcome === 'win'

  const glass = {
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
  }

  // Numeric date: d/m/yyyy
  const numericDate = (() => {
    if (!trade.traded_at) return '—'
    const d = new Date(trade.traded_at)
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  })()

  const WinLossToggle = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
      {(['win', 'loss'] as const).map(val => {
        const active = form.outcome === val
        const color = val === 'win' ? '#22c55e' : '#ef4444'
        const bg = val === 'win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
        const border = val === 'win' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'
        return (
          <button
            key={val}
            onClick={() => setForm(p => ({ ...p, outcome: val }))}
            style={{
              padding: '12px', borderRadius: '12px',
              background: active ? bg : 'var(--bg3)',
              border: `2px solid ${active ? border : 'var(--border)'}`,
              color: active ? color : 'var(--text3)',
              fontSize: '15px', fontWeight: '900', cursor: 'pointer',
              fontFamily: 'Heebo, sans-serif', letterSpacing: '0.06em',
              transition: 'all 0.18s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <span style={{ fontSize: '16px' }}>{val === 'win' ? '✓' : '✕'}</span>
            {val === 'win' ? 'WIN' : 'LOSS'}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <div onClick={onClose} className="app-modal-overlay" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', animation: 'overlayIn 0.2s ease' }}>

      <div onClick={e => e.stopPropagation()} style={{
        width: '90%', maxWidth: '540px', maxHeight: '92vh',
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: '24px', zIndex: 301, overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'Heebo, sans-serif',
        margin: 'auto',
      }}>

        {editing ? (
          /* ── EDIT MODE ── */
          <>
            {/* Edit header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 2, borderRadius: '24px 24px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="edit" size={15} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{trade.symbol}</div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.editDetails}</div>
                </div>
              </div>
              <button onClick={() => setEditing(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Image */}
              <div style={{ marginBottom: '20px' }}>
                {imageUrl ? (
                  <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <img src={imageUrl} alt="chart" onClick={() => setLightbox(true)} style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', display: 'block', background: 'var(--bg)', cursor: 'zoom-in' }} />
                    <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                      <div {...getRootProps()}>
                        <input {...getInputProps()} />
                        <button style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', color: 'rgba(229,226,225,0.8)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700' }}>✎ {tr.replaceImage}</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? 'rgba(16,185,129,0.5)' : 'var(--border2)'}`, borderRadius: '14px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(16,185,129,0.05)' : 'var(--bg3)', transition: 'all 0.2s' }}>
                    <input {...getInputProps()} />
                    {uploadingImage ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: '600' }}>{language === 'he' ? 'מעלה...' : 'Uploading...'}</span>
                      </div>
                    ) : (
                      <>
                        <Icon name="add_photo_alternate" size={28} color="var(--text3)" style={{ display: 'block', marginBottom: '8px' }} />
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text3)', marginBottom: '2px' }}>{language === 'he' ? 'העלה תמונה (אופציונלי)' : 'Upload image (optional)'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '600' }}>PNG, JPG up to 10MB</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Symbol + Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {language === 'he' ? 'שם הצמד' : 'Symbol'} <span style={{ color: '#ef4444', fontSize: '13px' }}>*</span>
                  </label>
                  <input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {language === 'he' ? 'תאריך' : 'Date'}
                  </label>
                  <input type="date" value={form.traded_at} onChange={e => setForm(p => ({ ...p, traded_at: e.target.value }))} />
                </div>
              </div>

              {/* WIN / LOSS toggle */}
              <div style={{ marginBottom: '0' }}>
                <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {language === 'he' ? 'תוצאה' : 'Outcome'}
                </label>
                <WinLossToggle />
              </div>

              {/* Entry + SL + Exit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {language === 'he' ? 'כניסה' : 'Entry'}
                  </label>
                  <input value={form.entry_price} onChange={e => setForm(p => ({ ...p, entry_price: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(239,68,68,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    SL
                  </label>
                  <input
                    value={form.stop_loss}
                    onChange={e => setForm(p => ({ ...p, stop_loss: e.target.value }))}
                    placeholder="0.00"
                    style={{ borderColor: form.stop_loss ? 'rgba(239,68,68,0.35)' : undefined }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: form.outcome === 'loss' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {language === 'he' ? 'יציאה' : 'Exit'}
                  </label>
                  <input
                    value={form.exit_price}
                    onChange={e => setForm(p => ({ ...p, exit_price: e.target.value }))}
                    placeholder="0.00"
                    style={{ borderColor: form.exit_price ? (form.outcome === 'loss' ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)') : undefined }}
                  />
                </div>
              </div>

              {/* P&L */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', color: pnlError ? '#ef4444' : form.outcome === 'win' ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  P&L ($) <span style={{ color: '#ef4444', fontSize: '13px' }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.pnl}
                  onChange={e => { setForm(p => ({ ...p, pnl: e.target.value })); if (e.target.value.trim()) setPnlError(false) }}
                  placeholder="500"
                  style={pnlError
                    ? { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' }
                    : form.outcome === 'win'
                      ? { borderColor: 'rgba(34,197,94,0.4)', boxShadow: '0 0 0 3px rgba(34,197,94,0.08)' }
                      : { borderColor: 'rgba(239,68,68,0.4)', boxShadow: '0 0 0 3px rgba(239,68,68,0.08)' }
                  }
                />
                {pnlError && (
                  <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600', marginTop: '4px' }}>
                    {language === 'he' ? 'שדה חובה' : 'Required field'}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {language === 'he' ? 'הערות (אופציונלי)' : 'Notes (optional)'}
                </label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ resize: 'vertical' }} placeholder={language === 'he' ? 'מה למדת מהעסקה?' : 'What did you learn?'} />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #0ea772)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '700', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
                  <span>✓</span> {saving ? tr.saving : tr.save}
                </button>
                <button onClick={() => setEditing(false)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700' }}>{tr.cancel}</button>
              </div>
            </div>
          </>
        ) : (
          /* ── VIEW MODE ── */
          <div>

            {/* ── STICKY HEADER: Symbol + action buttons ── */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 2,
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg2)', borderRadius: '24px 24px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              {/* Left: symbol + direction */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: trade.direction === 'long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${trade.direction === 'long' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={trade.direction === 'long' ? 'trending_up' : 'trending_down'} size={17} color={trade.direction === 'long' ? '#22c55e' : '#ef4444'} />
                </div>
                <div>
                  <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1 }}>{trade.symbol}</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: trade.direction === 'long' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '2px' }}>
                    {trade.direction === 'long' ? 'LONG' : 'SHORT'}
                  </div>
                </div>
              </div>
              {/* Right: action buttons */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {!readOnly && (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      title={tr.editBtn}
                      style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >
                      <Icon name="delete" size={15} />
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', transition: 'all 0.2s' }}
                >✕</button>
              </div>
            </div>

            {/* ── IMAGE ── */}
            {imageUrl ? (
              <div style={{ position: 'relative', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                <img
                  src={imageUrl}
                  alt="chart"
                  onClick={() => setLightbox(true)}
                  style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(transparent, var(--bg2))', pointerEvents: 'none' }} />
                <div onClick={() => setLightbox(true)} style={{ position: 'absolute', bottom: '10px', left: '12px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '5px 9px', cursor: 'zoom-in', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="zoom_in" size={13} color="rgba(255,255,255,0.6)" />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>{language === 'he' ? 'הגדל' : 'Zoom'}</span>
                </div>
              </div>
            ) : readOnly ? (
              <div style={{ padding: '20px 24px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Icon name="image" size={18} color="var(--text3)" />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text3)' }}>{language === 'he' ? 'אין תמונה לעסקה זו' : 'No chart image'}</span>
                </div>
              </div>
            ) : (
              <div {...getRootProps()} style={{ padding: '20px 24px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(16,185,129,0.06)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'all 0.2s' }}>
                <input {...getInputProps()} />
                {uploadingImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '18px', height: '18px', border: '2px solid var(--border)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text3)', fontWeight: '600' }}>{language === 'he' ? 'מעלה...' : 'Uploading...'}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Icon name="add_photo_alternate" size={18} color="var(--text3)" />
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text3)' }}>{language === 'he' ? 'הוסף תמונת גרף' : 'Add chart image'}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── ALL TRADE DATA ── */}
            <div style={{ padding: '18px 20px 24px' }}>

              {/* WIN/LOSS badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '999px',
                  background: isWin ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${isWin ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: isWin ? '#22c55e' : '#ef4444', letterSpacing: '0.06em' }}>
                    {isWin ? '✓ WIN' : '✕ LOSS'}
                  </span>
                </div>
              </div>

              {/* P&L card */}
              <div style={{
                background: isWin ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${isWin ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                borderRadius: '14px', padding: '16px 20px', marginBottom: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name={isWin ? 'trending_up' : 'trending_down'} size={18} color={isWin ? '#22c55e' : '#ef4444'} />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>P&L</span>
                </div>
                <div dir="ltr" style={{
                  fontSize: '25px', fontWeight: '900', letterSpacing: '-0.02em',
                  color: isWin ? '#22c55e' : '#ef4444',
                }}>
                  {isWin ? '+' : '-'}${Math.abs(trade.pnl ?? 0)}
                </div>
              </div>

              {/* Data grid */}
              <div style={{ ...glass, overflow: 'hidden' }}>
                {/* Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
                    <Icon name="calendar_today" size={14} color="var(--text3)" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תאריך' : 'Date'}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{numericDate}</span>
                </div>
                {/* Entry price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="login" size={14} color="#10b981" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'כניסה' : 'Entry'}</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: trade.entry_price != null ? '#10b981' : 'var(--text3)' }}>
                    {trade.entry_price ?? '—'}
                  </span>
                </div>
                {/* SL — always shown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="dangerous" size={14} color="#ef4444" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SL</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: trade.stop_loss != null ? '#ef4444' : 'var(--text3)' }}>
                    {trade.stop_loss ?? '—'}
                  </span>
                </div>
                {/* Exit price — always shown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="logout" size={14} color={isWin ? '#22c55e' : '#ef4444'} />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: isWin ? '#22c55e' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'יציאה' : 'Exit'}</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: trade.exit_price != null ? (isWin ? '#22c55e' : '#ef4444') : 'var(--text3)' }}>
                    {trade.exit_price ?? '—'}
                  </span>
                </div>
                {/* RR ratio — always shown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="analytics" size={14} color="#10b981" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RR</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: '900', color: trade.rr_ratio != null ? '#10b981' : 'var(--text3)' }}>
                    {trade.rr_ratio != null ? `1:${trade.rr_ratio.toFixed(2)}` : '—'}
                  </span>
                </div>
                {/* Notes — always shown */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: trade.notes ? '8px' : '0' }}>
                    <Icon name="notes" size={14} color="var(--text3)" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.notes}</span>
                  </div>
                  {trade.notes ? (
                    <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: 1.65, fontWeight: '500', paddingInlineStart: '21px' }}>{trade.notes}</div>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--text3)', fontStyle: 'italic', paddingInlineStart: '21px' }}>—</div>
                  )}
                </div>
              </div>


            </div>
          </div>
        )}

      </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="app-modal-overlay app-modal-overlay--top" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', animation: 'fadeIn 0.15s ease' }}>
          <div className="app-modal-card" data-tight="1" style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '20px', padding: '28px 28px 24px', width: '90%', maxWidth: '340px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', fontFamily: 'Heebo, sans-serif' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="delete" size={22} color="#ef4444" />
            </div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text)', textAlign: 'center', marginBottom: '8px' }}>
              {language === 'he' ? 'מחיקת עסקה' : 'Delete Trade'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text3)', textAlign: 'center', marginBottom: '24px', lineHeight: 1.5 }}>
              {language === 'he' ? `האם אתה בטוח שברצונך למחוק את עסקת ${trade.symbol}? פעולה זו אינה ניתנת לביטול.` : `Are you sure you want to delete the ${trade.symbol} trade? This cannot be undone.`}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '15px', fontWeight: '800', cursor: deleting ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? (language === 'he' ? 'מוחק...' : 'Deleting...') : (language === 'he' ? 'מחק' : 'Delete')}
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', fontSize: '15px', fontWeight: '700', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                {language === 'he' ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && imageUrl && (
        <div
          onClick={() => setLightbox(false)}
          className="app-modal-overlay app-modal-overlay--top2"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease', cursor: 'zoom-out' }}
        >
          <button onClick={() => setLightbox(false)} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 501 }}>✕</button>
          <img src={imageUrl} alt="chart" onClick={e => e.stopPropagation()} style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', cursor: 'default' }} />
        </div>
      )}
    </>
  )
}
