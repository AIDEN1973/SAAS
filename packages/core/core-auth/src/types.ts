/**
 * Core Auth Types
 * 
 * ?�증 (Supabase Auth 기반)
 * [불�? 규칙] Core Layer??Industry 모듈???�존?��? ?�음
 */

export interface User {
  id: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

/**
 * 로그???�력
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * ?�셜 로그???�력
 */
export interface OAuthLoginInput {
  provider: 'google' | 'kakao';
  redirectTo?: string;
}

/**
 * OTP 로그???�력
 */
export interface OTPLoginInput {
  phone: string;
  otp: string;
}

/**
 * ?�원가???�력
 */
export interface SignupInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

/**
 * ?�넌???�보 (로그??결과???�함)
 */
export interface TenantInfo {
  id: string;
  name: string;
  industry_type: string;
  role: string;
}

/**
 * 로그??결과
 */
export interface LoginResult {
  user: User;
  session: AuthSession;
  tenants: TenantInfo[];
}

/**
 * ?�넌???�택 결과
 */
export interface TenantSelectionResult {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

