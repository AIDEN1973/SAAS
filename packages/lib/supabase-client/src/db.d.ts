import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
/**
 * 멀?�테?�트 쿼리 가??
 * SELECT/UPDATE/DELETE 쿼리??tenant_id ?�터�?강제
 *
 * [불�? 규칙] INSERT ?�에??row object ?�에 tenant_id ?�드�?직접 ?�함?�다.
 * [불�? 규칙] SELECT/UPDATE/DELETE 쿼리??반드??withTenant()�??�용??tenant_id ?�터�?강제?�다.
 */
export declare function withTenant<T extends PostgrestFilterBuilder<any, any, any, any, any, any, any>>(q: T, tenantId: string): T;
//# sourceMappingURL=db.d.ts.map