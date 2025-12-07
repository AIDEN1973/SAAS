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
import { useUserTenants, useSelectTenant } from '@hooks/use-auth';
import { getApiContext, setApiContext } from '@api-sdk/core';
import { createClient } from '@lib/supabase-client/client';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const { data: tenants, isLoading: tenantsLoading } = useUserTenants();
  const tenantsArray: Array<{
    id: string;
    name: string;
    industry_type: string;
    role: string;
  }> = tenants || [];
  const selectTenant = useSelectTenant();
  const context = getApiContext();

  // Supabase Auth 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error('세션 확인 실패:', error);
        setSession(null);
      } finally {
        setSessionLoading(false);
      }
    };

    checkSession();
  }, []);

  // 세션 로딩 중
  if (sessionLoading || tenantsLoading) {
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

  // 테넌트가 없는 경우 회원가입 페이지로 리다이렉트
  if (!tenantsArray || tenantsArray.length === 0) {
    return <Navigate to="/auth/signup" replace />;
  }

  // 테넌트가 여러 개인데 선택되지 않은 경우 테넌트 선택 페이지로 리다이렉트
  if (tenantsArray.length > 1 && !context.tenantId) {
    return <Navigate to="/auth/select-tenant" replace />;
  }

  // 테넌트가 1개인데 선택되지 않은 경우 자동 선택
  useEffect(() => {
    if (tenantsArray && tenantsArray.length === 1 && !context.tenantId && !autoSelecting && session) {
      const autoSelect = async () => {
        setAutoSelecting(true);
        try {
          const tenant = tenantsArray[0];
          const result = await selectTenant.mutateAsync(tenant.id);
          setApiContext({
            tenantId: tenant.id,
            industryType: tenant.industry_type as any,
            authToken: result.access_token,
          });
        } catch (error) {
          console.error('테넌트 자동 선택 실패:', error);
        } finally {
          setAutoSelecting(false);
        }
      };
      autoSelect();
    }
  }, [tenants, context.tenantId, autoSelecting, session, selectTenant]);

  // 테넌트가 1개인데 선택되지 않은 경우 로딩 표시
  if (tenantsArray && tenantsArray.length === 1 && !context.tenantId && (autoSelecting || !session)) {
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

  // 모든 조건을 만족한 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
}

