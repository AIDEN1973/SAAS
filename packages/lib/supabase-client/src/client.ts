import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { envClient } from '@env-registry/core';

/**
 * ?±ê???Supabase ?´ë¼?´ì–¸???¸ìŠ¤?´ìŠ¤
 * ?¬ëŸ¬ ?¸ìŠ¤?´ìŠ¤ ?ì„± ë°©ì? (GoTrueClient ê²½ê³  ?´ê²°)
 */
let clientInstance: SupabaseClient | null = null;

/**
 * Cross-Origin Session Storage Adapter
 * 
 * [ë¶ˆë? ê·œì¹™] ê°œë°œ ?˜ê²½?ì„œ localhost:3000ê³?localhost:3002 ê°??¸ì…˜ ê³µìœ 
 * [ë¶ˆë? ê·œì¹™] localStorage??originë³„ë¡œ ë¶„ë¦¬?˜ë?ë¡? URL ?Œë¼ë¯¸í„°ë¡??¸ì…˜???„ë‹¬
 * 
 * Supabase??ê¸°ë³¸?ìœ¼ë¡?localStorageë¥??¬ìš©?˜ì?ë§? ?¬íŠ¸ê°€ ?¤ë¥´ë©? * ?¤ë¥¸ origin?¼ë¡œ ê°„ì£¼?˜ì–´ ê³µìœ ?˜ì? ?ŠìŠµ?ˆë‹¤.
 */
function createCrossOriginStorage() {
  return {
    getItem: (key: string): string | null => {
      // 1. ?„ì¬ origin??localStorage ?•ì¸
      if (typeof window !== 'undefined') {
        const value = localStorage.getItem(key);
        if (value) return value;
      }
      
      // 2. URL ?Œë¼ë¯¸í„°?ì„œ ?¸ì…˜ ?•ì¸ (ë¡œê·¸????ë¦¬ë‹¤?´ë ‰????
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionToken = urlParams.get('session_token');
        if (sessionToken && key.includes('auth-token')) {
          // ?¸ì…˜ ? í°??localStorage???€??          try {
            const sessionData = JSON.parse(decodeURIComponent(sessionToken));
            localStorage.setItem(key, JSON.stringify(sessionData));
            // URL?ì„œ ?Œë¼ë¯¸í„° ?œê±°
            urlParams.delete('session_token');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
            return JSON.stringify(sessionData);
          } catch (e) {
            console.error('[Cross-Origin Storage] ?¸ì…˜ ? í° ?Œì‹± ?¤íŒ¨:', e);
          }
        }
      }
      
      return null;
    },
    setItem: (key: string, value: string): void => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
    },
    removeItem: (key: string): void => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    },
  };
}

/**
 * ?´ë¼?´ì–¸?¸ìš© Supabase ?´ë¼?´ì–¸???ì„± (?±ê???
 * NEXT_PUBLIC_* ?˜ê²½ë³€???¬ìš©
 */
export function createClient(): SupabaseClient {
  // ?´ë? ?¸ìŠ¤?´ìŠ¤ê°€ ?ˆìœ¼ë©??¬ì‚¬??  if (clientInstance) {
    return clientInstance;
  }

  const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URLê³?Anon Keyê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ??');
  }

  // ê°œë°œ ?˜ê²½?ì„œ URL ?•ì¸ ë¡œê·¸ ì¶œë ¥
  if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
    const correctUrl = 'https://xawypsrotrfoyozhrsbb.supabase.co';
    const isCorrect = supabaseUrl === correctUrl;
    
    console.log('?” Supabase ?´ë¼?´ì–¸???ì„±:', {
      '?„ì¬ URL': supabaseUrl,
      '?¬ë°”ë¥?URL': correctUrl,
      '?¼ì¹˜': isCorrect ? '?? : '??,
      'Anon Key ?¤ì •??: supabaseAnonKey ? '?? : '??,
    });
    
    if (!isCorrect) {
      console.error('???˜ëª»??Supabase URL???¬ìš©?˜ê³  ?ˆìŠµ?ˆë‹¤!');
      console.error('   ?„ì¬:', supabaseUrl);
      console.error('   ?¬ë°”ë¥?ê°?', correctUrl);
      console.error('   .env.local ?Œì¼???•ì¸?˜ê³  ê°œë°œ ?œë²„ë¥??¬ì‹œ?‘í•˜?¸ìš”.');
    }
  }

  // Custom Storage Adapter for Cross-Port Session Sharing
  // [ë¶ˆë? ê·œì¹™] ê°œë°œ ?˜ê²½?ì„œ localhost:3000ê³?localhost:3002 ê°??¸ì…˜ ê³µìœ 
  // [ë¶ˆë? ê·œì¹™] localStorage??originë³„ë¡œ ë¶„ë¦¬?˜ë?ë¡? sessionStorageë¥??¬ìš©?˜ê±°??  //            URL ?Œë¼ë¯¸í„°ë¡??¸ì…˜???„ë‹¬?´ì•¼ ?©ë‹ˆ??
  // 
  // ì°¸ê³ : Supabase??ê¸°ë³¸?ìœ¼ë¡?localStorageë¥??¬ìš©?˜ì?ë§? ?¬íŠ¸ê°€ ?¤ë¥´ë©?  //      ?¤ë¥¸ origin?¼ë¡œ ê°„ì£¼?˜ì–´ ê³µìœ ?˜ì? ?ŠìŠµ?ˆë‹¤.
  // 
  // ?´ê²° ë°©ë²•:
  // 1. ê°™ì? ?¬íŠ¸?ì„œ ?œë¸Œ?¨ìŠ¤ë¡??¼ìš°??(ê¶Œì¥)
  // 2. ?ëŠ” custom storage adapter ?¬ìš© (ë³µì¡??
  // 3. ?ëŠ” URL ?Œë¼ë¯¸í„°ë¡??¸ì…˜ ?„ë‹¬ (ë³´ì•ˆ ?„í—˜)
  //
  // ?„ì¬??ê¸°ë³¸ localStorageë¥??¬ìš©?˜ë˜, ?¬ìš©?ê? academy-admin ?±ì—??  // ë¡œê·¸?¸í•œ ??super-admin ?±ìœ¼ë¡??Œì•„?¤ë©´ ?˜ë™?¼ë¡œ ?¸ì…˜???•ì¸?˜ë„ë¡??©ë‹ˆ??

  // Custom storage adapter for cross-origin session sharing
  // ê°œë°œ ?˜ê²½?ì„œë§??¬ìš© (?„ë¡œ?•ì…˜?ì„œ??ê°™ì? origin ?¬ìš© ê¶Œì¥)
  const customStorage = typeof window !== 'undefined' && (import.meta as any).env?.DEV
    ? createCrossOriginStorage()
    : undefined;

  clientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...(customStorage && { storage: customStorage }),
    },
  });

  return clientInstance;
}

