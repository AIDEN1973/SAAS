/**
 * useAuth Hook 유닛 테스트
 *
 * [테스트 원칙]
 * - 업종중립: 테스트는 모든 업종에서 동작해야 함
 * - SSOT: 공통 테스트 유틸리티 사용
 * - MSW를 사용한 API 모킹
 */

// vitest globals를 사용하므로 describe, it, expect, vi, beforeEach, afterEach는 import하지 않음
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useSession,
  useLoginWithEmail,
  useLogout,
  useUserRole,
  useUserTenants,
  useSelectTenant,
} from './useAuth';

// Mock 함수들을 vi.hoisted로 생성
const {
  mockGetSession,
  mockSignInWithPassword,
  mockSignOut,
  mockLoginWithEmail,
  mockLogout,
  mockGetUserTenants,
  mockSelectTenant,
  mockApiGet,
  mockGetApiContext,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockLoginWithEmail: vi.fn(),
  mockLogout: vi.fn(),
  mockGetUserTenants: vi.fn(),
  mockSelectTenant: vi.fn(),
  mockApiGet: vi.fn(),
  mockGetApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

// Supabase 클라이언트 모킹
vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  }),
}));

// Auth 서비스 모킹
vi.mock('@core/auth', () => ({
  loginService: {
    loginWithEmail: mockLoginWithEmail,
    logout: mockLogout,
    getUserTenants: mockGetUserTenants,
    selectTenant: mockSelectTenant,
  },
  signupService: {},
}));

// API SDK 모킹
vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: mockApiGet,
  },
  getApiContext: mockGetApiContext,
}));

// 테스트 헬퍼: QueryClient 래퍼
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAuth Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  describe('useSession', () => {
    it('세션이 있으면 세션을 반환해야 함', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
        access_token: 'mock-token',
      };

      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSession);
    });

    it('세션이 없으면 null을 반환해야 함', async () => {
      
      
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('에러 발생 시 에러를 던져야 함', async () => {
      
      
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useLoginWithEmail', () => {
    it('로그인 성공 시 세션 캐시를 무효화해야 함', async () => {

      const mockLoginResult = {
        session: {
          user: { id: 'user-123', email: 'test@example.com' },
          access_token: 'token',
        },
        needsTenantSelection: false,
      };

      (mockLoginWithEmail as any).mockResolvedValue(mockLoginResult);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useLoginWithEmail(), { wrapper });

      // Mutation 실행
      await result.current.mutateAsync({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockLoginWithEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockLoginResult);
    });

    it('로그인 실패 시 에러를 반환해야 함', async () => {
      
      (mockLoginWithEmail as any).mockRejectedValue(
        new Error('Invalid credentials')
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useLoginWithEmail(), { wrapper });

      await expect(
        result.current.mutateAsync({
          email: 'test@example.com',
          password: 'wrong',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('useLogout', () => {
    it('로그아웃 성공 시 모든 캐시를 지워야 함', async () => {

      (mockLogout as any).mockResolvedValue(undefined);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useLogout(), { wrapper });

      await result.current.mutateAsync();

      expect(mockLogout).toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('useUserTenants', () => {
    it('세션이 있으면 테넌트 목록을 조회해야 함', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token',
      };

      const mockTenants = [
        { id: 'tenant-1', name: '테넌트 1', industry_type: 'academy' },
        { id: 'tenant-2', name: '테넌트 2', industry_type: 'academy' },
      ];

      // useSession 모킹
      
      
      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      
      (mockGetUserTenants as any).mockResolvedValue(mockTenants);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUserTenants(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetUserTenants).toHaveBeenCalledWith('user-123');
      expect(result.current.data).toEqual(mockTenants);
    });

    it('세션이 없으면 쿼리를 실행하지 않아야 함', async () => {


      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });



      const wrapper = createWrapper();
      const { result } = renderHook(() => useUserTenants(), { wrapper });

      // 세션 쿼리가 완료될 때까지 대기
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(mockGetUserTenants).not.toHaveBeenCalled();
      expect(result.current.isPending).toBe(true); // enabled가 false이면 pending 상태 유지
    });
  });

  describe('useSelectTenant', () => {
    it('테넌트 선택 성공 시 캐시를 무효화해야 함', async () => {

      const mockResult = {
        tenantId: 'tenant-1',
        industryType: 'academy' as const,
      };

      (mockSelectTenant as any).mockResolvedValue(mockResult);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSelectTenant(), { wrapper });

      await result.current.mutateAsync('tenant-1');

      expect(mockSelectTenant).toHaveBeenCalledWith('tenant-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResult);
    });
  });

  describe('useUserRole', () => {
    it('사용자 역할을 조회해야 함', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token',
      };

      
      
      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      
      (mockApiGet as any).mockResolvedValue({
        data: [
          {
            id: 'role-1',
            user_id: 'user-123',
            tenant_id: 'test-tenant-id',
            role: 'admin',
          },
        ],
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUserRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe('admin');
    });

    it('세션이 없으면 쿼리를 실행하지 않아야 함', async () => {


      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });



      const wrapper = createWrapper();
      const { result } = renderHook(() => useUserRole(), { wrapper });

      // 세션 쿼리가 완료될 때까지 대기
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(mockApiGet).not.toHaveBeenCalled();
      expect(result.current.isPending).toBe(true); // enabled가 false이면 pending 상태 유지
    });
  });
});
