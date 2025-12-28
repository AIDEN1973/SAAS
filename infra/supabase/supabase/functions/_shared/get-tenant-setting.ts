/**
 * 테넌트 설정 조회 함수 (순환 참조 방지를 위해 별도 파일로 분리)
 *
 * [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
 * [불변 규칙] Fail Closed: Policy가 없으면 null 반환
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withTenant } from './withTenant.ts';

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
    console.error(`[Get Tenant Setting] Failed to fetch tenant setting ${key}:`, error);
    return null;
  }

  return (data?.value as Record<string, unknown>) || null;
}

