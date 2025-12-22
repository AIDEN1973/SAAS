/**
 * 멀티테넌트 쿼리 가드
 * SELECT/UPDATE/DELETE 쿼리에 tenant_id 필터 강제
 *
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 * [불변 규칙] SELECT/UPDATE/DELETE 쿼리는 반드시 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 */

import type { PostgrestFilterBuilder } from 'https://esm.sh/@supabase/postgrest-js@1';

export function withTenant<
  T extends PostgrestFilterBuilder<any, any, any, any, any, any, any>
>(
  q: T,
  tenantId: string
): T {
  return q.eq('tenant_id', tenantId) as T;
}

