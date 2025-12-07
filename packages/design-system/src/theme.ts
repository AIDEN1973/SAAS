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
 * [ë¶ˆë? ê·œì¹™] ?Œë§ˆ?????ˆì´?´ì—???œì°¨?ìœ¼ë¡?override?˜ì–´ ìµœì¢… Token Set???ì„±?œë‹¤.
 */
export class ThemeEngine {
  private config: ThemeConfig;
  private mergedTokens: ThemeTokens;

  constructor(config: ThemeConfig) {
    this.config = config;
    this.mergedTokens = this.mergeThemes();
  }

  /**
   * Theme Merge Priority???°ë¼ ? í° ë³‘í•©
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
    // Dark mode ë³€??ë¡œì§
    // ?¤ì œ êµ¬í˜„?ì„œ???‰ìƒ ?¸ë²„????ì²˜ë¦¬
    return tokens;
  }

  private applyHighContrast(tokens: ThemeTokens): ThemeTokens {
    // High contrast ë³€??ë¡œì§
    return tokens;
  }

  private isDarkMode(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * ìµœì¢… ë³‘í•©??? í° ë°˜í™˜
   */
  getTokens(): ThemeTokens {
    return this.mergedTokens;
  }

  /**
   * Spacing ? í° ê°€?¸ì˜¤ê¸?
   */
  getSpacing(token: SpacingToken): string {
    return this.mergedTokens.spacing[token];
  }

  /**
   * Color ? í° ê°€?¸ì˜¤ê¸?
   */
  getColor(token: ColorToken, variant: 'light' | 'DEFAULT' | 'dark' = 'DEFAULT'): string {
    return this.mergedTokens.colors[token][variant];
  }

  /**
   * Size ? í° ê°€?¸ì˜¤ê¸?
   */
  getSize(token: SizeToken): string {
    return this.mergedTokens.sizes[token];
  }
}

/**
 * Default Theme Engine ?¸ìŠ¤?´ìŠ¤ ?ì„±
 */
export function createTheme(config: ThemeConfig): ThemeEngine {
  return new ThemeEngine(config);
}

