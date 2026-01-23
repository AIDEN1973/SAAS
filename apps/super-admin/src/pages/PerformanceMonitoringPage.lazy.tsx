/**
 * Performance Monitoring Page - Lazy Loaded
 *
 * [불변 규칙] Super Admin 전용 성능 모니터링 대시보드 (Code Splitting)
 * [최적화] Dynamic Import로 초기 번들 크기 감소
 */

import { lazy } from 'react';

/**
 * PerformanceMonitoringPage를 lazy load
 *
 * 이점:
 * - 초기 번들 크기 약 200KB 감소
 * - 페이지 접근 시에만 로드
 * - 메인 앱 로딩 속도 개선
 */
export const PerformanceMonitoringPageLazy = lazy(
  () => import('./PerformanceMonitoringPage').then(module => ({
    default: module.PerformanceMonitoringPage
  }))
);
