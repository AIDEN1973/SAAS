import { useMemo } from 'react';

/**
 * CSS 변수에서 아이콘 크기를 읽어오는 커스텀 훅
 *
 * @param cssVarName - CSS 변수 이름 (기본값: '--size-icon-base')
 * @param fallback - 기본값 (기본값: 16)
 * @returns 아이콘 크기 (px 단위)
 *
 * @example
 * ```tsx
 * const iconSize = useIconSize();
 * const customIconSize = useIconSize('--size-icon-sidebar', 19);
 * ```
 */
export function useIconSize(cssVarName: string = '--size-icon-base', fallback: number = 16): number {
  return useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVarName)
        .trim();

      if (value) {
        // rem 단위를 px로 변환 (기본값 16px = 1rem)
        if (value.endsWith('rem')) {
          return parseFloat(value) * 16;
        }
        // px 단위인 경우
        if (value.endsWith('px')) {
          return parseFloat(value);
        }
        // 단위가 없는 경우 숫자로 변환
        return Number(value) || fallback;
      }
    }
    return fallback;
  }, [cssVarName, fallback]);
}

/**
 * CSS 변수에서 아이콘 선 두께를 읽어오는 커스텀 훅
 *
 * @param cssVarName - CSS 변수 이름 (기본값: '--stroke-width-icon')
 * @param fallback - 기본값 (기본값: 1.5)
 * @returns 아이콘 선 두께
 *
 * @example
 * ```tsx
 * const strokeWidth = useIconStrokeWidth();
 * const boldStrokeWidth = useIconStrokeWidth('--stroke-width-icon-bold', 2);
 * ```
 */
export function useIconStrokeWidth(cssVarName: string = '--stroke-width-icon', fallback: number = 1.5): number {
  return useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVarName)
        .trim();
      return value ? Number(value) : fallback;
    }
    return fallback;
  }, [cssVarName, fallback]);
}

