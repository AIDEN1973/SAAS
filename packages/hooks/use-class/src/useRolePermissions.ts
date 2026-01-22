/**
 * useRolePermissions Hook
 *
 * 직급별 페이지 접근 권한 관리 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [업종중립] 직급별 권한 설정 기능
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { TeacherPosition } from '@services/class-service';
import { POSITION_LABELS } from './useTeacherInvitation';

/**
 * 페이지 경로 정의
 * [업종중립] label은 기본값, 실제 표시 시 useIndustryTerms()로 동적 치환 필요
 * [참고] 실제 사이드바 메뉴 순서와 일치하도록 정의
 */
export const PAGE_PATHS = {
  // 메인 메뉴
  home: { path: '/home', labelKey: 'HOME', defaultLabel: '대시보드' },
  students: { path: '/students', labelKey: 'PERSON_LABEL_PRIMARY_MANAGEMENT', defaultLabel: '학생관리' },
  attendance: { path: '/attendance', labelKey: 'ATTENDANCE', defaultLabel: '출결관리' },
  appointments: { path: '/appointments', labelKey: 'APPOINTMENTS', defaultLabel: '예약관리' },
  notifications: { path: '/notifications', labelKey: 'NOTIFICATIONS', defaultLabel: '문자발송' },
  analytics: { path: '/analytics', labelKey: 'ANALYTICS', defaultLabel: '통계분석' },
  ai: { path: '/ai', labelKey: 'AI_INSIGHT', defaultLabel: '인공지능' },
  classes: { path: '/classes', labelKey: 'GROUP_MANAGEMENT', defaultLabel: '수업관리' },
  teachers: { path: '/teachers', labelKey: 'PERSON_LABEL_SECONDARY_MANAGEMENT', defaultLabel: '강사관리' },
  billing: { path: '/billing', labelKey: 'BILLING', defaultLabel: '수납관리' },
  // 설정 메뉴
  automation: { path: '/settings/automation', labelKey: 'AUTOMATION', defaultLabel: '자동화 설정' },
  alimtalk: { path: '/settings/alimtalk', labelKey: 'ALIMTALK', defaultLabel: '알림톡 설정' },
  // 기타 메뉴
  agent: { path: '/agent', labelKey: 'AGENT', defaultLabel: '에이전트 모드' },
  manual: { path: '/manual', labelKey: 'MANUAL', defaultLabel: '매뉴얼' },
  // 권한 설정 페이지 (관리자 전용, 목록에서 제외됨)
  settings: { path: '/settings/permissions', labelKey: 'SETTINGS', defaultLabel: '권한 설정' },
} as const;

/**
 * 업종별 동적 라벨 생성 함수
 * [업종중립] terms를 받아 동적으로 라벨 생성
 */
export function getPageLabel(
  key: PagePathKey,
  terms?: { PERSON_LABEL_PRIMARY?: string; PERSON_LABEL_SECONDARY?: string; GROUP_LABEL?: string }
): string {
  const page = PAGE_PATHS[key];
  if (!terms) return page.defaultLabel;

  // 업종별 동적 치환
  switch (key) {
    case 'students':
      return `${terms.PERSON_LABEL_PRIMARY || '학생'}관리`;
    case 'teachers':
      return `${terms.PERSON_LABEL_SECONDARY || '강사'}관리`;
    case 'classes':
      return `${terms.GROUP_LABEL || '수업'}관리`;
    default:
      return page.defaultLabel;
  }
}

export type PagePathKey = keyof typeof PAGE_PATHS;

/**
 * 직급별 기본 권한 (설정이 없을 때 사용)
 * [참고] 실제 라우트의 allowedRoles와 일치하도록 설정
 */
export const DEFAULT_PERMISSIONS: Record<TeacherPosition, string[]> = {
  vice_principal: ['*'],  // 전체 접근
  manager: ['*'],         // 전체 접근
  teacher: [
    '/home',
    '/students',
    '/attendance',
    '/classes',
    '/notifications',
    '/ai',
    '/manual',
  ],
  assistant: [
    '/home',
    '/attendance',
    '/manual',
  ],
  other: [
    '/home',
    '/students',
    '/attendance',
    '/classes',
    '/notifications',
    '/manual',
  ],
};

/**
 * 권한 데이터 타입
 */
