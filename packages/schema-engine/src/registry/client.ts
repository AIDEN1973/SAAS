/**
 * Schema Registry Client
 * 
 * [불변 규칙] 기술문서 PART 1의 5. Schema Registry 운영 문서를 준수합니다.
 * [불변 규칙] 스키마 조회 우선순위:
 * 1. 테넌트별 Version Pinning
 * 2. Industry별 활성 스키마
 * 3. 공통 활성 스키마
 * 4. Fallback 스키마
 * 
 * 기술문서: docu/스키마엔진.txt 5. Registry Client
 */

import type { FormSchema, TableSchema, UISchema } from '../types';
import { checkSchemaVersion } from '../validator';

export interface SchemaRegistryClientOptions {
  tenantId?: string;
  industryType?: string;
  clientVersion: string;  // 클라이언트 버전 (예: '1.12.0')
  fallbackSchema?: UISchema;  // Fallback 스키마
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
export class SchemaRegistryClient {
  private options: SchemaRegistryClientOptions;

  constructor(options: SchemaRegistryClientOptions) {
    this.options = options;
  }

  /**
   * 스키마 조회 (우선순위 적용)
   * 
   * ⚠️ 이 메서드는 사용되지 않습니다. Service Layer의 getSchema를 사용하세요.
   * 
   * @deprecated Use SchemaRegistryService.getSchema instead
   */
  async getSchema(entity: string): Promise<UISchema | null> {
    // 실제 구현은 Service Layer를 통해 DB에서 조회
    // 여기서는 인터페이스만 정의
    throw new Error('getSchema must be implemented by Service Layer. Use SchemaRegistryService.getSchema instead.');
  }

  /**
   * 스키마 조회 우선순위 로직
   * 
   * ⚠️ 중요: 이 메서드는 Service Layer에서 이미 Version Pinning을 필터링한 entries를 받습니다.
   * 따라서 Version Pinning 조회는 Service Layer에서 수행되며, 여기서는 우선순위에 따라 스키마를 선택합니다.
   * 
   * 우선순위:
   * 1. Industry별 활성 스키마 (entries에 이미 필터링된 상태)
   * 2. 공통 활성 스키마 (industry_type IS NULL)
   * 3. Fallback 스키마
   */
  resolveSchema(
    entity: string,
    entries: SchemaRegistryEntry[]
  ): UISchema | null {
    const { industryType, clientVersion, fallbackSchema } = this.options;

    // 1. Industry별 활성 스키마 조회
    // ⚠️ 참고: entries는 이미 status='active'로 필터링된 상태입니다 (getActiveSchemas에서).
    if (industryType) {
      const industrySchema = entries
        .filter(
          (e) => e.entity === entity &&
            e.industry_type === industryType
        )
        .sort((a, b) => {
          // 버전 내림차순 정렬
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
        // SDUI v1.1: min_supported_client (DB) → minClient (코드) 변환
        const versionCheck = checkSchemaVersion(
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

    // 2. 공통 활성 스키마 조회 (industry_type IS NULL)
    // ⚠️ 참고: entries는 이미 status='active'로 필터링된 상태입니다 (getActiveSchemas에서).
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
      // SDUI v1.1: min_supported_client (DB) → minClient (코드) 변환
      const versionCheck = checkSchemaVersion(
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

    // 3. Fallback 스키마 반환
    if (fallbackSchema && fallbackSchema.entity === entity) {
      return fallbackSchema;
    }

    return null;
  }
}

