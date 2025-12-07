/**
 * Core Tenancy Onboarding Service
 * 
 * ?Œë„Œ???¨ë³´???œë¹„??(?Œë„Œ???ì„± ë°?ì´ˆê¸°??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì£¼ì˜: ?…ì¢…ë³?ì´ˆê¸° ?°ì´???œë“œ??Industry Layer?ì„œ ì²˜ë¦¬?©ë‹ˆ??
 * ???œë¹„?¤ëŠ” ?Œë„Œ???ì„±, ê¸°ë³¸ ?¤ì •, ??•  ? ë‹¹ë§??´ë‹¹?©ë‹ˆ??
 */

import { createServerClient } from '@lib/supabase-client/server';
// import { tenancyReferralService } from '@core/tenancy-referral/service'; // TODO: ì¶”ì²œ??ê¸°ëŠ¥ êµ¬í˜„ ???œì„±??
import type {
  CreateTenantInput,
  TenantOnboardingResult,
  Tenant,
  UserTenantRole,
  TenantPlan,
} from './types';

export class TenantOnboardingService {
  private supabase = createServerClient();

  /**
   * ?Œë„Œ???ì„± ë°?ì´ˆê¸°??
   * 
   * [ë¶ˆë? ê·œì¹™] ?¤ìŒ ?œì„œë¡?ì²˜ë¦¬:
   * 1. tenants ?Œì´ë¸”ì— row ?ì„±
   * 2. tenant_settings???…ì¢…ë³?ê¸°ë³¸ê°??€??
   * 3. tenant_features???Œëœ/ê¸°ëŠ¥ ON/OFF ?¤ì •
   * 4. owner ? ì?ë¥?user_tenant_roles???°ê²°
   * 5. ì¶”ì²œ??ì½”ë“œ ì²˜ë¦¬ (? íƒ??
   * 
   * ? ï¸ ì£¼ì˜: ?…ì¢…ë³?seed ?¤í–‰?€ Industry Layer?ì„œ ë³„ë„ë¡?ì²˜ë¦¬?©ë‹ˆ??
   */
  async createTenant(input: CreateTenantInput): Promise<TenantOnboardingResult> {
    // 1. ?Œë„Œ???ì„±
    const tenant = await this.createTenantRecord(input);

    // 2. ?Œë„Œ??ê¸°ë³¸ ?¤ì • ì´ˆê¸°??
    await this.initializeTenantSettings(tenant.id, input.industry_type, input.plan || 'basic');

    // 3. ?Œë„Œ??ê¸°ëŠ¥ ?¤ì • ì´ˆê¸°??
    await this.initializeTenantFeatures(tenant.id, input.plan || 'basic');

    // 4. ?Œìœ ????•  ? ë‹¹
    const userTenantRole = await this.assignOwnerRole(tenant.id, input.owner_user_id);

    // 5. ì¶”ì²œ??ì½”ë“œ ì²˜ë¦¬ (? íƒ??
    if (input.referral_code) {
      await this.processReferralCode(input.referral_code, tenant.id);
    }

    return {
      tenant,
      user_tenant_role: userTenantRole,
    };
  }

  /**
   * ?Œë„Œ???ˆì½”???ì„±
   * 
   * [ë¶ˆë? ê·œì¹™] INSERT ?œì—??tenant_idë¥?row object??ì§ì ‘ ?¬í•¨?˜ì? ?ŠìŠµ?ˆë‹¤.
   * tenants ?Œì´ë¸”ì? tenant_idê°€ ?†ìŠµ?ˆë‹¤ (?ì²´ PK).
   */
  private async createTenantRecord(input: CreateTenantInput): Promise<Tenant> {
    const { data, error } = await this.supabase
      .from('tenants')
      .insert({
        name: input.name,
        industry_type: input.industry_type,
        plan: input.plan || 'basic',
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`?Œë„Œ???ì„± ?¤íŒ¨: ${error.message}`);
    }

    return data as Tenant;
  }

  /**
   * ?Œë„Œ??ê¸°ë³¸ ?¤ì • ì´ˆê¸°??
   * 
   * [ë¶ˆë? ê·œì¹™] INSERT ?œì—??tenant_idë¥?row object??ì§ì ‘ ?¬í•¨?©ë‹ˆ??
   */
  private async initializeTenantSettings(
    tenantId: string,
    industryType: string,
    plan: TenantPlan
  ): Promise<void> {
    const defaultSettings = [
      {
        tenant_id: tenantId,
        key: 'timezone',
        value: { timezone: 'Asia/Seoul' }, // KST ê¸°ë³¸ê°?
      },
      {
        tenant_id: tenantId,
        key: 'locale',
        value: { locale: 'ko-KR' },
      },
      {
        tenant_id: tenantId,
        key: 'industry',
        value: { industry_type: industryType },
      },
    ];

    const { error } = await this.supabase
      .from('tenant_settings')
      .insert(defaultSettings);

    if (error) {
      throw new Error(`?Œë„Œ???¤ì • ì´ˆê¸°???¤íŒ¨: ${error.message}`);
    }
  }

