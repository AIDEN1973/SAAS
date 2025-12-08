/**
 * Core Auth
 *
 * 인증 (Supabase Auth 기반)
 * [불변 규칙] 클라이언트에서는 타입만 import: import type { ... } from '@core/auth'
 * [불변 규칙] 서버 코드는 서버/Edge에서만 사용: import { authService } from '@core/auth/service'
 *
 * ⚠️ 주의: 클라이언트 코드는 Supabase 클라이언트를 직접 사용하는 것이 일반적이므로 export하지 않습니다.
 */

// 타입만 export
export * from './types';

// 클라이언트용 서비스 export (Supabase 클라이언트 사용)
export { loginService } from './login';
export { signupService } from './signup';
export type { B2BSignupInput, SignupResult } from './signup';

// 서버 전용 코드는 이 index.ts에서 export하지 않습니다.
// 서버에서는 직접 import: import { authService } from '@core/auth/service'
