import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('[Supabase] Initializing client...')
console.log('[Supabase] URL:', supabaseUrl)
console.log('[Supabase] Anon key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING')

if (!supabaseUrl || !supabaseAnonKey) {
  const error = 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables'
  console.error('[Supabase] ERROR:', error)
  throw new Error(error)
}

// NOTE: Replace with `createClient<Database>(...)` after running:
// npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
console.log('[Supabase] Client created successfully!')
