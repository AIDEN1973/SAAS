/**
 * Core Auth Signup Service
 * 
 * 회원가입 서비스 (Supabase Auth 래핑)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * 
 * ⚠️ 주의: 실제 인증 로직은 Supabase Auth를 직접 사용합니다.
 * 이 서비스는 회원가입 관련 유틸리티와 헬퍼 함수를 제공합니다.
 * 
 * B2B 회원가입: 사용자 생성 + 테넌트 생성 + 소유자 역할 할당
 */

import { createClient } from '@lib/supabase-client';
import { maskPII, maskEmail } from '@core/pii-utils';
import type { SignupInput, User, LoginResult, TenantInfo } from './types';
// @core/tenancy에서 타입 import (Vite alias 사용)
import type { IndustryType, Tenant } from '@core/tenancy';

export interface B2BSignupInput extends SignupInput {
  tenant_name: string;
  industry_type: IndustryType;
  referral_code?: string;
}

export interface SignupResult {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  };
  tenant: {
    id: string;
    name: string;
    industry_type: string;
  };
}

export class SignupService {
  private supabase = createClient();

  /**
   * B2B 회원가입 (이메일/비밀번호)
   * 
   * 플로우:
   * 1. Supabase Auth로 사용자 생성
   * 2. 이메일 인증 (선택적)
   * 3. 테넌트 생성 및 초기화
   * 4. 소유자 역할 할당
   * 5. 로그인 세션 반환
   */
  async signupWithEmail(input: B2BSignupInput): Promise<SignupResult> {
    // 개발 환경 감지
    const isDev = typeof window !== 'undefined' && (
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'development')
    );

