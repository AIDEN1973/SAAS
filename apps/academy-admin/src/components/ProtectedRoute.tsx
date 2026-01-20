/**
 * 인증 보호 라우트 컴포넌트
 *
 * [기술문서 요구사항]
 * - 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
 * - 테넌트가 선택되지 않은 경우 테넌트 선택 페이지로 리다이렉트
 *
 * [UI 문서 요구사항]
 * - Zero-Trust 원칙 준수
 *
 * [성능 최적화]
 * - 스켈레톤 UI로 체감 로딩 속도 개선
 * - localStorage 캐싱으로 테넌트 정보 즉시 표시
 */

import { useEffect, useState, useRef, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getApiContext, setApiContext } from '@api-sdk/core';
import { useSession, useUserTenants, useSelectTenant } from '@hooks/use-auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * 스켈레톤 레이아웃 컴포넌트
 * 로딩 중 글로벌 헤더와 사이드바의 기본 구조를 미리 보여줌
 */
function SkeletonLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-secondary)' }}>
      {/* 사이드바 스켈레톤 */}
      <div
        style={{
          width: '240px',
          backgroundColor: 'var(--color-bg-primary)',
          borderRight: '1px solid var(--color-border-secondary)',
          padding: 'var(--spacing-md)',
          flexShrink: 0,
        }}
      >
        {/* 로고 스켈레톤 */}
        <div
          style={{
            height: '32px',
            width: '120px',
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 'var(--spacing-xl)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
        {/* 메뉴 아이템 스켈레톤 */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              height: '40px',
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              marginBottom: 'var(--spacing-sm)',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 스켈레톤 */}
        <div
          style={{
            height: '56px',
            backgroundColor: 'var(--color-bg-primary)',
            borderBottom: '1px solid var(--color-border-secondary)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 var(--spacing-lg)',
            gap: 'var(--spacing-md)',
          }}
        >
          {/* 검색 스켈레톤 */}
          <div
            style={{
              height: '36px',
              flex: 1,
              maxWidth: '400px',
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          {/* 아이콘 버튼 스켈레톤 */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginLeft: 'auto' }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--border-radius-full)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* 바디 스켈레톤 */}
        <div style={{ flex: 1, padding: 'var(--spacing-lg)' }}>
          {/* 페이지 제목 스켈레톤 */}
          <div
            style={{
              height: '28px',
              width: '200px',
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              marginBottom: 'var(--spacing-lg)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          {/* 콘텐츠 카드 스켈레톤 */}
          <div
            style={{
              height: '200px',
              backgroundColor: 'var(--color-bg-primary)',
              borderRadius: 'var(--border-radius-lg)',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: '0.2s',
            }}
          />
        </div>
      </div>

      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
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

  const hasTenantId = !!currentTenantId || !!getApiContext()?.tenantId;

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

    const autoSelectTenant = () => {
      isSelectingRef.current = true;
      try {
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
        // void selectTenant.mutateAsync(tenants[0].id);
      } catch (error) {
        console.error('테넌트 자동 선택 실패:', error);
        // Rate limit 에러인 경우 Context만 설정하고 계속 진행
        if (error instanceof Error && error.message.includes('rate limit')) {
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
  }, [tenants, hasTenantId, tenantSelected, selectTenant.isPending]);

  // 세션 로딩 중 - 스켈레톤 UI 표시
  if (sessionLoading) {
    return <SkeletonLayout />;
  }

  // 세션이 없는 경우 로그인 페이지로 리다이렉트
  if (!session) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 테넌트 목록 로딩 중 - 스켈레톤 UI 표시
  // (localStorage 캐싱으로 대부분의 경우 이 상태를 건너뜀)
  if (tenantsLoading) {
    return <SkeletonLayout />;
  }

  // 테넌트가 없는 경우 회원가입 페이지로 리다이렉트
  if (!tenants || tenants.length === 0) {
    return <Navigate to="/auth/signup" replace />;
  }

  // 테넌트가 여러 개이고 선택되지 않은 경우 테넌트 선택 페이지로 리다이렉트
  if (tenants.length > 1 && !hasTenantId && !tenantSelected) {
    return <Navigate to="/auth/tenant-selection" replace />;
  }

  // 테넌트가 하나이고 선택 중인 경우 - 스켈레톤 UI 표시
  if (tenants.length === 1 && !hasTenantId && tenantSelected && selectTenant.isPending) {
    return <SkeletonLayout />;
  }

  // 테넌트가 하나인데 tenantId가 아직 설정되지 않은 경우 대기
  // setApiContext가 호출되었지만 아직 반영되지 않았을 수 있음
  if (tenants.length === 1 && !hasTenantId) {
    return <SkeletonLayout />;
  }

  // 모든 조건을 만족한 경우 실제 컴포넌트 렌더링
  return <>{children}</>;
}
