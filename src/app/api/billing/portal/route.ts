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
    .select('lemon_squeezy_subscription_id, lemon_squeezy_customer_portal_url')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return NextResponse.json({ error: 'Billing profile not found' }, { status: 404 })
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const subscriptionId = profile?.lemon_squeezy_subscription_id

  if (apiKey && subscriptionId) {
    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (response.ok) {
      const payload = await response.json()
      const portalUrl = payload?.data?.attributes?.urls?.customer_portal
      if (portalUrl) return NextResponse.json({ url: portalUrl })
    }
  }

  if (profile?.lemon_squeezy_customer_portal_url) {
    return NextResponse.json({ url: profile.lemon_squeezy_customer_portal_url })
  }

  return NextResponse.json({ error: 'Customer portal is not ready yet' }, { status: 404 })
}
