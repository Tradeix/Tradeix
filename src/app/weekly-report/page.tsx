'use client'

import { useEffect, useMemo, useState } from 'react'
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
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [form, setForm] = useState<ReportForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const weekEnd = useMemo(() => addDays(selectedWeek, 4), [selectedWeek])
  const nextWeekStart = useMemo(() => addDays(selectedWeek, 7), [selectedWeek])
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
    loadReportsForMonth()
  }, [activePortfolio?.id, userId, selectedMonth])

  async function loadWeek() {
    if (!activePortfolio || !userId) return
    setLoading(true)
    setMessage('')

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
      setMessage(language === 'he'
        ? 'טבלת הדוחות השבועיים עדיין לא קיימת בבסיס הנתונים.'
        : 'The weekly reports table does not exist in the database yet.')
      setForm(EMPTY_FORM)
    } else {
      const report = reportData as WeeklyReport | null
      setForm(report ? {
        feelings: report.feelings || '',
        lessons: report.lessons || '',
        improvements: report.improvements || '',
      } : EMPTY_FORM)
    }

    setLoading(false)
  }

  async function loadReportsForMonth() {
    if (!activePortfolio || !userId) return
    const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1)
    const { data } = await supabase
      .from('weekly_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('portfolio_id', activePortfolio.id)
      .gte('week_start', toDateInput(selectedMonth))
      .lt('week_start', toDateInput(nextMonth))
      .order('week_start', { ascending: false })

    setReports((data || []) as WeeklyReport[])
  }

  async function saveReport() {
    if (!activePortfolio || !userId) return
    setSaving(true)
    setMessage('')

    const payload = {
      user_id: userId,
      portfolio_id: activePortfolio.id,
      week_start: toDateInput(selectedWeek),
      week_end: toDateInput(weekEnd),
      feelings: form.feelings.trim(),
      lessons: form.lessons.trim(),
      improvements: form.improvements.trim(),
    }

    const { error } = await supabase
      .from('weekly_reports')
      .upsert(payload, { onConflict: 'user_id,portfolio_id,week_start' })

    if (error) {
      setMessage(language === 'he'
        ? 'לא הצלחתי לשמור. ודא שטבלת weekly_reports קיימת ב-Supabase.'
        : 'Could not save. Make sure the weekly_reports table exists in Supabase.')
    } else {
      setMessage(language === 'he' ? 'הדוח השבועי נשמר' : 'Weekly report saved')
      await loadReportsForMonth()
    }

    setSaving(false)
  }

  function selectWeek(date: Date) {
    const week = startOfTradingWeek(date)
    setSelectedWeek(week)
    setSelectedMonth(monthStart(week))
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
        icon="edit_note"
      />

      <div className="weekly-report-shell">
        <section className="weekly-report-main">
          <div className="weekly-toolbar">
            <button className="weekly-nav-btn" onClick={() => selectWeek(addDays(selectedWeek, -7))} aria-label={language === 'he' ? 'שבוע קודם' : 'Previous week'}>
              <Icon name={isRTL ? 'chevron_right' : 'chevron_left'} size={18} />
            </button>

            <div className="weekly-title-block">
              <div className="weekly-kicker">{language === 'he' ? 'שבוע מסחר' : 'Trading week'}</div>
              <h3>{weekLabel}</h3>
            </div>

            <button className="weekly-nav-btn" onClick={() => selectWeek(addDays(selectedWeek, 7))} aria-label={language === 'he' ? 'שבוע הבא' : 'Next week'}>
              <Icon name={isRTL ? 'chevron_left' : 'chevron_right'} size={18} />
            </button>

            <div className="weekly-date-controls">
              <input type="date" value={toDateInput(selectedWeek)} onChange={e => selectWeek(parseInputDate(e.target.value))} />
              <input type="month" value={toDateInput(selectedMonth).slice(0, 7)} onChange={e => {
                const next = parseInputDate(`${e.target.value}-01`)
                setSelectedMonth(monthStart(next))
              }} />
            </div>
          </div>

          {loading && (
            <div className="weekly-loading">
              {language === 'he' ? 'טוען את שבוע המסחר...' : 'Loading trading week...'}
            </div>
          )}

          <div className="weekly-metrics">
            <Metric label={language === 'he' ? 'עסקאות' : 'Trades'} value={trades.length.toString()} />
            <Metric label={language === 'he' ? 'PNL שבועי' : 'Weekly PNL'} value={formatSignedMoney(stats.pnl, currency)} tone={stats.pnl > 0 ? 'good' : stats.pnl < 0 ? 'bad' : 'neutral'} />
            <Metric label={language === 'he' ? 'אחוז זכייה' : 'Win rate'} value={`${Math.round(stats.winRate)}%`} tone={stats.winRate >= 60 ? 'good' : stats.winRate >= 30 ? 'warn' : stats.winRate > 0 ? 'bad' : 'neutral'} />
            <Metric label={language === 'he' ? 'ממוצע לעסקה' : 'Avg. trade'} value={formatSignedMoney(stats.avgPnl, currency)} tone={stats.avgPnl > 0 ? 'good' : stats.avgPnl < 0 ? 'bad' : 'neutral'} />
          </div>

          <div className="weekly-split">
            <div className="weekly-line-section">
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

            <div className="weekly-line-section">
              <div className="section-heading">
                <span>{language === 'he' ? 'נקודות קצה' : 'Highlights'}</span>
              </div>
              <div className="highlight-list">
                <Highlight label={language === 'he' ? 'עסקה טובה ביותר' : 'Best trade'} value={formatSignedMoney(stats.bestTrade, currency)} tone={stats.bestTrade > 0 ? 'good' : 'neutral'} />
                <Highlight label={language === 'he' ? 'עסקה חלשה ביותר' : 'Worst trade'} value={formatSignedMoney(stats.worstTrade, currency)} tone={stats.worstTrade < 0 ? 'bad' : 'neutral'} />
                <Highlight label={language === 'he' ? 'ניצחונות / הפסדים' : 'Wins / Losses'} value={`${stats.wins} / ${stats.losses}`} />
              </div>
            </div>
          </div>

          <div className="journal-area">
            <div className="section-heading">
              <span>{language === 'he' ? 'המחברת השבועית' : 'Weekly journal'}</span>
            </div>

            <JournalField
              label={language === 'he' ? 'איך הרגשתי השבוע?' : 'How did this week feel?'}
              placeholder={language === 'he' ? 'לדוגמה: הייתי סבלני יותר, אבל אחרי הפסד שני נכנסתי ללחץ...' : 'Example: I was more patient, but after the second loss I started forcing trades...'}
              value={form.feelings}
              onChange={value => setForm(prev => ({ ...prev, feelings: value }))}
            />
            <JournalField
              label={language === 'he' ? 'מה למדתי מהשבוע?' : 'What did I learn this week?'}
              placeholder={language === 'he' ? 'מה עבד, מה חזר על עצמו, ומה חשוב לזכור לשבוע הבא.' : 'What worked, what repeated, and what should stay top of mind next week.'}
              value={form.lessons}
              onChange={value => setForm(prev => ({ ...prev, lessons: value }))}
            />
            <JournalField
              label={language === 'he' ? 'מה אני משפר בשבוע הבא?' : 'What will I improve next week?'}
              placeholder={language === 'he' ? 'בחר פעולה אחת או שתיים: פחות עסקאות, להמתין לאישור, לעצור אחרי 2 הפסדים...' : 'Choose one or two actions: fewer trades, wait for confirmation, stop after 2 losses...'}
              value={form.improvements}
              onChange={value => setForm(prev => ({ ...prev, improvements: value }))}
            />

            <div className="save-row">
              <button onClick={saveReport} disabled={saving}>
                <Icon name="save" size={17} />
                {saving ? (language === 'he' ? 'שומר...' : 'Saving...') : selectedReport ? (language === 'he' ? 'עדכן דוח' : 'Update report') : (language === 'he' ? 'שמור דוח שבועי' : 'Save weekly report')}
              </button>
              {message && <span>{message}</span>}
            </div>
          </div>
        </section>

        <aside className="weekly-report-sidebar">
          <div className="sidebar-heading">
            <span>{language === 'he' ? 'דוחות שמורים' : 'Saved reports'}</span>
            <strong>{monthLabel}</strong>
          </div>
          <div className="report-list">
            {reports.length === 0 ? (
              <p>{language === 'he' ? 'אין דוחות שמורים בחודש הזה עדיין.' : 'No saved reports in this month yet.'}</p>
            ) : reports.map(report => {
              const active = report.week_start === toDateInput(selectedWeek)
              const reportStart = parseInputDate(report.week_start)
              const reportEnd = parseInputDate(report.week_end)
              return (
                <button key={report.id} data-active={active ? '1' : '0'} onClick={() => selectWeek(reportStart)}>
                  <span>{reportStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} - {reportEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
                  <Icon name={isRTL ? 'chevron_left' : 'chevron_right'} size={16} />
                </button>
              )
            })}
          </div>
        </aside>
      </div>

      <style>{`
        .weekly-report-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: 28px;
          align-items: start;
        }
        .weekly-report-main,
        .weekly-report-sidebar {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 24px 0;
        }
        .weekly-toolbar {
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) 42px auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 26px;
        }
        .weekly-nav-btn {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text2);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: color .15s, border-color .15s, background .15s;
        }
        .weekly-nav-btn:hover {
          color: #0f8d63;
          border-color: rgba(15,141,99,.35);
          background: rgba(15,141,99,.08);
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
        .weekly-date-controls {
          display: flex;
          gap: 8px;
        }
        .weekly-date-controls input {
          height: 42px;
          background: var(--bg3);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 10px;
          padding: 0 12px;
          font-family: Heebo, sans-serif;
          font-weight: 750;
          color-scheme: dark;
        }
        .weekly-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          margin-bottom: 28px;
        }
        .weekly-loading {
          color: var(--text3);
          font-size: 13px;
          font-weight: 800;
          margin: -12px 0 18px;
        }
        .metric {
          padding: 18px 16px;
          border-inline-end: 1px solid var(--border);
        }
        .metric:last-child { border-inline-end: none; }
        .metric span {
          display: block;
          color: var(--text3);
          font-size: 12px;
          font-weight: 850;
          letter-spacing: .06em;
          margin-bottom: 7px;
        }
        .metric strong {
          display: block;
          color: var(--text);
          font-size: 24px;
          font-weight: 950;
          line-height: 1;
        }
        [data-tone="good"] { color: #22c55e !important; }
        [data-tone="bad"] { color: #ef4444 !important; }
        [data-tone="warn"] { color: #f59e0b !important; }
        .weekly-split {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(260px, .85fr);
          gap: 34px;
          margin-bottom: 34px;
        }
        .section-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
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
        .daily-row,
        .highlight-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          gap: 14px;
          align-items: center;
          padding: 13px 0;
          border-bottom: 1px solid var(--border);
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
        }
        .daily-row b,
        .highlight-row b {
          color: var(--text);
          font-size: 15px;
          font-weight: 950;
          white-space: nowrap;
        }
        .journal-area {
          border-top: 1px solid var(--border);
          padding-top: 24px;
        }
        .journal-field {
          padding: 18px 0;
          border-bottom: 1px solid var(--border);
        }
        .journal-field label {
          display: block;
          color: var(--text);
          font-size: 15px;
          font-weight: 900;
          margin-bottom: 8px;
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
          line-height: 1.65;
          padding: 0;
        }
        .journal-field textarea::placeholder { color: var(--text3); }
        .save-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 18px;
          flex-wrap: wrap;
        }
        .save-row button {
          border: none;
          background: #0f8d63;
          color: #fff;
          border-radius: 12px;
          padding: 12px 22px;
          font-family: Heebo, sans-serif;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform .15s, background .15s;
        }
        .save-row button:hover { transform: translateY(-1px); background: #12a875; }
        .save-row button:disabled { opacity: .7; cursor: wait; transform: none; }
        .save-row span {
          color: var(--text3);
          font-size: 13px;
          font-weight: 750;
        }
        .sidebar-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .sidebar-heading span {
          color: var(--text);
          font-weight: 950;
          font-size: 16px;
        }
        .sidebar-heading strong {
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
          text-align: end;
        }
        .report-list {
          display: grid;
          gap: 2px;
        }
        .report-list p {
          color: var(--text3);
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
          padding: 12px 0;
        }
        .report-list button {
          border: none;
          border-bottom: 1px solid var(--border);
          background: transparent;
          color: var(--text2);
          min-height: 46px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          font-family: Heebo, sans-serif;
          font-weight: 850;
          padding: 0;
          text-align: start;
        }
        .report-list button[data-active="1"],
        .report-list button:hover {
          color: #0f8d63;
        }
        @media (max-width: 980px) {
          .weekly-report-shell { grid-template-columns: 1fr; gap: 20px; }
          .weekly-toolbar { grid-template-columns: 42px minmax(0, 1fr) 42px; }
          .weekly-date-controls { grid-column: 1 / -1; }
          .weekly-date-controls input { width: 100%; min-width: 0; }
          .weekly-split { grid-template-columns: 1fr; gap: 24px; }
        }
        @media (max-width: 640px) {
          .weekly-report-main,
          .weekly-report-sidebar { padding: 18px 0; }
          .weekly-title-block h3 { font-size: 20px; }
          .weekly-metrics { grid-template-columns: 1fr 1fr; }
          .metric:nth-child(2) { border-inline-end: none; }
          .metric { padding: 15px 10px; }
          .metric strong { font-size: 20px; }
          .daily-row { grid-template-columns: minmax(0, 1fr) auto; }
          .daily-row b { grid-column: 1 / -1; }
          .save-row button { width: 100%; justify-content: center; }
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
