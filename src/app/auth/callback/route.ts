import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const TRIAL_DAYS = 5

function getTrialEndsAt() {
  return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

function canGrantSignupTrial(profile: any) {
  if (!profile) return true
  if (profile.lemon_squeezy_subscription_id) return false
  if (profile.subscription_trial_ends_at) return false
  const tier = profile.subscription_tier || 'free'
  const status = profile.subscription_status || 'free'
  return tier === 'free' && (status === 'free' || status === null)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const client = isSupabaseAdminConfigured ? createAdminClient() : supabase
        const { data: existingProfile } = await client
          .from('profiles')
          .select('created_at, subscription_tier, subscription_status, subscription_trial_ends_at, lemon_squeezy_subscription_id')
          .eq('id', user.id)
          .maybeSingle()

        const baseProfile = {
          id: user.id,
          email: user.email || null,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        }

        const profile = {
          ...baseProfile,
          ...(canGrantSignupTrial(existingProfile) ? {
            subscription_tier: 'pro',
            subscription_status: 'temporary_trial',
            subscription_trial_ends_at: getTrialEndsAt(),
            subscription_updated_at: new Date().toISOString(),
          } : {}),
        }

        const { error: upsertError } = await client.from('profiles').upsert(profile, { onConflict: 'id' })

        if (upsertError && Object.prototype.hasOwnProperty.call(profile, 'subscription_tier')) {
          await client.from('profiles').upsert(baseProfile, { onConflict: 'id' })
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
