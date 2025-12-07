/**
 * Core Tenancy Types
 * 
 * 테넌시 (user_tenant_roles 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type TenantRole = 'owner' | 'admin' | 'sub_admin' | 'manager' | 'staff' | 'teacher' | 'assistant' | 'counselor' | 'parent' | 'super_admin';

export type IndustryType = 'academy' | 'salon' | 'realestate' | 'gym' | 'ngo';

export type TenantPlan = 'basic' | 'premium' | 'enterprise';

export type TenantStatus = 'active' | 'paused' | 'closed' | 'deleting';

export interface UserTenantRole {
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  industry_type: IndustryType;
  plan: TenantPlan;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateUserTenantRoleInput {
  user_id: string;
  tenant_id: string;
  role: TenantRole;
}

/**
 * 테넌트 생성 입력
 */
export interface CreateTenantInput {
  name: string;
  industry_type: IndustryType;
  owner_user_id: string;
  plan?: TenantPlan;
  referral_code?: string;
}

/**
 * 테넌트 온보딩 결과
 */
export interface TenantOnboardingResult {
  tenant: Tenant;
  user_tenant_role: UserTenantRole;
}

