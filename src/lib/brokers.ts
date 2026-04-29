export type BrokerType = 'tradovate' | 'rithmic' | 'mt5' | 'ftmo'

export interface BrokerCredentials {
  username: string
  password: string
  appId?: string
  appVersion?: string
  cid?: string
  secret?: string
  deviceId?: string
  server?: string
  system?: string
  environment?: 'demo' | 'live'
}

export interface BrokerSnapshot {
  realizedPnl: number
  unrealizedPnl: number
  balance: number
  openPositions: number
  asOf: string
}

export interface BrokerAdapter {
  type: BrokerType
  available: boolean
  testConnection(c: BrokerCredentials): Promise<{ ok: boolean; message?: string }>
  fetchDailySnapshot(c: BrokerCredentials): Promise<BrokerSnapshot>
  lockAccount(c: BrokerCredentials): Promise<{ ok: boolean; message?: string }>
}

export const BROKER_META: Record<BrokerType, {
  label: string
  available: boolean
  fields: Array<'username' | 'password' | 'appId' | 'cid' | 'secret' | 'server' | 'system' | 'environment'>
  note: string
}> = {
  tradovate: {
    label: 'Tradovate',
    available: true,
    fields: ['username', 'password', 'appId', 'cid', 'secret', 'environment'],
    note: 'REST API ישיר. דרוש App ID + CID + Secret מהאתר של Tradovate.',
  },
  rithmic: {
    label: 'Rithmic',
    available: false,
    fields: ['username', 'password', 'system'],
    note: 'דורש WebSocket protocol מורכב — אינטגרציה מלאה בעבודה.',
  },
  mt5: {
    label: 'MetaTrader 5',
    available: false,
    fields: ['username', 'password', 'server'],
    note: 'אין REST רשמי. דרוש EA מקומי או שירות MetaApi.cloud.',
  },
  ftmo: {
    label: 'FTMO',
    available: false,
    fields: ['username', 'password', 'server'],
    note: 'משתמש בפלטפורמת MT/cTrader/DXTrade — אינטגרציה תלויה בבחירת המסחר ב־FTMO.',
  },
}

const TRADOVATE_BASE = (env: 'demo' | 'live' = 'demo') =>
  env === 'live' ? 'https://live.tradovateapi.com/v1' : 'https://demo.tradovateapi.com/v1'

async function tradovateAuth(c: BrokerCredentials): Promise<{ token: string; expires: string }> {
  const env = c.environment || 'demo'
  const res = await fetch(`${TRADOVATE_BASE(env)}/auth/accessTokenRequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: c.username,
      password: c.password,
      appId: c.appId || 'TradeIX',
      appVersion: '1.0',
      cid: c.cid,
      sec: c.secret,
      deviceId: c.deviceId || 'tradeix-server',
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Tradovate auth failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  if (!data.accessToken) throw new Error(data['p-ticket'] ? 'CAPTCHA required' : (data.errorText || 'No access token'))
  return { token: data.accessToken, expires: data.expirationTime }
}

const tradovateAdapter: BrokerAdapter = {
  type: 'tradovate',
  available: true,
  async testConnection(c) {
    try {
      await tradovateAuth(c)
      return { ok: true, message: 'התחברות הצליחה' }
    } catch (e: any) {
      return { ok: false, message: e?.message || 'שגיאה לא ידועה' }
    }
  },
  async fetchDailySnapshot(c) {
    const env = c.environment || 'demo'
    const { token } = await tradovateAuth(c)
    const auth = { Authorization: `Bearer ${token}` }
    const accountsRes = await fetch(`${TRADOVATE_BASE(env)}/account/list`, { headers: auth })
    const accounts = await accountsRes.json()
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return { realizedPnl: 0, unrealizedPnl: 0, balance: 0, openPositions: 0, asOf: new Date().toISOString() }
    }
    const accountId = accounts[0].id
    const cashRes = await fetch(`${TRADOVATE_BASE(env)}/cashBalance/getCashBalanceSnapshot?accountId=${accountId}`, { headers: auth })
    const cash = await cashRes.json()
    const posRes = await fetch(`${TRADOVATE_BASE(env)}/position/list`, { headers: auth })
    const positions = await posRes.json()
    const openPositions = Array.isArray(positions) ? positions.filter((p: any) => p.netPos !== 0).length : 0
    return {
      realizedPnl: Number(cash?.totalCashValue ?? 0) - Number(cash?.amount ?? 0),
      unrealizedPnl: Number(cash?.openPnL ?? 0),
      balance: Number(cash?.totalCashValue ?? cash?.amount ?? 0),
      openPositions,
      asOf: new Date().toISOString(),
    }
  },
  async lockAccount(c) {
    try {
      const env = c.environment || 'demo'
      const { token } = await tradovateAuth(c)
      const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const accountsRes = await fetch(`${TRADOVATE_BASE(env)}/account/list`, { headers: auth })
      const accounts = await accountsRes.json()
      if (!Array.isArray(accounts) || accounts.length === 0) return { ok: false, message: 'לא נמצא חשבון' }
      const accountId = accounts[0].id
      const ordersRes = await fetch(`${TRADOVATE_BASE(env)}/order/list`, { headers: auth })
      const orders = await ordersRes.json()
      const working = Array.isArray(orders) ? orders.filter((o: any) => o.accountId === accountId && ['Working', 'PendingNew', 'Pending'].includes(o.ordStatus)) : []
      for (const o of working) {
        await fetch(`${TRADOVATE_BASE(env)}/order/cancelorder`, { method: 'POST', headers: auth, body: JSON.stringify({ orderId: o.id }) })
      }
      return { ok: true, message: `בוטלו ${working.length} פקודות פתוחות. סגירת פוזיציות ידנית נדרשת.` }
    } catch (e: any) {
      return { ok: false, message: e?.message || 'שגיאה' }
    }
  },
}

const stub = (type: BrokerType): BrokerAdapter => ({
  type,
  available: false,
  async testConnection() { return { ok: false, message: 'אינטגרציית הברוקר עדיין לא זמינה.' } },
  async fetchDailySnapshot() { throw new Error(`${type} adapter not implemented`) },
  async lockAccount() { return { ok: false, message: 'נעילת חשבון לא זמינה לברוקר זה.' } },
})

export const ADAPTERS: Record<BrokerType, BrokerAdapter> = {
  tradovate: tradovateAdapter,
  rithmic: stub('rithmic'),
  mt5: stub('mt5'),
  ftmo: stub('ftmo'),
}
