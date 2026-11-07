import { createClient } from '@supabase/supabase-js';

/** @type {import('@supabase/supabase-js').SupabaseClient | undefined} */
let client;

function getSupabaseAdmin() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}

export const supabaseAdmin = /** @type {import('@supabase/supabase-js').SupabaseClient} */ (new Proxy({}, {
  get(_target, property) {
    const value = getSupabaseAdmin()[property];
    return typeof value === 'function' ? value.bind(getSupabaseAdmin()) : value;
  },
}));
