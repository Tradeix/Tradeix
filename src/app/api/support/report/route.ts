import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const SUPPORT_TO_EMAIL = process.env.SUPPORT_TO_EMAIL || 'yctrades7@gmail.com'
const SUPPORT_FROM_EMAIL = process.env.SUPPORT_FROM_EMAIL || 'Tradeix Support <onboarding@resend.dev>'
const CATEGORIES = new Set(['billing', 'renewal', 'bug', 'not_working', 'other'])

const CATEGORY_LABELS: Record<string, { he: string; en: string }> = {
  billing: { he: 'חיוב ותשלום', en: 'Billing' },
  renewal: { he: 'חידוש מנוי', en: 'Renewal' },
  bug: { he: 'באג / תקלה', en: 'Bug / issue' },
  not_working: { he: 'משהו לא עובד', en: 'Something is not working' },
  other: { he: 'אחר', en: 'Other' },
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatPlainReport(input: {
  category: string
  fullName: string
  email: string
  message: string
  userId: string
  accountEmail: string
}) {
  const category = CATEGORY_LABELS[input.category]?.he || input.category

  return [
    'דיווח תקלה חדש מ-Tradeix',
    '',
    `סוג תקלה: ${category}`,
    `שם מלא: ${input.fullName}`,
    `מייל לחזרה: ${input.email}`,
    `מייל חשבון: ${input.accountEmail}`,
    `User ID: ${input.userId}`,
    `נשלח בתאריך: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
    '',
    'פירוט התקלה:',
    input.message,
  ].join('\n')
}

function formatHtmlReport(input: {
  category: string
  fullName: string
  email: string
  message: string
  userId: string
  accountEmail: string
}) {
  const category = CATEGORY_LABELS[input.category]?.he || input.category
  const sentAt = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; background: #f6f8fb; padding: 24px; color: #111827;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
        <div style="background: #0f8d63; color: #ffffff; padding: 18px 22px;">
          <h1 style="margin: 0; font-size: 22px;">דיווח תקלה חדש מ-Tradeix</h1>
        </div>
        <div style="padding: 22px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; font-weight: 700;">סוג תקלה</td><td style="padding: 8px 0;">${escapeHtml(category)}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: 700;">שם מלא</td><td style="padding: 8px 0;">${escapeHtml(input.fullName)}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: 700;">מייל לחזרה</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></td></tr>
            <tr><td style="padding: 8px 0; font-weight: 700;">מייל חשבון</td><td style="padding: 8px 0;">${escapeHtml(input.accountEmail)}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: 700;">User ID</td><td style="padding: 8px 0; direction: ltr; text-align: right;">${escapeHtml(input.userId)}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: 700;">נשלח בתאריך</td><td style="padding: 8px 0;">${escapeHtml(sentAt)}</td></tr>
          </table>
          <div style="font-weight: 700; margin-bottom: 8px;">פירוט התקלה</div>
          <div style="white-space: pre-wrap; line-height: 1.6; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">${escapeHtml(input.message)}</div>
        </div>
      </div>
    </div>
  `
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Support email is not configured' }, { status: 500 })
  }

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

  const report = {
    category,
    fullName,
    email,
    message,
    userId: user.id,
    accountEmail: user.email || '',
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SUPPORT_FROM_EMAIL,
      to: [SUPPORT_TO_EMAIL],
      reply_to: email,
      subject: `Tradeix - דיווח תקלה חדש: ${CATEGORY_LABELS[category]?.he || category}`,
      text: formatPlainReport(report),
      html: formatHtmlReport(report),
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.message || payload?.error || 'Support email could not be sent' },
      { status: response.status }
    )
  }

  return NextResponse.json({ ok: true })
}
