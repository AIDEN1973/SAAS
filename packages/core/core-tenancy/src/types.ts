/**
 * Core Tenancy Types
 * 
 * ?Œë„Œ??(user_tenant_roles ê¸°ë°˜)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
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
 * ?Œë„Œ???ì„± ?…ë ¥
 */
export interface CreateTenantInput {
  name: string;
  industry_type: IndustryType;
  owner_user_id: string;
  plan?: TenantPlan;
  referral_code?: string;
}

/**
 * ?Œë„Œ???¨ë³´??ê²°ê³¼
 */
export interface TenantOnboardingResult {
  tenant: Tenant;
  user_tenant_role: UserTenantRole;
}

