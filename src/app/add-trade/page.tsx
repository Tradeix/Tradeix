'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { useApp } from '@/lib/app-context'
import { t } from '@/lib/translations'
import { usePortfolio } from '@/lib/portfolio-context'


type Step = 1 | 2 | 3

interface TradeData {
  symbol: string
  direction: 'long' | 'short'
  outcome: 'win' | 'loss'
  entry_price: string
  exit_price: string
  stop_loss: string
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
  const [pnlError, setPnlError] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [aiMissingFields, setAiMissingFields] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [tradeData, setTradeData] = useState<TradeData>({
    symbol: '', direction: 'long', outcome: 'win',
    entry_price: '', exit_price: '', stop_loss: '',
    pnl: '', traded_at: new Date().toISOString().split('T')[0], notes: '',
  })
  const router = useRouter()
  const { language, isPro, subscriptionLoading } = useApp()
  const tr = t[language]
  const supabase = createClient()

  // Free users → manual form only, no steps
  useEffect(() => {
    if (!subscriptionLoading && !isPro) {
      setIsManual(true)
      setStep(3)
    }
  }, [subscriptionLoading, isPro])

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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      if (data.error) throw new Error(data.error)
      // Detect which fields the AI couldn't identify
      const missing: string[] = []
      if (!data.symbol) missing.push(language === 'he' ? 'שם הצמד' : 'Symbol')
      if (data.entry_price == null) missing.push(language === 'he' ? 'מחיר כניסה' : 'Entry price')
      setAiMissingFields(missing)

      // Auto-detect outcome from direction + entry/exit prices
      let detectedOutcome: 'win' | 'loss' | undefined
      if (data.direction && data.entry_price != null && data.exit_price != null) {
        const isLong = data.direction === 'long'
        const priceWentUp = data.exit_price > data.entry_price
        detectedOutcome = (isLong ? priceWentUp : !priceWentUp) ? 'win' : 'loss'
      }

