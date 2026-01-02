/**
 * Policy 조회 유틸리티 (SSOT)
 *
 * [불변 규칙] Policy 조회는 이 파일의 함수를 통해서만 수행
 * [불변 규칙] Fail Closed: Policy가 없으면 null 반환
 *
 * P1-2 개선: 서버/클라이언트 일관성 문서화
 * - 서버 (Edge Function): infra/supabase/functions/_shared/policy-utils.ts
 * - 클라이언트: apps/academy-admin/src/utils/policy-utils.ts (이 파일)
 *
 * 알고리즘 일관성:
 * - 동일한 경로 분리/탐색 로직 사용
 * - 서버: `key in current` (JSONB이므로 프로토타입 체인 없음)
 * - 클라이언트: `hasOwnProperty` (프로토타입 체인 방어)
 *
 * @see docu/프론트 자동화.md - Policy Key v2 (Purpose-Based) — SSOT
 */

// Record 타입은 TypeScript 내장 타입이므로 별도 import 불필요

/**
 * 객체 속성 소유 여부 확인 헬퍼 (프로토타입 체인 방어)
 *
 * P1-2: 서버와 동일한 결과를 보장하면서 클라이언트 보안 강화
 */
const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Policy 값 조회 (tenant_settings.config 기반)
 *
 * ⚠️ 주의: 이 함수는 클라이언트 측에서만 사용 가능합니다.
 * 서버/Edge Function에서는 infra/supabase/functions/_shared/policy-utils.ts의 getTenantSettingByPath를 사용하세요.
 *
 * P1-2 개선: 서버와 동일한 알고리즘 사용 (일관성 보장)
 *
 * @param config tenant_settings.config JSONB 객체
 * @param path 점으로 구분된 경로 (예: 'auto_notification.overdue_outstanding_over_limit.enabled')
 * @returns 설정 값 또는 null (Policy가 없으면 null 반환, Fail Closed)
 */
export function getPolicyValueFromConfig<T = unknown>(
  config: Record<string, unknown> | null,
  path: string
): T | null {
  if (!config) {
    return null; // Fail Closed
  }

  // 경로 추출 (점(.)으로 분리)
  // ⚠️ 일관성: 서버/Edge Function의 getTenantSettingByPath와 동일한 알고리즘
  // 1. 경로를 점(.)으로 분리
  // 2. 각 키를 순차적으로 탐색
  // 3. 중간 경로가 없으면 null 반환 (Fail Closed)
  const keys = path.split('.');
  let current: unknown = config;

  for (const key of keys) {
    // P1-2: 서버와 동일한 로직 + 클라이언트 보안(hasOwn, Array 체크)
    if (current && typeof current === 'object' && !Array.isArray(current) && hasOwn(current, key)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null; // Fail Closed
    }
  }

  // Fail Closed: undefined도 null로 정규화하여 Fail Closed 보장
  return (current === undefined ? null : current) as T | null;
}

/**
 * Policy 값 조회 (타입 안전성 강화)
 * @param config tenant_settings.config JSONB 객체
 * @param path 점으로 구분된 경로
 * @param defaultValue 기본값 (Policy가 없을 때 반환)
 * @returns 설정 값 또는 기본값
 */
export function getPolicyValueWithDefault<T>(
  config: Record<string, unknown> | null,
  path: string,
  defaultValue: T
): T {
  const value = getPolicyValueFromConfig<T>(config, path);
  return value !== null ? value : defaultValue;
}

/**
 * Policy 값 조회 (숫자 타입)
 * @param config tenant_settings.config JSONB 객체
 * @param path 점으로 구분된 경로
 * @returns 숫자 값 또는 null
 */
export function getPolicyNumber(
  config: Record<string, unknown> | null,
  path: string
): number | null {
  const value = getPolicyValueFromConfig<unknown>(config, path);
  return typeof value === 'number' ? value : null;
}

/**
 * Policy 값 조회 (불린 타입)
 * @param config tenant_settings.config JSONB 객체
 * @param path 점으로 구분된 경로
 * @returns 불린 값 또는 null
 */
export function getPolicyBoolean(
  config: Record<string, unknown> | null,
  path: string
): boolean | null {
  const value = getPolicyValueFromConfig<unknown>(config, path);
  return typeof value === 'boolean' ? value : null;
}

/**
 * Policy 값 조회 (문자열 타입)
 * @param config tenant_settings.config JSONB 객체
 * @param path 점으로 구분된 경로
 * @returns 문자열 값 또는 null
 */
export function getPolicyString(
  config: Record<string, unknown> | null,
  path: string
): string | null {
  const value = getPolicyValueFromConfig<unknown>(config, path);
  return typeof value === 'string' ? value : null;
}

