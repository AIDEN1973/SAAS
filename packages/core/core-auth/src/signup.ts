/**
 * Core Auth Signup Service
 * 
 * ?�원가???�비??(Supabase Auth ?�핑)
 * [불�? 규칙] Core Layer??Industry 모듈???�존?��? ?�음
 * 
 * ?�️ 주의: ?�제 ?�증 로직?� Supabase Auth�?직접 ?�용?�니??
 * ???�비?�는 ?�원가??관???�틸리티?� ?�퍼 ?�수�??�공?�니??
 * 
 * B2B ?�원가?? ?�용???�성 + ?�넌???�성 + ?�유????�� ?�당
 */

import { createClient } from '@lib/supabase-client';
import { maskPII } from '@core/pii-utils';
import type { SignupInput, User, LoginResult } from './types';
// @core/tenancy?�서 ?�??import (Vite alias ?�용)
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
   * B2B ?�원가??(?�메??비�?번호)
   * 
   * ?�로??
   * 1. Supabase Auth�??�용???�성
   * 2. ?�메???�증 (?�택??
   * 3. ?�넌???�성 �?초기??
   * 4. ?�유????�� ?�당
   * 5. 로그???�션 반환
   */
  async signupWithEmail(input: B2BSignupInput): Promise<SignupResult> {
    // 개발 ?�경 감�?
    const isDev = typeof window !== 'undefined' && (
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'development')
    );

    // 1. ?�용???�성
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          phone: input.phone,
        },
        // 개발 ?�경?�서???�메???�증 ?�동 ?�인 (?�택??
        // ?�️ 주의: Supabase Dashboard > Authentication > Settings > Email Auth?�서
        // "Enable email confirmations"�?비활?�화?�거??"Auto Confirm"???�성?�해????
        emailRedirectTo: isDev ? undefined : `${window.location.origin}/auth/callback`,
      },
    });

    // ?�세 ?�러 로깅 (개발 ?�경)
    if (authError) {
      if (isDev) {
        console.error('???�원가???�러 ?�세:', {
          message: authError.message,
          status: authError.status,
          code: authError.code,
          name: authError.name,
        });
      }

      // ?�러 코드�??�세 메시지
      let errorMessage = '?�원가?�에 ?�패?�습?�다.';
      
      if (authError.message) {
        // ?�메??중복
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          errorMessage = '?��? ?�록???�메?�입?�다. 로그???�이지�??�동?�주?�요.';
        }
        // ?�메???�식 ?�류
        else if (authError.message.includes('Invalid email') || authError.message.includes('email format')) {
          errorMessage = '?�바�??�메???�식???�닙?�다.';
        }
        // 비�?번호 ?�책 ?�반
        else if (authError.message.includes('Password') || authError.message.includes('password')) {
          errorMessage = '비�?번호가 ?�책??만족?��? ?�습?�다. (최소 8???�상)';
        }
        // ?�메???�송 ?�패
        else if (authError.message.includes('email') && authError.message.includes('send')) {
          errorMessage = '?�메???�송???�패?�습?�다. Supabase ?�정???�인?�주?�요.';
        }
        // 기�?
        else {
          errorMessage = `?�원가???�패: ${authError.message}`;
        }
      }

      throw new Error(errorMessage);
    }

    if (!authData.user) {
      if (isDev) {
        // [기술문서 규칙] 로그??PII 직접 ?�출 금�?, maskPII() ?�용 ?�수
        console.error('???�용???�성 ?�패: authData.user가 null?�니??', maskPII({
          hasSession: !!authData.session,
          // authData ?�체??PII ?�함 가?�하므�?마스????로그
        }));
      }
      throw new Error('?�용???�성???�패?�습?�다. ?�시 ?�도?�주?�요.');
    }

    // 개발 ?�경?�서 ?�용???�성 ?�공 로그 (PII 마스???�용)
    // [기술문서 규칙] 로그??PII 직접 ?�출 금�?, maskPII() ?�용 ?�수
    if (isDev) {
      console.log('???�용???�성 ?�공:', maskPII({
        userId: authData.user.id,
        email: authData.user.email,
        emailConfirmed: !!authData.user.email_confirmed_at,
        hasSession: !!authData.session,
      }));
    }

    // 2. ?�메???�증 ?�태 ?�인
    // ?�️ 중요: Supabase Auth ?�정???�라 ?�션???�을 ???�음
    // - "Enable email confirmations" ?�성???? ?�메???�증 ?�까지 ?�션 ?�음
    // - "Auto Confirm" ?�성???? 즉시 ?�션 ?�성??

    // 3. ?�넌???�성 �?초기??(RPC ?�수 ?�용)
    // 
    // [기술문서 참고] 기술문서???�시 코드???�버 ?�경(Super Admin 콘솔 ?�는 Edge Function)??가?�합?�다.
    // Public Sign-up ???�라?�언???�서 ?�원가?�을 처리?�려�?RPC ?�수�??�용?�야 ?�니??
    // 
    // ?�유:
    // - core-tenancy/onboarding.ts??createServerClient()�??�용?��?�??�버 ?�용
    // - ?�라?�언?�에??직접 ?�출 불�?
    // - RPC ?�수???�라?�언?�에???�출 가?�하�? SECURITY DEFINER�?RLS�??�회?�여 ?�넌???�성 가??
    // 
    // [불�? 규칙] RPC ?�수??core-tenancy/onboarding.ts??로직�??�일?�게 구현?�어???�니??
    // 
    // ?�️ 주의: ?�메???�증???�료?��? ?�아???�용?�는 ?�성?��?�??�넌???�성?� 진행
    const { data: tenantData, error: tenantError } = await this.supabase.rpc('create_tenant_with_onboarding', {
      p_name: input.tenant_name,
      p_industry_type: input.industry_type,
      p_plan: 'basic',
      p_owner_user_id: authData.user.id,
      p_referral_code: input.referral_code || null,
    });

    if (tenantError) {
      if (isDev) {
        console.error('???�넌???�성 ?�러 ?�세:', {
          message: tenantError.message,
          code: tenantError.code,
          details: tenantError.details,
          hint: tenantError.hint,
        });
      }
      throw new Error(`?�넌???�성 ?�패: ${tenantError.message}`);
    }

    if (!tenantData || !tenantData.tenant) {
      if (isDev) {
        console.error('???�넌???�성 결과 ?�음:', { tenantData });
      }
      throw new Error('?�넌???�성 결과�?받을 ???�습?�다.');
    }

    const tenant = tenantData.tenant as Tenant;

    if (isDev) {
      console.log('???�넌???�성 ?�공:', {
        tenantId: tenant.id,
        tenantName: tenant.name,
        industryType: tenant.industry_type,
      });
    }

    // 4. ?�션 ?�인 (?�메???�증???�료?��? ?�았?�면 ?�션???�을 ???�음)
    let session = authData.session;
    
    if (!session) {
      // ?�션???�으�??�메???�증 ?��??�태
      // ?�용?�는 ?�성?�었지�??�메???�증???�요??
      if (isDev) {
        console.warn('?�️ ?�션???�습?�다. ?�메???�증???�요?�니??', {
          userId: authData.user.id,
          email: authData.user.email,
          emailConfirmed: !!authData.user.email_confirmed_at,
          tenantId: tenant.id,
          tenantName: tenant.name,
        });
        console.log('?�� 개발 ?�경?�서??Supabase Dashboard > Authentication > Settings > Email Auth?�서');
        console.log('   "Enable email confirmations"�?비활?�화?�거??"Auto Confirm"???�성?�하?�요.');
      }
      
      // ?�️ 중요: ?�용?��? ?�넌?�는 ?�성?�었지�??�션�??�는 ?�태
      // ??경우 ?�용?�에�??�메???�증???�청?�야 ??
      // ?��?�??�넌?�는 ?��? ?�성?�었?��?�? ?�메???�증 ??로그?�하�??�넌?��? 보여????
      throw new Error('?�메???�증???�요?�니?? ?�메?�을 ?�인?�주?�요. ?�증 ??로그?�하?�면 ?�넌?��? ?�시?�니??');
    }

    // 5. ?�넌?��? ?��?�??�성?�었?��? ?�인 (?�션???�는 경우?�만)
    // ?�️ 주의: ?�메???�증???�료?��? ?�았?�면 ???�계???�달?��? ?�음
    if (isDev) {
      // ?�용?�의 ?�넌??목록???�시 조회?�여 ?�인
      const loginService = (await import('./login')).loginService;
      const verifyTenants = await loginService.getUserTenants(authData.user.id);
      
      if (verifyTenants.length === 0) {
        console.error('??경고: ?�넌?��? ?�성?�었지�?조회?��? ?�습?�다!', {
          userId: authData.user.id,
          tenantId: tenant.id,
          tenantName: tenant.name,
        });
        console.error('   가?�한 ?�인:');
        console.error('   1. user_tenant_roles???�코?��? ?�성?��? ?�았?????�음');
        console.error('   2. RLS ?�책 ?�문??조회가 ???????�음');
        console.error('   3. ?�넌?��? ?�제�??�성?��? ?�았?????�음');
      } else {
        console.log('???�넌??조회 ?�인 ?�공:', {
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
   * ?�메???�증 ?�인
   * 
   * ?�메???�증 링크�??�릭?????�출
   */
  async verifyEmail(token: string, type: 'signup' | 'email_change' = 'signup'): Promise<LoginResult> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      token_hash: token,
      type,
    });

    if (error) {
      throw new Error(`?�메???�증 ?�패: ${error.message}`);
    }

    if (!data.user || !data.session) {
      throw new Error('?�메???�증 ?�보가 ?�바르�? ?�습?�다.');
    }

    // ?�용?�의 ?�넌??목록 조회
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
   * ?�메???�증 ?�전??
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      throw new Error(`?�메???�전???�패: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const signupService = new SignupService();
