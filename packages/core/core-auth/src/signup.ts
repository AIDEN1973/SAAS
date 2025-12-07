/**
 * Core Auth Signup Service
 * 
 * ?Œì›ê°€???œë¹„??(Supabase Auth ?˜í•‘)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì£¼ì˜: ?¤ì œ ?¸ì¦ ë¡œì§?€ Supabase Authë¥?ì§ì ‘ ?¬ìš©?©ë‹ˆ??
 * ???œë¹„?¤ëŠ” ?Œì›ê°€??ê´€??? í‹¸ë¦¬í‹°?€ ?¬í¼ ?¨ìˆ˜ë¥??œê³µ?©ë‹ˆ??
 * 
 * B2B ?Œì›ê°€?? ?¬ìš©???ì„± + ?Œë„Œ???ì„± + ?Œìœ ????•  ? ë‹¹
 */

import { createClient } from '@lib/supabase-client';
import { maskPII, maskEmail } from '@core/pii-utils';
import type { SignupInput, User, LoginResult, TenantInfo } from './types';
// @core/tenancy?ì„œ ?€??import (Vite alias ?¬ìš©)
import type { IndustryType, Tenant } from '@core/tenancy';

export interface B2BSignupInput extends SignupInput {
  tenant_name: string;
  industry_type: IndustryType;
  referral_code?: string;
}

export interface SignupResult {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  };
  tenant: {
    id: string;
    name: string;
    industry_type: string;
  };
}

export class SignupService {
  private supabase = createClient();

  /**
   * B2B ?Œì›ê°€??(?´ë©”??ë¹„ë?ë²ˆí˜¸)
   * 
   * ?Œë¡œ??
   * 1. Supabase Authë¡??¬ìš©???ì„±
   * 2. ?´ë©”???¸ì¦ (? íƒ??
   * 3. ?Œë„Œ???ì„± ë°?ì´ˆê¸°??
   * 4. ?Œìœ ????•  ? ë‹¹
   * 5. ë¡œê·¸???¸ì…˜ ë°˜í™˜
   */
  async signupWithEmail(input: B2BSignupInput): Promise<SignupResult> {
    // ê°œë°œ ?˜ê²½ ê°ì?
    const isDev = typeof window !== 'undefined' && (
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'development')
    );

