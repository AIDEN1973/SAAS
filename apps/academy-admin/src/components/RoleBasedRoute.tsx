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
import { useCurrentTeacherPosition, useRolePermissions, DEFAULT_PERMISSIONS } from '@hooks/use-class';

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
  sub_admin: ['*'],  // [요구사항] 부원장: 전체 메뉴 접근
  teacher: [
    '/home',
    '/attendance/**',
    '/students/**',  // [요구사항] 선생님: 전체 메뉴 접근 (담당 수업만은 UI 필터링)
    '/classes/**',   // [요구사항] 수업 접근 가능 (담당 수업만 표시는 UI에서 처리)
    '/notifications/**',
    '/ai/insights/summary', // AI 요약 접근 가능 (상세 분석 제한)
    // /billing/** 접근 금지
    // /teachers/** 접근 금지 (강사관리)
    // /analytics/** 접근 금지 (요약만 제공)
  ],
  instructor: [
    '/home',
    '/attendance/**',
    '/students/**',  // [요구사항] 선생님: 전체 메뉴 접근 (담당 수업만은 UI 필터링)
    '/classes/**',   // [요구사항] 수업 접근 가능 (담당 수업만 표시는 UI에서 처리)
    '/notifications/**',
    '/ai/insights/summary', // AI 요약 접근 가능 (상세 분석 제한)
    // /billing/** 접근 금지
    // /teachers/** 접근 금지 (강사관리)
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
    '/notifications/**',
    // /billing/** 접근 금지 (수납관리)
    // /teachers/** 접근 금지 (강사관리)
  ],
  manager: ['*'],  // [요구사항] 실장: 전체 메뉴 접근
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

export function RoleBasedRoute({ children, fallbackPath = '/home' }: RoleBasedRouteProps) {
  const location = useLocation();
  const { data: userRole, isLoading: roleLoading, isFetching: roleFetching } = useUserRole();
  const { data: teacherPosition } = useCurrentTeacherPosition();
  const { data: rolePermissions, isLoading: permissionsLoading } = useRolePermissions(teacherPosition || undefined);
  const context = getApiContext();
  const tenantId = context?.tenantId;

  // 로딩 중이거나 데이터를 가져오는 중이면 대기
  if (roleLoading || roleFetching || permissionsLoading) {
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
    if (location.pathname === fallbackPath) {
      return <>{children}</>;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  /**
   * 권한 확인 로직 (DB 기반)
   * 1. 최고 관리자 역할 (admin, owner, super_admin) → 모든 접근 허용
   * 2. Teacher 계열 (teacher, assistant, sub_admin, manager) → DB role_permissions 체크
   * 3. 기타 역할 (staff, counselor) → roleRouteRules 사용
   */

  // 1. 최고 관리자 역할은 모든 접근 허용 (권한 설정 불가)
  if (['admin', 'owner', 'super_admin'].includes(userRole)) {
    return <>{children}</>;
  }

  // 2. Teacher 계열 역할은 DB role_permissions 체크
  // sub_admin (부원장), manager (실장), teacher (선생님), assistant (조교)
  if (teacherPosition) {
    // 해당 직급의 권한이 DB에 있는지 확인
    const positionPermissions = rolePermissions?.filter(p => p.position === teacherPosition) || [];
    const hasPositionPermissionsInDB = positionPermissions.length > 0;

    if (hasPositionPermissionsInDB) {
      // DB에 권한이 있으면 DB 우선 사용, 없으면 기본 권한 fallback
      const sortedPermissions = [...positionPermissions].sort(
        (a, b) => b.page_path.length - a.page_path.length
      );
      const permission = sortedPermissions.find(p => location.pathname.startsWith(p.page_path));

      // DB에 명시적으로 권한이 있으면 DB 값 사용
      if (permission) {
        if (permission.can_access) {
          return <>{children}</>;
        }
        // DB에서 명시적으로 거부
        return <Navigate to="/home" replace />;
      }

      // DB에 해당 경로가 없으면 기본 권한으로 fallback (이 부분이 핵심!)
    }

    // DB에 권한이 전혀 없거나, DB에 해당 경로가 없으면 기본 권한 사용
    const defaultPaths = DEFAULT_PERMISSIONS[teacherPosition];
    if (defaultPaths.includes('*')) {
      return <>{children}</>;
    }

    const sortedDefaultPaths = [...defaultPaths].sort((a, b) => b.length - a.length);
    const hasDefaultAccess = sortedDefaultPaths.some(dp => location.pathname.startsWith(dp));

    if (hasDefaultAccess) {
      return <>{children}</>;
    }

    // 기본 권한도 없으면 /home으로 리다이렉트
    return <Navigate to="/home" replace />;
  }

  // 3. 기타 역할 (staff, counselor)은 기존 roleRouteRules 사용
  const allowedPaths = roleRouteRules[(userRole as unknown) as TenantRole] || [];
  const isPathAllowedResult = isPathAllowed(location.pathname, allowedPaths);

  if (isPathAllowedResult) {
    return <>{children}</>;
  }

  // 접근 불가 시 역할별 기본 경로로 리다이렉트
  const roleDefaultPath: Record<TenantRole, string> = {
    admin: '/home',
    owner: '/home',
    sub_admin: '/home',
    teacher: '/home',
    instructor: '/home',
    assistant: '/home',
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

