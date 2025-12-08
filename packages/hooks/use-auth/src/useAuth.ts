/**
 * useAuth Hook
 *
 * React Query 기반 인증 관리 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 *
 * [예외] 인증 관리는 Supabase Auth API를 직접 사용하는 것이 일반적임
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';
import { loginService, signupService } from '@core/auth';
import type { LoginInput, OAuthLoginInput, OTPLoginInput, LoginResult, TenantSelectionResult, B2BSignupInput, SignupResult } from '@core/auth';

/**
 * 현재 세션 조회 Hook
 */
export function useSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(error.message);
      }

      return session;
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
      return loginService.loginWithEmail(input);
    },
    onSuccess: () => {
      // 세션 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

/**
 * 소셜 로그인 Hook
 */
export function useLoginWithOAuth() {
  return useMutation({
    mutationFn: async (input: OAuthLoginInput): Promise<{ url: string }> => {
      return loginService.loginWithOAuth(input);
    },
  });
}

/**
 * OTP 전송 Hook
 */
export function useSendOTP() {
  return useMutation({
    mutationFn: async (phone: string): Promise<void> => {
      return loginService.sendOTP(phone);
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
      return loginService.loginWithOTP(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

/**
 * 사용자의 테넌트 목록 조회 Hook
 */
export function useUserTenants() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['auth', 'user-tenants', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) {
        return [];
      }
      return loginService.getUserTenants(session.user.id);
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 테넌트 선택 Hook
 */
export function useSelectTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string): Promise<TenantSelectionResult> => {
      return loginService.selectTenant(tenantId);
    },
    onSuccess: () => {
      // 세션 및 테넌트 정보 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'user-tenants'] });
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
      return loginService.logout();
    },
    onSuccess: () => {
      // 모든 인증 관련 캐시 무효화
      queryClient.clear();
    },
  });
}

/**
 * B2B 회원가입 Hook
 */
export function useSignupWithEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: B2BSignupInput): Promise<SignupResult> => {
      return signupService.signupWithEmail(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

/**
 * 이메일 인증 확인 Hook
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string): Promise<LoginResult> => {
      return signupService.verifyEmail(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

/**
 * 이메일 인증 재전송 Hook
 */
export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: async (email: string): Promise<void> => {
      return signupService.resendVerificationEmail(email);
    },
  });
}
