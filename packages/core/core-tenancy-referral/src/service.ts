/**
 * Core Tenancy Referral Service
 * 
 * B2B ì¶”ì²œ??ì½”ë“œ ?œë„ ?œë¹„??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  ReferralCode,
  ReferralUsage,
  CreateReferralCodeInput,
  UpdateReferralCodeInput,
} from './types';

export class TenancyReferralService {
  private supabase = createServerClient();

  /**
   * ì¶”ì²œ??ì½”ë“œ ëª©ë¡ ì¡°íšŒ (ì¶”ì²œ???Œë„Œ??ê¸°ì?)
   */
  async getReferralCodes(
    referrerTenantId: string
  ): Promise<ReferralCode[]> {
    const { data, error } = await this.supabase
      .from('referral_codes')
      .select('*')
      .eq('referrer_tenant_id', referrerTenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch referral codes: ${error.message}`);
    }

    return (data || []) as ReferralCode[];
  }

  /**
   * ì¶”ì²œ??ì½”ë“œ ?ì„¸ ì¡°íšŒ
   * ? ï¸ ì£¼ì˜: referral_codes??referrer_tenant_idë¥??¬ìš©?˜ë?ë¡?ì§ì ‘ ?„í„°ë§?
   */
  async getReferralCode(
    referrerTenantId: string,
    referralCodeId: string
  ): Promise<ReferralCode | null> {
    const { data, error } = await this.supabase
      .from('referral_codes')
      .select('*')
      .eq('id', referralCodeId)
      .eq('referrer_tenant_id', referrerTenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch referral code: ${error.message}`);
    }

    return data as ReferralCode;
  }

  /**
   * ì¶”ì²œ??ì½”ë“œë¡?ì¡°íšŒ (?Œë„Œ???„í„°ë§??¬í•¨)
   * ? ï¸ ì£¼ì˜: referral_codes??referrer_tenant_idë¥??¬ìš©?˜ë?ë¡?ì§ì ‘ ?„í„°ë§?
   */
  async getReferralCodeByCode(
    referrerTenantId: string,
    code: string
  ): Promise<ReferralCode | null> {
    const { data, error } = await this.supabase
      .from('referral_codes')
      .select('*')
      .eq('code', code)
      .eq('referrer_tenant_id', referrerTenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch referral code: ${error.message}`);
    }

    return data as ReferralCode;
  }

  /**
   * ì¶”ì²œ??ì½”ë“œ ?ì„¸ ì¡°íšŒ (?Œë„Œ???„í„°ë§??†ìŒ - useReferralCode?ì„œ ?¬ìš©)
   * ? ï¸ ì£¼ì˜: ? ê·œ ?Œë„Œ??ê°€????referrerTenantIdë¥??????†ìœ¼ë¯€ë¡???ë©”ì„œ???¬ìš©
   */
  private async getReferralCodeWithoutTenant(
    referralCodeId: string
  ): Promise<ReferralCode | null> {
    const { data, error } = await this.supabase
      .from('referral_codes')
      .select('*')
      .eq('id', referralCodeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch referral code: ${error.message}`);
    }

    return data as ReferralCode;
  }

  /**
   * ì¶”ì²œ??ì½”ë“œ ?ì„±
   */
  async createReferralCode(
    referrerTenantId: string,
    input: CreateReferralCodeInput
  ): Promise<ReferralCode> {
    const { data, error } = await this.supabase
      .from('referral_codes')
      .insert({
        referrer_tenant_id: referrerTenantId,
        code: input.code,
        reward_type: input.reward_type,
        reward_value: input.reward_value,
        is_active: input.is_active ?? true,
        expires_at: input.expires_at,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create referral code: ${error.message}`);
    }

    return data as ReferralCode;
  }

  /**
   * ì¶”ì²œ??ì½”ë“œ ?˜ì •
   * ? ï¸ ì£¼ì˜: referral_codes??referrer_tenant_idë¥??¬ìš©?˜ë?ë¡?ì§ì ‘ ?„í„°ë§?
   */
  async updateReferralCode(
    referrerTenantId: string,
    referralCodeId: string,
    input: UpdateReferralCodeInput
  ): Promise<ReferralCode> {
    const { data, error } = await this.supabase
      .from('referral_codes')
      .update(input)
      .eq('id', referralCodeId)
      .eq('referrer_tenant_id', referrerTenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update referral code: ${error.message}`);
    }

    return data as ReferralCode;
  }

  /**
   * ì¶”ì²œ??ì½”ë“œ ?¬ìš©
   */
  async useReferralCode(
    referralCodeId: string,
    newTenantId: string
  ): Promise<ReferralUsage> {
    // ì¶”ì²œ??ì½”ë“œ ? íš¨??ê²€ì¦?
    // ì°¸ê³ : useReferralCode??? ê·œ ?Œë„Œ??ê°€?????¸ì¶œ?˜ë?ë¡?referrerTenantIdë¥??????†ìŒ
    const referralCode = await this.getReferralCodeWithoutTenant(referralCodeId);
    if (!referralCode) {
      throw new Error('Referral code not found');
    }

    if (!referralCode.is_active) {
      throw new Error('Referral code is not active');
    }

    if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
      throw new Error('Referral code has expired');
    }

    // ?¬ìš© ê¸°ë¡ ?ì„±
    const { data, error } = await this.supabase
      .from('referral_usages')
      .insert({
        referral_code_id: referralCodeId,
        new_tenant_id: newTenantId,
        reward_applied: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record referral usage: ${error.message}`);
    }

    return data as ReferralUsage;
  }

  /**
   * ì¶”ì²œ??ì½”ë“œ ?¬ìš© ?´ì—­ ì¡°íšŒ
   * ? ï¸ ì£¼ì˜: referral_usages??new_tenant_idë¥??¬ìš©?˜ë?ë¡?ì§ì ‘ ?„í„°ë§?
   */
  async getReferralUsages(
    tenantId: string,
    referralCodeId?: string
  ): Promise<ReferralUsage[]> {
    let query = this.supabase
      .from('referral_usages')
      .select('*')
      .eq('new_tenant_id', tenantId);

    if (referralCodeId) {
      query = query.eq('referral_code_id', referralCodeId);
    }

    query = query.order('used_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch referral usages: ${error.message}`);
    }

    return (data || []) as ReferralUsage[];
  }

  /**
   * ë³´ìƒ ?ìš©
   * ? ï¸ ì£¼ì˜: referral_usages??new_tenant_idë¥??¬ìš©?˜ë?ë¡?ì§ì ‘ ?„í„°ë§?
   */
  async applyReward(
    newTenantId: string,
    usageId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('referral_usages')
      .update({
        reward_applied: true,
        reward_applied_at: new Date().toISOString(),
      })
      .eq('id', usageId)
      .eq('new_tenant_id', newTenantId);

    if (error) {
      throw new Error(`Failed to apply reward: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const tenancyReferralService = new TenancyReferralService();

