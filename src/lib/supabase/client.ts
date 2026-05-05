import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export function createClient() {
  return createBrowserClient(
    supabaseUrl || 'http://127.0.0.1:54321',
    supabaseAnonKey || 'missing-anon-key'
  )
}
