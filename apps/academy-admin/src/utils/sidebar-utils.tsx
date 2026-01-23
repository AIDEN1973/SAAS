/**
 * 사이드바 메뉴 유틸리티
 * 역할별 + 업종별 사이드바 메뉴 생성
 */
import React from 'react';
import type { SidebarItem } from '@ui-core/react';
import type { TenantRole } from '@core/tenancy';
import type { IndustryTerms, VisiblePages } from '@industry/registry';
import type { RolePermission } from '@hooks/use-class';
import { DEFAULT_PERMISSIONS } from '@hooks/use-class';

/**
 * 사이드바 아이콘 SVG 컴포넌트들
 */
const SIDEBAR_ICONS = {
  dashboard: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
    </svg>
  ),
  students: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" x2="9.01" y1="9" y2="9"/>
      <line x1="15" x2="15.01" y1="9" y2="9"/>
    </svg>
  ),
  attendance: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.801 10A10 10 0 1 1 17 3.335"/>
      <path d="m9 11 3 3L22 4"/>
    </svg>
  ),
  appointments: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  ),
  notifications: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
    </svg>
  ),
  analytics: (
    <svg fill="none" viewBox="0 0 24 24">
      <path d="M5 21v-6"/>
      <path d="M12 21V9"/>
      <path d="M19 21V3"/>
    </svg>
  ),
  ai: (
    <svg fill="none" viewBox="0 0 24 24">
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>
    </svg>
  ),
  classes: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 .83.18 2 2 0 0 0 .83-.18l8.58-3.9a1 1 0 0 0 0-1.831z"/>
      <path d="M16 17h6"/>
      <path d="M19 14v6"/>
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 .825.178"/>
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l2.116-.962"/>
    </svg>
  ),
  teachers: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 21h8"/>
      <path d="m15 5 4 4"/>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
    </svg>
  ),
  billing: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/>
      <line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  ),
  settings: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  alimtalk: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  permissions: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  advanced: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 5H3"/>
      <path d="M15 12H3"/>
      <path d="M17 19H3"/>
    </svg>
  ),
};

export interface SidebarUtilsOptions {
  userRole: TenantRole | undefined;
  teacherPosition: string | null | undefined;
  rolePermissions: RolePermission[] | undefined;
  terms: IndustryTerms;
  isPageVisible: (page: keyof VisiblePages) => boolean;
}

/**
 * 권한 확인 헬퍼 함수
 */
export function createHasPagePermission(
  userRole: TenantRole | undefined,
  teacherPosition: string | null | undefined,
  rolePermissions: RolePermission[] | undefined
) {
  return (pagePath: string): boolean => {
    // 최고 관리자 역할은 항상 전체 접근 허용
    if (userRole && ['admin', 'owner', 'super_admin'].includes(userRole)) {
      return true;
    }

    // 강사 직급이 없으면 기본 허용
    if (!teacherPosition) {
      return true;
    }

    // 해당 직급의 권한이 DB에 있는지 확인
    const positionPermissions = rolePermissions?.filter(p => p.position === teacherPosition) || [];
    const hasPositionPermissionsInDB = positionPermissions.length > 0;

    if (hasPositionPermissionsInDB) {
      const sortedPermissions = [...positionPermissions].sort(
        (a, b) => b.page_path.length - a.page_path.length
      );

      const permission = sortedPermissions.find(p => pagePath.startsWith(p.page_path));

      if (permission) {
        return permission.can_access;
      }
    }

    // 기본 권한 사용
    const defaultPaths = DEFAULT_PERMISSIONS[teacherPosition as keyof typeof DEFAULT_PERMISSIONS];
    if (!defaultPaths) {
      return true;
    }

    if (defaultPaths.includes('*')) {
      return true;
    }

    const sortedDefaultPaths = [...defaultPaths].sort((a, b) => b.length - a.length);
    return sortedDefaultPaths.some(dp => pagePath.startsWith(dp));
  };
}

/**
 * 역할별 + 업종별 사이드바 메뉴 생성
 */
