import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setApiContext } from '@api-sdk/core';
import { ModalProvider } from '@ui-core/react';
import App from './App';
// 전역 스타일은 @ui-core/react에서 중앙 관리
import '@ui-core/react/styles';

/**
 * [불변 규칙] Zero-Trust: Context는 미들웨어에서 인증 토큰에 의해 설정되어야 함
 *
 * 개발 환경에서는 임시로 설정 (실제 프로덕션에서는 미들웨어에서 설정)
 * TODO: 미들웨어 구현 완료 시 제거
 *
 * 주의: public-gateway는 로그인 전 접근 가능하므로 Context 설정은 선택적일 수 있음
 */
if (import.meta.env.DEV) {
  setApiContext({
    tenantId: undefined, // 공개 페이지는 tenantId가 없을 수 있음
    industryType: undefined,
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
