/**
 * Schema Registry Service
 *
 * [불변 규칙] 기술문서 PART 1의 5. Schema Registry 운영 문서를 준수합니다.
 * [불변 규칙] meta.schema_registry는 공통 스키마이므로 tenant_id 컬럼이 없습니다.
 * [불변 규칙] SELECT 쿼리는 withTenant를 사용하지 않습니다 (공통 스키마이므로).
 *
 * 기술문서: docu/스키마엔진.txt 4. Schema Registry (DB + RLS)
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type { UISchema } from '@schema-engine';
import { SchemaRegistryClient, type SchemaRegistryEntry } from '@schema-engine';

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
export class SchemaRegistryService {
  private supabase = createServerClient();

  /**
   * 스키마 등록
   *
   * [불변 규칙] status는 기본적으로 'draft'로 설정됩니다.
   * [불변 규칙] Super Admin만 등록 가능 (RLS 정책)
   */
  async registerSchema(input: RegisterSchemaInput): Promise<SchemaRegistryEntry> {
    // 런타임 검증: minSupportedClient는 필수이며 빈 문자열이 아니어야 함
    if (!input.minSupportedClient || input.minSupportedClient.trim() === '') {
      throw new Error('minSupportedClient is required and cannot be empty');
    }

    const { data, error } = await this.supabase
      .from('meta.schema_registry')
      .insert({
        entity: input.entity,
        industry_type: input.industry_type || null,
        version: input.version,
        min_supported_client: input.minSupportedClient,  // camelCase → snake_case 변환
        schema_json: input.schema_json,
        migration_script: input.migration_script || null,
        status: input.status || 'draft',
        registered_by: (await this.supabase.auth.getUser()).data.user?.id || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to register schema: ${error.message}`);
    }

    return this.mapToEntry(data);
  }

  /**
   * 스키마 조회 (우선순위 적용)
   *
   * SchemaRegistryClient의 resolveSchema 로직을 사용합니다.
   */
  async getSchema(
    entity: string,
    options: {
      tenantId?: string;
      industryType?: string;
      clientVersion: string;
      fallbackSchema?: UISchema;
    }
  ): Promise<UISchema | null> {
    const client = new SchemaRegistryClient(options);

    // 1. 테넌트별 Version Pinning 조회
    let pinnedVersion: string | null = null;
    if (options.tenantId) {
      const pin = await this.getPinnedVersion(
        options.tenantId,
        entity,
        options.industryType || null
      );
      pinnedVersion = pin?.pinned_version || null;
    }

    // 2. 모든 활성 스키마 조회 (getActiveSchemas에서 이미 status='active'로 필터링)
    const entries = await this.getActiveSchemas(entity, options.industryType || null);

    // 3. 우선순위에 따라 스키마 결정
    // pinnedVersion이 있으면 해당 버전으로 필터링
    // ⚠️ 중요: resolveSchema에서는 이미 필터링된 entries를 받아서 우선순위에 따라 선택합니다.
    // getActiveSchemas에서 이미 status='active'로 필터링하므로 여기서는 version만 필터링합니다.
    const filteredEntries = pinnedVersion
      ? entries.filter((e) => e.version === pinnedVersion)
      : entries;

    return client.resolveSchema(entity, filteredEntries);
  }

  /**
   * 활성 스키마 목록 조회
   */
  private async getActiveSchemas(
    entity: string,
    industryType: string | null
  ): Promise<SchemaRegistryEntry[]> {
    let query = this.supabase
      .from('meta.schema_registry')
      .select('*')
      .eq('entity', entity)
      .eq('status', 'active');

    // industry_type 필터
    if (industryType !== null) {
      query = query.or(`industry_type.eq.${industryType},industry_type.is.null`);
    } else {
      query = query.is('industry_type', null);
    }

    const { data, error } = await query.order('version', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active schemas: ${error.message}`);
    }

    return (data || []).map((row: unknown) => this.mapToEntry(row as Record<string, unknown>));
  }

  /**
   * 스키마 활성화
   *
   * [불변 규칙] Super Admin만 활성화 가능 (RLS 정책)
   */
  async activateSchema(input: ActivateSchemaInput): Promise<SchemaRegistryEntry> {
    // 1. 기존 active 스키마를 deprecated로 변경
    const { error: deprecateError } = await this.supabase
      .from('meta.schema_registry')
      .update({
        status: 'deprecated',
        // 기술문서 19-1-1: 타임스탬프는 UTC로 저장 (DB 저장 규칙)
        deprecated_at: new Date().toISOString(),
      })
      .eq('entity', input.entity)
      .eq('industry_type', input.industry_type || null)
      .eq('status', 'active');

    if (deprecateError) {
      throw new Error(`Failed to deprecate existing active schema: ${deprecateError.message}`);
    }

    // 2. 새 스키마를 active로 변경
    const { data, error } = await this.supabase
      .from('meta.schema_registry')
      .update({
        status: 'active',
        // 기술문서 19-1-1: 타임스탬프는 UTC로 저장 (DB 저장 규칙)
        activated_at: new Date().toISOString(),
      })
      .eq('entity', input.entity)
      .eq('industry_type', input.industry_type || null)
      .eq('version', input.version)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to activate schema: ${error.message}`);
    }

    return this.mapToEntry(data);
  }

  /**
   * 스키마 비활성화 (Deprecated)
   *
   * [불변 규칙] Super Admin만 비활성화 가능 (RLS 정책)
   */
  async deprecateSchema(input: ActivateSchemaInput): Promise<SchemaRegistryEntry> {
    const { data, error } = await this.supabase
      .from('meta.schema_registry')
      .update({
        status: 'deprecated',
        // 기술문서 19-1-1: 타임스탬프는 UTC로 저장 (DB 저장 규칙)
        deprecated_at: new Date().toISOString(),
      })
      .eq('entity', input.entity)
      .eq('industry_type', input.industry_type || null)
      .eq('version', input.version)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to deprecate schema: ${error.message}`);
    }

    return this.mapToEntry(data);
  }

  /**
   * Version Pinning 조회
   */
  async getPinnedVersion(
    tenantId: string,
    entity: string,
    industryType: string | null
  ): Promise<{ pinned_version: string } | null> {
    // ⚠️ 참고: meta.tenant_schema_pins는 tenant_id로 필터링
    // (meta 스키마는 RLS 정책이 다를 수 있지만, 규칙에 따라 withTenant() 사용)
    const { data, error } = await withTenant(
      this.supabase
      .from('meta.tenant_schema_pins')
      .select('pinned_version')
      .eq('entity', entity)
        .eq('industry_type', industryType || null),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch pinned version: ${error.message}`);
    }

    return data;
  }

  /**
   * Version Pinning 설정
   *
   * [불변 규칙] Super Admin만 설정 가능 (RLS 정책)
   */
  async pinSchemaVersion(input: PinSchemaVersionInput): Promise<void> {
    const { error } = await this.supabase
      .from('meta.tenant_schema_pins')
      .upsert({
        tenant_id: input.tenant_id,
        entity: input.entity,
        industry_type: input.industry_type || null,
        pinned_version: input.pinned_version,
        reason: input.reason || null,
        pinned_by: (await this.supabase.auth.getUser()).data.user?.id || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to pin schema version: ${error.message}`);
    }
  }

  /**
   * Version Pinning 제거
   *
   * [불변 규칙] Super Admin만 제거 가능 (RLS 정책)
   */
  async unpinSchemaVersion(
    tenantId: string,
    entity: string,
    industryType: string | null
  ): Promise<void> {
    // ⚠️ 참고: meta.tenant_schema_pins는 tenant_id로 필터링
    // (meta 스키마는 RLS 정책이 다를 수 있지만, 규칙에 따라 withTenant() 사용)
    const { error } = await withTenant(
      this.supabase
      .from('meta.tenant_schema_pins')
      .delete()
      .eq('entity', entity)
        .eq('industry_type', industryType || null),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to unpin schema version: ${error.message}`);
    }
  }

  /**
   * DB row를 SchemaRegistryEntry로 변환
   *
   * min_supported_client (snake_case) → minSupportedClient (camelCase) 변환
   */
  private mapToEntry(row: Record<string, unknown>): SchemaRegistryEntry {
    return {
      id: row.id as string,
      entity: row.entity as string,
      industry_type: row.industry_type as string,
      version: row.version as string,
      min_supported_client: (row.min_supported_client as string | null) || '',
      schema_json: row.schema_json as UISchema,
      status: row.status as 'draft' | 'active' | 'deprecated',
      activated_at: row.activated_at as string | null,
    };
  }
}
