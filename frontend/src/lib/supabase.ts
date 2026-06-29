import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

// NOTE: Replace with `createClient<Database>(...)` after running:
// npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
