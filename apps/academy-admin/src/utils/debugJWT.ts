/**
 * JWT 디버깅 유틸리티
 *
 * 브라우저 콘솔에서 실행하여 실제 JWT claims를 확인합니다.
 */

import { createClient } from '@lib/supabase-client';

/**
 * 현재 세션의 JWT claims를 디코딩하여 출력
 *
 * 사용법:
 * 1. 브라우저 콘솔에서 실행
 * 2. 또는 개발자 도구에서 직접 호출
 */
export async function debugCurrentJWT(): Promise<void> {
  const supabase = createClient();

  console.group('JWT Claims 디버깅');

  try {
    // 1. 현재 세션 확인
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('세션 조회 실패:', sessionError);
      console.groupEnd();
      return;
    }

    if (!sessionData.session) {
      console.warn('세션이 없습니다. 로그인해주세요.');
      console.groupEnd();
      return;
    }

    const session = sessionData.session;
    console.log('세션 존재:', {
      user_id: session.user.id,
      email: session.user.email,
    });

    // 2. JWT 토큰 디코딩
    const accessToken = session.access_token;
    if (!accessToken) {
      console.error('Access token이 없습니다.');
      console.groupEnd();
      return;
    }

    // JWT는 base64로 인코딩된 3부분으로 구성: header.payload.signature
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      console.error('잘못된 JWT 형식');
      console.groupEnd();
      return;
    }

    // Payload 디코딩
    const payload = JSON.parse(atob(parts[1])) as Record<string, unknown>;

    console.log('JWT Payload:', payload);
    console.log('tenant_id claim:', (typeof payload.tenant_id === 'string' ? payload.tenant_id : null) || '없음');
    console.log('tenant_role claim:', (typeof payload.tenant_role === 'string' ? payload.tenant_role : null) || '없음');
    console.log('role claim (PostgreSQL ROLE):', (typeof payload.role === 'string' ? payload.role : null) || 'authenticated (기본값)');
    console.log('sub (user_id):', typeof payload.sub === 'string' ? payload.sub : '없음');
    console.log('exp (만료 시간):', typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : '없음');

    // 3. user_tenant_roles 확인 (API 호출)
    const { data: userTenantRoles, error: utrError } = await supabase
      .from('user_tenant_roles')
      .select('tenant_id, role, updated_at, created_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });

    if (utrError) {
      console.error('user_tenant_roles 조회 실패:', utrError);
    } else {
      console.log('user_tenant_roles:', userTenantRoles);
      if (userTenantRoles && userTenantRoles.length > 0) {
        console.log('user_tenant_roles 데이터 존재');
        console.log('   가장 최근 테넌트:', userTenantRoles[0]);
      } else {
        console.warn('user_tenant_roles 데이터 없음');
      }
    }

    // 4. Hook 활성화 상태 확인 (RPC 호출)
    try {
      const result = await supabase.rpc('check_hook_status');
      if (result.error) {
        console.warn('Hook 상태 확인 실패 (정상일 수 있음):', result.error.message);
      } else {
        console.log('Hook 상태:', result.data);
      }
    } catch {
      // RPC 함수가 없을 수 있으므로 무시
    }

    // 5. 진단 결과
    console.group('진단 결과');
    if (typeof payload.tenant_id === 'string' && payload.tenant_id) {
      console.log('JWT claim에 tenant_id 포함됨');
      console.log('   → Custom Access Token Hook이 정상 작동 중');
    } else {
      console.log('JWT claim에 tenant_id 없음');
      console.log('   → Custom Access Token Hook이 작동하지 않거나');
      console.log('   → Hook이 활성화되지 않았을 수 있음');
      console.log('   → 또는 user_tenant_roles에 데이터가 없을 수 있음');
    }
    console.groupEnd();

  } catch (error) {
    console.error('오류 발생:', error);
  }

  console.groupEnd();
}

/**
 * 전역 함수로 등록 (브라우저 콘솔에서 직접 호출 가능)
 */
if (typeof window !== 'undefined') {
  (window as unknown as { debugJWT?: typeof debugCurrentJWT }).debugJWT = debugCurrentJWT;
  console.log('JWT 디버깅 함수가 등록되었습니다.');
  console.log('   사용법: await window.debugJWT()');
}

