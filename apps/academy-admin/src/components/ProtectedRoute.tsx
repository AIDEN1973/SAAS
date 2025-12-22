/**
 * 인증 보호 라우트 컴포넌트
 *
 * [기술문서 요구사항]
 * - 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
 * - 테넌트가 선택되지 않은 경우 테넌트 선택 페이지로 리다이렉트
 *
 * [UI 문서 요구사항]
 * - Zero-Trust 원칙 준수
 */

import { useEffect, useState, useRef, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getApiContext, setApiContext } from '@api-sdk/core';
import { useSession, useUserTenants, useSelectTenant } from '@hooks/use-auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: tenants, isLoading: tenantsLoading } = useUserTenants();
  const selectTenant = useSelectTenant();
  const [tenantSelected, setTenantSelected] = useState(false);
  const [currentTenantId, setCurrentTenantId] = useState<string | undefined>(() => {
    // 초기값을 getApiContext()에서 가져옴
    return getApiContext()?.tenantId;
  });
  const isSelectingRef = useRef(false); // 중복 호출 방지

  const context = getApiContext();
  const hasTenantId = !!currentTenantId || !!context?.tenantId;

  console.log('[ProtectedRoute] Rendering:', {
    pathname: location.pathname,
    hasSession: !!session,
    sessionLoading,
    tenantsCount: tenants?.length || 0,
    tenantsLoading,
    hasTenantId,
    tenantSelected,
    currentTenantId,
    contextTenantId: context?.tenantId,
  });

  // Context 변경 감지를 위한 effect (폴링 방식)
  useEffect(() => {
    const checkContext = () => {
      const context = getApiContext();
      if (context?.tenantId && context.tenantId !== currentTenantId) {
        console.log('[ProtectedRoute] Context tenantId changed:', {
          old: currentTenantId,
          new: context.tenantId,
        });
        setCurrentTenantId(context.tenantId);
      }
    };

    // 즉시 확인
    checkContext();

    // 주기적으로 확인 (다른 컴포넌트에서 setApiContext를 호출한 경우를 대비)
    const interval = setInterval(checkContext, 100);
    return () => clearInterval(interval);
  }, [currentTenantId]);

  // [중요] React Hooks 규칙: 모든 Hook은 조건부 return 이전에 호출되어야 합니다.
  // 테넌트가 하나이고 아직 선택되지 않은 경우 자동 선택
  useEffect(() => {
    // 이미 선택 중이거나, 이미 선택되었거나, 조건을 만족하지 않으면 실행하지 않음
    if (
      isSelectingRef.current ||
      tenantSelected ||
      selectTenant.isPending ||
      !tenants ||
      tenants.length !== 1 ||
      hasTenantId
    ) {
      return;
    }

    const autoSelectTenant = async () => {
      isSelectingRef.current = true;
      try {
        console.log('[ProtectedRoute] Auto-selecting tenant:', tenants[0].id);
        // 세션 새로고침 없이 Context만 설정 (rate limit 방지)
        // 실제로는 세션 새로고침이 필요하지 않을 수 있음
        setApiContext({
          tenantId: tenants[0].id,
          industryType: tenants[0].industry_type as 'academy' | 'salon' | 'real_estate' | 'gym' | 'ngo',  // 정본: real_estate
        });
        setCurrentTenantId(tenants[0].id); // state도 업데이트하여 리렌더링 트리거
        setTenantSelected(true);

        // 세션 새로고침은 선택적으로 수행 (필요한 경우에만)
        // Rate limit 에러를 방지하기 위해 주석 처리
        // await selectTenant.mutateAsync(tenants[0].id);
      } catch (error) {
        console.error('테넌트 자동 선택 실패:', error);
        // Rate limit 에러인 경우 Context만 설정하고 계속 진행
        if (error instanceof Error && error.message.includes('rate limit')) {
          console.warn('Rate limit 도달: Context만 설정하고 계속 진행합니다.');
          setApiContext({
            tenantId: tenants[0].id,
            industryType: tenants[0].industry_type as 'academy' | 'salon' | 'real_estate' | 'gym' | 'ngo',  // 정본: real_estate
          });
          setCurrentTenantId(tenants[0].id); // state도 업데이트
          setTenantSelected(true);
        }
        isSelectingRef.current = false;
      } finally {
        // 성공한 경우에만 ref 초기화 (에러 발생 시 재시도 방지)
        if (tenantSelected) {
          isSelectingRef.current = false;
        }
      }
    };

    autoSelectTenant();
  }, [tenants, hasTenantId, tenantSelected, selectTenant.isPending, currentTenantId]);

  // 세션 로딩 중
  if (sessionLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>
          로딩 중..
        </p>
      </div>
    );
  }

  // 세션이 없는 경우 로그인 페이지로 리다이렉트
  if (!session) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 테넌트 목록 로딩 중
  if (tenantsLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>
          테넌트 정보를 불러오는 중..
        </p>
      </div>
    );
  }

  // 테넌트가 없는 경우 회원가입 페이지로 리다이렉트
  if (!tenants || tenants.length === 0) {
    return <Navigate to="/auth/signup" replace />;
  }

  // 테넌트가 여러 개이고 선택되지 않은 경우 테넌트 선택 페이지로 리다이렉트
  if (tenants.length > 1 && !hasTenantId && !tenantSelected) {
    return <Navigate to="/auth/tenant-selection" replace />;
  }

  // 테넌트가 하나이고 선택 중인 경우 로딩 표시
  if (tenants.length === 1 && !hasTenantId && tenantSelected && selectTenant.isPending) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>
          테넌트를 선택하는 중..
        </p>
      </div>
    );
  }

  // 테넌트가 하나인데 tenantId가 아직 설정되지 않은 경우 대기
  // setApiContext가 호출되었지만 아직 반영되지 않았을 수 있음
  if (tenants.length === 1 && !hasTenantId) {
    console.log('[ProtectedRoute] Waiting for tenantId to be set:', {
      tenantSelected,
      currentTenantId,
      contextTenantId: getApiContext()?.tenantId,
    });
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>
          테넌트 정보를 설정하는 중...
        </p>
      </div>
    );
  }

  // 모든 조건을 만족한 경우 실제 컴포넌트 렌더링
  console.log('[ProtectedRoute] Rendering children:', {
    hasTenantId,
    currentTenantId,
    contextTenantId: getApiContext()?.tenantId,
  });
  return <>{children}</>;
}
