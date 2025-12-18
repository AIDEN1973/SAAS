/**
 * Schema Loader
 *
 * SDUI v1.1: Schema Registry에서 스키마를 로드하고 처리하는 엔진
 *
 * 기능:
 * - Registry에서 메타데이터 조회
 * - Storage에서 JSON 파일 다운로드
 * - JSON 파싱
 * - Validator / Migration / i18n Binding 호출
 *
 * 기술문서: SDUI 기술문서 v1.1 - 4. Schema Loader
 */
import type { UISchema } from '../types';
export interface SchemaLoadOptions {
    tenantId: string;
    entity: string;
    type: 'form' | 'table' | 'detail' | 'filter' | 'widget';
    locale?: string;
    clientVersion?: string;
}
export interface SchemaLoadResult {
    schema: UISchema;
    fromCache: boolean;
}
/**
 * Schema Loader
 *
 * SDUI v1.1: Registry에서 스키마를 로드하고 검증/마이그레이션/i18n 바인딩을 수행합니다.
 *
 * 지원 방식:
 * 1. schema_json 직접 파싱 방식 (현재 구현)
 * 2. storage_path 기반 방식 (SDUI v1.1, 향후 확장)
 *
 * @param options - 스키마 로드 옵션
 * @returns 로드된 스키마
 */
export declare function loadSchema(options: SchemaLoadOptions): Promise<SchemaLoadResult>;
/**
 * Schema Loader 오류 클래스
 */
export declare class SchemaLoadError extends Error {
    code: 'SchemaNotFound' | 'SchemaFileMissing' | 'SchemaCorrupted' | 'SchemaValidationFailed' | 'ClientUpdateRequired';
    tenantId?: string | undefined;
    entity?: string | undefined;
    type?: string | undefined;
    constructor(message: string, code: 'SchemaNotFound' | 'SchemaFileMissing' | 'SchemaCorrupted' | 'SchemaValidationFailed' | 'ClientUpdateRequired', tenantId?: string | undefined, entity?: string | undefined, type?: string | undefined);
}
//# sourceMappingURL=index.d.ts.map