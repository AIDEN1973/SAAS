/**
 * Core Auth Login Service
 * 
 * ë¡œê·¸???œë¹„??(Supabase Auth ?˜í•‘)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì£¼ì˜: ?¤ì œ ?¸ì¦ ë¡œì§?€ Supabase Authë¥?ì§ì ‘ ?¬ìš©?©ë‹ˆ??
 * ???œë¹„?¤ëŠ” ë¡œê·¸??ê´€??? í‹¸ë¦¬í‹°?€ ?¬í¼ ?¨ìˆ˜ë¥??œê³µ?©ë‹ˆ??
 */

import { createClient } from '@lib/supabase-client';
import { maskPII, maskEmail } from '@core/pii-utils';
import type { LoginInput, OAuthLoginInput, OTPLoginInput, LoginResult, TenantSelectionResult, TenantInfo } from './types';

export class LoginService {
  private supabase = createClient();

  /**
   * ?´ë©”??ë¹„ë?ë²ˆí˜¸ ë¡œê·¸??
   * 
   * [ê¸°ìˆ ë¬¸ì„œ ?”êµ¬?¬í•­]
   * - ?´ë©”??ë¹„ë?ë²ˆí˜¸ ë¡œê·¸??(loginWithEmail)
   * - ë¡œê·¸???Œë¡œ?? ?¬ìš©???¸ì¦ ???Œë„Œ??ëª©ë¡ ì¡°íšŒ ???Œë„Œ??? íƒ
   */
  async loginWithEmail(input: LoginInput): Promise<LoginResult> {
    // ?…ë ¥ê°?ê²€ì¦?
    if (!input.email || !input.email.trim()) {
      throw new Error('?´ë©”?¼ì„ ?…ë ¥?´ì£¼?¸ìš”.');
    }

    if (!input.password || !input.password.trim()) {
      throw new Error('ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.');
    }

    // ?´ë©”???•ì‹ ê²€ì¦?(ê°„ë‹¨??ê²€ì¦?
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      throw new Error('?¬ë°”ë¥??´ë©”???•ì‹???„ë‹™?ˆë‹¤.');
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });

    if (error) {
      // Supabase Auth ?ëŸ¬ ì½”ë“œë³??ì„¸ ë©”ì‹œì§€
      // [ê¸°ìˆ ë¬¸ì„œ ?”êµ¬?¬í•­] ?ëŸ¬ ë©”ì‹œì§€??ë¯¼ê° ?•ë³´ ?¸ì¶œ ê¸ˆì?, ?¬ìš©??ì¹œí™”??ë©”ì‹œì§€ ?œê³µ
      let errorMessage = 'ë¡œê·¸?¸ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.';
      
      // ?ëŸ¬ ì½”ë“œ ê¸°ë°˜ ì²˜ë¦¬ (Supabase Auth ?œì? ?ëŸ¬ ì½”ë“œ)
      const errorCode = error.code || '';
      const errorMsg = error.message || '';
      
      // ?´ë©”???¸ì¦ ?„ìš”
      if (errorCode === 'email_not_confirmed' || errorMsg.includes('Email not confirmed') || errorMsg.includes('email_not_confirmed')) {
        errorMessage = '?´ë©”???¸ì¦???„ìš”?©ë‹ˆ?? ?´ë©”?¼ì„ ?•ì¸?´ì£¼?¸ìš”.';
      }
      // ?˜ëª»???ê²©ì¦ëª… (ê°€???”í•œ ê²½ìš°)
      else if (errorCode === 'invalid_credentials' || errorMsg.includes('Invalid login credentials') || errorMsg.includes('invalid_credentials')) {
        errorMessage = '?´ë©”???ëŠ” ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤. ?Œì›ê°€?…ì´ ?„ìš”?˜ì‹œë©??Œì›ê°€???˜ì´ì§€ë¡??´ë™?´ì£¼?¸ìš”.';
      }
      // ê³„ì • ? ê¸ˆ ?ëŠ” Rate Limit
      else if (errorCode === 'too_many_requests' || errorMsg.includes('too many requests') || errorMsg.includes('rate_limit')) {
        errorMessage = '?ˆë¬´ ë§ì? ë¡œê·¸???œë„ê°€ ?ˆì—ˆ?µë‹ˆ?? ? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.';
      }
      // ?¬ìš©???†ìŒ
      else if (errorCode === 'user_not_found' || errorMsg.includes('User not found')) {
        errorMessage = '?±ë¡?˜ì? ?Šì? ?´ë©”?¼ì…?ˆë‹¤. ?Œì›ê°€?…ì„ ì§„í–‰?´ì£¼?¸ìš”.';
      }
      // ë¹„ë?ë²ˆí˜¸ ?¬ì„¤???„ìš”
      else if (errorCode === 'email_rate_limit_exceeded' || errorMsg.includes('email rate limit')) {
        errorMessage = '?´ë©”???„ì†¡ ?œë„ë¥?ì´ˆê³¼?ˆìŠµ?ˆë‹¤. ? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.';
      }
      // ê¸°í? ?ëŸ¬ (ë¯¼ê° ?•ë³´ ?œê±°)
      else {
        // ê°œë°œ ?˜ê²½?ì„œë§??ì„¸ ?ëŸ¬ ?œì‹œ
        if (typeof window !== 'undefined' && import.meta.env?.DEV) {
          errorMessage = `ë¡œê·¸???¤íŒ¨: ${errorMsg}`;
        } else {
          errorMessage = 'ë¡œê·¸?¸ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤. ?´ë©”?¼ê³¼ ë¹„ë?ë²ˆí˜¸ë¥??•ì¸?´ì£¼?¸ìš”.';
        }
      }

      // ê°œë°œ ?˜ê²½?ì„œ ?ì„¸ ?ëŸ¬ ë¡œê·¸ (PII ë§ˆìŠ¤???ìš©)
      // [ê¸°ìˆ ë¬¸ì„œ ê·œì¹™] ë¡œê·¸??PII ì§ì ‘ ?¸ì¶œ ê¸ˆì?, maskPII() ?¬ìš© ?„ìˆ˜
      if (typeof window !== 'undefined' && import.meta.env?.DEV) {
        console.error('ë¡œê·¸???ëŸ¬ ?ì„¸:', maskPII({
          message: error.message,
          status: error.status,
          code: error.code,
        }));
      }

      throw new Error(errorMessage);
    }

    if (!data.user || !data.session) {
      throw new Error('ë¡œê·¸???•ë³´ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.');
    }

    // ?¬ìš©?ì˜ ?Œë„Œ??ëª©ë¡ ì¡°íšŒ
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
   * ?Œì…œ ë¡œê·¸??(OAuth)
   * 
   * ? ï¸ ì£¼ì˜: OAuth??ë¦¬ë‹¤?´ë ‰??ë°©ì‹?´ë?ë¡???ë©”ì„œ?œëŠ” URLë§?ë°˜í™˜?©ë‹ˆ??
   * ?¤ì œ ?¸ì¦?€ ë¸Œë¼?°ì??ì„œ ì²˜ë¦¬?©ë‹ˆ??
   * 
   * [ë¶ˆë? ê·œì¹™] ?´ë¼?´ì–¸???„ìš© ì½”ë“œ?´ë?ë¡?window ê°ì²´ ?¬ìš© ê°€??
   */
  async loginWithOAuth(input: OAuthLoginInput): Promise<{ url: string }> {
    // ?´ë¼?´ì–¸???˜ê²½ ?•ì¸
    if (typeof window === 'undefined') {
      throw new Error('?Œì…œ ë¡œê·¸?¸ì? ?´ë¼?´ì–¸???˜ê²½?ì„œë§??¬ìš©?????ˆìŠµ?ˆë‹¤.');
    }
    
    const redirectTo = input.redirectTo || `${window.location.origin}/auth/callback`;
    
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: input.provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw new Error(`?Œì…œ ë¡œê·¸???¤íŒ¨: ${error.message}`);
    }

    if (!data.url) {
      throw new Error('?Œì…œ ë¡œê·¸??URL???ì„±?????†ìŠµ?ˆë‹¤.');
    }

    return { url: data.url };
  }

  /**
   * OTP ë¡œê·¸??(?„í™”ë²ˆí˜¸ ?¸ì¦)
   * 
   * 1?¨ê³„: ?„í™”ë²ˆí˜¸ë¡?OTP ?„ì†¡
   * 2?¨ê³„: OTP ì½”ë“œë¡??¸ì¦
   */
  async sendOTP(phone: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      throw new Error(`OTP ?„ì†¡ ?¤íŒ¨: ${error.message}`);
    }
  }

  async loginWithOTP(input: OTPLoginInput): Promise<LoginResult> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      phone: input.phone,
      token: input.otp,
      type: 'sms',
    });

    if (error) {
      throw new Error(`OTP ?¸ì¦ ?¤íŒ¨: ${error.message}`);
    }

    if (!data.user || !data.session) {
      throw new Error('OTP ?¸ì¦ ?•ë³´ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.');
    }

    // ?¬ìš©?ì˜ ?Œë„Œ??ëª©ë¡ ì¡°íšŒ
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
   * ?¬ìš©?ì˜ ?Œë„Œ??ëª©ë¡ ì¡°íšŒ
   * 
   * ? ï¸ ì£¼ì˜: ???¨ìˆ˜??RLS ?•ì±…???í–¥??ë°›ìŠµ?ˆë‹¤.
   * user_tenant_roles ?Œì´ë¸”ì˜ RLS ?•ì±…: user_id = auth.uid()
   * tenants ?Œì´ë¸”ì˜ RLS ?•ì±…: user_tenant_rolesë¥??µí•œ ê°„ì ‘ ì°¸ì¡°
   */
  async getUserTenants(userId: string): Promise<TenantInfo[]> {
    const isDev = typeof window !== 'undefined' && (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV);
    
    // ?„ì¬ ?¸ì…˜??user_id ?•ì¸
    const { data: { session } } = await this.supabase.auth.getSession();
    const currentUserId = session?.user?.id;
    
    if (isDev) {
      console.log('?” getUserTenants ?¸ì¶œ:', {
        requestedUserId: userId,
        currentSessionUserId: currentUserId,
        userIdMatch: userId === currentUserId,
        hasSession: !!session,
      });
    }

    // RLS ?•ì±… ?Œë¬¸??userId?€ ?„ì¬ ?¸ì…˜??user_idê°€ ?¼ì¹˜?´ì•¼ ??
    if (userId !== currentUserId) {
      if (isDev) {
        console.warn('? ï¸ ê²½ê³ : ?”ì²­??userId?€ ?„ì¬ ?¸ì…˜??user_idê°€ ?¼ì¹˜?˜ì? ?ŠìŠµ?ˆë‹¤.', {
          requestedUserId: userId,
          currentSessionUserId: currentUserId,
        });
        console.warn('   RLS ?•ì±… ?Œë¬¸??ì¡°íšŒê°€ ?¤íŒ¨?????ˆìŠµ?ˆë‹¤.');
      }
    }

    // ? ï¸ ì¤‘ìš”: tenants ?Œì´ë¸?ì¡°ì¸ ??RLS ?œí™˜ ì°¸ì¡° ë¬¸ì œ ë°œìƒ ê°€??
    // tenants RLS ?•ì±…??user_tenant_rolesë¥?ì°¸ì¡°?˜ë?ë¡? ì¡°ì¸ ?€??ë³„ë„ ì¡°íšŒ
    // 1?¨ê³„: user_tenant_roles ì¡°íšŒ
    const { data: rolesData, error: rolesError } = await this.supabase
      .from('user_tenant_roles')
      .select('tenant_id, role')
      .eq('user_id', userId);

    if (rolesError) {
      if (isDev) {
        console.error('??user_tenant_roles ì¡°íšŒ ?ëŸ¬ ?ì„¸:', {
          message: rolesError.message,
          code: rolesError.code,
          details: rolesError.details,
          hint: rolesError.hint,
          userId,
          currentSessionUserId: currentUserId,
        });
      }
      
      // 404 ?ëŸ¬?????¬ìš©?ë¡œ ê°„ì£¼ (?Œë„Œ???†ìŒ)
      if (rolesError.code === 'PGRST116' || rolesError.message.includes('Could not find the table')) {
        if (isDev) {
          console.warn('? ï¸ ?Œì´ë¸”ì„ ì°¾ì„ ???†ìŠµ?ˆë‹¤. ë¹?ë°°ì—´ ë°˜í™˜.');
        }
        return [];
      }
      throw new Error(`?Œë„Œ??ëª©ë¡ ì¡°íšŒ ?¤íŒ¨: ${rolesError.message}`);
    }

    if (!rolesData || rolesData.length === 0) {
      if (isDev) {
        console.warn('? ï¸ user_tenant_roles ?°ì´?°ê? ?†ìŠµ?ˆë‹¤:', {
          userId,
          currentSessionUserId: currentUserId,
          possibleReasons: [
            'user_tenant_roles???ˆì½”?œê? ?†ìŒ',
            'RLS ?•ì±… ?Œë¬¸??ì¡°íšŒê°€ ì°¨ë‹¨??(user_id = auth.uid() ë¶ˆì¼ì¹?',
          ],
        });
      }
      return [];
    }

    if (isDev) {
      console.log('??user_tenant_roles ì¡°íšŒ ?±ê³µ:', {
        count: rolesData.length,
        roles: rolesData.map(r => ({ tenant_id: r.tenant_id, role: r.role })),
      });
    }

    // 2?¨ê³„: ê°?tenant_idë¡?tenants ?Œì´ë¸?ì¡°íšŒ (RLS ?•ì±… ?ìš©)
    // ? ï¸ ì£¼ì˜: tenants ?Œì´ë¸”ì˜ RLS ?•ì±…?€ user_tenant_rolesë¥?ì°¸ì¡°?©ë‹ˆ??
    // RLS ?•ì±…: id IN (SELECT tenant_id FROM user_tenant_roles WHERE user_id = auth.uid())
    // ???•ì±…???œë?ë¡??‘ë™?˜ë ¤ë©?user_tenant_rolesê°€ ë¨¼ì? ì¡°íšŒ ê°€?¥í•´???©ë‹ˆ??
    const tenantIds = rolesData.map(r => r.tenant_id);
    
    if (isDev) {
      console.log('?” tenants ì¡°íšŒ ?œë„:', {
        tenantIds,
        tenantIdsCount: tenantIds.length,
        currentSessionUserId: currentUserId,
      });
    }
    
    const { data: tenantsData, error: tenantsError } = await this.supabase
      .from('tenants')
      .select('id, name, industry_type')
      .in('id', tenantIds);

    if (tenantsError) {
      if (isDev) {
        console.error('??tenants ì¡°íšŒ ?ëŸ¬ ?ì„¸:', {
          message: tenantsError.message,
          code: tenantsError.code,
          details: tenantsError.details,
          hint: tenantsError.hint,
          tenantIds,
          currentSessionUserId: currentUserId,
        });
      }
      // tenants ì¡°íšŒ ?¤íŒ¨ ??role ?•ë³´ë§?ë°˜í™˜
      return rolesData.map(r => ({
        id: r.tenant_id,
        name: '?????†ìŒ',
        industry_type: 'unknown' as const,
        role: r.role,
      }));
    }

    if (isDev) {
      console.log('??tenants ì¡°íšŒ ?±ê³µ:', {
        count: tenantsData?.length || 0,
        tenants: tenantsData,
        requestedTenantIds: tenantIds,
        foundTenantIds: tenantsData?.map(t => t.id) || [],
        missingTenantIds: tenantIds.filter(id => !tenantsData?.some(t => t.id === id)),
      });
      
      // tenantsê°€ ì¡°íšŒ?˜ì? ?Šì? ê²½ìš° ?ì¸ ë¶„ì„
      if ((tenantsData?.length || 0) === 0 && tenantIds.length > 0) {
        console.error('??tenants ì¡°íšŒ ?¤íŒ¨ ?ì¸ ë¶„ì„:', {
          tenantIds,
          currentSessionUserId: currentUserId,
          possibleReasons: [
            'RLS ?•ì±…??user_tenant_rolesë¥?ì°¸ì¡°?˜ëŠ”?? ?œë¸Œì¿¼ë¦¬ ?¤í–‰ ??ë¬¸ì œ ë°œìƒ',
            'tenants ?Œì´ë¸”ì— ?¤ì œë¡??ˆì½”?œê? ?†ìŒ',
            'RLS ?•ì±…???œë?ë¡??ìš©?˜ì? ?ŠìŒ',
            '?¸ì…˜??auth.uid()?€ user_tenant_roles??user_idê°€ ë¶ˆì¼ì¹?,
          ],
          suggestion: 'Supabase Dashboard > SQL Editor?ì„œ ì§ì ‘ ì¡°íšŒ?˜ì—¬ ?•ì¸:',
          sqlQuery: `SELECT * FROM public.tenants WHERE id = '${tenantIds[0]}';`,
          rlsCheckQuery: `SELECT id FROM public.tenants WHERE id IN (SELECT tenant_id FROM public.user_tenant_roles WHERE user_id = '${currentUserId}');`,
        });
      }
    }

    // 3?¨ê³„: ê²°ê³¼ ë³‘í•©
    const tenantMap = new Map(
      (tenantsData || []).map(t => [t.id, { id: t.id, name: t.name, industry_type: t.industry_type }])
    );

    return rolesData
      .map((role): TenantInfo | null => {
        const tenant = tenantMap.get(role.tenant_id);
        if (!tenant) {
          if (isDev) {
            console.warn('? ï¸ tenant ?•ë³´ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤:', {
              tenant_id: role.tenant_id,
              role: role.role,
            });
          }
          // tenant ?•ë³´ê°€ ?†ì–´??role ?•ë³´??ë°˜í™˜
          return {
            id: role.tenant_id,
            name: '?????†ìŒ',
            industry_type: 'academy' as const, // ê¸°ë³¸ê°?
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
   * ?Œë„Œ??? íƒ
   * 
   * ? íƒ???Œë„Œ?¸ì˜ tenant_idë¥?JWT claim???¬í•¨?˜ì—¬ ???¸ì…˜ ?ì„±
   * 
   * [ê¸°ìˆ ë¬¸ì„œ ?”êµ¬?¬í•­]
   * - ë¡œê·¸???Œë¡œ??3?¨ê³„: ?Œë„Œ??? íƒ (JWT claim??tenant_id ?¬í•¨)
   * - ë¡œê·¸???Œë¡œ??4?¨ê³„: ?¸ì…˜ ?ˆë¡œê³ ì¹¨ (?…ë°?´íŠ¸??JWT ë°›ê¸°)
   * 
   * ? ï¸ ì¤‘ìš”: JWT claim ?…ë°?´íŠ¸??Supabase Database Trigger ?ëŠ” Edge Function?ì„œ ì²˜ë¦¬?©ë‹ˆ??
   * - Database Trigger: user_tenant_roles ë³€ê²????ë™?¼ë¡œ JWT claim ?…ë°?´íŠ¸
   * - ?ëŠ” Edge Function: selectTenant ?¸ì¶œ ??tenant_idë¥?JWT claim???¬í•¨?˜ì—¬ ??? í° ë°œê¸‰
   * 
   * ?„ì¬ êµ¬í˜„?€ ?¸ì…˜???ˆë¡œê³ ì¹¨?˜ì—¬ ìµœì‹  JWTë¥?ë°›ì•„?µë‹ˆ??
   * ?¤ì œ JWT claim??tenant_idê°€ ?¬í•¨?˜ë ¤ë©?Supabase ?¸í”„???¤ì •???„ìš”?©ë‹ˆ??
   */
  async selectTenant(tenantId: string): Promise<TenantSelectionResult> {
    // ?„ì¬ ?¸ì…˜ ?•ì¸
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('?¸ì…˜???†ìŠµ?ˆë‹¤. ?¤ì‹œ ë¡œê·¸?¸í•´ì£¼ì„¸??');
    }

    // ?¬ìš©?ê? ?´ë‹¹ ?Œë„Œ?¸ì— ?‘ê·¼ ê¶Œí•œ???ˆëŠ”ì§€ ?•ì¸
    const { data: roleData, error: roleError } = await this.supabase
      .from('user_tenant_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('tenant_id', tenantId)
      .single();

    if (roleError || !roleData) {
      throw new Error('?´ë‹¹ ?Œë„Œ?¸ì— ?‘ê·¼ ê¶Œí•œ???†ìŠµ?ˆë‹¤.');
    }

    // ?¸ì…˜ ?ˆë¡œê³ ì¹¨ (JWT claim ?…ë°?´íŠ¸??Edge Function?ì„œ ì²˜ë¦¬)
    const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession(session);

    if (refreshError || !refreshData.session) {
      throw new Error(`?¸ì…˜ ?ˆë¡œê³ ì¹¨ ?¤íŒ¨: ${refreshError?.message || '?????†ëŠ” ?¤ë¥˜'}`);
    }

    return {
      access_token: refreshData.session.access_token,
      refresh_token: refreshData.session.refresh_token,
      expires_at: refreshData.session.expires_at,
    };
  }

  /**
   * ë¡œê·¸?„ì›ƒ
   */
  async logout(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw new Error(`ë¡œê·¸?„ì›ƒ ?¤íŒ¨: ${error.message}`);
    }
  }

  /**
   * ?„ì¬ ?¸ì…˜ ì¡°íšŒ
   */
  async getCurrentSession() {
    const { data: { session }, error } = await this.supabase.auth.getSession();

    if (error) {
      throw new Error(`?¸ì…˜ ì¡°íšŒ ?¤íŒ¨: ${error.message}`);
    }

    return session;
  }
}

/**
 * Default Service Instance
 * 
 * [ë¶ˆë? ê·œì¹™] ?´ë¼?´ì–¸??ì½”ë“œ?ì„œ ?¬ìš©?˜ëŠ” ?¸ì¦ ?œë¹„???¸ìŠ¤?´ìŠ¤
 */
export const loginService = new LoginService();

