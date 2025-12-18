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
export declare function useIconSize(cssVarName?: string, fallback?: number): number;
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
export declare function useIconStrokeWidth(cssVarName?: string, fallback?: number): number;
//# sourceMappingURL=useIconSize.d.ts.map