import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptJSON } from '@/lib/crypto'
import { ADAPTERS, BrokerCredentials, BrokerType } from '@/lib/brokers'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const { data: conn, error } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (error || !conn) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let snapshot
  try {
    const creds = decryptJSON<BrokerCredentials>(conn.encrypted_credentials)
    snapshot = await ADAPTERS[conn.broker as BrokerType].fetchDailySnapshot(creds)
  } catch (e: any) {
    await supabase.from('broker_lock_events').insert({
      connection_id: conn.id, event: 'error', message: e?.message || 'fetch failed',
    })
    return NextResponse.json({ error: e?.message || 'fetch failed' }, { status: 502 })
  }

  const dailyLimit = Number(conn.daily_loss_limit) || 0
  const reachedLimit = dailyLimit > 0 && snapshot.realizedPnl <= -Math.abs(dailyLimit)

  const updates: any = {
    daily_realized_pnl: snapshot.realizedPnl,
    last_check_at: new Date().toISOString(),
  }

  if (reachedLimit && conn.status === 'active') {
    try {
      const creds = decryptJSON<BrokerCredentials>(conn.encrypted_credentials)
      const lockResult = await ADAPTERS[conn.broker as BrokerType].lockAccount(creds)
      updates.status = 'locked'
      updates.locked_at = new Date().toISOString()
      updates.locked_reason = `daily limit reached (${snapshot.realizedPnl.toFixed(2)} ≤ -${dailyLimit})`
      await supabase.from('broker_lock_events').insert({
        connection_id: conn.id, event: 'locked', realized_pnl: snapshot.realizedPnl,
        message: lockResult.message || 'auto-lock',
      })
    } catch (e: any) {
      await supabase.from('broker_lock_events').insert({
        connection_id: conn.id, event: 'error', realized_pnl: snapshot.realizedPnl,
        message: `lock failed: ${e?.message}`,
      })
    }
  } else {
    await supabase.from('broker_lock_events').insert({
      connection_id: conn.id, event: 'check', realized_pnl: snapshot.realizedPnl,
    })
  }

  await supabase.from('broker_connections').update(updates).eq('id', conn.id)

  return NextResponse.json({ snapshot, locked: reachedLimit, status: updates.status || conn.status })
}
