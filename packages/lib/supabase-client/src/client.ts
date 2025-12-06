import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { envClient } from '@env-registry/core';

/**
 * 클라이언트용 Supabase 클라이언트 생성
 * NEXT_PUBLIC_* 환경변수 사용
 */
export function createClient(): SupabaseClient {
  const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL과 Anon Key가 설정되지 않았습니다.');
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

