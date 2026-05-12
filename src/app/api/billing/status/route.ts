import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_status, subscription_renews_at, subscription_ends_at, subscription_trial_ends_at, lemon_squeezy_subscription_id, lemon_squeezy_variant_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Billing profile not found' }, { status: 404 })
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

  const variantId = profile.lemon_squeezy_variant_id ? String(profile.lemon_squeezy_variant_id) : null
  const monthlyVariantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID || null
  const yearlyVariantId = process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID || null
  const billingPeriod = variantId && yearlyVariantId && variantId === yearlyVariantId
    ? 'yearly'
    : variantId && monthlyVariantId && variantId === monthlyVariantId
      ? 'monthly'
      : null

  return NextResponse.json({
    profile: {
      subscription_tier: profile.subscription_tier,
      subscription_status: profile.subscription_status,
      subscription_renews_at: profile.subscription_renews_at,
      subscription_ends_at: profile.subscription_ends_at,
      subscription_trial_ends_at: profile.subscription_trial_ends_at,
      subscription_billing_period: billingPeriod,
    },
  })
}
