import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey)

export function createAdminClient() {
  return createClient(
    supabaseUrl || 'http://127.0.0.1:54321',
    supabaseServiceRoleKey || 'missing-service-role-key',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
