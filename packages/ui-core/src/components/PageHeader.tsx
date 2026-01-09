/**
 * PageHeader Component
 *
 * 페이지 타이틀과 액션 버튼을 한 줄로 배치하는 공통 컴포넌트
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';

export interface PageHeaderProps {
  /** 페이지 타이틀 */
  title: string;
  /** 타이틀 옆에 표시할 액션 버튼들 */
  actions?: React.ReactNode;
  /** 타이틀 폰트 크기 (기본값: '3xl') */
  titleSize?: 'xl' | '2xl' | '3xl';
  /** 타이틀 폰트 두께 (기본값: 'extrabold') */
  titleWeight?: 'bold' | 'extrabold';
  /** 추가 클래스명 */
  className?: string;
  /** 추가 스타일 */
  style?: React.CSSProperties;
}

/**
 * PageHeader 컴포넌트
 *
 * 페이지 타이틀과 액션 버튼을 한 줄로 배치
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  actions,
  titleSize = '3xl',
  titleWeight = 'extrabold',
  className,
  style,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  const fontSizeMap = {
    xl: 'var(--font-size-xl)',
    '2xl': 'var(--font-size-2xl)',
    '3xl': 'var(--font-size-3xl)',
  };

  const fontWeightMap = {
    bold: 'var(--font-weight-bold)',
    extrabold: 'var(--font-weight-extrabold)',
  };

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        justifyContent: actions ? 'space-between' : 'flex-start', // actions가 없으면 flex-start
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: 'var(--spacing-md)',
        minHeight: 'var(--touch-target-min)', // 최소 높이 보장
        ...style,
      }}
    >
      <h1
        style={{
          fontSize: fontSizeMap[titleSize],
          fontWeight: fontWeightMap[titleWeight],
          margin: 0,
          lineHeight: 'var(--line-height-tight)', // styles.css 준수: 타이틀과 버튼 수평 정렬을 위한 특수 값
          color: 'var(--color-text)',
          display: 'flex',
          alignItems: 'center', // 수직 중앙 정렬
        }}
      >
        {title}
      </h1>

      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            flexWrap: 'wrap',
            flexShrink: 0, // actions 영역이 줄어들지 않도록
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};

