/**
 * Core Tenancy Service
 * 
 * 테넌시 서비스 (user_tenant_roles 기반)
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

    // Supabase join 결과 타입 안전하게 처리
    type UserTenantRoleWithTenant = {
      tenant_id: string;
      tenants: Tenant | Tenant[] | null;
    };

    return (data || [])
      .map((item: any) => {
        const tenants = item.tenants;
        // Supabase는 join 결과를 배열로 반환할 수 있음
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
 * Default Service Instance
 */
export const tenancyService = new TenancyService();

