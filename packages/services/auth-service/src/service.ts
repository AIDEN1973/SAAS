/**
 * Auth Service
 * 
 * [불변 규칙] Service Layer는 Core Layer의 auth/tenancy 서비스를 래핑하여 제공합니다.
 * [불변 규칙] Service Layer는 Industry Layer를 직접 사용하지 않습니다.
 * 
 * [초기화] 로그인, 로그아웃, 회원가입 로직 제거됨 - 처음부터 다시 구현 필요
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
  // TODO: 로그인, 로그아웃, 회원가입 로직 구현 필요
  // - loginWithEmail
  // - loginWithOAuth
  // - loginWithOTP
  // - selectTenant
  // - logout
  // - getCurrentSession
  // - signupWithEmail
  // - verifyEmail
  // - requestPasswordReset
  // - resetPassword
  // - createTenant
}

/**
 * Default Service Instance
 */
export const authService = new AuthService();
