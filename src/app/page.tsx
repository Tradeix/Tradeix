import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import LandingPage from '@/components/LandingPage'

export default async function RootPage() {
  if (!isSupabaseConfigured) {
    return <LandingPage />
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return <LandingPage />
}
