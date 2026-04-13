'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'

type Step = 1 | 2 | 3

interface TradeData {
  symbol: string
  direction: 'long' | 'short'
  entry_price: string
  stop_loss: string
  take_profit: string
  pnl: string
  traded_at: string
  notes: string
}

const AI_MESSAGES = [
  'מזהה ציר מחירים...',
  'מאתר נקודת כניסה...',
  language === 'he' ? 'מחשב סטופ לוס וטייק פרופיט...' : 'Calculating Stop Loss and Take Profit...',
  'מנתח כיוון המסחר...',
  'מחשב Risk/Reward...',
  'מסיים ניתוח...',
]

export default function AddTradePage() {
  const [step, setStep] = useState<Step>(1)
  const [isManual, setIsManual] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [aiMessage, setAiMessage] = useState(AI_MESSAGES[0])
  const [aiConfidence, setAiConfidence] = useState(0)
  const [aiRaw, setAiRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tradeData, setTradeData] = useState<TradeData>({
    symbol: '', direction: 'long',
    entry_price: '', stop_loss: '', take_profit: '',
    pnl: '', traded_at: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const router = useRouter()
  const { language } = useApp()
  const tr = t[language]
  const supabase = createClient()

  // Dropzone for AI analysis
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
    runAiAnalysis(file)
  }, [])

  // Dropzone for manual (no AI)
  const onDropManual = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1, maxSize: 10 * 1024 * 1024,
  })

  const { getRootProps: getManualRootProps, getInputProps: getManualInputProps, isDragActive: isManualDragActive } = useDropzone({
    onDrop: onDropManual, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1, maxSize: 10 * 1024 * 1024,
  })

  async function runAiAnalysis(file: File) {
    setStep(2)
    let i = 0
    const interval = setInterval(() => {
      if (i < AI_MESSAGES.length - 1) setAiMessage(AI_MESSAGES[++i])
      else clearInterval(interval)
    }, 700)

    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/analyze-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: file.type }),
      })
      clearInterval(interval)
      if (!res.ok) throw new Error('ניתוח נכשל')
      const data = await res.json()
      setTradeData(prev => ({
        ...prev,
        symbol: data.symbol || '',
        direction: data.direction || 'long',
        entry_price: data.entry_price?.toString() || '',
        stop_loss: data.stop_loss?.toString() || '',
        take_profit: data.take_profit?.toString() || '',
      }))
      setAiConfidence(data.confidence || 85)
      setAiRaw(data.analysis || '')
      setStep(3)
    } catch {
      clearInterval(interval)
      toast.error('שגיאה בניתוח התמונה — נסה שוב או מלא ידנית')
      setImageFile(null)
      setImagePreview(null)
      setStep(3)
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function skipToManual() {
    setIsManual(true)
    setStep(3)
  }

  function calcRR() {
    const e = parseFloat(tradeData.entry_price)
    const s = parseFloat(tradeData.stop_loss)
    const t = parseFloat(tradeData.take_profit)
    if (isNaN(e) || isNaN(s) || isNaN(t) || Math.abs(e - s) === 0) return null
    return (Math.abs(t - e) / Math.abs(e - s)).toFixed(2)
  }

  async function handleSubmit() {
    if (!tradeData.symbol || !tradeData.entry_price || !tradeData.stop_loss || !tradeData.take_profit) {
      toast.error('נא למלא את כל השדות הנדרשים')
      return
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('לא מחובר')

      const savedId = localStorage.getItem('tradeix-active-portfolio')
      let portfolioId = savedId

      if (!portfolioId) {
        const { data: portfolios } = await supabase
          .from('portfolios').select('id').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(1)
        if (!portfolios || portfolios.length === 0) {
          toast.error('אין תיק פתוח — צור תיק קודם')
          router.push('/portfolios')
          return
        }
        portfolioId = portfolios[0].id
      }

      let imageUrl = null
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('trade-images').upload(path, imageFile)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('trade-images').getPublicUrl(path)
          imageUrl = urlData.publicUrl
        }
      }

      const rr = calcRR()
      const pnl = parseFloat(tradeData.pnl) || 0

      const { error } = await supabase.from('trades').insert({
        portfolio_id: portfolioId,
        user_id: user.id,
        symbol: tradeData.symbol.toUpperCase(),
        direction: tradeData.direction,
        entry_price: parseFloat(tradeData.entry_price),
        stop_loss: parseFloat(tradeData.stop_loss),
        take_profit: parseFloat(tradeData.take_profit),
        pnl,
        rr_ratio: rr ? parseFloat(rr) : 0,
        image_url: imageUrl,
        ai_analysis: isManual ? null : aiRaw,
        notes: tradeData.notes,
        traded_at: tradeData.traded_at,
        outcome: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
      })

      if (error) throw error
      toast.success('העסקה הועלתה בהצלחה! ✓')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעלאת העסקה')
    } finally {
      setSubmitting(false)
    }
  }

  const rr = calcRR()

  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
      {[1, 2, 3].map((n, idx) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', flex: idx < 2 ? '1' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: '600', flexShrink: 0,
              border: `1.5px solid ${step > n ? 'var(--green)' : step === n ? 'var(--blue)' : 'var(--border)'}`,
              background: step > n ? 'var(--green)' : step === n ? 'var(--blue)' : 'var(--bg2)',
              color: step >= n ? '#fff' : 'var(--text3)',
              transition: 'all 0.3s',
            }}>
              {step > n ? '✓' : n}
            </div>
            <span style={{ fontSize: '12px', color: step === n ? 'var(--text)' : 'var(--text3)', fontWeight: step === n ? '500' : '400' }}>
              {n === 1 ? (language === 'he' ? 'העלאת גרף' : 'Upload Chart') : n === 2 ? (language === 'he' ? 'ניתוח AI' : 'AI Analysis') : (language === 'he' ? 'פרטי עסקה' : 'Trade Details')}
            </span>
          </div>
          {idx < 2 && (
            <div style={{ flex: 1, height: '1px', margin: '0 8px', background: step > n ? 'var(--green)' : 'var(--border)', transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <PageHeader
        title={language === 'he' ? 'הוספת עסקה חדשה' : 'Add New Trade'}
        subtitle={language === 'he' ? 'תעד ונתח את העסקאות שלך' : 'Record and analyze your trades'}
        icon="add_circle"
      />
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>

        {!isManual && <StepIndicator />}

        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <div className="fade-up">
            <div {...getRootProps()} style={{
              border: `2px dashed ${isDragActive ? 'var(--blue)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', padding: '52px 24px', textAlign: 'center',
              cursor: 'pointer', background: isDragActive ? '#4a7fff0a' : 'var(--bg3)',
              transition: 'all 0.3s', marginBottom: '16px',
            }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: '44px', marginBottom: '14px' }}>📈</div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>
                {isDragActive ? 'שחרר כאן...' : tr.uploadChart}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7, marginBottom: '16px' }}>
                גרור תמונת גרף לכאן, או לחץ לבחירת קובץ<br />
                <span style={{ color: 'var(--text3)', fontSize: '12px' }}>הגרף חייב לכלול ציר מחירים + נקודת כניסה + SL + TP</span>
              </div>
              <span className="btn-primary" style={{ background: 'linear-gradient(135deg, var(--blue), var(--blue2))', color: '#fff', padding: '10px 24px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: '500', boxShadow: '0 0 20px var(--blueglow)' }}>
                בחר קובץ
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '12px' }}>PNG, JPG, WEBP עד 10MB</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>או</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <button onClick={skipToManual} className="btn-ghost" style={{ width: '100%' }}>הוספה ידנית ←</button>
          </div>
        )}

        {/* STEP 2: ANALYZING */}
        {step === 2 && (
          <div className="fade-up">
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {imagePreview && (
                <div style={{ position: 'relative' }}>
                  <img src={imagePreview} alt="גרף" style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', display: 'block', background: '#000' }} />
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#00000088', backdropFilter: 'blur(4px)', border: '1px solid var(--border2)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: 'var(--text2)' }}>
                    {imageFile?.name}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', border: '3px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '500' }}>{aiMessage}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>ניתוח AI • אנא המתן</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: TRADE DETAILS */}
        {step === 3 && (
          <div className="fade-up">
            {/* AI banner — only when AI found data */}
            {!isManual && imagePreview && tradeData.symbol && (
              <div style={{ background: 'linear-gradient(135deg, #1a3a8f22, #7c3aed22)', border: '1px solid #4a7fff44', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0, background: 'linear-gradient(135deg, var(--blue), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 0 16px var(--blueglow)' }}>✦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: '500', marginBottom: '4px' }}>ניתוח AI הושלם</div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                    זוהה: {tradeData.symbol} • {tradeData.direction === 'long' ? (language === 'he' ? 'לונג' : 'Long') : (language === 'he' ? 'שורט' : 'Short')} • כניסה: {tradeData.entry_price} • SL: {tradeData.stop_loss} • TP: {tradeData.take_profit}
                  </div>
                  {aiConfidence > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '11px', color: 'var(--text3)' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)' }} />
                      רמת ביטחון: {aiConfidence}% • ניתן לערוך
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI image preview — only when AI found data */}
            {!isManual && imagePreview && tradeData.symbol && (
              <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '16px' }}>
                <img src={imagePreview} alt="גרף" style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', display: 'block', background: '#000' }} />
              </div>
            )}

            {/* Trade form */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>פרטי עסקה</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{isManual ? tr.manualMode : language === 'he' ? tr.editableMode : 'All fields editable'}</div>
              </div>
              <div style={{ padding: '20px' }}>

                {/* Image upload inside form — always shown */}
                <div style={{ marginBottom: '20px' }}>
                  {imagePreview ? (
                    <div style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={imagePreview} alt="גרף" style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block', background: '#000' }} />
                      <button onClick={() => { setImageFile(null); setImagePreview(null) }} style={{ position: 'absolute', top: '8px', left: '8px', background: '#00000088', border: '1px solid #ffffff22', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: '#fff', cursor: 'pointer', fontFamily: 'Rubik, sans-serif' }}>
                        ✕ הסר
                      </button>
                    </div>
                  ) : (
                    <div {...getManualRootProps()} style={{ border: `2px dashed ${isManualDragActive ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: isManualDragActive ? '#4a7fff0a' : 'var(--bg3)', transition: 'all 0.2s' }}>
                      <input {...getManualInputProps()} />
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>📷</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>העלה תמונת גרף</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>אופציונלי • PNG, JPG עד 10MB</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>סמל / זוג *</label>
                    <input value={tradeData.symbol} onChange={e => setTradeData(p => ({ ...p, symbol: e.target.value }))} placeholder="EUR/USD, GOLD, BTC..." />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>כיוון *</label>
                    <select value={tradeData.direction} onChange={e => setTradeData(p => ({ ...p, direction: e.target.value as any }))}>
                      <option value="long">{tr.long}</option>
                      <option value="short">{tr.short}</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>תאריך</label>
                    <input type="date" value={tradeData.traded_at} onChange={e => setTradeData(p => ({ ...p, traded_at: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>P&L ($)</label>
                    <input value={tradeData.pnl} onChange={e => setTradeData(p => ({ ...p, pnl: e.target.value }))} placeholder="+320 או -150" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '4px' }}>
                  {[{ key: 'entry_price', label: tr.entryPrice }, { key: 'stop_loss', label: tr.stopLoss }, { key: 'take_profit', label: tr.takeProfit }].map(({ key, label }) => (
                    <div key={key}>
                      <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>{label}</label>
                      <input value={(tradeData as any)[key]} onChange={e => setTradeData(p => ({ ...p, [key]: e.target.value }))} placeholder="0.00000" />
                    </div>
                  ))}
                </div>

                <div style={{ background: 'linear-gradient(135deg, #1a3a8f18, #7c3aed18)', border: '1px solid #4a7fff33', borderRadius: 'var(--radius-sm)', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)' }}>יחס סיכון/תשואה מחושב אוטומטית</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>מחושב לפי כניסה / סטופ / טייק</div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '700', background: rr ? 'linear-gradient(90deg, var(--blue), var(--purple))' : undefined, WebkitBackgroundClip: rr ? 'text' : undefined, WebkitTextFillColor: rr ? 'transparent' : undefined, color: rr ? undefined : 'var(--text3)' }}>
                    {rr ? `1:${rr}` : '—'}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>הערות (אופציונלי)</label>
                  <textarea value={tradeData.notes} onChange={e => setTradeData(p => ({ ...p, notes: e.target.value }))} placeholder={tr.notesPlaceholder} rows={3} style={{ resize: 'vertical' }} />
                </div>

                <button onClick={handleSubmit} disabled={submitting} className="btn-primary" style={{ width: '100%', opacity: submitting ? 0.7 : 1, cursor: submitting ? 'wait' : 'pointer' }}>
                  {submitting ? submitting ? tr.submitting : tr.submitTrade}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
