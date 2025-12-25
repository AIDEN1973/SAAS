/**
 * Policy 조회 유틸리티 함수
 *
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
 * [문서 준수] docu/프론트 자동화.md, docu/AI_자동화_기능_정리.md 엄격 준수
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assertAutomationEventType } from './automation-event-catalog.ts';
import { withTenant } from './withTenant.ts';
import { getPlatformAIEnabled } from './env-registry.ts';

/**
 * 테넌트 설정 조회 (tenant_settings 테이블)
 * @param supabase Supabase 클라이언트
 * @param tenantId 테넌트 ID
 * @param key 설정 키 (예: 'config')
 * @returns 설정 값 또는 null (Policy가 없으면 null 반환, Fail Closed)
 */
export async function getTenantSetting(
  supabase: SupabaseClient,
  tenantId: string,
  key: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await withTenant(
    supabase
    .from('tenant_settings')
    .select('value')
      .eq('key', key),
    tenantId
  ).single();

  if (error) {
    if (error.code === 'PGRST116') {
      // 레코드가 없으면 null 반환 (Fail Closed)
      return null;
    }
    console.error(`[Policy Utils] Failed to fetch tenant setting ${key}:`, error);
    return null;
  }

  return (data?.value as Record<string, unknown>) || null;
}

/**
 * 테넌트 설정에서 중첩된 경로의 값 조회 (레거시 경로 fallback 지원)
 *
 * SSOT-1: tenant_settings는 KV 구조이며, config는 컬럼이 아니라 key='config' row의 value(JSONB)입니다.
 * 내부 동작: 1) tenant_settings에서 tenant_id + key='config' row의 value(JSONB) 획득, 2) value(JSONB)에서 경로 추출
 *
 * ⚠️ 레거시 경로 fallback 규칙:
 * - 신규 경로(`auto_notification.<event_type>.<field>`) 우선 조회
 * - 신규 경로가 없으면 레거시 경로 제한적 fallback (기존 값이 있을 때만)
 * - fallback 사용 시 로그 기록 (기존 로그 스키마 내에서만)
 *
 * ⚠️ event_type 검증 (SSOT 강제):
 * - 신규 경로(`path`)가 `auto_notification.<event_type>.*` 형식일 때 자동으로 event_type을 추출하여 검증
 * - 카탈로그에 없는 event_type이면 즉시 에러 발생 (Fail-Closed)
 * - ⚠️ 레거시 경로(`legacyPath`)는 검증하지 않습니다 (마이그레이션 전까지 사용되는 하위 호환 경로)
 *
 * @param supabase Supabase 클라이언트
 * @param tenantId 테넌트 ID
 * @param path 점으로 구분된 경로 (예: 'auto_notification.overdue_outstanding_over_limit.enabled' - 신규 경로)
 * @param legacyPath 레거시 경로 (선택적, 예: 'auto_notification.overdue.enabled')
 * @returns 설정 값 또는 null (Policy가 없으면 null 반환, Fail Closed)
 */
export async function getTenantSettingByPath(
  supabase: SupabaseClient,
  tenantId: string,
  path: string,
  legacyPath?: string
): Promise<unknown> {
  // 0단계: 신규 경로에서 event_type 추출 및 검증 (SSOT 강제)
  // ⚠️ 중요: 신규 경로(`auto_notification.<event_type>.*`)만 검증합니다.
  // 레거시 경로(`legacyPath`)는 마이그레이션 전까지 사용되므로 검증하지 않습니다.
  if (path.startsWith('auto_notification.')) {
    const pathParts = path.split('.');
    if (pathParts.length >= 2) {
      const eventType = pathParts[1];
      // 카탈로그에 없는 event_type이면 즉시 에러 (Fail-Closed)
      assertAutomationEventType(eventType);
    }
  }

  // 1단계: tenant_settings KV에서 key='config' row의 value(JSONB) 획득
  const config = await getTenantSetting(supabase, tenantId, 'config');
  if (!config) {
    return null; // Fail Closed
  }

  // 2단계: value(JSONB)에서 경로 추출 (신규 경로 우선)
  // ⚠️ 일관성 참고: 클라이언트의 getPolicyValueFromConfig와 동일한 알고리즘을 사용합니다.
  // 차이점: 서버에서는 `key in current`를 사용하고, 클라이언트에서는 hasOwnProperty를 사용합니다.
  // 1. 경로를 점(.)으로 분리
  // 2. 각 키를 순차적으로 탐색
  // 3. 중간 경로가 없으면 레거시 경로 fallback 시도 또는 null 반환 (Fail Closed)
  const keys = path.split('.');
  let current: unknown = config;

  for (const key of keys) {
    // ⚠️ 일관성: 서버에서는 `key in current`를 사용 (프로토타입 체인 탐색 허용, JSONB 객체이므로 안전)
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      // 신규 경로가 없고 레거시 경로가 제공된 경우 fallback 시도
      if (legacyPath) {
        const legacyKeys = legacyPath.split('.');
        let legacyCurrent: unknown = config;
        let legacyFound = true;

        for (const legacyKey of legacyKeys) {
          if (legacyCurrent && typeof legacyCurrent === 'object' && legacyKey in legacyCurrent) {
            legacyCurrent = (legacyCurrent as Record<string, unknown>)[legacyKey];
          } else {
            legacyFound = false;
            break;
          }
        }

        if (legacyFound && legacyCurrent !== undefined) {
          // 레거시 경로 사용 시 로그 기록 (기존 로그 스키마 내에서만)
          console.warn(`[Policy Utils] Using legacy path '${legacyPath}' for tenant ${tenantId}, migrate to '${path}'`);
          return legacyCurrent;
        }
      }
      return null; // Fail Closed
    }
  }

  return current;
}

/**
 * AI 기능 활성화 여부 확인 (SSOT 기준)
 * @param supabase Supabase 클라이언트
 * @param tenantId 테넌트 ID
 * @returns true: 활성화, false: 비활성화 또는 Policy 없음 (Fail Closed)
 */
export async function shouldUseAI(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  // SSOT: effective_ai_enabled = PLATFORM_AI_ENABLED && tenant_features['ai'].enabled
  // 1단계: 플랫폼 레벨 AI 활성화 확인
  // ⚠️ 중요: Fail-Closed 원칙 - 값이 없거나 'true'가 아니면 비활성화
  // [불변 규칙] Edge Functions도 env-registry를 통해 환경변수 접근
  const { getPlatformAIEnabled } = await import('./env-registry.ts');
  if (!getPlatformAIEnabled()) {
    return false; // Fail Closed
  }

  // 2단계: 테넌트 레벨 AI 기능 활성화 확인
  const { data: aiFeature, error } = await withTenant(
    supabase
    .from('tenant_features')
    .select('enabled')
      .eq('feature_key', 'ai'),
    tenantId
  ).single();

  if (error || !aiFeature) {
    return false; // Fail Closed
  }

  return aiFeature.enabled === true;

