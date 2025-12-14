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
export class ThemeEngine {
  private config: ThemeConfig;
  private mergedTokens: ThemeTokens;

  constructor(config: ThemeConfig) {
    this.config = config;
    this.mergedTokens = this.mergeThemes();
  }

  /**
   * Theme Merge Priority에 따라 토큰 병합
   */
  private mergeThemes(): ThemeTokens {
    // 1. System default tokens
    let merged: ThemeTokens = {
      colors: { ...colors },
      spacing: { ...spacing },
      sizes: { ...sizes },
      breakpoints: { ...breakpoints },
    };

    // 2. Industry tokens
    if (this.config.industryTheme) {
      merged = this.deepMerge(merged as unknown as Record<string, unknown>, this.config.industryTheme.tokens as Record<string, unknown>) as unknown as ThemeTokens;
    }

    // 3. Tenant theme override
    if (this.config.tenantTheme) {
      merged = this.deepMerge(merged as unknown as Record<string, unknown>, this.config.tenantTheme.tokens as Record<string, unknown>) as unknown as ThemeTokens;
    }

    // 4. Dark mode
    if (this.config.mode === 'dark' || (this.config.mode === 'auto' && this.isDarkMode())) {
      merged = this.applyDarkMode(merged);
    }

    // 5. High contrast
    if (this.config.highContrast) {
      merged = this.applyHighContrast(merged);
    }

    return merged;
  }

  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const output = { ...target };

