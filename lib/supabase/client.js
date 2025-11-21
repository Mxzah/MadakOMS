import { createClient } from '@supabase/supabase-js'

// Client-side bundles can only access env vars prefixed with NEXT_PUBLIC_.
// Fall back to server-only names so the same .env.local works everywhere.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY environment variables.')
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
})
