/**
 * Schema Registry Service
 *
 * [불변 규칙] 기술문서 PART 1의 5. Schema Registry 운영 문서를 준수합니다.
 * [불변 규칙] meta.schema_registry는 공통 스키마이므로 tenant_id 컬럼이 없습니다.
 * [불변 규칙] SELECT 쿼리는 withTenant를 사용하지 않습니다 (공통 스키마이므로).
 *
 * 기술문서: docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 */
import type { UISchema } from '@schema-engine';
import { type SchemaRegistryEntry } from '@schema-engine';
export interface RegisterSchemaInput {
    entity: string;
    industry_type?: string | null;
    version: string;
    minSupportedClient: string;
    schema_json: UISchema;
    migration_script?: string | null;
    status?: 'draft' | 'active' | 'deprecated';
}
export interface ActivateSchemaInput {
    entity: string;
    industry_type?: string | null;
    version: string;
}
export interface PinSchemaVersionInput {
    tenant_id: string;
    entity: string;
    industry_type?: string | null;
    pinned_version: string;
    reason?: string;
}
/**
 * Schema Registry Service
 *
 * 스키마 등록, 조회, 활성화 및 Version Pinning을 담당합니다.
 */
export declare class SchemaRegistryService {
    private supabase;
    /**
     * 스키마 등록
     *
     * [불변 규칙] status는 기본적으로 'draft'로 설정됩니다.
     * [불변 규칙] Super Admin만 등록 가능 (RLS 정책)
     */
    registerSchema(input: RegisterSchemaInput): Promise<SchemaRegistryEntry>;
    /**
     * 스키마 조회 (우선순위 적용)
     *
     * SchemaRegistryClient의 resolveSchema 로직을 사용합니다.
     */
    getSchema(entity: string, options: {
        tenantId?: string;
        industryType?: string;
        clientVersion: string;
        fallbackSchema?: UISchema;
    }): Promise<UISchema | null>;
    /**
     * 활성 스키마 목록 조회
     */
    private getActiveSchemas;
    /**
     * 스키마 활성화
     *
     * [불변 규칙] Super Admin만 활성화 가능 (RLS 정책)
     */
    activateSchema(input: ActivateSchemaInput): Promise<SchemaRegistryEntry>;
    /**
     * 스키마 비활성화 (Deprecated)
     *
     * [불변 규칙] Super Admin만 비활성화 가능 (RLS 정책)
     */
    deprecateSchema(input: ActivateSchemaInput): Promise<SchemaRegistryEntry>;
    /**
     * Version Pinning 조회
     */
    getPinnedVersion(tenantId: string, entity: string, industryType: string | null): Promise<{
        pinned_version: string;
    } | null>;
    /**
     * Version Pinning 설정
     *
     * [불변 규칙] Super Admin만 설정 가능 (RLS 정책)
     */
    pinSchemaVersion(input: PinSchemaVersionInput): Promise<void>;
    /**
     * Version Pinning 제거
     *
     * [불변 규칙] Super Admin만 제거 가능 (RLS 정책)
     */
    unpinSchemaVersion(tenantId: string, entity: string, industryType: string | null): Promise<void>;
    /**
     * DB row를 SchemaRegistryEntry로 변환
     *
     * min_supported_client (snake_case) → minSupportedClient (camelCase) 변환
     */
    private mapToEntry;
}
//# sourceMappingURL=service.d.ts.map