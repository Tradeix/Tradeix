'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { usePortfolio } from '@/lib/portfolio-context'
import Link from 'next/link'

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

export default function AddTradePage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const [step, setStep] = useState<Step>(1)
  const [isManual, setIsManual] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [aiConfidence, setAiConfidence] = useState(0)
  const [aiRaw, setAiRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tradeData, setTradeData] = useState<TradeData>({
    symbol: '', direction: 'long',
    entry_price: '', stop_loss: '', take_profit: '',
    pnl: '', traded_at: new Date().toISOString().split('T')[0], notes: '',
  })
  const router = useRouter()
  const { language } = useApp()
  const tr = t[language]
  const supabase = createClient()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
    runAiAnalysis(file)
  }, [])

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
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/analyze-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: file.type }),
      })
      if (!res.ok) throw new Error()
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
      toast.error(language === 'he' ? 'שגיאה בניתוח — מלא ידנית' : 'Analysis failed — fill manually')
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
    const tp = parseFloat(tradeData.take_profit)
    if (isNaN(e) || isNaN(s) || isNaN(tp) || Math.abs(e - s) === 0) return null
    return (Math.abs(tp - e) / Math.abs(e - s)).toFixed(2)
  }

  async function handleSubmit() {
    if (!tradeData.symbol || !tradeData.entry_price || !tradeData.stop_loss || !tradeData.take_profit) {
      toast.error(language === 'he' ? 'נא למלא את כל השדות' : 'Please fill all fields')
      return
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('לא מחובר')
      const savedId = localStorage.getItem('tradeix-active-portfolio')
      let portfolioId = savedId
      if (!portfolioId) {
        const { data: portfolios } = await supabase.from('portfolios').select('id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
        if (!portfolios || portfolios.length === 0) {
          toast.error(language === 'he' ? 'אין תיק — צור תיק קודם' : 'No portfolio found')
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
        portfolio_id: portfolioId, user_id: user.id,
        symbol: tradeData.symbol.toUpperCase(), direction: tradeData.direction,
        entry_price: parseFloat(tradeData.entry_price),
        stop_loss: parseFloat(tradeData.stop_loss),
        take_profit: parseFloat(tradeData.take_profit),
        pnl, rr_ratio: rr ? parseFloat(rr) : 0,
        image_url: imageUrl, ai_analysis: isManual ? null : aiRaw,
        notes: tradeData.notes, traded_at: tradeData.traded_at,
        outcome: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
      })
      if (error) throw error
      toast.success(language === 'he' ? 'העסקה הועלתה! ✓' : 'Trade added! ✓')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || (language === 'he' ? 'שגיאה' : 'Error'))
    } finally {
      setSubmitting(false)
    }
  }

  const rr = calcRR()

  // No portfolio state
  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div>
        <PageHeader
          title={language === 'he' ? 'הוספת עסקה חדשה' : 'Add New Trade'}
          subtitle={language === 'he' ? 'תעד ונתח את העסקאות שלך' : 'Record and analyze your trades'}
          icon="add_circle"
        />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>📁</div>
          <div style={{ fontSize: '20px', fontWeight: '900', marginBottom: '10px', color: 'var(--text)' }}>
            {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px' }}>
            {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
          </div>
          <Link href="/portfolios" style={{ background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', padding: '12px 28px', borderRadius: '12px', textDecoration: 'none', fontSize: '13px', fontWeight: '700', boxShadow: '0 0 24px rgba(74,127,255,0.4)' }}>
            {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={language === 'he' ? 'הוספת עסקה חדשה' : 'Add New Trade'}
        subtitle={language === 'he' ? 'תעד ונתח את העסקאות שלך' : 'Record and analyze your trades'}
        icon="add_circle"
      />

      <div style={{ maxWidth: '620px', margin: '0 auto' }}>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="fade-up">
            <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '52px 24px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? '#4a7fff0a' : 'var(--bg3)', transition: 'all 0.3s', marginBottom: '16px' }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: '44px', marginBottom: '14px' }}>📈</div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
                {isDragActive ? (language === 'he' ? 'שחרר כאן...' : 'Drop here...') : tr.uploadChart}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7, marginBottom: '16px' }}>
                {language === 'he' ? 'גרור תמונת גרף לכאן, או לחץ לבחירת קובץ' : 'Drag a chart image here, or click to choose'}
              </div>
              <span className="btn-primary" style={{ padding: '10px 24px', fontSize: '13px' }}>
                {language === 'he' ? 'בחר קובץ' : 'Choose File'}
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '12px' }}>PNG, JPG, WEBP {language === 'he' ? 'עד' : 'up to'} 10MB</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{language === 'he' ? 'או' : 'or'}</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <button onClick={skipToManual} className="btn-ghost" style={{ width: '100%' }}>
              {language === 'he' ? 'הוספה ידנית ←' : 'Manual Entry →'}
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="fade-up">
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {imagePreview && (
                <img src={imagePreview} alt="גרף" style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', display: 'block', background: '#000' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', border: '3px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '500' }}>{language === 'he' ? 'מזהה נתונים...' : 'Analyzing...'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{language === 'he' ? 'ניתוח AI • אנא המתן' : 'AI Analysis • Please wait'}</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="fade-up">
            {!isManual && imagePreview && tradeData.symbol && (
              <div style={{ background: 'linear-gradient(135deg, #1a3a8f22, #7c3aed22)', border: '1px solid #4a7fff44', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0, background: 'linear-gradient(135deg, var(--blue), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>✦</div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: '500', marginBottom: '4px' }}>{language === 'he' ? 'ניתוח AI הושלם' : 'AI Analysis Complete'}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                    {tradeData.symbol} • {tradeData.direction === 'long' ? (language === 'he' ? 'לונג' : 'Long') : (language === 'he' ? 'שורט' : 'Short')} • {language === 'he' ? 'כניסה' : 'Entry'}: {tradeData.entry_price}
                  </div>
                  {aiConfidence > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                      {language === 'he' ? 'ביטחון' : 'Confidence'}: {aiConfidence}%
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isManual && imagePreview && tradeData.symbol && (
              <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '16px' }}>
                <img src={imagePreview} alt="גרף" style={{ width: '100%', maxHeight: '160px', objectFit: 'contain', display: 'block', background: '#000' }} />
              </div>
            )}

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{tr.tradeDetails}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{isManual ? tr.manualMode : tr.editableMode}</div>
              </div>
              <div style={{ padding: '20px' }}>
                {/* Image upload */}
                <div style={{ marginBottom: '20px' }}>
                  {imagePreview ? (
                    <div style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={imagePreview} alt="גרף" style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block', background: '#000' }} />
                      <button onClick={() => { setImageFile(null); setImagePreview(null) }} style={{ position: 'absolute', top: '8px', left: '8px', background: '#00000088', border: '1px solid #ffffff22', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                        {language === 'he' ? '✕ הסר' : '✕ Remove'}
                      </button>
                    </div>
                  ) : (
                    <div {...getManualRootProps()} style={{ border: `2px dashed ${isManualDragActive ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: isManualDragActive ? '#4a7fff0a' : 'var(--bg3)', transition: 'all 0.2s' }}>
                      <input {...getManualInputProps()} />
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>📷</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px', color: 'var(--text)' }}>{language === 'he' ? 'העלה תמונת גרף' : 'Upload Chart Image'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{language === 'he' ? 'אופציונלי' : 'Optional'} • PNG, JPG {language === 'he' ? 'עד' : 'up to'} 10MB</div>
                    </div>
                  )}
                </div>

                {/* Symbol + Direction */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>{tr.symbolPair}</label>
                    <input value={tradeData.symbol} onChange={e => setTradeData(p => ({ ...p, symbol: e.target.value }))} placeholder="EUR/USD, GOLD, BTC..." />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>{tr.direction}</label>
                    <select value={tradeData.direction} onChange={e => setTradeData(p => ({ ...p, direction: e.target.value as any }))}>
                      <option value="long">{tr.long}</option>
                      <option value="short">{tr.short}</option>
                    </select>
                  </div>
                </div>

                {/* Date + PnL */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>{tr.date}</label>
                    <input type="date" value={tradeData.traded_at} onChange={e => setTradeData(p => ({ ...p, traded_at: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>{tr.pnl}</label>
                    <input value={tradeData.pnl} onChange={e => setTradeData(p => ({ ...p, pnl: e.target.value }))} placeholder="+320 / -150" />
                  </div>
                </div>

                {/* Entry, SL, TP */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '4px' }}>
                  {[{ key: 'entry_price', label: tr.entryPrice }, { key: 'stop_loss', label: tr.stopLoss }, { key: 'take_profit', label: tr.takeProfit }].map(({ key, label }) => (
                    <div key={key}>
                      <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>{label}</label>
                      <input value={(tradeData as any)[key]} onChange={e => setTradeData(p => ({ ...p, [key]: e.target.value }))} placeholder="0.00" />
                    </div>
                  ))}
                </div>

                {/* RR */}
                <div style={{ background: 'linear-gradient(135deg, #1a3a8f18, #7c3aed18)', border: '1px solid #4a7fff33', borderRadius: 'var(--radius-sm)', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{tr.rrAuto}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{tr.rrBased}</div>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '700', background: rr ? 'linear-gradient(90deg, var(--blue), var(--purple))' : undefined, WebkitBackgroundClip: rr ? 'text' : undefined, WebkitTextFillColor: rr ? 'transparent' : undefined, color: rr ? undefined : 'var(--text3)' }}>
                    {rr ? `1:${rr}` : '—'}
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '500' }}>{tr.notes}</label>
                  <textarea value={tradeData.notes} onChange={e => setTradeData(p => ({ ...p, notes: e.target.value }))} placeholder={tr.notesPlaceholder} rows={3} style={{ resize: 'vertical' }} />
                </div>

                <button onClick={handleSubmit} disabled={submitting} className="btn-primary" style={{ width: '100%', opacity: submitting ? 0.7 : 1, cursor: submitting ? 'wait' : 'pointer' }}>
                  {submitting ? tr.submitting : tr.submitTrade}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}