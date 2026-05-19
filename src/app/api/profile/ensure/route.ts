import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const TRIAL_DAYS = 5

function trialEndsAt() {
  return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

function hasPaidSubscription(profile: any) {
  if (!profile) return false
  return profile.subscription_status === 'active' || profile.subscription_status === 'on_trial'
}

function shouldGrantSignupTrial(profile: any) {
  if (hasPaidSubscription(profile)) return false
  if (!profile) return true
  if (profile.subscription_status === 'temporary_trial') return false
  if (profile.subscription_status === 'trial_expired') return false
  if (profile.subscription_status === 'free_after_trial') return false
  const tier = profile.subscription_tier || 'free'
  const status = profile.subscription_status || 'free'
  return tier === 'free' || status === 'free' || status === 'trial_declined' || status === null
}

function profileFromUser(user: any, grantTrial: boolean) {
  const profile: Record<string, unknown> = {
    id: user.id,
    email: user.email || null,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null,
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
  }

  if (grantTrial) {
    profile.subscription_tier = 'pro'
    profile.subscription_status = 'temporary_trial'
    profile.subscription_trial_ends_at = trialEndsAt()
    profile.subscription_updated_at = new Date().toISOString()
  }

  return profile
}

async function upsertProfile(client: ReturnType<typeof createAdminClient> | ReturnType<typeof createClient>, profile: Record<string, unknown>) {
  const fullResult = await client.from('profiles').upsert(profile, { onConflict: 'id' })
  if (!fullResult.error) return { error: null, fallback: false }

  // If an optional profile column was removed in Supabase, still create the
  // required profile row so billing/profile lookups have a user record.
  const minimalResult = await client
    .from('profiles')
    .upsert({ id: profile.id }, { onConflict: 'id' })

  return { error: minimalResult.error, fallback: true, originalError: fullResult.error.message }
}

export async function POST() {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = isSupabaseAdminConfigured ? createAdminClient() : supabase
  const { data: existingProfile } = await client
    .from('profiles')
    .select('created_at, subscription_tier, subscription_status, subscription_trial_ends_at, lemon_squeezy_subscription_id')
    .eq('id', user.id)
    .maybeSingle()

  const grantTrial = shouldGrantSignupTrial(existingProfile)
  const profile = profileFromUser(user, grantTrial)
  const result = await upsertProfile(client, profile)

  if (result.error) {
    return NextResponse.json({
      error: result.error.message,
      originalError: result.originalError,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, fallback: result.fallback, trialGranted: grantTrial })
}