    // 1. ?¬ìš©???ì„±
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          phone: input.phone,
        },
        // ê°œë°œ ?˜ê²½?ì„œ???´ë©”???¸ì¦ ?ë™ ?•ì¸ (? íƒ??
        // ? ï¸ ì£¼ì˜: Supabase Dashboard > Authentication > Settings > Email Auth?ì„œ
        // "Enable email confirmations"ë¥?ë¹„í™œ?±í™”?˜ê±°??"Auto Confirm"???œì„±?”í•´????
        emailRedirectTo: isDev ? undefined : `${window.location.origin}/auth/callback`,
      },
    });

    // ?ì„¸ ?ëŸ¬ ë¡œê¹… (ê°œë°œ ?˜ê²½)
    if (authError) {
      if (isDev) {
        console.error('???Œì›ê°€???ëŸ¬ ?ì„¸:', {
          message: authError.message,
          status: authError.status,
          code: authError.code,
          name: authError.name,
        });
      }

      // ?ëŸ¬ ì½”ë“œë³??ì„¸ ë©”ì‹œì§€
      let errorMessage = '?Œì›ê°€?…ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      
      if (authError.message) {
        // ?´ë©”??ì¤‘ë³µ
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          errorMessage = '?´ë? ?±ë¡???´ë©”?¼ì…?ˆë‹¤. ë¡œê·¸???˜ì´ì§€ë¡??´ë™?´ì£¼?¸ìš”.';
        }
        // ?´ë©”???•ì‹ ?¤ë¥˜
        else if (authError.message.includes('Invalid email') || authError.message.includes('email format')) {
          errorMessage = '?¬ë°”ë¥??´ë©”???•ì‹???„ë‹™?ˆë‹¤.';
        }
        // ë¹„ë?ë²ˆí˜¸ ?•ì±… ?„ë°˜
        else if (authError.message.includes('Password') || authError.message.includes('password')) {
          errorMessage = 'ë¹„ë?ë²ˆí˜¸ê°€ ?•ì±…??ë§Œì¡±?˜ì? ?ŠìŠµ?ˆë‹¤. (ìµœì†Œ 8???´ìƒ)';
        }
        // ?´ë©”???„ì†¡ ?¤íŒ¨
        else if (authError.message.includes('email') && authError.message.includes('send')) {
          errorMessage = '?´ë©”???„ì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤. Supabase ?¤ì •???•ì¸?´ì£¼?¸ìš”.';
        }
        // ê¸°í?
        else {
          errorMessage = `?Œì›ê°€???¤íŒ¨: ${authError.message}`;
        }
      }

      throw new Error(errorMessage);
    }

    if (!authData.user) {
      if (isDev) {
        // [ê¸°ìˆ ë¬¸ì„œ ê·œì¹™] ë¡œê·¸??PII ì§ì ‘ ?¸ì¶œ ê¸ˆì?, maskPII() ?¬ìš© ?„ìˆ˜
        console.error('???¬ìš©???ì„± ?¤íŒ¨: authData.userê°€ null?…ë‹ˆ??', maskPII({
          hasSession: !!authData.session,
          // authData ?„ì²´??PII ?¬í•¨ ê°€?¥í•˜ë¯€ë¡?ë§ˆìŠ¤????ë¡œê·¸
        }));
      }
      throw new Error('?¬ìš©???ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤. ?¤ì‹œ ?œë„?´ì£¼?¸ìš”.');
    }

    // ê°œë°œ ?˜ê²½?ì„œ ?¬ìš©???ì„± ?±ê³µ ë¡œê·¸ (PII ë§ˆìŠ¤???ìš©)
    // [ê¸°ìˆ ë¬¸ì„œ ê·œì¹™] ë¡œê·¸??PII ì§ì ‘ ?¸ì¶œ ê¸ˆì?, maskPII() ?¬ìš© ?„ìˆ˜
    if (isDev) {
      console.log('???¬ìš©???ì„± ?±ê³µ:', maskPII({
        userId: authData.user.id,
        email: authData.user.email,
        emailConfirmed: !!authData.user.email_confirmed_at,
        hasSession: !!authData.session,
      }));
    }

    // 2. ?´ë©”???¸ì¦ ?íƒœ ?•ì¸
    // ? ï¸ ì¤‘ìš”: Supabase Auth ?¤ì •???°ë¼ ?¸ì…˜???†ì„ ???ˆìŒ
    // - "Enable email confirmations" ?œì„±???? ?´ë©”???¸ì¦ ?„ê¹Œì§€ ?¸ì…˜ ?†ìŒ
    // - "Auto Confirm" ?œì„±???? ì¦‰ì‹œ ?¸ì…˜ ?ì„±??

    // 3. ?Œë„Œ???ì„± ë°?ì´ˆê¸°??(RPC ?¨ìˆ˜ ?¬ìš©)
    // 
    // [ê¸°ìˆ ë¬¸ì„œ ì°¸ê³ ] ê¸°ìˆ ë¬¸ì„œ???ˆì‹œ ì½”ë“œ???œë²„ ?˜ê²½(Super Admin ì½˜ì†” ?ëŠ” Edge Function)??ê°€?•í•©?ˆë‹¤.
    // Public Sign-up ???´ë¼?´ì–¸???ì„œ ?Œì›ê°€?…ì„ ì²˜ë¦¬?˜ë ¤ë©?RPC ?¨ìˆ˜ë¥??¬ìš©?´ì•¼ ?©ë‹ˆ??
    // 
    // ?´ìœ :
    // - core-tenancy/onboarding.ts??createServerClient()ë¥??¬ìš©?˜ë?ë¡??œë²„ ?„ìš©
    // - ?´ë¼?´ì–¸?¸ì—??ì§ì ‘ ?¸ì¶œ ë¶ˆê?
    // - RPC ?¨ìˆ˜???´ë¼?´ì–¸?¸ì—???¸ì¶œ ê°€?¥í•˜ë©? SECURITY DEFINERë¡?RLSë¥??°íšŒ?˜ì—¬ ?Œë„Œ???ì„± ê°€??
    // 
    // [ë¶ˆë? ê·œì¹™] RPC ?¨ìˆ˜??core-tenancy/onboarding.ts??ë¡œì§ê³??™ì¼?˜ê²Œ êµ¬í˜„?˜ì–´???©ë‹ˆ??
    // 
    // ? ï¸ ì£¼ì˜: ?´ë©”???¸ì¦???„ë£Œ?˜ì? ?Šì•„???¬ìš©?ëŠ” ?ì„±?˜ë?ë¡??Œë„Œ???ì„±?€ ì§„í–‰
    const { data: tenantData, error: tenantError } = await this.supabase.rpc('create_tenant_with_onboarding', {
      p_name: input.tenant_name,
      p_industry_type: input.industry_type,
      p_plan: 'basic',
      p_owner_user_id: authData.user.id,
      p_referral_code: input.referral_code || null,
    });

    if (tenantError) {
      if (isDev) {
        console.error('???Œë„Œ???ì„± ?ëŸ¬ ?ì„¸:', {
          message: tenantError.message,
          code: tenantError.code,
          details: tenantError.details,
          hint: tenantError.hint,
        });
      }
      throw new Error(`?Œë„Œ???ì„± ?¤íŒ¨: ${tenantError.message}`);
    }

    if (!tenantData || !tenantData.tenant) {
      if (isDev) {
        console.error('???Œë„Œ???ì„± ê²°ê³¼ ?†ìŒ:', { tenantData });
      }
      throw new Error('?Œë„Œ???ì„± ê²°ê³¼ë¥?ë°›ì„ ???†ìŠµ?ˆë‹¤.');
    }

    const tenant = tenantData.tenant as Tenant;

    if (isDev) {
      console.log('???Œë„Œ???ì„± ?±ê³µ:', {
        tenantId: tenant.id,
        tenantName: tenant.name,
        industryType: tenant.industry_type,
      });
    }

    // 4. ?¸ì…˜ ?•ì¸ (?´ë©”???¸ì¦???„ë£Œ?˜ì? ?Šì•˜?¼ë©´ ?¸ì…˜???†ì„ ???ˆìŒ)
    let session = authData.session;
    
    if (!session) {
      // ?¸ì…˜???†ìœ¼ë©??´ë©”???¸ì¦ ?€ê¸??íƒœ
      // ?¬ìš©?ëŠ” ?ì„±?˜ì—ˆì§€ë§??´ë©”???¸ì¦???„ìš”??
      if (isDev) {
        console.warn('? ï¸ ?¸ì…˜???†ìŠµ?ˆë‹¤. ?´ë©”???¸ì¦???„ìš”?©ë‹ˆ??', {
          userId: authData.user.id,
          email: authData.user.email,
          emailConfirmed: !!authData.user.email_confirmed_at,
          tenantId: tenant.id,
          tenantName: tenant.name,
        });
        console.log('?’¡ ê°œë°œ ?˜ê²½?ì„œ??Supabase Dashboard > Authentication > Settings > Email Auth?ì„œ');
        console.log('   "Enable email confirmations"ë¥?ë¹„í™œ?±í™”?˜ê±°??"Auto Confirm"???œì„±?”í•˜?¸ìš”.');
      }
      
      // ? ï¸ ì¤‘ìš”: ?¬ìš©?ì? ?Œë„Œ?¸ëŠ” ?ì„±?˜ì—ˆì§€ë§??¸ì…˜ë§??†ëŠ” ?íƒœ
      // ??ê²½ìš° ?¬ìš©?ì—ê²??´ë©”???¸ì¦???”ì²­?´ì•¼ ??
      // ?˜ì?ë§??Œë„Œ?¸ëŠ” ?´ë? ?ì„±?˜ì—ˆ?¼ë?ë¡? ?´ë©”???¸ì¦ ??ë¡œê·¸?¸í•˜ë©??Œë„Œ?¸ê? ë³´ì—¬????
      throw new Error('?´ë©”???¸ì¦???„ìš”?©ë‹ˆ?? ?´ë©”?¼ì„ ?•ì¸?´ì£¼?¸ìš”. ?¸ì¦ ??ë¡œê·¸?¸í•˜?œë©´ ?Œë„Œ?¸ê? ?œì‹œ?©ë‹ˆ??');
    }

    // 5. ?Œë„Œ?¸ê? ?œë?ë¡??ì„±?˜ì—ˆ?”ì? ?•ì¸ (?¸ì…˜???ˆëŠ” ê²½ìš°?ë§Œ)
    // ? ï¸ ì£¼ì˜: ?´ë©”???¸ì¦???„ë£Œ?˜ì? ?Šì•˜?¼ë©´ ???¨ê³„???„ë‹¬?˜ì? ?ŠìŒ
    if (isDev) {
      // ?¬ìš©?ì˜ ?Œë„Œ??ëª©ë¡???¤ì‹œ ì¡°íšŒ?˜ì—¬ ?•ì¸
      const loginService = (await import('./login')).loginService;
      const verifyTenants = await loginService.getUserTenants(authData.user.id);
      
      if (verifyTenants.length === 0) {
        console.error('??ê²½ê³ : ?Œë„Œ?¸ê? ?ì„±?˜ì—ˆì§€ë§?ì¡°íšŒ?˜ì? ?ŠìŠµ?ˆë‹¤!', {
          userId: authData.user.id,
          tenantId: tenant.id,
          tenantName: tenant.name,
        });
        console.error('   ê°€?¥í•œ ?ì¸:');
        console.error('   1. user_tenant_roles???ˆì½”?œê? ?ì„±?˜ì? ?Šì•˜?????ˆìŒ');
        console.error('   2. RLS ?•ì±… ?Œë¬¸??ì¡°íšŒê°€ ???????ˆìŒ');
        console.error('   3. ?Œë„Œ?¸ê? ?¤ì œë¡??ì„±?˜ì? ?Šì•˜?????ˆìŒ');
      } else {
        console.log('???Œë„Œ??ì¡°íšŒ ?•ì¸ ?±ê³µ:', {
          tenantCount: verifyTenants.length,
          tenants: verifyTenants.map(t => ({ id: t.id, name: t.name })),
        });
      }
    }

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        phone: authData.user.phone,
        created_at: authData.user.created_at,
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        industry_type: tenant.industry_type,
      },
    };
  }

  /**
   * ?´ë©”???¸ì¦ ?•ì¸
   * 
   * ?´ë©”???¸ì¦ ë§í¬ë¥??´ë¦­?????¸ì¶œ
   */
  async verifyEmail(token: string, type: 'signup' | 'email_change' = 'signup'): Promise<LoginResult> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      token_hash: token,
      type,
    });

    if (error) {
      throw new Error(`?´ë©”???¸ì¦ ?¤íŒ¨: ${error.message}`);
    }

    if (!data.user || !data.session) {
      throw new Error('?´ë©”???¸ì¦ ?•ë³´ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.');
    }

    // ?¬ìš©?ì˜ ?Œë„Œ??ëª©ë¡ ì¡°íšŒ
    const loginService = (await import('./login')).loginService;
    const tenants = await loginService.getUserTenants(data.user.id);

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
   * ?´ë©”???¸ì¦ ?¬ì „??
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      throw new Error(`?´ë©”???¬ì „???¤íŒ¨: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const signupService = new SignupService();
