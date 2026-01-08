/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Core Auth Signup Service
 *
 * 회원가입 서비스 (Supabase Auth 매핑)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않습니다.
 *
 * ⚠️ 주의: 현재 인증 로직은 Supabase Auth를 직접 사용합니다.
 * 이 서비스는 회원가입 관련 유틸리티와 헬퍼 함수를 제공합니다.
 *
 * B2B 회원가입은 사용자 생성 + 테넌트 생성 + 유입 경로 처리 포함
 */

import { createClient } from '@lib/supabase-client';
import { maskPII } from '@core/pii-utils';
import type { SignupInput, User, LoginResult } from './types';
// @core/tenancy에서 타입 import (Vite alias 사용)
import type { IndustryType, Tenant } from '@core/tenancy';

/**
 * 지역 정보 (카카오 주소 검색 API에서 파싱된 정보)
 */
export interface RegionInfo {
  /** 시도명 */
  si?: string;
  /** 시군구명 */
  gu?: string;
  /** 읍면동명 */
  dong?: string;
  /** 시도 코드 (2자리) */
  sido_code?: string;
  /** 시군구 코드 (5자리) */
  sigungu_code?: string;
  /** 행정동 코드 (10자리) */
  dong_code?: string;
  /** 위도 */
  latitude?: number;
  /** 경도 */
  longitude?: number;
}

export interface B2BSignupInput extends SignupInput {
  tenant_name: string;
  industry_type: IndustryType;
  referral_code?: string;
  /** 학원/매장 주소 */
  address?: string;
  /** 지역 정보 (카카오 API에서 파싱) */
  region_info?: RegionInfo;
}

export interface SignupResult {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  };
  tenant?: Tenant;
}

/**
 * 회원가입 서비스
 */
export class SignupService {
  private supabase = createClient();