export interface RolePermission {
  id: string;
  tenant_id: string;
  position: TeacherPosition;
  page_path: string;
  can_access: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 직급별 권한 조회 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */
export function useRolePermissions(position?: TeacherPosition) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['role-permissions', tenantId, position],
    queryFn: async () => {
      if (!tenantId) return [];

      // [불변 규칙] apiClient.get 사용 - tenant_id 자동 주입
      const filters: Record<string, unknown> = {};
      if (position) {
        filters.position = position;
      }

      const response = await apiClient.get<RolePermission>('role_permissions', {
        filters,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId,
  });
}

/**
 * 권한 업데이트 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [성능 최적화] Optimistic Update 적용: UI 즉시 반영, 백그라운드 DB 업데이트
 */
export function useUpdateRolePermission() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      position,
      pagePath,
      canAccess
    }: {
      position: TeacherPosition;
      pagePath: string;
      canAccess: boolean;
    }) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // [불변 규칙] apiClient.upsert 사용 - tenant_id 자동 주입
      const response = await apiClient.upsert<RolePermission>('role_permissions', {
        position,
        page_path: pagePath,
        can_access: canAccess,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,position,page_path',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as RolePermission;
    },
    // Optimistic Update: mutation 실행 전 즉시 캐시 업데이트
    onMutate: async ({ position, pagePath, canAccess }) => {
      console.log('[onMutate] 시작:', { position, pagePath, canAccess });

      // 진행 중인 refetch 취소 (position: undefined 포함)
      await queryClient.cancelQueries({ queryKey: ['role-permissions', tenantId, undefined] });

      // 이전 데이터 백업 (rollback용) - position: undefined 쿼리 키 사용
      const previousPermissions = queryClient.getQueryData<RolePermission[]>(['role-permissions', tenantId, undefined]);
      console.log('[onMutate] 이전 데이터:', previousPermissions);

      // 낙관적으로 캐시 업데이트 - position: undefined 쿼리 키 사용
      queryClient.setQueryData<RolePermission[]>(['role-permissions', tenantId, undefined], (old) => {
        if (!old) {
          console.log('[onMutate] 캐시가 비어있음');
          return old;
        }

        // 기존 권한 찾기
        const existingIndex = old.findIndex(
          p => p.position === position && p.page_path === pagePath
        );

        if (existingIndex >= 0) {
          // 기존 권한 업데이트
          const updated = [...old];
          updated[existingIndex] = {
            ...updated[existingIndex],
            can_access: canAccess,
            updated_at: new Date().toISOString(),
          };
          console.log('[onMutate] 기존 권한 업데이트:', updated[existingIndex]);
          return updated;
        } else {
          // 새 권한 추가 (임시 ID 사용)
          const newPermission = {
            id: `temp-${Date.now()}`,
            tenant_id: tenantId!,
            position,
            page_path: pagePath,
            can_access: canAccess,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          console.log('[onMutate] 새 권한 추가:', newPermission);
          return [...old, newPermission];
        }
      });

      // rollback용 이전 데이터 반환
      return { previousPermissions };
    },
    // 에러 발생 시 이전 상태로 rollback
    onError: (_err, _variables, context) => {
      if (context?.previousPermissions) {
        queryClient.setQueryData(['role-permissions', tenantId, undefined], context.previousPermissions);
      }
    },
    // 성공 시 서버 응답 데이터로 캐시 직접 업데이트 (refetch 없이)
    onSuccess: (data, { position, pagePath }) => {
      console.log('[onSuccess] 시작:', { data, position, pagePath });

      if (!data) {
        console.log('[onSuccess] 데이터 없음');
        return;
      }

      queryClient.setQueryData<RolePermission[]>(['role-permissions', tenantId, undefined], (old) => {
        if (!old) {
          console.log('[onSuccess] 캐시 비어있음, 새 배열 생성');
          return [data];
        }

        // 임시 ID를 가진 항목을 서버 데이터로 교체
        const existingIndex = old.findIndex(
          p => p.position === position && p.page_path === pagePath
        );

        if (existingIndex >= 0) {
          const updated = [...old];
          updated[existingIndex] = data;
          console.log('[onSuccess] 기존 항목 교체:', updated[existingIndex]);
          return updated;
        } else {
          console.log('[onSuccess] 새 항목 추가');
          return [...old, data];
        }
      });

      console.log('[onSuccess] 업데이트 후 캐시:', queryClient.getQueryData(['role-permissions', tenantId, undefined]));
    },
  });
}

/**
 * 직급별 권한 설명 생성 Hook (초대링크 모달용)
 * [업종중립] terms를 전달받아 동적 라벨 생성
 */