    // 1. 사용자 생성
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          phone: input.phone,
        },
        // 개발 환경에서는 이메일 인증 자동 확인 (선택적)
        // ⚠️ 주의: Supabase Dashboard > Authentication > Settings > Email Auth에서
        // "Enable email confirmations"를 비활성화하거나 "Auto Confirm"을 활성화해야 함
        emailRedirectTo: isDev ? undefined : `${window.location.origin}/auth/callback`,
      },
    });

    // 상세 에러 로깅 (개발 환경)
    if (authError) {
      if (isDev) {
        console.error('❌ 회원가입 에러 상세:', {
          message: authError.message,
          status: authError.status,
          code: authError.code,
          name: authError.name,
        });
      }

      // 에러 코드별 상세 메시지
      let errorMessage = '회원가입에 실패했습니다.';
      
      if (authError.message) {
        // 이메일 중복
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          errorMessage = '이미 등록된 이메일입니다. 로그인 페이지로 이동해주세요.';
        }
        // 이메일 형식 오류
        else if (authError.message.includes('Invalid email') || authError.message.includes('email format')) {
          errorMessage = '올바른 이메일 형식이 아닙니다.';
        }
        // 비밀번호 정책 위반
        else if (authError.message.includes('Password') || authError.message.includes('password')) {
          errorMessage = '비밀번호가 정책을 만족하지 않습니다. (최소 8자 이상)';
        }
        // 이메일 전송 실패
        else if (authError.message.includes('email') && authError.message.includes('send')) {
          errorMessage = '이메일 전송에 실패했습니다. Supabase 설정을 확인해주세요.';
        }
        // 기타
        else {
          errorMessage = `회원가입 실패: ${authError.message}`;
        }
      }

      throw new Error(errorMessage);
    }

    if (!authData.user) {
      if (isDev) {
        // [기술문서 규칙] 로그에 PII 직접 노출 금지, maskPII() 사용 필수
        console.error('❌ 사용자 생성 실패: authData.user가 null입니다.', maskPII({
          hasSession: !!authData.session,
          // authData 전체는 PII 포함 가능하므로 마스킹 후 로그
        }));
      }
      throw new Error('사용자 생성에 실패했습니다. 다시 시도해주세요.');
    }

    // 개발 환경에서 사용자 생성 성공 로그 (PII 마스킹 적용)
    // [기술문서 규칙] 로그에 PII 직접 노출 금지, maskPII() 사용 필수
    if (isDev) {
      console.log('✅ 사용자 생성 성공:', maskPII({
        userId: authData.user.id,
        email: authData.user.email,
        emailConfirmed: !!authData.user.email_confirmed_at,
        hasSession: !!authData.session,
      }));
    }

    // 2. 이메일 인증 상태 확인
    // ⚠️ 중요: Supabase Auth 설정에 따라 세션이 없을 수 있음
    // - "Enable email confirmations" 활성화 시: 이메일 인증 전까지 세션 없음
    // - "Auto Confirm" 활성화 시: 즉시 세션 생성됨

    // 3. 테넌트 생성 및 초기화 (RPC 함수 사용)
    // 
    // [기술문서 참고] 기술문서의 예시 코드는 서버 환경(Super Admin 콘솔 또는 Edge Function)을 가정합니다.
    // Public Sign-up 폼(클라이언트)에서 회원가입을 처리하려면 RPC 함수를 사용해야 합니다.
    // 
    // 이유:
    // - core-tenancy/onboarding.ts는 createServerClient()를 사용하므로 서버 전용
    // - 클라이언트에서 직접 호출 불가
    // - RPC 함수는 클라이언트에서 호출 가능하며, SECURITY DEFINER로 RLS를 우회하여 테넌트 생성 가능
    // 
    // [불변 규칙] RPC 함수는 core-tenancy/onboarding.ts의 로직과 동일하게 구현되어야 합니다.
    // 
    // ⚠️ 주의: 이메일 인증이 완료되지 않아도 사용자는 생성되므로 테넌트 생성은 진행
    const { data: tenantData, error: tenantError } = await this.supabase.rpc('create_tenant_with_onboarding', {
      p_name: input.tenant_name,
      p_industry_type: input.industry_type,
      p_plan: 'basic',
      p_owner_user_id: authData.user.id,
      p_referral_code: input.referral_code || null,
    });

    if (tenantError) {
      if (isDev) {
        console.error('❌ 테넌트 생성 에러 상세:', {
          message: tenantError.message,
          code: tenantError.code,
          details: tenantError.details,
          hint: tenantError.hint,
        });
      }
      throw new Error(`테넌트 생성 실패: ${tenantError.message}`);
    }

    if (!tenantData || !tenantData.tenant) {
      if (isDev) {
        console.error('❌ 테넌트 생성 결과 없음:', { tenantData });
      }
      throw new Error('테넌트 생성 결과를 받을 수 없습니다.');
    }

    const tenant = tenantData.tenant as Tenant;

    if (isDev) {
      console.log('✅ 테넌트 생성 성공:', {
        tenantId: tenant.id,
        tenantName: tenant.name,
        industryType: tenant.industry_type,
      });
    }

    // 4. 세션 확인 (이메일 인증이 완료되지 않았으면 세션이 없을 수 있음)
    let session = authData.session;
    
    if (!session) {
      // 세션이 없으면 이메일 인증 대기 상태
      // 사용자는 생성되었지만 이메일 인증이 필요함
      if (isDev) {
        console.warn('⚠️ 세션이 없습니다. 이메일 인증이 필요합니다.', {
          userId: authData.user.id,
          email: authData.user.email,
          emailConfirmed: !!authData.user.email_confirmed_at,
          tenantId: tenant.id,
          tenantName: tenant.name,
        });
        console.log('💡 개발 환경에서는 Supabase Dashboard > Authentication > Settings > Email Auth에서');
        console.log('   "Enable email confirmations"를 비활성화하거나 "Auto Confirm"을 활성화하세요.');
      }
      
      // ⚠️ 중요: 사용자와 테넌트는 생성되었지만 세션만 없는 상태
      // 이 경우 사용자에게 이메일 인증을 요청해야 함
      // 하지만 테넌트는 이미 생성되었으므로, 이메일 인증 후 로그인하면 테넌트가 보여야 함
      throw new Error('이메일 인증이 필요합니다. 이메일을 확인해주세요. 인증 후 로그인하시면 테넌트가 표시됩니다.');
    }

    // 5. 테넌트가 제대로 생성되었는지 확인 (세션이 있는 경우에만)
    // ⚠️ 주의: 이메일 인증이 완료되지 않았으면 이 단계에 도달하지 않음
    if (isDev) {
      // 사용자의 테넌트 목록을 다시 조회하여 확인
      const loginService = (await import('./login')).loginService;
      const verifyTenants = await loginService.getUserTenants(authData.user.id);
      
      if (verifyTenants.length === 0) {
        console.error('❌ 경고: 테넌트가 생성되었지만 조회되지 않습니다!', {
          userId: authData.user.id,
          tenantId: tenant.id,
          tenantName: tenant.name,
        });
        console.error('   가능한 원인:');
        console.error('   1. user_tenant_roles에 레코드가 생성되지 않았을 수 있음');
        console.error('   2. RLS 정책 때문에 조회가 안 될 수 있음');
        console.error('   3. 테넌트가 실제로 생성되지 않았을 수 있음');
      } else {
        console.log('✅ 테넌트 조회 확인 성공:', {
          tenantCount: verifyTenants.length,
          tenants: verifyTenants.map(t => ({ id: t.id, name: t.name })),
        });
      }
    }

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        phone: authData.user.phone,
        created_at: authData.user.created_at,
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        industry_type: tenant.industry_type,
      },
    };
  }

  /**
   * 이메일 인증 확인
   * 
   * 이메일 인증 링크를 클릭한 후 호출
   */
  async verifyEmail(token: string, type: 'signup' | 'email_change' = 'signup'): Promise<LoginResult> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      token_hash: token,
      type,
    });

    if (error) {
      throw new Error(`이메일 인증 실패: ${error.message}`);
    }

    if (!data.user || !data.session) {
      throw new Error('이메일 인증 정보가 올바르지 않습니다.');
    }

    // 사용자의 테넌트 목록 조회
    const loginService = (await import('./login')).loginService;
    const tenants = await loginService.getUserTenants(data.user.id);

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone,
        created_at: data.user.created_at,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
      tenants,
    };
  }

  /**
   * 이메일 인증 재전송
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      throw new Error(`이메일 재전송 실패: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const signupService = new SignupService();
