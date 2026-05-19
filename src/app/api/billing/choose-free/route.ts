import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = {
    subscription_tier: 'free',
    subscription_status: 'trial_declined',
    subscription_renews_at: null,
    subscription_ends_at: null,
    subscription_trial_ends_at: new Date().toISOString(),
    subscription_updated_at: new Date().toISOString(),
  }

  const client = isSupabaseAdminConfigured ? createAdminClient() : supabase
  const { error } = await client.from('profiles').update(update).eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: update })
}
