import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout, Button, useModal } from '@ui-core/react';
import type { SidebarItem } from '@ui-core/react';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { ClassesPage } from './pages/ClassesPage';
import { TeachersPage } from './pages/TeachersPage';
import { AttendancePage } from './pages/AttendancePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { TenantSelectionPage } from './pages/TenantSelectionPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useLogout } from '@hooks/use-auth';
import { SchemaEditorPage } from '../../super-admin/src/pages/SchemaEditorPage';
import { AuthGuard } from '../../super-admin/src/components/AuthGuard';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const logout = useLogout();

  const sidebarItems: SidebarItem[] = [
    {
      id: 'students',
      label: '학생 관리',
      path: '/students',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'classes',
      label: '반 관리',
      path: '/classes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'teachers',
      label: '강사 관리',
      path: '/teachers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'attendance',
      label: '출결 관리',
      path: '/attendance',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/:id" element={<StudentDetailPage />} />
                <Route path="/classes" element={<ClassesPage />} />
                <Route path="/teachers" element={<TeachersPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route 
                  path="/super-admin" 
                  element={
                    <AuthGuard>
                      <SchemaEditorPage />
                    </AuthGuard>
                  } 
                />
                <Route path="/" element={<StudentsPage />} />
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