  /**
   * ?Œë„Œ??ê¸°ëŠ¥ ?¤ì • ì´ˆê¸°??
   * 
   * [ë¶ˆë? ê·œì¹™] INSERT ?œì—??tenant_idë¥?row object??ì§ì ‘ ?¬í•¨?©ë‹ˆ??
   */
  private async initializeTenantFeatures(
    tenantId: string,
    plan: TenantPlan
  ): Promise<void> {
    // ?Œëœë³?ê¸°ë³¸ ê¸°ëŠ¥ ?¤ì •
    const features = [
      {
        tenant_id: tenantId,
        feature_key: 'attendance',
        enabled: true,
        quota: null, // ë¬´ì œ??
      },
      {
        tenant_id: tenantId,
        feature_key: 'billing',
        enabled: true,
        quota: null,
      },
      {
        tenant_id: tenantId,
        feature_key: 'messaging',
        enabled: plan !== 'basic', // basic ?Œëœ?€ ë©”ì‹œì§??œí•œ
        quota: plan === 'basic' ? 100 : null, // basic ?Œëœ?€ ??100ê±??œí•œ
      },
      {
        tenant_id: tenantId,
        feature_key: 'analytics',
        enabled: plan !== 'basic',
        quota: null,
      },
    ];

    const { error } = await this.supabase
      .from('tenant_features')
      .insert(features);

    if (error) {
      throw new Error(`?Œë„Œ??ê¸°ëŠ¥ ì´ˆê¸°???¤íŒ¨: ${error.message}`);
    }
  }

  /**
   * ?Œìœ ????•  ? ë‹¹
   * 
   * [ë¶ˆë? ê·œì¹™] INSERT ?œì—??tenant_idë¥?row object??ì§ì ‘ ?¬í•¨?©ë‹ˆ??
   */
  private async assignOwnerRole(
    tenantId: string,
    ownerUserId: string
  ): Promise<UserTenantRole> {
    const { data, error } = await this.supabase
      .from('user_tenant_roles')
      .insert({
        user_id: ownerUserId,
        tenant_id: tenantId,
        role: 'owner',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`?Œìœ ????•  ? ë‹¹ ?¤íŒ¨: ${error.message}`);
    }

    return data as UserTenantRole;
  }

  /**
   * ì¶”ì²œ??ì½”ë“œ ì²˜ë¦¬
   * 
   * [ë¶ˆë? ê·œì¹™] core-tenancy-referral ?œë¹„?¤ë? ?¬ìš©?©ë‹ˆ??
   * ? ï¸ ì£¼ì˜: Core Layer ê°??˜ì¡´?±ì? ?ˆìš©?©ë‹ˆ??(core-tenancy ??core-tenancy-referral).
   */
  private async processReferralCode(
    referralCode: string,
    newTenantId: string
  ): Promise<void> {
    try {
      // ì¶”ì²œ??ì½”ë“œë¡?ì¡°íšŒ (?Œë„Œ???„í„°ë§??†ìŒ)
      const { data: referralCodes, error: fetchError } = await this.supabase
        .from('referral_codes')
        .select('*')
        .eq('code', referralCode)
        .eq('is_active', true)
        .single();

      if (fetchError || !referralCodes) {
        // ì¶”ì²œ??ì½”ë“œê°€ ?†ì–´???ëŸ¬ë¥?ë°œìƒ?œí‚¤ì§€ ?ŠìŒ (? íƒ??ê¸°ëŠ¥)
        return;
      }

      // ì¶”ì²œ??ì½”ë“œ ?¬ìš© ê¸°ë¡
      // TODO: ì¶”ì²œ??ê¸°ëŠ¥ êµ¬í˜„ ???œì„±??
      // await tenancyReferralService.useReferralCode(referralCodes.id, newTenantId);
    } catch (error) {
      // ì¶”ì²œ??ì½”ë“œ ì²˜ë¦¬ ?¤íŒ¨???„ì²´ ?¨ë³´?©ì„ ì¤‘ë‹¨?˜ì? ?ŠìŒ
      console.warn('ì¶”ì²œ??ì½”ë“œ ì²˜ë¦¬ ?¤íŒ¨:', error);
    }
  }
}

/**
 * Default Service Instance
 */
export const tenantOnboardingService = new TenantOnboardingService();

