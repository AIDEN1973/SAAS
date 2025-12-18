/**
 * CSS Variables Utility
 *
 * CSS 변수를 읽고 픽셀 값으로 변환하는 유틸리티 함수
 * [불변 규칙] 하드코딩 금지, CSS 변수 사용 필수
 */
/**
 * CSS 변수 값을 읽어서 픽셀 값으로 변환
 *
 * @param cssVarName - CSS 변수 이름 (예: '--width-layer-menu')
 * @param fallbackPx - CSS 변수를 읽을 수 없는 경우 사용할 폴백 픽셀 값
 * @returns 픽셀 값 (number)
 */
export declare function getCSSVariableAsPx(cssVarName: string, fallbackPx: number): number;
/**
 * CSS 변수 값을 읽어서 밀리초 값으로 변환
 *
 * @param cssVarName - CSS 변수 이름 (예: '--transition-debounce')
 * @param fallbackMs - CSS 변수를 읽을 수 없는 경우 사용할 폴백 밀리초 값
 * @returns 밀리초 값 (number)
 */
export declare function getCSSVariableAsMs(cssVarName: string, fallbackMs: number): number;
/**
 * CSS 변수 문자열(예: 'var(--width-layer-menu)')을 픽셀 값으로 변환
 *
 * @param cssVarString - CSS 변수 문자열 (예: 'var(--width-layer-menu)' 또는 '100%' 또는 '600px')
 * @param isMobile - 모바일 모드 여부
 * @param isTablet - 태블릿 모드 여부
 * @returns 픽셀 값 (number)
 */
export declare function parseWidthToPx(cssVarString: string, isMobile: boolean, isTablet: boolean): number;
//# sourceMappingURL=css-variables.d.ts.map