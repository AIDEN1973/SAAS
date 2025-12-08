import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setApiContext } from '@api-sdk/core';
import { ModalProvider } from '@ui-core/react';
import App from './App';
// 전역 스타일은 @ui-core/react에서 중앙 관리
import '@ui-core/react/styles';
import { checkSupabaseUrl, checkEnvVariables } from './utils/checkSupabaseUrl';

// 개발 환경에서 Supabase URL 확인
if (import.meta.env.DEV) {
  console.log('🔍 Supabase URL 확인 시작...');
  checkEnvVariables();
  checkSupabaseUrl();
}

/**
 * [불변 규칙] Zero-Trust: Context는 미들웨어에서 인증 컨텍스트에 자동 설정되어야 함
 *
 * 개발 환경에서만 임시 설정 (실제 프로덕션에서는 미들웨어에서 설정)
 * TODO: 미들웨어 구현 시 이 부분 제거
 *
 * 주의: 실제 테넌트가 있으면 실제 테넌트 ID를 사용하세요.
 * 개발용 테넌트 (00000000-0000-0000-0000-000000000000)는 마이그레이션 063_create_dev_tenant.sql 실행 후 사용 가능합니다.
 */
if (import.meta.env.DEV) {
  // 실제 테넌트가 있으면 실제 테넌트 ID 사용 (예: '5fe65589-ea61-431f-987e-55901e88bc83')
  // 개발용 테넌트를 사용하려면 아래 주석을 해제하세요
  // setApiContext({
  //   tenantId: '00000000-0000-0000-0000-000000000000', // 개발용 임시 값
  //   industryType: 'academy', // 개발용 임시 값
  // });

  // 실제 테넌트 사용 (로그인 후 테넌트 선택 프로세스에서 자동 설정됨)
  // 로그인하지 않은 상태에서는 tenantId가 없어도 됩니다.
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <App />
      </ModalProvider>
    </QueryClientProvider>
  </StrictMode>
);
