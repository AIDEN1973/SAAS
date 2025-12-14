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
// SpacingToken은 로컬 타입으로 정의 (다른 컴포넌트와 일관성 유지)
type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

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
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // 브레이크포인트는 useResponsiveMode와 일치해야 함 (유아이 문서 6-0 준수)
  // Container의 maxWidth는 실제 컨테이너 너비이므로 rem 단위 사용 (일관성)
  const maxWidthMap: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
    sm: '40rem', // 640px - 브레이크포인트 sm과 동일
    md: '48rem', // 768px - 브레이크포인트 md와 동일
    lg: '64rem', // 1024px - 브레이크포인트 lg와 동일
    xl: '80rem', // 1280px - 브레이크포인트 xl과 동일
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

  // 모바일(xs, sm): 적절한 여백 유지, 태블릿 이상(md+): 지정된 padding 사용 (유아이 문서 6-1 준수)
  const effectivePadding = isMobile ? 'lg' : padding; // md = 16px (모바일 적절한 여백)

  return (
    <div
      className={clsx(className)}
      style={{
        margin: '0 auto',
        width: '100%',
        maxWidth: maxWidthMap[maxWidth],
        paddingLeft: paddingMap[effectivePadding],
        paddingRight: paddingMap[effectivePadding],
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
      // minColumnWidth가 없으면 기본값 사용 (그리드 컬럼 최소 너비 토큰 사용)
      gridTemplateColumns = `repeat(${columns}, minmax(var(--width-grid-column), 1fr))`; // styles.css 준수: 그리드 컬럼 너비 토큰 사용
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
  sidebarWidth = 'var(--width-sidebar)', // styles.css 준수: 사이드바 너비 토큰 사용
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
          border: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
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
          border: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
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
