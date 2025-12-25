/**
 * SSOT: Design Rules
 *
 * 디자인 규칙의 단일 정본(SSOT)
 * [불변 규칙] 모든 디자인 값은 Design Tokens로만 존재
 * [불변 규칙] 하드코딩 금지: px/rem/em/hex/opacity 값 하드코딩 금지
 *
 * 참조 문서: docu/SSOT_UI_DESIGN.md
 */

/**
 * Design Token 카테고리
 */
export const DESIGN_TOKEN_CATEGORIES = {
  SPACING: 'spacing',
  COLOR: 'color',
  TYPOGRAPHY: 'typography',
  BORDER: 'border',
  SHADOW: 'shadow',
  Z_INDEX: 'z-index',
  SIZE: 'size',
  OPACITY: 'opacity',
  LAYOUT: 'layout',
} as const;

/**
 * Spacing Token 값
 */
export const SPACING_TOKENS = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
  '2XL': '2xl',
  '3XL': '3xl',
} as const;

/**
 * Color Token 값
 */
export const COLOR_TOKENS = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  INFO: 'info',
  TEXT: 'text',
  BACKGROUND: 'background',
  SURFACE: 'surface',
} as const;

/**
 * Font Size Token 값
 */
export const FONT_SIZE_TOKENS = {
  XS: 'xs',
  SM: 'sm',
  BASE: 'base',
  LG: 'lg',
  XL: 'xl',
  '2XL': '2xl',
  '3XL': '3xl',
} as const;

/**
 * Border Radius Token 값
 */
export const BORDER_RADIUS_TOKENS = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
  '2XL': '2xl',
  FULL: 'full',
} as const;

/**
 * Size Token 값
 */
export const SIZE_TOKENS = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
} as const;

/**
 * CSS 변수 네이밍 패턴
 */
export const CSS_VAR_PATTERNS = {
  SPACING: '--spacing-{size}',
  COLOR: '--color-{name}',
  FONT_SIZE: '--font-size-{size}',
  FONT_WEIGHT: '--font-weight-{weight}',
  LINE_HEIGHT: '--line-height-{variant}',
  BORDER_RADIUS: '--border-radius-{size}',
  BORDER_WIDTH: '--border-width-{thickness}',
  SHADOW: '--shadow-{size}',
  Z_INDEX: '--z-{layer}',
  SIZE: '--size-{component}-{size}',
  OPACITY: '--opacity-{state}',
  WIDTH: '--width-{element}',
  HEIGHT: '--height-{element}',
} as const;

/**
 * 허용되는 하드코딩 예외 (레이아웃/속성 값)
 */
export const ALLOWED_HARDCODED_VALUES = {
  CSS_PROPERTIES: ['flex', 'none', 'auto', '100%', '0', '1'],
  LAYOUT_SPECIAL: ['width: 0', 'minWidth: 0', 'height: 0', 'minHeight: 0'],
  DISPLAY_VALUES: ['flex', 'grid', 'block', 'inline', 'inline-block', 'absolute', 'relative', 'fixed', 'sticky'],
} as const;

/**
 * CSS 변수 이름 생성 헬퍼
 */
export function createCSSVar(category: string, name: string): string {
  const patterns: Record<string, string> = {
    spacing: `--spacing-${name}`,
    color: `--color-${name}`,
    'font-size': `--font-size-${name}`,
    'font-weight': `--font-weight-${name}`,
    'line-height': `--line-height-${name}`,
    'border-radius': `--border-radius-${name}`,
    'border-width': `--border-width-${name}`,
    shadow: `--shadow-${name}`,
    'z-index': `--z-${name}`,
    size: `--size-${name}`,
    opacity: `--opacity-${name}`,
    width: `--width-${name}`,
    height: `--height-${name}`,
  };

  return patterns[category] || `--${category}-${name}`;
}

/**
 * 하드코딩된 px 값 탐지 (개발 환경에서만 경고)
 */
export function detectHardcodedPx(value: string): boolean {
  if (typeof window === 'undefined') return false; // SSR에서는 검사하지 않음

  // 허용된 예외 제외
  if ((ALLOWED_HARDCODED_VALUES.CSS_PROPERTIES as readonly string[]).includes(value)) return false;
  if (ALLOWED_HARDCODED_VALUES.LAYOUT_SPECIAL.some(pattern => value.includes(pattern))) return false;

  // px 값 패턴 탐지
  const pxPattern = /\d+px/;
  return pxPattern.test(value);
}

/**
 * 하드코딩된 hex 색상 탐지 (개발 환경에서만 경고)
 */
export function detectHardcodedHex(value: string): boolean {
  if (typeof window === 'undefined') return false; // SSR에서는 검사하지 않음

  // hex 색상 패턴 탐지 (#3b82f6, #fff 등)
  const hexPattern = /#[0-9a-fA-F]{3,6}/;
  return hexPattern.test(value);
}

/**
 * 하드코딩된 opacity 값 탐지 (개발 환경에서만 경고)
 */
export function detectHardcodedOpacity(value: string | number): boolean {
  if (typeof window === 'undefined') return false; // SSR에서는 검사하지 않음

  if (typeof value === 'number') {
    // 0과 1은 허용 (레이아웃/특수 값)
    if (value === 0 || value === 1) return false;
    // 0~1 사이의 숫자는 하드코딩으로 간주
    return value > 0 && value < 1;
  }

  if (typeof value === 'string') {
    // CSS 변수는 허용
    if (value.startsWith('var(--opacity-')) return false;
    // 숫자 패턴 탐지
    const numPattern = /opacity:\s*[0-9.]+/;
    return numPattern.test(value);
  }

  return false;
}

/**
 * CSS 변수 사용 여부 확인
 */
export function isCSSVariable(value: string): boolean {
  return value.startsWith('var(--');
}

/**
 * 개발 환경에서 하드코딩 경고 (콘솔 경고만, 빌드 실패하지 않음)
 */
export function warnHardcodedValue(
  type: 'px' | 'hex' | 'opacity' | 'border',
  value: string | number,
  suggestion?: string
): void {
  if (process.env.NODE_ENV === 'production') return; // 프로덕션에서는 경고하지 않음

  const message = `[SSOT Design Rules] 하드코딩된 ${type} 값 감지: ${value}`;
  const suggestionMsg = suggestion ? ` → ${suggestion} 사용 권장` : '';

  console.warn(message + suggestionMsg);
  console.warn('참조: docu/SSOT_UI_DESIGN.md C-3 섹션');
}

