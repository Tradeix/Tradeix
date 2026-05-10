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
import { Strategy, Trade } from '@/types'
import Icon from '@/components/Icon'
import TradeModal from '@/components/TradeModal'


type Step = 1 | 2 | 3

interface TradeData {
  symbol: string
  direction: 'long' | 'short'
  outcome: 'win' | 'loss'
  entry_price: string
  exit_price: string
  stop_loss: string
  take_profit: string
  pnl: string
  traded_at: string
  notes: string
  strategy_id: string
}

type SavedTradeSummary = {
  symbol: string
  outcome: 'win' | 'loss'
  pnl: number
  entry: number | null
  exit: number | null
  stopLoss: number | null
  takeProfit: number | null
  rr: number | null
  date: string
}

type PendingAiSave = {
  data: TradeData
  imageFile: File | null
  analysis: string
}

export default function AddTradePage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const [step, setStep] = useState<Step>(1)
  const [isManual, setIsManual] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [tvUrl, setTvUrl] = useState('')
  const [tvSubmitting, setTvSubmitting] = useState(false)
  const [aiConfidence, setAiConfidence] = useState(0)
  const [aiRaw, setAiRaw] = useState('')
  const [pnlError, setPnlError] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [aiMissingFields, setAiMissingFields] = useState<string[]>([])
  const [showAiSuccessPopup, setShowAiSuccessPopup] = useState(false)
  const [showAiPnlPopup, setShowAiPnlPopup] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedTradeSummary, setSavedTradeSummary] = useState<SavedTradeSummary | null>(null)
  const [autoEditTrade, setAutoEditTrade] = useState<Trade | null>(null)
  const [pendingAiSave, setPendingAiSave] = useState<PendingAiSave | null>(null)
  const [strategyMenuOpen, setStrategyMenuOpen] = useState(false)
  const [tradeData, setTradeData] = useState<TradeData>({
    symbol: '', direction: 'long', outcome: 'win',
    entry_price: '', exit_price: '', stop_loss: '', take_profit: '',
    pnl: '', traded_at: new Date().toISOString().split('T')[0], notes: '',
    strategy_id: '',
  })
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const router = useRouter()
  const { language, isPro, subscriptionLoading } = useApp()
  const tr = t[language]
  const supabase = createClient()
  const selectedStrategy = strategies.find(strategy => strategy.id === tradeData.strategy_id)
  const selectedStrategyLabel = selectedStrategy?.name || tr.noStrategy

  // Load strategies for PRO users
  useEffect(() => {
    if (isPro && activePortfolio) {
      supabase.from('strategies').select('*').eq('portfolio_id', activePortfolio.id).order('name').then(({ data }) => {
        if (data) setStrategies(data)
      })
    }
  }, [isPro, activePortfolio])

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

  async function runAiAnalysisFromUrl() {
    const url = tvUrl.trim()
    if (!url) return
    if (!/tradingview\.com\//i.test(url)) {
      toast.error(language === 'he' ? 'הדבק קישור tradingview.com תקין' : 'Enter a valid tradingview.com URL')
      return
    }
    setTvSubmitting(true)
    setStep(2)
    try {
      let snapshotFile: File | null = null
      const res = await fetch('/api/analyze-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradingViewUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      if (data.fetchedImage && data.fetchedMediaType) {
        setImagePreview(`data:${data.fetchedMediaType};base64,${data.fetchedImage}`)
        // Convert the fetched base64 to a File so the existing upload logic
        // in handleSubmit will store the chart image alongside the trade.
        try {
          const bin = atob(data.fetchedImage)
          const arr = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
          const ext = (data.fetchedMediaType.split('/')[1] || 'png').replace('jpeg', 'jpg')
          const fname = `tv-snapshot-${Date.now()}.${ext}`
          const file = new File([arr], fname, { type: data.fetchedMediaType })
          snapshotFile = file
          setImageFile(file)
        } catch (e) {
          console.warn('Could not materialize TV snapshot as File', e)
        }
      }
      await applyAiResult(data, snapshotFile)
    } catch (err: any) {
      toast.error(language === 'he' ? `שגיאה: ${err.message}` : `Error: ${err.message}`)
      setStep(1)
    } finally {
      setTvSubmitting(false)
    }
  }

  async function applyAiResult(data: any, sourceImageFile?: File | null) {
    const missing: string[] = []
    if (!data.symbol) missing.push(language === 'he' ? 'שם הצמד' : 'Symbol')
    if (data.entry_price == null) missing.push(language === 'he' ? 'מחיר כניסה' : 'Entry price')
    setAiMissingFields(missing)

    let detectedOutcome: 'win' | 'loss' | undefined
    if (data.outcome === 'win' || data.outcome === 'loss') {
      detectedOutcome = data.outcome
    } else if (data.direction && data.entry_price != null && data.exit_price != null) {
      const isLong = data.direction === 'long'
      const priceWentUp = data.exit_price > data.entry_price
      detectedOutcome = (isLong ? priceWentUp : !priceWentUp) ? 'win' : 'loss'
    }
    const resolvedExitPrice =
      detectedOutcome === 'loss' && data.stop_loss != null ? data.stop_loss :
      detectedOutcome === 'win' && data.take_profit != null ? data.take_profit :
      data.exit_price

    const nextTradeData: TradeData = {
      ...tradeData,
      symbol: data.symbol || '',
      direction: data.direction === 'short' ? 'short' : 'long',
      entry_price: data.entry_price?.toString() || '',
      exit_price: resolvedExitPrice?.toString() || '',
      stop_loss: data.stop_loss?.toString() || '',
      take_profit: data.take_profit?.toString() || '',
      pnl: '',
      ...(detectedOutcome ? { outcome: detectedOutcome } : {}),
    }
    setTradeData(nextTradeData)
    const analysis = data.analysis || ''
    setAiConfidence(data.confidence || 85)
    setAiRaw(analysis)
    if (missing.length > 0 || !nextTradeData.stop_loss || !nextTradeData.take_profit) {
      toast.error(language === 'he' ? 'חסרים נתונים לשמירה אוטומטית, בדוק ידנית' : 'Missing data for auto-save, please review manually')
      setStep(3)
      return
    }
    setPendingAiSave({ data: nextTradeData, imageFile: sourceImageFile ?? imageFile, analysis })
    setShowAiPnlPopup(true)
  }

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
      await applyAiResult(data, file)
      return
      // Detect which fields the AI couldn't identify
      const missing: string[] = []
      if (!data.symbol) missing.push(language === 'he' ? 'שם הצמד' : 'Symbol')
      if (data.entry_price == null) missing.push(language === 'he' ? 'מחיר כניסה' : 'Entry price')
      setAiMissingFields(missing)

      // Prefer the AI first-touch outcome. Fall back to direction + exit only
      // when older API responses do not include outcome.
      let detectedOutcome: 'win' | 'loss' | undefined
      if (data.outcome === 'win' || data.outcome === 'loss') {
        detectedOutcome = data.outcome
      } else if (data.direction && data.entry_price != null && data.exit_price != null) {
        const isLong = data.direction === 'long'
        const priceWentUp = data.exit_price > data.entry_price
        detectedOutcome = (isLong ? priceWentUp : !priceWentUp) ? 'win' : 'loss'
      }
      const resolvedExitPrice =
        detectedOutcome === 'loss' && data.stop_loss != null ? data.stop_loss :
        detectedOutcome === 'win' && data.take_profit != null ? data.take_profit :
        data.exit_price

      setTradeData(prev => ({
        ...prev,
        symbol: data.symbol || '',
        direction: data.direction === 'short' ? 'short' : 'long',
        entry_price: data.entry_price?.toString() || '',
        exit_price: resolvedExitPrice?.toString() || '',
        stop_loss: data.stop_loss?.toString() || '',
        ...(detectedOutcome ? { outcome: detectedOutcome } : {}),
      }))
      setAiConfidence(data.confidence || 85)
      setAiRaw(data.analysis || '')
      setShowAiSuccessPopup(true)
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

  function estimatePnl(data: TradeData) {
    const entry = parseFloat(data.entry_price)
    const exit = parseFloat(data.exit_price)
    if (Number.isNaN(entry) || Number.isNaN(exit)) return 0
    const move = data.direction === 'long' ? exit - entry : entry - exit
    return Number(Math.abs(move).toFixed(2))
  }

  function calculateRr(data: TradeData) {
    if (data.outcome !== 'win') return null
    const entry = parseFloat(data.entry_price)
    const tp = parseFloat(data.take_profit || data.exit_price)
    const sl = parseFloat(data.stop_loss)
    if ([entry, tp, sl].some(Number.isNaN)) return null
    const risk = Math.abs(entry - sl)
    const reward = Math.abs(tp - entry)
    return risk > 0 ? parseFloat((reward / risk).toFixed(2)) : null
  }

  async function confirmAiPnl() {
    if (!pendingAiSave) return
    const pnl = tradeData.pnl.trim()
    if (!pnl || Number.isNaN(parseFloat(pnl))) {
      setPnlError(true)
      toast.error(language === 'he' ? 'נא למלא סכום רווח/הפסד' : 'Please enter trade P&L')
      return
    }
    const data = { ...pendingAiSave.data, outcome: tradeData.outcome, pnl }
    setShowAiPnlPopup(false)
    await saveTrade(data, pendingAiSave.imageFile, { redirect: false, sourceAi: true, aiAnalysis: pendingAiSave.analysis })
    setPendingAiSave(null)
  }

  async function saveTrade(data: TradeData, sourceImageFile: File | null, options: { redirect: boolean; sourceAi: boolean; aiAnalysis?: string }) {
    const targetPrice = data.take_profit || data.exit_price
    if (!data.symbol || !data.entry_price || !data.stop_loss || !targetPrice || !data.pnl) {
      toast.error(language === 'he' ? 'חסרים נתוני חובה לעסקה' : 'Missing required trade data')
      setStep(3)
      return
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('לא מחובר')

      if (!isPro) {
        const { count } = await supabase.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user!.id)
        if ((count ?? 0) >= 20) {
          toast.error(language === 'he' ? 'הגעת למגבלת 20 עסקאות - שדרג ל PRO' : 'Reached 20 trade limit - upgrade to PRO')
          router.push('/upgrade')
          return
        }
      }

      const savedId = localStorage.getItem('tradeix-active-portfolio')
      let portfolioId = savedId
      if (!portfolioId) {
        const { data: portfolios } = await supabase.from('portfolios').select('id').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(1)
        if ((portfolios?.length ?? 0) === 0) {
          toast.error(language === 'he' ? 'אין תיק - צור תיק קודם' : 'No portfolio found')
          router.push('/portfolios')
          return
        }
        portfolioId = portfolios![0].id
      }

      let imageUrl = null
      if (sourceImageFile) {
        const ext = sourceImageFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('trade-images').upload(path, sourceImageFile)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('trade-images').getPublicUrl(path)
          imageUrl = urlData.publicUrl
        }
      }

      const entryNum = parseFloat(data.entry_price)
      const exitNum = data.exit_price ? parseFloat(data.exit_price) : null
      const slNum = parseFloat(data.stop_loss)
      const tpNum = parseFloat(targetPrice)
      const pnlAbs = Math.abs(parseFloat(data.pnl) || estimatePnl(data))
      const pnl = data.outcome === 'loss' ? -pnlAbs : pnlAbs
      const rrRatio = calculateRr(data)

      const { data: inserted, error } = await supabase.from('trades').insert({
        portfolio_id: portfolioId, user_id: user.id,
        symbol: data.symbol.toUpperCase(),
        direction: data.direction,
        entry_price: entryNum,
        exit_price: exitNum,
        stop_loss: slNum,
        take_profit: tpNum,
        pnl,
        rr_ratio: rrRatio,
        image_url: imageUrl, ai_analysis: options.sourceAi ? (options.aiAnalysis ?? aiRaw) : null,
        notes: data.notes, traded_at: data.traded_at,
        outcome: data.outcome,
        strategy_id: data.strategy_id || null,
      }).select('*').single()
      if (error) throw error

      setSavedTradeSummary({
        symbol: data.symbol.toUpperCase(),
        outcome: data.outcome,
        pnl,
        entry: entryNum,
        exit: exitNum,
        stopLoss: slNum,
        takeProfit: tpNum,
        rr: rrRatio,
        date: data.traded_at,
      })
      setAutoEditTrade(inserted as Trade)
      setShowAiSuccessPopup(true)
      toast.success(language === 'he' ? 'העסקה הועלתה!' : 'Trade added!')
      if (options.redirect) {
        router.push('/trades')
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err.message || (language === 'he' ? 'שגיאה' : 'Error'))
    } finally {
      setSubmitting(false)
      setTvSubmitting(false)
    }
  }

  async function handleSubmit() {
    await saveTrade(tradeData, imageFile, { redirect: true, sourceAi: false })
    return
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
        const { count } = await supabase.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user!.id)
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
        const { data: portfolios } = await supabase.from('portfolios').select('id').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(1)
        if ((portfolios?.length ?? 0) === 0) {
          toast.error(language === 'he' ? 'אין תיק — צור תיק קודם' : 'No portfolio found')
          router.push('/portfolios')
          return
        }
        portfolioId = portfolios![0].id
      }
      let imageUrl = null
      if (imageFile) {
        const ext = imageFile!.name.split('.').pop()
        const path = `${user!.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('trade-images').upload(path, imageFile!)
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
      // RR = reward / risk (traditional). Only meaningful for winners; for
      // losing trades we leave rr_ratio null so the field is hidden everywhere.
      let rrRatio: number | null = null
      if (tradeData.outcome === 'win' && entryNum != null && exitNum != null && slNum != null) {
        const reward = tradeData.direction === 'long' ? exitNum! - entryNum! : entryNum! - exitNum!
        const risk   = tradeData.direction === 'long' ? entryNum! - slNum!  : slNum! - entryNum!
        if (risk > 0) rrRatio = parseFloat((reward / risk).toFixed(2))
      }
      const { error } = await supabase.from('trades').insert({
        portfolio_id: portfolioId, user_id: user!.id,
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
        strategy_id: tradeData.strategy_id || null,
      })
      if (error) throw error
      toast.success(language === 'he' ? 'העסקה הועלתה!' : 'Trade added!')
      window.scrollTo({ top: 0 })
      router.push('/trades')
      router.refresh()
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
          icon="post_add"
        />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="folder_open" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '21px', fontWeight: '900', marginBottom: '10px', color: 'var(--text)' }}>
            {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text3)', marginBottom: '24px' }}>
            {language === 'he' ? 'צור תיק ראשון כדי להתחיל' : 'Create your first portfolio to get started'}
          </div>
          <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/portfolios') }} style={{ background: '#0f8d63', color: '#fff', padding: '12px 28px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
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
        icon="post_add"
      />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* STEP 1 — PRO only — three options side by side */}
        {isPro && step === 1 && (
          <div className="fade-up">
            <div className="step1-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>

              {/* OPTION 1 — Image upload */}
              <div {...getRootProps()} style={{
                border: `2px dashed ${isDragActive ? 'var(--blue)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                padding: '24px 18px',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragActive ? '#0f8d630a' : 'var(--bg3)',
                transition: 'all 0.3s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                minHeight: '260px',
              }}>
                <input {...getInputProps()} />
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(15,141,99,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <Icon name="zoom_in" size={26} color="var(--blue)" strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>
                  {isDragActive ? (language === 'he' ? 'שחרר כאן...' : 'Drop here...') : (language === 'he' ? 'תמונת גרף' : 'Chart Image')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.6, marginBottom: '14px', flex: 1 }}>
                  {language === 'he' ? 'גרור או לחץ לבחירת קובץ' : 'Drag or click to choose'}
                </div>
                <span className="btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                  {language === 'he' ? 'בחר קובץ' : 'Choose File'}
                </span>
                <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '10px' }}>PNG · JPG · WEBP · 10MB</div>
              </div>

              {/* OPTION 2 — TradingView URL */}
              <div style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '22px 18px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                minHeight: '260px',
              }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(15,141,99,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <Icon name="show_chart" size={26} color="#0f8d63" strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>
                  {language === 'he' ? 'קישור TradingView' : 'TradingView Link'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.55, marginBottom: '12px', textAlign: 'center', flex: 1 }}>
                  {language === 'he' ? 'ב־TV לחץ Alt+S ליצירת snapshot, אז הדבק את הקישור' : 'In TV press Alt+S to snapshot, then paste the link'}
                </div>
                <input
                  type="url"
                  dir="ltr"
                  value={tvUrl}
                  onChange={e => setTvUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !tvSubmitting) { e.preventDefault(); runAiAnalysisFromUrl() } }}
                  placeholder="tradingview.com/x/..."
                  style={{ width: '100%', padding: '9px 11px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '12px', fontFamily: 'monospace', outline: 'none', marginBottom: '8px', textAlign: 'center' }}
                />
                <button
                  onClick={runAiAnalysisFromUrl}
                  disabled={!tvUrl.trim() || tvSubmitting}
                  style={{
                    width: '100%',
                    background: tvUrl.trim() ? '#0f8d63' : 'var(--bg2)',
                    color: tvUrl.trim() ? '#fff' : 'var(--text3)',
                    border: 'none', borderRadius: '10px',
                    padding: '8px', fontSize: '13px', fontWeight: '700',
                    cursor: tvUrl.trim() && !tvSubmitting ? 'pointer' : 'not-allowed',
                    fontFamily: 'Heebo, sans-serif',
                    opacity: tvSubmitting ? 0.6 : 1,
                  }}
                >
                  {tvSubmitting ? (language === 'he' ? 'מנתח...' : 'Analyzing...') : (language === 'he' ? 'נתח עם AI' : 'Analyze with AI')}
                </button>
              </div>

              {/* OPTION 3 — Manual entry */}
              <button onClick={skipToManual} style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '24px 18px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                minHeight: '260px',
                fontFamily: 'Heebo, sans-serif',
                transition: 'all 0.18s',
              }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg4)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg3)' }}
              >
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <Icon name="edit" size={26} color="var(--text2)" strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>
                  {language === 'he' ? 'הוספה ידנית' : 'Manual Entry'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.6, marginBottom: '14px', textAlign: 'center', flex: 1 }}>
                  {language === 'he' ? 'מלא את פרטי העסקה ידנית — בלי AI' : 'Fill trade details by hand — no AI'}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', fontSize: '13px', fontWeight: '700',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text2)',
                }}>
                  {language === 'he' ? 'התחל ידנית' : 'Start Manual'}
                  <Icon name={language === 'he' ? 'arrow_back' : 'chevron_right'} size={14} color="currentColor" />
                </span>
              </button>
            </div>
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
                <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: '500' }}>{language === 'he' ? 'מזהה נתונים...' : 'Analyzing...'}</div>
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{language === 'he' ? 'ניתוח AI • אנא המתן' : 'AI Analysis • Please wait'}</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="fade-up">
            {/* Inline AI success card removed — replaced by popup modal */}

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{tr.tradeDetails}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{isManual ? tr.manualMode : tr.editableMode}</div>
              </div>
              <div style={{ padding: '20px' }}>
                {/* Missing fields warning */}
                {aiMissingFields.length > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <Icon name="warning" size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#f59e0b', marginBottom: '3px' }}>
                        {language === 'he' ? 'ה-AI לא הצליח לזהות:' : 'AI could not identify:'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: '600' }}>
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
                        <Icon name="zoom_in" size={14} color="rgba(255,255,255,0.7)" />
                      </div>
                      <button onClick={() => { setImageFile(null); setImagePreview(null) }} style={{ position: 'absolute', top: '8px', left: '8px', background: '#00000088', border: '1px solid #ffffff22', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                        {language === 'he' ? '✕ הסר' : '✕ Remove'}
                      </button>
                    </div>
                  ) : (
                    <div {...getManualRootProps()} style={{ border: `2px dashed ${isManualDragActive ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: isManualDragActive ? '#0f8d630a' : 'var(--bg3)', transition: 'all 0.2s' }}>
                      <input {...getManualInputProps()} />
                      <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}><Icon name="photo_camera" size={24} color="var(--text3)" /></div>
                      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '2px', color: 'var(--text)' }}>{language === 'he' ? 'העלה תמונת גרף' : 'Upload Chart Image'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{language === 'he' ? 'אופציונלי' : 'Optional'} • PNG, JPG {language === 'he' ? 'עד' : 'up to'} 10MB</div>
                    </div>
                  )}
                </div>

                {/* Symbol + Date */}
                <div className="symbol-date-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'שם הצמד' : 'Symbol'} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input value={tradeData.symbol} onChange={e => setTradeData(p => ({ ...p, symbol: e.target.value }))} placeholder="EUR/USD, GOLD, BTC..." style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'תאריך' : 'Date'}
                    </label>
                    <input type="date" value={tradeData.traded_at} onChange={e => setTradeData(p => ({ ...p, traded_at: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', direction: 'ltr', minWidth: 0 }} />
                  </div>
                </div>

                {/* WIN / LOSS + LONG / SHORT toggles side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  {/* Outcome */}
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'תוצאה' : 'Outcome'} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {(['win', 'loss'] as const).map(val => {
                        const active = tradeData.outcome === val
                        const color = val === 'win' ? '#22c55e' : '#ef4444'
                        const bg = val === 'win' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
                        const border = val === 'win' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'
                        return (
                          <button key={val} type="button" onClick={() => setTradeData(p => ({ ...p, outcome: val }))} style={{ padding: '11px 6px', borderRadius: '10px', background: active ? bg : 'var(--bg3)', border: `2px solid ${active ? border : 'var(--border)'}`, color: active ? color : 'var(--text3)', fontSize: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', letterSpacing: '0.05em', transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {val === 'win' ? 'WIN' : 'LOSS'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Direction */}
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
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
                          <button key={val} type="button" onClick={() => setTradeData(p => ({ ...p, direction: val }))} style={{ padding: '11px 6px', borderRadius: '10px', background: active ? bg : 'var(--bg3)', border: `2px solid ${active ? border : 'var(--border)'}`, color: active ? color : 'var(--text3)', fontSize: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', letterSpacing: '0.05em', transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            <Icon name={icon} size={15} color="currentColor" />
                            {val === 'long' ? 'LONG' : 'SHORT'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Strategy selector — PRO only. Always shown; disabled when no strategies exist. */}
                {isPro && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                      {tr.selectStrategy}
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
                              {[{ id: '', name: tr.noStrategy }, ...strategies].map(strategy => {
                                const active = tradeData.strategy_id === strategy.id
                                return (
                                  <button
                                    key={strategy.id || 'none'}
                                    type="button"
                                    onClick={() => {
                                      setTradeData(p => ({ ...p, strategy_id: strategy.id }))
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
                          {language === 'he' ? 'אין כרגע אסטרטגיות פעילות' : 'No active strategies yet'}
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

                {/* Entry + SL + Exit */}
                <div className="price-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
                      {language === 'he' ? 'כניסה' : 'Entry'}
                    </label>
                    <input value={tradeData.entry_price} onChange={e => setTradeData(p => ({ ...p, entry_price: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', marginBottom: '6px', display: 'block', fontWeight: '600', color: 'rgba(239,68,68,0.7)' }}>
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
                    <label style={{ fontSize: '13px', marginBottom: '6px', display: 'block', fontWeight: '600', color: tradeData.outcome === 'loss' ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)' }}>
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

                {/* RR — only meaningful on a winning trade. RR = |reward|/|risk|
                    with sanity checks on the SL and exit positions vs direction. */}
                {tradeData.outcome === 'win' && (() => {
                  const entry = parseFloat(tradeData.entry_price)
                  const exit = parseFloat(tradeData.exit_price)
                  const sl = parseFloat(tradeData.stop_loss)
                  const havePrices = !isNaN(entry) && !isNaN(exit) && !isNaN(sl)
                  const isLong = tradeData.direction === 'long'
                  let rr: number | null = null
                  let warning: string | null = null

                  if (!havePrices) {
                    warning = language === 'he' ? 'מלא כניסה / יציאה / SL' : 'Need entry / exit / SL'
                  } else if (entry === sl) {
                    warning = language === 'he' ? 'הכניסה זהה ל־SL — לא ניתן לחשב' : 'Entry equals SL — cannot calculate'
                  } else if (isLong ? sl >= entry : sl <= entry) {
                    warning = language === 'he'
                      ? (isLong ? 'ב־LONG ה־SL צריך להיות מתחת לכניסה' : 'ב־SHORT ה־SL צריך להיות מעל הכניסה')
                      : (isLong ? 'For LONG, SL must be below entry' : 'For SHORT, SL must be above entry')
                  } else if (isLong ? exit <= entry : exit >= entry) {
                    warning = language === 'he'
                      ? (isLong ? 'ב־WIN של LONG היציאה צריכה מעל הכניסה' : 'ב־WIN של SHORT היציאה צריכה מתחת הכניסה')
                      : (isLong ? 'A winning LONG must close above entry' : 'A winning SHORT must close below entry')
                  } else {
                    const risk = Math.abs(entry - sl)
                    const reward = Math.abs(exit - entry)
                    if (risk > 0) rr = parseFloat((reward / risk).toFixed(2))
                  }

                  const rrColor = rr == null ? 'var(--text3)' : rr >= 2 ? '#22c55e' : rr >= 1 ? '#f59e0b' : '#ef4444'
                  const badge = warning ?? (
                    rr == null ? '—'
                    : rr >= 2 ? (language === 'he' ? 'מצוין' : 'Great')
                    : rr >= 1 ? (language === 'he' ? 'סביר' : 'Fair')
                    : (language === 'he' ? 'נמוך' : 'Low')
                  )
                  return (
                    <div style={{ background: 'var(--bg3)', border: warning ? '1px solid rgba(245,158,11,0.35)' : '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon name="analytics" size={16} color={rrColor} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Risk / Reward
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span dir="ltr" style={{ fontSize: '19px', fontWeight: '900', color: rrColor, letterSpacing: '-0.02em' }}>
                          {rr == null ? '—' : `1 : ${rr.toFixed(2)}`}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: warning ? '#f59e0b' : rrColor, background: warning ? 'rgba(245,158,11,0.1)' : `${rrColor === 'var(--text3)' ? 'rgba(255,255,255,0.04)' : rrColor + '15'}`, padding: '3px 9px', borderRadius: '6px', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                          {badge}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                {/* P&L */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', color: pnlError ? '#ef4444' : tradeData.outcome === 'win' ? '#22c55e' : '#ef4444', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
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
                    <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="error" size={13} />
                      {language === 'he' ? 'שדה חובה' : 'Required field'}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', display: 'block', fontWeight: '600' }}>
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
                  <span style={{ fontSize: '17px' }}>✓</span>
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
        @media (max-width: 400px) {
          .price-grid-3 { grid-template-columns: 1fr 1fr !important; }
          .price-grid-3 > div:last-child { grid-column: 1 / -1; }
        }
      `}</style>

      {showAiPnlPopup && pendingAiSave && (
        <div
          className="app-modal-overlay"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.2s ease' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="app-modal-card" data-tight="1"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: '20px', padding: '28px', maxWidth: '390px', width: '100%', textAlign: 'center', boxShadow: '0 24px 70px rgba(0,0,0,0.55)' }}
          >
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text)', marginBottom: '8px' }}>
              {language === 'he' ? 'כמה הרווחת / הפסדת בעסקה?' : 'How much did you win / lose?'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '18px', lineHeight: 1.5 }}>
              {language === 'he'
                ? 'בחר אם זו עסקת רווח או הפסד והזן את הסכום.'
                : 'Choose whether this was a win or loss and enter the amount.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              {(['win', 'loss'] as const).map(outcome => {
                const active = tradeData.outcome === outcome
                const color = outcome === 'win' ? '#22c55e' : '#ef4444'
                return (
                  <button
                    key={outcome}
                    type="button"
                    onClick={() => {
                      setTradeData(p => ({ ...p, outcome }))
                      if (pendingAiSave) setPendingAiSave({ ...pendingAiSave, data: { ...pendingAiSave.data, outcome } })
                    }}
                    style={{
                      height: '44px',
                      borderRadius: '12px',
                      border: `1px solid ${active ? color : 'var(--border)'}`,
                      background: active ? `${color}18` : 'var(--bg3)',
                      color: active ? color : 'var(--text2)',
                      fontFamily: 'Heebo, sans-serif',
                      fontSize: '14px',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    {outcome.toUpperCase()}
                  </button>
                )
              })}
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={tradeData.pnl}
              onChange={e => { setTradeData(p => ({ ...p, pnl: e.target.value })); setPnlError(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAiPnl() } }}
              placeholder="0.00"
              style={{
                textAlign: 'center',
                fontSize: '28px',
                fontWeight: 900,
                height: '58px',
                marginBottom: pnlError ? '6px' : '18px',
                borderColor: pnlError ? '#ef4444' : tradeData.outcome === 'win' ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)',
                boxShadow: pnlError ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none',
              }}
            />
            {pnlError && (
              <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 800, marginBottom: '12px' }}>
                {language === 'he' ? 'שדה חובה' : 'Required field'}
              </div>
            )}
            <button
              onClick={confirmAiPnl}
              disabled={submitting}
              className="btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: 800, opacity: submitting ? 0.65 : 1, cursor: submitting ? 'wait' : 'pointer' }}
            >
              {submitting ? tr.submitting : (language === 'he' ? 'שמור עסקה' : 'Save Trade')}
            </button>
          </div>
        </div>
      )}

      {/* AI Analysis Success Popup */}
      {showAiSuccessPopup && (
        <div
          onClick={e => e.stopPropagation()}
          className="app-modal-overlay"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.25s ease' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="app-modal-card" data-tight="1"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '36px 28px 28px', maxWidth: '400px', width: '100%', textAlign: 'center', animation: 'fadeIn 0.3s ease' }}
          >
            {/* Success icon */}
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(15,141,99,0.12)', border: '2px solid rgba(15,141,99,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Icon name="check_circle" size={32} color="#0f8d63" />
            </div>

            {/* Title */}
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '16px', lineHeight: 1.4 }}>
              {language === 'he' ? 'ניתוח העסקה הושלם בהצלחה' : 'Trade Analysis Completed Successfully'}
            </div>

            {/* Confidence */}
            {aiConfidence > 0 && (
              <div style={{ background: 'rgba(15,141,99,0.08)', border: '1px solid rgba(15,141,99,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f8d63' }}>
                  {language === 'he' ? 'ביטחון לפי קריאת הנתונים' : 'Data reading confidence'}: {aiConfidence}%
                </div>
              </div>
            )}

            {/* Disclaimer */}
            {savedTradeSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', textAlign: 'start' }}>
                {[
                  ['WIN/LOSS', savedTradeSummary.outcome.toUpperCase()],
                  ['PNL', `${savedTradeSummary.pnl >= 0 ? '+' : '-'}$${Math.abs(savedTradeSummary.pnl).toLocaleString()}`],
                  ['ENTRY', savedTradeSummary.entry ?? '-'],
                  ['SL', savedTradeSummary.stopLoss ?? '-'],
                  ['TP', savedTradeSummary.takeProfit ?? '-'],
                  ['RR', savedTradeSummary.rr ? `1 : ${savedTradeSummary.rr.toFixed(2)}` : '-'],
                  ['DATE', savedTradeSummary.date],
                  ['SYMBOL', savedTradeSummary.symbol],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.08em', marginBottom: '3px' }}>{label}</div>
                    <div dir="ltr" style={{ fontSize: '14px', color: label === 'WIN/LOSS' ? (String(value) === 'WIN' ? '#22c55e' : '#ef4444') : 'var(--text)', fontWeight: 900 }}>{String(value)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: '12.5px', color: 'var(--text3)', lineHeight: 1.6, marginBottom: '22px', padding: '0 4px' }}>
              {language === 'he'
                ? 'חשוב לוודא שהנתונים שהוזנו נכונים. גם בינה מלאכותית יכולה לטעות לפעמים.'
                : 'Please verify that the data entered is correct. AI can sometimes make mistakes.'}
            </div>

            {autoEditTrade && (
              <button
                onClick={() => setShowAiSuccessPopup(false)}
                className="btn-ghost"
                style={{ width: '100%', marginBottom: '10px', padding: '13px', fontSize: '15px', fontWeight: '800' }}
              >
                {language === 'he' ? 'ערוך עסקה' : 'Edit Trade'}
              </button>
            )}

            {/* OK button */}
            <button
              onClick={() => { setAutoEditTrade(null); setShowAiSuccessPopup(false); router.push('/trades') }}
              className="btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Icon name="check" size={18} color="#fff" />
              {language === 'he' ? 'אישור' : 'OK'}
            </button>
          </div>
        </div>
      )}

      {autoEditTrade && !showAiSuccessPopup && (
        <TradeModal
          trade={autoEditTrade}
          initialEditing
          onClose={() => setAutoEditTrade(null)}
          onUpdate={() => router.refresh()}
        />
      )}

      {/* Image lightbox */}
      {lightbox && imagePreview && (
        <div
          onClick={() => setLightbox(false)}
          className="app-modal-overlay app-modal-overlay--top2 app-modal-overlay--image"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease', cursor: 'zoom-out' }}
        >
          <button onClick={() => setLightbox(false)} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '17px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 501 }}>✕</button>
          <img src={imagePreview} alt="גרף" onClick={e => e.stopPropagation()} style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', cursor: 'default' }} />
        </div>
      )}
    </div>
  )
}
