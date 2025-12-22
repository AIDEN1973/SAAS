/**
 * Core Tenancy Types
 *
 * 테넌트(user_tenant_roles 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type TenantRole =
  | 'owner'
  | 'admin'
  | 'sub_admin'
  | 'manager'
  | 'staff'
  | 'instructor'  // 업종 중립 정본 키 (academy: 강사, salon: 스타일리스트 등)
  | 'teacher'  // backward compatibility (deprecated, use instructor)
  | 'assistant'
  | 'counselor'
  | 'guardian'  // 업종 중립 정본 키 (academy: 학부모, salon: 고객 등)
  | 'parent'  // backward compatibility (deprecated, use guardian)
  | 'super_admin';

export type IndustryType = 'academy' | 'salon' | 'real_estate' | 'gym' | 'ngo';  // 정본: real_estate (언더스코어 필수)

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
