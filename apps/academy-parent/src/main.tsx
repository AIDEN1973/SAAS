import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setApiContext } from '@api-sdk/core';
import App from './App';
// ?„ì—­ ?¤í??¼ì? @ui-core/react?ì„œ ì¤‘ì•™ ê´€ë¦?
import '@ui-core/react/styles';

/**
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: Context??ë¯¸ë“¤?¨ì–´???¸ì¦ ?œìŠ¤?œì—???¤ì •?˜ì–´????
 * 
 * ê°œë°œ ?˜ê²½?ì„œ???„ì‹œë¡??¤ì • (?¤ì œ ?„ë¡œ?•ì…˜?ì„œ??ë¯¸ë“¤?¨ì–´?ì„œ ?¤ì •)
 * TODO: ë¯¸ë“¤?¨ì–´ êµ¬í˜„ ????ë¶€ë¶??œê±°
 */
if (import.meta.env.DEV) {
  setApiContext({
    tenantId: '00000000-0000-0000-0000-000000000000', // ê°œë°œ???„ì‹œ ê°?
    industryType: 'academy', // ê°œë°œ???„ì‹œ ê°?
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
      <App />
    </QueryClientProvider>
  </StrictMode>
);

