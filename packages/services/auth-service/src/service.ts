/**
 * Auth Service
 * 
 * [불변 규칙] Service Layer는 Core Layer의 auth/tenancy 서비스를 래핑하여 제공합니다.
 * [불변 규칙] Service Layer는 Industry Layer를 직접 사용하지 않습니다.
 */

import { loginService } from '@core/auth/login';
import { signupService } from '@core/auth/signup';
import { tenantOnboardingService } from '@core/tenancy/onboarding';
import type {
  LoginInput,
  OAuthLoginInput,
  OTPLoginInput,
  LoginResult,
  TenantSelectionResult,
  SignupInput,
  CreateTenantInput,
  TenantOnboardingResult,
} from './types';

/**
 * Auth Service (Core Layer 래퍼)
 * 
 * Service Layer는 Core Layer의 loginService, signupService, tenantOnboardingService를 래핑하여 제공합니다.
 */
export class AuthService {
  /**
   * 이메일/비밀번호 로그인
   */
  async loginWithEmail(input: LoginInput): Promise<LoginResult> {
    return loginService.loginWithEmail(input);
  }

  /**
   * 소셜 로그인 (OAuth)
   */
  async loginWithOAuth(input: OAuthLoginInput): Promise<{ url: string }> {
    return loginService.loginWithOAuth(input);
  }

  /**
   * OTP 로그인
   */
  async loginWithOTP(input: OTPLoginInput): Promise<LoginResult> {
    return loginService.loginWithOTP(input);
  }

  /**
   * 테넌트 선택
   */
  async selectTenant(tenantId: string): Promise<TenantSelectionResult> {
    return loginService.selectTenant(tenantId);
  }

  /**
   * 로그아웃
   */
  async logout(): Promise<void> {
    return loginService.logout();
  }

  /**
   * 현재 세션 조회
   */
  async getCurrentSession() {
    return loginService.getCurrentSession();
  }

  /**
   * 이메일/비밀번호 회원가입
   */
  async signupWithEmail(input: SignupInput) {
    return signupService.signupWithEmail(input);
  }

  /**
   * 이메일 인증 확인
   */
  async verifyEmail(token: string, type: 'signup' | 'email_change' = 'signup'): Promise<void> {
    return signupService.verifyEmail(token, type);
  }

  /**
   * 비밀번호 재설정 요청
   */
  async requestPasswordReset(email: string): Promise<void> {
    return signupService.requestPasswordReset(email);
  }

  /**
   * 비밀번호 재설정
   */
  async resetPassword(newPassword: string): Promise<void> {
    return signupService.resetPassword(newPassword);
  }

  /**
   * 테넌트 생성 및 온보딩
   * 
   * [불변 규칙] 테넌트 생성 후 업종별 초기 데이터 시드는 Industry Layer에서 별도로 처리합니다.
   */
  async createTenant(input: CreateTenantInput): Promise<TenantOnboardingResult> {
    return tenantOnboardingService.createTenant(input);
  }
}

/**
 * Default Service Instance
 */
export const authService = new AuthService();

