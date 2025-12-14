/**
 * Theme Application Utility
 *
 * ThemeEngine의 토큰을 CSS 변수로 변환하여 적용합니다.
 * [불변 규칙] 기본 스타일(폰트, 간격, 크기 등)은 변경하지 않고 색상만 변경합니다.
 */

import type { ThemeTokens } from '@design-system/core';

/**
 * ThemeEngine의 색상 토큰을 CSS 변수로 변환하여 적용
 *
 * @param tokens - ThemeEngine에서 병합된 최종 토큰
 */
export function applyThemeToCSS(tokens: ThemeTokens): void {
  const root = document.documentElement;

  // 색상 토큰만 CSS 변수로 적용 (기본 스타일은 styles.css에 유지)
  const colorTokens = tokens.colors;

  // Primary 색상
  if (colorTokens.primary) {
    root.style.setProperty('--color-primary', colorTokens.primary.DEFAULT);
    root.style.setProperty('--color-primary-light', colorTokens.primary.light);
    root.style.setProperty('--color-primary-dark', colorTokens.primary.dark);
    // Primary-50 (배경색용)은 light 색상의 투명도 버전으로 생성
    root.style.setProperty('--color-primary-50', hexToRgba(colorTokens.primary.light, 0.1));
    // Primary-100 (선택된 항목 배경색용)은 light 색상의 투명도 버전으로 생성
    root.style.setProperty('--color-primary-100', hexToRgba(colorTokens.primary.light, 0.2));
  }

  // Secondary 색상
  if (colorTokens.secondary) {
    root.style.setProperty('--color-secondary', colorTokens.secondary.DEFAULT);
    root.style.setProperty('--color-secondary-light', colorTokens.secondary.light);
    root.style.setProperty('--color-secondary-dark', colorTokens.secondary.dark);
    root.style.setProperty('--color-secondary-50', hexToRgba(colorTokens.secondary.light, 0.1));
    root.style.setProperty('--color-secondary-100', hexToRgba(colorTokens.secondary.light, 0.2));
  }

  // Success 색상
  if (colorTokens.success) {
    root.style.setProperty('--color-success', colorTokens.success.DEFAULT);
    root.style.setProperty('--color-success-light', colorTokens.success.light);
    root.style.setProperty('--color-success-dark', colorTokens.success.dark);
    root.style.setProperty('--color-success-50', hexToRgba(colorTokens.success.light, 0.1));
  }

  // Warning 색상
  if (colorTokens.warning) {
    root.style.setProperty('--color-warning', colorTokens.warning.DEFAULT);
    root.style.setProperty('--color-warning-light', colorTokens.warning.light);
    root.style.setProperty('--color-warning-dark', colorTokens.warning.dark);
    root.style.setProperty('--color-warning-50', hexToRgba(colorTokens.warning.light, 0.1));
  }

  // Error 색상
  if (colorTokens.error) {
    root.style.setProperty('--color-error', colorTokens.error.DEFAULT);
    root.style.setProperty('--color-error-light', colorTokens.error.light);
    root.style.setProperty('--color-error-dark', colorTokens.error.dark);
    root.style.setProperty('--color-error-50', hexToRgba(colorTokens.error.light, 0.1));
  }

  // Info 색상
  if (colorTokens.info) {
    root.style.setProperty('--color-info', colorTokens.info.DEFAULT);
    root.style.setProperty('--color-info-light', colorTokens.info.light);
    root.style.setProperty('--color-info-dark', colorTokens.info.dark);
    root.style.setProperty('--color-info-50', hexToRgba(colorTokens.info.light, 0.1));
  }
}

/**
 * HEX 색상을 RGBA로 변환
 *
 * @param hex - HEX 색상 코드 (예: #3b82f6)
 * @param alpha - 투명도 (0-1)
 * @returns RGBA 색상 문자열 (예: rgba(59, 130, 246, 0.1))
 */
function hexToRgba(hex: string, alpha: number): string {
  // # 제거
  const cleanHex = hex.replace('#', '');

  // RGB 값 추출
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 테마 초기화 (기본값으로 복원)
 * CSS 변수를 제거하여 styles.css의 기본값을 사용하도록 함
 */
export function resetTheme(): void {
  const root = document.documentElement;

  const colorVars = [
    '--color-primary',
    '--color-primary-light',
    '--color-primary-dark',
    '--color-primary-50',
    '--color-primary-100',
    '--color-secondary',
    '--color-secondary-light',
    '--color-secondary-dark',
    '--color-secondary-50',
    '--color-secondary-100',
    '--color-success',
    '--color-success-light',
    '--color-success-dark',
    '--color-success-50',
    '--color-warning',
    '--color-warning-light',
    '--color-warning-dark',
    '--color-warning-50',
    '--color-error',
    '--color-error-light',
    '--color-error-dark',
    '--color-error-50',
    '--color-info',
    '--color-info-light',
    '--color-info-dark',
    '--color-info-50',
  ];

  colorVars.forEach((varName) => {
    root.style.removeProperty(varName);
  });
}