      setTradeData(prev => ({
        ...prev,
        symbol: data.symbol || '',
        direction: data.direction === 'short' ? 'short' : 'long',
        entry_price: data.entry_price?.toString() || '',
        exit_price: data.exit_price?.toString() || '',
        stop_loss: data.stop_loss?.toString() || '',
        ...(detectedOutcome ? { outcome: detectedOutcome } : {}),
      }))
      setAiConfidence(data.confidence || 85)
      setAiRaw(data.analysis || '')
      setStep(3)
    } catch (err: any) {
      const msg = err.message || ''
      const isKeyMissing = msg.includes('API key') || msg.includes('authentication') || msg.includes('401')
      toast.error(
        language === 'he'
          ? isKeyMissing ? 'מפתח API חסר — מלא ידנית' : 'שגיאה בניתוח — מלא ידנית'
          : isKeyMissing ? 'API key missing — fill manually' : 'Analysis failed — fill manually'
      )
      // Keep image and go to step 3 so user can fill manually with the image visible
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

  async function handleSubmit() {
    const missingPnl = !tradeData.pnl || tradeData.pnl.trim() === ''
    if (missingPnl) setPnlError(true)
    if (!tradeData.symbol || missingPnl) {
      toast.error(language === 'he' ? 'נא למלא שם צמד ו-P&L' : 'Please fill symbol and P&L')
      return
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('לא מחובר')

      // Free tier: max 20 trades
      if (!isPro) {
        const { count } = await supabase.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        if ((count ?? 0) >= 20) {
          toast.error(language === 'he' ? 'הגעת למגבלת 20 עסקאות — שדרג ל PRO' : 'Reached 20 trade limit — upgrade to PRO')
          router.push('/upgrade')
          setSubmitting(false)
          return
        }
      }

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
      const pnlAbs = Math.abs(parseFloat(tradeData.pnl) || 0)
      const pnl = tradeData.outcome === 'loss' ? -pnlAbs : pnlAbs
      const entryNum = tradeData.entry_price ? parseFloat(tradeData.entry_price) : null
      const exitNum = tradeData.exit_price ? parseFloat(tradeData.exit_price) : null
      const slNum = tradeData.stop_loss ? parseFloat(tradeData.stop_loss) : null
      let rrRatio: number | null = null
      if (entryNum && exitNum && slNum) {
        const reward = tradeData.direction === 'long' ? exitNum - entryNum : entryNum - exitNum
        const risk = tradeData.direction === 'long' ? entryNum - slNum : slNum - entryNum
        if (risk > 0) rrRatio = parseFloat((reward / risk).toFixed(2))
      }
      const { error } = await supabase.from('trades').insert({
        portfolio_id: portfolioId, user_id: user.id,
        symbol: tradeData.symbol.toUpperCase(),
        direction: tradeData.direction,
        entry_price: entryNum,
        exit_price: exitNum,
        stop_loss: slNum,
        pnl,
        rr_ratio: rrRatio,
        image_url: imageUrl, ai_analysis: isManual ? null : aiRaw,
        notes: tradeData.notes, traded_at: tradeData.traded_at,
        outcome: tradeData.outcome,
      })
      if (error) throw error
      toast.success(language === 'he' ? 'העסקה הועלתה!' : 'Trade added!')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || (language === 'he' ? 'שגיאה' : 'Error'))
    } finally {
      setSubmitting(false)
    }
  }

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
          <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: 'linear-gradient(135deg, #4a7fff, #3366dd)', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 0 24px rgba(74,127,255,0.4)', fontFamily: 'Heebo, sans-serif' }}>
            {language === 'he' ? '+ צור תיק חדש' : '+ Create Portfolio'}
          </button>
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

        {/* STEP 1 — PRO only */}
        {isPro && step === 1 && (
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

        {/* STEP 2 — PRO only */}
        {isPro && step === 2 && (
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
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: '500', marginBottom: '4px' }}>{language === 'he' ? 'ניתוח AI הושלם' : 'AI Analysis Complete'}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                    {tradeData.symbol} {tradeData.entry_price ? `• ${language === 'he' ? 'כניסה' : 'Entry'}: ${tradeData.entry_price}` : ''}
                  </div>
                  {aiConfidence > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                      {language === 'he' ? 'ביטחון' : 'Confidence'}: {aiConfidence}%
                    </div>
                  )}
                </div>
                {/* PNL — bold, updates as user types */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>P&L</div>
                  <div dir="ltr" style={{
                    fontSize: '22px', fontWeight: '900',
                    color: tradeData.pnl ? (tradeData.outcome === 'win' ? '#10b981' : '#ef4444') : 'var(--text3)',
                  }}>
                    {tradeData.pnl
                      ? `${tradeData.outcome === 'win' ? '+' : '-'}$${Math.abs(parseFloat(tradeData.pnl) || 0)}`
                      : '—'}
                  </div>
                </div>
              </div>
            )}

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{tr.tradeDetails}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{isManual ? tr.manualMode : tr.editableMode}</div>
              </div>
              <div style={{ padding: '20px' }}>
                {/* Missing fields warning */}
                {aiMissingFields.length > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b', flexShrink: 0, fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>warning</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b', marginBottom: '3px' }}>
                        {language === 'he' ? 'ה-AI לא הצליח לזהות:' : 'AI could not identify:'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: '600' }}>
                        {aiMissingFields.join(' • ')} — {language === 'he' ? 'נא למלא ידנית' : 'please fill manually'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Image upload */}
                <div style={{ marginBottom: '20px' }}>
                  {imagePreview ? (
                    <div style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img
                        src={imagePreview} alt="גרף"
                        onClick={() => setLightbox(true)}
                        style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block', background: '#000', cursor: 'zoom-in' }}
                      />
                      {/* Zoom hint */}
                      <div onClick={() => setLightbox(true)} style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '4px 8px', cursor: 'zoom-in', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' -25, 'opsz' 20" }}>zoom_in</span>
                      </div>
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

                {/* Symbol + Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'שם הצמד' : 'Symbol'} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input value={tradeData.symbol} onChange={e => setTradeData(p => ({ ...p, symbol: e.target.value }))} placeholder="EUR/USD, GOLD, BTC..." />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'תאריך' : 'Date'}
                    </label>
                    <input type="date" value={tradeData.traded_at} onChange={e => setTradeData(p => ({ ...p, traded_at: e.target.value }))} />
                  </div>
                </div>

                {/* WIN / LOSS + LONG / SHORT toggles side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  {/* Outcome */}
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'תוצאה' : 'Outcome'} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {(['win', 'loss'] as const).map(val => {
                        const active = tradeData.outcome === val
                        const color = val === 'win' ? '#22c55e' : '#ef4444'
                        const bg = val === 'win' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
                        const border = val === 'win' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'
                        return (
                          <button key={val} type="button" onClick={() => setTradeData(p => ({ ...p, outcome: val }))} style={{ padding: '11px 6px', borderRadius: '10px', background: active ? bg : 'var(--bg3)', border: `2px solid ${active ? border : 'var(--border)'}`, color: active ? color : 'var(--text3)', fontSize: '13px', fontWeight: '900', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', letterSpacing: '0.05em', transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            <span>{val === 'win' ? '✓' : '✕'}</span>
                            {val === 'win' ? 'WIN' : 'LOSS'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Direction */}
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'כיוון' : 'Direction'} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {(['long', 'short'] as const).map(val => {
                        const active = tradeData.direction === val
                        const color = val === 'long' ? '#22c55e' : '#ef4444'
                        const bg = val === 'long' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
                        const border = val === 'long' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'
                        const icon = val === 'long' ? 'trending_up' : 'trending_down'
                        return (
                          <button key={val} type="button" onClick={() => setTradeData(p => ({ ...p, direction: val }))} style={{ padding: '11px 6px', borderRadius: '10px', background: active ? bg : 'var(--bg3)', border: `2px solid ${active ? border : 'var(--border)'}`, color: active ? color : 'var(--text3)', fontSize: '13px', fontWeight: '900', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', letterSpacing: '0.05em', transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'inherit', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>{icon}</span>
                            {val === 'long' ? 'LONG' : 'SHORT'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Entry + SL + Exit */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'כניסה' : 'Entry'}
                    </label>
                    <input value={tradeData.entry_price} onChange={e => setTradeData(p => ({ ...p, entry_price: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: '600', color: 'rgba(239,68,68,0.7)' }}>
                      SL
                    </label>
                    <input
                      value={tradeData.stop_loss}
                      onChange={e => setTradeData(p => ({ ...p, stop_loss: e.target.value }))}
                      placeholder="0.00"
                      style={tradeData.stop_loss ? { borderColor: 'rgba(239,68,68,0.35)' } : {}}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: '600', color: tradeData.outcome === 'loss' ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)' }}>
                      {language === 'he' ? 'יציאה' : 'Exit'}
                    </label>
                    <input
                      value={tradeData.exit_price}
                      onChange={e => setTradeData(p => ({ ...p, exit_price: e.target.value }))}
                      placeholder="0.00"
                      style={tradeData.exit_price ? { borderColor: tradeData.outcome === 'loss' ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)' } : {}}
                    />
                  </div>
                </div>

                {/* P&L */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', color: pnlError ? '#ef4444' : tradeData.outcome === 'win' ? '#22c55e' : '#ef4444', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                    P&L ($) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tradeData.pnl}
                      onChange={e => { setTradeData(p => ({ ...p, pnl: e.target.value })); if (e.target.value.trim()) setPnlError(false) }}
                      placeholder="500"
                      style={pnlError
                        ? { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' }
                        : tradeData.outcome === 'win'
                          ? { borderColor: 'rgba(34,197,94,0.4)', boxShadow: '0 0 0 3px rgba(34,197,94,0.08)' }
                          : { borderColor: 'rgba(239,68,68,0.4)', boxShadow: '0 0 0 3px rgba(239,68,68,0.08)' }
                      }
                    />
                  {pnlError && (
                    <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 20" }}>error</span>
                      {language === 'he' ? 'שדה חובה' : 'Required field'}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                    {language === 'he' ? 'הערות (אופציונלי)' : 'Notes (optional)'}
                  </label>
                  <textarea value={tradeData.notes} onChange={e => setTradeData(p => ({ ...p, notes: e.target.value }))} placeholder={tr.notesPlaceholder} rows={3} style={{ resize: 'vertical' }} />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-primary"
                  style={{ width: '100%', opacity: submitting ? 0.7 : 1, cursor: submitting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', direction: 'ltr' }}
                >
                  <span style={{ fontSize: '16px' }}>✓</span>
                  {submitting ? tr.submitting : (language === 'he' ? 'העלאת עסקה' : 'Submit Trade')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.6; cursor: pointer; }
      `}</style>

      {/* Image lightbox */}
      {lightbox && imagePreview && (
        <div
          onClick={() => setLightbox(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease', cursor: 'zoom-out' }}
        >
          <button onClick={() => setLightbox(false)} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 501 }}>✕</button>
          <img src={imagePreview} alt="גרף" onClick={e => e.stopPropagation()} style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', cursor: 'default' }} />
        </div>
      )}
    </div>
  )
}