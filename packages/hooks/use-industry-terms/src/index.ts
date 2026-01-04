/**
 * useIndustryTerms Hook
 *
 * 현재 테넌트의 업종별 용어를 조회하는 Hook
 *
 * [불변 규칙] Industry Registry를 통해서만 용어 접근
 * [불변 규칙] tenantId는 Context에서 자동으로 가져옴 (Zero-Trust)
 *
 * @example
 * ```typescript
 * import { useIndustryTerms } from '@hooks/use-industry-terms';
 *
 * function MyComponent() {
 *   const terms = useIndustryTerms();
 *
 *   return <div>{terms.PERSON_LABEL_PRIMARY} 목록</div>;  // "학생 목록"
 * }
 * ```
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiContext } from '@api-sdk/core';
import { createClient } from '@lib/supabase-client';
import { getIndustryTerms, DEFAULT_TERMS, type IndustryTerms } from '@industry/registry';

/**
 * Tenant의 industry_type 조회 함수
 *
 * @param tenantId 테넌트 ID
 * @returns industry_type 문자열 또는 null
 */
async function fetchTenantIndustryType(tenantId: string): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('industry_type')
    .eq('id', tenantId)
    .single();

  if (error) {
    console.error('[useIndustryTerms] Failed to fetch industry_type:', error);
    return null;
  }

  return data?.industry_type || null;
}

/**
 * 업종별 용어 조회 Hook
 *
 * Context에서 tenantId를 자동으로 가져와서 해당 테넌트의 industry_type에 맞는 용어를 반환합니다.
 *
 * [불변 규칙] Zero-Trust: tenantId는 getApiContext()에서만 추출
 *
 * @returns IndustryTerms 객체
 *
 * @example
 * ```typescript
 * const terms = useIndustryTerms();
 * console.log(terms.PERSON_LABEL_PRIMARY);  // "학생" (academy) 또는 "회원" (fitness)
 * console.log(terms.STATS_TOTAL_COUNT_TITLE);  // "총 학생 수" 또는 "총 회원 수"
 * ```
 */
export function useIndustryTerms(): IndustryTerms {
  // Zero-Trust: Context에서 tenantId 추출
  const tenantId = useMemo(() => {
    try {
      return getApiContext().tenantId ?? null;
    } catch (error) {
      console.error('[useIndustryTerms] Failed to get tenantId from context:', error);
      return null;
    }
  }, []);

  // industry_type 조회
  const { data: industryType } = useQuery({
    queryKey: ['tenant-industry-type', tenantId],
    queryFn: () => {
      if (!tenantId) {
        return Promise.resolve(null);
      }
      return fetchTenantIndustryType(tenantId);
    },
    enabled: !!tenantId,
    staleTime: Infinity, // industry_type은 변경되지 않음
    gcTime: Infinity,
  });

  // 용어 반환 (industryType이 없으면 기본값 사용)
  return useMemo(() => {
    if (!industryType) {
      return DEFAULT_TERMS;
    }
    return getIndustryTerms(industryType);
  }, [industryType]);
}

/**
 * 업종 타입을 직접 지정하여 용어를 조회하는 Hook (테스트/스토리북용)
 *
 * @param industryType 업종 타입 ('academy', 'fitness', 'music')
 * @returns IndustryTerms 객체
 *
 * @example
 * ```typescript
 * // 스토리북에서 사용
 * const terms = useIndustryTermsWithType('fitness');
 * console.log(terms.PERSON_LABEL_PRIMARY);  // "회원"
 * ```
 */
export function useIndustryTermsWithType(industryType: string): IndustryTerms {
  return useMemo(() => getIndustryTerms(industryType), [industryType]);
}

/**
 * Re-export types and utilities
 */
export type { IndustryTerms } from '@industry/registry';
export { getIndustryTerms, isValidIndustryType, SUPPORTED_INDUSTRY_TYPES } from '@industry/registry';
