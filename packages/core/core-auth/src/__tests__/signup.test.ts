/**
 * Core Auth Signup Service Unit Tests
 *
 * 회원가입 + B2B 테넌트 생성 검증
 * Phase 0-5에서 수정된 String() 패턴도 검증
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

describe('SignupService', () => {
  let service: SignupService;

  beforeEach(() => {
    service = new SignupService();
    vi.clearAllMocks();
  });

  describe('signupWithEmail', () => {
    it('정상 회원가입', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            user_metadata: { name: '테스트', phone: '010-1234-5678' },
            created_at: '2026-01-01T00:00:00Z',
          },
          session: {
            access_token: 'at-123',
            refresh_token: 'rt-123',
            expires_at: 9999999999,
          },
        },
        error: null,
      });

      const result = await service.signupWithEmail({
        email: 'test@example.com',
        password: 'password123',
        name: '테스트',
        phone: '010-1234-5678',
      });

      expect(result.user.id).toBe('user-1');
      expect(result.user.name).toBe('테스트');
      expect(result.session.access_token).toBe('at-123');
    });

    it('중복 이메일 시 에러', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      await expect(
        service.signupWithEmail({
          email: 'existing@example.com',
          password: 'password123',
          name: '테스트',
          phone: '010-1234-5678',
        })
      ).rejects.toThrow('Signup failed');
    });

    it('세션 없는 경우 빈 토큰 반환 (이메일 인증 대기)', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-2',
            email: 'verify@example.com',
            user_metadata: { name: '검증', phone: '010-0000-0000' },
            created_at: '2026-01-01T00:00:00Z',
          },
          session: null,
        },
        error: null,
      });

      const result = await service.signupWithEmail({
        email: 'verify@example.com',
        password: 'password123',
        name: '검증',
        phone: '010-0000-0000',
      });

      expect(result.session.access_token).toBe('');
      expect(result.session.refresh_token).toBe('');
    });

    it('user_metadata가 undefined일 때 String() 처리 (Phase 0-5)', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-3',
            email: 'nodata@example.com',
            user_metadata: {},
            created_at: '2026-01-01T00:00:00Z',
          },
          session: null,
        },
        error: null,
      });

      const result = await service.signupWithEmail({
        email: 'nodata@example.com',
        password: 'password123',
        name: '',
        phone: '',
      });

      expect(result.user.name).toBe('');
      expect(result.user.phone).toBe('');
    });
  });

  describe('signupB2B', () => {
    it('정상 B2B 회원가입 (사용자 + 테넌트 생성)', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-b2b',
            email: 'admin@academy.com',
            user_metadata: { name: '원장님', phone: '010-1234-5678' },
            created_at: '2026-01-01T00:00:00Z',
          },
          session: {
            access_token: 'at-b2b',
            refresh_token: 'rt-b2b',
            expires_at: 9999999999,
          },
        },
        error: null,
      });

      mockRpc.mockResolvedValueOnce({
        data: {
          tenant: {
            id: 'tenant-1',
            name: '디어쌤 학원',
            industry_type: 'academy',
            plan: 'basic',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      const result = await service.signupB2B({
        email: 'admin@academy.com',
        password: 'password123',
        name: '원장님',
        phone: '010-1234-5678',
        tenant_name: '디어쌤 학원',
        industry_type: 'academy',
      });

      expect(result.user.id).toBe('user-b2b');
      expect(result.tenant?.id).toBe('tenant-1');
      expect(result.tenant?.name).toBe('디어쌤 학원');
    });

    it('테넌트 생성 실패 시 사용자 삭제 후 에러', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-fail',
            email: 'fail@example.com',
            user_metadata: { name: '실패', phone: '010-0000-0000' },
            created_at: '2026-01-01T00:00:00Z',
          },
          session: null,
        },
        error: null,
      });

      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Tenant creation failed' },
      });

      mockAdminDeleteUser.mockResolvedValueOnce({ error: null });

      await expect(
        service.signupB2B({
          email: 'fail@example.com',
          password: 'password123',
          name: '실패',
          phone: '010-0000-0000',
          tenant_name: '실패학원',
          industry_type: 'academy',
        })
      ).rejects.toThrow('테넌트 생성에 실패했습니다');

      expect(mockAdminDeleteUser).toHaveBeenCalledWith('user-fail');
    });
  });

  describe('verifyEmail', () => {
    it('이메일 인증 확인', async () => {
      mockVerifyOtp.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-verified',
            email: 'verified@example.com',
            user_metadata: { name: '인증됨', phone: '010-1111-1111' },
            created_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'at-verified',
            refresh_token: 'rt-verified',
            expires_at: 9999999999,
          },
        },
      });

      const result = await service.verifyEmail('token-hash');

      expect(result.user.id).toBe('user-verified');
      expect(result.session.access_token).toBe('at-verified');
    });
  });

  describe('resendVerificationEmail', () => {
    it('인증 메일 재전송', async () => {
      mockResend.mockResolvedValueOnce({ error: null });

      await service.resendVerificationEmail('test@example.com');

      expect(mockResend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.com',
      });
    });
  });

  describe('resetPassword', () => {
    it('비밀번호 재설정', async () => {
      mockUpdateUser.mockResolvedValueOnce({ error: null });

      await service.resetPassword('newPassword123');

      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newPassword123' });
    });
  });
});
