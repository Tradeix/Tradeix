import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptJSON } from '@/lib/crypto'
import { ADAPTERS, BROKER_META, BrokerType, BrokerCredentials } from '@/lib/brokers'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('broker_connections')
    .select('id, broker, account_label, daily_loss_limit, per_trade_loss_limit, status, locked_at, locked_reason, daily_realized_pnl, last_check_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ connections: data })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const broker = body.broker as BrokerType
  if (!BROKER_META[broker]) return NextResponse.json({ error: 'invalid broker' }, { status: 400 })
  if (!BROKER_META[broker].available) return NextResponse.json({ error: 'broker not yet supported' }, { status: 400 })

  const creds: BrokerCredentials = {
    username: body.username,
    password: body.password,
    appId: body.appId,
    cid: body.cid,
    secret: body.secret,
    server: body.server,
    system: body.system,
    environment: body.environment || 'demo',
  }
  if (!creds.username || !creds.password) return NextResponse.json({ error: 'missing credentials' }, { status: 400 })

  const test = await ADAPTERS[broker].testConnection(creds)
  if (!test.ok) return NextResponse.json({ error: test.message || 'connection failed' }, { status: 400 })

  const encrypted_credentials = encryptJSON(creds)

  const { data, error } = await supabase
    .from('broker_connections')
    .insert({
      user_id: user.id,
      broker,
      account_label: body.account_label || creds.username,
      encrypted_credentials,
      daily_loss_limit: Number(body.daily_loss_limit) || 0,
      per_trade_loss_limit: Number(body.per_trade_loss_limit) || 0,
      status: 'active',
    })
    .select('id, broker, account_label, daily_loss_limit, per_trade_loss_limit, status, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ connection: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const { error } = await supabase.from('broker_connections').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
