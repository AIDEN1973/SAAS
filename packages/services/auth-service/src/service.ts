/**
 * Auth Service
 * 
 * [ë¶ˆë? ê·œì¹™] Service Layer??Core Layer??auth/tenancy ?œë¹„?¤ë? ?˜í•‘?˜ì—¬ ?œê³µ?©ë‹ˆ??
 * [ë¶ˆë? ê·œì¹™] Service Layer??Industry Layerë¥?ì§ì ‘ ?¬ìš©?˜ì? ?ŠìŠµ?ˆë‹¤.
 * 
 * [ì´ˆê¸°?? ë¡œê·¸?? ë¡œê·¸?„ì›ƒ, ?Œì›ê°€??ë¡œì§ ?œê±°??- ì²˜ìŒë¶€???¤ì‹œ êµ¬í˜„ ?„ìš”
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
 * Auth Service (Core Layer ?˜í¼)
 * 
 * Service Layer??Core Layer??loginService, signupService, tenantOnboardingServiceë¥??˜í•‘?˜ì—¬ ?œê³µ?©ë‹ˆ??
 */
export class AuthService {
  // TODO: ë¡œê·¸?? ë¡œê·¸?„ì›ƒ, ?Œì›ê°€??ë¡œì§ êµ¬í˜„ ?„ìš”
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
