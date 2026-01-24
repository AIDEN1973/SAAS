import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, useTheme } from '@ui-core/react';
import { SchemaEditorPage } from './pages/SchemaEditorPage';
import { PerformanceMonitoringPageLazy } from './pages/PerformanceMonitoringPage.lazy';
import { TenantsPage } from './pages/TenantsPage';
import { BusinessMetricsPage } from './pages/BusinessMetricsPage';
import { RevenueAnalyticsPage } from './pages/RevenueAnalyticsPage';
import { RegionalAnalyticsPage } from './pages/RegionalAnalyticsPage';
import { AlimtalkSettingsPage } from './pages/AlimtalkSettingsPage';
import { LoginPage } from './pages/LoginPage';
import { AuthGuard } from './components/AuthGuard';
import { Navigation } from './components/Navigation';

// Lazy loading fallback
function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      }}
    >
      <p style={{ color: 'var(--color-text-secondary)' }}>페이지 로딩 중...</p>
    </div>
  );
}

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
                <>
                  <Navigation />
                  <Routes>
                    <Route path="/" element={<SchemaEditorPage />} />
                    <Route path="/schemas" element={<SchemaEditorPage />} />
                    <Route
                      path="/performance"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <PerformanceMonitoringPageLazy />
                        </Suspense>
                      }
                    />
                    {/* Phase 1-3: 비즈니스 메트릭 */}
                    <Route path="/tenants" element={<TenantsPage />} />
                    <Route path="/business-metrics" element={<BusinessMetricsPage />} />
                    <Route path="/revenue" element={<RevenueAnalyticsPage />} />
                    <Route path="/regional" element={<RegionalAnalyticsPage />} />
                    {/* 알림톡 설정 */}
                    <Route path="/alimtalk" element={<AlimtalkSettingsPage />} />
                  </Routes>
                </>
              </AuthGuard>
            }
          />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;

