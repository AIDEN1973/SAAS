/**
 * 지역 정보 미설정 경고 배너 컴포넌트
 *
 * [불변 규칙] P0-3: 지역 정보가 없을 때 사용자에게 안내
 * [용도] AnalyticsPage, AIPage에서 지역 통계 기능 사용 전 위치 설정 유도
 */

import React from 'react';
import { Button } from '@ui-core/react';

export interface LocationWarningBannerProps {
  message: string;
  onNavigate: () => void;
  onDismiss: () => void;
}

export function LocationWarningBanner({
  message,
  onNavigate,
  onDismiss,
}: LocationWarningBannerProps) {
  const iconSize = 16;
  const iconStrokeWidth = 1.5;

  const bannerStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backgroundColor: 'var(--color-warning-light)',
    borderBottom: 'var(--border-width-thin) solid var(--color-warning)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--spacing-md)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <div style={bannerStyle}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-warning)"
        strokeWidth={iconStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
          {message}
        </span>
        <Button
          variant="outline"
          color="warning"
          size="sm"
          onClick={onNavigate}
          style={{ marginLeft: 'var(--spacing-sm)' }}
        >
          설정 페이지로 이동
        </Button>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 'var(--spacing-xs)',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--color-text-secondary)',
          transition: 'var(--transition-all)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
        aria-label="배너 닫기"
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
