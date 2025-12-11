/**
 * 보호된 라우트 컴포넌트
 *
 * 인증이 필요한 페이지를 보호합니다.
 */

import { Navigate } from 'react-router-dom';
import { useSession } from '@hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data: session, isLoading } = useSession();
  const user = session?.user;

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}>
        로딩 중...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}

