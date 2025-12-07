/**
 * Core Auth Login Service
 * 
 * 로그인 서비스 (Supabase Auth 래핑)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * 
 * ⚠️ 주의: 실제 인증 로직은 Supabase Auth를 직접 사용합니다.
 * 이 서비스는 로그인 관련 유틸리티와 헬퍼 함수를 제공합니다.
 */

import { createClient } from '@lib/supabase-client/client';
import { createServerClient } from '@lib/supabase-client/server';
import type { LoginInput, OAuthLoginInput, OTPLoginInput, LoginResult, TenantSelectionResult } from './types';

export class LoginService {
  /**
   * 이메일/비밀번호 로그인
   */
  async loginWithEmail(input: LoginInput): Promise<LoginResult> {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.session) {
      throw new Error(error?.message || '로그인에 실패했습니다.');
    }

    // 사용자의 테넌트 목록 조회
    const tenants = await this.getUserTenants(data.user.id);

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
   * 소셜 로그인 (OAuth)
   * 
   * ⚠️ 주의: 클라이언트에서 호출해야 하며, 리다이렉트 URL을 반환합니다.
   */
  async loginWithOAuth(input: OAuthLoginInput): Promise<{ url: string }> {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: input.provider,
      options: {
        redirectTo: input.redirectTo || window.location.origin + '/auth/callback',
      },
    });

    if (error || !data.url) {
      throw new Error(error?.message || '소셜 로그인에 실패했습니다.');
    }

    return { url: data.url };
  }

  /**
   * OTP 로그인 (전화번호 기반)
   * 
   * ⚠️ 주의: OTP 전송과 검증은 별도로 처리해야 합니다.
   */
  async loginWithOTP(input: OTPLoginInput): Promise<LoginResult> {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.verifyOtp({
      phone: input.phone,
      token: input.otp,
      type: 'sms',
    });

    if (error || !data.user || !data.session) {
      throw new Error(error?.message || 'OTP 인증에 실패했습니다.');
    }

    // 사용자의 테넌트 목록 조회
    const tenants = await this.getUserTenants(data.user.id);

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
   * 사용자의 테넌트 목록 조회
   * 
   * [불변 규칙] 서버에서만 호출 가능 (Service Role Key 필요)
   */
  async getUserTenants(userId: string): Promise<Array<{
    id: string;
    name: string;
    industry_type: string;
    role: string;
  }>> {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('user_tenant_roles')
      .select(`
        tenant_id,
        role,
        tenants (
          id,
          name,
          industry_type
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`테넌트 목록 조회 실패: ${error.message}`);
    }

    // Supabase join 결과 타입 안전하게 처리
    return (data || []).map((item: any) => {
      const tenant = Array.isArray(item.tenants) ? item.tenants[0] : item.tenants;
      return {
        id: tenant?.id || item.tenant_id,
        name: tenant?.name || '',
        industry_type: tenant?.industry_type || '',
        role: item.role,
      };
    });
  }

  /**
   * 테넌트 선택 (JWT claim에 tenant_id 포함)
   * 
   * ⚠️ 중요: Supabase JWT에 tenant_id를 claim으로 포함하려면
   * Supabase Database Function 또는 Edge Function에서 처리해야 합니다.
   * 
   * 구현 방법:
   * 1. Supabase Database Function에서 JWT claim에 tenant_id 추가
   *    - auth.users 테이블의 raw_user_meta_data에 tenant_id 저장
   *    - 또는 Supabase Auth Hook에서 JWT 생성 시 claim 추가
   * 
   * 2. Edge Function에서 처리
   *    - /auth/select-tenant 엔드포인트에서 JWT 업데이트
   * 
   * 현재 구현은 세션 새로고침만 수행하며, 실제 JWT claim 업데이트는
   * 서버 측(Supabase Database Function 또는 Edge Function)에서 처리해야 합니다.
   * 
   * [불변 규칙] 클라이언트에서는 Supabase Auth API를 통해서만 세션을 관리합니다.
   */
  async selectTenant(tenantId: string): Promise<TenantSelectionResult> {
    const supabase = createClient();
    
    // 현재 세션 새로고침
    // ⚠️ 주의: JWT claim에 tenant_id를 포함하려면 Supabase Database Function 또는
    // Edge Function에서 auth.users의 raw_user_meta_data를 업데이트하거나
    // JWT 생성 시 claim을 추가해야 합니다.
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      throw new Error(error?.message || '테넌트 선택에 실패했습니다.');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    };
  }

  /**
   * 로그아웃
   */
  async logout(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  /**
   * 현재 세션 조회
   */
  async getCurrentSession() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }
}

/**
 * Default Service Instance
 */
export const loginService = new LoginService();

