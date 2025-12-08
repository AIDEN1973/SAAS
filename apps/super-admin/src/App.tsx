import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { SchemaEditorPage } from './pages/SchemaEditorPage';
import { LoginPage } from './pages/LoginPage';
import { AuthGuard } from './components/AuthGuard';

function App() {
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

