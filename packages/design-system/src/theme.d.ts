/**
 * Multi-Tenant Theme Engine
 *
 * Theme Merge Priority:
 * 1. system default tokens
 * 2. industry tokens
 * 3. tenant theme override
 * 4. dark mode
 * 5. high contrast (forced-colors)
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
 * [불�? 규칙] ?�마?????�이?�에???�차?�으�?override?�어 최종 Token Set???�성?�다.
 */
export declare class ThemeEngine {
    private config;
    private mergedTokens;
    constructor(config: ThemeConfig);
    /**
     * Theme Merge Priority???�라 ?�큰 병합
     */
    private mergeThemes;
    private deepMerge;
    private applyDarkMode;
    private applyHighContrast;
    private isDarkMode;
    /**
     * 최종 병합???�큰 반환
     */
    getTokens(): ThemeTokens;
    /**
     * Spacing ?�큰 가?�오�?
     */
    getSpacing(token: SpacingToken): string;
    /**
     * Color ?�큰 가?�오�?
     */
    getColor(token: ColorToken, variant?: 'light' | 'DEFAULT' | 'dark'): string;
    /**
     * Size ?�큰 가?�오�?
     */
    getSize(token: SizeToken): string;
}
/**
 * Default Theme Engine ?�스?�스 ?�성
 */
export declare function createTheme(config: ThemeConfig): ThemeEngine;
//# sourceMappingURL=theme.d.ts.map