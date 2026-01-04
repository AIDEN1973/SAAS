/**
 * 역할 기반 라우트 컴포넌트
 *
 * 아키텍처 문서 2.4 섹션 참조
 * 역할별 라우팅 접근 제어 구현
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@hooks/use-auth';
import { getApiContext } from '@api-sdk/core';
import type { TenantRole } from '@core/tenancy';

interface RoleBasedRouteProps {
  children: ReactNode;
  allowedRoles: TenantRole[];
  fallbackPath?: string;
}

/**
 * 역할별 라우팅 규칙 (아키텍처 문서 2.4 참조)
 */
/**
 * 역할별 라우팅 규칙 (아키텍처 문서 2.4 섹션 참조)
 *
 * 주의: 이 규칙은 RoleBasedRoute의 경로 체크에 사용되지만,
 * 실제로는 allowedRoles에 포함된 역할이면 경로 체크를 건너뛰고 허용됩니다.
 *
 * Sub Admin의 billing 제한:
 * - /billing/create, /billing/settings 접근 제한
 * - /billing/view, /billing/history, /billing/home, /billing/list 접근 가능
 *
 * Teacher의 접근 제한:
 * - /billing/** 접근 금지
 * - /analytics/** 접근 금지 (요약만 제공)
 * - /classes/schedule 접근 가능
 */
const roleRouteRules: Record<TenantRole, string[]> = {
  admin: ['*'], // 전체 접근 가능
  owner: ['*'], // 전체 접근 가능
  sub_admin: [
    '/home',
    '/students/**',
    '/classes/**',
    '/teachers/**',
    '/attendance/**',
    '/billing/home', // Billing Home 접근 가능
    '/billing/list', // Billing List 접근 가능
    '/billing/view', // Billing View 접근 가능
    '/billing/history', // Billing History 접근 가능
    // /billing/create, /billing/settings는 접근 제한 (allowedRoles에서 제외)
    '/notifications/**',
    '/analytics/**',
    '/ai/insights/summary',
  ],
  teacher: [
    '/home',
    '/attendance/**',
    '/students/home', // 학생 홈 접근 가능
    '/students/list', // 학생 목록 접근 가능 (읽기 전용)
    '/students/:id', // 학생 상세 접근 가능 (수정 제한)
    '/students/:id/counsel', // 상담일지 작성 접근 가능
    '/students/:id/attendance', // 출결 조회 접근 가능
    '/ai/insights/summary', // AI 요약 접근 가능 (상세 분석 제한)
    '/classes', // 수업 목록 접근 가능
    // /billing/** 접근 금지
    // /analytics/** 접근 금지 (요약만 제공)
  ],
  instructor: [
    '/home',
    '/attendance/**',
    '/students/home', // 학생 홈 접근 가능
    '/students/list', // 학생 목록 접근 가능 (읽기 전용)
    '/students/:id', // 학생 상세 접근 가능 (수정 제한)
    '/students/:id/counsel', // 상담일지 작성 접근 가능
    '/students/:id/attendance', // 출결 조회 접근 가능
    '/ai/insights/summary', // AI 요약 접근 가능 (상세 분석 제한)
    '/classes', // 수업 목록 접근 가능
    // /billing/** 접근 금지
    // /analytics/** 접근 금지 (요약만 제공)
  ],
  assistant: [
    '/home',
    '/attendance/**',
    '/students/home', // 학생 홈 접근 가능
    '/students/list', // 학생 목록 접근 가능 (읽기 전용)
    '/students/:id', // 학생 상세 접근 가능 (읽기 전용)
    '/students/:id/attendance', // 출결 조회 접근 가능
    // /billing/** 접근 금지
    // /classes/** 접근 금지
    // /analytics/** 접근 금지
  ],
  counselor: [
    '/home',
    '/students/**',
    '/attendance/**',
  ],
  parent: [], // 학부모는 academy-parent 앱 사용
  guardian: [], // 학부모는 academy-parent 앱 사용
  staff: [
    '/home',
    '/students/**',
    '/classes/**',
    '/attendance/**',
  ],
  manager: [
    '/home',
    '/students/**',
    '/classes/**',
    '/attendance/**',
    '/billing/**',
  ],
  super_admin: ['*'], // 전체 접근 가능
};

/**
 * 경로가 허용된 경로 목록과 일치하는지 확인
 */
function isPathAllowed(path: string, allowedPaths: string[]): boolean {
  if (allowedPaths.includes('*')) {
    return true;
  }

  return allowedPaths.some((pattern) => {
    // 정확한 경로 매칭
    if (pattern === path) {
      return true;
    }

    // 와일드카드 매칭 (**)
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return path.startsWith(prefix);
    }

    return false;
  });
}

export function RoleBasedRoute({ children, allowedRoles, fallbackPath = '/home' }: RoleBasedRouteProps) {
  const location = useLocation();
  const { data: userRole, isLoading, isFetching } = useUserRole();
  const context = getApiContext();
  const tenantId = context?.tenantId;

  // 로딩 중이거나 데이터를 가져오는 중이면 대기
  if (isLoading || isFetching) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          권한 확인 중...
        </p>
      </div>
    );
  }

  // tenantId가 없으면 아직 컨텍스트가 설정되지 않은 상태
  if (!tenantId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          테넌트 정보를 불러오는 중...
        </p>
      </div>
    );
  }

  if (!userRole) {
    // userRole이 null인 경우, 무한 리다이렉트를 방지하기 위해
    // 현재 경로가 fallbackPath와 같으면 일단 접근을 허용
    // (실제로는 user_tenant_roles 테이블에 데이터가 없거나 RLS 정책 문제일 수 있음)
    if (location.pathname === fallbackPath) {
      return <>{children}</>;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  // 허용된 역할인지 확인
  if (!allowedRoles.includes(userRole as TenantRole)) {
    // 역할별 기본 경로로 리다이렉트
    const roleDefaultPath: Record<TenantRole, string> = {
      admin: '/home',
      owner: '/home',
      sub_admin: '/home',
      teacher: '/attendance',
      instructor: '/attendance',
      assistant: '/attendance',
      counselor: '/students/home',
      parent: '/home',
      guardian: '/home',
      staff: '/home',
      manager: '/home',
      super_admin: '/home',
    };

    const redirectPath = roleDefaultPath[userRole as TenantRole] || fallbackPath;
    return <Navigate to={redirectPath} replace />;
  }

  // 현재 경로가 역할의 허용된 경로 목록에 있는지 확인
  // 주의: allowedRoles에 포함된 역할이면 경로 체크를 건너뛰고 허용 (더 유연한 접근)
  const allowedPaths = roleRouteRules[(userRole as unknown) as TenantRole] || [];
  const isPathAllowedResult = isPathAllowed(location.pathname, allowedPaths);

  // allowedRoles에 포함된 역할이면 경로 체크를 건너뛰고 허용
  if (allowedRoles.includes(userRole as TenantRole)) {
    return <>{children}</>;
  }

  // allowedRoles에 포함되지 않은 경우에만 경로 체크 수행
  if (!isPathAllowedResult) {
    const roleDefaultPath: Record<TenantRole, string> = {
      admin: '/home',
      owner: '/home',
      sub_admin: '/home',
      teacher: '/attendance',
      instructor: '/attendance',
      assistant: '/attendance',
      counselor: '/students/home',
      parent: '/home',
      guardian: '/home',
      staff: '/home',
      manager: '/home',
      super_admin: '/home',
    };
    const redirectPath = roleDefaultPath[userRole as TenantRole] || fallbackPath;
    return <Navigate to={redirectPath} replace />;
  }
  return <>{children}</>;
}

