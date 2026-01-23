/**
 * 페이지 로딩 스켈레톤 컴포넌트
 * [SSOT] 하드코딩 금지: CSS 변수 사용
 */
import React from 'react';

export const PageLoader: React.FC = () => (
  <div style={{ padding: 'var(--spacing-lg)' }}>
    {/* 페이지 제목 스켈레톤 */}
    <div
      style={{
        height: '28px',
        width: '180px',
        backgroundColor: 'var(--color-bg-tertiary)',
        borderRadius: 'var(--border-radius-md)',
        marginBottom: 'var(--spacing-lg)',
        animation: 'pageLoaderPulse 1.5s ease-in-out infinite',
      }}
    />
    {/* 콘텐츠 카드 스켈레톤 */}
    <div
      style={{
        height: '160px',
        backgroundColor: 'var(--color-bg-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        animation: 'pageLoaderPulse 1.5s ease-in-out infinite',
        animationDelay: '0.2s',
      }}
    />
    <style>{`
      @keyframes pageLoaderPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  </div>
);
