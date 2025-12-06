/**
 * Core Config Service
 * 
 * 환경설정 서비스 (tenant_settings 테이블 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type { TenantConfig, UpdateConfigInput } from './types';

export class ConfigService {
  private supabase = createServerClient();

  /**
   * 테넌트 설정 조회
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
   * 테넌트 설정 업데이트
   */
  async updateConfig(
    tenantId: string,
    input: UpdateConfigInput
  ): Promise<TenantConfig> {
    // 기존 설정 조회
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
   * 특정 설정 키 조회
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
   * 특정 설정 키 업데이트
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

