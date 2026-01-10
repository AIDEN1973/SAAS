/**
 * Policy Key v1/v2 혼용 방지 타입 가드 (SSOT)
 *
 * Policy Key v1은 alias-only이며 저장 금지
 * Policy Key v2만 저장 허용
 *
 * @see docu/체크리스트.md (P1-ARCH-2)
 * @see docu/디어쌤_아키텍처.md (정책 해석 일관성)
 */

/**
 * Policy Key v2 (정본, 저장 허용)
 */
export const POLICY_KEYS_V2 = [
  'financial_health',
  'capacity_optimization',
  'customer_retention',
  'growth_marketing',
  'safety_compliance',
  'workforce_ops',
] as const;

export type PolicyKeyV2 = typeof POLICY_KEYS_V2[number];

/**
 * Policy Key v1 (alias-only, 저장 금지)
 */
export const POLICY_KEYS_V1 = [
  'attendance_anomaly',
  'payment_overdue',
  'ai_suggestion',
  'report_generation',
  'dashboard_priority',
] as const;

export type PolicyKeyV1 = typeof POLICY_KEYS_V1[number];

/**
 * 모든 Policy Key (v1 + v2)
 */
export type PolicyKey = PolicyKeyV1 | PolicyKeyV2;

/**
 * 성능 최적화를 위한 Set (O(1) 조회)
 */
const POLICY_KEYS_V2_SET = new Set<string>(POLICY_KEYS_V2);
const POLICY_KEYS_V1_SET = new Set<string>(POLICY_KEYS_V1);

/**
 * v2 Policy Key 여부 확인
 *
 * @param key - Policy Key
 * @returns v2인 경우 true
 */
export function isPolicyKeyV2(key: string): key is PolicyKeyV2 {
  return POLICY_KEYS_V2_SET.has(key);
}

/**
 * v1 Policy Key 여부 확인
 *
 * @param key - Policy Key
 * @returns v1인 경우 true
 */
export function isPolicyKeyV1(key: string): key is PolicyKeyV1 {
  return POLICY_KEYS_V1_SET.has(key);
}

/**
 * v1 → v2 매핑
 *
 * v1 정책 키를 v2 정책 키로 변환
 */
export const POLICY_KEY_V1_TO_V2_MAP: Record<PolicyKeyV1, PolicyKeyV2> = {
  attendance_anomaly: 'safety_compliance',
  payment_overdue: 'financial_health',
  ai_suggestion: 'growth_marketing',
  report_generation: 'workforce_ops',
  dashboard_priority: 'capacity_optimization',
} as const;

/**
 * v1 Policy Key를 v2로 변환
 *
 * @param key - v1 Policy Key
 * @returns v2 Policy Key
 */
export function convertPolicyKeyV1ToV2(key: PolicyKeyV1): PolicyKeyV2 {
  return POLICY_KEY_V1_TO_V2_MAP[key];
}

/**
 * Policy Key 정규화 (v1 → v2 자동 변환)
 *
 * @param key - Policy Key (v1 또는 v2)
 * @returns v2 Policy Key
 * @throws v1/v2 모두 아닌 경우 에러
 */
export function normalizePolicyKey(key: string): PolicyKeyV2 {
  if (isPolicyKeyV2(key)) {
    return key;
  }

  if (isPolicyKeyV1(key)) {
    const v2Key = convertPolicyKeyV1ToV2(key);
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[Policy Key Guard] v1 정책 키 사용 감지: "${key}" → "${v2Key}"로 변환됨. v2 사용 권장.`
      );
    }
    return v2Key;
  }

  throw new Error(
    `Invalid policy key: "${key}". ` +
    `허용되는 정책 키는 v2만 사용 가능합니다: ${POLICY_KEYS_V2.join(', ')}`
  );
}

/**
 * v1 Policy Key 저장 방지 (Fail-Closed)
 *
 * 개발 환경에서만 실행되며, v1 정책 키 저장 시 에러 발생
 *
 * @param key - Policy Key
 * @throws v1 정책 키인 경우 에러
 */
export function assertPolicyKeyV2(key: string): asserts key is PolicyKeyV2 {
  if (isPolicyKeyV1(key)) {
    throw new Error(
      `v1 정책 키 저장 금지: "${key}"\n` +
      `  - v1 정책 키는 alias-only이며 저장할 수 없습니다.\n` +
      `  - v2 정책 키를 사용하세요: ${POLICY_KEY_V1_TO_V2_MAP[key]}\n` +
      `  - 허용되는 v2 정책 키: ${POLICY_KEYS_V2.join(', ')}`
    );
  }

  if (!isPolicyKeyV2(key)) {
    throw new Error(
      `유효하지 않은 정책 키: "${key}"\n` +
      `  - 허용되는 v2 정책 키: ${POLICY_KEYS_V2.join(', ')}`
    );
  }
}

/**
 * Policy Key 유효성 검증 (런타임)
 *
 * @param key - Policy Key
 * @returns 유효한 경우 true
 */
export function isValidPolicyKey(key: string): key is PolicyKey {
  return isPolicyKeyV1(key) || isPolicyKeyV2(key);
}

/**
 * 개발 환경에서만 v1 정책 키 사용 경고
 *
 * @param key - Policy Key
 */
export function warnIfPolicyKeyV1(key: string): void {
  if (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NODE_ENV === 'development'
  ) {
    if (isPolicyKeyV1(key)) {
      console.warn(
        `[Policy Key Guard] v1 정책 키 사용 감지: "${key}"\n` +
        `  - v1 정책 키는 조회용으로만 사용 가능하며 저장할 수 없습니다.\n` +
        `  - v2 정책 키로 마이그레이션 권장: ${POLICY_KEY_V1_TO_V2_MAP[key]}`
      );
    }
  }
}

/**
 * Policy Key 통계
 */
export function getPolicyKeyStats(): {
  v1Count: number;
  v2Count: number;
  total: number;
  v1Keys: readonly PolicyKeyV1[];
  v2Keys: readonly PolicyKeyV2[];
} {
  return {
    v1Count: POLICY_KEYS_V1.length,
    v2Count: POLICY_KEYS_V2.length,
    total: POLICY_KEYS_V1.length + POLICY_KEYS_V2.length,
    v1Keys: POLICY_KEYS_V1,
    v2Keys: POLICY_KEYS_V2,
  };
}
