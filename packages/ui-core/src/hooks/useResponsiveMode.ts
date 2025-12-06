/**
 * useResponsiveMode Hook
 * 
 * [불변 규칙] 반응형 모드는 이 훅을 통해서만 접근한다.
 * [불변 규칙] CSS Media Query를 직접 작성하지 않는다.
 */

import { useState, useEffect } from 'react';
import { BreakpointToken } from '@design-system/core';

export type ResponsiveMode = 'mobile' | 'tablet' | 'desktop';

/**
 * 현재 화면 크기에 따른 반응형 모드 반환
 * 
 * Mobile: < 640px
 * Tablet: 640px - 1023px
 * Desktop: >= 1024px
 */
export function useResponsiveMode(): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>('desktop');

  useEffect(() => {
    const updateMode = () => {
      const width = window.innerWidth;
      
      if (width < 640) {
        setMode('mobile');
      } else if (width < 1024) {
        setMode('tablet');
      } else {
        setMode('desktop');
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
 */
export function useBreakpoint(breakpoint: BreakpointToken): boolean {
  const mode = useResponsiveMode();
  
  const breakpointOrder: ResponsiveMode[] = ['mobile', 'tablet', 'desktop'];
  const currentIndex = breakpointOrder.indexOf(mode);
  const targetIndex = breakpointOrder.indexOf(breakpoint as ResponsiveMode);
  
  return currentIndex >= targetIndex;
}

