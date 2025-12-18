/**
 * Design Tokens
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스 문자열을 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 토큰 기반으로 관리됩니다.
 */
export type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type ColorToken = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BreakpointToken = 'mobile' | 'tablet' | 'desktop';
/**
 * Spacing Tokens (Tailwind 기반)
 */
export declare const spacing: Record<SpacingToken, string>;
/**
 * Color Tokens
 * Multi-Tenant Theme Engine에서 override 가능
 */
export declare const colors: {
    primary: {
        light: string;
        DEFAULT: string;
        dark: string;
    };
    secondary: {
        light: string;
        DEFAULT: string;
        dark: string;
    };
    success: {
        light: string;
        DEFAULT: string;
        dark: string;
    };
    warning: {
        light: string;
        DEFAULT: string;
        dark: string;
    };
    error: {
        light: string;
        DEFAULT: string;
        dark: string;
    };
    info: {
        light: string;
        DEFAULT: string;
        dark: string;
    };
};
/**
 * Size Tokens
 */
export declare const sizes: Record<SizeToken, string>;
/**
 * Breakpoint Tokens
 */
export declare const breakpoints: Record<BreakpointToken, string>;
/**
 * Layout Tokens
 */
export declare const layout: {
    columns: {
        1: string;
        2: string;
        3: string;
        4: string;
    };
    gap: Record<SpacingToken, string>;
};
//# sourceMappingURL=tokens.d.ts.map