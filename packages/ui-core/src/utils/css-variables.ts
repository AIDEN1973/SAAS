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
export function getCSSVariableAsPx(cssVarName: string, fallbackPx: number): number {
  if (typeof window === 'undefined') {
    return fallbackPx;
  }

  const root = document.documentElement;
  const cssValue = getComputedStyle(root).getPropertyValue(cssVarName).trim();

  if (!cssValue) {
    return fallbackPx;
  }

  // rem 값을 픽셀으로 변환
  const remMatch = cssValue.match(/(\d+\.?\d*)rem/);
  if (remMatch) {
    // ⚠️ 중요: 하드코딩 금지, CSS 변수에서 기본 폰트 크기 읽기
    const baseFontSize = typeof window !== 'undefined'
      ? parseFloat(getComputedStyle(root).getPropertyValue('--font-size-base').trim()) || 16
      : 16;
    return parseFloat(remMatch[1]) * baseFontSize; // 1rem = baseFontSize
  }

  // px 값이 직접 주어진 경우
  const pxMatch = cssValue.match(/(\d+)px/);
  if (pxMatch) {
    return parseInt(pxMatch[1], 10);
  }

  return fallbackPx;
}

/**
 * CSS 변수 값을 읽어서 밀리초 값으로 변환
 *
 * @param cssVarName - CSS 변수 이름 (예: '--transition-debounce')
 * @param fallbackMs - CSS 변수를 읽을 수 없는 경우 사용할 폴백 밀리초 값
 * @returns 밀리초 값 (number)
 */
export function getCSSVariableAsMs(cssVarName: string, fallbackMs: number): number {
  if (typeof window === 'undefined') {
    return fallbackMs;
  }

  const root = document.documentElement;
  const cssValue = getComputedStyle(root).getPropertyValue(cssVarName).trim();

  if (!cssValue) {
    return fallbackMs;
  }

  // ms 값 추출
  const msMatch = cssValue.match(/(\d+)ms/);
  if (msMatch) {
    return parseInt(msMatch[1], 10);
  }

  return fallbackMs;
}

/**
 * CSS 변수 값을 읽어서 숫자로 변환 (단위 없는 값)
 *
 * @param cssVarName - CSS 변수 이름 (예: '--duration-slow')
 * @param fallback - CSS 변수를 읽을 수 없는 경우 사용할 폴백 값
 * @returns 숫자 값 (number)
 */
export function getCSSVariableAsNumber(cssVarName: string, fallback: number): number {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const root = document.documentElement;
  const cssValue = getComputedStyle(root).getPropertyValue(cssVarName).trim();

  if (!cssValue) {
    return fallback;
  }

  const parsed = parseFloat(cssValue);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * CSS 변수 문자열(예: 'var(--width-layer-menu)')을 픽셀 값으로 변환
 *
 * @param cssVarString - CSS 변수 문자열 (예: 'var(--width-layer-menu)' 또는 '100%' 또는 '600px')
 * @param isMobile - 모바일 모드 여부
 * @param isTablet - 태블릿 모드 여부
 * @returns 픽셀 값 (number)
 */
export function parseWidthToPx(
  cssVarString: string,
  isMobile: boolean,
  isTablet: boolean
): number {
  // 모바일: '100%'인 경우 window 너비 사용
  if (cssVarString === '100%') {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    // SSR 폴백: 기본 레이어 메뉴 너비 (하드코딩 최소화)
    const baseFontSize = 16; // SSR에서는 기본값 사용
    return getCSSVariableAsPx('--width-layer-menu', 43.75 * baseFontSize);
  }

  // 직접 픽셀 값이 주어진 경우
  const directPxMatch = cssVarString.match(/(\d+)px/);
  if (directPxMatch) {
    return parseInt(directPxMatch[1], 10);
  }

  // 직접 rem 값이 주어진 경우
  const directRemMatch = cssVarString.match(/(\d+\.?\d*)rem/);
  if (directRemMatch) {
    // ⚠️ 중요: 하드코딩 금지, CSS 변수에서 기본 폰트 크기 읽기
    const baseFontSize = typeof window !== 'undefined'
      ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
      : 16;
    return parseFloat(directRemMatch[1]) * baseFontSize;
  }

  // CSS 변수 추출
  if (cssVarString.startsWith('var(')) {
    const varMatch = cssVarString.match(/var\(([^)]+)\)/);
    if (varMatch) {
      const varName = varMatch[1].trim();

      // 알려진 CSS 변수에 대한 폴백 값 (하드코딩 최소화, CSS 변수 우선 사용)
      // ⚠️ 중요: fallback 값은 CSS 변수를 읽을 수 없는 경우에만 사용
      const baseFontSize = typeof window !== 'undefined'
        ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
        : 16;
      const fallbackMap: Record<string, number> = {
        '--width-layer-menu': 43.75 * baseFontSize, // 700px (baseFontSize 기준)
        '--width-layer-menu-tablet': 31.25 * baseFontSize, // 500px (baseFontSize 기준)
      };

      // 알려진 CSS 변수가 아니면 기본 레이어 메뉴 너비 사용 (하드코딩 제거)
      return getCSSVariableAsPx(varName, fallbackMap[varName] || fallbackMap['--width-layer-menu']);
    }
  }

  // 기본값: 반환 (CSS 변수를 읽을 수 없는 경우)
  const baseFontSize = typeof window !== 'undefined'
    ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim()) || 16
    : 16;
  return getCSSVariableAsPx('--width-layer-menu', 43.75 * baseFontSize);
}
