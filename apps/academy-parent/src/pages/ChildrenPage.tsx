/**
 * 자녀 관리 페이지
 *
 * 자녀 목록을 조회하고 상세 정보를 확인할 수 있습니다.
 */

import { ErrorBoundary, Container, Card, Grid } from '@ui-core/react';
import { useChildren } from '@hooks/use-parent';

export function ChildrenPage() {
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
            자녀 관리
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
                    marginBottom: 'var(--spacing-sm)'
                  }}>
                    {child.name}
                  </h3>
                  {child.grade && (
                    <p style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--spacing-xs)'
                    }}>
                      학년: {child.grade}
                    </p>
                  )}
                  {child.school_name && (
                    <p style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)'
                    }}>
                      학교: {child.school_name}
                    </p>
                  )}
                </Card>
              ))}
            </Grid>
          )}

          {children && children.length === 0 && (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p>등록된 자녀가 없습니다.</p>
              </div>
            </Card>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

