/**
 * useResponsiveMode Hook
 * 
 * [ë¶ˆë? ê·œì¹™] ë°˜ì‘??ëª¨ë“œ?????…ì„ ?µí•´?œë§Œ ?‘ê·¼?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] CSS Media Queryë¥?ì§ì ‘ ?‘ì„±?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] UI ë¬¸ì„œ ê¸°ì?: xs (0px), sm (640px), md (768px), lg (1024px), xl (1280px)
 */

import { useState, useEffect } from 'react';
import { BreakpointToken } from '@design-system/core';

export type ResponsiveMode = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * ?„ì¬ ?”ë©´ ?¬ê¸°???°ë¥¸ ë°˜ì‘??ëª¨ë“œ ë°˜í™˜
 * 
 * xs: 0px (ëª¨ë°”??ê¸°ë³¸)
 * sm: 640px (??ëª¨ë°”??/ ?‘ì? ?œë¸”ë¦?
 * md: 768px (?œë¸”ë¦?
 * lg: 1024px (?‘ì? ?°ìŠ¤?¬í†±)
 * xl: 1280px (???°ìŠ¤?¬í†±)
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
 * ?¹ì • ë¸Œë ˆ?´í¬?¬ì¸???´ìƒ?¸ì? ?•ì¸
 * 
 * @param breakpoint - ?•ì¸??ë¸Œë ˆ?´í¬?¬ì¸??('mobile' | 'tablet' | 'desktop')
 * @returns ?„ì¬ ëª¨ë“œê°€ ?´ë‹¹ ë¸Œë ˆ?´í¬?¬ì¸???´ìƒ?´ë©´ true
 */
export function useBreakpoint(breakpoint: BreakpointToken): boolean {
  const mode = useResponsiveMode();
  
  // BreakpointToken??ResponsiveModeë¡?ë§¤í•‘
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
 * ëª¨ë°”??ëª¨ë“œ?¸ì? ?•ì¸ (xs ?ëŠ” sm)
 */
export function useIsMobile(): boolean {
  const mode = useResponsiveMode();
  return mode === 'xs' || mode === 'sm';
}

/**
 * ?œë¸”ë¦?ëª¨ë“œ?¸ì? ?•ì¸ (md)
 */
export function useIsTablet(): boolean {
  const mode = useResponsiveMode();
  return mode === 'md';
}

/**
 * ?°ìŠ¤?¬í†± ëª¨ë“œ?¸ì? ?•ì¸ (lg ?ëŠ” xl)
 */
export function useIsDesktop(): boolean {
  const mode = useResponsiveMode();
  return mode === 'lg' || mode === 'xl';
}

