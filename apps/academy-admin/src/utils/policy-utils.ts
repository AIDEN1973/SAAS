/**
 * Policy 조회 유틸리티 (SSOT)
 *
 * [불변 규칙] Policy 조회는 이 파일의 함수를 통해서만 수행
 * [불변 규칙] Fail Closed: Policy가 없으면 null 반환
 *
 * @see docu/프론트 자동화.md - Policy Key v2 (Purpose-Based) — SSOT
 */

// Record 타입은 TypeScript 내장 타입이므로 별도 import 불필요

/**
 * Policy 값 조회 (tenant_settings.config 기반)
 *
 * ⚠️ 주의: 이 함수는 클라이언트 측에서만 사용 가능합니다.
 * 서버/Edge Function에서는 infra/supabase/functions/_shared/policy-utils.ts의 getTenantSettingByPath를 사용하세요.
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

  // 프로토타입 체인 탐색 방지: hasOwnProperty 사용
  // ⚠️ 일관성 참고: 서버/Edge Function의 getTenantSettingByPath와 동일한 로직을 사용하되,
  // 클라이언트에서는 hasOwnProperty를 사용하여 프로토타입 체인 탐색을 방지합니다.
  // 서버에서는 `key in current`를 사용하지만, 클라이언트에서는 보안을 위해 hasOwnProperty를 사용합니다.
  const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

  // 경로 추출 (점(.)으로 분리)
  // ⚠️ 일관성: 서버/Edge Function의 getTenantSettingByPath와 동일한 알고리즘
  // 1. 경로를 점(.)으로 분리
  // 2. 각 키를 순차적으로 탐색
  // 3. 중간 경로가 없으면 null 반환 (Fail Closed)
  const keys = path.split('.');
  let current: unknown = config;

  for (const key of keys) {
    // ⚠️ 일관성: Array 체크는 클라이언트에서만 수행 (서버에서는 불필요하지만 안전을 위해 추가)
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

