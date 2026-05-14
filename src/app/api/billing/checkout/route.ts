import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function getSiteUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')
  return new URL(request.url).origin
}

function toIso(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export async function POST(request: Request) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  const monthlyVariantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID
  const yearlyVariantId = process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
  const body = await request.json().catch(() => null)
  const billingPeriod = body?.billingPeriod === 'yearly' ? 'yearly' : 'monthly'
  const variantId = billingPeriod === 'yearly' ? yearlyVariantId : monthlyVariantId

  if (!apiKey || !storeId || !variantId) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 500 })
  }

  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, lemon_squeezy_subscription_id')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_tier !== 'free' && profile?.lemon_squeezy_subscription_id) {
    if (!monthlyVariantId || !yearlyVariantId || !isSupabaseAdminConfigured) {
      return NextResponse.json({ error: 'Billing renewal is not configured' }, { status: 500 })
    }

    const subscriptionId = String(profile.lemon_squeezy_subscription_id)
    const resumeResponse = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
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
            variant_id: Number(variantId),
            ...(billingPeriod === 'yearly' ? { invoice_immediately: true } : {}),
          },
        },
      }),
    })

    const resumePayload = await resumeResponse.json().catch(() => null)

    if (!resumeResponse.ok) {
      return NextResponse.json(
        { error: resumePayload?.errors?.[0]?.detail || 'Could not renew existing subscription' },
        { status: resumeResponse.status }
      )
    }

    const subscription = resumePayload?.data
    const attributes = subscription?.attributes || {}
    const status = attributes.status || 'active'
    const renewsAt = toIso(attributes.renews_at)
    const trialEndsAt = toIso(attributes.trial_ends_at)

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
        variantId: attributes.variant_id ? String(attributes.variant_id) : String(variantId),
      },
      reusedSubscription: true,
    })
  }

  const siteUrl = getSiteUrl(request)
  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || ''

  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          product_options: {
            enabled_variants: [Number(variantId)],
            redirect_url: `${siteUrl}/dashboard?billing=success`,
          },
          checkout_options: {
            embed: true,
            media: false,
            logo: true,
            desc: false,
            button_color: '#0f8d63',
            button_text_color: '#ffffff',
          },
          checkout_data: {
            email: user.email || '',
            name: fullName,
            custom: {
              user_id: user.id,
              billing_period: billingPeriod,
            },
          },
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: storeId,
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: variantId,
            },
          },
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.errors?.[0]?.detail || 'Could not create checkout' },
      { status: response.status }
    )
  }

  const checkoutUrl = payload?.data?.attributes?.url
  if (!checkoutUrl) {
    return NextResponse.json({ error: 'Checkout URL missing' }, { status: 502 })
  }

  return NextResponse.json({ url: checkoutUrl })
}
