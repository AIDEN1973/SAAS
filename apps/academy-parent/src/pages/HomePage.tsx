/**
 * 학부모 앱 홈 페이지
 *
 * 자녀별 결제 현황 요약, 최근 출결 알림 등을 표시합니다.
 */

import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button, Grid } from '@ui-core/react';
import { useChildren } from '@hooks/use-parent';

export function HomePage() {
  const navigate = useNavigate();
  const { data: children, isLoading } = useChildren();

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-lg)',
            color: 'var(--color-text)'
          }}>
            홈
          </h1>

          {isLoading && (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                로딩 중...
              </div>
            </Card>
          )}

          {children && children.length > 0 && (
            <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap="md">
              {children.map((child) => (
                <Card key={child.id} padding="md" variant="elevated">
                  <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                    marginBottom: 'var(--spacing-md)'
                  }}>
                    {child.name}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => navigate(`/billing?child_id=${child.id}`)}
                    >
                      결제 내역 보기
                    </Button>
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => navigate(`/attendance?child_id=${child.id}`)}
                    >
                      출결 알림 보기
                    </Button>
                  </div>
                </Card>
              ))}
            </Grid>
          )}

          {children && children.length === 0 && (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p>등록된 자녀가 없습니다.</p>
                <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-sm)' }}>
                  관리자에게 문의해주세요.
                </p>
              </div>
            </Card>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

