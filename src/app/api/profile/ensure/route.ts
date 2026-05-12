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

async function upsertProfile(client: ReturnType<typeof createAdminClient> | ReturnType<typeof createClient>, profile: Record<string, unknown>) {
  const fullResult = await client.from('profiles').upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
  if (!fullResult.error) return { error: null, fallback: false }

  // If an optional profile column was removed in Supabase, still create the
  // required profile row so billing/profile lookups have a user record.
  const minimalResult = await client
    .from('profiles')
    .upsert({ id: profile.id }, { onConflict: 'id', ignoreDuplicates: true })

  return { error: minimalResult.error, fallback: true, originalError: fullResult.error.message }
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
    const result = await upsertProfile(admin, profile)
    if (result.error) {
      return NextResponse.json({
        error: result.error.message,
        originalError: result.originalError,
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true, fallback: result.fallback })
  } else {
    const result = await upsertProfile(supabase, profile)
    if (result.error) {
      return NextResponse.json({
        error: result.error.message,
        originalError: result.originalError,
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true, fallback: result.fallback })
  }
}
