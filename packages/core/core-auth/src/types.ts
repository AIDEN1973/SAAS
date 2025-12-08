/**
 * Core Auth Types
 *
 * 인증 (Supabase Auth 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export interface User {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

/**
 * 로그인 입력
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * 소셜 로그인 입력
 */
export interface OAuthLoginInput {
  provider: 'google' | 'kakao';
  redirectTo?: string;
}

/**
 * OTP 로그인 입력
 */
export interface OTPLoginInput {
  phone: string;
  otp: string;
}

/**
 * 회원가입 입력
 */
export interface SignupInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

/**
 * 테넌트 정보 (로그인 결과에 포함)
 */
export interface TenantInfo {
  id: string;
  name: string;
  industry_type: string;
  role: string;
}

/**
 * 로그인 결과
 */
export interface LoginResult {
  user: User;
  session: AuthSession;
  tenants: TenantInfo[];
}

/**
 * 테넌트 선택 결과
 */
export interface TenantSelectionResult {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

