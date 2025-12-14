/**
 * Auth Guard Component
 *
 * [불변 규칙] Super Admin 앱에서 인증 상태 확인 및 로그인 페이지로 리다이렉트
 * [불변 규칙] Zero-Trust: useSession hook을 통한 인증 확인
 * [불변 규칙] academy-admin 앱과 동일한 인증 로직 사용
 */

import { Navigate, useLocation } from 'react-router-dom';
import { Container, Card } from '@ui-core/react';
import { useSession } from '@hooks/use-auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const { data: session, isLoading: sessionLoading } = useSession();

  // 세션 로딩 중
  if (sessionLoading) {
    return (
      <Container maxWidth="xl" padding="lg">
        <Card padding="md">
          <p>인증 확인 중...</p>
        </Card>
      </Container>
    );
  }

  // 세션이 없는 경우 로그인 페이지로 리다이렉트
  if (!session) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

