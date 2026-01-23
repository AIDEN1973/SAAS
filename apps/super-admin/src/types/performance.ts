/**
 * Performance Monitoring Types
 *
 * [불변 규칙] 성능 모니터링 관련 공통 타입 정의
 * [SSOT] 모든 성능 모니터링 컴포넌트에서 사용하는 타입의 단일 진실 공급원
 */

/**
 * 성능 모니터링 탭 타입
 * - overview: 개요
 * - realtime: 실시간 모니터링
 * - queries: 쿼리 분석
 * - storage: 스토리지 관리
 * - connections: 연결 상태
 * - security: 보안 모니터링
 * - edge-functions: Edge Function 통계
 * - realtime-monitoring: Realtime 통계
 */
export type TabType =
  | 'overview'
  | 'realtime'
  | 'queries'
  | 'storage'
  | 'connections'
  | 'security'
  | 'edge-functions'
  | 'realtime-monitoring';
