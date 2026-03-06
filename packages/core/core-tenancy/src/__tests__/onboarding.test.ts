/**
 * TenantOnboardingService Unit Tests
 *
 * Tests for tenant onboarding service that handles:
 * 1. Tenant record creation
 * 2. Tenant settings initialization
 * 3. Tenant features initialization
 * 4. Owner role assignment
 * 5. Referral code processing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantOnboardingService } from '../onboarding';
import type { CreateTenantInput } from '../types';

// Helper function to create chainable Supabase mock
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'in',
    'is',
    'gte',
    'lte',
    'order',
    'limit',
    'range',
    'ilike',
    'or',
    'not',
    'match',
    'filter',
  ];

  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }

  chain.single = vi.fn(() => ({ data: resolvedData, error: resolvedError }));

  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({ data: resolvedData, error: resolvedError });
    },
  });

  return chain;
}

// Mock Supabase client — vi.hoisted 필수: onboarding.ts가 모듈 로드 시점에 createServerClient() 호출
const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

describe('TenantOnboardingService', () => {
  let service: TenantOnboardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TenantOnboardingService();
  });

  describe('createTenant', () => {
    it('테넌트 → 설정 → 기능 → 역할 4단계 순차 생성', async () => {
      // Mock data
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const mockRole = {
        id: 'role-123',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'owner',
        created_at: new Date().toISOString(),
      };

      const input: CreateTenantInput = {
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        owner_user_id: 'user-123',
      };

      // Setup mocks for each step
      mockFrom
        .mockReturnValueOnce(createChainMock(mockTenant)) // 1. tenants insert
        .mockReturnValueOnce(createChainMock([])) // 2. tenant_settings insert
        .mockReturnValueOnce(createChainMock([])) // 3. tenant_features insert
        .mockReturnValueOnce(createChainMock(mockRole)); // 4. user_tenant_roles insert

      // Execute
      const result = await service.createTenant(input);

      // Verify
      expect(mockFrom).toHaveBeenCalledTimes(4);
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'tenants');
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'tenant_settings');
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'tenant_features');
      expect(mockFrom).toHaveBeenNthCalledWith(4, 'user_tenant_roles');

      expect(result).toEqual({
        tenant: mockTenant,
        user_tenant_role: mockRole,
      });
    });

    it('추천인 코드 시 processReferralCode 호출', async () => {
      // Mock data
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const mockRole = {
        id: 'role-123',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'owner',
        created_at: new Date().toISOString(),
      };

      const mockReferralCode = {
        id: 'ref-123',
        code: 'REF123',
        is_active: true,
      };

      const input: CreateTenantInput = {
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        owner_user_id: 'user-123',
        referral_code: 'REF123',
      };

      // Setup mocks
      mockFrom
        .mockReturnValueOnce(createChainMock(mockTenant)) // 1. tenants
        .mockReturnValueOnce(createChainMock([])) // 2. tenant_settings
        .mockReturnValueOnce(createChainMock([])) // 3. tenant_features
        .mockReturnValueOnce(createChainMock(mockRole)) // 4. user_tenant_roles
        .mockReturnValueOnce(createChainMock(mockReferralCode)); // 5. referral_codes

      // Execute
      await service.createTenant(input);

      // Verify
      expect(mockFrom).toHaveBeenCalledTimes(5);
      expect(mockFrom).toHaveBeenNthCalledWith(5, 'referral_codes');
    });

    it('추천인 코드 없으면 referral_codes 미호출', async () => {
      // Mock data
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const mockRole = {
        id: 'role-123',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'owner',
        created_at: new Date().toISOString(),
      };

      const input: CreateTenantInput = {
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        owner_user_id: 'user-123',
        // No referral_code
      };

      // Setup mocks
      mockFrom
        .mockReturnValueOnce(createChainMock(mockTenant)) // 1. tenants
        .mockReturnValueOnce(createChainMock([])) // 2. tenant_settings
        .mockReturnValueOnce(createChainMock([])) // 3. tenant_features
        .mockReturnValueOnce(createChainMock(mockRole)); // 4. user_tenant_roles

      // Execute
      await service.createTenant(input);

      // Verify - exactly 4 calls, no referral_codes call
      expect(mockFrom).toHaveBeenCalledTimes(4);
    });
  });

  describe('initializeTenantSettings', () => {
    it('기본 설정 4개 INSERT (timezone, locale, industry, config)', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const mockRole = {
        id: 'role-123',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'owner',
        created_at: new Date().toISOString(),
      };

      const input: CreateTenantInput = {
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        owner_user_id: 'user-123',
      };

      // Capture insert arguments
      let settingsInsert: unknown;
      const mockSettingsChain = createChainMock([]);
      (mockSettingsChain.insert as any) = vi.fn((data: unknown) => {
        settingsInsert = data;
        return mockSettingsChain;
      });

      mockFrom
        .mockReturnValueOnce(createChainMock(mockTenant)) // 1. tenants
        .mockReturnValueOnce(mockSettingsChain) // 2. tenant_settings
        .mockReturnValueOnce(createChainMock([])) // 3. tenant_features
        .mockReturnValueOnce(createChainMock(mockRole)); // 4. user_tenant_roles

      // Execute
      await service.createTenant(input);

      // Verify settings insert
      expect(settingsInsert).toBeDefined();
      expect(Array.isArray(settingsInsert)).toBe(true);
      expect((settingsInsert as any[]).length).toBe(4);

      const settings = settingsInsert as any[];
      expect(settings[0]).toMatchObject({
        tenant_id: 'tenant-123',
        key: 'timezone',
        value: { timezone: 'Asia/Seoul' },
      });
      expect(settings[1]).toMatchObject({
        tenant_id: 'tenant-123',
        key: 'locale',
        value: { locale: 'ko-KR' },
      });
      expect(settings[2]).toMatchObject({
        tenant_id: 'tenant-123',
        key: 'industry',
        value: { industry_type: 'academy' },
      });
      expect(settings[3]).toMatchObject({
        tenant_id: 'tenant-123',
        key: 'config',
      });
    });

    it('자동화 기본 정책(auto_notification) 포함', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const mockRole = {
        id: 'role-123',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'owner',
        created_at: new Date().toISOString(),
      };

      const input: CreateTenantInput = {
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        owner_user_id: 'user-123',
      };

      // Capture insert arguments
      let settingsInsert: unknown;
      const mockSettingsChain = createChainMock([]);
      (mockSettingsChain.insert as any) = vi.fn((data: unknown) => {
        settingsInsert = data;
        return mockSettingsChain;
      });

      mockFrom
        .mockReturnValueOnce(createChainMock(mockTenant)) // 1. tenants
        .mockReturnValueOnce(mockSettingsChain) // 2. tenant_settings
        .mockReturnValueOnce(createChainMock([])) // 3. tenant_features
        .mockReturnValueOnce(createChainMock(mockRole)); // 4. user_tenant_roles

      // Execute
      await service.createTenant(input);

      // Verify automation policy in config setting
      const settings = settingsInsert as any[];
      const configSetting = settings[3];
      expect(configSetting.key).toBe('config');
      expect(configSetting.value).toHaveProperty('auto_notification');

      const autoNotification = configSetting.value.auto_notification;
      expect(autoNotification).toHaveProperty('payment_due_reminder');
      expect(autoNotification.payment_due_reminder).toMatchObject({
        enabled: true,
        channel: 'kakao_at',
        days_before_first: 3,
        days_before_second: 1,
        require_approval: false,
      });

      // Verify multiple categories exist
      expect(autoNotification).toHaveProperty('invoice_partial_balance');
      expect(autoNotification).toHaveProperty('class_fill_rate_low_persistent');
      expect(autoNotification).toHaveProperty('class_reminder_today');
      expect(autoNotification).toHaveProperty('new_member_drop');
      expect(autoNotification).toHaveProperty('class_change_or_cancel');
      expect(autoNotification).toHaveProperty('teacher_workload_imbalance');
    });
  });

  describe('initializeTenantFeatures', () => {
    it('basic 플랜 - messaging/analytics 비활성', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const mockRole = {
        id: 'role-123',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'owner',
        created_at: new Date().toISOString(),
      };

      const input: CreateTenantInput = {
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'basic',
        owner_user_id: 'user-123',
      };

      // Capture insert arguments
      let featuresInsert: unknown;
      const mockFeaturesChain = createChainMock([]);
      (mockFeaturesChain.insert as any) = vi.fn((data: unknown) => {
        featuresInsert = data;
        return mockFeaturesChain;
      });

      mockFrom
        .mockReturnValueOnce(createChainMock(mockTenant)) // 1. tenants
        .mockReturnValueOnce(createChainMock([])) // 2. tenant_settings
        .mockReturnValueOnce(mockFeaturesChain) // 3. tenant_features
        .mockReturnValueOnce(createChainMock(mockRole)); // 4. user_tenant_roles

      // Execute
      await service.createTenant(input);

      // Verify features insert
      expect(featuresInsert).toBeDefined();
      expect(Array.isArray(featuresInsert)).toBe(true);

      const features = featuresInsert as any[];
      const messaging = features.find((f) => f.feature_key === 'messaging');
      const analytics = features.find((f) => f.feature_key === 'analytics');

      // Basic plan: messaging disabled with quota 100, analytics disabled
      expect(messaging).toMatchObject({
        tenant_id: 'tenant-123',
        feature_key: 'messaging',
        enabled: false,
        quota: 100,
      });

      expect(analytics).toMatchObject({
        tenant_id: 'tenant-123',
        feature_key: 'analytics',
        enabled: false,
        quota: null,
      });
    });

    it('premium 플랜 - 전체 활성', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'premium',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const mockRole = {
        id: 'role-123',
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'owner',
        created_at: new Date().toISOString(),
      };

      const input: CreateTenantInput = {
        name: 'Test Academy',
        industry_type: 'academy',
        plan: 'premium',
        owner_user_id: 'user-123',
      };

      // Capture insert arguments
      let featuresInsert: unknown;
      const mockFeaturesChain = createChainMock([]);
      (mockFeaturesChain.insert as any) = vi.fn((data: unknown) => {
        featuresInsert = data;
        return mockFeaturesChain;
      });

      mockFrom
        .mockReturnValueOnce(createChainMock(mockTenant)) // 1. tenants
        .mockReturnValueOnce(createChainMock([])) // 2. tenant_settings
        .mockReturnValueOnce(mockFeaturesChain) // 3. tenant_features
        .mockReturnValueOnce(createChainMock(mockRole)); // 4. user_tenant_roles

      // Execute
      await service.createTenant(input);

      // Verify features insert
      const features = featuresInsert as any[];
      const messaging = features.find((f) => f.feature_key === 'messaging');
      const analytics = features.find((f) => f.feature_key === 'analytics');

      // Premium plan: messaging enabled with no quota, analytics enabled
      expect(messaging).toMatchObject({
        tenant_id: 'tenant-123',
        feature_key: 'messaging',
        enabled: true,
        quota: null,
      });

      expect(analytics).toMatchObject({
        tenant_id: 'tenant-123',
        feature_key: 'analytics',
        enabled: true,
        quota: null,
      });

      // All features should be present
      expect(features.length).toBe(4);
      expect(features.find((f) => f.feature_key === 'attendance')).toBeDefined();
      expect(features.find((f) => f.feature_key === 'billing')).toBeDefined();
    });
  });
});
