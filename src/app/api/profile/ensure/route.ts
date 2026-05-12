import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function profileFromUser(user: any) {
  return {
    id: user.id,
    email: user.email || null,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null,
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
  }
}

export async function POST() {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = profileFromUser(user)

  if (isSupabaseAdminConfigured) {
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
