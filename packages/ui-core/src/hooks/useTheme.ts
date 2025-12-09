/**
 * useTheme Hook
 *
 * 테넌트별 테마를 가져와서 CSS 변수로 적용하는 React Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiContext } from '@api-sdk/core';
import { apiClient } from '@api-sdk/core';
import { createTheme, type ThemeMode, type IndustryType } from '@design-system/core';
import { applyThemeToCSS, resetTheme } from '../utils/applyTheme';

/**
 * 테넌트별 테마 오버라이드 타입
 */
interface TenantThemeOverride {
  colors?: {
    primary?: { light?: string; DEFAULT?: string; dark?: string };
    secondary?: { light?: string; DEFAULT?: string; dark?: string };
    success?: { light?: string; DEFAULT?: string; dark?: string };
    warning?: { light?: string; DEFAULT?: string; dark?: string };
    error?: { light?: string; DEFAULT?: string; dark?: string };
    info?: { light?: string; DEFAULT?: string; dark?: string };
  };
}

/**
 * 업종별 테마 토큰 타입
 */
interface IndustryThemeOverride {
  colors?: {
    primary?: { light?: string; DEFAULT?: string; dark?: string };
    secondary?: { light?: string; DEFAULT?: string; dark?: string };
    success?: { light?: string; DEFAULT?: string; dark?: string };
    warning?: { light?: string; DEFAULT?: string; dark?: string };
    error?: { light?: string; DEFAULT?: string; dark?: string };
    info?: { light?: string; DEFAULT?: string; dark?: string };
  };
}

/**
 * 테넌트별 테마를 가져와서 적용하는 Hook
 *
 * @param options - 테마 옵션
 * @param options.mode - 테마 모드 (light, dark, auto)
 * @param options.highContrast - 고대비 모드 활성화 여부
 */
export function useTheme(options: {
  mode?: ThemeMode;
  highContrast?: boolean;
} = {}) {
  const { mode: initialMode = 'auto', highContrast = false } = options;
  const context = getApiContext();
  const tenantId = context.tenantId;
  const industryType = context.industryType as IndustryType | undefined;

  // 다크모드 감지 (auto 모드일 때)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (initialMode === 'dark') return true;
    if (initialMode === 'light') return false;
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 시스템 다크모드 변경 감지
  useEffect(() => {
    if (initialMode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    // 초기값 설정
    setIsDarkMode(mediaQuery.matches);

    // 변경 감지
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [initialMode]);

  // 실제 테마 모드 결정
  const actualMode: ThemeMode = initialMode === 'auto' ? (isDarkMode ? 'dark' : 'light') : initialMode;

  // High Contrast 모드 감지 (auto 모드일 때)
  const [isHighContrast, setIsHighContrast] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-contrast: high)').matches;
  });

  // 시스템 High Contrast 변경 감지
  useEffect(() => {
    if (highContrast) return; // 수동 설정이 있으면 자동 감지 비활성화

    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    // 초기값 설정
    setIsHighContrast(mediaQuery.matches);

    // 변경 감지
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [highContrast]);

  // 실제 High Contrast 모드 결정
  const actualHighContrast = highContrast || isHighContrast;

  // 업종별 테마 토큰 조회
  const { data: industryThemeOverride } = useQuery({
    queryKey: ['industry-theme', industryType],
    queryFn: async (): Promise<IndustryThemeOverride | null> => {
      if (!industryType) {
        return null;
      }

      try {
        // industry_themes 테이블에서 업종별 테마 조회
        // 테이블이 없으면 null 반환 (기본 테마 사용)
        const response = await apiClient.get<{ theme_tokens: IndustryThemeOverride }>(
          'industry_themes',
          {
            filters: { industry_type: industryType },
          }
        );

        if (response.error) {
          // 테마가 없으면 null 반환 (기본 테마 사용)
          if (response.error.code === 'PGRST116') {
            return null;
          }
          console.warn('Failed to fetch industry theme:', response.error);
          return null;
        }

        if (!response.data || response.data.length === 0) {
          return null;
        }

        return response.data[0]?.theme_tokens || null;
      } catch (error) {
        // 테이블이 없거나 오류 발생 시 null 반환 (기본 테마 사용)
        console.warn('Failed to fetch industry theme:', error);
        return null;
      }
    },
    enabled: !!industryType,
    staleTime: 10 * 60 * 1000, // 10분 (업종별 테마는 자주 변경되지 않음)
  });

  // 테넌트별 테마 오버라이드 조회
  const { data: tenantThemeOverride } = useQuery({
    queryKey: ['tenant-theme', tenantId],
    queryFn: async (): Promise<TenantThemeOverride | null> => {
      if (!tenantId) {
        return null;
      }

      try {
        const response = await apiClient.get<{ theme_tokens: TenantThemeOverride }>(
          'tenant_theme_overrides',
          {
            filters: { tenant_id: tenantId },
          }
        );

        if (response.error) {
          // 테마 오버라이드가 없으면 null 반환 (기본 테마 사용)
          if (response.error.code === 'PGRST116') {
            return null;
          }
          console.warn('Failed to fetch tenant theme:', response.error);
          return null;
        }

        if (!response.data || response.data.length === 0) {
          return null;
        }

        return response.data[0]?.theme_tokens || null;
      } catch (error) {
        console.warn('Failed to fetch tenant theme:', error);
        return null;
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5분
  });

  // ThemeEngine을 사용하여 테마 병합 및 적용
  useEffect(() => {
    if (!tenantId) {
      // tenantId가 없으면 기본 테마 사용
      resetTheme();
      return;
    }

    // ThemeEngine 생성
    const themeEngine = createTheme({
      mode: actualMode,
      industry: industryType,
      tenantId,
      industryTheme: industryThemeOverride?.colors
        ? {
            industry: industryType!,
            tokens: {
              colors: industryThemeOverride.colors as any,
            },
          }
        : undefined,
      tenantTheme: tenantThemeOverride?.colors
        ? {
            tenantId,
            tokens: {
              colors: tenantThemeOverride.colors as any,
            },
          }
        : undefined,
      highContrast: actualHighContrast,
    });

    // 병합된 토큰 가져오기
    const mergedTokens = themeEngine.getTokens();

    // CSS 변수로 적용
    applyThemeToCSS(mergedTokens);
  }, [tenantId, industryType, industryThemeOverride, tenantThemeOverride, actualMode, actualHighContrast]);

  return {
    tenantId,
    industryType,
    themeOverride: tenantThemeOverride,
  };
}

