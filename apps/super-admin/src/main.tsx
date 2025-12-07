import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setApiContext } from '@api-sdk/core';
import { ModalProvider } from '@ui-core/react';
import App from './App';
// ?„ì—­ ?¤í??¼ì? @ui-core/react?ì„œ ì¤‘ì•™ ê´€ë¦?
import '@ui-core/react/styles';

/**
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: Context??ë¯¸ë“¤?¨ì–´???¸ì¦ ?œìŠ¤?œì—???¤ì •?˜ì–´????
 * 
 * ê°œë°œ ?˜ê²½?ì„œ???„ì‹œë¡??¤ì • (?¤ì œ ?„ë¡œ?•ì…˜?ì„œ??ë¯¸ë“¤?¨ì–´?ì„œ ?¤ì •)
 * TODO: ë¯¸ë“¤?¨ì–´ êµ¬í˜„ ????ë¶€ë¶??œê±°
 * 
 * ì£¼ì˜: super-admin?€ ë³¸ì‚¬ ê´€ë¦¬ì?©ì´ë¯€ë¡?tenantIdê°€ ? íƒ?ì¼ ???ˆìŒ
 */
if (import.meta.env.DEV) {
  setApiContext({
    tenantId: undefined, // super-admin?€ ë³¸ì‚¬ ê´€ë¦¬ì?©ì´ë¯€ë¡?tenantIdê°€ ?†ì„ ???ˆìŒ
    industryType: undefined, // ë³¸ì‚¬??ëª¨ë“  ?…ì¢… ê´€ë¦?
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

