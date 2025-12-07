/**
 * Core Auth Signup Service
 * 
 * 회원가입 서비스 (Supabase Auth 래핑)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * 
 * ⚠️ 주의: 실제 인증 로직은 Supabase Auth를 직접 사용합니다.
 * 이 서비스는 회원가입 관련 유틸리티와 헬퍼 함수를 제공합니다.
 */

import { createClient } from '@lib/supabase-client';
import type { SignupInput, User } from './types';

export class SignupService {
  /**
   * 이메일/비밀번호 회원가입
   * 
   * [불변 규칙] 사용자 계정만 생성하며, 테넌트 생성은 core-tenancy/onboarding에서 처리합니다.
   */
  async signupWithEmail(input: SignupInput): Promise<{
    user: User;
    needsEmailVerification: boolean;
  }> {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          phone: input.phone,
        },
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message || '회원가입에 실패했습니다.');
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        created_at: data.user.created_at,
      },
      needsEmailVerification: !data.session, // 이메일 인증이 필요한 경우 세션이 없음
    };
  }

  /**
   * 이메일 인증 확인
   */
  async verifyEmail(token: string, type: 'signup' | 'email_change' = 'signup'): Promise<void> {
    const supabase = createClient();
    
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type === 'signup' ? 'signup' : 'email_change',
    });

    if (error) {
      throw new Error(error.message || '이메일 인증에 실패했습니다.');
    }
  }

  /**
   * 비밀번호 재설정 요청
   */
  async requestPasswordReset(email: string): Promise<void> {
    const supabase = createClient();
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      throw new Error(error.message || '비밀번호 재설정 요청에 실패했습니다.');
    }
  }

  /**
   * 비밀번호 재설정
   */
  async resetPassword(newPassword: string): Promise<void> {
    const supabase = createClient();
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message || '비밀번호 재설정에 실패했습니다.');
    }
  }
}

/**
 * Default Service Instance
 */
export const signupService = new SignupService();

