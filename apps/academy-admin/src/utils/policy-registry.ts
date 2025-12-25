/**
 * Policy Registry (SSOT)
 *
 * [불변 규칙] 모든 Policy 경로와 소스는 이 파일에서만 정의
 * [불변 규칙] Policy 소스 이원화 문제 해결: 단일 소스로 통일
 *
 * @see docu/프론트 자동화.md - Policy Key v2 (Purpose-Based) — SSOT
 */

import { getPolicyValueFromConfig } from './policy-utils';

/**
 * Policy 소스 타입
 */
export type PolicySource = 'config' | 'path';

/**
 * Policy 정의 인터페이스
 */
export interface PolicyDefinition {
  /** Policy 경로 (점으로 구분) */
  path: string;
  /** Policy 소스 (config: tenant_settings.config, path: useTenantSettingByPath) */
  source: PolicySource;
  /** Policy 타입 */
  type: 'number' | 'boolean' | 'string' | 'object';
  /** 기본값 (Policy가 없을 때 사용, Fail Closed인 경우 null) */
  defaultValue: number | boolean | string | Record<string, unknown> | null;
  /** 설명 */
  description: string;
}

/**
 * Policy 경로 검증 함수 (점(.) 이스케이프 규칙)
 *
 * [P1-ARCH-2 수정] Policy 경로 점(.) 이스케이프 규칙 검증
 * - 현재 구현은 단순 split('.')을 사용하므로 경로 키에 점(.)이 포함되면 파싱 오류 발생
 * - Policy 경로 키에는 점(.) 사용 금지 (운영 규칙)
 * - 이 함수는 Policy Registry에 등록 시 경로를 검증하여 운영 실수 방지
 *
 * ⚠️ 운영 규칙: Policy 경로 키에는 점(.) 사용 금지
 * - 예: "auto_notification.payment_due_reminder.days_before_first" ✅ (정상)
 * - 예: "auto_notification.payment.due.reminder" ❌ (키에 점 포함, 금지)
 *
 * @param path 검증할 Policy 경로
 * @returns 경로가 유효하면 true, 아니면 false
 *
 * @example
 * ```typescript
 * // Policy Registry에 등록 시 검증
 * if (import.meta.env.DEV && !validatePolicyPath('auto_notification.payment_due_reminder.enabled')) {
 *   console.warn('Policy path contains invalid characters');
 * }
 * ```
 */
