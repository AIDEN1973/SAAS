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
export declare function applyThemeToCSS(tokens: ThemeTokens): void;
/**
 * 테마 초기화 (기본값으로 복원)
 * CSS 변수를 제거하여 styles.css의 기본값을 사용하도록 함
 */
export declare function resetTheme(): void;
//# sourceMappingURL=applyTheme.d.ts.map