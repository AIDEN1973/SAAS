/**
 * Public Gateway 앱
 *
 * 아키텍처 문서 11.1 섹션 참조
 *
 * Public Gateway 역할:
 * - 학부모 앱 접근
 * - QR 출결 접근
 * - 공개 API 제공
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, useTheme } from '@ui-core/react';
import { QRAttendancePage } from './pages/QRAttendancePage';
import { PaymentPage } from './pages/PaymentPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { HomePage } from './pages/HomePage';
import { TeacherRegisterPage } from './pages/TeacherRegisterPage';

function App() {
  // 테넌트별 테마 적용 (public-gateway는 로그인 전 접근 가능하므로 기본 테마 사용)
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
          <Route path="/" element={<HomePage />} />
          <Route path="/attend" element={<QRAttendancePage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/teacher-register" element={<TeacherRegisterPage />} />
        </Routes>
    </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
