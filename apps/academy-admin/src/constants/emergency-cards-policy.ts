/**
 * Emergency Cards Policy 상수 (SSOT)
 *
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 * [문서 준수] docu/프론트 자동화.md, docu/AI_자동화_기능_정리.md 엄격 준수
 *
 * ⚠️ SSOT 원칙: 이 파일은 POLICY_REGISTRY를 기반으로 재정의합니다.
 * 하드코딩된 경로 대신 POLICY_REGISTRY를 통해 접근해야 합니다.
 *
 * ⚠️ 중요: 이 상수들은 Default Policy이며, 실제 값은 tenant_settings에서 조회해야 합니다.
 * Policy가 없으면 Emergency Card를 표시하지 않습니다 (Fail Closed).
 */

// [P0 수정] 순환 참조 방지: utils/index.ts 대신 policy-registry.ts에서 직접 import
// utils/index.ts는 dashboardCardUtils.ts를 export하는데, dashboardCardUtils.ts가 constants를 import하여 순환 참조 발생
import { POLICY_REGISTRY } from '../utils/policy-registry';

/**
 * Emergency Cards Policy 경로 정의 (SSOT)
 *
 * ⚠️ SSOT 원칙: POLICY_REGISTRY에서 경로를 가져옵니다.
 * 하드코딩된 경로 대신 POLICY_REGISTRY를 직접 사용하는 것을 권장합니다.
 *
 * @deprecated 신규 코드에서는 POLICY_REGISTRY를 직접 사용하세요.
 * 이 상수는 하위 호환성을 위해 유지되며, 향후 제거될 수 있습니다.
 * 마이그레이션: `EMERGENCY_CARDS_POLICY_PATHS.PAYMENT_FAILED_THRESHOLD` → `POLICY_REGISTRY.PAYMENT_FAILED_THRESHOLD.path`
 */
export const EMERGENCY_CARDS_POLICY_PATHS = {
  /** 결제 실패 임계값 (건수) */
  PAYMENT_FAILED_THRESHOLD: POLICY_REGISTRY.PAYMENT_FAILED_THRESHOLD.path,
  /** 출결 오류 시간 임계값 (분) */
  ATTENDANCE_ERROR_MINUTES: POLICY_REGISTRY.ATTENDANCE_ERROR_MINUTES.path,
  /** AI 위험 점수 임계값 */
  AI_RISK_SCORE_THRESHOLD: POLICY_REGISTRY.AI_RISK_SCORE_THRESHOLD.path,
  /** 수납률 임계값 (퍼센트) */
  COLLECTION_RATE_THRESHOLD: POLICY_REGISTRY.COLLECTION_RATE_THRESHOLD.path,
  /** 출석 이상 패턴 - 결석 임계값 (건수) */
  ATTENDANCE_ANOMALY_ABSENT_THRESHOLD: POLICY_REGISTRY.ATTENDANCE_ANOMALY_ABSENT_THRESHOLD.path,
  /** 출석 이상 패턴 - 지각 임계값 (건수) */
  ATTENDANCE_ANOMALY_LATE_THRESHOLD: POLICY_REGISTRY.ATTENDANCE_ANOMALY_LATE_THRESHOLD.path,
  /** 출결 오류 Emergency 활성화 여부 */
  ATTENDANCE_ERROR_ENABLED: POLICY_REGISTRY.ATTENDANCE_ERROR_ENABLED.path,
  /** 결제 실패 조회 기간 (일수) - 최근 N일간의 실패만 조회 */
  PAYMENT_FAILED_LOOKBACK_DAYS: POLICY_REGISTRY.PAYMENT_FAILED_LOOKBACK_DAYS.path,
} as const;

/**
 * Default Policy 값 (테넌트 생성 시 설정값으로 저장됨)
 *
 * ⚠️ SSOT 원칙: POLICY_REGISTRY에서 기본값을 가져옵니다.
 * ⚠️ 중요: 이 값들은 코드 상수가 아니라 Default Policy입니다.
 * 실제 운영 시 tenant_settings에서 조회해야 하며, 없으면 Fail Closed로 처리합니다.
 */
export const EMERGENCY_CARDS_DEFAULT_POLICY = {
  /** 결제 실패 임계값 (건수) - Default: 2 */
  PAYMENT_FAILED_THRESHOLD: POLICY_REGISTRY.PAYMENT_FAILED_THRESHOLD.defaultValue as number,
  /** 출결 오류 시간 임계값 (분) - Default: 10 */
  ATTENDANCE_ERROR_MINUTES: POLICY_REGISTRY.ATTENDANCE_ERROR_MINUTES.defaultValue as number,
  /** AI 위험 점수 임계값 - Default: 90 */
  AI_RISK_SCORE_THRESHOLD: POLICY_REGISTRY.AI_RISK_SCORE_THRESHOLD.defaultValue as number,
  /** 수납률 임계값 (퍼센트) - Default: 90 */
  COLLECTION_RATE_THRESHOLD: POLICY_REGISTRY.COLLECTION_RATE_THRESHOLD.defaultValue as number,
  /** 출석 이상 패턴 - 결석 임계값 (건수) - Default: 5 */
  ATTENDANCE_ANOMALY_ABSENT_THRESHOLD: POLICY_REGISTRY.ATTENDANCE_ANOMALY_ABSENT_THRESHOLD.defaultValue as number,
  /** 출석 이상 패턴 - 지각 임계값 (건수) - Default: 10 */
  ATTENDANCE_ANOMALY_LATE_THRESHOLD: POLICY_REGISTRY.ATTENDANCE_ANOMALY_LATE_THRESHOLD.defaultValue as number,
} as const;

