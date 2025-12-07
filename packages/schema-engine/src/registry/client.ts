/**
 * Schema Registry Client
 * 
 * [ë¶ˆë? ê·œì¹™] ê¸°ìˆ ë¬¸ì„œ PART 1??5. Schema Registry ?´ì˜ ë¬¸ì„œë¥?ì¤€?˜í•©?ˆë‹¤.
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§?ì¡°íšŒ ?°ì„ ?œìœ„:
 * 1. ?Œë„Œ?¸ë³„ Version Pinning
 * 2. Industryë³??œì„± ?¤í‚¤ë§? * 3. ê³µí†µ ?œì„± ?¤í‚¤ë§? * 4. Fallback ?¤í‚¤ë§? * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—”ì§?txt 5. Registry Client
 */

import type { FormSchema, TableSchema, UISchema } from '../types';
import { checkSchemaVersion } from '../validator';

export interface SchemaRegistryClientOptions {
  tenantId?: string;
  industryType?: string;
  clientVersion: string;  // ?´ë¼?´ì–¸??ë²„ì „ (?? '1.12.0')
  fallbackSchema?: UISchema;  // Fallback ?¤í‚¤ë§?}

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
 * ?¤í‚¤ë§?ì¡°íšŒ ?°ì„ ?œìœ„???°ë¼ ?ì ˆ???¤í‚¤ë§ˆë? ë°˜í™˜?©ë‹ˆ??
 */
export class SchemaRegistryClient {
  private options: SchemaRegistryClientOptions;

  constructor(options: SchemaRegistryClientOptions) {
    this.options = options;
  }

  /**
   * ?¤í‚¤ë§?ì¡°íšŒ (?°ì„ ?œìœ„ ?ìš©)
   * 
   * ? ï¸ ??ë©”ì„œ?œëŠ” ?¬ìš©?˜ì? ?ŠìŠµ?ˆë‹¤. Service Layer??getSchemaë¥??¬ìš©?˜ì„¸??
   * 
   * @deprecated Use SchemaRegistryService.getSchema instead
   */
  async getSchema(entity: string): Promise<UISchema | null> {
    // ?¤ì œ êµ¬í˜„?€ Service Layerë¥??µí•´ DB?ì„œ ì¡°íšŒ
    // ?¬ê¸°?œëŠ” ?¸í„°?˜ì´?¤ë§Œ ?•ì˜
    throw new Error('getSchema must be implemented by Service Layer. Use SchemaRegistryService.getSchema instead.');
  }

  /**
   * ?¤í‚¤ë§?ì¡°íšŒ ?°ì„ ?œìœ„ ë¡œì§
   * 
   * ? ï¸ ì¤‘ìš”: ??ë©”ì„œ?œëŠ” Service Layer?ì„œ ?´ë? Version Pinning???„í„°ë§í•œ entriesë¥?ë°›ìŠµ?ˆë‹¤.
   * ?°ë¼??Version Pinning ì¡°íšŒ??Service Layer?ì„œ ?˜í–‰?˜ë©°, ?¬ê¸°?œëŠ” ?°ì„ ?œìœ„???°ë¼ ?¤í‚¤ë§ˆë? ? íƒ?©ë‹ˆ??
   * 
   * ?°ì„ ?œìœ„:
   * 1. Industryë³??œì„± ?¤í‚¤ë§?(entries???´ë? ?„í„°ë§ëœ ?íƒœ)
   * 2. ê³µí†µ ?œì„± ?¤í‚¤ë§?(industry_type IS NULL)
   * 3. Fallback ?¤í‚¤ë§?   */
  resolveSchema(
    entity: string,
    entries: SchemaRegistryEntry[]
  ): UISchema | null {
    const { industryType, clientVersion, fallbackSchema } = this.options;

    // 1. Industryë³??œì„± ?¤í‚¤ë§?ì¡°íšŒ
    // ? ï¸ ì°¸ê³ : entries???´ë? status='active'ë¡??„í„°ë§ëœ ?íƒœ?…ë‹ˆ??(getActiveSchemas?ì„œ).
    if (industryType) {
      const industrySchema = entries
        .filter(
          (e) => e.entity === entity &&
            e.industry_type === industryType
        )
        .sort((a, b) => {
          // ë²„ì „ ?´ë¦¼ì°¨ìˆœ ?•ë ¬
          const aVersion = a.version.split('.').map(Number);
          const bVersion = b.version.split('.').map(Number);
          for (let i = 0; i < 3; i++) {
            if (aVersion[i] !== bVersion[i]) {
              return bVersion[i] - aVersion[i];
            }
          }
          return 0;
        })[0];

      if (industrySchema) {
        // SDUI v1.1: min_supported_client (DB) ??minClient (ì½”ë“œ) ë³€??        const versionCheck = checkSchemaVersion(
          { version: industrySchema.version, minClient: industrySchema.min_supported_client, entity },
          clientVersion
        );
        if (versionCheck.compatible) {
          return industrySchema.schema_json;
        }
        throw new Error(
          `Schema version ${industrySchema.version} requires client version ${industrySchema.min_supported_client} or higher. Please update your client.`
        );
      }
    }

    // 2. ê³µí†µ ?œì„± ?¤í‚¤ë§?ì¡°íšŒ (industry_type IS NULL)
    // ? ï¸ ì°¸ê³ : entries???´ë? status='active'ë¡??„í„°ë§ëœ ?íƒœ?…ë‹ˆ??(getActiveSchemas?ì„œ).
    const commonSchema = entries
      .filter(
        (e) => e.entity === entity &&
          e.industry_type === null
      )
      .sort((a, b) => {
        const aVersion = a.version.split('.').map(Number);
        const bVersion = b.version.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if (aVersion[i] !== bVersion[i]) {
            return bVersion[i] - aVersion[i];
          }
        }
        return 0;
      })[0];

    if (commonSchema) {
      // SDUI v1.1: min_supported_client (DB) ??minClient (ì½”ë“œ) ë³€??      const versionCheck = checkSchemaVersion(
        { version: commonSchema.version, minClient: commonSchema.min_supported_client, entity },
        clientVersion
      );
      if (versionCheck.compatible) {
        return commonSchema.schema_json;
      }
      throw new Error(
        `Schema version ${commonSchema.version} requires client version ${commonSchema.min_supported_client} or higher. Please update your client.`
      );
    }

    // 3. Fallback ?¤í‚¤ë§?ë°˜í™˜
    if (fallbackSchema && fallbackSchema.entity === entity) {
      return fallbackSchema;
    }

    return null;
  }
}

