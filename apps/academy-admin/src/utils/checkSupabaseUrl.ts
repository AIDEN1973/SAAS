/**
 * Supabase URL 확인 유틸리티
 *
 * [주의] 개발 환경 전용 유틸리티입니다.
 *
 * [기술문서 규칙 예외]
 * - 일반적으로 React 컴포넌트에서 Supabase 직접 호출은 금지되지만,
 *   이 파일은 개발 환경에서만 사용되는 디버깅 유틸리티이므로 예외로 허용됩니다.
 * - 프로덕션 빌드에서는 이 파일이 번들에 포함되지 않도록 주의해야 합니다.
 *
 * [사용 목적]
 * - 개발 환경에서 실제 사용하는 Supabase URL을 확인
 * - 환경변수 설정 오류를 조기에 감지
 */

import { createClient } from '@lib/supabase-client';

/**
 * 현재 사용 중인 Supabase URL 확인
 */
export function checkSupabaseUrl(): {
  url: string;
  anonKey: string;
  isCorrect: boolean;
} {
  const supabase = createClient();

  // Supabase 클라이언트의 내부 URL 추출
  // @ts-expect-error - 내부 속성 접근
  const url = supabase.supabaseUrl || '';
  // @ts-expect-error - 내부 속성 접근
  const anonKey = supabase.supabaseKey || '';

  const correctUrl = 'https://xawypsrotrfoyozhrsbb.supabase.co';
  const isCorrect = url === correctUrl;

  console.log('현재 Supabase URL 확인:', {
    현재_URL: url,
    올바른_URL: correctUrl,
    일치: isCorrect ? '예' : '아니오',
    Anon_Key_존재: anonKey ? '예' : '아니오',
  });

  if (!isCorrect) {
    console.error('잘못된 Supabase URL을 사용하고 있습니다!');
    console.error('   현재:', url);
    console.error('   올바른:', correctUrl);
    console.error('   .env.local 파일을 확인하고 개발 서버를 재시작하세요.');
  }

  return {
    url,
    anonKey,
    isCorrect,
  };
}

/**
 * 환경변수에 직접 URL 확인
 */
export function checkEnvVariables(): void {
  const viteUrl = (import.meta.env as unknown as { VITE_SUPABASE_URL?: string } | undefined)?.VITE_SUPABASE_URL;

  console.log('현재 환경변수 확인:', {
    'import.meta.env.VITE_SUPABASE_URL': viteUrl || '미설정',
    'import.meta.env.MODE': import.meta.env?.MODE || '미설정',
    'import.meta.env.DEV': import.meta.env?.DEV || '미설정',
  });

  if (viteUrl && viteUrl.includes('npferbxuxocbfnfbpcnz')) {
    console.error('WARNING: 잘못된 URL이 환경변수에 설정되어 있습니다!');
    console.error('   .env.local 파일을 확인하고 개발 서버를 재시작하세요.');
    console.error('   Vite 캐시 삭제: rm -rf node_modules/.vite');
  }
}
