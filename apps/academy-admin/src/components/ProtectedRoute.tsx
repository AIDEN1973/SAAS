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

import { useEffect, useState, ReactNode } from 'react';
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

  const context = getApiContext();
  const hasTenantId = !!context?.tenantId;

  // [중요] React Hooks 규칙: 모든 Hook은 조건부 return 이전에 호출되어야 함
  // 테넌트가 하나이고 아직 선택되지 않은 경우 자동 선택
  useEffect(() => {
    if (tenants && tenants.length === 1 && !hasTenantId && !tenantSelected) {
      const autoSelectTenant = async () => {
        try {
          await selectTenant.mutateAsync(tenants[0].id);
          setApiContext({
            tenantId: tenants[0].id,
            industryType: tenants[0].industry_type as 'academy' | 'salon' | 'realestate' | 'gym' | 'ngo',
          });
          setTenantSelected(true);
        } catch (error) {
          console.error('테넌트 자동 선택 실패:', error);
          // 자동 선택 실패 시 테넌트 선택 페이지로 이동
        }
      };
      autoSelectTenant();
    }
  }, [tenants, hasTenantId, tenantSelected, selectTenant]);

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
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
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
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          테넌트 정보를 불러오는 중...
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
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
          테넌트를 선택하는 중...
        </p>
      </div>
    );
  }

  // 모든 조건을 만족한 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
}
