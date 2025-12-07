/**
 * Core Auth
 * 
 * ?¸ì¦ (Supabase Auth ê¸°ë°˜)
 * [ë¶ˆë? ê·œì¹™] ?´ë¼?´ì–¸?¸ì—?œëŠ” ?€?…ë§Œ import: import type { ... } from '@core/auth'
 * [ë¶ˆë? ê·œì¹™] ?œë²„ ì½”ë“œ???œë²„/Edge?ì„œë§??¬ìš©: import { authService } from '@core/auth/service'
 * 
 * ? ï¸ ì£¼ì˜: ?´ë¼?´ì–¸??ì½”ë“œ??Supabase ?´ë¼?´ì–¸?¸ë? ì§ì ‘ ?¬ìš©?˜ë?ë¡??¬ê¸°??export?©ë‹ˆ??
 */

// ?€??export
export * from './types';

// ?´ë¼?´ì–¸?¸ìš© ?œë¹„??export (Supabase ?´ë¼?´ì–¸???¬ìš©)
export { loginService } from './login';
export { signupService } from './signup';
export type { B2BSignupInput, SignupResult } from './signup';

// ?œë²„ ?„ìš© ì½”ë“œ????index.ts?ì„œ export?˜ì? ?ŠìŠµ?ˆë‹¤.
// ?œë²„?ì„œ??ì§ì ‘ import: import { authService } from '@core/auth/service'

