/**
 * useTheme Hook
 *
 * 테넌트별 테마를 가져와서 CSS 변수로 적용하는 React Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
import { type ThemeMode, type IndustryType } from '@design-system/core';
/**
 * 테넌트별 테마 오버라이드 타입
 */
interface TenantThemeOverride {
    colors?: {
        primary?: {
            light?: string;
            DEFAULT?: string;
            dark?: string;
        };
        secondary?: {
            light?: string;
            DEFAULT?: string;
            dark?: string;
        };
        success?: {
            light?: string;
            DEFAULT?: string;
            dark?: string;
        };
        warning?: {
            light?: string;
            DEFAULT?: string;
            dark?: string;
        };
        error?: {
            light?: string;
            DEFAULT?: string;
            dark?: string;
        };
        info?: {
            light?: string;
            DEFAULT?: string;
            dark?: string;
        };
    };
}
/**
 * 테넌트별 테마를 가져와서 적용하는 Hook
 *
 * @param options - 테마 옵션
 * @param options.mode - 테마 모드 (light, dark, auto)
 * @param options.highContrast - 고대비 모드 활성화 여부
 */
export declare function useTheme(options?: {
    mode?: ThemeMode;
    highContrast?: boolean;
}): {
    tenantId: string | undefined;
    industryType: IndustryType | undefined;
    themeOverride: TenantThemeOverride | null | undefined;
};
export {};
//# sourceMappingURL=useTheme.d.ts.map