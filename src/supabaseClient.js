import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in development rather than silently breaking auth/data calls
  // with a cryptic "Invalid URL" error deep in supabase-js.
  console.error(
    'Missing Supabase environment variables. Make sure VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY are set in your .env file (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
