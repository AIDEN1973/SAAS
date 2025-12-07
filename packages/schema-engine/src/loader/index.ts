/**
 * Schema Loader
 * 
 * SDUI v1.1: Schema Registry에서 스키마를 로드하고 처리하는 엔진
 * 
 * 역할:
 * - Registry에서 메타데이터 조회
 * - Storage에서 JSON 파일 다운로드
 * - JSON 파싱
 * - Validator / Migration / i18n Binding 호출
 * 
 * 기술문서: SDUI 기술문서 v1.1 - 4. Schema Loader
 */

import type { BaseSchema, UISchema } from '../types';
import { validateSchema } from '../validator';
import { migrateSchema } from './migration';
import { bindI18n } from './i18n';

export interface SchemaLoadOptions {
  tenantId: string;
  entity: string;
  type: 'form' | 'table' | 'detail' | 'filter' | 'widget';
  locale?: string;  // i18n 로케일
  clientVersion?: string;  // 클라이언트 버전 (호환성 체크용)
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
 * 1. schema_json 직접 저장 방식 (현재 구현)
 * 2. storage_path 기반 방식 (SDUI v1.1, 향후 확장)
 * 
 * @param options - 스키마 로드 옵션
 * @returns 로드된 스키마
 */
export async function loadSchema(options: SchemaLoadOptions): Promise<SchemaLoadResult> {
  const { tenantId, entity, type, locale = 'ko', clientVersion } = options;

  try {
    // 현재 구현: SchemaRegistryService를 통해 schema_json 직접 조회
    // SDUI v1.1: 향후 storage_path 방식도 지원 예정
    const { SchemaRegistryService } = await import('@core/schema-registry');
    const registryService = new SchemaRegistryService();
    
    // 스키마 조회 (우선순위 적용)
    const schema = await registryService.getSchema(entity, {
      tenantId,
      industryType: undefined, // TODO: context에서 가져오기
      clientVersion: clientVersion || '1.0.0',
      fallbackSchema: undefined,
    });

    if (!schema) {
      throw new SchemaLoadError(
        `Schema not found: ${entity} (${type})`,
        'SchemaNotFound',
        tenantId,
        entity,
        type
      );
    }

    // 타입 체크
    if (schema.type !== type) {
      throw new SchemaLoadError(
        `Schema type mismatch: expected ${type}, got ${schema.type}`,
        'SchemaCorrupted',
        tenantId,
        entity,
        type
      );
    }

    // 1. Validation
    const validation = validateSchema(schema);
    if (!validation.valid) {
      throw new SchemaLoadError(
        `Schema validation failed: ${validation.errors?.message}`,
        'SchemaValidationFailed',
        tenantId,
        entity,
        type
      );
    }

    // 2. Migration (필요한 경우)
    const migratedSchema = migrateSchema(schema, schema.version);

    // 3. i18n Binding
    const localizedSchema = await bindI18n(migratedSchema, {
      tenantId,
      locale,
      loadFromDB: true,  // SDUI v1.1: DB에서 번역 로드
    });

    // 4. Client Version Check
    if (clientVersion && schema.minClient) {
      const [schemaMajor, schemaMinor] = schema.minClient.split('.').map(Number);
      const [clientMajor, clientMinor] = clientVersion.split('.').map(Number);
      
      if (schemaMajor > clientMajor || (schemaMajor === clientMajor && schemaMinor > clientMinor)) {
        throw new SchemaLoadError(
          `Client version ${clientVersion} is not compatible with schema version ${schema.version} (minClient: ${schema.minClient})`,
          'ClientUpdateRequired',
          tenantId,
          entity,
          type
        );
      }
    }

    return {
      schema: localizedSchema as UISchema,
      fromCache: false,
    };
  } catch (error) {
    if (error instanceof SchemaLoadError) {
      throw error;
    }
    
    // 알 수 없는 에러
    throw new SchemaLoadError(
      `Failed to load schema: ${error instanceof Error ? error.message : String(error)}`,
      'SchemaCorrupted',
      tenantId,
      entity,
      type
    );
  }
}

/**
 * Schema Loader 에러 타입
 */
export class SchemaLoadError extends Error {
  constructor(
    message: string,
    public code: 'SchemaNotFound' | 'SchemaFileMissing' | 'SchemaCorrupted' | 'SchemaValidationFailed' | 'ClientUpdateRequired',
    public tenantId?: string,
    public entity?: string,
    public type?: string
  ) {
    super(message);
    this.name = 'SchemaLoadError';
  }
}

