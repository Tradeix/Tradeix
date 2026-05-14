'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trade, Strategy } from '@/types'
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
  initialEditing?: boolean
}

export default function TradeModal({ trade, onClose, onUpdate, readOnly = false, initialEditing = false }: TradeModalProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(initialEditing)
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
    strategy_id: trade.strategy_id || '',
  })
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [strategiesLoaded, setStrategiesLoaded] = useState(false)
  const [strategyMenuOpen, setStrategyMenuOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(trade.image_url || null)
  const [lightbox, setLightbox] = useState(false)
  const { language, isPro } = useApp()
  const tr = t[language]
  const supabase = createClient()

  // Load strategies only for PRO users.
  useEffect(() => {
    if (!isPro || !trade.portfolio_id) {
      setStrategies([])
      setStrategiesLoaded(true)
      return
    }
    setStrategiesLoaded(false)
    supabase.from('strategies').select('*').eq('portfolio_id', trade.portfolio_id).order('name').then(({ data }) => {
      if (data) setStrategies(data as Strategy[])
      setStrategiesLoaded(true)
    })
  }, [isPro, trade.portfolio_id])

  const currentStrategy = isPro ? strategies.find(s => s.id === (editing ? form.strategy_id : trade.strategy_id)) : undefined
  const selectedStrategyLabel = currentStrategy?.name || (language === 'he' ? 'ללא אסטרטגיה' : 'No strategy')

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
      // RR only on winning trades.
      let rrRatio: number | null = null
      if (form.outcome === 'win' && entryNum && exitNum && slNum) {
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
        strategy_id: isPro ? (form.strategy_id || null) : null,
      }).eq('id', trade.id)
      if (error) throw error
      toast.success(language === 'he' ? 'העסקה עודכנה' : 'Trade updated')
      setEditing(false)
      setStrategyMenuOpen(false)
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {val === 'win' ? 'WIN' : 'LOSS'}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <div onClick={onClose} className="app-modal-overlay" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', animation: 'overlayIn 0.2s ease' }}>

      <div onClick={e => e.stopPropagation()} className="app-modal-card trade-modal-card" style={{
        width: '94%', maxWidth: '620px', maxHeight: '96vh',
        background: 'var(--modal-bg)',
        border: '1px solid var(--border2)',
        borderRadius: '20px', zIndex: 301, overflowY: 'auto',
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
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(15,141,99,0.1)', border: '1px solid rgba(15,141,99,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="edit" size={15} color="#0f8d63" />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>{trade.symbol}</div>
                  <div style={{ fontSize: '11px', color: '#0f8d63', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.editDetails}</div>
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
                  <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? 'rgba(15,141,99,0.5)' : 'var(--border2)'}`, borderRadius: '14px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(15,141,99,0.05)' : 'var(--bg3)', transition: 'all 0.2s' }}>
                    <input {...getInputProps()} />
                    {uploadingImage ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: '#0f8d63', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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

              {isPro && (
              <div style={{ marginBottom: '12px' }}>
                {/* Strategy — selectable when strategies exist, info-only otherwise */}
                <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {language === 'he' ? 'אסטרטגיה' : 'Strategy'}
                </label>
                {strategies.length > 0 ? (
                  <div style={{ position: 'relative', zIndex: strategyMenuOpen ? 60 : 1 }}>
                    <button
                      type="button"
                      onClick={() => setStrategyMenuOpen(v => !v)}
                      style={{
                        width: '100%',
                        minHeight: '50px',
                        borderRadius: '14px',
                        border: strategyMenuOpen ? '1px solid rgba(15,141,99,0.55)' : '1px solid var(--border2)',
                        background: 'var(--modal-bg)',
                        color: 'var(--text)',
                        padding: '0 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        cursor: 'pointer',
                        fontFamily: 'Heebo, sans-serif',
                        fontSize: '14px',
                        fontWeight: 800,
                        boxShadow: strategyMenuOpen ? '0 0 0 3px rgba(15,141,99,0.12), 0 14px 34px rgba(0,0,0,0.28)' : 'none',
                        transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: language === 'he' ? 'right' : 'left' }}>
                        {selectedStrategyLabel}
                      </span>
                      <Icon name={strategyMenuOpen ? 'expand_less' : 'expand_more'} size={18} color="var(--text3)" />
                    </button>

                    {strategyMenuOpen && (
                      <>
                        <div onClick={() => setStrategyMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 58 }} />
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            zIndex: 59,
                            borderRadius: '16px',
                            border: '1px solid rgba(15,141,99,0.32)',
                            background: 'var(--modal-bg)',
                            boxShadow: '0 22px 55px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03) inset',
                            padding: '6px',
                            maxHeight: '240px',
                            overflowY: 'auto',
                          }}
                        >
                          {[{ id: '', name: language === 'he' ? 'ללא אסטרטגיה' : 'No strategy' }, ...strategies].map(strategy => {
                            const active = form.strategy_id === strategy.id
                            return (
                              <button
                                key={strategy.id || 'none'}
                                type="button"
                                onClick={() => {
                                  setForm(p => ({ ...p, strategy_id: strategy.id }))
                                  setStrategyMenuOpen(false)
                                }}
                                style={{
                                  width: '100%',
                                  minHeight: '42px',
                                  borderRadius: '11px',
                                  border: '1px solid transparent',
                                  background: active ? 'rgba(15,141,99,0.14)' : 'transparent',
                                  color: active ? '#0f8d63' : 'var(--text2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: language === 'he' ? 'flex-end' : 'flex-start',
                                  textAlign: language === 'he' ? 'right' : 'left',
                                  padding: '0 12px',
                                  fontFamily: 'Heebo, sans-serif',
                                  fontSize: '14px',
                                  fontWeight: active ? 900 : 700,
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease, color 0.15s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = active ? 'rgba(15,141,99,0.18)' : 'var(--bg3)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(15,141,99,0.14)' : 'transparent' }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{strategy.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                    background: 'var(--bg3)', border: '1px dashed var(--border)',
                    borderRadius: '10px', padding: '10px 14px',
                    color: 'var(--text3)', fontSize: '13px', fontWeight: '500',
                    cursor: 'not-allowed', userSelect: 'none',
                    fontFamily: 'Heebo, sans-serif',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Icon name="info" size={14} color="var(--text3)" />
                      {strategiesLoaded
                        ? (language === 'he' ? 'אין כרגע אסטרטגיות פעילות' : 'No active strategies yet')
                        : (language === 'he' ? 'טוען...' : 'Loading...')}
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: '700',
                      color: 'var(--text3)', background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      padding: '4px 8px', borderRadius: '6px',
                      opacity: 0.6,
                    }}>
                      {language === 'he' ? 'לא זמין' : 'Disabled'}
                    </span>
                  </div>
                )}
              </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {language === 'he' ? 'הערות (אופציונלי)' : 'Notes (optional)'}
                </label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ resize: 'vertical' }} placeholder={language === 'he' ? 'מה למדת מהעסקה?' : 'What did you learn?'} />
              </div>

              <button onClick={handleSave} disabled={saving} style={{ width: '100%', background: 'linear-gradient(135deg, #0f8d63, #0d7755)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '700', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
                <Icon name="check" size={16} color="#fff" strokeWidth={2.5} /> {saving ? tr.saving : tr.save}
              </button>
            </div>
          </>
        ) : (
          /* ── VIEW MODE ── */
          <div>

            {/* ── STICKY HEADER: Symbol + action buttons ── */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 2,
              padding: '10px 14px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg2)', borderRadius: '20px 20px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              {/* Left: symbol + direction */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                  background: trade.direction === 'long' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${trade.direction === 'long' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={trade.direction === 'long' ? 'trending_up' : 'trending_down'} size={15} color={trade.direction === 'long' ? '#22c55e' : '#ef4444'} />
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1 }}>{trade.symbol}</div>
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
                      style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'rgba(15,141,99,0.1)', border: '1px solid rgba(15,141,99,0.2)', color: '#0f8d63', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >
                      <Icon name="delete" size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'all 0.2s' }}
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
                  style={{ width: '100%', height: 'clamp(118px, 25vh, 170px)', objectFit: 'contain', display: 'block', cursor: 'zoom-in', background: '#050506' }}
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px', background: 'linear-gradient(transparent, var(--bg2))', pointerEvents: 'none' }} />
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
              <div {...getRootProps()} style={{ padding: '12px 16px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(15,141,99,0.06)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'all 0.2s' }}>
                <input {...getInputProps()} />
                {uploadingImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '18px', height: '18px', border: '2px solid var(--border)', borderTopColor: '#0f8d63', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
            <div style={{ padding: '12px 14px 14px' }}>

              {/* Hero — outcome + P&L unified, fully centered */}
              <div style={{
                background: isWin ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${isWin ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}`,
                borderRadius: '14px',
                padding: '10px 14px',
                marginBottom: '10px',
                display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Soft radial glow behind the value */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(circle at center, ${isWin ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)'} 0%, transparent 65%)`,
                  pointerEvents: 'none',
                }} />

                {/* Outcome pill */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 12px', borderRadius: '999px',
                  background: isWin ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)',
                  border: `1px solid ${isWin ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                  position: 'relative', zIndex: 1,
                }}>
                  <span style={{ fontSize: '12px', fontWeight: '900', color: isWin ? '#22c55e' : '#ef4444', letterSpacing: '0.1em' }}>
                    {isWin ? 'WIN' : 'LOSS'}
                  </span>
                </div>

                {/* P&L hero number */}
                <div dir="ltr" style={{
                  fontSize: '28px', fontWeight: '900', letterSpacing: '-0.03em',
                  color: isWin ? '#22c55e' : '#ef4444',
                  lineHeight: 1, position: 'relative', zIndex: 1,
                  fontFamily: 'Heebo, sans-serif',
                }}>
                  {isWin ? '+' : '-'}${Math.abs(trade.pnl ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>

                {/* P&L label */}
                <div className="trade-modal-pnl-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', zIndex: 1 }}>
                  <Icon name={isWin ? 'trending_up' : 'trending_down'} size={13} color="var(--text3)" />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    P&L
                  </span>
                </div>
              </div>

              {/* Data grid — compact cards with optional notes. */}
              <div className="trade-modal-data-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* Row 1 — Date | Entry */}
                <div className="trade-modal-data-cell" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'var(--bg2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="calendar_today" size={13} color="var(--text3)" />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'תאריך' : 'Date'}</span>
                  </div>
                  <span dir="ltr" style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)', whiteSpace: 'nowrap' }}>{numericDate}</span>
                </div>
                <div className="trade-modal-data-cell" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'var(--bg2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="login" size={13} color="#0f8d63" />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0f8d63', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'כניסה' : 'Entry'}</span>
                  </div>
                  <span dir="ltr" style={{ fontSize: '16px', fontWeight: '900', color: trade.entry_price != null ? '#0f8d63' : 'var(--text3)' }}>
                    {trade.entry_price ?? '—'}
                  </span>
                </div>

                {/* Row 2 — SL | Exit */}
                <div className="trade-modal-data-cell" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'var(--bg2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="dangerous" size={13} color="#ef4444" />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SL</span>
                  </div>
                  <span dir="ltr" style={{ fontSize: '16px', fontWeight: '900', color: trade.stop_loss != null ? '#ef4444' : 'var(--text3)' }}>
                    {trade.stop_loss ?? '—'}
                  </span>
                </div>
                <div className="trade-modal-data-cell" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'var(--bg2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="logout" size={13} color={isWin ? '#22c55e' : '#ef4444'} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: isWin ? '#22c55e' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{language === 'he' ? 'יציאה' : 'Exit'}</span>
                  </div>
                  <span dir="ltr" style={{ fontSize: '16px', fontWeight: '900', color: trade.exit_price != null ? (isWin ? '#22c55e' : '#ef4444') : 'var(--text3)' }}>
                    {trade.exit_price ?? '—'}
                  </span>
                </div>

                {/* Row 3 — RR (only if win, else skip the row) */}
                {trade.outcome === 'win' && (
                  <div className="trade-modal-data-cell trade-modal-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'var(--bg2)', gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Icon name="analytics" size={13} color="#0f8d63" />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RR</span>
                    </div>
                    <span dir="ltr" style={{ fontSize: '16px', fontWeight: '900', color: trade.rr_ratio != null ? '#22c55e' : 'var(--text3)' }}>
                      {trade.rr_ratio != null ? `1 : ${trade.rr_ratio.toFixed(2)}` : '—'}
                    </span>
                  </div>
                )}

                {/* Strategy (full width row) — PRO only */}
                {isPro && (
                <div className="trade-modal-data-cell trade-modal-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'var(--bg2)', gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Icon name="psychology" size={13} color="var(--text3)" />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {language === 'he' ? 'אסטרטגיה' : 'Strategy'}
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: currentStrategy ? 'var(--text)' : 'var(--text3)' }}>
                    {currentStrategy?.name || (language === 'he' ? 'ללא אסטרטגיה' : 'No strategy')}
                  </span>
                </div>
                )}

                {/* Row 4 — Notes (only when there is content) */}
                {trade.notes && (
                  <div className="trade-modal-data-cell trade-modal-full-row" style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px 10px', background: 'var(--bg2)', gridColumn: 'span 4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Icon name="notes" size={13} color="var(--text3)" />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tr.notes}</span>
                    </div>
                    <div className="trade-modal-notes" style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.35, fontWeight: '500' }}>
                      {trade.notes}
                    </div>
                  </div>
                )}
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
        .trade-modal-card {
          scrollbar-width: thin;
        }
        .trade-modal-data-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
        .trade-modal-data-cell {
          border: 1px solid var(--border) !important;
          border-radius: 12px !important;
          min-height: 64px;
          overflow: hidden;
        }
        .trade-modal-span-2 {
          grid-column: span 2 !important;
        }
        .trade-modal-full-row {
          grid-column: span 4 !important;
        }
        .trade-modal-notes {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media (max-width: 640px) {
          .trade-modal-card {
            width: calc(100vw - 12px) !important;
            max-height: calc(100dvh - 12px) !important;
            border-radius: 16px !important;
          }
          .trade-modal-card img[alt="chart"] {
            height: clamp(82px, 16vh, 128px) !important;
          }
          .trade-modal-data-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }
          .trade-modal-span-2 {
            grid-column: span 2 !important;
          }
          .trade-modal-full-row {
            grid-column: span 2 !important;
          }
          .trade-modal-pnl-label {
            display: none !important;
          }
        }
      `}</style>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="app-modal-overlay app-modal-overlay--top" onClick={() => setConfirmDelete(false)} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={e => e.stopPropagation()} className="app-modal-card" data-tight="1" style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '20px', padding: '28px 28px 24px', width: '90%', maxWidth: '340px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', fontFamily: 'Heebo, sans-serif' }}>
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
          className="app-modal-overlay app-modal-overlay--top2 app-modal-overlay--image"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease', cursor: 'zoom-out' }}
        >
          <button onClick={() => setLightbox(false)} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 501 }}>✕</button>
          <img src={imageUrl} alt="chart" onClick={e => e.stopPropagation()} style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', cursor: 'default' }} />
        </div>
      )}
    </>
  )
}
