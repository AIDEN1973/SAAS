/**
 * Core Tenancy Onboarding Service
 * 
 * 테넌트 온보딩 서비스 (테넌트 생성 및 초기화)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * 
 * ⚠️ 주의: 업종별 초기 데이터 시드는 Industry Layer에서 처리합니다.
 * 이 서비스는 테넌트 생성, 기본 설정, 역할 할당만 담당합니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
// import { tenancyReferralService } from '@core/tenancy-referral/service'; // TODO: 추천인 기능 구현 시 활성화
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
   * 테넌트 생성 및 초기화
   * 
   * [불변 규칙] 다음 순서로 처리:
   * 1. tenants 테이블에 row 생성
   * 2. tenant_settings에 업종별 기본값 저장
   * 3. tenant_features에 플랜/기능 ON/OFF 설정
   * 4. owner 유저를 user_tenant_roles에 연결
   * 5. 추천인 코드 처리 (선택적)
   * 
   * ⚠️ 주의: 업종별 seed 실행은 Industry Layer에서 별도로 처리합니다.
   */
  async createTenant(input: CreateTenantInput): Promise<TenantOnboardingResult> {
    // 1. 테넌트 생성
    const tenant = await this.createTenantRecord(input);

    // 2. 테넌트 기본 설정 초기화
    await this.initializeTenantSettings(tenant.id, input.industry_type, input.plan || 'basic');

    // 3. 테넌트 기능 설정 초기화
    await this.initializeTenantFeatures(tenant.id, input.plan || 'basic');

    // 4. 소유자 역할 할당
    const userTenantRole = await this.assignOwnerRole(tenant.id, input.owner_user_id);

    // 5. 추천인 코드 처리 (선택적)
    if (input.referral_code) {
      await this.processReferralCode(input.referral_code, tenant.id);
    }

    return {
      tenant,
      user_tenant_role: userTenantRole,
    };
  }

  /**
   * 테넌트 레코드 생성
   * 
   * [불변 규칙] INSERT 시에는 tenant_id를 row object에 직접 포함하지 않습니다.
   * tenants 테이블은 tenant_id가 없습니다 (자체 PK).
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
      throw new Error(`테넌트 생성 실패: ${error.message}`);
    }

    return data as Tenant;
  }

  /**
   * 테넌트 기본 설정 초기화
   * 
   * [불변 규칙] INSERT 시에는 tenant_id를 row object에 직접 포함합니다.
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
        value: { timezone: 'Asia/Seoul' }, // KST 기본값
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
      throw new Error(`테넌트 설정 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 테넌트 기능 설정 초기화
   * 
   * [불변 규칙] INSERT 시에는 tenant_id를 row object에 직접 포함합니다.
   */
  private async initializeTenantFeatures(
    tenantId: string,
    plan: TenantPlan
  ): Promise<void> {
    // 플랜별 기본 기능 설정
    const features = [
      {
        tenant_id: tenantId,
        feature_key: 'attendance',
        enabled: true,
        quota: null, // 무제한
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
        enabled: plan !== 'basic', // basic 플랜은 메시징 제한
        quota: plan === 'basic' ? 100 : null, // basic 플랜은 월 100건 제한
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
      throw new Error(`테넌트 기능 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 소유자 역할 할당
   * 
   * [불변 규칙] INSERT 시에는 tenant_id를 row object에 직접 포함합니다.
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
      throw new Error(`소유자 역할 할당 실패: ${error.message}`);
    }

    return data as UserTenantRole;
  }

  /**
   * 추천인 코드 처리
   * 
   * [불변 규칙] core-tenancy-referral 서비스를 사용합니다.
   * ⚠️ 주의: Core Layer 간 의존성은 허용됩니다 (core-tenancy → core-tenancy-referral).
   */
  private async processReferralCode(
    referralCode: string,
    newTenantId: string
  ): Promise<void> {
    try {
      // 추천인 코드로 조회 (테넌트 필터링 없음)
      const { data: referralCodes, error: fetchError } = await this.supabase
        .from('referral_codes')
        .select('*')
        .eq('code', referralCode)
        .eq('is_active', true)
        .single();

      if (fetchError || !referralCodes) {
        // 추천인 코드가 없어도 에러를 발생시키지 않음 (선택적 기능)
        return;
      }

      // 추천인 코드 사용 기록
      // TODO: 추천인 기능 구현 시 활성화
      // await tenancyReferralService.useReferralCode(referralCodes.id, newTenantId);
    } catch (error) {
      // 추천인 코드 처리 실패는 전체 온보딩을 중단하지 않음
      console.warn('추천인 코드 처리 실패:', error);
    }
  }
}

/**
 * Default Service Instance
 */
export const tenantOnboardingService = new TenantOnboardingService();

