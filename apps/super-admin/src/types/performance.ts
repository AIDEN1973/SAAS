/**
 * Performance Monitoring Types
 *
 * [불변 규칙] 성능 모니터링 관련 공통 타입 정의
 * [SSOT] 모든 성능 모니터링 컴포넌트에서 사용하는 타입의 단일 진실 공급원
 */

/**
 * 성능 모니터링 탭 타입
 * - overview: 전체 현황
 * - database: 데이터베이스
 * - edge-functions: Edge Functions
 * - storage: 스토리지
 * - realtime: Realtime
 * - auth: 인증
 * - errors: 에러 로그
 * - optimization: 최적화 제안
 *
 * [SSOT] sub-sidebar-menus.ts의 PerformanceSubMenuId와 동기화 필요
 */
export type TabType =
  | 'overview'
  | 'database'
  | 'edge-functions'
  | 'storage'
  | 'realtime'
  | 'auth'
  | 'errors'
  | 'optimization';
