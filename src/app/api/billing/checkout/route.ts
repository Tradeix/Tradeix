import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function getSiteUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  const variantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID

  if (!apiKey || !storeId || !variantId) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 500 })
  }

  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
            media: false,
            logo: true,
            button_color: '#0f8d63',
            button_text_color: '#ffffff',
          },
          checkout_data: {
            email: user.email || '',
            name: fullName,
            custom: {
              user_id: user.id,
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