  /**
   * 이메일 회원가입
   */
  async signupWithEmail(input: SignupInput): Promise<SignupResult> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name,
            phone: input.phone,
          },
        },
      });

      if (error) {
        throw new Error(`Signup failed: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Signup failed: No user data returned');
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
          name: (data.user.user_metadata?.name as string) || '',
          phone: (data.user.user_metadata?.phone as string) || '',
          created_at: data.user.created_at,
        },
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        } : {
          access_token: '',
          refresh_token: '',
        },
      };
    } catch (error) {
      console.error('[SignupService] signupWithEmail error:', maskPII(error));
      throw error;
    }
  }

  /**
   * B2B 회원가입 (사용자 + 테넌트 생성)
   *
   * [불변 규칙] 회원가입 시 테넌트를 자동으로 생성하고 user_tenant_roles에 연결합니다.
   * [불변 규칙] RPC 함수 create_tenant_with_onboarding를 사용하여 테넌트 생성 및 초기화를 수행합니다.
   */
  async signupB2B(input: B2BSignupInput): Promise<SignupResult> {
    try {
      // 1. 사용자 생성
      const signupResult = await this.signupWithEmail({
        email: input.email,
        password: input.password,
        name: input.name,
        phone: input.phone,
      });

      // 2. 테넌트 생성 (RPC 함수 사용)
      // ⚠️ 중요: 사용자 생성 후 세션이 있어야 RPC 함수가 auth.uid()를 사용할 수 있습니다.
      //          하지만 signUp 직후에는 세션이 없을 수 있으므로 명시적으로 user_id를 전달합니다.
      const { data: tenantData, error: tenantError } = await this.supabase.rpc<{ tenant: any }>(
        'create_tenant_with_onboarding',
        {
          p_name: input.tenant_name,
          p_industry_type: input.industry_type,
          p_plan: 'basic',
          p_owner_user_id: signupResult.user.id,
          p_referral_code: input.referral_code || null,
        }
      );

      if (tenantError) {
        console.error('[SignupService] 테넌트 생성 실패:', tenantError);

        // P0-2: 테넌트 생성 실패 시 사용자 삭제 (트랜잭션 롤백)
        try {
          // Supabase Admin API를 사용하여 사용자 삭제
          const { error: deleteError } = await this.supabase.auth.admin.deleteUser(
            signupResult.user.id
          );

          if (deleteError) {
            console.error('[SignupService] 사용자 삭제 실패:', deleteError);
          }
        } catch (deleteErr) {
          console.error('[SignupService] 사용자 삭제 중 예외 발생:', deleteErr);
        }

        // 테넌트 생성 실패를 에러로 전달
        throw new Error(`테넌트 생성에 실패했습니다: ${tenantError.message}`);
      }

      // 3. 매장(Store) 생성 (주소 정보 포함)
      // 테넌트 생성 성공 시 매장도 함께 생성
      if (tenantData && tenantData.tenant && input.address) {
        const regionInfo = input.region_info || {};
        const { error: storeError } = await this.supabase.rpc(
          'create_store_with_address',
          {
            p_tenant_id: tenantData.tenant.id,
            p_name: input.tenant_name,
            p_industry_type: input.industry_type,
            p_address: input.address,
            p_sido_code: regionInfo.sido_code || null,
            p_sido_name: regionInfo.si || null,
            p_sigungu_code: regionInfo.sigungu_code || null,
            p_sigungu_name: regionInfo.gu || null,
            p_dong_code: regionInfo.dong_code || null,
            p_dong_name: regionInfo.dong || null,
            p_latitude: regionInfo.latitude || null,
            p_longitude: regionInfo.longitude || null,
          }
        );

        if (storeError) {
          console.warn('[SignupService] 매장 생성 실패:', storeError);
          // 매장 생성 실패해도 회원가입은 성공으로 처리
        } else {
          console.log('[SignupService] 매장 및 지역 정보 저장 완료');
        }
      }

      // 4. 업종별 초기 데이터 시드 (Industry Layer)
      // ⚠️ 중요: 업종별 seed는 Industry Layer에서 처리합니다.
      if (tenantData && tenantData.tenant && input.industry_type === 'academy') {
        // Industry Layer 의존성 제거 (Core Layer는 Industry 모듈에 의존하지 않음)
        // Seed 데이터는 별도 마이그레이션 또는 초기화 스크립트에서 처리
        // 업종별 seed는 DB 마이그레이션 또는 별도 초기화 프로세스에서 처리됩니다
        console.log('[SignupService] Tenant created successfully. Seed data should be handled by migrations.');
      }

      // 5. 테넌트 정보 파싱
      let tenant: Tenant | undefined;
      if (tenantData && tenantData.tenant) {
        tenant = {
          id: tenantData.tenant.id,
          name: tenantData.tenant.name,
          industry_type: tenantData.tenant.industry_type as IndustryType,
          plan: tenantData.tenant.plan,
          status: tenantData.tenant.status,
          created_at: tenantData.tenant.created_at,
          updated_at: tenantData.tenant.updated_at,
        };
      }

      return {
        ...signupResult,
        tenant,
      };
    } catch (error) {
      console.error('[SignupService] signupB2B error:', maskPII(error));
      throw error;
    }
  }

  /**
   * 이메일 인증 확인
   */
  async verifyEmail(token: string): Promise<LoginResult> {
    try {
      const { data, error } = await this.supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });

      if (error) {
        throw new Error(`Email verification failed: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Email verification failed: No user data returned');
      }

      // 세션 조회
      const { data: sessionData } = await this.supabase.auth.getSession();

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
          name: (data.user.user_metadata?.name as string) || '',
          phone: (data.user.user_metadata?.phone as string) || '',
          created_at: data.user.created_at,
        },
        session: sessionData.session ? {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_at: sessionData.session.expires_at,
        } : {
          access_token: '',
          refresh_token: '',
        },
        tenants: [], // TODO: 실제 테넌트 목록 조회
      };
    } catch (error) {
      console.error('[SignupService] verifyEmail error:', maskPII(error));
      throw error;
    }
  }

  /**
   * 이메일 인증 재전송
   */
  async resendVerificationEmail(email: string): Promise<void> {
    try {
      const { error } = await this.supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        throw new Error(`Resend verification email failed: ${error.message}`);
      }
    } catch (error) {
      console.error('[SignupService] resendVerificationEmail error:', maskPII(error));
      throw error;
    }
  }

  /**
   * 비밀번호 재설정 요청
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        throw new Error(`Password reset request failed: ${error.message}`);
      }
    } catch (error) {
      console.error('[SignupService] requestPasswordReset error:', maskPII(error));
      throw error;
    }
  }

  /**
   * 비밀번호 재설정
   */
  async resetPassword(newPassword: string): Promise<void> {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(`Password reset failed: ${error.message}`);
      }
    } catch (error) {
      console.error('[SignupService] resetPassword error:', maskPII(error));
      throw error;
    }
  }
}

/**
 * Default Signup Service Instance
 */
export const signupService = new SignupService();
