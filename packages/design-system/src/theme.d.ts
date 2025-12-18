/**
 * Multi-Tenant Theme Engine
 *
 * Theme Merge Priority:
 * 1. system default tokens
 * 2. industry tokens
 * 3. tenant theme override
 * 4. dark mode
 * 5. high contrast (forced-colors)
 *
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import { colors, spacing, sizes, breakpoints, type SpacingToken, type ColorToken, type SizeToken } from './tokens';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type IndustryType = 'academy' | 'salon' | 'realestate' | 'gym' | 'ngo';
export interface ThemeTokens {
    colors: typeof colors;
    spacing: typeof spacing;
    sizes: typeof sizes;
    breakpoints: typeof breakpoints;
}
export interface IndustryTheme {
    industry: IndustryType;
    tokens: Partial<ThemeTokens>;
}
export interface TenantTheme {
    tenantId: string;
    tokens: Partial<ThemeTokens>;
}
export interface ThemeConfig {
    mode: ThemeMode;
    industry?: IndustryType;
    tenantId?: string;
    industryTheme?: IndustryTheme;
    tenantTheme?: TenantTheme;
    highContrast?: boolean;
}
/**
 * Theme Engine
 *
 * [불변 규칙] 스키마 이에 따라 순차적으로 override하여 최종 Token Set을 생성한다.
 */
export declare class ThemeEngine {
    private config;
    private mergedTokens;
    constructor(config: ThemeConfig);
    /**
     * Theme Merge Priority에 따라 토큰 병합
     */
    private mergeThemes;
    private deepMerge;
    private applyDarkMode;
    /**
     * 다크모드를 위한 색상 밝기 조정
     *
     * @param hex - HEX 색상 코드
     * @param factor - 밝기 조정 계수 (1.0 = 변경 없음, 1.5 = 50% 더 밝게)
     * @returns 조정된 HEX 색상 코드
     */
    private adjustColorForDarkMode;
    /**
     * RGB를 HSL로 변환
     */
    private rgbToHsl;
    /**
     * HSL을 RGB로 변환
     */
    private hslToRgb;
    private applyHighContrast;
    /**
     * 고대비 모드를 위한 색상 조정
     *
     * @param hex - HEX 색상 코드
     * @param direction - 조정 방향 ('lighten' = 밝게, 'darken' = 어둡게)
     * @returns 조정된 HEX 색상 코드
     */
    private adjustColorForHighContrast;
    private isDarkMode;
    /**
     * 최종 병합된 토큰 반환
     */
    getTokens(): ThemeTokens;
    /**
     * Spacing 토큰 가져오기
     */
    getSpacing(token: SpacingToken): string;
    /**
     * Color 토큰 가져오기
     */
    getColor(token: ColorToken, variant?: 'light' | 'DEFAULT' | 'dark'): string;
    /**
     * Size 토큰 가져오기
     */
    getSize(token: SizeToken): string;
}
/**
 * Default Theme Engine 인스턴스 생성
 */
export declare function createTheme(config: ThemeConfig): ThemeEngine;
//# sourceMappingURL=theme.d.ts.map