/**
 * Core Tenancy Referral Service
 *
 * B2B 추천인 코드 관리 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
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
   * 추천인 코드 목록 조회 (추천인 테넌트 기준)
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
   * 추천인 코드 상세 조회
   * ⚠️ 주의: referral_codes는 referrer_tenant_id를 사용하므로 직접 필터링
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
   * 추천인 코드로 조회 (테넌트 필터 포함)
   * ⚠️ 주의: referral_codes는 referrer_tenant_id를 사용하므로 직접 필터링
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
   * 추천인 코드 상세 조회 (테넌트 필터 없음 - useReferralCode에서 사용)
   * ⚠️ 주의: 신규 테넌트가 사용하는 경우 referrerTenantId를 모르므로 이 메서드 사용
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
   * 추천인 코드 생성
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
   * 추천인 코드 수정
   * ⚠️ 주의: referral_codes는 referrer_tenant_id를 사용하므로 직접 필터링
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
   * 추천인 코드 사용
   */
  async useReferralCode(
    referralCodeId: string,
    newTenantId: string
  ): Promise<ReferralUsage> {
    // 추천인 코드 유효성 검증
    // 참고: useReferralCode는 신규 테넌트가 호출하는 경우 referrerTenantId를 모름
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

    // 사용 기록 생성
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
   * 추천인 코드 사용 이력 조회
   * ⚠️ 주의: referral_usages는 new_tenant_id를 사용하므로 직접 필터링
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
   * 보상 적용
   * ⚠️ 주의: referral_usages는 new_tenant_id를 사용하므로 직접 필터링
   */
  async applyReward(
    newTenantId: string,
    usageId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('referral_usages')
      .update({
        reward_applied: true,
        // 기술문서 19-1-1: 타임스탬프는 UTC로 저장 (DB 저장 규칙)
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
