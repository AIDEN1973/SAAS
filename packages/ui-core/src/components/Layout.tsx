/**
 * Layout Components
 *
 * 반응형 레이아웃 컴포넌트
 * Mobile: Card-first
 * Tablet: 2-column + Drawer Overlay
 * Desktop: Multi-panel + Persistent Sidebar
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { useResponsiveMode } from '../hooks/useResponsiveMode';
import { SpacingToken } from '@design-system/core';

export interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: SpacingToken;
  className?: string;
  style?: React.CSSProperties;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'xl',
  padding = 'md',
  className,
  style,
}) => {
  const maxWidthMap: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    full: '100%',
  };

  const paddingMap: Record<SpacingToken, string> = {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    '2xl': 'var(--spacing-2xl)',
    '3xl': 'var(--spacing-3xl)',
  };

  return (
    <div
      className={clsx(className)}
      style={{
        margin: '0 auto',
        width: '100%',
        maxWidth: maxWidthMap[maxWidth],
        paddingLeft: paddingMap[padding],
        paddingRight: paddingMap[padding],
        transition: 'var(--transition-all)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface GridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'auto-fit' | 'auto-fill' | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  columnTemplate?: string; // 복잡한 그리드 템플릿 (예: '100px repeat(7, 1fr)', 'repeat(5, 1fr)')
  minColumnWidth?: string; // auto-fit/auto-fill과 함께 사용 (예: '60px', '100px')
  gap?: SpacingToken;
  className?: string;
  style?: React.CSSProperties;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 1,
  columnTemplate,
  minColumnWidth,
  gap = 'md',
  className,
  style,
}) => {
  const mode = useResponsiveMode();

  const gapMap: Record<SpacingToken, string> = {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    '2xl': 'var(--spacing-2xl)',
    '3xl': 'var(--spacing-3xl)',
  };

  // gridTemplateColumns 계산
  let gridTemplateColumns: string;

  if (columnTemplate) {
    // columnTemplate이 있으면 우선 사용 (복잡한 그리드 레이아웃)
    gridTemplateColumns = columnTemplate;
  } else if (columns === 'auto-fit' || columns === 'auto-fill') {
    // auto-fit/auto-fill 사용
    if (minColumnWidth) {
      gridTemplateColumns = `repeat(${columns}, minmax(${minColumnWidth}, 1fr))`;
    } else {
      // minColumnWidth가 없으면 기본값 사용
      gridTemplateColumns = `repeat(${columns}, minmax(100px, 1fr))`;
    }
  } else if (typeof columns === 'object' && columns !== null) {
    // 반응형 객체인 경우
    const responsiveColumns =
      (mode === 'xl' && columns.xl !== undefined) ? columns.xl :
      (mode === 'lg' && columns.lg !== undefined) ? columns.lg :
      (mode === 'md' && columns.md !== undefined) ? columns.md :
      (mode === 'sm' && columns.sm !== undefined) ? columns.sm :
      (columns.xs !== undefined) ? columns.xs : 1;
    gridTemplateColumns = `repeat(${responsiveColumns}, 1fr)`;
  } else {
    // 일반 columns 사용 (반응형 조정)
    const numColumns = typeof columns === 'number' ? columns : 1;
    const responsiveColumns = (mode === 'xs' || mode === 'sm') ? 1 : mode === 'md' ? Math.min(numColumns, 2) : numColumns;
    gridTemplateColumns = `repeat(${responsiveColumns}, 1fr)`;
  }

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: gapMap[gap],
        transition: 'var(--transition-all)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  sidebarWidth?: string;
  className?: string;
}

/**
 * Sidebar Layout
 * Mobile: Sidebar 숨김 (Drawer로 변환)
 * Desktop: Persistent Sidebar
 */
export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  sidebar,
  main,
  sidebarWidth = '256px',
  className,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  if (isMobile) {
    // Mobile: Sidebar를 Drawer로 처리 (별도 컴포넌트 필요)
    return (
      <div
        className={clsx(className)}
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <main style={{ flex: 1 }}>{main}</main>
      </div>
    );
  }

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        gap: 'var(--spacing-lg)',
        transition: 'var(--transition-all)',
      }}
    >
      <aside
        style={{
          display: 'block',
          width: sidebarWidth,
          minWidth: sidebarWidth,
          borderRadius: 'var(--border-radius-sm)',
          border: '1px solid var(--color-gray-200)',
          backgroundColor: 'var(--color-white)',
          boxShadow: 'var(--shadow-sm)',
          padding: 'var(--spacing-lg)',
          transition: 'var(--transition-all)',
        }}
      >
        {sidebar}
      </aside>
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: 'var(--color-white)',
          border: '1px solid var(--color-gray-200)',
          boxShadow: 'var(--shadow-sm)',
          padding: 'var(--spacing-lg)',
          transition: 'var(--transition-all)',
        }}
      >
        {main}
      </main>
    </div>
  );
};
