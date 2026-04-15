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
  const [pnlError, setPnlError] = useState(false)
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
    const missingPnl = !form.pnl || form.pnl.trim() === ''
    if (missingPnl) { setPnlError(true); toast.error(language === 'he' ? 'נא למלא P&L' : 'PNL is required'); return }
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
      toast.success(language === 'he' ? 'העסקה עודכנה' : 'Trade updated')
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
      toast.success(language === 'he' ? 'העסקה הוסרה' : 'Trade removed')
      onUpdate()
      onClose()
    } catch { toast.error(language === 'he' ? 'שגיאה בהסרה' : 'Delete failed') }
    finally { setDeleting(false) }
  }

  const rr = calcRR()
  const isWin = trade.outcome === 'win'
  const isLong = trade.direction === 'long'

  const glass = {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
  }

  const formattedDate = new Date(trade.traded_at).toLocaleDateString(
    language === 'he' ? 'he-IL' : 'en-US',
    { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, backdropFilter: 'blur(8px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: '540px', maxHeight: '92vh',
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '24px', zIndex: 301, overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        animation: 'fadeUp 0.25s ease',
        fontFamily: 'Heebo, sans-serif',
      }}>

        {editing ? (
          /* ── EDIT MODE ── */
          <>
            {/* Edit header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 2, borderRadius: '24px 24px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(74,127,255,0.1)', border: '1px solid rgba(74,127,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#4a7fff', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>edit</span>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>{trade.symbol}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(74,127,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.editDetails}</div>
                </div>
              </div>
              <button onClick={() => setEditing(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(229,226,225,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Image in edit mode */}
              <div style={{ marginBottom: '20px' }}>
                {imageUrl ? (
                  <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <img src={imageUrl} alt="chart" onClick={() => setLightbox(true)} style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', display: 'block', background: 'var(--bg)', cursor: 'zoom-in' }} />
                    <div onClick={() => setLightbox(true)} style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '4px 8px', cursor: 'zoom-in', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>zoom_in</span>
                    </div>
                    <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                      <div {...getRootProps()}>
                        <input {...getInputProps()} />
                        <button style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', color: 'rgba(229,226,225,0.8)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontWeight: '700' }}>✎ {tr.replaceImage}</button>
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

              {/* Form fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.pair} <span style={{ color: '#ef4444', fontSize: '12px' }}>*</span></label>
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
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.entryPriceLabel} <span style={{ color: '#ef4444', fontSize: '12px' }}>*</span></label>
                  <input value={form.entry_price} onChange={e => setForm(p => ({ ...p, entry_price: e.target.value }))} placeholder="0.0000" />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.exitPrice}</label>
                  <input value={form.exit_price} onChange={e => setForm(p => ({ ...p, exit_price: e.target.value }))} placeholder="0.0000" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.slLabel} <span style={{ color: '#ef4444', fontSize: '12px' }}>*</span></label>
                  <input value={form.stop_loss} onChange={e => setForm(p => ({ ...p, stop_loss: e.target.value }))} placeholder="0.0000" />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.tpLabel} <span style={{ color: '#ef4444', fontSize: '12px' }}>*</span></label>
                  <input value={form.take_profit} onChange={e => setForm(p => ({ ...p, take_profit: e.target.value }))} placeholder="0.0000" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: pnlError ? '#ef4444' : 'rgba(208,197,175,0.5)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {tr.pnl} <span style={{ color: '#ef4444', fontSize: '12px' }}>*</span>
                  </label>
                  <input
                    value={form.pnl}
                    onChange={e => { setForm(p => ({ ...p, pnl: e.target.value })); if (e.target.value.trim()) setPnlError(false) }}
                    placeholder="+320"
                    style={pnlError ? { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' } : {}}
                  />
                  {pnlError && (
                    <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>error</span>
                      {language === 'he' ? 'שדה חובה' : 'Required field'}
                    </div>
                  )}
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
          </>
        ) : (
          /* ── VIEW MODE ── */
          <div>

            {/* ── IMAGE HERO ── */}
            <div style={{ position: 'relative', borderRadius: '24px 24px 0 0', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
              {imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt="chart"
                    onClick={() => setLightbox(true)}
                    style={{ width: '100%', height: '240px', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                  />
                  {/* Gradient overlay at bottom of image */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(transparent, var(--bg2))', pointerEvents: 'none' }} />
                  {/* Zoom hint */}
                  <div onClick={() => setLightbox(true)} style={{ position: 'absolute', bottom: '14px', left: '14px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '5px 9px', cursor: 'zoom-in', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>zoom_in</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>{language === 'he' ? 'הגדל' : 'Zoom'}</span>
                  </div>
                  {/* Replace image */}
                  <div style={{ position: 'absolute', bottom: '14px', right: language === 'he' ? 'auto' : '14px', left: language === 'he' ? '14px' : 'auto' }}>
                    <div {...getRootProps()}>
                      <input {...getInputProps()} />
                    </div>
                  </div>
                </>
              ) : (
                /* No image — compact upload zone */
                <div {...getRootProps()} style={{ padding: '28px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(74,127,255,0.06)' : 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s' }}>
                  <input {...getInputProps()} />
                  {uploadingImage ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#4a7fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize: '12px', color: 'rgba(208,197,175,0.4)', fontWeight: '600' }}>{language === 'he' ? 'מעלה...' : 'Uploading...'}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'rgba(74,127,255,0.3)', fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20" }}>add_photo_alternate</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(229,226,225,0.25)' }}>{language === 'he' ? 'הוסף תמונת גרף' : 'Add chart image'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Floating action buttons — always top-right of image area */}
              <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px', zIndex: 2 }}>
                <button
                  onClick={() => setEditing(true)}
                  title={tr.editBtn}
                  style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(229,226,225,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(74,127,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(74,127,255,0.5)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>edit</span>
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  title={language === 'he' ? 'מחק' : 'Delete'}
                  style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>delete</span>
                </button>
                <button
                  onClick={onClose}
                  style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(229,226,225,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'all 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)' }}
                >✕</button>
              </div>
            </div>

            {/* ── CONTENT ── */}
            <div style={{ padding: '22px 24px 28px' }}>

              {/* Symbol */}
              <div style={{ fontSize: '30px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '14px' }}>
                {trade.symbol}
              </div>

              {/* Direction + Outcome badges */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {/* LONG / SHORT */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '999px',
                  background: isLong ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${isLong ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: isLong ? '#22c55e' : '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>
                    {isLong ? 'trending_up' : 'trending_down'}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '900', color: isLong ? '#22c55e' : '#ef4444', letterSpacing: '0.06em' }}>
                    {isLong ? (language === 'he' ? 'לונג' : 'LONG') : (language === 'he' ? 'שורט' : 'SHORT')}
                  </span>
                </div>
                {/* WIN / LOSS */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '999px',
                  background: isWin ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${isWin ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                  <span style={{ fontSize: '12px', fontWeight: '900', color: isWin ? '#22c55e' : '#ef4444', letterSpacing: '0.06em' }}>
                    {isWin ? (language === 'he' ? 'WIN ✓' : '✓ WIN') : (language === 'he' ? 'LOSS ✕' : '✕ LOSS')}
                  </span>
                </div>
              </div>

              {/* P&L Banner */}
              <div style={{
                background: isWin
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.04))',
                border: `1px solid ${isWin ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`,
                borderRadius: '16px', padding: '18px 22px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '14px',
              }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: isWin ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                  P&L
                </div>
                <div style={{
                  fontSize: '34px', fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1,
                  color: isWin ? '#22c55e' : '#ef4444',
                  textShadow: isWin ? '0 0 24px rgba(34,197,94,0.35)' : '0 0 24px rgba(239,68,68,0.35)',
                }}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
                </div>
              </div>

              {/* Stats card: Date / Entry / Exit */}
              <div style={{ ...glass, overflow: 'hidden', marginBottom: '14px' }}>
                {/* Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'rgba(208,197,175,0.3)', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>calendar_today</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.dateLabel}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(229,226,225,0.75)' }}>{formattedDate}</span>
                </div>
                {/* Entry price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'rgba(74,127,255,0.4)', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>login</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(74,127,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.entryPriceLabel}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: '#4a7fff' }}>{trade.entry_price}</span>
                </div>
                {/* Exit price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'rgba(208,197,175,0.3)', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>logout</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.exitPrice}</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: trade.exit_price ? 'rgba(229,226,225,0.75)' : 'rgba(208,197,175,0.2)' }}>
                    {trade.exit_price || '—'}
                  </span>
                </div>
              </div>

              {/* RR card */}
              {trade.rr_ratio != null && (
                <div style={{
                  borderRadius: '14px', padding: '16px 20px',
                  background: 'linear-gradient(135deg, rgba(74,127,255,0.07), rgba(139,92,246,0.07))',
                  border: '1px solid rgba(74,127,255,0.14)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '14px',
                }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(74,127,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '3px' }}>Risk / Reward</div>
                    <div style={{ fontSize: '11px', color: 'rgba(208,197,175,0.3)', fontWeight: '600' }}>{tr.rrBased2}</div>
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '900', background: 'linear-gradient(90deg, #4a7fff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    1:{trade.rr_ratio.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Notes */}
              {trade.notes && (
                <div style={{ ...glass, padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'rgba(208,197,175,0.3)', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>notes</span>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(208,197,175,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.notes}</div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(229,226,225,0.6)', lineHeight: 1.65, fontWeight: '500' }}>{trade.notes}</div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fade-up { animation: fadeUp 0.2s ease; }
      `}</style>

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '20px', padding: '28px 28px 24px', width: '90%', maxWidth: '340px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', fontFamily: 'Heebo, sans-serif', animation: 'fadeUp 0.2s ease', position: 'relative', top: 0, left: 0, transform: 'none' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#ef4444', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>delete</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text)', textAlign: 'center', marginBottom: '8px' }}>
              {language === 'he' ? 'מחיקת עסקה' : 'Delete Trade'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', marginBottom: '24px', lineHeight: 1.5 }}>
              {language === 'he' ? `האם אתה בטוח שברצונך למחוק את עסקת ${trade.symbol}? פעולה זו אינה ניתנת לביטול.` : `Are you sure you want to delete the ${trade.symbol} trade? This cannot be undone.`}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '800', cursor: deleting ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? (language === 'he' ? 'מוחק...' : 'Deleting...') : (language === 'he' ? 'מחק' : 'Delete')}
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '700', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
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
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setLightbox(false)}
            style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 501 }}
          >✕</button>
          <img
            src={imageUrl}
            alt="chart"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', cursor: 'default' }}
          />
        </div>
      )}
    </>
  )
}
