/**
 * Schema Loader
 * 
 * SDUI v1.1: Schema Registry?�서 ?�키마�? 로드?�고 처리?�는 ?�진
 * 
 * ??��:
 * - Registry?�서 메�??�이??조회
 * - Storage?�서 JSON ?�일 ?�운로드
 * - JSON ?�싱
 * - Validator / Migration / i18n Binding ?�출
 * 
 * 기술문서: SDUI 기술문서 v1.1 - 4. Schema Loader
 */

import type { UISchema } from '../types';
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
 * SDUI v1.1: Registry?�서 ?�키마�? 로드?�고 검�?마이그레?�션/i18n 바인?�을 ?�행?�니??
 * 
 * 지??방식:
 * 1. schema_json 직접 ?�??방식 (?�재 구현)
 * 2. storage_path 기반 방식 (SDUI v1.1, ?�후 ?�장)
 * 
 * @param options - ?�키�?로드 ?�션
 * @returns 로드???�키�? */
export async function loadSchema(options: SchemaLoadOptions): Promise<SchemaLoadResult> {
  const { tenantId, entity, type, locale = 'ko', clientVersion } = options;

  try {
    // ?�재 구현: SchemaRegistryService�??�해 schema_json 직접 조회
    // SDUI v1.1: ?�후 storage_path 방식??지???�정
    const { SchemaRegistryService } = await import('@core/schema-registry');
    const registryService = new SchemaRegistryService();
    
    // ?�키�?조회 (?�선?�위 ?�용)
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

    // ?�??체크
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

    // 2. Migration (?�요??경우)
    const migratedSchema = migrateSchema(schema, schema.version);

    // 3. i18n Binding
    const localizedSchema = await bindI18n(migratedSchema, {
      tenantId,
      locale,
      loadFromDB: true,  // SDUI v1.1: DB?�서 번역 로드
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
    
    // ?????�는 ?�러
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
 * Schema Loader ?�러 ?�?? */
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



