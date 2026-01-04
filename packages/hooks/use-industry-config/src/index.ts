/**
 * useIndustryConfig Hook
 *
 * [불변 규칙] 업종 설정 접근 편의 Hook
 * [불변 규칙] Industry Registry의 VISIBLE_PAGES, ROUTES 등을 쉽게 사용
 *
 * 사용 예시:
 * ```typescript
 * const { isPageVisible, getRoutePath, visiblePages } = useIndustryConfig();
 *
 * if (isPageVisible('attendance')) {
 *   // 출석 관리 페이지 표시
 * }
 *
 * const attendancePath = getRoutePath('PRIMARY_LIST');
 * ```
 */

import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { VisiblePages } from '@industry/registry';

/**
 * 업종 설정 Hook
 *
 * useIndustryTerms의 편의 Wrapper로, 자주 사용하는 기능을 간단하게 접근
 */
export function useIndustryConfig() {
  const terms = useIndustryTerms();

  /**
   * 특정 페이지가 현재 업종에서 보이는지 확인
   *
   * @param page 확인할 페이지 키
   * @returns 페이지가 보이면 true, 아니면 false
   *
   * @example
   * ```typescript
   * const { isPageVisible } = useIndustryConfig();
   *
   * if (isPageVisible('attendance')) {
   *   // Academy, Gym은 true, Salon은 false
   * }
   * ```
   */
  const isPageVisible = (page: keyof VisiblePages): boolean => {
    return terms.VISIBLE_PAGES[page] ?? false;
  };

  /**
   * 업종별 라우트 경로 조회
   *
   * @param route 조회할 라우트 키
   * @returns 라우트 경로 (없으면 undefined)
   *
   * @example
   * ```typescript
   * const { getRoutePath } = useIndustryConfig();
   *
   * const primaryList = getRoutePath('PRIMARY_LIST');
   * // Academy: '/students/list'
   * // Salon: '/customers/list'
   * // Real Estate: '/clients/list'
   * ```
   */
  const getRoutePath = (route: keyof typeof terms.ROUTES): string | undefined => {
    return terms.ROUTES[route];
  };

  /**
   * 여러 페이지 중 하나라도 보이는지 확인 (OR 조건)
   *
   * @param pages 확인할 페이지 키 배열
   * @returns 하나라도 보이면 true
   *
   * @example
   * ```typescript
   * const { isAnyPageVisible } = useIndustryConfig();
   *
   * if (isAnyPageVisible(['classes', 'appointments'])) {
   *   // 수업 관리 또는 예약 관리 중 하나라도 보이면
   * }
   * ```
   */
  const isAnyPageVisible = (pages: (keyof VisiblePages)[]): boolean => {
    return pages.some((page) => terms.VISIBLE_PAGES[page]);
  };

  /**
   * 모든 페이지가 보이는지 확인 (AND 조건)
   *
   * @param pages 확인할 페이지 키 배열
   * @returns 모두 보이면 true
   *
   * @example
   * ```typescript
   * const { areAllPagesVisible } = useIndustryConfig();
   *
   * if (areAllPagesVisible(['classes', 'billing'])) {
   *   // 수업 관리 AND 수납 관리 모두 보이면
   * }
   * ```
   */
  const areAllPagesVisible = (pages: (keyof VisiblePages)[]): boolean => {
    return pages.every((page) => terms.VISIBLE_PAGES[page]);
  };

  /**
   * 현재 업종의 가시성 설정 전체 조회
   */
  const visiblePages = terms.VISIBLE_PAGES;

  /**
   * 현재 업종의 라우트 설정 전체 조회
   */
  const routes = terms.ROUTES;

  /**
   * 현재 업종의 모든 용어 설정
   */
  const allTerms = terms;

  return {
    // 용어
    terms: allTerms,

    // 페이지 가시성
    visiblePages,
    isPageVisible,
    isAnyPageVisible,
    areAllPagesVisible,

    // 라우팅
    routes,
    getRoutePath,
  };
}

/**
 * Backward compatibility: default export
 */
export default useIndustryConfig;
