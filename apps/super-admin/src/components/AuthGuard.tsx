/**
 * Auth Guard Component
 * 
 * [ë¶ˆë? ê·œì¹™] Super Admin ?±ì—???¸ì¦ ?íƒœ ?•ì¸ ë°?ë¡œê·¸???˜ì´ì§€ë¡?ë¦¬ë‹¤?´ë ‰?? * [ë¶ˆë? ê·œì¹™] academy-admin ?±ê³¼ ?™ì¼??Supabase ?¸ìŠ¤?´ìŠ¤ë¥??¬ìš©?˜ë?ë¡??¸ì…˜ ê³µìœ  ê°€?? */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@lib/supabase-client';
import { Container, Card, Button } from '@ui-core/react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        
        // ?¤ë¥¸ ?¬íŠ¸(localhost:3000)?ì„œ ?¸ì…˜ ê³µìœ  ?œë„
        // Supabase??localStorage???¸ì…˜???€?¥í•˜ë¯€ë¡? ?¤ë¥¸ origin?ì„œ??ê³µìœ ?˜ì? ?ŠìŠµ?ˆë‹¤.
        // ?°ë¼??academy-admin ?±ì˜ localStorage?ì„œ ?¸ì…˜???½ì–´?€???©ë‹ˆ??
        // ?˜ì?ë§?ë¸Œë¼?°ì? ë³´ì•ˆ ?•ì±…???¤ë¥¸ origin??localStorage???‘ê·¼?????†ìœ¼ë¯€ë¡?
        // ?¬ìš©?ê? academy-admin ?±ì—??ë¡œê·¸?¸í•œ ??super-admin ?±ìœ¼ë¡??Œì•„?€???©ë‹ˆ??
        
        // ?„ì¬ ?¸ì…˜ ?•ì¸
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth Guard] ?¸ì…˜ ?•ì¸ ?¤íŒ¨:', error);
          setIsAuthenticated(false);
          setIsLoading(false);
          // ?¤ë¥˜ ë°œìƒ ?œì—??ë¡œê·¸???˜ì´ì§€ë¡?ë¦¬ë‹¤?´ë ‰??          navigate('/auth/login');
          return;
        }

        if (session) {
          console.log('[Auth Guard] ?¸ì¦???¬ìš©??', session.user.email);
          setIsAuthenticated(true);
        } else {
          console.warn('[Auth Guard] ?¸ì…˜???†ìŠµ?ˆë‹¤. ë¡œê·¸???˜ì´ì§€ë¡??´ë™?©ë‹ˆ??');
          setIsAuthenticated(false);
          // super-admin ?±ì˜ ë¡œê·¸???˜ì´ì§€ë¡??ë™ ë¦¬ë‹¤?´ë ‰??          navigate('/auth/login');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('[Auth Guard] ?¸ì¦ ?•ì¸ ì¤??¤ë¥˜:', error);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    }

    checkAuth();

    // ?¸ì¦ ?íƒœ ë³€ê²?ê°ì?
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth Guard] ?¸ì¦ ?íƒœ ë³€ê²?', event, session?.user?.email);
      setIsAuthenticated(!!session);
      
      if (event === 'SIGNED_OUT') {
        navigate('/auth/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md">
          <p>?¸ì¦ ?•ì¸ ì¤?..</p>
        </Card>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container maxWidth="sm" padding="lg" className="flex items-center justify-center min-h-screen">
        <Card padding="lg">
          <h2 className="text-xl font-bold mb-4">ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??/h2>
          <p className="mb-6 text-gray-600">
            Super Admin ê¸°ëŠ¥???¬ìš©?˜ë ¤ë©?ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??
            <br />
            <br />
            <strong>ì¤‘ìš”:</strong> ?¤ë¥¸ ?¬íŠ¸(localhost:3000)?ì„œ ë¡œê·¸?¸í•œ ê²½ìš°,
            <br />
            ???˜ì´ì§€ë¥??ˆë¡œê³ ì¹¨?˜ê±°???„ë˜ ë²„íŠ¼???´ë¦­?˜ì„¸??
          </p>
          <div className="space-y-2">
            <Button
              variant="solid"
              color="primary"
              fullWidth
              onClick={() => {
                // super-admin ?±ì˜ ë¡œê·¸???˜ì´ì§€ë¡??´ë™
                const returnTo = encodeURIComponent(window.location.href);
                navigate(`/auth/login?returnTo=${returnTo}`);
              }}
            >
              ë¡œê·¸???˜ì´ì§€ë¡??´ë™
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={async () => {
                // ?„ì¬ ?˜ì´ì§€ ?ˆë¡œê³ ì¹¨
                // academy-admin ?±ì—??ë¡œê·¸?¸í•œ ê²½ìš°, ?¸ì…˜??ê³µìœ ?˜ì? ?Šì„ ???ˆìœ¼ë¯€ë¡?                // ?˜ë™?¼ë¡œ ?¸ì…˜???•ì¸?˜ê±°???ˆë¡œê³ ì¹¨
                const supabase = createClient();
                
                // ?¸ì…˜ ?•ì¸ ?„ì— ? ì‹œ ?€ê¸?(?¸ì…˜??ë³µì›???œê°„ ?œê³µ)
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session) {
                  console.log('[Auth Guard] ?¸ì…˜ ë°œê²¬! ?ˆë¡œê³ ì¹¨?©ë‹ˆ??');
                  window.location.reload();
                } else {
                  console.warn('[Auth Guard] ?¸ì…˜???¬ì „???†ìŠµ?ˆë‹¤.');
                  console.warn('[Auth Guard] ì°¸ê³ : localhost:3000ê³?localhost:3002???¤ë¥¸ origin?´ë?ë¡?);
                  console.warn('[Auth Guard] ?¸ì…˜???ë™?¼ë¡œ ê³µìœ ?˜ì? ?ŠìŠµ?ˆë‹¤.');
                  console.warn('[Auth Guard] ?´ê²° ë°©ë²•:');
                  console.warn('[Auth Guard]   1. academy-admin ??http://localhost:3000)?ì„œ ë¡œê·¸??);
                  console.warn('[Auth Guard]   2. ë¡œê·¸???????˜ì´ì§€ë¡??Œì•„?€??"ë¡œê·¸???˜ì´ì§€ë¡??´ë™" ë²„íŠ¼ ?´ë¦­');
                  console.warn('[Auth Guard]   3. ?ëŠ” ê°™ì? ?¬íŠ¸?ì„œ ?œë¸Œ?¨ìŠ¤ë¡??¼ìš°??(ê¶Œì¥)');
                  
                  alert(
                    '?¸ì…˜???†ìŠµ?ˆë‹¤.\n\n' +
                    'localhost:3000ê³?localhost:3002???¤ë¥¸ origin?´ë?ë¡?n' +
                    '?¸ì…˜???ë™?¼ë¡œ ê³µìœ ?˜ì? ?ŠìŠµ?ˆë‹¤.\n\n' +
                    '?´ê²° ë°©ë²•:\n' +
                    '1. academy-admin ??http://localhost:3000)?ì„œ ë¡œê·¸??n' +
                    '2. ë¡œê·¸???????˜ì´ì§€ë¡??Œì•„?€??"ë¡œê·¸???˜ì´ì§€ë¡??´ë™" ë²„íŠ¼ ?´ë¦­\n' +
                    '3. ?ëŠ” ê°™ì? ?¬íŠ¸?ì„œ ?œë¸Œ?¨ìŠ¤ë¡??¼ìš°??(ê¶Œì¥)'
                  );
                }
              }}
            >
              ?¸ì…˜ ?•ì¸ ë°??ˆë¡œê³ ì¹¨
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return <>{children}</>;
}

