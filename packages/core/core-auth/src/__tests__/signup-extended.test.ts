/**
 * Core Auth Signup Service Extended Tests
 *
 * Coverage target: 62% -> 80%+
 * Additional coverage for:
 * - signupB2B: store creation with address/region_info
 * - signupB2B: store creation failure (non-fatal)
 * - signupB2B: tenant creation failure + user deletion failure
 * - signupB2B: tenant creation failure + user deletion exception
 * - signupB2B: academy industry_type branch (seed log)
 * - signupB2B: without address (no store creation)
 * - verifyEmail: error cases (verifyOtp error, no user data)
 * - verifyEmail: session without session data
 * - resendVerificationEmail: error case
 * - requestPasswordReset: success and error
 * - resetPassword: error case
 * - signupWithEmail: no user returned
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSignUp,
  mockVerifyOtp,
  mockResend,
  mockResetPasswordForEmail,
  mockUpdateUser,
  mockGetSession,
  mockRpc,
  mockAdminDeleteUser,
} = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockResend: vi.fn(),
  mockResetPasswordForEmail: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockGetSession: vi.fn(),
  mockRpc: vi.fn(),
  mockAdminDeleteUser: vi.fn(),
}));

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      verifyOtp: mockVerifyOtp,
      resend: mockResend,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      getSession: mockGetSession,
      admin: {
        deleteUser: mockAdminDeleteUser,
      },
    },
    rpc: mockRpc,
  }),
}));

vi.mock('@core/pii-utils', () => ({
  maskPII: (val: unknown) => val,
}));

import { SignupService } from '../signup';

const SIGNUP_INPUT = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  phone: '010-1234-5678',
};

const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  user_metadata: { name: 'Test User', phone: '010-1234-5678' },
  created_at: '2026-01-01T00:00:00Z',
};

describe('SignupService Extended', () => {
  let service: SignupService;

  beforeEach(() => {
    service = new SignupService();
    vi.clearAllMocks();
  });

  // ========== signupWithEmail ==========

  describe('signupWithEmail - extended', () => {
    it('throws when no user data returned', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });

      await expect(service.signupWithEmail(SIGNUP_INPUT))
        .rejects.toThrow('Signup failed: No user data returned');
    });
  });

  // ========== signupB2B ==========

  describe('signupB2B - extended', () => {
    it('creates store with address and region_info', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: MOCK_USER,
          session: { access_token: 'at-1', refresh_token: 'rt-1', expires_at: 999 },
        },
        error: null,
      });

      // First rpc: create_tenant_with_onboarding
      mockRpc.mockResolvedValueOnce({
        data: {
          tenant: {
            id: 'tenant-1',
            name: 'Academy',
            industry_type: 'academy',
            plan: 'basic',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      // Second rpc: create_store_with_address
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await service.signupB2B({
        ...SIGNUP_INPUT,
        tenant_name: 'Academy',
        industry_type: 'academy',
        address: '서울시 강남구 역삼동',
        region_info: {
          si: '서울특별시',
          gu: '강남구',
          dong: '역삼동',
          sido_code: '11',
          sigungu_code: '11680',
          dong_code: '1168010100',
          latitude: 37.5,
          longitude: 127.0,
        },
      });

      expect(result.tenant?.id).toBe('tenant-1');
      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(mockRpc).toHaveBeenLastCalledWith(
        'create_store_with_address',
        expect.objectContaining({
          p_tenant_id: 'tenant-1',
          p_address: '서울시 강남구 역삼동',
          p_sido_name: '서울특별시',
        }),
      );

      consoleSpy.mockRestore();
    });

    it('handles store creation failure gracefully (non-fatal)', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: MOCK_USER,
          session: { access_token: 'at-1', refresh_token: 'rt-1' },
        },
        error: null,
      });

      mockRpc.mockResolvedValueOnce({
        data: {
          tenant: {
            id: 'tenant-1',
            name: 'Academy',
            industry_type: 'academy',
            plan: 'basic',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      // Store creation fails
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Store creation failed' },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await service.signupB2B({
        ...SIGNUP_INPUT,
        tenant_name: 'Academy',
        industry_type: 'academy',
        address: '서울시 강남구',
      });

      // Should still succeed
      expect(result.tenant?.id).toBe('tenant-1');
      expect(warnSpy).toHaveBeenCalledWith(
        '[SignupService] 매장 생성 실패:',
        expect.any(Object),
      );

      warnSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('creates store with empty region_info (null fallbacks)', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: MOCK_USER,
          session: { access_token: 'at-1', refresh_token: 'rt-1' },
        },
        error: null,
      });

      mockRpc.mockResolvedValueOnce({
        data: {
          tenant: {
            id: 'tenant-1',
            name: 'Academy',
            industry_type: 'academy',
            plan: 'basic',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await service.signupB2B({
        ...SIGNUP_INPUT,
        tenant_name: 'Academy',
        industry_type: 'academy',
        address: '서울시',
        // No region_info - will use empty {}
      });

      expect(result.tenant?.id).toBe('tenant-1');
      expect(mockRpc).toHaveBeenCalledWith(
        'create_store_with_address',
        expect.objectContaining({
          p_sido_code: null,
          p_sido_name: null,
        }),
      );

      logSpy.mockRestore();
    });

    it('handles user deletion failure during rollback', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: MOCK_USER,
          session: null,
        },
        error: null,
      });

      // Tenant creation fails
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Tenant creation failed' },
      });

      // User deletion also fails
      mockAdminDeleteUser.mockResolvedValueOnce({
        error: { message: 'Admin API error' },
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        service.signupB2B({
          ...SIGNUP_INPUT,
          tenant_name: 'Fail Academy',
          industry_type: 'academy',
        }),
      ).rejects.toThrow('테넌트 생성에 실패했습니다');

      expect(errorSpy).toHaveBeenCalledWith(
        '[SignupService] 사용자 삭제 실패:',
        expect.any(Object),
      );

      errorSpy.mockRestore();
    });

    it('handles user deletion exception during rollback', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: MOCK_USER,
          session: null,
        },
        error: null,
      });

      // Tenant creation fails
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Tenant creation failed' },
      });

      // User deletion throws exception
      mockAdminDeleteUser.mockRejectedValueOnce(new Error('Network timeout'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        service.signupB2B({
          ...SIGNUP_INPUT,
          tenant_name: 'Fail Academy',
          industry_type: 'academy',
        }),
      ).rejects.toThrow('테넌트 생성에 실패했습니다');

      expect(errorSpy).toHaveBeenCalledWith(
        '[SignupService] 사용자 삭제 중 예외 발생:',
        expect.any(Error),
      );

      errorSpy.mockRestore();
    });

    it('handles non-academy industry type (no seed log)', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: MOCK_USER,
          session: { access_token: 'at-1', refresh_token: 'rt-1' },
        },
        error: null,
      });

      mockRpc.mockResolvedValueOnce({
        data: {
          tenant: {
            id: 'tenant-1',
            name: 'Gym',
            industry_type: 'gym',
            plan: 'basic',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await service.signupB2B({
        ...SIGNUP_INPUT,
        tenant_name: 'Gym',
        industry_type: 'gym' as 'academy',
      });

      expect(result.tenant?.industry_type).toBe('gym');
      // Seed log should NOT have been called
      const seedLogCalls = logSpy.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('Seed data'),
      );
      expect(seedLogCalls).toHaveLength(0);

      logSpy.mockRestore();
    });

    it('handles tenantData without tenant field', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: MOCK_USER,
          session: { access_token: 'at-1', refresh_token: 'rt-1' },
        },
        error: null,
      });

      // RPC returns data without tenant field
      mockRpc.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const result = await service.signupB2B({
        ...SIGNUP_INPUT,
        tenant_name: 'Academy',
        industry_type: 'academy',
      });

      expect(result.tenant).toBeUndefined();
    });

    it('includes referral_code when provided', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: MOCK_USER,
          session: { access_token: 'at-1', refresh_token: 'rt-1' },
        },
        error: null,
      });

      mockRpc.mockResolvedValueOnce({
        data: {
          tenant: {
            id: 'tenant-1',
            name: 'Academy',
            industry_type: 'academy',
            plan: 'basic',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await service.signupB2B({
        ...SIGNUP_INPUT,
        tenant_name: 'Academy',
        industry_type: 'academy',
        referral_code: 'REF-123',
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'create_tenant_with_onboarding',
        expect.objectContaining({
          p_referral_code: 'REF-123',
        }),
      );

      logSpy.mockRestore();
    });
  });

  // ========== verifyEmail ==========

  describe('verifyEmail - extended', () => {
    it('throws when verifyOtp returns error', async () => {
      mockVerifyOtp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(service.verifyEmail('bad-token'))
        .rejects.toThrow('Email verification failed: Invalid token');
    });

    it('throws when no user data returned after verification', async () => {
      mockVerifyOtp.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(service.verifyEmail('token'))
        .rejects.toThrow('Email verification failed: No user data returned');
    });

    it('handles verification with no active session (empty tokens)', async () => {
      mockVerifyOtp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            user_metadata: {},
            created_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
      });

      const result = await service.verifyEmail('token');
      expect(result.session.access_token).toBe('');
      expect(result.session.refresh_token).toBe('');
    });
  });

  // ========== resendVerificationEmail ==========

  describe('resendVerificationEmail - extended', () => {
    it('throws on error', async () => {
      mockResend.mockResolvedValueOnce({
        error: { message: 'Rate limit exceeded' },
      });

      await expect(service.resendVerificationEmail('test@example.com'))
        .rejects.toThrow('Resend verification email failed: Rate limit exceeded');
    });
  });

  // ========== requestPasswordReset ==========

  describe('requestPasswordReset', () => {
    it('sends password reset email', async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

      await service.requestPasswordReset('test@example.com');

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/reset-password'),
        }),
      );
    });

    it('throws on error', async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({
        error: { message: 'User not found' },
      });

      await expect(service.requestPasswordReset('bad@example.com'))
        .rejects.toThrow('Password reset request failed: User not found');
    });
  });

  // ========== resetPassword ==========

  describe('resetPassword - extended', () => {
    it('throws on error', async () => {
      mockUpdateUser.mockResolvedValueOnce({
        error: { message: 'Password too weak' },
      });

      await expect(service.resetPassword('weak'))
        .rejects.toThrow('Password reset failed: Password too weak');
    });
  });
});
