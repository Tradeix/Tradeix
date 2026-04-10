'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trade } from '@/types'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'

interface TradeModalProps {
  trade: Trade
  onClose: () => void
  onUpdate: () => void
}

export default function TradeModal({ trade, onClose, onUpdate }: TradeModalProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [form, setForm] = useState({
    symbol: trade.symbol,
    direction: trade.direction,
    entry_price: trade.entry_price?.toString() || '',
    stop_loss: trade.stop_loss?.toString() || '',
    take_profit: trade.take_profit?.toString() || '',
    pnl: trade.pnl?.toString() || '',
    notes: trade.notes || '',
    traded_at: trade.traded_at ? new Date(trade.traded_at).toISOString().split('T')[0] : '',
  })
  const [imageUrl, setImageUrl] = useState<string | null>(trade.image_url || null)
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
      toast.success('התמונה הועלתה ✓')
      onUpdate()
    } catch {
      toast.error('שגיאה בהעלאת התמונה')
    } finally {
      setUploadingImage(false)
    }
  }, [trade.id])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1, maxSize: 10 * 1024 * 1024,
  })

  function calcRR() {
    const e = parseFloat(form.entry_price)
    const s = parseFloat(form.stop_loss)
    const t = parseFloat(form.take_profit)
    if (isNaN(e) || isNaN(s) || isNaN(t) || Math.abs(e - s) === 0) return null
    return (Math.abs(t - e) / Math.abs(e - s)).toFixed(2)
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
        stop_loss: parseFloat(form.stop_loss),
        take_profit: parseFloat(form.take_profit),
        pnl,
        rr_ratio: rr ? parseFloat(rr) : trade.rr_ratio,
        notes: form.notes,
        traded_at: form.traded_at,
        outcome: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
      }).eq('id', trade.id)
      if (error) throw error
      toast.success('העסקה עודכנה ✓')
      setEditing(false)
      onUpdate()
    } catch {
      toast.error('שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const rr = calcRR()

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 300, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: '600px', maxHeight: '90vh',
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', zIndex: 301, overflowY: 'auto',
        animation: 'fadeUp 0.25s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: '700',
              background: trade.direction === 'long' ? '#10b98122' : '#ef444422',
              color: trade.direction === 'long' ? 'var(--green)' : 'var(--red)',
            }}>{trade.direction === 'long' ? 'L' : 'S'}</div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700' }}>{trade.symbol}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                {trade.direction === 'long' ? 'Long' : 'Short'} • {new Date(trade.traded_at).toLocaleDateString('he-IL')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '6px 14px',
                fontSize: '13px', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
              }}>✎ עריכה</button>
            )}
            <button onClick={onClose} style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text2)', cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Image section */}
          <div style={{ marginBottom: '20px' }}>
            {imageUrl ? (
              <div style={{ position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={imageUrl} alt="גרף עסקה" style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', display: 'block', background: '#000' }} />
                <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                  <div {...getRootProps()}>
                    <input {...getInputProps()} />
                    <button style={{ background: '#00000088', backdropFilter: 'blur(4px)', border: '1px solid #ffffff22', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', color: '#fff', cursor: 'pointer', fontFamily: 'Rubik, sans-serif' }}>
                      ✎ החלף תמונה
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div {...getRootProps()} style={{
                border: `2px dashed ${isDragActive ? 'var(--blue)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', padding: '28px', textAlign: 'center',
                cursor: 'pointer', background: isDragActive ? '#4a7fff0a' : 'var(--bg3)', transition: 'all 0.2s',
              }}>
                <input {...getInputProps()} />
                {uploadingImage ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', border: '2px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ fontSize: '13px', color: 'var(--text3)' }}>מעלה תמונה...</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📈</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>העלה תמונת גרף</div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)' }}>גרור לכאן או לחץ לבחירה • PNG, JPG</div>
                  </>
                )}
              </div>
            )}
          </div>

          {editing ? (
            // EDIT MODE
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '14px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>עריכת פרטים</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>סמל</label>
                  <input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>כיוון</label>
                  <select value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value as any }))}>
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                {[{ key: 'entry_price', label: 'Entry' }, { key: 'stop_loss', label: 'Stop Loss' }, { key: 'take_profit', label: 'Take Profit' }].map(({ key, label }) => (
                  <div key={key}>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>{label}</label>
                    <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder="0.0000" />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>P&L ($)</label>
                  <input value={form.pnl} onChange={e => setForm(p => ({ ...p, pnl: e.target.value }))} placeholder="+320" />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>תאריך</label>
                  <input type="date" value={form.traded_at} onChange={e => setForm(p => ({ ...p, traded_at: e.target.value }))} />
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg,#1a3a8f18,#7c3aed18)', border: '1px solid #4a7fff33', borderRadius: 'var(--radius-sm)', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>Risk/Reward מחושב</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: rr ? 'var(--blue)' : 'var(--text3)' }}>{rr ? `1:${rr}` : '—'}</div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block' }}>הערות</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ resize: 'vertical' }} placeholder="מה למדת מהעסקה?" />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,var(--blue),var(--blue2))', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px', fontSize: '14px', fontWeight: '500', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Rubik, sans-serif' }}>
                  {saving ? '⏳ שומר...' : '✓ שמור שינויים'}
                </button>
                <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '11px 16px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Rubik, sans-serif' }}>ביטול</button>
              </div>
            </div>
          ) : (
            // VIEW MODE
            <div>
              <div style={{ background: trade.pnl >= 0 ? '#10b98115' : '#ef444415', border: `1px solid ${trade.pnl >= 0 ? '#10b98133' : '#ef444433'}`, borderRadius: 'var(--radius)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>תוצאה</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: trade.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{trade.pnl >= 0 ? '+' : ''}${trade.pnl}</div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', padding: '6px 16px', borderRadius: '20px', background: trade.outcome === 'win' ? '#10b98122' : '#ef444422', color: trade.outcome === 'win' ? 'var(--green)' : 'var(--red)' }}>
                  {trade.outcome === 'win' ? '✓ WIN' : trade.outcome === 'loss' ? '✕ LOSS' : '— BE'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                {[{ label: 'Entry', value: trade.entry_price }, { label: 'Stop Loss', value: trade.stop_loss }, { label: 'Take Profit', value: trade.take_profit }].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'linear-gradient(135deg,#1a3a8f18,#7c3aed18)', border: '1px solid #4a7fff33', borderRadius: 'var(--radius-sm)', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Risk / Reward</div>
                <div style={{ fontSize: '22px', fontWeight: '700', background: 'linear-gradient(90deg,var(--blue),var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>1:{trade.rr_ratio?.toFixed(2)}</div>
              </div>
              {trade.ai_analysis && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: '500', marginBottom: '6px' }}>✦ ניתוח AI</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>{trade.ai_analysis}</div>
                </div>
              )}
              {trade.notes && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px' }}>הערות</div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>{trade.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
