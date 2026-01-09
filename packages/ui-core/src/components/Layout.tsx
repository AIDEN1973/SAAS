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
// [SSOT] 브레이크포인트는 BREAKPOINTS 상수 사용
import { BREAKPOINTS } from '../ssot/layout-templates';
// SpacingToken은 로컬 타입으로 정의 (다른 컴포넌트와 일관성 유지)
type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: SpacingToken;
  /** 상단 여백 (기본값: 'xl') */
  paddingTop?: SpacingToken | 'none';
  className?: string;
  style?: React.CSSProperties;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'xl',
  padding = 'md',
  paddingTop = 'xl',
  className,
  style,
}) => {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // [SSOT] 브레이크포인트는 BREAKPOINTS 상수 사용
  // Container의 maxWidth는 실제 컨테이너 너비이므로 rem 단위 사용 (일관성)
  // BREAKPOINTS 값(px)을 rem으로 변환: px / 16 = rem
  const maxWidthMap: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
    sm: `${BREAKPOINTS.SM / 16}rem`, // 640px = 40rem (SSOT 상수 사용)
    md: `${BREAKPOINTS.MD / 16}rem`, // 768px = 48rem (SSOT 상수 사용)
    lg: `${BREAKPOINTS.LG / 16}rem`, // 1024px = 64rem (SSOT 상수 사용)
    xl: `${BREAKPOINTS.XL / 16}rem`, // 1280px = 80rem (SSOT 상수 사용)
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

  // 반응형 좌우 여백:
  // - 모바일(xs, sm): lg = 24px (충분한 여백)
  // - 태블릿(md) 및 데스크톱(lg, xl): xl = 32px (일관된 넓은 여백)
  const effectivePadding: SpacingToken = isMobile ? 'lg' : 'xl';
  const effectivePaddingTop = paddingTop === 'none' ? 0 : paddingMap[paddingTop];

  return (
    <div
      className={clsx(className)}
      style={{
        margin: '0 auto',
        width: '100%',
        maxWidth: maxWidthMap[maxWidth],
        paddingLeft: paddingMap[effectivePadding],
        paddingRight: paddingMap[effectivePadding],
        paddingTop: effectivePaddingTop,
        paddingBottom: paddingMap[effectivePadding], // 하단 여백도 동일하게 적용
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
    // 데스크탑 모드(lg, xl)에서는 더 큰 값이 정의되지 않았을 때 작은 값 사용 (fallback)
    let responsiveColumns: number;
    if (mode === 'xl') {
      responsiveColumns = columns.xl ?? columns.lg ?? columns.md ?? columns.sm ?? columns.xs ?? 1;
    } else if (mode === 'lg') {
      responsiveColumns = columns.lg ?? columns.md ?? columns.sm ?? columns.xs ?? 1;
    } else if (mode === 'md') {
      responsiveColumns = columns.md ?? columns.sm ?? columns.xs ?? 1;
    } else if (mode === 'sm') {
      responsiveColumns = columns.sm ?? columns.xs ?? 1;
    } else {
      responsiveColumns = columns.xs ?? 1;
    }
    // minmax(0, 1fr): 콘텐츠 크기와 무관하게 균등 분배 (5:5 정렬)
    gridTemplateColumns = `repeat(${responsiveColumns}, minmax(0, 1fr))`;
  } else {
    // 일반 columns 사용 (반응형 조정)
    const numColumns = typeof columns === 'number' ? columns : 1;
    const responsiveColumns = (mode === 'xs' || mode === 'sm') ? 1 : mode === 'md' ? Math.min(numColumns, 2) : numColumns;
    // minmax(0, 1fr): 콘텐츠 크기와 무관하게 균등 분배 (5:5 정렬)
    gridTemplateColumns = `repeat(${responsiveColumns}, minmax(0, 1fr))`;
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
