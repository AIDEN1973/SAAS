/**
 * Core Tenancy Types
 * 
 * 테넌시 (user_tenant_roles 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type TenantRole = 'owner' | 'manager' | 'staff' | 'teacher' | 'parent' | 'super_admin';

export interface UserTenantRole {
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  industry_type?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserTenantRoleInput {
  user_id: string;
  tenant_id: string;
  role: TenantRole;
}

