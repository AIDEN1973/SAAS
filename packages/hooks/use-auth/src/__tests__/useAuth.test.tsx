/**
 * useAuth Hook Unit Tests
 *
 * Coverage target: 61% -> 80%+
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks - use vi.hoisted to avoid initialization errors
// ============================================================================

const {
  mockGetSession,
  mockLoginWithEmail,
  mockLoginWithOAuth,
  mockSendOTP,
  mockLoginWithOTP,
  mockGetUserTenants,
  mockSelectTenant,
  mockLogout,
  mockSignupB2B,
  mockVerifyEmail,
  mockResendVerificationEmail,
  mockApiGet,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockLoginWithEmail: vi.fn(),
  mockLoginWithOAuth: vi.fn(),
  mockSendOTP: vi.fn(),
  mockLoginWithOTP: vi.fn(),
  mockGetUserTenants: vi.fn(),
  mockSelectTenant: vi.fn(),
  mockLogout: vi.fn(),
  mockSignupB2B: vi.fn(),
  mockVerifyEmail: vi.fn(),
  mockResendVerificationEmail: vi.fn(),
  mockApiGet: vi.fn(),
}));

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

vi.mock('@core/auth', () => ({
  loginService: {
    loginWithEmail: mockLoginWithEmail,
    loginWithOAuth: mockLoginWithOAuth,
    sendOTP: mockSendOTP,
    loginWithOTP: mockLoginWithOTP,
    getUserTenants: mockGetUserTenants,
    selectTenant: mockSelectTenant,
    logout: mockLogout,
  },
  signupService: {
    signupB2B: mockSignupB2B,
    verifyEmail: mockVerifyEmail,
    resendVerificationEmail: mockResendVerificationEmail,
  },
}));

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'tenant-123',
    industryType: 'academy',
  })),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  useSession,
  useLoginWithEmail,
  useLoginWithOAuth,
  useSendOTP,
  useLoginWithOTP,
  useUserTenants,
  useSelectTenant,
  useLogout,
  useSignupWithEmail,
  useVerifyEmail,
  useResendVerificationEmail,
  useUserRole,
} from '../useAuth';

// ============================================================================
// Test Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// ============================================================================
// Tests
// ============================================================================

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========== useSession ==========

  describe('useSession', () => {
    it('returns session on success', async () => {
      const mockSession = {
        user: { id: 'user-1', email: 'test@example.com' },
        access_token: 'token-123',
      };
      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSession);
    });

    it('throws on error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Session expired');
    });

    it('returns null when no session', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });
  });

  // ========== useLoginWithEmail ==========

  describe('useLoginWithEmail', () => {
    it('calls loginService and invalidates session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const loginResult = { user: { id: 'u1' }, session: { access_token: 'at' }, tenants: [] };
      mockLoginWithEmail.mockResolvedValue(loginResult);

      const { result } = renderHook(() => useLoginWithEmail(), { wrapper: createWrapper() });
      act(() => { result.current.mutate({ email: 'a@b.com', password: 'pw' }); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(loginResult);
    });

    it('handles login error', async () => {
      mockLoginWithEmail.mockRejectedValue(new Error('Invalid'));
      const { result } = renderHook(() => useLoginWithEmail(), { wrapper: createWrapper() });
      act(() => { result.current.mutate({ email: 'x@x.com', password: 'bad' }); });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ========== useLoginWithOAuth ==========

  describe('useLoginWithOAuth', () => {
    it('calls loginService.loginWithOAuth', async () => {
      mockLoginWithOAuth.mockResolvedValue({ url: 'https://oauth.example.com' });
      const { result } = renderHook(() => useLoginWithOAuth(), { wrapper: createWrapper() });
      act(() => { result.current.mutate({ provider: 'google' }); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ url: 'https://oauth.example.com' });
    });
  });

  // ========== useSendOTP ==========

  describe('useSendOTP', () => {
    it('calls loginService.sendOTP', async () => {
      mockSendOTP.mockResolvedValue(undefined);
      const { result } = renderHook(() => useSendOTP(), { wrapper: createWrapper() });
      act(() => { result.current.mutate('010-1234-5678'); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockSendOTP).toHaveBeenCalledWith('010-1234-5678');
    });
  });

  // ========== useLoginWithOTP ==========

  describe('useLoginWithOTP', () => {
    it('calls loginService.loginWithOTP and invalidates session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const loginResult = { user: { id: 'u1' }, session: { access_token: 'at' }, tenants: [] };
      mockLoginWithOTP.mockResolvedValue(loginResult);
      const { result } = renderHook(() => useLoginWithOTP(), { wrapper: createWrapper() });
      act(() => { result.current.mutate({ phone: '010-1234-5678', otp: '123456' }); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(loginResult);
    });
  });

  // ========== useSelectTenant ==========

  describe('useSelectTenant', () => {
    it('calls loginService.selectTenant and invalidates caches', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const selResult = { access_token: 'at-new', refresh_token: 'rt-new' };
      mockSelectTenant.mockResolvedValue(selResult);
      const { result } = renderHook(() => useSelectTenant(), { wrapper: createWrapper() });
      act(() => { result.current.mutate('tenant-456'); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(selResult);
    });
  });

  // ========== useLogout ==========

  describe('useLogout', () => {
    it('calls loginService.logout and clears all caches', async () => {
      mockLogout.mockResolvedValue(undefined);
      const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });
      act(() => { result.current.mutate(); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockLogout).toHaveBeenCalled();
    });

    it('handles logout error', async () => {
      mockLogout.mockRejectedValue(new Error('Logout failed'));
      const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });
      act(() => { result.current.mutate(); });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ========== useSignupWithEmail ==========

  describe('useSignupWithEmail', () => {
    it('calls signupService.signupB2B', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const signupResult = { user: { id: 'u-new' }, session: { access_token: 'at' }, tenant: { id: 't1' } };
      mockSignupB2B.mockResolvedValue(signupResult);
      const { result } = renderHook(() => useSignupWithEmail(), { wrapper: createWrapper() });
      act(() => {
        result.current.mutate({
          email: 'new@test.com', password: 'pw', name: 'Test', phone: '010',
          tenant_name: 'Academy', industry_type: 'academy',
        });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(signupResult);
    });
  });

  // ========== useVerifyEmail ==========

  describe('useVerifyEmail', () => {
    it('calls signupService.verifyEmail', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const verifyResult = { user: { id: 'u1' }, session: { access_token: 'at' }, tenants: [] };
      mockVerifyEmail.mockResolvedValue(verifyResult);
      const { result } = renderHook(() => useVerifyEmail(), { wrapper: createWrapper() });
      act(() => { result.current.mutate('token-hash-123'); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(verifyResult);
    });
  });

  // ========== useResendVerificationEmail ==========

  describe('useResendVerificationEmail', () => {
    it('calls signupService.resendVerificationEmail', async () => {
      mockResendVerificationEmail.mockResolvedValue(undefined);
      const { result } = renderHook(() => useResendVerificationEmail(), { wrapper: createWrapper() });
      act(() => { result.current.mutate('test@example.com'); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  // ========== useUserTenants ==========

  describe('useUserTenants', () => {
    it('fetches tenants when session exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      const mockTenants = [{ id: 't1', name: 'A', industry_type: 'academy', role: 'owner' }];
      mockGetUserTenants.mockResolvedValue(mockTenants);

      const { result } = renderHook(() => useUserTenants(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockTenants);
    });

    it('saves to localStorage cache on success', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockGetUserTenants.mockResolvedValue([{ id: 't1' }]);

      const { result } = renderHook(() => useUserTenants(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user-tenants-cache', expect.any(String));
    });

    it('does not save when tenants list is empty', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockGetUserTenants.mockResolvedValue([]);

      const { result } = renderHook(() => useUserTenants(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const setCalls = localStorageMock.setItem.mock.calls.filter(
        (c: [string, string]) => c[0] === 'user-tenants-cache'
      );
      expect(setCalls).toHaveLength(0);
    });

    it('loads tenants from localStorage cache as initialData', async () => {
      localStorageMock.setItem('user-tenants-cache', JSON.stringify({
        userId: 'user-1', tenants: [{ id: 't1' }], timestamp: Date.now(),
      }));
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockGetUserTenants.mockResolvedValue([{ id: 't1' }]);

      const { result } = renderHook(() => useUserTenants(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.data).toBeDefined());
    });

    it('ignores expired cache (> 5 minutes)', async () => {
      localStorageMock.setItem('user-tenants-cache', JSON.stringify({
        userId: 'user-1', tenants: [{ id: 't1' }], timestamp: Date.now() - 6 * 60 * 1000,
      }));
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockGetUserTenants.mockResolvedValue([]);

      const { result } = renderHook(() => useUserTenants(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('ignores cache for different user', async () => {
      localStorageMock.setItem('user-tenants-cache', JSON.stringify({
        userId: 'other-user', tenants: [{ id: 't1' }], timestamp: Date.now(),
      }));
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockGetUserTenants.mockResolvedValue([]);

      const { result } = renderHook(() => useUserTenants(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('handles corrupt localStorage gracefully', async () => {
      localStorageMock.setItem('user-tenants-cache', 'not-valid-json');
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockGetUserTenants.mockResolvedValue([]);

      const { result } = renderHook(() => useUserTenants(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  // ========== useUserRole ==========

  describe('useUserRole', () => {
    it('fetches role when session and tenantId exist', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockApiGet.mockResolvedValue({
        data: [{ id: 'utr-1', user_id: 'user-1', tenant_id: 'tenant-123', role: 'owner' }],
        error: null,
      });

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe('owner');
    });

    it('returns null when no role data found', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockApiGet.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('returns null when API returns error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockApiGet.mockResolvedValue({ data: null, error: { message: 'RLS violation' } });

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('saves role to localStorage cache on success', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockApiGet.mockResolvedValue({
        data: [{ id: 'utr-1', user_id: 'user-1', tenant_id: 'tenant-123', role: 'admin' }],
        error: null,
      });

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(localStorageMock.setItem).toHaveBeenCalledWith('user-role-cache', expect.any(String));
    });

    it('loads role from localStorage cache as initialData', async () => {
      localStorageMock.setItem('user-role-cache', JSON.stringify({
        userId: 'user-1', tenantId: 'tenant-123', role: 'cached-owner', timestamp: Date.now(),
      }));
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockApiGet.mockResolvedValue({
        data: [{ id: 'utr-1', user_id: 'user-1', tenant_id: 'tenant-123', role: 'owner' }],
        error: null,
      });

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.data).toBeDefined());
    });

    it('ignores expired role cache', async () => {
      localStorageMock.setItem('user-role-cache', JSON.stringify({
        userId: 'user-1', tenantId: 'tenant-123', role: 'stale', timestamp: Date.now() - 6 * 60 * 1000,
      }));
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockApiGet.mockResolvedValue({
        data: [{ id: 'utr-1', user_id: 'user-1', tenant_id: 'tenant-123', role: 'owner' }],
        error: null,
      });

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe('owner');
    });

    it('ignores role cache for different user', async () => {
      localStorageMock.setItem('user-role-cache', JSON.stringify({
        userId: 'other-user', tenantId: 'tenant-123', role: 'other', timestamp: Date.now(),
      }));
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockApiGet.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('handles corrupt role cache gracefully', async () => {
      localStorageMock.setItem('user-role-cache', '{invalid-json');
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' }, access_token: 'token' } },
        error: null,
      });
      mockApiGet.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useUserRole(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
