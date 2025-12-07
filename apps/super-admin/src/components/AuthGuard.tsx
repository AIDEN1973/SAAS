/**
 * Auth Guard Component
 * 
 * [불변 규칙] Super Admin 앱에서 인증 상태 확인 및 로그인 페이지로 리다이렉트
 * [불변 규칙] academy-admin 앱과 동일한 Supabase 인스턴스를 사용하므로 세션 공유 가능
 */

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
        
        // 다른 포트(localhost:3000)에서 세션 공유 시도
        // Supabase는 localStorage에 세션을 저장하므로, 다른 origin에서는 공유되지 않습니다.
        // 따라서 academy-admin 앱의 localStorage에서 세션을 읽어와야 합니다.
        // 하지만 브라우저 보안 정책상 다른 origin의 localStorage에 접근할 수 없으므로,
        // 사용자가 academy-admin 앱에서 로그인한 후 super-admin 앱으로 돌아와야 합니다.
        
        // 현재 세션 확인
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth Guard] 세션 확인 실패:', error);
          setIsAuthenticated(false);
          setIsLoading(false);
          // 오류 발생 시에도 로그인 페이지로 리다이렉트
          navigate('/auth/login');
          return;
        }

        if (session) {
          console.log('[Auth Guard] 인증된 사용자:', session.user.email);
          setIsAuthenticated(true);
        } else {
          console.warn('[Auth Guard] 세션이 없습니다. 로그인 페이지로 이동합니다.');
          setIsAuthenticated(false);
          // super-admin 앱의 로그인 페이지로 자동 리다이렉트
          navigate('/auth/login');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('[Auth Guard] 인증 확인 중 오류:', error);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    }

    checkAuth();

    // 인증 상태 변경 감지
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth Guard] 인증 상태 변경:', event, session?.user?.email);
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
          <p>인증 확인 중...</p>
        </Card>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container maxWidth="sm" padding="lg" className="flex items-center justify-center min-h-screen">
        <Card padding="lg">
          <h2 className="text-xl font-bold mb-4">로그인이 필요합니다</h2>
          <p className="mb-6 text-gray-600">
            Super Admin 기능을 사용하려면 로그인이 필요합니다.
            <br />
            <br />
            <strong>중요:</strong> 다른 포트(localhost:3000)에서 로그인한 경우,
            <br />
            이 페이지를 새로고침하거나 아래 버튼을 클릭하세요.
          </p>
          <div className="space-y-2">
            <Button
              variant="solid"
              color="primary"
              fullWidth
              onClick={() => {
                // super-admin 앱의 로그인 페이지로 이동
                const returnTo = encodeURIComponent(window.location.href);
                navigate(`/auth/login?returnTo=${returnTo}`);
              }}
            >
              로그인 페이지로 이동
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={async () => {
                // 현재 페이지 새로고침
                // academy-admin 앱에서 로그인한 경우, 세션이 공유되지 않을 수 있으므로
                // 수동으로 세션을 확인하거나 새로고침
                const supabase = createClient();
                
                // 세션 확인 전에 잠시 대기 (세션이 복원될 시간 제공)
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session) {
                  console.log('[Auth Guard] 세션 발견! 새로고침합니다.');
                  window.location.reload();
                } else {
                  console.warn('[Auth Guard] 세션이 여전히 없습니다.');
                  console.warn('[Auth Guard] 참고: localhost:3000과 localhost:3002는 다른 origin이므로');
                  console.warn('[Auth Guard] 세션이 자동으로 공유되지 않습니다.');
                  console.warn('[Auth Guard] 해결 방법:');
                  console.warn('[Auth Guard]   1. academy-admin 앱(http://localhost:3000)에서 로그인');
                  console.warn('[Auth Guard]   2. 로그인 후 이 페이지로 돌아와서 "로그인 페이지로 이동" 버튼 클릭');
                  console.warn('[Auth Guard]   3. 또는 같은 포트에서 서브패스로 라우팅 (권장)');
                  
                  alert(
                    '세션이 없습니다.\n\n' +
                    'localhost:3000과 localhost:3002는 다른 origin이므로\n' +
                    '세션이 자동으로 공유되지 않습니다.\n\n' +
                    '해결 방법:\n' +
                    '1. academy-admin 앱(http://localhost:3000)에서 로그인\n' +
                    '2. 로그인 후 이 페이지로 돌아와서 "로그인 페이지로 이동" 버튼 클릭\n' +
                    '3. 또는 같은 포트에서 서브패스로 라우팅 (권장)'
                  );
                }
              }}
            >
              세션 확인 및 새로고침
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return <>{children}</>;
}

