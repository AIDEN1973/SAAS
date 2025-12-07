/**
 * useAuth Hook
 * 
 * React Query ê¸°ë°˜ ?¸ì¦ ê´€ë¦?Hook
 * [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 * 
 * [?ˆì™¸] ?¸ì¦ ê´€???‘ì—…?€ Supabase Auth APIë¥?ì§ì ‘ ?¬ìš©?˜ëŠ” ê²ƒì´ ?ˆìš©??
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';
import { loginService, signupService } from '@core/auth';
import type { LoginInput, OAuthLoginInput, OTPLoginInput, LoginResult, TenantSelectionResult, B2BSignupInput, SignupResult } from '@core/auth';

/**
 * ?„ì¬ ?¸ì…˜ ì¡°íšŒ Hook
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
    staleTime: 5 * 60 * 1000, // 5ë¶?
  });
}

/**
 * ?´ë©”??ë¹„ë?ë²ˆí˜¸ ë¡œê·¸??Hook
 */
export function useLoginWithEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LoginInput): Promise<LoginResult> => {
      return loginService.loginWithEmail(input);
    },
    onSuccess: () => {
      // ?¸ì…˜ ìºì‹œ ë¬´íš¨??
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

/**
 * ?Œì…œ ë¡œê·¸??Hook
 */
export function useLoginWithOAuth() {
  return useMutation({
    mutationFn: async (input: OAuthLoginInput): Promise<{ url: string }> => {
      return loginService.loginWithOAuth(input);
    },
  });
}

/**
 * OTP ?„ì†¡ Hook
 */
export function useSendOTP() {
  return useMutation({
    mutationFn: async (phone: string): Promise<void> => {
      return loginService.sendOTP(phone);
    },
  });
}

/**
 * OTP ë¡œê·¸??Hook
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
 * ?¬ìš©???Œë„Œ??ëª©ë¡ ì¡°íšŒ Hook
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
    staleTime: 5 * 60 * 1000, // 5ë¶?
  });
}

/**
 * ?Œë„Œ??? íƒ Hook
 */
export function useSelectTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string): Promise<TenantSelectionResult> => {
      return loginService.selectTenant(tenantId);
    },
    onSuccess: () => {
      // ?¸ì…˜ ë°??Œë„Œ???•ë³´ ìºì‹œ ë¬´íš¨??
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'user-tenants'] });
    },
  });
}

/**
 * ë¡œê·¸?„ì›ƒ Hook
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      return loginService.logout();
    },
    onSuccess: () => {
      // ëª¨ë“  ?¸ì¦ ê´€??ìºì‹œ ë¬´íš¨??
      queryClient.clear();
    },
  });
}

/**
 * B2B ?Œì›ê°€??Hook
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
 * ?´ë©”???¸ì¦ ?•ì¸ Hook
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
 * ?´ë©”???¸ì¦ ?¬ì „??Hook
 */
export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: async (email: string): Promise<void> => {
      return signupService.resendVerificationEmail(email);
    },
  });
}
