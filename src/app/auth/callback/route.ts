import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const profile = {
          id: user.id,
          email: user.email || null,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        }

        if (isSupabaseAdminConfigured) {
          const admin = createAdminClient()
          await admin.from('profiles').upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
        } else {
          await supabase.from('profiles').upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
