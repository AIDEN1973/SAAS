import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { envClient } from '@env-registry/client';

/**
 * 싱글톤 Supabase 클라이언트 인스턴스
 * 여러 인스턴스 생성 방지 (GoTrueClient 경고 해결)
 */
let clientInstance: SupabaseClient | null = null;

/**
 * Cross-Origin Session Storage Adapter
 *
 * [불변 규칙] 개발 환경에서 localhost:3000과 localhost:3002 간 세션 공유
 * [불변 규칙] localStorage는 origin별로 분리되므로, URL 파라미터로 세션을 전달
 *
 * Supabase는 기본적으로 localStorage를 사용하지만, 포트가 다르면
 * 다른 origin으로 간주되어 공유되지 않습니다.
 */
function createCrossOriginStorage() {
  return {
    getItem: (key: string): string | null => {
      // 1. 현재 origin의 localStorage 확인
      if (typeof window !== 'undefined') {
        const value = localStorage.getItem(key);
        if (value) return value;
      }

      // 2. URL 파라미터에서 세션 확인 (로그인 후 리다이렉트 시)
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionToken = urlParams.get('session_token');
        if (sessionToken && key.includes('auth-token')) {
          // 세션 토큰을 localStorage에 저장
          try {
            const sessionData = JSON.parse(decodeURIComponent(sessionToken));
            localStorage.setItem(key, JSON.stringify(sessionData));
            // URL에서 파라미터 제거
            urlParams.delete('session_token');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
            return JSON.stringify(sessionData);
          } catch (e) {
            console.error('[Cross-Origin Storage] 세션 토큰 파싱 실패:', e);
          }
        }
      }

      return null;
    },
    setItem: (key: string, value: string): void => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
    },
    removeItem: (key: string): void => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    },
  };
}

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

  // Custom Storage Adapter for Cross-Port Session Sharing
  // [불변 규칙] 개발 환경에서 localhost:3000과 localhost:3002 간 세션 공유
  // [불변 규칙] localStorage는 origin별로 분리되므로, sessionStorage를 사용하거나
  //            URL 파라미터로 세션을 전달해야 합니다.
  //
  // 참고: Supabase는 기본적으로 localStorage를 사용하지만, 포트가 다르면
  //      다른 origin으로 간주되어 공유되지 않습니다.
  //
  // 해결 방법:
  // 1. 같은 포트에서 서브패스로 라우팅 (권장)
  // 2. 또는 custom storage adapter 사용 (복잡함)
  // 3. 또는 URL 파라미터로 세션 전달 (보안 위험)
  //
  // 현재는 기본 localStorage를 사용하되, 사용자가 academy-admin 앱에서
  // 로그인한 후 super-admin 앱으로 돌아오면 수동으로 세션을 확인하도록 합니다.

  // Custom storage adapter for cross-origin session sharing
  // 개발 환경에서만 사용 (프로덕션에서는 같은 origin 사용 권장)
  const customStorage = typeof window !== 'undefined' && import.meta.env?.DEV
    ? createCrossOriginStorage()
    : undefined;

  clientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...(customStorage && { storage: customStorage }),
    },
  });

  return clientInstance;
}

