import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const { error } = await supabase
    .from('broker_connections')
    .update({ status: 'active', locked_at: null, locked_reason: null, daily_realized_pnl: 0 })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('broker_lock_events').insert({ connection_id: id, event: 'unlocked', message: 'manual reset' })
  return NextResponse.json({ ok: true })
}
