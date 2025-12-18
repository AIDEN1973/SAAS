/**
 * useResponsiveMode Hook
 *
 * [불변 규칙] 반응형 모드는 Hook을 통해만 접근한다.
 * [불변 규칙] CSS Media Query를 직접 사용해서는 안 된다.
 * [불변 규칙] UI 문서 기준: xs (0px), sm (640px), md (768px), lg (1024px), xl (1280px)
 */
import { BreakpointToken } from '@design-system/core';
export type ResponsiveMode = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/**
 * 현재 화면 크기에 따른 반응형 모드 반환
 *
 * xs: 0px (모바일 기본)
 * sm: 640px (대형 모바일/ 작은 태블릿)
 * md: 768px (태블릿)
 * lg: 1024px (작은 데스크톱)
 * xl: 1280px (큰 데스크톱)
 */
export declare function useResponsiveMode(): ResponsiveMode;
/**
 * 특정 브레이크포인트 이상인지 확인
 *
 * @param breakpoint - 확인할 브레이크포인트 ('mobile' | 'tablet' | 'desktop')
 * @returns 현재 모드가 해당 브레이크포인트 이상이면 true
 */
export declare function useBreakpoint(breakpoint: BreakpointToken): boolean;
/**
 * 모바일 모드인지 확인 (xs 또는 sm)
 */
export declare function useIsMobile(): boolean;
/**
 * 태블릿 모드인지 확인 (md)
 */
export declare function useIsTablet(): boolean;
/**
 * 데스크톱 모드인지 확인 (lg 또는 xl)
 */
export declare function useIsDesktop(): boolean;
//# sourceMappingURL=useResponsiveMode.d.ts.map