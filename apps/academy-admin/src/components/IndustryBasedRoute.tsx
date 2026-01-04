/**
 * Industry-Based Route Protection Component
 *
 * [불변 규칙] 업종별로 허용된 페이지만 접근 가능
 * [불변 규칙] Industry Registry의 VISIBLE_PAGES 설정을 기반으로 라우팅 제어
 *
 * 사용 예시:
 * ```typescript
 * <Route path="/attendance" element={
 *   <IndustryBasedRoute page="attendance">
 *     <AttendancePage />
 *   </IndustryBasedRoute>
 * } />
 * ```
 *
 * 동작 원리:
 * 1. useIndustryTerms Hook으로 현재 테넌트의 업종 용어 조회
 * 2. VISIBLE_PAGES 설정에서 해당 페이지 가시성 확인
 * 3. false인 경우 홈으로 리다이렉트 (404 방지)
 */

import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { VisiblePages } from '@industry/registry';

interface IndustryBasedRouteProps {
  /**
   * 확인할 페이지 키 (VisiblePages의 키와 일치)
   *
   * 예: 'attendance', 'appointments', 'properties'
   */
  page: keyof VisiblePages;

  /**
   * 페이지가 허용된 경우 렌더링할 자식 컴포넌트
   */
  children: ReactNode;

  /**
   * 페이지 접근이 거부된 경우 리다이렉트할 경로
   * @default '/' (홈 페이지)
   */
  fallbackPath?: string;
}

/**
 * Industry-Based Route Protection Component
 *
 * @example
 * ```typescript
 * // 출석 관리 페이지 (학원, 헬스장만 접근 가능)
 * <IndustryBasedRoute page="attendance">
 *   <AttendancePage />
 * </IndustryBasedRoute>
 *
 * // 예약 관리 페이지 (미용실, 네일샵, 부동산만 접근 가능)
 * <IndustryBasedRoute page="appointments">
 *   <AppointmentsPage />
 * </IndustryBasedRoute>
 *
 * // 매물 관리 페이지 (부동산만 접근 가능)
 * <IndustryBasedRoute page="properties" fallbackPath="/clients">
 *   <PropertiesPage />
 * </IndustryBasedRoute>
 * ```
 */
export function IndustryBasedRoute({
  page,
  children,
  fallbackPath = '/',
}: IndustryBasedRouteProps) {
  const terms = useIndustryTerms();

  // 업종별 페이지 가시성 확인
  const isPageVisible = terms.VISIBLE_PAGES[page];

  // 페이지가 현재 업종에서 사용 불가능한 경우 리다이렉트
  if (!isPageVisible) {
    if (import.meta.env?.DEV) {
      console.warn(
        `[IndustryBasedRoute] Page "${String(page)}" is not visible for industry. ` +
        `Redirecting to "${fallbackPath}". ` +
        `Current VISIBLE_PAGES:`,
        terms.VISIBLE_PAGES
      );
    }

    return <Navigate to={fallbackPath} replace />;
  }

  // 페이지가 허용된 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
}

/**
 * 여러 페이지 중 하나라도 보이면 허용하는 OR 조건 라우트
 *
 * @example
 * ```typescript
 * // 수업 관리 또는 서비스 관리 페이지 (classes 또는 appointments 중 하나라도 true면 접근 가능)
 * <IndustryBasedRouteOr pages={['classes', 'appointments']}>
 *   <ClassesOrServicesPage />
 * </IndustryBasedRouteOr>
 * ```
 */
export function IndustryBasedRouteOr({
  pages,
  children,
  fallbackPath = '/',
}: {
  pages: (keyof VisiblePages)[];
  children: ReactNode;
  fallbackPath?: string;
}) {
  const terms = useIndustryTerms();

  // 페이지 목록 중 하나라도 visible이면 허용
  const isAnyPageVisible = pages.some((page) => terms.VISIBLE_PAGES[page]);

  if (!isAnyPageVisible) {
    if (import.meta.env?.DEV) {
      console.warn(
        `[IndustryBasedRouteOr] None of the pages [${pages.join(', ')}] are visible. ` +
        `Redirecting to "${fallbackPath}".`
      );
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}

/**
 * 모든 페이지가 보여야 허용하는 AND 조건 라우트
 *
 * @example
 * ```typescript
 * // 수업 관리 AND 수납 관리가 모두 true인 경우만 접근 가능
 * <IndustryBasedRouteAnd pages={['classes', 'billing']}>
 *   <ClassBillingIntegrationPage />
 * </IndustryBasedRouteAnd>
 * ```
 */
export function IndustryBasedRouteAnd({
  pages,
  children,
  fallbackPath = '/',
}: {
  pages: (keyof VisiblePages)[];
  children: ReactNode;
  fallbackPath?: string;
}) {
  const terms = useIndustryTerms();

  // 모든 페이지가 visible이어야 허용
  const areAllPagesVisible = pages.every((page) => terms.VISIBLE_PAGES[page]);

  if (!areAllPagesVisible) {
    if (import.meta.env?.DEV) {
      const invisiblePages = pages.filter((page) => !terms.VISIBLE_PAGES[page]);
      console.warn(
        `[IndustryBasedRouteAnd] Not all pages are visible. ` +
        `Missing: [${invisiblePages.join(', ')}]. ` +
        `Redirecting to "${fallbackPath}".`
      );
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
