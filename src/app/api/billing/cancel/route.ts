import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function toIso(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function hasProAccess(status?: string | null, endsAt?: string | null) {
  if (status === 'active' || status === 'on_trial') return true
  if (status === 'cancelled' && endsAt) return new Date(endsAt).getTime() > Date.now()
  return false
}

export async function POST() {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY

  if (!apiKey || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: 'Billing cancellation is not configured' }, { status: 500 })
  }

  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('lemon_squeezy_subscription_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.lemon_squeezy_subscription_id) {
    return NextResponse.json({ error: 'Active subscription was not found' }, { status: 404 })
  }

  const subscriptionId = String(profile.lemon_squeezy_subscription_id)
  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.errors?.[0]?.detail || 'Could not cancel subscription' },
      { status: response.status }
    )
  }

  const subscription = payload?.data
  const attributes = subscription?.attributes || {}
  const status = attributes.status || 'cancelled'
  const endsAt = toIso(attributes.ends_at)
  const renewsAt = toIso(attributes.renews_at)
  const trialEndsAt = toIso(attributes.trial_ends_at)
  const tier = hasProAccess(status, endsAt) ? 'pro' : 'free'
  const variantId = attributes.variant_id ? String(attributes.variant_id) : null
  const billingPeriod = variantId && process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID && variantId === process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
    ? 'yearly'
    : variantId && process.env.LEMONSQUEEZY_PRO_VARIANT_ID && variantId === process.env.LEMONSQUEEZY_PRO_VARIANT_ID
      ? 'monthly'
      : null

  const admin = createAdminClient()
  const { error: updateError } = await admin.from('profiles').upsert({
    id: user.id,
    subscription_tier: tier,
    subscription_status: status,
    lemon_squeezy_subscription_id: subscription.id ? String(subscription.id) : subscriptionId,
    lemon_squeezy_customer_id: attributes.customer_id ? String(attributes.customer_id) : null,
    lemon_squeezy_order_id: attributes.order_id ? String(attributes.order_id) : null,
    lemon_squeezy_product_id: attributes.product_id ? String(attributes.product_id) : null,
    lemon_squeezy_variant_id: variantId,
    lemon_squeezy_customer_portal_url: attributes.urls?.customer_portal || null,
    lemon_squeezy_update_payment_url: attributes.urls?.update_payment_method || null,
    subscription_renews_at: renewsAt,
    subscription_ends_at: endsAt,
    subscription_trial_ends_at: trialEndsAt,
    subscription_updated_at: toIso(attributes.updated_at) || new Date().toISOString(),
  }, { onConflict: 'id' })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    subscription: {
      status,
      renewsAt,
      endsAt,
      trialEndsAt,
      billingPeriod,
    },
  })
}
