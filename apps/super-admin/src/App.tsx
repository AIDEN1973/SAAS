import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, useTheme } from '@ui-core/react';
import { SchemaEditorPage } from './pages/SchemaEditorPage';
import { LoginPage } from './pages/LoginPage';
import { AuthGuard } from './components/AuthGuard';

function App() {
  // 테넌트별 테마 적용 (super-admin은 본사 관리자용이므로 기본 테마 사용)
  useTheme({ mode: 'auto' });
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ErrorBoundary>
        <Routes>
          {/* 인증이 필요 없는 라우트 */}
          <Route path="/auth/login" element={<LoginPage />} />

          {/* 인증이 필요한 라우트 */}
          <Route
            path="/*"
            element={
              <AuthGuard>
                <Routes>
                  <Route path="/" element={<SchemaEditorPage />} />
                  <Route path="/schemas" element={<SchemaEditorPage />} />
                </Routes>
              </AuthGuard>
            }
          />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;

