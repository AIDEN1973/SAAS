/**
 * Design Tokens
 * 
 * [Î∂àÎ? Í∑úÏπô] ?§ÌÇ§ÎßàÏóê??Tailwind ?¥Îûò??Î¨∏Ïûê?¥ÏùÑ ÏßÅÏ†ë ?¨Ïö©?òÏ? ?äÎäî??
 * [Î∂àÎ? Í∑úÏπô] Î™®Îì† ?§Ì??ºÏ? ?†ÌÅ∞ Í∏∞Î∞ò?ºÎ°ú Í¥ÄÎ¶¨Îêú??
 */

export type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type ColorToken = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type SizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BreakpointToken = 'mobile' | 'tablet' | 'desktop';

/**
 * Spacing Tokens (Tailwind Í∏∞Î∞ò)
 */
export const spacing: Record<SpacingToken, string> = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
};

/**
 * Color Tokens
 * Multi-Tenant Theme Engine?êÏÑú override Í∞Ä??
 */
export const colors = {
  primary: {
    light: '#3b82f6',
    DEFAULT: '#2563eb',
    dark: '#1e40af',
  },
  secondary: {
    light: '#8b5cf6',
    DEFAULT: '#7c3aed',
    dark: '#6d28d9',
  },
  success: {
    light: '#10b981',
    DEFAULT: '#059669',
    dark: '#047857',
  },
  warning: {
    light: '#f59e0b',
    DEFAULT: '#d97706',
    dark: '#b45309',
  },
  error: {
    light: '#ef4444',
    DEFAULT: '#dc2626',
    dark: '#b91c1c',
  },
  info: {
    light: '#06b6d4',
    DEFAULT: '#0891b2',
    dark: '#0e7490',
  },
};

/**
 * Size Tokens
 */
export const sizes: Record<SizeToken, string> = {
  xs: '0.75rem',   // 12px
  sm: '0.875rem',  // 14px
  md: '1rem',      // 16px
  lg: '1.125rem',  // 18px
  xl: '1.25rem',   // 20px
};

/**
 * Breakpoint Tokens
 */
export const breakpoints: Record<BreakpointToken, string> = {
  mobile: '640px',
  tablet: '768px',
  desktop: '1024px',
};

/**
 * Layout Tokens
 */
export const layout = {
  columns: {
    1: '1',
    2: '2',
    3: '3',
    4: '4',
  },
  gap: spacing,
};

