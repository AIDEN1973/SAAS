import { useMemo, useEffect, useState } from 'react';

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
  const [size, setSize] = useState(fallback);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // CSS가 로드된 후에 CSS 변수를 읽도록 지연
      const readCSSVar = () => {
        const value = getComputedStyle(document.documentElement)
          .getPropertyValue(cssVarName)
          .trim();

        if (value) {
          // rem 단위를 px로 변환 (기본값 16px = 1rem)
          if (value.endsWith('rem')) {
            setSize(parseFloat(value) * 16);
            return;
          }
          // px 단위인 경우
          if (value.endsWith('px')) {
            setSize(parseFloat(value));
            return;
          }
          // 단위가 없는 경우 숫자로 변환
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            setSize(numValue);
            return;
          }
        }
        setSize(fallback);
      };

      // 즉시 시도
      readCSSVar();

      // CSS가 로드될 때까지 대기 (최대 1초)
      const timeout = setTimeout(() => {
        readCSSVar();
      }, 100);

      // CSS 파일 로드 이벤트 리스너
      const checkCSSLoaded = () => {
        readCSSVar();
      };

      // 모든 스타일시트가 로드되었는지 확인
      if (document.readyState === 'complete') {
        readCSSVar();
      } else {
        window.addEventListener('load', checkCSSLoaded);
      }

      return () => {
        clearTimeout(timeout);
        window.removeEventListener('load', checkCSSLoaded);
      };
    }
  }, [cssVarName, fallback]);

  return size;
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
  const [strokeWidth, setStrokeWidth] = useState(fallback);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // CSS가 로드된 후에 CSS 변수를 읽도록 지연
      const readCSSVar = () => {
        const value = getComputedStyle(document.documentElement)
          .getPropertyValue(cssVarName)
          .trim();
        if (value) {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            setStrokeWidth(numValue);
            return;
          }
        }
        setStrokeWidth(fallback);
      };

      // 즉시 시도
      readCSSVar();

      // CSS가 로드될 때까지 대기
      const timeout = setTimeout(() => {
        readCSSVar();
      }, 100);

      // CSS 파일 로드 이벤트 리스너
      const checkCSSLoaded = () => {
        readCSSVar();
      };

      if (document.readyState === 'complete') {
        readCSSVar();
      } else {
        window.addEventListener('load', checkCSSLoaded);
      }

      return () => {
        clearTimeout(timeout);
        window.removeEventListener('load', checkCSSLoaded);
      };
    }
  }, [cssVarName, fallback]);

  return strokeWidth;
}

