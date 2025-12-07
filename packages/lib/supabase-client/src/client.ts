import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { envClient } from '@env-registry/core';

/**
 * 싱글톤 Supabase 클라이언트 인스턴스
 * 여러 인스턴스 생성 방지 (GoTrueClient 경고 해결)
 */
let clientInstance: SupabaseClient | null = null;

/**
 * 클라이언트용 Supabase 클라이언트 생성 (싱글톤)
 * NEXT_PUBLIC_* 환경변수 사용
 */
export function createClient(): SupabaseClient {
  // 이미 인스턴스가 있으면 재사용
  if (clientInstance) {
    return clientInstance;
  }

  const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL과 Anon Key가 설정되지 않았습니다.');
  }

  // 개발 환경에서 URL 확인 로그 출력
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    const correctUrl = 'https://xawypsrotrfoyozhrsbb.supabase.co';
    const isCorrect = supabaseUrl === correctUrl;
    
    console.log('🔍 Supabase 클라이언트 생성:', {
      '현재 URL': supabaseUrl,
      '올바른 URL': correctUrl,
      '일치': isCorrect ? '✅' : '❌',
      'Anon Key 설정됨': supabaseAnonKey ? '✅' : '❌',
    });
    
    if (!isCorrect) {
      console.error('❌ 잘못된 Supabase URL이 사용되고 있습니다!');
      console.error('   현재:', supabaseUrl);
      console.error('   올바른 값:', correctUrl);
      console.error('   .env.local 파일을 확인하고 개발 서버를 재시작하세요.');
    }
  }

  clientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return clientInstance;
}

