/**
 * Core Tenancy Onboarding Service
 *
 * 테넌트 온보딩 프로세스(테넌트 생성 및 초기화)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 주의: 업종별 초기 데이터/시드는 Industry Layer에서 처리합니다.
 * 온보딩은 테넌트 생성, 기본 설정, 역할 할당만 담당합니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
// import { tenancyReferralService } from '@core/tenancy-referral/service'; // TODO: 추천인 기능 구현 예정
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
   * 2. tenant_settings에 업종별 기본값 설정
   * 3. tenant_features에 플랜/기능 ON/OFF 설정
   * 4. owner 역할을 user_tenant_roles에 연결
   * 5. 추천인 코드 처리 (선택)
   *
   * ⚠️ 주의: 업종별 seed 데이터는 Industry Layer에서 별도로 처리합니다.
   * ⚠️ 중요: 이 메서드를 직접 호출하는 경우, 호출 후 업종별 seed를 별도로 실행해야 합니다.
   *          예: academy 업종인 경우 `academySeedService.seedTenantData(tenant.id, input.owner_user_id)` 호출 필요
   */
  async createTenant(input: CreateTenantInput): Promise<TenantOnboardingResult> {
    // 1. 테넌트 생성
    const tenant = await this.createTenantRecord(input);

    // 2. 테넌트 기본 설정 초기화
    await this.initializeTenantSettings(tenant.id, input.industry_type, input.plan || 'basic');

    // 3. 테넌트 기능 설정 초기화
    await this.initializeTenantFeatures(tenant.id, input.plan || 'basic');

    // 4. 사용자에게 역할 할당
    const userTenantRole = await this.assignOwnerRole(tenant.id, input.owner_user_id);

    // 5. 추천인 코드 처리 (선택)
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
   * ⚠️ SSOT-2: industry_type은 tenants 테이블이 1차 소스이며, tenant_settings에 저장하지 않음
   * 아래 'industry' 키는 하위 호환성을 위한 것이며, 실제 industry_type 결정은 tenants 테이블에서 수행
   *
   * ⚠️ Automation Config First: 자동화 기본 정책(Default Policy)도 함께 초기화
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
        value: { industry_type: industryType },  // ⚠️ 하위 호환성용, SSOT는 tenants.industry_type
      },
    ];

    // 자동화 기본 정책(Default Policy) 설정
    // ⚠️ 중요: 모든 자동화는 기본적으로 활성화(enabled: true)되어 있으며, 사용자가 UI에서 비활성화할 수 있음
    // ⚠️ SSOT: 모든 기준 필드의 기본값은 apps/academy-admin/src/constants/automation-event-descriptions.ts의
    //          AUTOMATION_EVENT_CRITERIA_FIELDS[eventType][field].defaultValue와 일치해야 합니다.
    const automationDefaultPolicy = {
      auto_notification: {
        // financial_health (10)
        payment_due_reminder: { enabled: true, channel: 'kakao_at', days_before_first: 3, days_before_second: 1, require_approval: false },
        invoice_partial_balance: { enabled: true, channel: 'kakao_at', require_approval: false },
        recurring_payment_failed: { enabled: true, channel: 'kakao_at', require_approval: false },
        revenue_target_under: { enabled: true, monthly_target: 10000000 },
        collection_rate_drop: { enabled: true, threshold: 0.7 },
        overdue_outstanding_over_limit: { enabled: true, channel: 'kakao_at', limit_amount: 1000000, require_approval: false },
        revenue_required_per_day: { enabled: true, monthly_target: 10000000 },
        top_overdue_customers_digest: { enabled: true, min_amount: 100000, top_count: 10, channel: 'kakao_at' },
        refund_spike: { enabled: true, threshold: 2 },
        monthly_business_report: { enabled: true, report_day: 1 },
        // capacity_optimization (6)
        class_fill_rate_low_persistent: { enabled: true, threshold: 50, persistent_days: 7 },
        ai_suggest_class_merge: { enabled: true, min_capacity: 10, fill_rate_threshold: 50, channel: 'kakao_at', require_approval: true },
        time_slot_fill_rate_low: { enabled: true, threshold: 50 },
        high_fill_rate_expand_candidate: { enabled: true, threshold: 80 },
        unused_class_persistent: { enabled: true, persistent_days: 7 },
        weekly_ops_summary: { enabled: true, report_day_of_week: 1 }, // 월요일
        // customer_retention (8)
        class_reminder_today: { enabled: true, channel: 'kakao_at', minutes_before: 30, require_approval: false },
        class_schedule_tomorrow: { enabled: true, channel: 'kakao_at', notification_time: '20:00', require_approval: false },
        consultation_reminder: { enabled: true, channel: 'kakao_at', hours_before_first: 24, hours_before_second: 2, require_approval: false },
        absence_first_day: { enabled: true, channel: 'kakao_at', require_approval: false },
        churn_increase: { enabled: true, threshold: 2 },
        ai_suggest_churn_focus: { enabled: true, ai_threshold: 70, risk_window_days: 30, channel: 'kakao_at', require_approval: true },
        attendance_rate_drop_weekly: { enabled: true, threshold: 10 },
        risk_students_weekly_kpi: { enabled: true, risk_score_threshold: 60, include_categories: 'all', channel: 'kakao_at' },
        // growth_marketing (6)
        new_member_drop: { enabled: true, threshold: 20 },
        inquiry_conversion_drop: { enabled: true, threshold: 3 },
        birthday_greeting: { enabled: true, channel: 'kakao_at', require_approval: true },
        enrollment_anniversary: { enabled: true, channel: 'kakao_at', require_approval: true },
        regional_underperformance: { enabled: true, threshold: 3 },
        regional_rank_drop: { enabled: true, threshold: 3 },
        // safety_compliance (7)
        class_change_or_cancel: { enabled: true, channel: 'kakao_at', require_approval: false },
        checkin_reminder: { enabled: true, channel: 'kakao_at', minutes_before: 30, require_approval: false },
        checkout_missing_alert: { enabled: true, channel: 'kakao_at', grace_period_minutes: 10, require_approval: false },
        announcement_urgent: { enabled: true, channel: 'kakao_at', require_approval: true },
        announcement_digest: { enabled: true, channel: 'kakao_at', require_approval: true, digest_period: 'weekly' },
        consultation_summary_ready: { enabled: true, channel: 'kakao_at', min_length: 50, require_approval: true },
        attendance_pattern_anomaly: {
          enabled: true,
          channel: 'kakao_at',
          threshold: 3,
          priority: 50,
          ttl_days: 7,
          throttle: { daily_limit: 20, student_limit: 5 },
          require_approval: true,
        },
        student_onboarding_message: { enabled: true, channel: 'kakao_at', require_approval: false },
        bulk_message_send: { enabled: true, channel: 'kakao_at', max_per_hour: 100, require_approval: true },
        message_approval_workflow: { enabled: true, channel: 'kakao_at', require_approval: true },
        // workforce_ops (2)
        teacher_workload_imbalance: { enabled: true, threshold: 3 },
        staff_absence_schedule_risk: { enabled: true, advance_notice_days: 7, critical_absence_hours: 8, channel: 'kakao_at', require_approval: true },
      },
    };

    defaultSettings.push({
      tenant_id: tenantId,
      key: 'config',
      value: automationDefaultPolicy as any,
    });

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
        feature_key: 'attendance',  // SSOT: RPC 함수와 일치 (create_tenant_with_onboarding)
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
   * 사용자에게 역할 할당
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
      throw new Error(`사용자 역할 할당 실패: ${error.message}`);
    }

    return data as UserTenantRole;
  }

  /**
   * 추천인 코드 처리
   *
   * [불변 규칙] core-tenancy-referral 서비스를 사용합니다.
   * ⚠️ 주의: Core Layer 간 의존성만 사용합니다(core-tenancy → core-tenancy-referral).
   */
  private async processReferralCode(
    referralCode: string,
    newTenantId: string
  ): Promise<void> {
    try {
      // 추천인 코드를 조회 (테넌트 컨텍스트 없음)
      const { data: referralCodes, error: fetchError } = await this.supabase
        .from('referral_codes')
        .select('*')
        .eq('code', referralCode)
        .eq('is_active', true)
        .single();

      if (fetchError || !referralCodes) {
        // 추천인 코드가 없어도 에러를 발생시키지 않음 (선택 기능)
        return;
      }

      // 추천인 코드 사용 기록
      // TODO: 추천인 기능 구현 예정
      // await tenancyReferralService.useReferralCode(referralCodes.id, newTenantId);
    } catch (error) {
      // 추천인 코드 처리 실패해도 전체 온보딩을 중단하지 않음
      console.warn('추천인 코드 처리 실패:', error);
    }
  }
}

/**
 * Default Service Instance
 */
export const tenantOnboardingService = new TenantOnboardingService();
