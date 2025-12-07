/**
 * Schema Loader
 * 
 * SDUI v1.1: Schema Registry?ì„œ ?¤í‚¤ë§ˆë? ë¡œë“œ?˜ê³  ì²˜ë¦¬?˜ëŠ” ?”ì§„
 * 
 * ??• :
 * - Registry?ì„œ ë©”í??°ì´??ì¡°íšŒ
 * - Storage?ì„œ JSON ?Œì¼ ?¤ìš´ë¡œë“œ
 * - JSON ?Œì‹±
 * - Validator / Migration / i18n Binding ?¸ì¶œ
 * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 4. Schema Loader
 */

import type { BaseSchema, UISchema } from '../types';
import { validateSchema } from '../validator';
import { migrateSchema } from './migration';
import { bindI18n } from './i18n';

export interface SchemaLoadOptions {
  tenantId: string;
  entity: string;
  type: 'form' | 'table' | 'detail' | 'filter' | 'widget';
  locale?: string;  // i18n ë¡œì???  clientVersion?: string;  // ?´ë¼?´ì–¸??ë²„ì „ (?¸í™˜??ì²´í¬??
}

export interface SchemaLoadResult {
  schema: UISchema;
  fromCache: boolean;
}

/**
 * Schema Loader
 * 
 * SDUI v1.1: Registry?ì„œ ?¤í‚¤ë§ˆë? ë¡œë“œ?˜ê³  ê²€ì¦?ë§ˆì´ê·¸ë ˆ?´ì…˜/i18n ë°”ì¸?©ì„ ?˜í–‰?©ë‹ˆ??
 * 
 * ì§€??ë°©ì‹:
 * 1. schema_json ì§ì ‘ ?€??ë°©ì‹ (?„ì¬ êµ¬í˜„)
 * 2. storage_path ê¸°ë°˜ ë°©ì‹ (SDUI v1.1, ?¥í›„ ?•ì¥)
 * 
 * @param options - ?¤í‚¤ë§?ë¡œë“œ ?µì…˜
 * @returns ë¡œë“œ???¤í‚¤ë§? */
export async function loadSchema(options: SchemaLoadOptions): Promise<SchemaLoadResult> {
  const { tenantId, entity, type, locale = 'ko', clientVersion } = options;

  try {
    // ?„ì¬ êµ¬í˜„: SchemaRegistryServiceë¥??µí•´ schema_json ì§ì ‘ ì¡°íšŒ
    // SDUI v1.1: ?¥í›„ storage_path ë°©ì‹??ì§€???ˆì •
    const { SchemaRegistryService } = await import('@core/schema-registry');
    const registryService = new SchemaRegistryService();
    
    // ?¤í‚¤ë§?ì¡°íšŒ (?°ì„ ?œìœ„ ?ìš©)
    const schema = await registryService.getSchema(entity, {
      tenantId,
      industryType: undefined, // TODO: context?ì„œ ê°€?¸ì˜¤ê¸?      clientVersion: clientVersion || '1.0.0',
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

    // ?€??ì²´í¬
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

    // 2. Migration (?„ìš”??ê²½ìš°)
    const migratedSchema = migrateSchema(schema, schema.version);

    // 3. i18n Binding
    const localizedSchema = await bindI18n(migratedSchema, {
      tenantId,
      locale,
      loadFromDB: true,  // SDUI v1.1: DB?ì„œ ë²ˆì—­ ë¡œë“œ
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
    
    // ?????†ëŠ” ?ëŸ¬
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
 * Schema Loader ?ëŸ¬ ?€?? */
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

