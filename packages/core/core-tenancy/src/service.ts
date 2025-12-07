/**
 * Core Tenancy Service
 * 
 * ?Œë„Œ???œë¹„??(user_tenant_roles ê¸°ë°˜)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
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
   * ?¬ìš©?ì˜ ?Œë„Œ??ëª©ë¡ ì¡°íšŒ
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

    // Supabase join ê²°ê³¼ ?€???ˆì „?˜ê²Œ ì²˜ë¦¬
    type UserTenantRoleWithTenant = {
      tenant_id: string;
      tenants: Tenant | Tenant[] | null;
    };

    return (data || [])
      .map((item: any) => {
        const tenants = item.tenants;
        // Supabase??join ê²°ê³¼ë¥?ë°°ì—´ë¡?ë°˜í™˜?????ˆìŒ
        if (Array.isArray(tenants)) {
          return tenants[0] || null;
        }
        return tenants;
      })
      .filter((tenant): tenant is Tenant => tenant !== null);
  }

  /**
   * ?Œë„Œ?¸ì˜ ?¬ìš©????•  ëª©ë¡ ì¡°íšŒ
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
   * ?¬ìš©????•  ? ë‹¹
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
   * ?¬ìš©????•  ë³€ê²?
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
   * ?¬ìš©????•  ?œê±°
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
   * ?Œë„Œ??ì¡°íšŒ
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

