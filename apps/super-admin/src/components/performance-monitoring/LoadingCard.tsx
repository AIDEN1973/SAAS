/**
 * Loading Card Component
 *
 * [불변 규칙] 성능 모니터링 로딩 상태 표시 공통 컴포넌트
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 * [DRY] 10개 컴포넌트에서 사용하는 동일 패턴 추출
 */

import { Card } from '@ui-core/react';

interface LoadingCardProps {
  message?: string;
}

export function LoadingCard({ message = '로딩 중...' }: LoadingCardProps) {
  return (
    <Card padding="md" variant="default">
      <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
      </div>
    </Card>
  );
}
