'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'
import { useApp } from '@/lib/app-context'

type BrokerType = 'tradovate' | 'rithmic' | 'mt5' | 'ftmo'
type Status = 'active' | 'locked' | 'disabled'

interface Connection {
  id: string
  broker: BrokerType
  account_label: string
  daily_loss_limit: number
  per_trade_loss_limit: number
  status: Status
  locked_at: string | null
  locked_reason: string | null
  daily_realized_pnl: number
  last_check_at: string | null
  created_at: string
}

const BROKERS: Array<{ value: BrokerType; label: string; available: boolean; note: string }> = [
  { value: 'tradovate', label: 'Tradovate', available: true, note: 'REST API ישיר. נדרשים App ID + CID + Secret מהאתר של Tradovate.' },
  { value: 'rithmic', label: 'Rithmic', available: false, note: 'WebSocket protocol — אינטגרציה בעבודה.' },
  { value: 'mt5', label: 'MetaTrader 5', available: false, note: 'דרוש EA מקומי או MetaApi.cloud.' },
  { value: 'ftmo', label: 'FTMO', available: false, note: 'תלוי בפלטפורמה שבחרת ב־FTMO.' },
]

const card = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
}

export default function TraderLockerPage() {
  const { language } = useApp()
  const isHe = language === 'he'
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [form, setForm] = useState({
    broker: 'tradovate' as BrokerType,
    account_label: '',
    username: '',
    password: '',
    appId: '',
    cid: '',
    secret: '',
    server: '',
    system: '',
    environment: 'demo' as 'demo' | 'live',
    daily_loss_limit: '',
    per_trade_loss_limit: '',
  })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/broker/connections')
    const data = await res.json()
    if (res.ok) setConnections(data.connections || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy('submit')
    try {
      const res = await fetch('/api/broker/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          daily_loss_limit: Number(form.daily_loss_limit) || 0,
          per_trade_loss_limit: Number(form.per_trade_loss_limit) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      toast.success(isHe ? 'החשבון חובר בהצלחה' : 'Connected')
      setShowForm(false)
      setForm({ ...form, password: '', secret: '' })
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function check(id: string) {
    setBusy(id)
    try {
      const res = await fetch('/api/broker/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.locked) toast.error(isHe ? 'הגעת ללימיט — החשבון ננעל' : 'Limit hit — account locked')
      else toast.success(isHe ? `נבדק: P&L יומי ${data.snapshot.realizedPnl.toFixed(2)}$` : `OK: daily P&L ${data.snapshot.realizedPnl.toFixed(2)}$`)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally { setBusy(null) }
  }

  async function unlock(id: string) {
    if (!confirm(isHe ? 'לפתוח את הנעילה? המשמעת היומית שלך תאופס.' : 'Unlock this account?')) return
    setBusy(id)
    try {
      const res = await fetch('/api/broker/unlock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success(isHe ? 'נפתח' : 'Unlocked')
      load()
    } catch { toast.error(isHe ? 'שגיאה' : 'Error') }
    finally { setBusy(null) }
  }

  async function remove(id: string) {
    if (!confirm(isHe ? 'למחוק את החיבור? הסיסמה תימחק מהמערכת.' : 'Delete this connection?')) return
    setBusy(id)
    try {
      const res = await fetch(`/api/broker/connections?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success(isHe ? 'נמחק' : 'Deleted')
      load()
    } catch { toast.error(isHe ? 'שגיאה' : 'Error') }
    finally { setBusy(null) }
  }

  const selectedBroker = BROKERS.find(b => b.value === form.broker)!

  return (
    <div>
      <PageHeader
        icon="lock"
        title="TraderLocker"
        subtitle={isHe
          ? 'חבר חשבון ברוקר, הגדר לימיט הפסד יומי, ונעל את החשבון אוטומטית כשתגיע אליו.'
          : 'Link a broker account, set a daily loss limit, and auto-lock when you hit it.'}
      />

      <div style={{ ...card, padding: '16px 18px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start', borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
        <Icon name="warning" size={18} color="#f59e0b" />
        <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
          {isHe
            ? 'הסיסמה מוצפנת ב־AES-256-GCM צד־שרת ולעולם לא מוחזרת לדפדפן אחרי שמירה. אינטגרציית הנעילה ב־Tradovate מבטלת פקודות ממתינות; סגירת פוזיציות פתוחות מבוצעת ידנית. שאר הברוקרים בעבודה.'
            : 'Credentials are encrypted at rest with AES-256-GCM and never returned to the client. Tradovate lock cancels working orders; positions must be closed manually. Other brokers are WIP.'}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '15px', color: 'var(--text3)' }}>
          {connections.length} {isHe ? 'חיבורים פעילים' : 'connections'}
        </div>
        <button onClick={() => setShowForm(s => !s)} style={{
          background: '#0f8d63', color: '#fff', border: 'none', borderRadius: '10px',
          padding: '10px 18px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
          fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Icon name={showForm ? 'close' : 'add'} size={16} color="#fff" />
          {showForm ? (isHe ? 'ביטול' : 'Cancel') : (isHe ? 'חבר חשבון' : 'Connect account')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} style={{ ...card, padding: '24px', marginBottom: '24px' }}>
          {form.broker === 'tradovate' && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: '700', color: 'var(--text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="info" size={14} color="#0f8d63" />
                {isHe ? 'איפה משיגים את הפרטים?' : 'Where to get these'}
              </div>
              {isHe ? (
                <>
                  היכנס ל־<a href="https://trader.tradovate.com" target="_blank" rel="noopener" style={{ color: '#0f8d63', textDecoration: 'underline' }}>trader.tradovate.com</a> →
                  Settings → <b>API Access</b> → Create New Application. תקבל מספר <b>CID</b> ומחרוזת <b>Secret</b>. בשדה <b>App ID</b> תכתוב סתם שם (כמו TradeIX). <b>שם משתמש וסיסמה</b> = אלה שמתחברים איתם לפלטפורמה.
                </>
              ) : (
                <>
                  Log in at <a href="https://trader.tradovate.com" target="_blank" rel="noopener" style={{ color: '#0f8d63', textDecoration: 'underline' }}>trader.tradovate.com</a> → Settings → <b>API Access</b> → Create New Application. You'll get a <b>CID</b> and <b>Secret</b>. <b>App ID</b> is just a label (e.g. "TradeIX"). <b>Username/password</b> are the same as your Tradovate login.
                </>
              )}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <Field label={isHe ? 'ברוקר' : 'Broker'}>
              <select value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value as BrokerType }))} style={inputStyle}>
                {BROKERS.map(b => (
                  <option key={b.value} value={b.value} disabled={!b.available}>
                    {b.label}{!b.available ? ' (בקרוב)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isHe ? 'תווית חשבון' : 'Account label'} help={isHe ? 'סתם תווית פנימית כדי שתזהה את החשבון בקלות. לדוגמה: "Live 50K" או "FTMO Challenge".' : 'Just an internal label so you can recognize this account, e.g. "Live 50K" or "FTMO Challenge".'}>
              <input value={form.account_label} onChange={e => setForm(f => ({ ...f, account_label: e.target.value }))} placeholder={isHe ? 'לדוגמה: Live 50K' : 'e.g. Live 50K'} style={inputStyle} />
            </Field>
            <Field label={isHe ? 'שם משתמש' : 'Username'} help={isHe ? 'שם המשתמש שאיתו אתה מתחבר לפלטפורמת הברוקר (לא האימייל בהכרח).' : 'The username you use to log into the broker platform (not necessarily your email).'}>
              <input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} style={inputStyle} autoComplete="off" />
            </Field>
            <Field label={isHe ? 'סיסמה' : 'Password'} help={isHe ? 'הסיסמה לחשבון הברוקר. נשמרת מוצפנת AES-256-GCM צד־שרת ואף פעם לא חוזרת לדפדפן.' : 'Your broker account password. Stored AES-256-GCM encrypted server-side, never returned to the browser.'}>
              <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} autoComplete="new-password" />
            </Field>
            {form.broker === 'tradovate' && (
              <>
                <Field label="App ID" help={isHe ? 'תווית של האפליקציה שמתחברת ל־API. אפשר פשוט לכתוב TradeIX.' : 'A label for the app connecting to the API. Just enter "TradeIX".'}>
                  <input value={form.appId} onChange={e => setForm(f => ({ ...f, appId: e.target.value }))} placeholder="TradeIX" style={inputStyle} />
                </Field>
                <Field label="CID" help={isHe ? 'Client ID — מזהה מספרי שמקבלים מ־Tradovate. בכניסה ל־trader.tradovate.com → Settings → API Access → צור אפליקציה חדשה.' : 'Client ID — a numeric ID from Tradovate. Get it at trader.tradovate.com → Settings → API Access → create application.'}>
                  <input value={form.cid} onChange={e => setForm(f => ({ ...f, cid: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Secret" help={isHe ? 'סוד הצפנה שמתקבל יחד עם ה־CID. Tradovate מציג אותו פעם אחת בלבד — אם איבדת אותו תצטרך ליצור אפליקציה חדשה.' : 'A secret string issued alongside the CID. Tradovate shows it only once — if lost, create a new application.'}>
                  <input type="password" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} style={inputStyle} autoComplete="new-password" />
                </Field>
                <Field label={isHe ? 'סביבה' : 'Environment'} help={isHe ? 'Demo = חשבון התנסות (חינמי). Live = חשבון אמיתי. תתחיל מ־Demo.' : 'Demo = paper account. Live = real money. Start with Demo.'}>
                  <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value as any }))} style={inputStyle}>
                    <option value="demo">Demo</option>
                    <option value="live">Live</option>
                  </select>
                </Field>
              </>
            )}
            {(form.broker === 'mt5' || form.broker === 'ftmo') && (
              <Field label="Server" help={isHe ? 'שם שרת ה־MT5 שהברוקר נתן לך (לדוגמה: "FTMO-Demo2" או "ICMarkets-Live04").' : 'The MT5 server name your broker assigned (e.g. "FTMO-Demo2" or "ICMarkets-Live04").'}>
                <input value={form.server} onChange={e => setForm(f => ({ ...f, server: e.target.value }))} style={inputStyle} />
              </Field>
            )}
            {form.broker === 'rithmic' && (
              <Field label="System" help={isHe ? 'שם המערכת ב־Rithmic (לדוגמה: "Rithmic 01" או "Rithmic Paper Trading").' : 'Rithmic system name (e.g. "Rithmic 01" or "Rithmic Paper Trading").'}>
                <input value={form.system} onChange={e => setForm(f => ({ ...f, system: e.target.value }))} style={inputStyle} />
              </Field>
            )}
            <Field label={isHe ? 'לימיט הפסד יומי ($)' : 'Daily loss limit ($)'} help={isHe ? 'אם ה־P&L היומי שלך בחשבון הברוקר ירד מתחת לסכום הזה, המערכת תנעל את החשבון ותבטל פקודות פתוחות. השאר 0 כדי לכבות.' : 'If your daily realized P&L drops below this, the system locks the account and cancels open orders. Leave 0 to disable.'}>
              <input type="number" min="0" value={form.daily_loss_limit} onChange={e => setForm(f => ({ ...f, daily_loss_limit: e.target.value }))} placeholder="500" style={inputStyle} />
            </Field>
            <Field label={isHe ? 'לימיט הפסד לעסקה ($)' : 'Per-trade loss limit ($)'} help={isHe ? 'הפסד מקסימלי שאתה מוכן לקחת בעסקה בודדת. מוצג כתזכורת — לא נאכף אוטומטית בברוקר.' : 'Max loss you’re willing to take on a single trade. Used as a reminder; not enforced at broker level yet.'}>
              <input type="number" min="0" value={form.per_trade_loss_limit} onChange={e => setForm(f => ({ ...f, per_trade_loss_limit: e.target.value }))} placeholder="200" style={inputStyle} />
            </Field>
          </div>

          <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text3)' }}>{selectedBroker.note}</div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={busy === 'submit' || !selectedBroker.available} style={{
              background: selectedBroker.available ? '#0f8d63' : 'var(--bg3)',
              color: '#fff', border: 'none', borderRadius: '10px', padding: '11px 22px',
              fontSize: '14px', fontWeight: '700', cursor: selectedBroker.available ? 'pointer' : 'not-allowed',
              fontFamily: 'Heebo, sans-serif', opacity: busy === 'submit' ? 0.6 : 1,
            }}>
              {busy === 'submit' ? (isHe ? 'מתחבר...' : 'Connecting...') : (isHe ? 'בדוק וחבר' : 'Test & connect')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ ...card, padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>{isHe ? 'טוען...' : 'Loading...'}</div>
      ) : connections.length === 0 ? (
        <div style={{ ...card, padding: '60px 20px', textAlign: 'center' }}>
          <Icon name="lock" size={36} color="var(--bg4)" />
          <p style={{ fontSize: '15px', color: 'var(--text3)', marginTop: '12px' }}>
            {isHe ? 'עדיין לא חיברת חשבון ברוקר.' : 'No broker connected yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {connections.map(c => {
            const meta = BROKERS.find(b => b.value === c.broker)!
            const locked = c.status === 'locked'
            return (
              <div key={c.id} style={{
                ...card,
                padding: '20px 22px',
                border: locked ? '1px solid #ef4444' : '1px solid var(--border)',
                background: locked ? 'rgba(239,68,68,0.04)' : 'var(--bg2)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icon name={locked ? 'lock' : 'shield'} size={18} color={locked ? '#ef4444' : '#0f8d63'} />
                      <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)' }}>{c.account_label}</div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', background: 'var(--bg3)', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>{meta.label}</span>
                      <span style={{
                        fontSize: '11px', fontWeight: '700',
                        color: locked ? '#ef4444' : '#0f8d63',
                        background: locked ? 'rgba(239,68,68,0.1)' : 'rgba(15,141,99,0.1)',
                        padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase',
                      }}>{locked ? (isHe ? 'נעול' : 'Locked') : (isHe ? 'פעיל' : 'Active')}</span>
                    </div>
                    {locked && c.locked_reason && (
                      <div style={{ fontSize: '13px', color: '#ef4444', marginTop: '8px' }}>
                        {isHe ? 'סיבת נעילה' : 'Reason'}: {c.locked_reason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => check(c.id)} disabled={busy === c.id} style={btnSecondary}>
                      <Icon name="update" size={14} color="currentColor" />
                      {isHe ? 'בדוק עכשיו' : 'Check now'}
                    </button>
                    {locked && (
                      <button onClick={() => unlock(c.id)} disabled={busy === c.id} style={{ ...btnSecondary, color: '#0f8d63' }}>
                        <Icon name="lock_open" size={14} color="currentColor" />
                        {isHe ? 'פתח נעילה' : 'Unlock'}
                      </button>
                    )}
                    <button onClick={() => remove(c.id)} disabled={busy === c.id} style={{ ...btnSecondary, color: '#ef4444' }}>
                      <Icon name="delete" size={14} color="currentColor" />
                      {isHe ? 'מחק' : 'Delete'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1px', background: 'var(--border)', marginTop: '16px', borderRadius: '10px', overflow: 'hidden' }}>
                  <Stat label={isHe ? 'לימיט יומי' : 'Daily limit'} value={c.daily_loss_limit > 0 ? `$${c.daily_loss_limit}` : '—'} />
                  <Stat label={isHe ? 'לעסקה' : 'Per trade'} value={c.per_trade_loss_limit > 0 ? `$${c.per_trade_loss_limit}` : '—'} />
                  <Stat
                    label={isHe ? 'P&L יומי' : 'Daily P&L'}
                    value={`${c.daily_realized_pnl >= 0 ? '+' : ''}$${Number(c.daily_realized_pnl).toFixed(2)}`}
                    color={c.daily_realized_pnl >= 0 ? '#22c55e' : '#ef4444'}
                  />
                  <Stat label={isHe ? 'בדיקה אחרונה' : 'Last check'} value={c.last_check_at ? new Date(c.last_check_at).toLocaleString(isHe ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '—'} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg3)',
  border: '1px solid var(--border)', borderRadius: '10px',
  color: 'var(--text)', fontSize: '14px', fontFamily: 'Heebo, sans-serif', outline: 'none',
}

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
  padding: '7px 12px', fontSize: '13px', fontWeight: '600', color: 'var(--text2)',
  cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        {help && (
          <span className="tl-help" tabIndex={0} aria-label={help} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '15px', height: '15px', borderRadius: '50%',
            background: 'var(--bg3)', border: '1px solid var(--border)',
            color: 'var(--text3)', fontSize: '10px', fontWeight: '700',
            cursor: 'help', userSelect: 'none', position: 'relative',
            textTransform: 'none', letterSpacing: 0,
          }}>
            ?
            <span className="tl-tip" role="tooltip" style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
              transform: 'translateX(-50%)',
              background: '#0f1117', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: '8px',
              padding: '8px 12px', fontSize: '12px', fontWeight: '500',
              lineHeight: 1.5, letterSpacing: 'normal', textTransform: 'none',
              width: 'max-content', maxWidth: '260px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 30,
              opacity: 0, pointerEvents: 'none',
              transition: 'opacity 0.15s ease',
              whiteSpace: 'normal', textAlign: 'start',
            }}>{help}</span>
          </span>
        )}
      </span>
      {children}
      <style>{`
        .tl-help:hover .tl-tip,
        .tl-help:focus .tl-tip { opacity: 1 !important; }
        .tl-help:hover { color: var(--text); border-color: #0f8d63; }
      `}</style>
    </label>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', padding: '12px 14px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: '700', color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}