export function usePositionPermissionDescription(
  position: TeacherPosition,
  terms?: { PERSON_LABEL_PRIMARY?: string; PERSON_LABEL_SECONDARY?: string; GROUP_LABEL?: string }
) {
  const { data: permissions } = useRolePermissions(position);

  return useMemo(() => {
    // 라벨 변환 헬퍼
    const getLabel = (key: PagePathKey) => getPageLabel(key, terms);

    // DB에 설정이 없으면 기본 권한 사용
    if (!permissions || permissions.length === 0) {
      const defaultPaths = DEFAULT_PERMISSIONS[position];
      if (defaultPaths.includes('*')) {
        return '전체 메뉴 접근 가능';
      }
      const accessiblePages = (Object.keys(PAGE_PATHS) as PagePathKey[])
        .filter(key => key !== 'settings') // 설정은 관리자 전용
        .filter(key => defaultPaths.some(dp => PAGE_PATHS[key].path.startsWith(dp)))
        .map(key => getLabel(key));
      return `${accessiblePages.join(', ')} 접근 가능`;
    }

    // DB 설정 기반 권한 설명 생성
    // 설정(settings) 페이지는 제외 (관리자 전용)
    const relevantPermissions = permissions.filter(p => p.page_path !== '/settings');

    const accessiblePages = relevantPermissions
      .filter(p => p.can_access)
      .map(p => {
        const foundKey = (Object.keys(PAGE_PATHS) as PagePathKey[]).find(
          key => PAGE_PATHS[key].path === p.page_path
        );
        return foundKey ? getLabel(foundKey) : null;
      })
      .filter((label): label is string => label !== null);

    const restrictedPages = relevantPermissions
      .filter(p => !p.can_access)
      .map(p => {
        const foundKey = (Object.keys(PAGE_PATHS) as PagePathKey[]).find(
          key => PAGE_PATHS[key].path === p.page_path
        );
        return foundKey ? getLabel(foundKey) : null;
      })
      .filter((label): label is string => label !== null);

    // 모든 권한이 기본값인 경우 (DB에 설정이 있지만 모두 빈 경우)
    if (accessiblePages.length === 0 && restrictedPages.length === 0) {
      const defaultPaths = DEFAULT_PERMISSIONS[position];
      if (defaultPaths.includes('*')) {
        return '전체 메뉴 접근 가능';
      }
      // 기본 권한 기반 설명
      const defaultAccessible = (Object.keys(PAGE_PATHS) as PagePathKey[])
        .filter(key => key !== 'settings')
        .filter(key => defaultPaths.some(dp => PAGE_PATHS[key].path.startsWith(dp)))
        .map(key => getLabel(key));
      return `${defaultAccessible.join(', ')} 접근 가능`;
    }

    // 제한된 페이지가 없으면 전체 접근
    if (restrictedPages.length === 0) {
      return '전체 메뉴 접근 가능';
    }

    // 접근 가능한 페이지와 제한된 페이지 모두 표시
    if (accessiblePages.length > 0) {
      return `${accessiblePages.join(', ')} 접근 가능 (${restrictedPages.join(', ')} 접근 불가)`;
    }

    // 제한된 페이지만 있는 경우
    return `${restrictedPages.join(', ')} 접근 불가`;
  }, [permissions, position, terms]);
}

/**
 * 특정 경로에 대한 접근 권한 확인 Hook
 */
export function useHasPageAccess(position: TeacherPosition | undefined, pathname: string) {
  const { data: permissions } = useRolePermissions(position);

  return useMemo(() => {
    if (!position) return true;

    // DB에서 해당 경로의 권한 확인
    // 가장 구체적인 경로(긴 경로)가 먼저 매칭되도록 정렬
    if (permissions && permissions.length > 0) {
      const sortedPermissions = [...permissions].sort(
        (a, b) => b.page_path.length - a.page_path.length
      );
      const permission = sortedPermissions.find(p => pathname.startsWith(p.page_path));
      if (permission) return permission.can_access;
    }

    // 기본 권한 확인
    const defaultPaths = DEFAULT_PERMISSIONS[position];
    if (defaultPaths.includes('*')) return true;

    // 기본 권한도 구체적인 경로 우선 매칭
    const sortedDefaultPaths = [...defaultPaths].sort((a, b) => b.length - a.length);
    return sortedDefaultPaths.some(dp => pathname.startsWith(dp));
  }, [permissions, position, pathname]);
}

// Re-export for convenience
export { POSITION_LABELS };
