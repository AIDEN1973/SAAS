/**
 * Core Tenancy Referral Types
 * 
 * B2B 추천인 코드 제도 (SaaS 사용자 간 추천 시스템)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type RewardType = 'discount' | 'credit' | 'free_trial';

export interface ReferralCode {
  id: string;
  referrer_tenant_id: string;
  code: string;
  reward_type: RewardType;
  reward_value?: number;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export interface ReferralUsage {
  id: string;
  referral_code_id: string;
  new_tenant_id: string;
  used_at: string;
  reward_applied: boolean;
  reward_applied_at?: string;
}

export interface CreateReferralCodeInput {
  code: string;
  reward_type: RewardType;
  reward_value?: number;
  is_active?: boolean;
  expires_at?: string;
}

export interface UpdateReferralCodeInput {
  reward_type?: RewardType;
  reward_value?: number;
  is_active?: boolean;
  expires_at?: string;
}

