/**
 * useResponsiveMode Hook
 *
 * [불변 규칙] 반응형 모드는 Hook을 통해만 접근한다.
 * [불변 규칙] CSS Media Query를 직접 사용해서는 안 된다.
 * [SSOT] 브레이크포인트 값은 BREAKPOINTS 상수에서 가져온다.
 *
 * 참조: packages/ui-core/src/ssot/layout-templates.ts
 */

import { useState, useEffect } from 'react';
import { BreakpointToken } from '@design-system/core';
import { BREAKPOINTS, getResponsiveMode } from '../ssot/layout-templates';

export type ResponsiveMode = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * 현재 화면 크기에 따른 반응형 모드 반환
 *
 * [SSOT] 브레이크포인트 값은 BREAKPOINTS 상수 사용:
 * - xs: 0px (모바일 기본)
 * - sm: 640px (대형 모바일/ 작은 태블릿)
 * - md: 768px (태블릿)
 * - lg: 1024px (작은 데스크톱)
 * - xl: 1280px (큰 데스크톱)
 */
export function useResponsiveMode(): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>('xs');

  useEffect(() => {
    const updateMode = () => {
      const width = window.innerWidth;
      // [SSOT] BREAKPOINTS 상수 사용
      const breakpointMode = getResponsiveMode(width);
      // Breakpoint 타입('XS' | 'SM' | ...)을 ResponsiveMode 타입('xs' | 'sm' | ...)으로 변환
      const currentMode = breakpointMode.toLowerCase() as ResponsiveMode;
      setMode(currentMode);
    };

    updateMode();
    window.addEventListener('resize', updateMode);

    return () => window.removeEventListener('resize', updateMode);
  }, []);

  return mode;
}

/**
 * 특정 브레이크포인트 이상인지 확인
 *
 * @param breakpoint - 확인할 브레이크포인트 ('mobile' | 'tablet' | 'desktop')
 * @returns 현재 모드가 해당 브레이크포인트 이상이면 true
 */
export function useBreakpoint(breakpoint: BreakpointToken): boolean {
  const mode = useResponsiveMode();

  // BreakpointToken을 ResponsiveMode로 매핑
  const breakpointToMode: Record<BreakpointToken, ResponsiveMode> = {
    mobile: 'xs',
    tablet: 'md',
    desktop: 'lg',
  };

  const breakpointOrder: ResponsiveMode[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  const currentIndex = breakpointOrder.indexOf(mode);
  const targetMode = breakpointToMode[breakpoint];
  const targetIndex = breakpointOrder.indexOf(targetMode);

  return currentIndex >= targetIndex;
}

/**
 * 모바일 모드인지 확인 (xs 또는 sm)
 * [SSOT] isMobile 헬퍼 함수 사용
 */
export function useIsMobile(): boolean {
  const mode = useResponsiveMode();
  // [SSOT] layout-templates의 isMobile 함수 사용
  return mode === 'xs' || mode === 'sm';
}

/**
 * 태블릿 모드인지 확인 (md)
 * [SSOT] isTablet 헬퍼 함수 사용
 */
export function useIsTablet(): boolean {
  const mode = useResponsiveMode();
  // [SSOT] layout-templates의 isTablet 함수 사용
  return mode === 'md';
}

/**
 * 데스크톱 모드인지 확인 (lg 또는 xl)
 * [SSOT] isDesktop 헬퍼 함수 사용
 */
export function useIsDesktop(): boolean {
  const mode = useResponsiveMode();
  // [SSOT] layout-templates의 isDesktop 함수 사용
  return mode === 'lg' || mode === 'xl';
}