export function validatePolicyPath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0) {
    return false;
  }

  // 경로를 점(.)으로 분리하여 각 키 검증
  const keys = path.split('.');

  // 각 키에 점(.)이 포함되어 있는지 확인
  // (split 후에도 점이 남아있다면 키 자체에 점이 포함된 것)
  for (const key of keys) {
    if (key.length === 0) {
      // 빈 키는 유효하지 않음 (예: "a..b")
      if (import.meta.env.DEV) {
        console.warn(`[Policy Registry] Policy path contains empty key: "${path}"`);
      }
      return false;
    }
    // 키에 점이 포함되어 있으면 유효하지 않음 (이스케이프 규칙 없음)
    // 참고: 현재 구현은 이스케이프 규칙을 지원하지 않으므로 점 포함 시 오류
    if (key.includes('.')) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Policy Registry] Policy path key contains dot (.) which is not supported: "${path}". ` +
          `Please use underscore (_) or camelCase instead. ` +
          `Example: "auto_notification.payment_due_reminder.enabled" instead of "auto_notification.payment.due.reminder.enabled"`
        );
      }
      return false;
    }
  }

  return true;
}

/**
 * Policy Registry (SSOT)
 *
 * 모든 Policy는 이 레지스트리에 등록되어야 합니다.
 * 새로운 Policy 추가 시 이 레지스트리에 먼저 추가하세요.
 *
 * ⚠️ SSOT 원칙: 모든 Policy 경로는 이 레지스트리를 통해야 합니다.
 * 하드코딩된 경로 사용을 금지하며, 반드시 POLICY_REGISTRY를 통해 접근해야 합니다.
 *
 * [P1-ARCH-1 수정] Policy 소스 이원화 명확화:
 * - config 기반: tenant_settings.config JSONB에서 조회 (대부분의 Policy)
 * - path 기반: useTenantSettingByPath Hook으로 조회 (AI_RISK_SCORE_THRESHOLD만 예외)
 * - 사용 방법:
 *   * config 기반: getPolicyValue(key, config) 사용
 *   * path 기반: useTenantSettingByPath(POLICY_REGISTRY[key].path) + getPolicyValueWithPath(key, config, pathValue) 사용
 * - 향후 통일 계획: 모든 Policy를 config 기반으로 통일 예정 (마이그레이션 가이드 참조)
 *
 * [P1-ARCH-2 수정] Policy 경로 점(.) 이스케이프 규칙:
 * - ⚠️ 운영 규칙: Policy 경로 키에는 점(.) 사용 금지
 * - 현재 구현은 단순 split('.')을 사용하므로 키에 점이 포함되면 파싱 오류 발생
 * - Policy Registry 초기화 시 validatePolicyPath()로 자동 검증
 * - 예: "auto_notification.payment_due_reminder.enabled" ✅ (정상)
 * - 예: "auto_notification.payment.due.reminder" ❌ (키에 점 포함, 금지)
 *
 * 사용 방법:
 * - getPolicyValue(key, config): config 기반 Policy 조회
 * - getPolicyValueWithPath(key, config, pathValue): path 기반 Policy 조회
 * - POLICY_REGISTRY[key].path: Policy 경로 참조
 */
export const POLICY_REGISTRY: Record<string, PolicyDefinition> = {
  // Emergency Cards Policies
  PAYMENT_FAILED_THRESHOLD: {
    path: 'auto_notification.recurring_payment_failed.threshold',
    source: 'config',
    type: 'number',
    defaultValue: 2,
    description: '결제 실패 임계값 (건수)',
  },
  PAYMENT_FAILED_LOOKBACK_DAYS: {
    path: 'auto_notification.recurring_payment_failed.lookback_days',
    source: 'config',
    type: 'number',
    defaultValue: 7,
    description: '결제 실패 조회 기간 (일수)',
  },
  ATTENDANCE_ERROR_MINUTES: {
    path: 'auto_notification.checkout_missing_alert.grace_period_minutes',
    source: 'config',
    type: 'number',
    defaultValue: 10,
    description: '출결 오류 시간 임계값 (분)',
  },
  ATTENDANCE_ERROR_ENABLED: {
    path: 'auto_notification.checkout_missing_alert.enabled',
    source: 'config',
    type: 'boolean',
    defaultValue: false,
    description: '출결 오류 Emergency 활성화 여부',
  },
  AI_RISK_SCORE_THRESHOLD: {
    path: 'auto_notification.attendance_pattern_anomaly.priority',
    source: 'path', // [P1-ARCH-1] 현재는 path 기반이지만, 향후 통일 시 config로 변경 예정
    // 마이그레이션 계획:
    // 1. tenant_settings.config에 해당 경로 추가
    // 2. source를 'config'로 변경
    // 3. useTenantSettingByPath 대신 getPolicyValue 사용
    type: 'number',
    defaultValue: 90,
    description: 'AI 위험 점수 임계값',
  },
  COLLECTION_RATE_THRESHOLD: {
    path: 'auto_notification.collection_rate_drop.threshold',
    source: 'config',
    type: 'number',
    defaultValue: 90,
    description: '수납률 임계값 (퍼센트)',
  },
  ATTENDANCE_ANOMALY_ABSENT_THRESHOLD: {
    path: 'auto_notification.attendance_pattern_anomaly.absent_threshold',
    source: 'config',
    type: 'number',
    defaultValue: 5,
    description: '출석 이상 패턴 - 결석 임계값 (건수)',
  },
  ATTENDANCE_ANOMALY_LATE_THRESHOLD: {
    path: 'auto_notification.attendance_pattern_anomaly.late_threshold',
    source: 'config',
    type: 'number',
    defaultValue: 10,
    description: '출석 이상 패턴 - 지각 임계값 (건수)',
  },
} as const;

/**
 * Policy Registry 초기화 시 경로 검증 (개발 환경에서만)
 * [P1-ARCH-2 수정] Policy 경로 점(.) 이스케이프 규칙 검증
 */
if (import.meta.env.DEV) {
  for (const [key, policy] of Object.entries(POLICY_REGISTRY)) {
    if (!validatePolicyPath(policy.path)) {
      console.error(
        `[Policy Registry] Invalid policy path for "${key}": "${policy.path}". ` +
        `Policy path keys must not contain dots (.). Please use underscore (_) or camelCase instead.`
      );
    }
  }
}

/**
 * Policy 키 타입 (타입 안전성)
 */
export type PolicyKey = keyof typeof POLICY_REGISTRY;

/**
 * Policy 키 검증 assert 함수 (Fail-Closed)
 *
 * ⚠️ SSOT 원칙: 등록되지 않은 Policy 키 사용 시 즉시 오류 발생
 * 개발 환경에서만 검증하는 것을 권장합니다 (프로덕션 성능 영향 최소화).
 *
 * @param key 검증할 Policy 키
 * @throws Error key가 유효한 PolicyKey가 아닌 경우
 *
 * @example
 * ```typescript
 * // 개발 환경에서만 검증 (프로덕션 성능 영향 최소화)
 * if (import.meta.env.DEV) {
 *   assertPolicyKey('PAYMENT_FAILED_THRESHOLD');
 * }
 * ```
 */
export function assertPolicyKey(key: string): asserts key is PolicyKey {
  if (!(key in POLICY_REGISTRY)) {
    const availableKeys = Object.keys(POLICY_REGISTRY).join(', ');
    throw new Error(
      `Policy key "${key}" is not registered in POLICY_REGISTRY. ` +
      `Please add it to apps/academy-admin/src/utils/policy-registry.ts before using. ` +
      `Available keys: ${availableKeys}`
    );
  }
}

/**
 * Policy 값 타입 검증 (공통 함수)
 *
 * @param value 검증할 값
 * @param expectedType 기대하는 타입 ('number' | 'boolean' | 'string' | 'object')
 * @param policyKey Policy 키 (로깅용)
 * @returns 타입이 일치하면 true, 아니면 false
 */
function validatePolicyType(
  value: unknown,
  expectedType: 'number' | 'boolean' | 'string' | 'object',
  policyKey: string
): boolean {
  if (expectedType === 'number' && typeof value !== 'number') {
    if (import.meta.env.DEV) {
      console.warn(`[Policy Registry] Policy "${policyKey}" expected number but got ${typeof value}`);
    }
    return false;
  }
  if (expectedType === 'boolean' && typeof value !== 'boolean') {
    if (import.meta.env.DEV) {
      console.warn(`[Policy Registry] Policy "${policyKey}" expected boolean but got ${typeof value}`);
    }
    return false;
  }
  if (expectedType === 'string' && typeof value !== 'string') {
    if (import.meta.env.DEV) {
      console.warn(`[Policy Registry] Policy "${policyKey}" expected string but got ${typeof value}`);
    }
    return false;
  }
  if (expectedType === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    if (import.meta.env.DEV) {
      console.warn(`[Policy Registry] Policy "${policyKey}" expected object but got ${typeof value}`);
    }
    return false;
  }
  return true;
}

/**
 * Policy 조회 함수 (SSOT) - config 기반 전용
 *
 * Policy Registry를 기반으로 tenant_settings.config에서 값을 조회합니다.
 *
 * ⚠️ 주의: 이 함수는 config 기반 Policy만 조회합니다.
 * path 기반 Policy는 getPolicyValueWithPath 함수를 사용하세요.
 *
 * @param key Policy 키
 * @param config tenant_settings.config JSONB 객체
 * @returns Policy 값 또는 기본값
 */
export function getPolicyValue<T = unknown>(
  key: PolicyKey,
  config?: Record<string, unknown> | null
): T | null {
  // 개발 환경에서만 assert 검증 (프로덕션 성능 영향 최소화)
  if (import.meta.env.DEV) {
    assertPolicyKey(key);
  }

  const policy = POLICY_REGISTRY[key];
  if (!policy) {
    // 개발 환경에서만 경고 (운영 환경 로그 노이즈 방지)
    if (import.meta.env.DEV) {
      console.warn(`[Policy Registry] Policy key "${key}" not found in registry`);
    }
    return null;
  }

  if (policy.source !== 'config') {
    // 개발 환경에서만 경고 (운영 환경 로그 노이즈 방지)
    if (import.meta.env.DEV) {
      console.warn(`[Policy Registry] Policy "${key}" uses 'path' source, use getPolicyValueWithPath instead`);
    }
    return policy.defaultValue as T | null;
  }

  let value: unknown = null;

  if (config) {
    value = getPolicyValueFromConfig<T>(config, policy.path);
  }

  // Fail Closed: 값이 없으면 기본값 반환 (기본값이 null이면 null 반환)
  if (value === null || value === undefined) {
    return policy.defaultValue as T | null;
  }

  // 타입 검증 (공통 함수 사용)
  if (!validatePolicyType(value, policy.type, key)) {
    return policy.defaultValue as T | null;
  }

  return value as T;
}

/**
 * Policy 조회 함수 (path 기반 지원) (SSOT) - config/path 모두 지원
 *
 * Policy Registry를 기반으로 적절한 소스(config 또는 path)에서 값을 조회합니다.
 * config 기반과 path 기반 Policy를 모두 지원합니다.
 *
 * ⚠️ 타입 안전성 강화:
 * - policy.source === 'path'일 때는 pathValue가 필수입니다.
 * - pathValue가 없으면 기본값을 반환 (Fail Closed).
 * - 함수 오버로드를 통해 타입 안전성을 보장합니다.
 *
 * @param key Policy 키
 * @param config tenant_settings.config JSONB 객체 (source가 'config'인 경우 필요)
 * @param pathValue useTenantSettingByPath Hook의 data (source가 'path'인 경우 필수)
 * @returns Policy 값 또는 기본값
 *
 * @example
 * ```typescript
 * import { getPolicyValue, getPolicyValueWithPath, POLICY_REGISTRY } from '../utils/policy-registry';
 * import { useConfig } from '@hooks/use-config';
 * import { useTenantSettingByPath } from '@hooks/use-config';
 *
 * function MyComponent() {
 *   const { data: config } = useConfig();
 *   const { data: aiRiskScore } = useTenantSettingByPath(POLICY_REGISTRY.AI_RISK_SCORE_THRESHOLD.path);
 *
 *   // config 기반
 *   const threshold = getPolicyValue<number>('PAYMENT_FAILED_THRESHOLD', config);
 *
 *   // path 기반 (pathValue 필수)
 *   const aiRiskThreshold = getPolicyValueWithPath<number>('AI_RISK_SCORE_THRESHOLD', config, aiRiskScore);
 * }
 * ```
 */
export function getPolicyValueWithPath<T = unknown>(
  key: PolicyKey,
  config?: Record<string, unknown> | null,
  pathValue?: unknown
): T | null {
  // 개발 환경에서만 assert 검증 (프로덕션 성능 영향 최소화)
  if (import.meta.env.DEV) {
    assertPolicyKey(key);
  }

  const policy = POLICY_REGISTRY[key];
  if (!policy) {
    // 개발 환경에서만 경고 (운영 환경 로그 노이즈 방지)
    if (import.meta.env.DEV) {
      console.warn(`[Policy Registry] Policy key "${key}" not found in registry`);
    }
    return null;
  }

  if (policy.source === 'path') {
    // path 기반은 pathValue를 직접 전달받아야 함 (useTenantSettingByPath Hook 호출은 컴포넌트에서)
    // ⚠️ 타입 안전성: pathValue가 없으면 기본값 반환 (Fail Closed)
    const value = pathValue;
    if (value === null || value === undefined) {
      return policy.defaultValue as T | null;
    }

    // 타입 검증 (공통 함수 사용)
    if (!validatePolicyType(value, policy.type, key)) {
      return policy.defaultValue as T | null;
    }

    return value as T;
  }

  // config 기반
  return getPolicyValue<T>(key, config);
}

/**
 * 동적 Policy 경로 생성 헬퍼 함수 (SSOT)
 *
 * ⚠️ SSOT 원칙: 동적 경로(`auto_notification.${eventType}.${field}`)도 이 헬퍼 함수를 통해 생성해야 합니다.
 * 하드코딩된 문자열 템플릿 리터럴 대신 이 함수를 사용하세요.
 *
 * @param eventType Automation Event Type
 * @param field Policy 필드명 (예: 'enabled', 'channel', 'threshold')
 * @param nestedPath 중첩 경로 (선택적, 예: 'throttle.daily_limit')
 * @returns Policy 경로 문자열
 *
 * @example
 * ```typescript
 * // ❌ 잘못된 방법: 하드코딩된 문자열
 * const path = `auto_notification.${eventType}.enabled`;
 *
 * // ✅ 올바른 방법: 헬퍼 함수 사용
 * const path = getAutomationEventPolicyPath(eventType, 'enabled');
 *
 * // ✅ 중첩 경로 지원
 * const nestedPath = getAutomationEventPolicyPath(eventType, 'throttle_daily_limit', 'throttle.daily_limit');
 * ```
 */
export function getAutomationEventPolicyPath(eventType: string, field: string, nestedPath?: string): string {
  if (nestedPath) {
    return `auto_notification.${eventType}.${nestedPath}`;
  }
  return `auto_notification.${eventType}.${field}`;
}

/**
 * Policy 소스 통일 가이드
 *
 * ⚠️ 현재 Policy 소스가 이원화되어 있습니다:
 * - config: tenant_settings.config JSONB 기반 (대부분의 Policy)
 * - path: useTenantSettingByPath 기반 (AI_RISK_SCORE_THRESHOLD만 예외)
 *
 * 🔄 마이그레이션 계획:
 *
 * **옵션 1: 모든 정책을 config로 통일 (권장)**
 * 1. AI_RISK_SCORE_THRESHOLD의 source를 'config'로 변경
 * 2. tenant_settings.config에 'auto_notification.attendance_pattern_anomaly.priority' 경로 추가
 * 3. useTenantSettingByPath 대신 getPolicyValueFromConfig 사용
 * 4. 기존 path 기반 값이 있으면 config로 마이그레이션 스크립트 실행
 *
 * **옵션 2: 모든 정책을 path로 통일 (비권장)**
 * - 모든 Policy를 useTenantSettingByPath로 조회하도록 변경
 * - 단점: React Hook 의존성 증가, 서버/Edge Function에서 사용 불가
 *
 * **현재 상태:**
 * - AI_RISK_SCORE_THRESHOLD만 path 기반 (source: 'path')
 * - 나머지 모든 Policy는 config 기반 (source: 'config')
 * - getPolicyValueWithPath() 함수로 두 방식 모두 지원
 *
 * **마이그레이션 우선순위:**
 * - P0: AI_RISK_SCORE_THRESHOLD를 config로 통일 (옵션 1 권장)
 * - P1: 모든 Policy Registry 항목의 source 일관성 검증
 * - P2: 마이그레이션 스크립트 작성 및 실행
 */

