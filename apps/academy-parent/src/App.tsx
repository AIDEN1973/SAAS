/**
 * 학부모 앱
 *
 * 아키텍처 문서 2.7 섹션 참조
 *
 * 학부모 앱은 Public Gateway를 통한 인증을 사용하며,
 * 자녀별 결제 내역, 출결 알림 등을 조회할 수 있습니다.
 */

import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout, Button, useModal, useTheme } from '@ui-core/react';
import type { SidebarItem } from '@ui-core/react';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { ChildrenPage } from './pages/ChildrenPage';
import { BillingPage } from './pages/BillingPage';
import { AttendanceNotificationsPage } from './pages/AttendanceNotificationsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useLogout } from '@hooks/use-auth';
import { Agentation } from 'agentation';

function AppContent() {
  // 테넌트별 테마 적용
  useTheme({ mode: 'auto' });
  const location = useLocation();
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const logout = useLogout();

  const sidebarItems: SidebarItem[] = [
    {
      id: 'home',
      label: '홈',
      path: '/home',
      icon: (
        <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'children',
      label: '자녀 관리',
      path: '/children',
      icon: (
        <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'billing',
      label: '결제 내역',
      path: '/billing',
      icon: (
        <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'attendance',
      label: '출결 알림',
      path: '/attendance',
      icon: (
        <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const handleSidebarItemClick = (item: SidebarItem) => {
    if (item.path) {
      navigate(item.path);
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

      {/* 인증이 필요한 라우트 */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout
              header={{
                title: '디어쌤 학부모',
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
                <Route path="/home" element={<HomePage />} />
                <Route path="/children" element={<ChildrenPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/attendance" element={<AttendanceNotificationsPage />} />
                <Route path="/" element={<HomePage />} />
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
    <>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppContent />
      </BrowserRouter>
      {/* 개발 환경에서만 agentation 활성화 */}
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}

export default App;
