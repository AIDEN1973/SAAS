/**
 * Schema Registry Service
 * 
 * [불�? 규칙] 기술문서 PART 1??5. Schema Registry ?�영 문서�?준?�합?�다.
 * [불�? 규칙] meta.schema_registry??공통 ?�키�??�?�소?��?�?tenant_id 컬럼???�습?�다.
 * [불�? 규칙] SELECT 쿼리??withTenant�??�용?��? ?�습?�다 (공통 ?�키마이므�?.
 * 
 * 기술문서: docu/?�키마엔�?txt 4. Schema Registry (DB + RLS)
 */

import { createServerClient } from '@lib/supabase-client/server';
import type { FormSchema, TableSchema, UISchema } from '@schema/engine/types';
import { SchemaRegistryClient, type SchemaRegistryEntry } from '@schema/engine/registry/client';

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
 * ?�키�??�록, 조회, ?�성?? Version Pinning???�당?�니??
 */
export class SchemaRegistryService {
  private supabase = createServerClient();

  /**
   * ?�키�??�록
   * 
   * [불�? 규칙] status??기본?�으�?'draft'�??�정?�니??
   * [불�? 규칙] Super Admin�??�록 가??(RLS ?�책)
   */
  async registerSchema(input: RegisterSchemaInput): Promise<SchemaRegistryEntry> {
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
   * ?�키�?조회 (?�선?�위 ?�용)
   * 
   * SchemaRegistryClient??resolveSchema 로직???�용?�니??
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

    // 1. ?�넌?�별 Version Pinning 조회
    let pinnedVersion: string | null = null;
    if (options.tenantId) {
      const pin = await this.getPinnedVersion(
        options.tenantId,
        entity,
        options.industryType || null
      );
      pinnedVersion = pin?.pinned_version || null;
    }

    // 2. 모든 ?�성 ?�키�?조회 (getActiveSchemas???��? status='active'�??�터�?
    const entries = await this.getActiveSchemas(entity, options.industryType || null);

    // 3. ?�선?�위???�라 ?�키�?결정
    // pinnedVersion???�으�??�당 버전�??�터�?
    // ?�️ 중요: resolveSchema???��? ?�터링된 entries�?받아???�선?�위???�라 ?�택?�니??
    // getActiveSchemas???��? status='active'�??�터링하므�? ?�기?�는 version�??�터링합?�다.
    const filteredEntries = pinnedVersion
      ? entries.filter((e) => e.version === pinnedVersion)
      : entries;

    return client.resolveSchema(entity, filteredEntries);
  }

  /**
   * ?�성 ?�키�?목록 조회
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

    // industry_type ?�터
    if (industryType !== null) {
      query = query.or(`industry_type.eq.${industryType},industry_type.is.null`);
    } else {
      query = query.is('industry_type', null);
    }

    const { data, error } = await query.order('version', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active schemas: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToEntry(row));
  }

  /**
   * ?�키�??�성??
   * 
   * [불�? 규칙] Super Admin�??�성??가??(RLS ?�책)
   */
  async activateSchema(input: ActivateSchemaInput): Promise<SchemaRegistryEntry> {
    // 1. 기존 active 스키마를 deprecated로 변경
    const { error: deprecateError } = await this.supabase
      .from('meta.schema_registry')
      .update({
        status: 'deprecated',
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
   * ?�키�?비활?�화 (Deprecated)
   * 
   * [불�? 규칙] Super Admin�?비활?�화 가??(RLS ?�책)
   */
  async deprecateSchema(input: ActivateSchemaInput): Promise<SchemaRegistryEntry> {
    const { data, error } = await this.supabase
      .from('meta.schema_registry')
      .update({
        status: 'deprecated',
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
    const { data, error } = await this.supabase
      .from('meta.tenant_schema_pins')
      .select('pinned_version')
      .eq('tenant_id', tenantId)
      .eq('entity', entity)
      .eq('industry_type', industryType || null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch pinned version: ${error.message}`);
    }

    return data;
  }

  /**
   * Version Pinning ?�정
   * 
   * [불�? 규칙] Super Admin�??�정 가??(RLS ?�책)
   */
  async pinSchemaVersion(input: PinSchemaVersionInput): Promise<void> {
    const { data, error } = await this.supabase
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
   * Version Pinning ?�제
   * 
   * [불�? 규칙] Super Admin�??�제 가??(RLS ?�책)
   */
  async unpinSchemaVersion(
    tenantId: string,
    entity: string,
    industryType: string | null
  ): Promise<void> {
    const { error } = await this.supabase
      .from('meta.tenant_schema_pins')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('entity', entity)
      .eq('industry_type', industryType || null);

    if (error) {
      throw new Error(`Failed to unpin schema version: ${error.message}`);
    }
  }

  /**
   * DB row�?SchemaRegistryEntry�?변??
   * 
   * min_supported_client (snake_case) ??minSupportedClient (camelCase) 변??
   */
  private mapToEntry(row: any): SchemaRegistryEntry {
    return {
      id: row.id,
      entity: row.entity,
      industry_type: row.industry_type,
      version: row.version,
      min_supported_client: row.min_supported_client,
      schema_json: row.schema_json as UISchema,
      status: row.status,
      activated_at: row.activated_at,
    };
  }
}

