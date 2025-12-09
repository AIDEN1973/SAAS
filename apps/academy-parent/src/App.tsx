import { ErrorBoundary, Container, Card, useTheme } from '@ui-core/react';

function App() {
  // 테넌트별 테마 적용
  useTheme({ mode: 'auto' });
  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <Card padding="md" variant="default">
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            디어쌤 - 학부모
          </h1>
          <p style={{
            color: 'var(--color-text-secondary)',
            margin: 0
          }}>
            환경설정이 완료되었습니다.
          </p>
        </Card>
      </Container>
    </ErrorBoundary>
  );
}

export default App;

