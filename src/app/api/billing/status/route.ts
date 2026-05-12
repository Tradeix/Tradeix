import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_status, subscription_renews_at, subscription_ends_at, subscription_trial_ends_at, lemon_squeezy_variant_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Billing profile not found' }, { status: 404 })
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
