/**
 * useIsSuperAdmin Hook
 * 
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: ê¶Œí•œ?€ ?œë²„(RLS)?ì„œë§??ì •
 * [ë¶ˆë? ê·œì¹™] UI??ê¶Œí•œ??ì¶”ë¡ ?˜ì? ?Šê³ , API ?‘ë‹µë§??•ì¸
 * [ë¶ˆë? ê·œì¹™] user_platform_roles ?Œì´ë¸”ì—??super_admin ??•  ?•ì¸
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—?”í„°.txt 3. ë³´ì•ˆ ëª¨ë¸
 */

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';

/**
 * Super Admin ê¶Œí•œ ?•ì¸ Hook
 * 
 * [ë¶ˆë? ê·œì¹™] user_platform_roles ?Œì´ë¸”ì—??role = 'super_admin' ?•ì¸
 * [ë¶ˆë? ê·œì¹™] ê¶Œí•œ ?ì •?€ RLS?ì„œ ì²˜ë¦¬?˜ë?ë¡? ì¡°íšŒ ?±ê³µ ?¬ë?ë¡??ë‹¨
 */
export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ['auth', 'isSuperAdmin'],
    queryFn: async () => {
      const supabase = createClient();
      
      console.log('[useIsSuperAdmin] ?œì‘: Super Admin ê¶Œí•œ ?•ì¸');
      
      // ?„ì¬ ?¬ìš©???•ë³´ ê°€?¸ì˜¤ê¸?
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('[useIsSuperAdmin] ?¬ìš©???•ë³´ ê°€?¸ì˜¤ê¸??¤íŒ¨:', userError);
        return false;
      }
      
      if (!user) {
        console.warn('[useIsSuperAdmin] ?¬ìš©?ê? ë¡œê·¸?¸í•˜ì§€ ?Šì•˜?µë‹ˆ??');
        return false;
      }
      
      console.log('[useIsSuperAdmin] ?„ì¬ ?¬ìš©??', {
        id: user.id,
        email: user.email,
      });
      
      // user_platform_roles ?Œì´ë¸”ì—??super_admin ??•  ?•ì¸
      // RLS ?•ì±…???˜í•´ ê¶Œí•œ???†ìœ¼ë©?ì¡°íšŒ ?¤íŒ¨
      // ? ï¸ ì¤‘ìš”: user_idë¡??„í„°ë§í•˜???ì‹ ????• ë§?ì¡°íšŒ (RLS ?•ì±…ê³??¼ì¹˜)
      console.log('[useIsSuperAdmin] user_platform_roles ?Œì´ë¸?ì¡°íšŒ ?œì‘...');
      console.log('[useIsSuperAdmin] ì¿¼ë¦¬ ?Œë¼ë¯¸í„°:', {
        user_id: user.id,
        role: 'super_admin',
      });
      
      const { data, error } = await supabase
        .from('user_platform_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();
      
      console.log('[useIsSuperAdmin] ì¿¼ë¦¬ ê²°ê³¼:', {
        data,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        } : null,
      });
      
      if (error) {
        console.error('[useIsSuperAdmin] ??•  ì¡°íšŒ ?¤íŒ¨:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        // ê¶Œí•œ ?†ìŒ ?ëŠ” ?Œì´ë¸??‘ê·¼ ë¶ˆê?
        return false;
      }
      
      const isSuperAdmin = !!data;
      console.log('[useIsSuperAdmin] ê²°ê³¼:', {
        isSuperAdmin,
        role: data?.role,
      });
      
      // ?°ì´?°ê? ?ˆìœ¼ë©?Super Admin
      return isSuperAdmin;
    },
    staleTime: 5 * 60 * 1000, // 5ë¶?
    retry: false, // ê¶Œí•œ ì²´í¬???¤íŒ¨ ???¬ì‹œ??ë¶ˆí•„??
  });
}

