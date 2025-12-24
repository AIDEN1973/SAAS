/**
 * Emergency Cards Policy 상수
 *
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 * [문서 준수] docu/프론트 자동화.md, docu/AI_자동화_기능_정리.md 엄격 준수
 *
 * ⚠️ 중요: 이 상수들은 Default Policy이며, 실제 값은 tenant_settings에서 조회해야 합니다.
 * Policy가 없으면 Emergency Card를 표시하지 않습니다 (Fail Closed).
 */

/**
 * Emergency Cards Policy 경로 정의
 */
export const EMERGENCY_CARDS_POLICY_PATHS = {
  /** 결제 실패 임계값 (건수) */
  PAYMENT_FAILED_THRESHOLD: 'auto_notification.recurring_payment_failed.threshold',
  /** 출결 오류 시간 임계값 (분) */
  ATTENDANCE_ERROR_MINUTES: 'auto_notification.checkout_missing_alert.grace_period_minutes',
  /** AI 위험 점수 임계값 */
  AI_RISK_SCORE_THRESHOLD: 'auto_notification.attendance_pattern_anomaly.priority',
  /** 수납률 임계값 (퍼센트) */
  COLLECTION_RATE_THRESHOLD: 'auto_notification.collection_rate_drop.threshold',
  /** 출석 이상 패턴 - 결석 임계값 (건수) */
  ATTENDANCE_ANOMALY_ABSENT_THRESHOLD: 'auto_notification.attendance_pattern_anomaly.absent_threshold',
  /** 출석 이상 패턴 - 지각 임계값 (건수) */
  ATTENDANCE_ANOMALY_LATE_THRESHOLD: 'auto_notification.attendance_pattern_anomaly.late_threshold',
  /** 출결 오류 Emergency 활성화 여부 */
  ATTENDANCE_ERROR_ENABLED: 'auto_notification.checkout_missing_alert.enabled',
} as const;

/**
 * Default Policy 값 (테넌트 생성 시 설정값으로 저장됨)
 * ⚠️ 중요: 이 값들은 코드 상수가 아니라 Default Policy입니다.
 * 실제 운영 시 tenant_settings에서 조회해야 하며, 없으면 Fail Closed로 처리합니다.
 */
export const EMERGENCY_CARDS_DEFAULT_POLICY = {
  /** 결제 실패 임계값 (건수) - Default: 2 */
  PAYMENT_FAILED_THRESHOLD: 2,
  /** 출결 오류 시간 임계값 (분) - Default: 10 */
  ATTENDANCE_ERROR_MINUTES: 10,
  /** AI 위험 점수 임계값 - Default: 90 */
  AI_RISK_SCORE_THRESHOLD: 90,
  /** 수납률 임계값 (퍼센트) - Default: 90 */
  COLLECTION_RATE_THRESHOLD: 90,
  /** 출석 이상 패턴 - 결석 임계값 (건수) - Default: 5 */
  ATTENDANCE_ANOMALY_ABSENT_THRESHOLD: 5,
  /** 출석 이상 패턴 - 지각 임계값 (건수) - Default: 10 */
  ATTENDANCE_ANOMALY_LATE_THRESHOLD: 10,
} as const;

