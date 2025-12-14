/**
 * Public Gateway 홈 페이지
 */

import { Container, Card } from '@ui-core/react';

export function HomePage() {
  return (
    <Container maxWidth="xl" padding="lg">
      <Card padding="md" variant="default">
        <h1 style={{
          fontSize: 'var(--font-size-2xl)',
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
          QR 출결 및 결제 서비스를 이용하실 수 있습니다.
        </p>
      </Card>
    </Container>
  );
}