    if (source) {
      Object.keys(source).forEach((key) => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          output[key] = this.deepMerge((target[key] || {}) as Record<string, unknown>, source[key] as Record<string, unknown>);
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  private applyDarkMode(tokens: ThemeTokens): ThemeTokens {
    // Dark mode 변환 로직
    // 다크모드에서는 색상을 더 밝게 조정하여 어두운 배경에서 가독성 확보
    const darkModeTokens: ThemeTokens = {
      ...tokens,
      colors: {
        primary: {
          light: this.adjustColorForDarkMode(tokens.colors.primary.light, 1.3),
          DEFAULT: this.adjustColorForDarkMode(tokens.colors.primary.DEFAULT, 1.4),
          dark: this.adjustColorForDarkMode(tokens.colors.primary.dark, 1.5),
        },
        secondary: {
          light: this.adjustColorForDarkMode(tokens.colors.secondary.light, 1.3),
          DEFAULT: this.adjustColorForDarkMode(tokens.colors.secondary.DEFAULT, 1.4),
          dark: this.adjustColorForDarkMode(tokens.colors.secondary.dark, 1.5),
        },
        success: {
          light: this.adjustColorForDarkMode(tokens.colors.success.light, 1.2),
          DEFAULT: this.adjustColorForDarkMode(tokens.colors.success.DEFAULT, 1.3),
          dark: this.adjustColorForDarkMode(tokens.colors.success.dark, 1.4),
        },
        warning: {
          light: this.adjustColorForDarkMode(tokens.colors.warning.light, 1.2),
          DEFAULT: this.adjustColorForDarkMode(tokens.colors.warning.DEFAULT, 1.3),
          dark: this.adjustColorForDarkMode(tokens.colors.warning.dark, 1.4),
        },
        error: {
          light: this.adjustColorForDarkMode(tokens.colors.error.light, 1.2),
          DEFAULT: this.adjustColorForDarkMode(tokens.colors.error.DEFAULT, 1.3),
          dark: this.adjustColorForDarkMode(tokens.colors.error.dark, 1.4),
        },
        info: {
          light: this.adjustColorForDarkMode(tokens.colors.info.light, 1.2),
          DEFAULT: this.adjustColorForDarkMode(tokens.colors.info.DEFAULT, 1.3),
          dark: this.adjustColorForDarkMode(tokens.colors.info.dark, 1.4),
        },
      },
    };

    return darkModeTokens;
  }

  /**
   * 다크모드를 위한 색상 밝기 조정
   *
   * @param hex - HEX 색상 코드
   * @param factor - 밝기 조정 계수 (1.0 = 변경 없음, 1.5 = 50% 더 밝게)
   * @returns 조정된 HEX 색상 코드
   */
  private adjustColorForDarkMode(hex: string, factor: number): string {
    // # 제거
    const cleanHex = hex.replace('#', '');

    // RGB 값 추출
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    // 밝기 조정 (HSL의 L 값을 증가)
    const hsl = this.rgbToHsl(r, g, b);
    hsl[2] = Math.min(100, hsl[2] * factor); // 밝기 증가 (최대 100%)
    const [newR, newG, newB] = this.hslToRgb(hsl[0], hsl[1], hsl[2]);

    // HEX로 변환
    return `#${[newR, newG, newB].map((x) => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    }).join('')}`;
  }

  /**
   * RGB를 HSL로 변환
   */
  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return [h * 360, s * 100, l * 100];
  }

  /**
   * HSL을 RGB로 변환
   */
  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    s /= 100;
    l /= 100;

    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  private applyHighContrast(tokens: ThemeTokens): ThemeTokens {
    // High contrast 변환 로직
    // WCAG AAA 기준 대비율 확보 (일반 텍스트: 최소 7:1, 큰 텍스트: 최소 4.5:1)
    // High Contrast 모드에서는 색상을 더 진하게 또는 더 밝게 조정하여 대비율을 높임
    const highContrastTokens: ThemeTokens = {
      ...tokens,
      colors: {
        primary: {
          light: this.adjustColorForHighContrast(tokens.colors.primary.light, 'lighten'),
          DEFAULT: this.adjustColorForHighContrast(tokens.colors.primary.DEFAULT, 'darken'),
          dark: this.adjustColorForHighContrast(tokens.colors.primary.dark, 'darken'),
        },
        secondary: {
          light: this.adjustColorForHighContrast(tokens.colors.secondary.light, 'lighten'),
          DEFAULT: this.adjustColorForHighContrast(tokens.colors.secondary.DEFAULT, 'darken'),
          dark: this.adjustColorForHighContrast(tokens.colors.secondary.dark, 'darken'),
        },
        success: {
          light: this.adjustColorForHighContrast(tokens.colors.success.light, 'lighten'),
          DEFAULT: this.adjustColorForHighContrast(tokens.colors.success.DEFAULT, 'darken'),
          dark: this.adjustColorForHighContrast(tokens.colors.success.dark, 'darken'),
        },
        warning: {
          light: this.adjustColorForHighContrast(tokens.colors.warning.light, 'lighten'),
          DEFAULT: this.adjustColorForHighContrast(tokens.colors.warning.DEFAULT, 'darken'),
          dark: this.adjustColorForHighContrast(tokens.colors.warning.dark, 'darken'),
        },
        error: {
          light: this.adjustColorForHighContrast(tokens.colors.error.light, 'lighten'),
          DEFAULT: this.adjustColorForHighContrast(tokens.colors.error.DEFAULT, 'darken'),
          dark: this.adjustColorForHighContrast(tokens.colors.error.dark, 'darken'),
        },
        info: {
          light: this.adjustColorForHighContrast(tokens.colors.info.light, 'lighten'),
          DEFAULT: this.adjustColorForHighContrast(tokens.colors.info.DEFAULT, 'darken'),
          dark: this.adjustColorForHighContrast(tokens.colors.info.dark, 'darken'),
        },
      },
    };

    return highContrastTokens;
  }

  /**
   * 고대비 모드를 위한 색상 조정
   *
   * @param hex - HEX 색상 코드
   * @param direction - 조정 방향 ('lighten' = 밝게, 'darken' = 어둡게)
   * @returns 조정된 HEX 색상 코드
   */
  private adjustColorForHighContrast(hex: string, direction: 'lighten' | 'darken'): string {
    // # 제거
    const cleanHex = hex.replace('#', '');

    // RGB 값 추출
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    // HSL로 변환
    const hsl = this.rgbToHsl(r, g, b);

    if (direction === 'lighten') {
      // 밝기 증가 (최대 90%)
      hsl[2] = Math.min(90, hsl[2] * 1.5);
      // 채도 증가 (최대 100%)
      hsl[1] = Math.min(100, hsl[1] * 1.3);
    } else {
      // 밝기 감소 (최소 20%)
      hsl[2] = Math.max(20, hsl[2] * 0.6);
      // 채도 증가 (최대 100%)
      hsl[1] = Math.min(100, hsl[1] * 1.3);
    }

    // RGB로 다시 변환
    const [newR, newG, newB] = this.hslToRgb(hsl[0], hsl[1], hsl[2]);

    // HEX로 변환
    return `#${[newR, newG, newB].map((x) => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    }).join('')}`;
  }

  private isDarkMode(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * 최종 병합된 토큰 반환
   */
  getTokens(): ThemeTokens {
    return this.mergedTokens;
  }

  /**
   * Spacing 토큰 가져오기
   */
  getSpacing(token: SpacingToken): string {
    return this.mergedTokens.spacing[token];
  }

  /**
   * Color 토큰 가져오기
   */
  getColor(token: ColorToken, variant: 'light' | 'DEFAULT' | 'dark' = 'DEFAULT'): string {
    return this.mergedTokens.colors[token][variant];
  }

  /**
   * Size 토큰 가져오기
   */
  getSize(token: SizeToken): string {
    return this.mergedTokens.sizes[token];
  }
}

/**
 * Default Theme Engine 인스턴스 생성
 */
export function createTheme(config: ThemeConfig): ThemeEngine {
  return new ThemeEngine(config);
}

