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

  // 컨텍스트 변경 감지를 위한 state
  const [contextState, setContextState] = useState(() => getApiContext());

  // 컨텍스트 변경 감지 (폴링 방식)
  useEffect(() => {
    const checkContext = () => {
      const currentContext = getApiContext();
      const hasChanged =
        currentContext.tenantId !== contextState.tenantId ||
        currentContext.industryType !== contextState.industryType;

      if (hasChanged) {
        console.log('[useTheme] Context changed:', {
          old: { tenantId: contextState.tenantId, industryType: contextState.industryType },
          new: { tenantId: currentContext.tenantId, industryType: currentContext.industryType },
        });
        setContextState(currentContext);
      }
    };

    // 즉시 확인
    checkContext();

    // 주기적으로 확인 (컨텍스트가 나중에 설정되는 경우 대비)
    const interval = setInterval(checkContext, 100); // 100ms마다 확인

    return () => clearInterval(interval);
  }, [contextState.tenantId, contextState.industryType]);

  const tenantId = contextState.tenantId;
  const industryType = contextState.industryType as IndustryType | undefined;

  console.log('[useTheme] Current context:', { tenantId, industryType });

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
        console.log('[useTheme] Industry theme: industryType is missing');
        return null;
      }

      try {
        console.log('[useTheme] Fetching industry theme for:', industryType);
        // industry_themes 테이블에서 업종별 테마 조회
        // 테이블이 없으면 null 반환 (기본 테마 사용)
        const response = await apiClient.get<{ theme_tokens: IndustryThemeOverride | string }>(
          'industry_themes',
          {
            filters: { industry_type: industryType },
          }
        );

        console.log('[useTheme] Industry theme API response:', {
          hasError: !!response.error,
          error: response.error,
          dataLength: response.data?.length,
          rawData: response.data,
        });

        if (response.error) {
          // 테마가 없거나 테이블이 없으면 null 반환 (기본 테마 사용)
          // PGRST116: 데이터 없음, PGRST205: 테이블이 스키마 캐시에 없음
          if (response.error.code === 'PGRST116' || response.error.code === 'PGRST205') {
            console.log('[useTheme] Industry theme not found (expected):', response.error.code);
            return null;
          }
          // 개발 환경에서만 경고 출력 (프로덕션에서는 조용히 처리)
          console.warn('[useTheme] Failed to fetch industry theme:', response.error);
          return null;
        }

        if (!response.data || response.data.length === 0) {
          console.log('[useTheme] Industry theme: No data returned');
          return null;
        }

        const rawThemeTokens = response.data[0]?.theme_tokens;
        console.log('[useTheme] Raw theme_tokens type:', typeof rawThemeTokens, rawThemeTokens);

        // theme_tokens가 문자열인 경우 JSON 파싱
        let parsedThemeTokens: IndustryThemeOverride | null = null;
        if (typeof rawThemeTokens === 'string') {
          try {
            parsedThemeTokens = JSON.parse(rawThemeTokens) as IndustryThemeOverride;
            console.log('[useTheme] Parsed theme_tokens from string:', parsedThemeTokens);
          } catch (parseError) {
            console.error('[useTheme] Failed to parse theme_tokens JSON:', parseError, rawThemeTokens);
            return null;
          }
        } else if (rawThemeTokens && typeof rawThemeTokens === 'object') {
          parsedThemeTokens = rawThemeTokens as IndustryThemeOverride;
          console.log('[useTheme] Using theme_tokens as object:', parsedThemeTokens);
        } else {
          console.log('[useTheme] theme_tokens is null or invalid type');
          return null;
        }

        console.log('[useTheme] Final industry theme override:', parsedThemeTokens);
        return parsedThemeTokens;
      } catch (error) {
        // 테이블이 없거나 오류 발생 시 null 반환 (기본 테마 사용)
        console.error('[useTheme] Exception while fetching industry theme:', error);
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
        console.log('[useTheme] Tenant theme: tenantId is missing');
        return null;
      }

      try {
        console.log('[useTheme] Fetching tenant theme for:', tenantId);
        const response = await apiClient.get<{ theme_tokens: TenantThemeOverride | string }>(
          'tenant_theme_overrides',
          {
            filters: { tenant_id: tenantId },
          }
        );

        console.log('[useTheme] Tenant theme API response:', {
          hasError: !!response.error,
          error: response.error,
          dataLength: response.data?.length,
          rawData: response.data,
        });

        if (response.error) {
          // 테마 오버라이드가 없거나 테이블이 없으면 null 반환 (기본 테마 사용)
          // PGRST116: 데이터 없음, PGRST205: 테이블이 스키마 캐시에 없음
          if (response.error.code === 'PGRST116' || response.error.code === 'PGRST205') {
            console.log('[useTheme] Tenant theme not found (expected):', response.error.code);
            return null;
          }
          console.warn('[useTheme] Failed to fetch tenant theme:', response.error);
          return null;
        }

        if (!response.data || response.data.length === 0) {
          console.log('[useTheme] Tenant theme: No data returned');
          return null;
        }

        const rawThemeTokens = response.data[0]?.theme_tokens;
        console.log('[useTheme] Raw tenant theme_tokens type:', typeof rawThemeTokens, rawThemeTokens);

        // theme_tokens가 문자열인 경우 JSON 파싱
        let parsedThemeTokens: TenantThemeOverride | null = null;
        if (typeof rawThemeTokens === 'string') {
          try {
            parsedThemeTokens = JSON.parse(rawThemeTokens) as TenantThemeOverride;
            console.log('[useTheme] Parsed tenant theme_tokens from string:', parsedThemeTokens);
          } catch (parseError) {
            console.error('[useTheme] Failed to parse tenant theme_tokens JSON:', parseError, rawThemeTokens);
            return null;
          }
        } else if (rawThemeTokens && typeof rawThemeTokens === 'object') {
          parsedThemeTokens = rawThemeTokens as TenantThemeOverride;
          console.log('[useTheme] Using tenant theme_tokens as object:', parsedThemeTokens);
        } else {
          console.log('[useTheme] Tenant theme_tokens is null or invalid type');
          return null;
        }

        console.log('[useTheme] Final tenant theme override:', parsedThemeTokens);
        return parsedThemeTokens;
      } catch (error) {
        console.error('[useTheme] Exception while fetching tenant theme:', error);
        return null;
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5분
  });

  // ThemeEngine을 사용하여 테마 병합 및 적용
  useEffect(() => {
    console.log('[useTheme] Theme effect triggered:', {
      tenantId,
      industryType,
      hasIndustryTheme: !!industryThemeOverride,
      hasTenantTheme: !!tenantThemeOverride,
      actualMode,
      actualHighContrast,
    });

    if (!tenantId) {
      // tenantId가 없으면 기본 테마 사용
      console.log('[useTheme] No tenantId, resetting theme');
      resetTheme();
      return;
    }

    console.log('[useTheme] Creating theme engine with:', {
      mode: actualMode,
      industry: industryType,
      tenantId,
      industryThemeColors: industryThemeOverride?.colors,
      tenantThemeColors: tenantThemeOverride?.colors,
      highContrast: actualHighContrast,
    });

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
    console.log('[useTheme] Merged tokens:', {
      primary: mergedTokens.colors?.primary,
      secondary: mergedTokens.colors?.secondary,
    });

    // CSS 변수로 적용
    applyThemeToCSS(mergedTokens);

    // 적용 후 CSS 변수 값 확인
    const root = document.documentElement;
    const appliedPrimary = root.style.getPropertyValue('--color-primary');
    const appliedPrimaryLight = root.style.getPropertyValue('--color-primary-light');
    const appliedPrimaryDark = root.style.getPropertyValue('--color-primary-dark');
    console.log('[useTheme] Applied CSS variables:', {
      '--color-primary': appliedPrimary || 'not set (using default)',
      '--color-primary-light': appliedPrimaryLight || 'not set (using default)',
      '--color-primary-dark': appliedPrimaryDark || 'not set (using default)',
    });
  }, [tenantId, industryType, industryThemeOverride, tenantThemeOverride, actualMode, actualHighContrast]);

  return {
    tenantId,
    industryType,
    themeOverride: tenantThemeOverride,
  };
}

