import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setApiContext } from '@api-sdk/core';
import { ModalProvider } from '@ui-core/react';
import App from './App';
// 전역 스타일은 @ui-core/react에서 중앙 관리
import '@ui-core/react/styles';

/**
 * [불변 규칙] Zero-Trust: Context는 미들웨어나 인증 시스템에서 설정되어야 함
 * 
 * 개발 환경에서는 임시로 설정 (실제 프로덕션에서는 미들웨어에서 설정)
 * TODO: 미들웨어 구현 시 이 부분 제거
 */
if (import.meta.env.DEV) {
  setApiContext({
    tenantId: '00000000-0000-0000-0000-000000000000', // 개발용 임시 값
    industryType: 'academy', // 개발용 임시 값
  });
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

