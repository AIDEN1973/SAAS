import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout, Button, useModal, useTheme } from '@ui-core/react';
import type { SidebarItem } from '@ui-core/react';
import { StudentsHomePage } from './pages/StudentsHomePage';
import { StudentsListPage } from './pages/StudentsListPage';
// StudentDetailPage는 StudentsPage의 레이어 메뉴로 통합됨
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

  // Location 변경 추적 (필요시 디버깅용으로 활성화)
  // useEffect(() => {
  //   console.log('[App.tsx] Location changed:', {
  //     pathname: location.pathname,
  //     search: location.search,
  //     hash: location.hash,
  //   });
  // }, [location]);

  // NOTE: 사이드바 아이템은 getSidebarItemsForRole()에서 생성합니다.

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
        label: '더보기',
        isAdvanced: true,
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 5H3"/>
            <path d="M15 12H3"/>
            <path d="M17 19H3"/>
          </svg>
        ),
        children: [
          {
            id: 'classes-advanced',
            label: '수업관리',
            path: '/classes',
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 .83.18 2 2 0 0 0 .83-.18l8.58-3.9a1 1 0 0 0 0-1.831z"/>
                <path d="M16 17h6"/>
                <path d="M19 14v6"/>
                <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 .825.178"/>
                <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l2.116-.962"/>
              </svg>
            ),
          },
          {
            id: 'teachers-advanced',
            label: '강사관리',
            path: '/teachers',
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 21h8"/>
                <path d="m15 5 4 4"/>
                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
              </svg>
            ),
          },
          {
            id: 'billing-advanced',
            label: '수납관리',
            path: '/billing/home',
            icon: (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2"/>
                <line x1="2" x2="22" y1="10" y2="10"/>
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
        label: '대시보드',
        path: '/home',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/>
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
          </svg>
        ),
      },
      {
        id: 'students',
        label: '학생관리',
        path: '/students/home',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" x2="9.01" y1="9" y2="9"/>
            <line x1="15" x2="15.01" y1="9" y2="9"/>
          </svg>
        ),
      },
      {
        id: 'attendance',
        label: '출결관리',
        path: '/attendance',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.801 10A10 10 0 1 1 17 3.335"/>
            <path d="m9 11 3 3L22 4"/>
          </svg>
        ),
      },
      {
        id: 'notifications',
        label: '문자발송',
        path: '/notifications',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>
            <rect x="2" y="4" width="20" height="16" rx="2"/>
          </svg>
        ),
      },
      {
        id: 'analytics',
        label: '통계분석',
        path: '/analytics',
        icon: (
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M5 21v-6"/>
            <path d="M12 21V9"/>
            <path d="M19 21V3"/>
          </svg>
        ),
      },
      {
        id: 'ai',
        label: '인공지능',
        path: '/ai',
        icon: (
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>
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
        ...coreMenuItems.filter(item => ['home', 'students', 'attendance', 'notifications'].includes(item.id)),
        ...advancedMenuItems.filter(item => item.id === 'advanced').map(item => ({
          ...item,
          children: item.children?.filter(child =>
            ['classes-advanced', 'teachers-advanced'].includes(child.id)
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
  const sidebarItems = getSidebarItemsForRole(userRole as TenantRole | undefined);

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
                {/* StudentDetailPage는 레이어 메뉴로 통합됨 - URL은 StudentsPage로 리다이렉트 */}
                <Route path="/students/:id" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><StudentsListPage /></RoleBasedRoute>} />
                <Route path="/students/:id/counsel" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><StudentsListPage /></RoleBasedRoute>} />
                <Route path="/students/:id/attendance" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'assistant', 'counselor', 'staff', 'manager', 'super_admin']}><StudentsListPage /></RoleBasedRoute>} />
                <Route path="/students/:id/risk" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'teacher', 'counselor', 'staff', 'manager', 'super_admin']}><StudentsListPage /></RoleBasedRoute>} />
                <Route path="/students/:id/welcome" element={<RoleBasedRoute allowedRoles={['admin', 'owner', 'sub_admin', 'staff', 'manager', 'super_admin']}><StudentsListPage /></RoleBasedRoute>} />
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
