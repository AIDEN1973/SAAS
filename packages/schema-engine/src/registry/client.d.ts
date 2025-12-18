/**
 * Schema Registry Client
 *
 * [불변 규칙] 기술문서 PART 1의 5. Schema Registry 운영 문서를 준수합니다.
 * [불변 규칙] 스키마 조회 우선순위:
 * 1. 테넌트별 Version Pinning
 * 2. Industry별 스키마
 * 3. 공통 스키마
 * 4. Fallback 스키마
 *
 * 기술문서: docu/스키마엔진.txt 5. Registry Client
 */
import type { UISchema } from '../types';
export interface SchemaRegistryClientOptions {
    tenantId?: string;
    industryType?: string;
    clientVersion: string;
    fallbackSchema?: UISchema;
}
export interface SchemaRegistryEntry {
    id: string;
    entity: string;
    industry_type: string | null;
    version: string;
    min_supported_client: string;
    schema_json: UISchema;
    status: 'draft' | 'active' | 'deprecated';
    activated_at: string | null;
}
/**
 * Schema Registry Client
 *
 * 스키마 조회 우선순위에 따라 적절한 스키마를 반환합니다.
 */
export declare class SchemaRegistryClient {
    private options;
    constructor(options: SchemaRegistryClientOptions);
    /**
     * 스키마 조회 (우선순위 적용)
     *
     * ⚠️ 이 메서드는 사용되지 않습니다. Service Layer의 getSchema를 사용하세요.
     *
     * @deprecated Use SchemaRegistryService.getSchema instead
     */
    getSchema(_entity: string): Promise<UISchema | null>;
    /**
     * 스키마 조회 우선순위 로직
     *
     * ⚠️ 중요: 이 메서드는 Service Layer에서 이미 Version Pinning으로 필터링한 entries를 받습니다.
     * 따라서 Version Pinning 조회는 Service Layer에서 수행하며, 여기서는 우선순위에 따라 스키마를 선택합니다.
     *
     * 우선순위:
     * 1. Industry별 스키마 (entries는 이미 필터링된 상태)
     * 2. 공통 스키마 (industry_type IS NULL)
     * 3. Fallback 스키마
     */
    resolveSchema(entity: string, entries: SchemaRegistryEntry[]): UISchema | null;
}
//# sourceMappingURL=client.d.ts.map