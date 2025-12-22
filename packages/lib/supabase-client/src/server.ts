import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { envServer } from '@env-registry/server';

/**
 * 서버/Edge 용 Supabase 클라이언트 생성
 * Service Role Key 사용 (관리자 권한)
 */
export function createServerClient(): SupabaseClient {
  const supabaseUrl = envServer.SUPABASE_URL;
  const serviceRoleKey = envServer.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL과 Service Role Key가 설정되지 않았습니다.');
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
