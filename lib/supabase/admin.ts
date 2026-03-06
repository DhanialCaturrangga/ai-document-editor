import { createClient } from '@supabase/supabase-js'

// Client khusus ADMIN (hanya boleh dijalankan di Server Components/API Routes)
// Client ini men-bypass RLS (Row Level Security)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // PERINGATAN: Gunakan service_role key, bukan anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
