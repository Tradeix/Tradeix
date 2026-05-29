'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { useApp } from '@/lib/app-context'
import { formatSignedMoney } from '@/lib/currency'
import { Trade, WeeklyReport } from '@/types'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'

type ReportForm = {
  feelings: string
  lessons: string
  improvements: string
}

type GeneratedWeekReport = {
  key: string
  weekStart: Date
  weekEnd: Date
  savedReport?: WeeklyReport
  trades: number
  pnl: number
}

const EMPTY_FORM: ReportForm = { feelings: '', lessons: '', improvements: '' }

function atLocalMidnight(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfTradingWeek(date: Date) {
  const d = atLocalMidnight(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formsMatch(a: ReportForm, b: ReportForm) {
  return a.feelings === b.feelings && a.lessons === b.lessons && a.improvements === b.improvements
}

function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function firstTradingWeekOfMonth(date: Date) {
  const d = monthStart(date)
  const day = d.getDay()
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  d.setDate(d.getDate() + diff)
  return d
}

function tradingWeeksForMonth(date: Date, currentTradingWeek: Date) {
  const firstWeek = firstTradingWeekOfMonth(date)
  return Array.from({ length: 4 })
    .map((_, index) => addDays(firstWeek, index * 7))
    .filter(week => week <= currentTradingWeek)
}

export default function WeeklyReportPage() {
  const { activePortfolio, portfoliosLoaded } = usePortfolio()
  const { language, currency } = useApp()
  const router = useRouter()
  const isRTL = language === 'he'
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [selectedWeek, setSelectedWeek] = useState(() => startOfTradingWeek(new Date()))
  const [selectedMonth, setSelectedMonth] = useState(() => monthStart(new Date()))
  const [trades, setTrades] = useState<Trade[]>([])
  const [monthTrades, setMonthTrades] = useState<Trade[]>([])
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [form, setForm] = useState<ReportForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [savingReport, setSavingReport] = useState(false)
  const skipNextAutoSave = useRef(true)
  const autoSaveTimer = useRef<number | null>(null)
  const formRef = useRef(form)

  const weekEnd = useMemo(() => addDays(selectedWeek, 4), [selectedWeek])
  const nextWeekStart = useMemo(() => addDays(selectedWeek, 7), [selectedWeek])
  const currentTradingWeek = useMemo(() => startOfTradingWeek(new Date()), [])
  const currentMonth = useMemo(() => monthStart(new Date()), [])
  const canGoNextMonth = selectedMonth.getTime() < currentMonth.getTime()
  const selectedReport = reports.find(report => report.week_start === toDateInput(selectedWeek))
  const locale = language === 'he' ? 'he-IL' : 'en-US'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null))
  }, [])

  useEffect(() => {
    if (!activePortfolio || !userId) return
    loadWeek()
  }, [activePortfolio?.id, userId, selectedWeek])

  useEffect(() => {
    if (!activePortfolio || !userId) return
    loadMonthReportData()
  }, [activePortfolio?.id, userId, selectedMonth])

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    if (!activePortfolio || !userId || loading) return
    if (skipNextAutoSave.current) {
      skipNextAutoSave.current = false
      return
    }

    const hasText = Boolean(form.feelings.trim() || form.lessons.trim() || form.improvements.trim())
    if (!hasText && !selectedReport) return

    clearAutoSaveTimer()
    autoSaveTimer.current = window.setTimeout(() => {
      saveReport(form)
    }, 700)

    return clearAutoSaveTimer
  }, [form, activePortfolio?.id, userId, loading, selectedWeek, selectedReport?.id])

  function clearAutoSaveTimer() {
    if (!autoSaveTimer.current) return
    window.clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = null
  }

  async function loadWeek() {
    if (!activePortfolio || !userId) return
    setLoading(true)

    const { data: tradeData } = await supabase
      .from('trades')
      .select('*')
      .eq('portfolio_id', activePortfolio.id)
      .gte('traded_at', selectedWeek.toISOString())
      .lt('traded_at', nextWeekStart.toISOString())
      .order('traded_at', { ascending: true })

    setTrades((tradeData || []) as Trade[])

    const { data: reportData, error: reportError } = await supabase
      .from('weekly_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('portfolio_id', activePortfolio.id)
      .eq('week_start', toDateInput(selectedWeek))
      .maybeSingle()

    if (reportError && reportError.code !== 'PGRST116') {
      skipNextAutoSave.current = true
      setForm(EMPTY_FORM)
      setHasPendingChanges(false)
    } else {
      const report = reportData as WeeklyReport | null
      skipNextAutoSave.current = true
      setForm(report ? {
        feelings: report.feelings || '',
        lessons: report.lessons || '',
        improvements: report.improvements || '',
      } : EMPTY_FORM)
      setHasPendingChanges(false)
      if (report) {
        setReports(prev => {
          const exists = prev.some(item => item.id === report.id)
          return exists ? prev.map(item => item.id === report.id ? report : item) : [report, ...prev]
        })
      }
    }

    setLoading(false)
  }

  async function loadMonthReportData() {
    if (!activePortfolio || !userId) return
    const monthWeeks = tradingWeeksForMonth(selectedMonth, currentTradingWeek)
    const monthQueryStart = monthWeeks[0] || firstTradingWeekOfMonth(selectedMonth)
    const monthQueryEnd = addDays(monthQueryStart, 28)

    const [{ data: reportData }, { data: tradeData }] = await Promise.all([
      supabase
      .from('weekly_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('portfolio_id', activePortfolio.id)
        .gte('week_start', toDateInput(monthQueryStart))
        .lt('week_start', toDateInput(monthQueryEnd))
        .order('week_start', { ascending: false }),
      supabase
        .from('trades')
        .select('*')
        .eq('portfolio_id', activePortfolio.id)
        .gte('traded_at', monthQueryStart.toISOString())
        .lt('traded_at', monthQueryEnd.toISOString())
        .order('traded_at', { ascending: true }),
    ])

    setReports((reportData || []) as WeeklyReport[])
    setMonthTrades((tradeData || []) as Trade[])
  }

  async function saveReport(formSnapshot: ReportForm) {
    if (!activePortfolio || !userId) return
    const hasText = Boolean(formSnapshot.feelings.trim() || formSnapshot.lessons.trim() || formSnapshot.improvements.trim())
    if (!hasText && !selectedReport) return
    setSavingReport(true)

    const payload = {
      user_id: userId,
      portfolio_id: activePortfolio.id,
      week_start: toDateInput(selectedWeek),
      week_end: toDateInput(weekEnd),
      feelings: formSnapshot.feelings.trim(),
      lessons: formSnapshot.lessons.trim(),
      improvements: formSnapshot.improvements.trim(),
    }

    let saveResult = selectedReport
      ? await supabase
        .from('weekly_reports')
        .update({
          week_end: payload.week_end,
          feelings: payload.feelings,
          lessons: payload.lessons,
          improvements: payload.improvements,
        })
        .eq('id', selectedReport.id)
        .eq('user_id', userId)
      : await supabase
        .from('weekly_reports')
        .insert(payload)

    if (!selectedReport && saveResult.error?.code === '23505') {
      saveResult = await supabase
        .from('weekly_reports')
        .update({
          week_end: payload.week_end,
          feelings: payload.feelings,
          lessons: payload.lessons,
          improvements: payload.improvements,
        })
        .eq('user_id', userId)
        .eq('portfolio_id', activePortfolio.id)
        .eq('week_start', payload.week_start)
    }

    try {
      if (saveResult.error) {
        console.error('weekly report save failed', saveResult.error)
      } else {
        if (formsMatch(formRef.current, formSnapshot)) setHasPendingChanges(false)
        await loadMonthReportData()
      }
    } finally {
      setSavingReport(false)
    }
  }

  async function flushCurrentReport() {
    clearAutoSaveTimer()
    await saveReport(formRef.current)
  }

  function updateJournalField(field: keyof ReportForm, value: string) {
    setHasPendingChanges(true)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function selectWeek(date: Date) {
    const week = startOfTradingWeek(date)
    if (week.getTime() === selectedWeek.getTime()) return
    await flushCurrentReport()
    setSelectedWeek(week)
  }

  async function moveMonth(direction: -1 | 1) {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + direction, 1)
    if (next > currentMonth) return
    await flushCurrentReport()
    const nextMonthStart = monthStart(next)
    const nextMonthWeeks = tradingWeeksForMonth(nextMonthStart, currentTradingWeek)
    setSelectedMonth(nextMonthStart)
    if (nextMonthWeeks.length) {
      setSelectedWeek(nextMonthWeeks[nextMonthWeeks.length - 1])
    }
  }

  const stats = useMemo(() => {
    const wins = trades.filter(trade => trade.outcome === 'win')
    const losses = trades.filter(trade => trade.outcome === 'loss')
    const pnl = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0)
    const winRate = trades.length ? (wins.length / trades.length) * 100 : 0
    const avgPnl = trades.length ? pnl / trades.length : 0
    const bestTrade = trades.length ? Math.max(...trades.map(trade => trade.pnl || 0)) : 0
    const worstTrade = trades.length ? Math.min(...trades.map(trade => trade.pnl || 0)) : 0

    return { wins: wins.length, losses: losses.length, pnl, winRate, avgPnl, bestTrade, worstTrade }
  }, [trades])

  const dailyRows = useMemo(() => {
    return Array.from({ length: 5 }).map((_, index) => {
      const date = addDays(selectedWeek, index)
      const dayTrades = trades.filter(trade => toDateInput(new Date(trade.traded_at)) === toDateInput(date))
      const pnl = dayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0)
      return { date, trades: dayTrades.length, pnl }
    })
  }, [selectedWeek, trades])

  const monthLabel = selectedMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const weekLabel = `${selectedWeek.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
  const generatedReports = useMemo<GeneratedWeekReport[]>(() => {
    const weeks = new Map<string, GeneratedWeekReport>()
    const monthWeeks = tradingWeeksForMonth(selectedMonth, currentTradingWeek)

    monthWeeks.forEach(cursor => {
      const key = toDateInput(cursor)
      weeks.set(key, {
        key,
        weekStart: cursor,
        weekEnd: addDays(cursor, 4),
        trades: 0,
        pnl: 0,
      })
    })

    monthTrades.forEach(trade => {
      const weekStart = startOfTradingWeek(new Date(trade.traded_at))
      if (weekStart > currentTradingWeek) return
      const key = toDateInput(weekStart)
      const existing = weeks.get(key)
      if (!existing) return
      existing.trades += 1
      existing.pnl += trade.pnl || 0
      weeks.set(key, existing)
    })

    reports.forEach(report => {
      const weekStart = parseInputDate(report.week_start)
      if (weekStart > currentTradingWeek) return
      const key = report.week_start
      const existing = weeks.get(key)
      if (!existing) return
      existing.savedReport = report
      weeks.set(key, existing)
    })

    return Array.from(weeks.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
  }, [selectedMonth, currentTradingWeek, monthTrades, reports])
  if (portfoliosLoaded && !activePortfolio) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <PageHeader
          title={language === 'he' ? 'דוח שבועי' : 'Weekly Report'}
          subtitle={language === 'he' ? 'מחברת שבועית לשיפור המסחר שלך' : 'A weekly trading journal for better decisions'}
          icon="edit_note"
        />
        <div style={{ textAlign: 'center', padding: '64px 18px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text)', marginBottom: '8px' }}>
            {language === 'he' ? 'אין תיקים עדיין' : 'No portfolios yet'}
          </div>
          <p style={{ color: 'var(--text3)', margin: '0 0 22px', fontWeight: 650 }}>
            {language === 'he' ? 'צריך תיק פעיל כדי ליצור דוח שבועי.' : 'Create an active portfolio to write weekly reports.'}
          </p>
          <button onClick={() => { localStorage.setItem('tradeix-open-new-portfolio', '1'); router.push('/settings?section=portfolios') }} style={{ background: '#0f8d63', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 850, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
            {language === 'he' ? 'צור תיק חדש' : 'Create portfolio'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={language === 'he' ? 'דוח שבועי' : 'Weekly Report'}
        subtitle={language === 'he' ? 'סיכום שבוע המסחר, מחשבות, ומקום ברור לשיפור' : 'Summarize the trading week, reflect, and plan the next improvement'}
        icon="menu_book"
        action={(
          <div className="weekly-header-action">
            <Icon name="cases" size={16} />
            <span>{activePortfolio?.name || (language === 'he' ? 'תיק פעיל' : 'Active portfolio')}</span>
          </div>
        )}
      />

      <div className="weekly-report-shell">
        <section className="weekly-report-main" dir={isRTL ? 'rtl' : 'ltr'}>
          {loading && (
            <div className="weekly-loading">
              {language === 'he' ? 'טוען את שבוע המסחר...' : 'Loading trading week...'}
            </div>
          )}

          <div key={toDateInput(selectedWeek)} className="weekly-notebook report-fade">
            <div className="weekly-toolbar">
              <div className="weekly-title-block">
                <div className="weekly-kicker">{language === 'he' ? 'שבוע מסחר' : 'Trading week'}</div>
                <h3>{weekLabel}</h3>
              </div>
            </div>

            <div className="weekly-metrics">
              <Metric label={language === 'he' ? 'עסקאות' : 'Trades'} value={trades.length.toString()} />
              <Metric label={language === 'he' ? 'PNL שבועי' : 'Weekly PNL'} value={formatSignedMoney(stats.pnl, currency)} tone={stats.pnl > 0 ? 'good' : stats.pnl < 0 ? 'bad' : 'neutral'} />
              <Metric label={language === 'he' ? 'אחוז זכייה' : 'Win rate'} value={`${Math.round(stats.winRate)}%`} tone={stats.winRate >= 60 ? 'good' : stats.winRate >= 30 ? 'warn' : stats.winRate > 0 ? 'bad' : 'neutral'} />
              <Metric label={language === 'he' ? 'ממוצע לעסקה' : 'Avg. trade'} value={formatSignedMoney(stats.avgPnl, currency)} tone={stats.avgPnl > 0 ? 'good' : stats.avgPnl < 0 ? 'bad' : 'neutral'} />
            </div>

            <div className="notebook-content-grid">
              <div className="weekly-line-section daily-sheet">
                <div className="section-heading">
                  <span>{language === 'he' ? 'פירוט יומי' : 'Daily breakdown'}</span>
                </div>
                <div className="daily-list">
                  {dailyRows.map(row => (
                    <div className="daily-row" key={row.date.toISOString()}>
                      <div>
                        <strong>{row.date.toLocaleDateString(locale, { weekday: 'long' })}</strong>
                        <span>{row.date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}</span>
                      </div>
                      <div>{row.trades} {language === 'he' ? 'עסקאות' : row.trades === 1 ? 'trade' : 'trades'}</div>
                      <b data-tone={row.pnl > 0 ? 'good' : row.pnl < 0 ? 'bad' : 'neutral'}>{formatSignedMoney(row.pnl, currency)}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="weekly-line-section highlight-sheet">
                <div className="section-heading">
                  <span>{language === 'he' ? 'תמונת מצב' : 'Snapshot'}</span>
                </div>
                <div className="highlight-list">
                  <Highlight label={language === 'he' ? 'עסקה טובה ביותר' : 'Best trade'} value={formatSignedMoney(stats.bestTrade, currency)} tone={stats.bestTrade > 0 ? 'good' : 'neutral'} />
                  <Highlight label={language === 'he' ? 'עסקה חלשה ביותר' : 'Worst trade'} value={formatSignedMoney(stats.worstTrade, currency)} tone={stats.worstTrade < 0 ? 'bad' : 'neutral'} />
                  <Highlight label={language === 'he' ? 'ניצחונות / הפסדים' : 'Wins / Losses'} value={`${stats.wins} / ${stats.losses}`} />
                </div>
              </div>
            </div>

            <div className="journal-area notebook-panel">
            <JournalField
              label={language === 'he' ? 'איך הרגשתי השבוע?' : 'How did this week feel?'}
              placeholder={language === 'he' ? 'לדוגמה: הייתי סבלני יותר, אבל אחרי הפסד שני נכנסתי ללחץ...' : 'Example: I was more patient, but after the second loss I started forcing trades...'}
              value={form.feelings}
              onChange={value => updateJournalField('feelings', value)}
            />
            <JournalField
              label={language === 'he' ? 'מה למדתי מהשבוע?' : 'What did I learn this week?'}
              placeholder={language === 'he' ? 'מה עבד, מה חזר על עצמו, ומה חשוב לזכור לשבוע הבא.' : 'What worked, what repeated, and what should stay top of mind next week.'}
              value={form.lessons}
              onChange={value => updateJournalField('lessons', value)}
            />
            <JournalField
              label={language === 'he' ? 'מה אני משפר בשבוע הבא?' : 'What will I improve next week?'}
              placeholder={language === 'he' ? 'בחר פעולה אחת או שתיים: פחות עסקאות, להמתין לאישור, לעצור אחרי 2 הפסדים...' : 'Choose one or two actions: fewer trades, wait for confirmation, stop after 2 losses...'}
              value={form.improvements}
              onChange={value => updateJournalField('improvements', value)}
            />
            {hasPendingChanges && (
              <button className="journal-save-pill" onClick={flushCurrentReport} disabled={savingReport}>
                <Icon name={savingReport ? 'autorenew' : 'save'} size={14} />
                <span>{savingReport ? (language === 'he' ? 'שומר...' : 'Saving...') : (language === 'he' ? 'שמור' : 'Save')}</span>
              </button>
            )}

            </div>
          </div>
        </section>

        <aside className="weekly-report-sidebar" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="reports-month-card">
            <div className="reports-month-title">
              <span>{language === 'he' ? 'דוחות שבועיים' : 'Weekly reports'}</span>
              <strong>{monthLabel}</strong>
            </div>
            <div className="reports-month-nav">
              <button onClick={() => moveMonth(-1)} aria-label={language === 'he' ? 'חודש קודם' : 'Previous month'}>
                <Icon name={isRTL ? 'chevron_right' : 'chevron_left'} size={17} />
              </button>
              <button onClick={() => moveMonth(1)} disabled={!canGoNextMonth} aria-label={language === 'he' ? 'חודש הבא' : 'Next month'}>
                <Icon name={isRTL ? 'chevron_left' : 'chevron_right'} size={17} />
              </button>
            </div>
          </div>
          <div className="report-list">
            {generatedReports.length === 0 ? (
              <p>{language === 'he' ? 'עדיין אין שבועות מסחר לחודש הזה.' : 'No trading weeks for this month yet.'}</p>
            ) : generatedReports.map(report => {
              const active = report.key === toDateInput(selectedWeek)
              return (
                <button key={report.key} data-active={active ? '1' : '0'} onClick={() => selectWeek(report.weekStart)}>
                  <span>
                    <strong>{report.weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} - {report.weekEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</strong>
                    <small>
                      {report.trades} {language === 'he' ? 'עסקאות' : report.trades === 1 ? 'trade' : 'trades'}
                      {' · '}
                      {formatSignedMoney(report.pnl, currency)}
                      {report.savedReport ? (language === 'he' ? ' · נשמר' : ' · saved') : ''}
                    </small>
                  </span>
                  <Icon name={isRTL ? 'chevron_left' : 'chevron_right'} size={16} />
                </button>
              )
            })}
          </div>
        </aside>
      </div>

      <style>{`
        .weekly-header-action {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 13px;
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text2);
          background: rgba(255,255,255,.025);
          font-size: 13px;
          font-weight: 850;
          white-space: nowrap;
        }
        .weekly-header-action svg { color: #0f8d63; }
        .weekly-report-shell {
          display: grid;
          grid-template-columns: minmax(0, 9fr) minmax(280px, 3fr);
          grid-template-areas: "report reports";
          gap: 34px;
          align-items: start;
          direction: ltr;
        }
        .weekly-report-main { grid-area: report; }
        .weekly-report-sidebar { grid-area: reports; }
        .weekly-report-main,
        .weekly-report-sidebar {
          padding: 28px 0;
        }
        .weekly-report-sidebar {
          position: sticky;
          top: 92px;
          border-top: 2px solid rgba(15,141,99,.55);
        }
        .weekly-notebook {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.095);
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.018));
        }
        .report-fade {
          animation: reportFadeIn .24s ease both;
        }
        @keyframes reportFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .weekly-toolbar {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 24px 30px 22px;
          border-bottom: 1px solid var(--border);
          background: rgba(0,0,0,.12);
        }
        .weekly-title-block { min-width: 0; }
        .weekly-kicker {
          color: #0f8d63;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .08em;
          margin-bottom: 4px;
        }
        .weekly-title-block h3 {
          margin: 0;
          color: var(--text);
          font-size: 25px;
          font-weight: 900;
          line-height: 1.15;
        }
        .weekly-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid var(--border);
          background:
            linear-gradient(90deg, rgba(15,141,99,.08), transparent 34%, rgba(255,255,255,.025)),
            rgba(255,255,255,.018);
        }
        .weekly-loading {
          color: var(--text3);
          font-size: 13px;
          font-weight: 800;
          margin: -12px 0 18px;
        }
        .metric {
          position: relative;
          padding: 20px 18px 19px;
          border-inline-end: 1px solid var(--border);
        }
        .metric:last-child { border-inline-end: none; }
        .metric span {
          display: block;
          color: #95a3b8;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: .04em;
          margin-bottom: 7px;
        }
        .metric strong {
          display: block;
          color: var(--text);
          font-size: 26px;
          font-weight: 950;
          line-height: 1;
        }
        [data-tone="good"] { color: #22c55e !important; }
        [data-tone="bad"] { color: #ef4444 !important; }
        [data-tone="warn"] { color: #f59e0b !important; }
        .notebook-content-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          border-bottom: 1px solid var(--border);
          background:
            linear-gradient(180deg, rgba(255,255,255,.022), rgba(255,255,255,.006)),
            repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 86px);
        }
        .weekly-line-section {
          display: flex;
          flex-direction: column;
          padding: 28px 30px;
        }
        .daily-sheet {
          border-inline-end: 1px solid var(--border);
        }
        .highlight-sheet {
          background: linear-gradient(135deg, rgba(15,141,99,.07), rgba(255,255,255,.015) 42%, rgba(15,141,99,.025));
        }
        .section-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          color: var(--text);
          font-size: 17px;
          font-weight: 950;
        }
        .section-heading::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #0f8d63;
          box-shadow: 0 0 0 5px rgba(15,141,99,.1);
        }
        .daily-list,
        .highlight-list {
          flex: 1;
          display: grid;
          gap: 8px;
        }
        .daily-list {
          grid-template-rows: repeat(5, minmax(68px, 1fr));
        }
        .highlight-list {
          grid-template-rows: repeat(3, minmax(68px, 1fr));
        }
        .daily-row,
        .highlight-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          gap: 14px;
          align-items: center;
          min-height: 68px;
          padding: 13px 14px;
          border-bottom: 1px solid rgba(255,255,255,.075);
          border-radius: 16px;
          background: rgba(2,8,14,.18);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
        }
        .daily-row:last-child,
        .highlight-row:last-child {
          border-bottom: none;
        }
        .daily-row strong,
        .highlight-row span {
          display: block;
          color: var(--text);
          font-size: 14px;
          font-weight: 850;
        }
        .daily-row span {
          display: block;
          color: var(--text3);
          font-size: 12px;
          font-weight: 650;
          margin-top: 2px;
        }
        .daily-row > div:nth-child(2),
        .highlight-row small {
          color: var(--text3);
          font-size: 13px;
          font-weight: 750;
          white-space: nowrap;
          padding: 5px 9px;
          border-radius: 999px;
          background: rgba(255,255,255,.035);
        }
        .daily-row b,
        .highlight-row b {
          color: var(--text);
          font-size: 16px;
          font-weight: 950;
          white-space: nowrap;
        }
        .journal-area {
          padding: 28px 30px 66px;
          position: relative;
          background:
            linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.03)),
            repeating-linear-gradient(0deg, transparent 0 31px, rgba(255,255,255,.025) 31px 32px);
        }
        .journal-field {
          padding: 20px 0 22px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          position: relative;
        }
        .journal-field:last-of-type {
          border-bottom: none;
        }
        .journal-field label {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--text);
          font-size: 15px;
          font-weight: 900;
          margin-bottom: 8px;
        }
        .journal-field label::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #0f8d63;
          box-shadow: 0 0 0 5px rgba(15,141,99,.1);
          flex: 0 0 auto;
        }
        .journal-field textarea {
          width: 100%;
          min-height: 92px;
          resize: vertical;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: Heebo, sans-serif;
          font-size: 15px;
          line-height: 1.8;
          padding: 0;
        }
        .journal-field textarea::placeholder { color: var(--text3); }
        .journal-save-pill {
          position: absolute;
          left: 24px;
          bottom: 20px;
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 13px;
          border: 1px solid rgba(34,197,94,.42);
          border-radius: 999px;
          background: linear-gradient(180deg, #19a86c, #0f8d63);
          color: #fff;
          box-shadow: 0 12px 24px rgba(15,141,99,.18), inset 0 1px 0 rgba(255,255,255,.22);
          cursor: pointer;
          font-family: Heebo, sans-serif;
          font-size: 12px;
          font-weight: 900;
          transition: transform .15s, box-shadow .15s, opacity .15s;
        }
        .journal-save-pill:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 16px 30px rgba(15,141,99,.24), inset 0 1px 0 rgba(255,255,255,.24);
        }
        .journal-save-pill:disabled {
          cursor: wait;
          opacity: .78;
        }
        .reports-month-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255,255,255,.09);
        }
        .reports-month-title {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .reports-month-title span {
          color: var(--text);
          font-weight: 950;
          font-size: 16px;
        }
        .reports-month-title strong {
          color: var(--text3);
          font-size: 20px;
          font-weight: 950;
          line-height: 1.1;
        }
        .reports-month-nav {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .reports-month-nav button {
          width: 34px;
          height: 34px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: rgba(255,255,255,.025);
          color: var(--text2);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: color .15s, border-color .15s, background .15s, opacity .15s;
        }
        .reports-month-nav button:hover:not(:disabled) {
          color: #0f8d63;
          border-color: rgba(15,141,99,.35);
          background: rgba(15,141,99,.08);
        }
        .reports-month-nav button:disabled {
          opacity: .32;
          cursor: not-allowed;
        }
        .report-list {
          display: grid;
          gap: 10px;
        }
        .report-list p {
          color: var(--text3);
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
          padding: 12px 0;
        }
        .report-list button {
          border: 1px solid rgba(255,255,255,.075);
          border-radius: 14px;
          background: rgba(255,255,255,.024);
          color: var(--text2);
          min-height: 66px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          font-family: Heebo, sans-serif;
          font-weight: 850;
          padding: 12px 14px;
          text-align: start;
          transition: color .15s, border-color .15s, background .15s, transform .15s;
        }
        .report-list button:hover {
          color: #0f8d63;
          border-color: rgba(15,141,99,.28);
          background: rgba(15,141,99,.065);
          transform: translateY(-1px);
        }
        .report-list button[data-active="1"] {
          color: #0f8d63;
          border-color: rgba(15,141,99,.42);
          background: rgba(15,141,99,.11);
        }
        .report-list button span {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .report-list button strong {
          color: inherit;
          font-size: 13.5px;
          font-weight: 900;
        }
        .report-list button small {
          color: var(--text3);
          font-size: 11.5px;
          font-weight: 750;
          white-space: normal;
        }
        @media (max-width: 980px) {
          .weekly-report-shell {
            grid-template-columns: 1fr;
            grid-template-areas: "report";
            gap: 20px;
          }
          .notebook-content-grid { grid-template-columns: 1fr; }
          .daily-sheet { border-inline-end: none; border-bottom: 1px solid var(--border); }
          .weekly-report-sidebar { display: none; }
        }
        @media (max-width: 640px) {
          .weekly-header-action { display: none; }
          .weekly-report-main,
          .weekly-report-sidebar { padding: 18px 0; }
          .weekly-toolbar,
          .weekly-line-section,
          .journal-area { padding-inline: 18px; }
          .weekly-title-block h3 { font-size: 20px; }
          .weekly-metrics { grid-template-columns: 1fr 1fr; }
          .metric:nth-child(2) { border-inline-end: none; }
          .metric { padding: 15px 10px; }
          .metric strong { font-size: 20px; }
          .daily-row { grid-template-columns: minmax(0, 1fr) auto; }
          .daily-row b { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' | 'neutral' }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong data-tone={tone}>{value}</strong>
    </div>
  )
}

function Highlight({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  return (
    <div className="highlight-row">
      <span>{label}</span>
      <small />
      <b data-tone={tone}>{value}</b>
    </div>
  )
}

function JournalField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="journal-field">
      <label>{label}</label>
      <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}