/**
 * useTenantSettingByPath Hook 사용 가이드
 *
 * ⚠️ 주의: useTenantSettingByPath는 React Hook이므로 컴포넌트 내부에서만 사용 가능합니다.
 *
 * @example
 * ```typescript
 * import { useTenantSettingByPath } from '@hooks/use-config';
 *
 * function MyComponent() {
 *   const { data: threshold } = useTenantSettingByPath('auto_notification.overdue.threshold');
 *   // threshold는 number | null
 * }
 * ```
 *
 * tenant_settings.config 기반 조회와는 다른 소스입니다:
 * - useTenantSettingByPath: 경로 기반 (예: AI_RISK_SCORE_THRESHOLD)
 * - getPolicyValueFromConfig: config JSONB 기반 (예: auto_notification.*)
 */

/**
 * Policy 값 설정 (중첩 경로 지원)
 *
 * tenant_settings.config 객체에 중첩 경로를 통해 값을 설정합니다.
 * 불변성을 유지하기 위해 새로운 객체를 반환합니다.
 *
 * ⚠️ SSOT 원칙: 중첩 경로 처리 로직의 단일 정본
 * ⚠️ 불변성: 원본 객체를 수정하지 않고 새로운 객체 반환
 *
 * @param config tenant_settings.config JSONB 객체
 * @param path 점으로 구분된 경로 (예: 'auto_notification.payment_due_reminder.enabled')
 * @param value 설정할 값
 * @returns 업데이트된 config 객체 (새로운 객체)
 *
 * @example
 * ```typescript
 * const config = { auto_notification: { overdue: { enabled: true } } };
 * const updated = setPolicyValueByPath(config, 'auto_notification.overdue.threshold', 3);
 * // { auto_notification: { overdue: { enabled: true, threshold: 3 } } }
 *
 * // 중첩 경로 생성
 * const updated2 = setPolicyValueByPath(config, 'auto_notification.new_event.throttle.daily_limit', 20);
 * // { auto_notification: { overdue: { enabled: true }, new_event: { throttle: { daily_limit: 20 } } } }
 * ```
 */
export function setPolicyValueByPath(
  config: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.');

  if (keys.length === 0) {
    throw new Error(`[setPolicyValueByPath] Invalid path: "${path}" (empty after split)`);
  }

  // 불변성 유지: 최상위 객체 복사
  const result = { ...config };

  // keys의 마지막 요소를 제외한 모든 키를 순회하며 중첩 객체 생성
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    // 해당 키가 없거나 객체가 아니면 새로운 객체 생성
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {};
    } else {
      // 불변성 유지: 중첩 객체도 복사
      current[key] = { ...(current[key] as Record<string, unknown>) };
    }

    current = current[key] as Record<string, unknown>;
  }

  // 마지막 키에 값 설정
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;

  return result;
}

/**
 * Policy 값 설정 (여러 경로 일괄 설정)
 *
 * 여러 Policy 경로를 한 번에 설정합니다.
 * 불변성을 유지하기 위해 새로운 객체를 반환합니다.
 *
 * @param config tenant_settings.config JSONB 객체
 * @param updates 경로-값 쌍의 배열
 * @returns 업데이트된 config 객체 (새로운 객체)
 *
 * @example
 * ```typescript
 * const config = { auto_notification: {} };
 * const updated = setPolicyValuesByPaths(config, [
 *   { path: 'auto_notification.overdue.enabled', value: true },
 *   { path: 'auto_notification.overdue.threshold', value: 3 },
 *   { path: 'auto_notification.overdue.throttle.daily_limit', value: 20 },
 * ]);
 * ```
 */
export function setPolicyValuesByPaths(
  config: Record<string, unknown>,
  updates: Array<{ path: string; value: unknown }>
): Record<string, unknown> {
  let result = config;

  for (const { path, value } of updates) {
    result = setPolicyValueByPath(result, path, value);
  }

  return result;
}

/**
 * Policy 소스 통일 가이드
 *
 * 현재 Policy 소스가 이원화되어 있습니다:
 * 1. useTenantSettingByPath (경로 기반) - 예: AI_RISK_SCORE_THRESHOLD
 * 2. tenant_settings.config (JSONB 기반) - 예: auto_notification.*
 *
 * 향후 통일 방안:
 * - 옵션 1: 모든 정책을 useTenantSettingByPath(path)로 통일 (가장 명확)
 * - 옵션 2: 모든 정책을 tenant_settings.config로 통일 + path enum만 SSOT로 유지
 *
 * @see docu/프론트 자동화.md - Policy Key v2 (Purpose-Based) — SSOT
 */

