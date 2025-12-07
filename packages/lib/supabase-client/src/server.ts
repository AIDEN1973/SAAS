import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { envServer } from '@env-registry/core/server';

/**
 * ?œë²„/Edge ?„ìš© Supabase ?´ë¼?´ì–¸???ì„±
 * Service Role Key ?¬ìš© (ê´€ë¦¬ì ê¶Œí•œ)
 */
export function createServerClient(): SupabaseClient {
  const supabaseUrl = envServer.SUPABASE_URL;
  const serviceRoleKey = envServer.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URLê³?Service Role Keyê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??');
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

