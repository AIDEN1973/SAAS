/**
 * useIsSuperAdmin Hook
 * 
 * [불변 규칙] Zero-Trust: 권한은 서버(RLS)에서만 판정
 * [불변 규칙] UI는 권한을 추론하지 않고, API 응답만 확인
 * [불변 규칙] user_platform_roles 테이블에서 super_admin 역할 확인
 * 
 * 기술문서: docu/스키마에디터.txt 3. 보안 모델
 */

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';

/**
 * Super Admin 권한 확인 Hook
 * 
 * [불변 규칙] user_platform_roles 테이블에서 role = 'super_admin' 확인
 * [불변 규칙] 권한 판정은 RLS에서 처리되므로, 조회 성공 여부로 판단
 */
export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ['auth', 'isSuperAdmin'],
    queryFn: async () => {
      const supabase = createClient();
      
      console.log('[useIsSuperAdmin] 시작: Super Admin 권한 확인');
      
      // 현재 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('[useIsSuperAdmin] 사용자 정보 가져오기 실패:', userError);
        return false;
      }
      
      if (!user) {
        console.warn('[useIsSuperAdmin] 사용자가 로그인하지 않았습니다.');
        return false;
      }
      
      console.log('[useIsSuperAdmin] 현재 사용자:', {
        id: user.id,
        email: user.email,
      });
      
      // user_platform_roles 테이블에서 super_admin 역할 확인
      // RLS 정책에 의해 권한이 없으면 조회 실패
      // ⚠️ 중요: user_id로 필터링하여 자신의 역할만 조회 (RLS 정책과 일치)
      console.log('[useIsSuperAdmin] user_platform_roles 테이블 조회 시작...');
      console.log('[useIsSuperAdmin] 쿼리 파라미터:', {
        user_id: user.id,
        role: 'super_admin',
      });
      
      const { data, error } = await supabase
        .from('user_platform_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();
      
      console.log('[useIsSuperAdmin] 쿼리 결과:', {
        data,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        } : null,
      });
      
      if (error) {
        console.error('[useIsSuperAdmin] 역할 조회 실패:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        // 권한 없음 또는 테이블 접근 불가
        return false;
      }
      
      const isSuperAdmin = !!data;
      console.log('[useIsSuperAdmin] 결과:', {
        isSuperAdmin,
        role: data?.role,
      });
      
      // 데이터가 있으면 Super Admin
      return isSuperAdmin;
    },
    staleTime: 5 * 60 * 1000, // 5분
    retry: false, // 권한 체크는 실패 시 재시도 불필요
  });
}

