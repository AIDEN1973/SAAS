/**
 * Core Tenancy Referral Types
 * 
 * B2B ì¶”ì²œ??ì½”ë“œ ?œë„ (SaaS ?¬ìš©??ê°?ì¶”ì²œ ?œìŠ¤??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
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

