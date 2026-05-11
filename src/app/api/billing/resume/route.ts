import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function toIso(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export async function POST(request: Request) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const monthlyVariantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID
  const yearlyVariantId = process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID

  if (!apiKey || !monthlyVariantId || !yearlyVariantId || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: 'Billing resume is not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const billingPeriod = body?.billingPeriod === 'yearly' ? 'yearly' : 'monthly'
  const targetVariantId = billingPeriod === 'yearly' ? yearlyVariantId : monthlyVariantId

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
    return NextResponse.json({ error: 'Subscription was not found' }, { status: 404 })
  }

  const subscriptionId = String(profile.lemon_squeezy_subscription_id)
  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: 'subscriptions',
        id: subscriptionId,
        attributes: {
          cancelled: false,
          variant_id: Number(targetVariantId),
          ...(billingPeriod === 'yearly' ? { invoice_immediately: true } : {}),
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.errors?.[0]?.detail || 'Could not resume subscription' },
      { status: response.status }
    )
  }

  const subscription = payload?.data
  const attributes = subscription?.attributes || {}
  const status = attributes.status || 'active'
  const renewsAt = toIso(attributes.renews_at)
  const trialEndsAt = toIso(attributes.trial_ends_at)
  const portalUpdateUrl = attributes.urls?.customer_portal_update_subscription || null

  const admin = createAdminClient()
  const { error: updateError } = await admin.from('profiles').upsert({
    id: user.id,
    subscription_tier: 'pro',
    subscription_status: status,
    lemon_squeezy_subscription_id: subscription.id ? String(subscription.id) : subscriptionId,
    lemon_squeezy_customer_id: attributes.customer_id ? String(attributes.customer_id) : null,
    lemon_squeezy_order_id: attributes.order_id ? String(attributes.order_id) : null,
    lemon_squeezy_product_id: attributes.product_id ? String(attributes.product_id) : null,
    lemon_squeezy_variant_id: attributes.variant_id ? String(attributes.variant_id) : null,
    lemon_squeezy_customer_portal_url: attributes.urls?.customer_portal || null,
    lemon_squeezy_update_payment_url: attributes.urls?.update_payment_method || null,
    subscription_renews_at: renewsAt,
    subscription_ends_at: null,
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
      endsAt: null,
      trialEndsAt,
      billingPeriod,
      variantId: attributes.variant_id ? String(attributes.variant_id) : String(targetVariantId),
      portalUpdateUrl,
    },
    url: portalUpdateUrl,
  })
}
