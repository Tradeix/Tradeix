import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const TRIAL_DAYS = 5
const NEW_USER_GRACE_MS = 24 * 60 * 60 * 1000

function toIso(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function emptyFreeProfile() {
  return {
    subscription_tier: 'free',
    subscription_status: null,
    subscription_renews_at: null,
    subscription_ends_at: null,
    subscription_trial_ends_at: null,
    subscription_billing_period: null,
  }
}

function getBillingPeriod(variantId: string | null) {
  const monthlyVariantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID || null
  const yearlyVariantId = process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID || null

  if (variantId && yearlyVariantId && variantId === yearlyVariantId) return 'yearly'
  if (variantId && monthlyVariantId && variantId === monthlyVariantId) return 'monthly'
  return null
}

function isTemporaryTrial(profile: any) {
  return profile.subscription_status === 'temporary_trial' && !profile.lemon_squeezy_subscription_id
}

function trialEndsAt() {
  return new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

function isRecentTimestamp(value: unknown) {
  const createdAt = typeof value === 'string' ? new Date(value).getTime() : NaN
  return Number.isFinite(createdAt) && Date.now() - createdAt <= NEW_USER_GRACE_MS
}

function canGrantSignupTrial(profile: any, user: any) {
  if (!isRecentTimestamp(user.created_at) && !isRecentTimestamp(profile?.created_at)) return false
  if (!profile) return true
  if (profile.lemon_squeezy_subscription_id) return false
  if (profile.subscription_trial_ends_at) return false
  const tier = profile.subscription_tier || 'free'
  const status = profile.subscription_status || 'free'
  return tier === 'free' && (status === 'free' || status === null)
}

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('created_at, subscription_tier, subscription_status, subscription_renews_at, subscription_ends_at, subscription_trial_ends_at, lemon_squeezy_subscription_id, lemon_squeezy_variant_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Billing profile not found' }, { status: 404 })
  }

  if (canGrantSignupTrial(profile, user)) {
    const trialProfile = {
      subscription_tier: 'pro',
      subscription_status: 'temporary_trial',
      subscription_trial_ends_at: trialEndsAt(),
      subscription_updated_at: new Date().toISOString(),
    }
    const client = isSupabaseAdminConfigured ? createAdminClient() : supabase
    await client.from('profiles').update(trialProfile).eq('id', user.id)

    return NextResponse.json({
      profile: {
        ...trialProfile,
        subscription_renews_at: null,
        subscription_ends_at: null,
        subscription_billing_period: null,
      },
    })
  }

  if (profile.subscription_tier === 'free') {
    const subscriptionId = profile.lemon_squeezy_subscription_id ? String(profile.lemon_squeezy_subscription_id) : null

    if (isSupabaseAdminConfigured && subscriptionId) {
      const apiKey = process.env.LEMONSQUEEZY_API_KEY

      if (apiKey) {
        await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${apiKey}`,
          },
        }).catch(() => null)
      }

      const admin = createAdminClient()
      await admin.from('profiles').update({
        lemon_squeezy_subscription_id: null,
        lemon_squeezy_customer_id: null,
        lemon_squeezy_order_id: null,
        lemon_squeezy_product_id: null,
        lemon_squeezy_variant_id: null,
        lemon_squeezy_customer_portal_url: null,
        lemon_squeezy_update_payment_url: null,
        subscription_status: null,
        subscription_renews_at: null,
        subscription_ends_at: null,
        subscription_trial_ends_at: null,
        subscription_updated_at: new Date().toISOString(),
      }).eq('id', user.id)
    }

    return NextResponse.json({ profile: emptyFreeProfile() })
  }

  let nextProfile = profile
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const subscriptionId = profile.lemon_squeezy_subscription_id ? String(profile.lemon_squeezy_subscription_id) : null

  if (isTemporaryTrial(profile)) {
    const trialEndsAt = profile.subscription_trial_ends_at ? new Date(profile.subscription_trial_ends_at).getTime() : NaN
    const trialExpired = !Number.isFinite(trialEndsAt) || trialEndsAt <= Date.now()

    if (trialExpired && isSupabaseAdminConfigured) {
      const admin = createAdminClient()
      await admin.from('profiles').update({
        subscription_status: 'trial_expired',
        subscription_updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      nextProfile = { ...nextProfile, subscription_status: 'trial_expired' }
    }
  }

  if (apiKey && subscriptionId && isSupabaseAdminConfigured) {
    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
    }).catch(() => null)

    if (response?.ok) {
      const payload = await response.json().catch(() => null)
      const attributes = payload?.data?.attributes || {}
      const variantId = attributes.variant_id ? String(attributes.variant_id) : nextProfile.lemon_squeezy_variant_id
      const syncedProfile = {
        subscription_status: attributes.status || nextProfile.subscription_status,
        subscription_renews_at: toIso(attributes.renews_at),
        subscription_ends_at: toIso(attributes.ends_at),
        subscription_trial_ends_at: toIso(attributes.trial_ends_at),
        lemon_squeezy_variant_id: variantId,
        lemon_squeezy_customer_portal_url: attributes.urls?.customer_portal || null,
        lemon_squeezy_update_payment_url: attributes.urls?.update_payment_method || null,
        subscription_updated_at: toIso(attributes.updated_at) || new Date().toISOString(),
      }

      const admin = createAdminClient()
      await admin.from('profiles').update(syncedProfile).eq('id', user.id)
      nextProfile = { ...nextProfile, ...syncedProfile }
    }
  }

  const variantId = nextProfile.lemon_squeezy_variant_id ? String(nextProfile.lemon_squeezy_variant_id) : null
  const billingPeriod = getBillingPeriod(variantId)

  return NextResponse.json({
    profile: {
      subscription_tier: nextProfile.subscription_tier,
      subscription_status: nextProfile.subscription_status,
      subscription_renews_at: nextProfile.subscription_renews_at,
      subscription_ends_at: nextProfile.subscription_ends_at,
      subscription_trial_ends_at: nextProfile.subscription_trial_ends_at,
      subscription_billing_period: billingPeriod,
    },
  })
}
