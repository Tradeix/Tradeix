import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
])

function isValidSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false

  const digest = Buffer.from(
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex'),
    'utf8'
  )
  const received = Buffer.from(signature, 'utf8')

  if (digest.length !== received.length) return false
  return crypto.timingSafeEqual(digest, received)
}

function hasProAccess(status?: string | null, endsAt?: string | null) {
  if (status === 'active' || status === 'on_trial') return true
  if (status === 'cancelled' && endsAt) return new Date(endsAt).getTime() > Date.now()
  return false
}

function toIso(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export async function POST(request: Request) {
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!webhookSecret || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-signature')

  if (!isValidSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const eventName = payload?.meta?.event_name || request.headers.get('x-event-name')

  if (!SUBSCRIPTION_EVENTS.has(eventName)) {
    return NextResponse.json({ received: true })
  }

  const userId = payload?.meta?.custom_data?.user_id
  const subscription = payload?.data
  const attributes = subscription?.attributes || {}

  if (!userId || subscription?.type !== 'subscriptions') {
    return NextResponse.json({ error: 'Subscription user id missing' }, { status: 400 })
  }

  const status = attributes.status || 'unknown'
  const endsAt = toIso(attributes.ends_at)
  const tier = hasProAccess(status, endsAt) ? 'pro' : 'free'

  const supabase = createAdminClient()
  const profileUpdate: Record<string, unknown> = {
    id: userId,
    subscription_tier: tier,
    subscription_status: status,
    lemon_squeezy_customer_id: attributes.customer_id ? String(attributes.customer_id) : null,
    lemon_squeezy_order_id: attributes.order_id ? String(attributes.order_id) : null,
    lemon_squeezy_subscription_id: subscription.id ? String(subscription.id) : null,
    lemon_squeezy_product_id: attributes.product_id ? String(attributes.product_id) : null,
    lemon_squeezy_variant_id: attributes.variant_id ? String(attributes.variant_id) : null,
    lemon_squeezy_customer_portal_url: attributes.urls?.customer_portal || null,
    lemon_squeezy_update_payment_url: attributes.urls?.update_payment_method || null,
    subscription_renews_at: toIso(attributes.renews_at),
    subscription_ends_at: endsAt,
    subscription_trial_ends_at: toIso(attributes.trial_ends_at),
    subscription_updated_at: toIso(attributes.updated_at) || new Date().toISOString(),
  }

  if (attributes.user_email) profileUpdate.email = attributes.user_email
  if (attributes.user_name) profileUpdate.full_name = attributes.user_name

  const { error } = await supabase.from('profiles').upsert(profileUpdate, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