export function getSidebarItemsForRole(options: SidebarUtilsOptions): SidebarItem[] {
  const { userRole, teacherPosition, rolePermissions, terms, isPageVisible } = options;

  if (!userRole) {
    return [];
  }

  const hasPagePermission = createHasPagePermission(userRole, teacherPosition, rolePermissions);

  // Advanced 메뉴 아이템 정의
  const advancedMenuChildren: SidebarItem[] = [];

  if (isPageVisible('classes')) {
    advancedMenuChildren.push({
      id: 'classes-advanced',
      label: terms.GROUP_LABEL + '관리',
      path: terms.ROUTES.CLASSES || '/classes',
      icon: SIDEBAR_ICONS.classes,
    });
  }

  if (isPageVisible('teachers')) {
    advancedMenuChildren.push({
      id: 'teachers-advanced',
      label: terms.PERSON_LABEL_SECONDARY + '관리',
      path: terms.ROUTES.TEACHERS || '/teachers',
      icon: SIDEBAR_ICONS.teachers,
    });
  }

  if (isPageVisible('billing')) {
    advancedMenuChildren.push({
      id: 'billing-advanced',
      label: '수납관리',
      path: '/billing/home',
      icon: SIDEBAR_ICONS.billing,
    });
  }

  if (isPageVisible('automation')) {
    advancedMenuChildren.push({
      id: 'automation-settings-advanced',
      label: '자동화 설정',
      path: '/settings/automation',
      icon: SIDEBAR_ICONS.settings,
    });
  }

  if (isPageVisible('alimtalk')) {
    advancedMenuChildren.push({
      id: 'alimtalk-settings-advanced',
      label: '알림톡 설정',
      path: '/settings/alimtalk',
      icon: SIDEBAR_ICONS.alimtalk,
    });
  }

  advancedMenuChildren.push({
    id: 'permissions-settings-advanced',
    label: '권한 설정',
    path: '/settings/permissions',
    icon: SIDEBAR_ICONS.permissions,
  });

  const advancedMenuItems: SidebarItem[] = [
    {
      id: 'advanced',
      label: '더보기',
      isAdvanced: true,
      icon: SIDEBAR_ICONS.advanced,
      children: advancedMenuChildren,
    },
  ];

  // 핵심 메뉴 아이템
  const coreMenuItems: SidebarItem[] = [
    {
      id: 'home',
      label: '대시보드',
      path: '/home',
      icon: SIDEBAR_ICONS.dashboard,
    },
  ];

  if (isPageVisible('primary')) {
    coreMenuItems.push({
      id: 'students',
      label: terms.PERSON_LABEL_PRIMARY + '관리',
      path: terms.ROUTES.PRIMARY_LIST || '/students/home',
      icon: SIDEBAR_ICONS.students,
    });
  }

  if (isPageVisible('attendance')) {
    coreMenuItems.push({
      id: 'attendance',
      label: '출결관리',
      path: '/attendance',
      icon: SIDEBAR_ICONS.attendance,
    });
  }

  if (isPageVisible('appointments')) {
    coreMenuItems.push({
      id: 'appointments',
      label: '예약관리',
      path: terms.ROUTES.APPOINTMENTS || '/appointments',
      icon: SIDEBAR_ICONS.appointments,
    });
  }

  coreMenuItems.push({
    id: 'notifications',
    label: '문자발송',
    path: '/notifications',
    icon: SIDEBAR_ICONS.notifications,
  });

  if (isPageVisible('analytics')) {
    coreMenuItems.push({
      id: 'analytics',
      label: '통계분석',
      path: '/analytics',
      icon: SIDEBAR_ICONS.analytics,
    });
  }

  if (isPageVisible('ai')) {
    coreMenuItems.push({
      id: 'ai',
      label: '인공지능',
      path: '/ai',
      icon: SIDEBAR_ICONS.ai,
    });
  }

  // 역할별 필터링
  if (['admin', 'owner', 'sub_admin', 'super_admin'].includes(userRole)) {
    return [...coreMenuItems, ...advancedMenuItems];
  }

  if (userRole === 'manager') {
    return [
      ...coreMenuItems.filter(item => ['home', 'students', 'attendance', 'appointments', 'analytics', 'ai'].includes(item.id)),
      ...advancedMenuItems.filter(item => item.id === 'advanced').map(item => ({
        ...item,
        children: item.children?.filter(child =>
          ['classes-advanced', 'teachers-advanced', 'billing-advanced'].includes(child.id)
        ),
      })),
    ];
  }

  if (userRole === 'staff') {
    return [
      ...coreMenuItems.filter(item => ['home', 'students', 'attendance', 'appointments', 'notifications'].includes(item.id)),
      ...advancedMenuItems.filter(item => item.id === 'advanced').map(item => ({
        ...item,
        children: item.children?.filter(child =>
          ['classes-advanced', 'teachers-advanced'].includes(child.id)
        ),
      })),
    ];
  }

  if (userRole === 'counselor') {
    return coreMenuItems.filter(item =>
      ['home', 'students', 'attendance', 'appointments'].includes(item.id)
    );
  }

  if (userRole === 'teacher' || userRole === 'assistant') {
    const filteredCoreItems = coreMenuItems.filter(item => {
      if (!item.path) return true;
      return hasPagePermission(item.path);
    });

    const filteredAdvancedItems = advancedMenuItems
      .filter(item => item.id === 'advanced')
      .map(item => ({
        ...item,
        children: item.children?.filter(child => {
          if (!child.path) return true;
          return hasPagePermission(child.path);
        }),
      }))
      .filter(item => item.children && item.children.length > 0);

    return [...filteredCoreItems, ...filteredAdvancedItems];
  }

  return [];
}
