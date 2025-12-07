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
            ?”ì–´??- ê³µê°œ ê²Œì´?¸ì›¨??
          </h1>
          <p style={{ 
            color: 'var(--color-text-secondary)',
            margin: 0
          }}>
            ?˜ê²½?¤ì •???„ë£Œ?˜ì—ˆ?µë‹ˆ??
          </p>
        </Card>
      </Container>
    </ErrorBoundary>
  );
}

export default App;

