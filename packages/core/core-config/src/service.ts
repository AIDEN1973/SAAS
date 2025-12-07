/**
 * Core Config Service
 * 
 * ?˜ê²½?¤ì • ?œë¹„??(tenant_settings ?Œì´ë¸?ê¸°ë°˜)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type { TenantConfig, UpdateConfigInput } from './types';

export class ConfigService {
  private supabase = createServerClient();

  /**
   * ?Œë„Œ???¤ì • ì¡°íšŒ
   */
  async getConfig(tenantId: string): Promise<TenantConfig | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('tenant_settings')
        .select('settings'),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch config: ${error.message}`);
    }

    return (data?.settings as TenantConfig) || null;
  }

  /**
   * ?Œë„Œ???¤ì • ?…ë°?´íŠ¸
   */
  async updateConfig(
    tenantId: string,
    input: UpdateConfigInput
  ): Promise<TenantConfig> {
    // ê¸°ì¡´ ?¤ì • ì¡°íšŒ
    const existing = await this.getConfig(tenantId);
    const merged = { ...existing, ...input };

    const { data, error } = await this.supabase
      .from('tenant_settings')
      .upsert({
        tenant_id: tenantId,
        settings: merged,
        updated_at: new Date().toISOString(),
      })
      .select('settings')
      .single();

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }

    return data.settings as TenantConfig;
  }

  /**
   * ?¹ì • ?¤ì • ??ì¡°íšŒ
   */
  async getConfigValue<T = any>(
    tenantId: string,
    key: string
  ): Promise<T | null> {
    const config = await this.getConfig(tenantId);
    if (!config) return null;

    const keys = key.split('.');
    let value: any = config;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }
    return value as T;
  }

  /**
   * ?¹ì • ?¤ì • ???…ë°?´íŠ¸
   */
  async setConfigValue(
    tenantId: string,
    key: string,
    value: any
  ): Promise<void> {
    const config = await this.getConfig(tenantId) || {};
    const keys = key.split('.');
    
    let current: any = config;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    current[keys[keys.length - 1]] = value;

    await this.updateConfig(tenantId, config);
  }
}

/**
 * Default Service Instance
 */
export const configService = new ConfigService();

