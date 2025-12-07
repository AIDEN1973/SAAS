/**
 * Schema Registry Service
 * 
 * [ë¶ˆë? ê·œì¹™] ê¸°ìˆ ë¬¸ì„œ PART 1??5. Schema Registry ?´ì˜ ë¬¸ì„œë¥?ì¤€?˜í•©?ˆë‹¤.
 * [ë¶ˆë? ê·œì¹™] meta.schema_registry??ê³µí†µ ?¤í‚¤ë§??€?¥ì†Œ?´ë?ë¡?tenant_id ì»¬ëŸ¼???†ìŠµ?ˆë‹¤.
 * [ë¶ˆë? ê·œì¹™] SELECT ì¿¼ë¦¬??withTenantë¥??¬ìš©?˜ì? ?ŠìŠµ?ˆë‹¤ (ê³µí†µ ?¤í‚¤ë§ˆì´ë¯€ë¡?.
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—”ì§?txt 4. Schema Registry (DB + RLS)
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
 * ?¤í‚¤ë§??±ë¡, ì¡°íšŒ, ?œì„±?? Version Pinning???´ë‹¹?©ë‹ˆ??
 */
export class SchemaRegistryService {
  private supabase = createServerClient();

  /**
   * ?¤í‚¤ë§??±ë¡
   * 
   * [ë¶ˆë? ê·œì¹™] status??ê¸°ë³¸?ìœ¼ë¡?'draft'ë¡??¤ì •?©ë‹ˆ??
   * [ë¶ˆë? ê·œì¹™] Super Adminë§??±ë¡ ê°€??(RLS ?•ì±…)
   */
  async registerSchema(input: RegisterSchemaInput): Promise<SchemaRegistryEntry> {
    const { data, error } = await this.supabase
      .from('meta.schema_registry')
      .insert({
        entity: input.entity,
        industry_type: input.industry_type || null,
        version: input.version,
        min_supported_client: input.minSupportedClient,  // camelCase ??snake_case ë³€??
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
   * ?¤í‚¤ë§?ì¡°íšŒ (?°ì„ ?œìœ„ ?ìš©)
   * 
   * SchemaRegistryClient??resolveSchema ë¡œì§???¬ìš©?©ë‹ˆ??
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

    // 1. ?Œë„Œ?¸ë³„ Version Pinning ì¡°íšŒ
    let pinnedVersion: string | null = null;
    if (options.tenantId) {
      const pin = await this.getPinnedVersion(
        options.tenantId,
        entity,
        options.industryType || null
      );
      pinnedVersion = pin?.pinned_version || null;
    }

    // 2. ëª¨ë“  ?œì„± ?¤í‚¤ë§?ì¡°íšŒ (getActiveSchemas???´ë? status='active'ë¡??„í„°ë§?
    const entries = await this.getActiveSchemas(entity, options.industryType || null);

    // 3. ?°ì„ ?œìœ„???°ë¼ ?¤í‚¤ë§?ê²°ì •
    // pinnedVersion???ˆìœ¼ë©??´ë‹¹ ë²„ì „ë§??„í„°ë§?
    // ? ï¸ ì¤‘ìš”: resolveSchema???´ë? ?„í„°ë§ëœ entriesë¥?ë°›ì•„???°ì„ ?œìœ„???°ë¼ ? íƒ?©ë‹ˆ??
    // getActiveSchemas???´ë? status='active'ë¡??„í„°ë§í•˜ë¯€ë¡? ?¬ê¸°?œëŠ” versionë§??„í„°ë§í•©?ˆë‹¤.
    const filteredEntries = pinnedVersion
      ? entries.filter((e) => e.version === pinnedVersion)
      : entries;

    return client.resolveSchema(entity, filteredEntries);
  }

  /**
   * ?œì„± ?¤í‚¤ë§?ëª©ë¡ ì¡°íšŒ
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

    // industry_type ?„í„°
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
   * ?¤í‚¤ë§??œì„±??
   * 
   * [ë¶ˆë? ê·œì¹™] Super Adminë§??œì„±??ê°€??(RLS ?•ì±…)
   */
  async activateSchema(input: ActivateSchemaInput): Promise<SchemaRegistryEntry> {
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
   * ?¤í‚¤ë§?ë¹„í™œ?±í™” (Deprecated)
   * 
   * [ë¶ˆë? ê·œì¹™] Super Adminë§?ë¹„í™œ?±í™” ê°€??(RLS ?•ì±…)
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
   * Version Pinning ì¡°íšŒ
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
   * Version Pinning ?¤ì •
   * 
   * [ë¶ˆë? ê·œì¹™] Super Adminë§??¤ì • ê°€??(RLS ?•ì±…)
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
   * Version Pinning ?´ì œ
   * 
   * [ë¶ˆë? ê·œì¹™] Super Adminë§??´ì œ ê°€??(RLS ?•ì±…)
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
   * DB rowë¥?SchemaRegistryEntryë¡?ë³€??
   * 
   * min_supported_client (snake_case) ??minSupportedClient (camelCase) ë³€??
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

