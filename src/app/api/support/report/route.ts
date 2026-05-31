import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const CATEGORIES = new Set(['billing', 'renewal', 'bug', 'not_working', 'other'])

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function supportReportsTableMissing(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message || '').toLowerCase()
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || (message.includes('support_reports') && (
      message.includes('does not exist')
      || message.includes('schema cache')
      || message.includes('could not find the table')
    ))
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const category = cleanText(body?.category, 32)
  const fullName = cleanText(body?.fullName, 120)
  const email = cleanText(body?.email, 180)
  const message = cleanText(body?.message, 5000)

  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Invalid issue type' }, { status: 400 })
  }

  if (!fullName || !email.includes('@') || message.length < 10) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await supabase.from('support_reports').insert({
    user_id: user.id,
    category,
    full_name: fullName,
    email,
    message,
    status: 'open',
  })

  if (error) {
    if (supportReportsTableMissing(error)) {
      return NextResponse.json(
        { error: 'Support reports table is not configured. Run the support_reports SQL in Supabase.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
