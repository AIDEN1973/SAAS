/**
 * useAuth Hook
 * 
 * React Query 기반 인증 관리 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type {
  LoginInput,
  OAuthLoginInput,
  OTPLoginInput,
  LoginResult,
  TenantSelectionResult,
  SignupInput,
  CreateTenantInput,
  TenantOnboardingResult,
} from '@services/auth-service';

/**
 * 현재 세션 조회 Hook
 */
export function useSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const response = await apiClient.get<{ session: any }>('auth/session');
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data?.session;
    },
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 이메일/비밀번호 로그인 Hook
 */
export function useLoginWithEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LoginInput): Promise<LoginResult> => {
      const response = await apiClient.post<LoginResult>('auth/login', input);
      return response;
    },
    onSuccess: (data) => {
      // 세션 캐시 업데이트
      queryClient.setQueryData(['auth', 'session'], data.session);
      // 테넌트 목록 캐시 업데이트
      queryClient.setQueryData(['auth', 'tenants'], data.tenants);
    },
  });
}

/**
 * 소셜 로그인 Hook
 */
export function useLoginWithOAuth() {
  return useMutation({
    mutationFn: async (input: OAuthLoginInput): Promise<{ url: string }> => {
      const response = await apiClient.post<{ url: string }>('auth/oauth', input);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
  });
}

/**
 * OTP 로그인 Hook
 */
export function useLoginWithOTP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OTPLoginInput): Promise<LoginResult> => {
      const response = await apiClient.post<LoginResult>('auth/otp', input);
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'session'], data.session);
      queryClient.setQueryData(['auth', 'tenants'], data.tenants);
    },
  });
}

/**
 * 테넌트 선택 Hook
 */
export function useSelectTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string): Promise<TenantSelectionResult> => {
      const response = await apiClient.post<TenantSelectionResult>(
        'auth/select-tenant',
        { tenant_id: tenantId }
      );
      return response;
    },
    onSuccess: (data) => {
      // 세션 캐시 업데이트
      queryClient.setQueryData(['auth', 'session'], data);
      // 모든 쿼리 무효화 (새 테넌트 컨텍스트 적용)
      queryClient.invalidateQueries();
    },
  });
}

/**
 * 로그아웃 Hook
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      await apiClient.post('auth/logout', {});
    },
    onSuccess: () => {
      // 모든 쿼리 캐시 클리어
      queryClient.clear();
    },
  });
}

/**
 * 이메일/비밀번호 회원가입 Hook
 */
export function useSignupWithEmail() {
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const response = await apiClient.post<{
        user: {
          id: string;
          email: string;
          phone?: string;
          created_at: string;
        };
        needsEmailVerification: boolean;
      }>('auth/signup', input);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data!;
    },
  });
}

/**
 * 이메일 인증 확인 Hook
 */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: async ({ token, type }: { token: string; type?: 'signup' | 'email_change' }) => {
      const response = await apiClient.post('auth/verify-email', { token, type });
      return response;
    },
  });
}

/**
 * 비밀번호 재설정 요청 Hook
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await apiClient.post('auth/request-password-reset', { email });
      return response;
    },
  });
}

/**
 * 비밀번호 재설정 Hook
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (newPassword: string) => {
      const response = await apiClient.post('auth/reset-password', { password: newPassword });
      return response;
    },
  });
}

/**
 * 테넌트 생성 및 온보딩 Hook
 * 
 * [불변 규칙] 테넌트 생성 후 업종별 초기 데이터 시드는 Industry Layer에서 별도로 처리합니다.
 */
export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTenantInput): Promise<TenantOnboardingResult> => {
      const response = await apiClient.post<TenantOnboardingResult>('tenants', input);
      return response;
    },
    onSuccess: () => {
      // 테넌트 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['auth', 'tenants'] });
    },
  });
}

/**
 * 사용자 테넌트 목록 조회 Hook
 */
export function useUserTenants() {
  return useQuery<Array<{
    id: string;
    name: string;
    industry_type: string;
    role: string;
  }>>({
    queryKey: ['auth', 'tenants'],
    queryFn: async () => {
      const response = await apiClient.get<Array<{
        id: string;
        name: string;
        industry_type: string;
        role: string;
      }>>('auth/tenants');
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data || [];
    },
    staleTime: 10 * 60 * 1000, // 10분
  });
}

