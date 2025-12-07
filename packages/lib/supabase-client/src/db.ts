import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * ë©€?°í…Œ?ŒíŠ¸ ì¿¼ë¦¬ ê°€??
 * SELECT/UPDATE/DELETE ì¿¼ë¦¬??tenant_id ?„í„°ë¥?ê°•ì œ
 * 
 * [ë¶ˆë? ê·œì¹™] INSERT ?œì—??row object ?ˆì— tenant_id ?„ë“œë¥?ì§ì ‘ ?¬í•¨?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] SELECT/UPDATE/DELETE ì¿¼ë¦¬??ë°˜ë“œ??withTenant()ë¥??¬ìš©??tenant_id ?„í„°ë¥?ê°•ì œ?œë‹¤.
 */
export function withTenant<
  T extends PostgrestFilterBuilder<any, any, any, any, any, any, any>
>(
  q: T,
  tenantId: string
): T {
  return q.eq('tenant_id', tenantId) as T;
}

