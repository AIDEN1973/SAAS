/**
 * useResponsiveMode Hook
 * 
 * [불변 규칙] 반응형 모드는 이 훅을 통해서만 접근한다.
 * [불변 규칙] CSS Media Query를 직접 작성하지 않는다.
 * [불변 규칙] UI 문서 기준: xs (0px), sm (640px), md (768px), lg (1024px), xl (1280px)
 */

import { useState, useEffect } from 'react';
import { BreakpointToken } from '@design-system/core';

export type ResponsiveMode = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * 현재 화면 크기에 따른 반응형 모드 반환
 * 
 * xs: 0px (모바일 기본)
 * sm: 640px (큰 모바일 / 작은 태블릿)
 * md: 768px (태블릿)
 * lg: 1024px (작은 데스크톱)
 * xl: 1280px (큰 데스크톱)
 */
export function useResponsiveMode(): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>('xs');

  useEffect(() => {
    const updateMode = () => {
      const width = window.innerWidth;
      
      if (width >= 1280) {
        setMode('xl');
      } else if (width >= 1024) {
        setMode('lg');
      } else if (width >= 768) {
        setMode('md');
      } else if (width >= 640) {
        setMode('sm');
      } else {
        setMode('xs');
      }
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
 */
export function useIsMobile(): boolean {
  const mode = useResponsiveMode();
  return mode === 'xs' || mode === 'sm';
}

/**
 * 태블릿 모드인지 확인 (md)
 */
export function useIsTablet(): boolean {
  const mode = useResponsiveMode();
  return mode === 'md';
}

/**
 * 데스크톱 모드인지 확인 (lg 또는 xl)
 */
export function useIsDesktop(): boolean {
  const mode = useResponsiveMode();
  return mode === 'lg' || mode === 'xl';
}

