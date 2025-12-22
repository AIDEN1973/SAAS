/**
 * Core Tenancy Service
 *
 * 테넌트 서비스(user_tenant_roles 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  UserTenantRole,
  Tenant,
  CreateUserTenantRoleInput,
  TenantRole,
} from './types';

/**
 * 테넌트 기능 타입 정의
 * SSOT: 프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조
 */
export interface TenantFeature {
  id: string;
  tenant_id: string;
  feature_key: string;
  enabled: boolean;
  quota: number | null;
  created_at: string;
  updated_at: string;
}

export class TenancyService {
  private supabase = createServerClient();

  /**
   * 사용자의 테넌트 목록 조회
   */
  async getUserTenants(userId: string): Promise<Tenant[]> {
    const { data, error } = await this.supabase
      .from('user_tenant_roles')
      .select(`
        tenant_id,
        tenants (
          id,
          name,
          industry_type,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch user tenants: ${error.message}`);
    }

    // Supabase join 결과를 안전하게 처리
    type UserTenantRoleWithTenant = {
      tenant_id: string;
      tenants: Tenant | Tenant[] | null;
    };

    return (data || [])
      .map((item) => {
        const itemWithTenant = item as UserTenantRoleWithTenant;
        const tenants = itemWithTenant.tenants;
        // Supabase의 join 결과가 배열로 반환되는 경우 처리
        if (Array.isArray(tenants)) {
          return tenants[0] || null;
        }
        return tenants;
      })
      .filter((tenant): tenant is Tenant => tenant !== null);
  }

  /**
   * 테넌트의 사용자 역할 목록 조회
   */
  async getTenantUsers(tenantId: string): Promise<UserTenantRole[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('user_tenant_roles')
        .select('*'),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch tenant users: ${error.message}`);
    }

    return (data || []) as UserTenantRole[];
  }

  /**
   * 사용자 역할 할당
   */
  async assignRole(
    input: CreateUserTenantRoleInput
  ): Promise<UserTenantRole> {
    const { data, error } = await this.supabase
      .from('user_tenant_roles')
      .insert({
        user_id: input.user_id,
        tenant_id: input.tenant_id,
        role: input.role,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign role: ${error.message}`);
    }

    return data as UserTenantRole;
  }

  /**
   * 사용자 역할 변경
   */
  async updateRole(
    userId: string,
    tenantId: string,
    role: TenantRole
  ): Promise<UserTenantRole> {
    const { data, error } = await withTenant(
      this.supabase
        .from('user_tenant_roles')
        .update({ role })
        .eq('user_id', userId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update role: ${error.message}`);
    }

    return data as UserTenantRole;
  }

  /**
   * 사용자 역할 제거
   */
  async removeRole(userId: string, tenantId: string): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('user_tenant_roles')
        .delete()
        .eq('user_id', userId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to remove role: ${error.message}`);
    }
  }

  /**
   * 테넌트 조회
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch tenant: ${error.message}`);
    }

    return data as Tenant;
  }
}

/**
 * 테넌트 기능 서비스
 * SSOT: 프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조
 */
export class TenantFeatureService {
  private supabase = createServerClient();

  /**
   * 테넌트의 특정 기능 조회
   * @param tenantId 테넌트 ID
   * @param featureKey 기능 키 (예: 'ai')
   * @returns 기능 정보 또는 null
   */
  async getTenantFeature(tenantId: string, featureKey: string): Promise<TenantFeature | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('tenant_features')
        .select('*')
        .eq('feature_key', featureKey),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 레코드가 없으면 null 반환 (기본값: enabled = true)
        return null;
      }
      throw new Error(`Failed to fetch tenant feature: ${error.message}`);
    }

    return data as TenantFeature;
  }

  /**
   * 테넌트 기능 업데이트
   * @param tenantId 테넌트 ID
   * @param featureKey 기능 키
   * @param enabled 활성화 여부
   */
  async updateTenantFeature(
    tenantId: string,
    featureKey: string,
    enabled: boolean
  ): Promise<TenantFeature> {
    // 먼저 기존 레코드 확인
    const existing = await this.getTenantFeature(tenantId, featureKey);

    if (existing) {
      // 업데이트
      const { data, error } = await withTenant(
        this.supabase
          .from('tenant_features')
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq('feature_key', featureKey)
          .select(),
        tenantId
      ).single();

      if (error) {
        throw new Error(`Failed to update tenant feature: ${error.message}`);
      }

      return data as TenantFeature;
    } else {
      // 새로 생성
      const { data, error } = await withTenant(
        this.supabase
          .from('tenant_features')
          .insert({
            feature_key: featureKey,
            enabled,
            quota: null,
          })
          .select(),
        tenantId
      ).single();

      if (error) {
        throw new Error(`Failed to create tenant feature: ${error.message}`);
      }

      return data as TenantFeature;
    }
  }
}

/**
 * Default Service Instance
 */
export const tenancyService = new TenancyService();
export const tenantFeatureService = new TenantFeatureService();
