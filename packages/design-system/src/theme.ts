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
      merged = this.deepMerge(merged, this.config.industryTheme.tokens);
    }

    // 3. Tenant theme override
    if (this.config.tenantTheme) {
      merged = this.deepMerge(merged, this.config.tenantTheme.tokens);
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

  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (source) {
      Object.keys(source).forEach((key) => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          output[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  private applyDarkMode(tokens: ThemeTokens): ThemeTokens {
    // Dark mode 변환 로직
    // 실제 구현에서는 현재 서버에서 처리
    return tokens;
  }

  private applyHighContrast(tokens: ThemeTokens): ThemeTokens {
    // High contrast 변환 로직
    return tokens;
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

