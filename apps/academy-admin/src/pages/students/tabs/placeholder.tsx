/**
 * Placeholder Components for Lazy Loading
 *
 * 탭이 로딩 중일 때 표시할 플레이스홀더
 */

import React from 'react';

export const TabLoadingPlaceholder: React.FC = () => {
  return (
    <div
      style={{
        padding: 'var(--spacing-lg)',
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
      }}
    >
      로딩 중...
    </div>
  );
};

export const TabErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  return (
    <div
      style={{
        padding: 'var(--spacing-lg)',
        textAlign: 'center',
        color: 'var(--color-error)',
      }}
    >
      <p>탭을 불러오는 중 오류가 발생했습니다.</p>
      <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-sm)' }}>
        {error.message}
      </p>
    </div>
  );
};
