import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout, Button, useModal, useTheme } from '@ui-core/react';
import type { SidebarItem } from '@ui-core/react';
import { StudentsHomePage } from './pages/StudentsHomePage';
import { StudentsListPage } from './pages/StudentsListPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { ClassesPage } from './pages/ClassesPage';
import { TeachersPage } from './pages/TeachersPage';
import { AttendancePage } from './pages/AttendancePage';
import { BillingPage } from './pages/BillingPage';
import { BillingHomePage } from './pages/BillingHomePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AIPage } from './pages/AIPage';
import { HomePage } from './pages/HomePage';
import { AllCardsPage } from './pages/AllCardsPage';
import { StudentTasksPage } from './pages/StudentTasksPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { TenantSelectionPage } from './pages/TenantSelectionPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleBasedRoute } from './components/RoleBasedRoute';
import { useLogout, useUserRole } from '@hooks/use-auth';
import { SchemaEditorPage } from '../../super-admin/src/pages/SchemaEditorPage';
import { AuthGuard } from '../../super-admin/src/components/AuthGuard';
import type { TenantRole } from '@core/tenancy';

function AppContent() {
  // 테넌트별 테마 적용
  useTheme({ mode: 'auto' });
  const location = useLocation();
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const logout = useLogout();
  const { data: userRole } = useUserRole();

  // 디버깅: location 변경 추적
  useEffect(() => {
    console.log('[App.tsx] Location changed:', {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location]);

  // 전체 사이드바 아이템 정의는 getSidebarItemsForRole 함수 내부로 이동
  // (Advanced 메뉴 구조를 반영하기 위해)
  const allSidebarItems: SidebarItem[] = [
    {
      id: 'home',
      label: '홈',
      path: '/home',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'students',
      label: '학생 관리',
      path: '/students/home',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'classes',
      label: '반 관리',
      path: '/classes',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'teachers',
      label: '강사 관리',
      path: '/teachers',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'attendance',
      label: '출결 관리',
      path: '/attendance',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'billing',
      label: '수납/청구',
      path: '/billing/home',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: '메시지/공지',
      path: '/notifications',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      id: 'analytics',
      label: '지역 통계',
      path: '/analytics',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'ai',
      label: 'AI 분석',
      path: '/ai',
      icon: (
        <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
  ];

  /**
   * 역할별 사이드바 메뉴 필터링 (아키텍처 문서 2.3, 4.8 참조)
   *
   * 역할별 UI 단순화 원칙:
   * - Assistant: 출결만 노출
   * - Teacher: 홈, 학생 관리, 출결 관리, AI 분석만 노출 (반 관리는 읽기 전용)
   * - Admin/Owner/Sub Admin: 전체 메뉴 노출
   * - 통계와 AI는 핵심 메뉴이므로 Advanced에 들어가면 안 됨
   * - 반/강사 관리, 수납/청구, 메시지/공지는 Advanced 메뉴 (일부 역할만)
   *
   * Advanced 메뉴 구조 (아키텍처 문서 4.8):
   * - 반/강사 관리
   * - 출결 설정
   * - 상품/청구 설정
   * - 메시지 템플릿/예약발송
   * - 정산/매출 상세
   * - 시스템 설정
   */
  const getSidebarItemsForRole = (role: TenantRole | undefined): SidebarItem[] => {
    if (!role) {
      // 역할이 아직 로드되지 않은 경우 빈 배열 반환
      return [];
    }

    // Advanced 메뉴 아이템 정의 (아키텍처 문서 4.8 참조)
    const advancedMenuItems: SidebarItem[] = [
      {
        id: 'advanced',
        label: '고급 메뉴',
        isAdvanced: true,
        icon: (
          <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        ),
        children: [
          {
            id: 'classes-advanced',
            label: '반/강사 관리',
            path: '/classes',
            icon: (
              <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
          {
            id: 'teachers-advanced',
            label: '강사 관리',
            path: '/teachers',
            icon: (
              <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            id: 'billing-advanced',
            label: '수납/청구 설정',
            path: '/billing/home',
            icon: (
              <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
          },
          {
            id: 'notifications-advanced',
            label: '메시지 템플릿/예약발송',
            path: '/notifications',
            icon: (
              <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            ),
          },
        ],
      },
    ];

    // 기본 메뉴 아이템 (핵심 메뉴 - Advanced에 포함되지 않음)
    const coreMenuItems: SidebarItem[] = [
      {
        id: 'home',
        label: '홈',
        path: '/home',
        icon: (
          <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        id: 'students',
        label: '학생 관리',
        path: '/students/home',
        icon: (
          <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        id: 'attendance',
        label: '출결 관리',
        path: '/attendance',
        icon: (
          <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        id: 'analytics',
        label: '지역 통계',
        path: '/analytics',
        icon: (
          <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        id: 'ai',
        label: 'AI 분석',
        path: '/ai',
        icon: (
          <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        ),
      },
    ];

    // Admin, Owner, Sub Admin, Super Admin: 전체 메뉴 노출 (핵심 메뉴 + Advanced 메뉴)
    if (['admin', 'owner', 'sub_admin', 'super_admin'].includes(role)) {
      return [...coreMenuItems, ...advancedMenuItems];
    }

    // Manager: 핵심 메뉴 + Advanced 메뉴 (수납/청구 포함)
    if (role === 'manager') {
      return [
        ...coreMenuItems.filter(item => ['home', 'students', 'attendance', 'analytics', 'ai'].includes(item.id)),
        ...advancedMenuItems.filter(item => item.id === 'advanced').map(item => ({
          ...item,
          children: item.children?.filter(child =>
            ['classes-advanced', 'teachers-advanced', 'billing-advanced'].includes(child.id)
          ),
        })),
      ];
    }

    // Staff: 핵심 메뉴 + Advanced 메뉴 (메시지/공지 포함)
    if (role === 'staff') {
      return [
        ...coreMenuItems.filter(item => ['home', 'students', 'attendance'].includes(item.id)),
        ...advancedMenuItems.filter(item => item.id === 'advanced').map(item => ({
          ...item,
          children: item.children?.filter(child =>
            ['classes-advanced', 'teachers-advanced', 'notifications-advanced'].includes(child.id)
          ),
        })),
      ];
    }

    // Counselor: 핵심 메뉴만 (Advanced 메뉴 없음)
    if (role === 'counselor') {
      return coreMenuItems.filter(item =>
        ['home', 'students', 'attendance'].includes(item.id)
      );
    }

    // Teacher: 핵심 메뉴만 (Advanced 메뉴 없음, 반 관리는 읽기 전용)
    // 아키텍처 문서 2.3: "오늘의 반 + 학생 리스트 + 출결 체크만 노출"
    // 아키텍처 문서 2.4: "/analytics/** 접근 금지 (요약만 제공)"
    // 통계와 AI는 핵심 메뉴이므로 Advanced에 들어가면 안 됨 (4.8)
    if (role === 'teacher') {
      return coreMenuItems.filter(item =>
        ['home', 'students', 'attendance', 'ai'].includes(item.id)
        // analytics는 제외 (요약만 제공, 상세 분석 제한)
      );
    }

    // Assistant: 출결만 노출 (아키텍처 문서 2.3: "출결 버튼만 노출")
    if (role === 'assistant') {
      return coreMenuItems.filter(item => item.id === 'attendance');
    }

    // 기본값: 빈 배열
    return [];
  };

  // 역할별 필터링된 사이드바 아이템
  const sidebarItems = getSidebarItemsForRole(userRole);

  const handleSidebarItemClick = (item: SidebarItem) => {
    console.log('[App.tsx] handleSidebarItemClick called:', {
      itemId: item.id,
      itemPath: item.path,
      currentPath: location.pathname,
      isAdvanced: item.isAdvanced,
      hasChildren: !!item.children,
    });

    // Advanced 메뉴는 Sidebar 컴포넌트에서 펼치기/접기 처리하므로 여기서는 무시
    if (item.isAdvanced && item.children && item.children.length > 0) {
      return;
    }

    // 일반 메뉴 클릭 시 경로 이동
    if (item.path) {
      console.log('[App.tsx] Navigating to:', item.path);
      navigate(item.path);
      console.log('[App.tsx] Navigate called, new path should be:', item.path);
    } else {
      console.warn('[App.tsx] Sidebar item has no path:', item);
    }
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      navigate('/auth/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그아웃에 실패했습니다.';
      showAlert('오류', message);
    }
  };

  return (
    <Routes>
      {/* 인증이 필요 없는 라우트 */}
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />
      <Route path="/auth/select-tenant" element={<TenantSelectionPage />} />

      {/* 인증이 필요한 라우트 */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout
              header={{
                title: '디어쌤 학원관리',
                rightContent: (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                  >
                    로그아웃
                  </Button>
                ),
              }}
              sidebar={{
                items: sidebarItems,
                currentPath: location.pathname,
                onItemClick: handleSidebarItemClick,
              }}
            >
              <Routes>
                <Route path="/home" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><HomePage /></RoleBasedRoute>} />
                <Route path="/home/all-cards" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><AllCardsPage /></RoleBasedRoute>} />
                <Route path="/students/home" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><StudentsHomePage /></RoleBasedRoute>} />
                <Route path="/students/tasks" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><StudentTasksPage /></RoleBasedRoute>} />
                <Route path="/students/list" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><StudentsListPage /></RoleBasedRoute>} />
                <Route path="/students" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><StudentsHomePage /></RoleBasedRoute>} />
                <Route path="/students/:id" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><StudentDetailPage /></RoleBasedRoute>} />
                <Route path="/students/:id/counsel" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><StudentDetailPage /></RoleBasedRoute>} />
                <Route path="/students/:id/attendance" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><StudentDetailPage /></RoleBasedRoute>} />
                <Route path="/students/:id/risk" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><StudentDetailPage /></RoleBasedRoute>} />
                <Route path="/students/:id/welcome" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'staff', 'manager', 'super_admin']}><StudentDetailPage /></RoleBasedRoute>} />
                <Route path="/classes" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'staff', 'manager', 'super_admin']}><ClassesPage /></RoleBasedRoute>} />
                <Route path="/teachers" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'staff', 'manager', 'super_admin']}><TeachersPage /></RoleBasedRoute>} />
                <Route path="/attendance" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><AttendancePage /></RoleBasedRoute>} />
                <Route path="/billing/home" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'manager', 'super_admin']}><BillingHomePage /></RoleBasedRoute>} />
                <Route path="/billing/list" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'manager', 'super_admin']}><BillingPage /></RoleBasedRoute>} />
                <Route path="/billing" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'manager', 'super_admin']}><BillingHomePage /></RoleBasedRoute>} />
                <Route path="/notifications" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'staff', 'manager', 'super_admin']}><NotificationsPage /></RoleBasedRoute>} />
                <Route path="/analytics" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'manager', 'super_admin']}><AnalyticsPage /></RoleBasedRoute>} />
                <Route path="/ai" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><AIPage /></RoleBasedRoute>} />
                <Route
                  path="/super-admin"
                  element={
                    <AuthGuard>
                      <SchemaEditorPage />
                    </AuthGuard>
                  }
                />
                <Route path="/" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><HomePage /></RoleBasedRoute>} />
                <Route path="*" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><HomePage /></RoleBasedRoute>} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
