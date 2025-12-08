/**
 * Core Auth Login Service
 *
 * 로그인 서비스 (Supabase Auth 매핑)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 주의: 실제 인증 로직은 Supabase Auth를 직접 사용하니
 * 이 서비스는 로그인 관련 유틸리티와 헬퍼 함수만 제공합니다.
 */

import { createClient } from '@lib/supabase-client';
import { maskPII } from '@core/pii-utils';
import type { LoginInput, OAuthLoginInput, OTPLoginInput, LoginResult, TenantSelectionResult, TenantInfo } from './types';

export class LoginService {
  private supabase = createClient();

  /**
   * 이메일/비밀번호 로그인
   *
   * [기술문서 요구사항]
   * - 이메일/비밀번호 로그인(loginWithEmail)
   * - 로그인 후 사용자 인증 및 테넌트 목록 조회 및 테넌트 선택
   */
  async loginWithEmail(input: LoginInput): Promise<LoginResult> {
    // 입력값 검증
    if (!input.email || !input.email.trim()) {
      throw new Error('이메일을 입력해주세요.');
    }

    if (!input.password || !input.password.trim()) {
      throw new Error('비밀번호를 입력해주세요.');
    }

    // 이메일 형식 검증(간단한 검증)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      throw new Error('올바른 이메일 형식이 아닙니다.');
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });

    if (error) {
      // Supabase Auth 에러 코드에 따른 상세 메시지
      // [기술문서 요구사항] 에러 메시지는 민감 정보 출력 금지, 사용자 친화적 메시지 제공
      let errorMessage = '로그인에 실패했습니다.';

      // 에러 코드 기반 처리 (Supabase Auth 공식 에러 코드)
      const errorCode = error.code || '';
      const errorMsg = error.message || '';

      // 이메일 인증 필요
      if (errorCode === 'email_not_confirmed' || errorMsg.includes('Email not confirmed') || errorMsg.includes('email_not_confirmed')) {
        errorMessage = '이메일 인증이 필요합니다. 이메일을 확인해주세요.';
      }
      // 잘못된 자격증명 (가입하지 않은 경우)
      else if (errorCode === 'invalid_credentials' || errorMsg.includes('Invalid login credentials') || errorMsg.includes('invalid_credentials')) {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다. 회원가입이 필요하시면 회원가입 페이지로 이동해주세요.';
      }
      // 계정 잠금 또는 Rate Limit
      else if (errorCode === 'too_many_requests' || errorMsg.includes('too many requests') || errorMsg.includes('rate_limit')) {
        errorMessage = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
      }
      // 사용자 없음
      else if (errorCode === 'user_not_found' || errorMsg.includes('User not found')) {
        errorMessage = '등록되지 않은 이메일입니다. 회원가입을 진행해주세요.';
      }
      // 비밀번호 재설정 필요
      else if (errorCode === 'email_rate_limit_exceeded' || errorMsg.includes('email rate limit')) {
        errorMessage = '이메일 전송 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.';
      }
      // 기타 에러 (민감 정보 제거)
      else {
        // 개발 환경에서만 상세 에러 표시
        if (typeof window !== 'undefined' && import.meta.env?.DEV) {
          errorMessage = `로그인 실패: ${errorMsg}`;
        } else {
          errorMessage = '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';
        }
      }

      // 개발 환경에서 상세 에러 로그 (PII 마스킹 사용)
      // [기술문서 규칙] 로그는 PII 직접 출력 금지, maskPII() 사용 필수
      if (typeof window !== 'undefined' && import.meta.env?.DEV) {
        console.error('로그인 에러 상세:', maskPII({
          message: error.message,
          status: error.status,
          code: error.code,
        }));
      }

      throw new Error(errorMessage);
    }

    if (!data.user || !data.session) {
      throw new Error('로그인 정보가 올바르지 않습니다.');
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
   * 소셜 로그인(OAuth)
   *
   * ⚠️ 주의: OAuth는 리다이렉트 방식이므로 이 메서드는 URL을 반환하니
   * 실제 인증은 브라우저에서 처리합니다.
   *
   * [불변 규칙] 브라우저에서만 사용 코드이므로 window 객체 사용 가능
   */
  async loginWithOAuth(input: OAuthLoginInput): Promise<{ url: string }> {
    // 브라우저 환경 확인
    if (typeof window === 'undefined') {
      throw new Error('소셜 로그인은 브라우저 환경에서만 사용할 수 있습니다.');
    }

    const redirectTo = input.redirectTo || `${window.location.origin}/auth/callback`;

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: input.provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw new Error(`소셜 로그인 실패: ${error.message}`);
    }

    if (!data.url) {
      throw new Error('소셜 로그인 URL이 생성되지 않았습니다.');
    }

    return { url: data.url };
  }

  /**
   * OTP 로그인(전화번호 인증)
   *
   * 1단계: 전화번호로 OTP 전송
   * 2단계: OTP 코드로 인증
   */
  async sendOTP(phone: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      throw new Error(`OTP 전송 실패: ${error.message}`);
    }
  }

  async loginWithOTP(input: OTPLoginInput): Promise<LoginResult> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      phone: input.phone,
      token: input.otp,
      type: 'sms',
    });

    if (error) {
      throw new Error(`OTP 인증 실패: ${error.message}`);
    }

    if (!data.user || !data.session) {
      throw new Error('OTP 인증 정보가 올바르지 않습니다.');
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
   * ⚠️ 주의: 이 함수는 RLS 정책의 영향을 받습니다.
   * user_tenant_roles 테이블의 RLS 정책: user_id = auth.uid()
   * tenants 테이블의 RLS 정책: user_tenant_roles를 통한 간접 참조
   */
  async getUserTenants(userId: string): Promise<TenantInfo[]> {
    // RLS 정책 때문에 userId와 현재 세션의 user_id가 일치해야 함

    // ⚠️ 중요: tenants 테이블 조인 시 RLS 순환 참조 문제 발생 가능
    // tenants RLS 정책이 user_tenant_roles를 참조하므로 조인 대신 별도 조회
    // 1단계: user_tenant_roles 조회
    const { data: rolesData, error: rolesError } = await this.supabase
      .from('user_tenant_roles')
      .select('tenant_id, role')
      .eq('user_id', userId);

    if (rolesError) {
      // 404 에러면 사용자로 간주 (테넌트 없음)
      if (rolesError.code === 'PGRST116' || rolesError.message.includes('Could not find the table')) {
        return [];
      }
      throw new Error(`테넌트 목록 조회 실패: ${rolesError.message}`);
    }

    if (!rolesData || rolesData.length === 0) {
      return [];
    }

    // 2단계: 모든 tenant_id로 tenants 테이블 조회 (RLS 정책 적용)
    // ⚠️ 주의: tenants 테이블의 RLS 정책이 user_tenant_roles를 참조하므로
    // RLS 정책: id IN (SELECT tenant_id FROM user_tenant_roles WHERE user_id = auth.uid())
    // 이 정책이 제대로 동작하려면 user_tenant_roles가 먼저 조회 가능해야 함
    const tenantIds = rolesData.map(r => r.tenant_id);

    const { data: tenantsData, error: tenantsError } = await this.supabase
      .from('tenants')
      .select('id, name, industry_type')
      .in('id', tenantIds);

    if (tenantsError) {
      // tenants 조회 실패 시 role 정보만 반환
      return rolesData.map(r => ({
        id: r.tenant_id,
        name: '알 수 없음',
        industry_type: 'unknown' as const,
        role: r.role,
      }));
    }

    // 3단계: 결과 병합
    const tenantMap = new Map(
      (tenantsData || []).map(t => [t.id, { id: t.id, name: t.name, industry_type: t.industry_type }])
    );

    return rolesData
      .map((role): TenantInfo | null => {
        const tenant = tenantMap.get(role.tenant_id);
        if (!tenant) {
          // tenant 정보가 없으면 role 정보만 반환
          return {
            id: role.tenant_id,
            name: '알 수 없음',
            industry_type: 'academy' as const, // 기본값
            role: role.role,
          };
        }

        return {
          id: tenant.id,
          name: tenant.name,
          industry_type: tenant.industry_type as TenantInfo['industry_type'],
          role: role.role,
        };
      })
      .filter((tenant): tenant is TenantInfo => tenant !== null);
  }

  /**
   * 테넌트 선택
   *
   * 선택한 테넌트의 tenant_id를 JWT claim에 포함하여 새 세션 생성
   *
   * [기술문서 요구사항]
   * - 로그인 프로세스 3단계: 테넌트 선택 (JWT claim에 tenant_id 포함)
   * - 로그인 프로세스 4단계: 세션 새로고침 (업데이트된 JWT 받기)
   *
   * ⚠️ 중요: JWT claim 업데이트는 Supabase Database Trigger 또는 Edge Function에서 처리합니다.
   * - Database Trigger: user_tenant_roles 변경 시 자동으로 JWT claim 업데이트
   * - 또는 Edge Function: selectTenant 호출 시 tenant_id를 JWT claim에 포함하여 새 토큰 발급
   *
   * 현재 구현은 세션을 새로고침하여 최신 JWT를 받아오니
   * 실제 JWT claim에 tenant_id가 포함되려면 Supabase 설정이 필요합니다.
   */
  async selectTenant(tenantId: string): Promise<TenantSelectionResult> {
    // 현재 세션 확인
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('세션이 없습니다. 다시 로그인해주세요.');
    }

    // 사용자가 해당 테넌트에 접근 권한이 있는지 확인
    const { data: roleData, error: roleError } = await this.supabase
      .from('user_tenant_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (roleError || !roleData) {
      throw new Error('해당 테넌트에 접근 권한이 없습니다.');
    }

    // 세션 새로고침 (JWT claim 업데이트는 Edge Function에서 처리)
    // Rate limit 에러 방지를 위해 재시도 로직 추가
    let retries = 0;
    const maxRetries = 3;
    let refreshError: any = null;
    let refreshData: any = null;

    while (retries < maxRetries) {
      try {
        const result = await this.supabase.auth.refreshSession(session);
        refreshError = result.error;
        refreshData = result.data;

        if (!refreshError && refreshData?.session) {
          break; // 성공
        }

        // Rate limit 에러인 경우 재시도
        if (refreshError?.message?.includes('rate limit') || refreshError?.message?.includes('429')) {
          retries++;
          if (retries < maxRetries) {
            // 지수 백오프: 1초, 2초, 4초 대기
            const delay = Math.pow(2, retries) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // Rate limit이 아닌 다른 에러는 즉시 실패
          break;
        }
      } catch (error) {
        refreshError = error;
        break;
      }
    }

    if (refreshError || !refreshData?.session) {
      // Rate limit 에러인 경우 더 명확한 메시지 제공
      if (refreshError?.message?.includes('rate limit') || refreshError?.message?.includes('429')) {
        throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(`세션 새로고침 실패: ${refreshError?.message || '알 수 없는 오류'}`);
    }

    return {
      access_token: refreshData.session.access_token,
      refresh_token: refreshData.session.refresh_token,
      expires_at: refreshData.session.expires_at,
    };
  }

  /**
   * 로그아웃
   */
  async logout(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw new Error(`로그아웃 실패: ${error.message}`);
    }
  }

  /**
   * 현재 세션 조회
   */
  async getCurrentSession() {
    const { data: { session }, error } = await this.supabase.auth.getSession();

    if (error) {
      throw new Error(`세션 조회 실패: ${error.message}`);
    }

    return session;
  }
}

/**
 * Default Service Instance
 *
 * [불변 규칙] 브라우저 코드에서 사용하는 인증 서비스 인스턴스
 */
export const loginService = new LoginService();
