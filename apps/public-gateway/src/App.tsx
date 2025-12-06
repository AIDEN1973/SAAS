import { ErrorBoundary, Container, Card } from '@ui-core/react';

function App() {
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
            디어쌤 - 공개 게이트웨이
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

