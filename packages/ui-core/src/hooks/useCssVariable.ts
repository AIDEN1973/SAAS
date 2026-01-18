/**
 * CSS 변수 해석 Hook
 *
 * [불변 규칙] CSS 변수를 런타임에 실제 값으로 해석
 * [불변 규칙] SVG fill 등 CSS 변수를 직접 사용할 수 없는 곳에서 사용
 */

// 참고: useState, useEffect는 현재 사용하지 않지만, 향후 CSS 변수 동적 해석 시 필요할 수 있음

/**
 * 공통 색상 상수 맵 (SSOT)
 *
 * [불변 규칙] 모든 인라인 스타일 색상의 단일 진실 공급원
 * - Badge 컴포넌트: colorMap으로 사용
 * - Chart 컴포넌트: SVG fill 속성에 사용
 * - 기타 인라인 스타일: CSS 변수 해석 타이밍 이슈 방지
 *
 * [SSOT 주의] 이 값들은 styles.css의 CSS 변수 값과 동기화되어야 합니다.
 * 색상 변경 시 두 곳 모두 수정 필요:
 * 1. packages/ui-core/src/styles.css (CSS 변수 정의)
 * 2. 이 파일의 COLOR_MAP (인라인 스타일용)
 *
 * [50% 색상 아키텍처]
 * - primary50: rgba() 사용 (styles.css가 color-mix로 동적 계산하므로)
 * - 나머지50: 고정 hex 값 사용 (styles.css의 정적 hex 값과 동일)
 *
 * [왜 중복인가?]
 * - CSS 파일: 클래스 기반 스타일링, 브라우저 캐싱 가능
 * - 이 파일: 인라인 스타일, SVG 속성, CSS 변수 타이밍 이슈 회피
 */
export const COLOR_MAP = {
  // Primary Colors
  primary: '#4A7AE0',
  primaryLight: '#5B8DEF',
  primaryDark: '#4A7AE0',
  primary50: 'rgba(74, 122, 224, 0.1)', // Increased from 0.05 to 0.1 for better visibility in charts

  // Secondary Colors
  secondary: '#9371F0',
  secondaryLight: '#A78BFA',
  secondaryDark: '#9371F0',
  secondary50: '#EDE9FE', // Solid pastel lavender (matches styles.css)

  // Success Colors
  success: '#34C66A',
  successLight: '#4ADE80',
  successDark: '#34C66A',
  success50: '#E6F9ED', // Solid pastel mint (matches styles.css)

  // Warning Colors
  warning: '#F0A500',
  warningLight: '#FBBF24',
  warningDark: '#F0A500',
  warning50: '#FEF5DC', // Solid pastel cream (matches styles.css)

  // Error Colors
  error: '#EF5050',
  errorLight: '#F87171',
  errorDark: '#EF5050',
  error50: '#FDE8E8', // Solid pastel pink (matches styles.css)

  // Info Colors
  info: '#0EBDD4',
  infoLight: '#22D3EE',
  infoDark: '#0EBDD4',
  info50: '#E0F7FA', // Solid pastel cyan (matches styles.css)

  // Gray Colors
  gray400: '#7B8494',
  gray300: '#cbd5e1',
  gray200: '#e3e3e3',
  gray50: '#f8fafc',
} as const;

/**
 * CSS 변수를 실제 값으로 해석하는 함수
 *
 * @param cssVar CSS 변수 문자열 (예: 'var(--color-primary)')
 * @returns 실제 색상 값 (예: '#4A7AE0')
 *
 * @example
 * ```typescript
 * const color = resolveCssVariable('var(--color-primary)');
 * // => '#4A7AE0'
 * ```
 */
export function resolveCssVariable(cssVar: string): string {
  // CSS 변수가 아니면 그대로 반환
  if (!cssVar.startsWith('var(')) {
    return cssVar;
  }

  // var(--color-primary) -> --color-primary
  const match = cssVar.match(/var\((--[^)]+)\)/);
  if (!match) {
    return cssVar;
  }

  const variableName = match[1];

  // 브라우저 환경에서만 실행
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return cssVar;
  }

  // CSS 변수 값 가져오기
  const computedStyle = getComputedStyle(document.documentElement);
  const value = computedStyle.getPropertyValue(variableName).trim();

  return value || cssVar;
}

/**
 * 차트용 색상 맵을 반환하는 Hook
 *
 * Recharts 등 SVG 기반 라이브러리에서 사용
 * CSS 변수 로딩 타이밍 이슈를 피하기 위해 상수 맵을 직접 사용
 *
 * @returns 색상 맵 객체
 *
 * @example
 * ```typescript
 * const colors = useChartColors();
 * // colors.primary => '#4A7AE0'
 * // colors.success => '#34C66A'
 * ```
 */
export function useChartColors() {
  return COLOR_MAP;
}

/**
 * Badge용 색상 맵 생성 함수
 *
 * Badge 컴포넌트가 필요로 하는 형태로 색상 맵을 변환
 *
 * @returns Badge colorMap 형식의 객체
 */
export function createBadgeColorMap() {
  return {
    primary: {
      main: COLOR_MAP.primary,
      light: COLOR_MAP.primaryLight,
      dark: COLOR_MAP.primaryDark,
      bg50: COLOR_MAP.primary50,
    },
    secondary: {
      main: COLOR_MAP.secondary,
      light: COLOR_MAP.secondaryLight,
      dark: COLOR_MAP.secondaryDark,
      bg50: COLOR_MAP.secondary50,
    },
    success: {
      main: COLOR_MAP.success,
      light: COLOR_MAP.successLight,
      dark: COLOR_MAP.successDark,
      bg50: COLOR_MAP.success50,
    },
    warning: {
      main: COLOR_MAP.warning,
      light: COLOR_MAP.warningLight,
      dark: COLOR_MAP.warningDark,
      bg50: COLOR_MAP.warning50,
    },
    error: {
      main: COLOR_MAP.error,
      light: COLOR_MAP.errorLight,
      dark: COLOR_MAP.errorDark,
      bg50: COLOR_MAP.error50,
    },
    info: {
      main: COLOR_MAP.info,
      light: COLOR_MAP.infoLight,
      dark: COLOR_MAP.infoDark,
      bg50: COLOR_MAP.info50,
    },
    blue: {
      main: COLOR_MAP.primary,
      light: COLOR_MAP.primaryLight,
      dark: COLOR_MAP.primaryDark,
      bg50: COLOR_MAP.primary50,
    },
    gray: {
      main: COLOR_MAP.gray400,
      light: COLOR_MAP.gray300,
      dark: COLOR_MAP.gray400,
      bg50: COLOR_MAP.gray50,
    },
    green: {
      main: COLOR_MAP.success,
      light: COLOR_MAP.successLight,
      dark: COLOR_MAP.successDark,
      bg50: COLOR_MAP.success50,
    },
    yellow: {
      main: COLOR_MAP.warning,
      light: COLOR_MAP.warningLight,
      dark: COLOR_MAP.warningDark,
      bg50: COLOR_MAP.warning50,
    },
  };
}
