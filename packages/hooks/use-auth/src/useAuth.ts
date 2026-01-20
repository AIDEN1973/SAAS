/**
 * useAuth Hook
 *
 * React Query 기반 인증 관리 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 *
 * 예외: 인증 관리는 Supabase Auth API를 직접 사용하는 것이 일반적입니다.
 * supabase.auth.getSession() 등은 인증 관련이므로 createClient() 직접 사용이 필요합니다.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';
import { loginService, signupService } from '@core/auth';
import type { LoginInput, OAuthLoginInput, OTPLoginInput, LoginResult, TenantSelectionResult, B2BSignupInput, SignupResult, TenantInfo } from '@core/auth';
import { apiClient, getApiContext } from '@api-sdk/core';

/**
 * 현재 세션 조회 Hook
 * [성능 최적화] gcTime 설정으로 캐시 보존 시간 연장
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
    staleTime: 5 * 60 * 1000,   // 5분 (stale 상태 지속)
    gcTime: 30 * 60 * 1000,     // 30분 (캐시 유지 시간 연장)
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

/** localStorage 캐시 키 */
const TENANTS_CACHE_KEY = 'user-tenants-cache';

/** localStorage에서 테넌트 캐시 로드 */
function loadTenantsFromCache(userId: string) {
  try {
    const cached = localStorage.getItem(TENANTS_CACHE_KEY);
    if (!cached) return null;
    const { userId: cachedUserId, tenants, timestamp } = JSON.parse(cached);
    // 같은 사용자의 캐시이고, 5분 이내인 경우에만 사용
    if (cachedUserId === userId && Date.now() - timestamp < 5 * 60 * 1000) {
      return tenants;
    }
  } catch {
    // 캐시 파싱 실패 시 무시
  }
  return null;
}

/** localStorage에 테넌트 캐시 저장 */
function saveTenantsToCache(userId: string, tenants: unknown[]) {
  try {
    localStorage.setItem(TENANTS_CACHE_KEY, JSON.stringify({
      userId,
      tenants,
      timestamp: Date.now(),
    }));
  } catch {
    // 저장 실패 시 무시
  }
}

/**
 * 사용자의 테넌트 목록 조회 Hook
 * [성능 최적화] localStorage 캐시로 초기 로딩 시간 단축
 */
export function useUserTenants() {
  const { data: session } = useSession();

  return useQuery<TenantInfo[]>({
    queryKey: ['auth', 'user-tenants', session?.user?.id],
    queryFn: async (): Promise<TenantInfo[]> => {
      if (!session?.user?.id) {
        return [];
      }
      const tenants = await loginService.getUserTenants(session.user.id);
      // 성공 시 캐시 저장
      if (tenants.length > 0) {
        saveTenantsToCache(session.user.id, tenants);
      }
      return tenants;
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5분
    // [성능 최적화] 초기값으로 캐시된 데이터 사용 (네트워크 요청 전에 즉시 표시)
    initialData: (): TenantInfo[] | undefined => {
      if (!session?.user?.id) return undefined;
      return (loadTenantsFromCache(session.user.id) as TenantInfo[] | null) || undefined;
    },
    initialDataUpdatedAt: () => {
      // 캐시된 데이터가 있으면 현재 시간을 반환하여 즉시 사용
      if (session?.user?.id && loadTenantsFromCache(session.user.id)) {
        return Date.now();
      }
      return 0;
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
 *
 * [불변 규칙] 회원가입 시 테넌트를 자동으로 생성합니다.
 */
export function useSignupWithEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: B2BSignupInput): Promise<SignupResult> => {
      // B2B 회원가입: 사용자 생성 + 테넌트 생성
      return signupService.signupB2B(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'user-tenants'] });
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

/** localStorage 캐시 키 - 역할 정보 */
const ROLE_CACHE_KEY = 'user-role-cache';

/** localStorage에서 역할 캐시 로드 */
function loadRoleFromCache(userId: string, tenantId: string) {
  try {
    const cached = localStorage.getItem(ROLE_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    // 같은 사용자 + 테넌트의 캐시이고, 5분 이내인 경우에만 사용
    if (data.userId === userId && data.tenantId === tenantId &&
        Date.now() - data.timestamp < 5 * 60 * 1000) {
      return data.role;
    }
  } catch {
    // 캐시 파싱 실패 시 무시
  }
  return null;
}

/** localStorage에 역할 캐시 저장 */
function saveRoleToCache(userId: string, tenantId: string, role: string | null) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({
      userId,
      tenantId,
      role,
      timestamp: Date.now(),
    }));
  } catch {
    // 저장 실패 시 무시
  }
}

/**
 * 현재 테넌트에서의 사용자 역할 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [성능 최적화] localStorage 캐시로 초기 로딩 시간 단축
 */
export function useUserRole() {
  const { data: session } = useSession();
  // tenantId를 쿼리 키에 포함하여 tenantId 변경 시 자동으로 재조회되도록 함
  const context = getApiContext();
  const tenantId = context?.tenantId;

  return useQuery<string | null>({
    queryKey: ['auth', 'user-role', session?.user?.id, tenantId],
    queryFn: async (): Promise<string | null> => {
      console.log('[useUserRole] Fetching user role:', {
        userId: session?.user?.id,
        hasSession: !!session,
        tenantId,
        hasContext: !!context,
      });

      if (!session?.user?.id) {
        console.warn('[useUserRole] No session or user ID');
        return null;
      }

      // tenantId는 쿼리 키에서 가져오므로 여기서 다시 확인
      if (!tenantId) {
        console.warn('[useUserRole] No tenant ID in context');
        return null;
      }

      console.log('[useUserRole] Querying user_tenant_roles:', {
        user_id: session.user.id,
        tenant_id: tenantId,
      });

      interface UserTenantRole {
        id: string;
        user_id: string;
        tenant_id: string;
        role: string;
      }
      const response = await apiClient.get<UserTenantRole[]>('user_tenant_roles', {
        filters: {
          user_id: session.user.id,
          tenant_id: tenantId,
        },
        limit: 1,
      });

      const roleData = response.data as UserTenantRole[] | undefined;

      console.log('[useUserRole] Response:', {
        error: response.error,
        data: roleData,
        dataLength: roleData?.length,
        role: roleData?.[0]?.role,
      });

      if (response.error) {
        // RLS 정책에 의해 조회 실패할 수 있음
        console.error('[useUserRole] Error fetching role:', response.error);
        return null;
      }

      const role = roleData?.[0]?.role || null;
      console.log('[useUserRole] Returning role:', role);

      // 성공 시 캐시 저장
      if (role) {
        saveRoleToCache(session.user.id, tenantId, role);
      }

      return role;
    },
    enabled: !!session?.user?.id && !!tenantId,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 30 * 60 * 1000,   // 30분 (캐시 유지 시간 연장)
    // [성능 최적화] 초기값으로 캐시된 데이터 사용 (네트워크 요청 전에 즉시 표시)
    initialData: (): string | null | undefined => {
      if (!session?.user?.id || !tenantId) return undefined;
      return (loadRoleFromCache(session.user.id, tenantId) as string | null) || undefined;
    },
    initialDataUpdatedAt: () => {
      // 캐시된 데이터가 있으면 현재 시간을 반환하여 즉시 사용
      if (session?.user?.id && tenantId && loadRoleFromCache(session.user.id, tenantId)) {
        return Date.now();
      }
      return 0;
    },
  });
}
