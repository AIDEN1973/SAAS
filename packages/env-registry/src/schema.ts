import { z } from 'zod';

// ?œë²„/Edge ?„ìš© ?¤í‚¤ë§?(ëª¨ë“  ?˜ê²½ë³€???¬í•¨)
export const envServerSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SERVICE_ROLE_KEY: z.string().min(1),  // Edge Function / ?œë²„ ?„ìš©
  SUPABASE_READ_REPLICA_URL: z.string().url().optional(),  // Phase 2+ Read Replica (?½ê¸° ?„ìš©)
  
  // ?˜ê²½ êµ¬ë¶„
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  
  // ê²°ì œ/?Œë¦¼ë±…í‚¹ (Phase 1 ?„ìˆ˜, ?¤ì œ ?¬ìš© ?œì ??requireEnv()ë¡?ì²´í¬)
  PAYMENT_ALIMBANK_API_URL: z.string().url().optional(),
  PAYMENT_ALIMBANK_API_KEY: z.string().min(1).optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().min(1).optional(),
  
  // Phase 2+ (Role ë¶„ë¦¬)
  PAYMENT_WEBHOOK_ROLE_KEY: z.string().min(1).optional(),
  BILLING_BATCH_ROLE_KEY: z.string().min(1).optional(),
  ANALYTICS_ROLE_KEY: z.string().min(1).optional(),
  
  // Custom Domain (Phase 2+)
  CUSTOM_DOMAIN_VERIFY_SECRET: z.string().min(1).optional(),
  
  // ?¸ë? ?Œì»¤ (Phase 2+)
  AWS_LAMBDA_ANALYTICS_FUNCTION_NAME: z.string().optional(),
  CLOUDFLARE_WORKER_ANALYTICS_URL: z.string().url().optional(),
  
  // Kakao Maps API (Phase 2+ ì§€??ê¸°ëŠ¥?? ?œë²„/Edge Function ?„ìš©)
  KAKAO_REST_API_KEY: z.string().min(1).optional(),
});

// ?´ë¼?´ì–¸???„ìš© ?¤í‚¤ë§?(NEXT_PUBLIC_* ??ë¹Œë“œ?€???¸ì¶œ ê°’ë§Œ)
export const envClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),  // ?„ìˆ˜
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),  // ?„ìˆ˜
  NEXT_PUBLIC_KAKAO_JS_KEY: z.string().min(1).optional(),  // Phase 2+ ì§€??ê¸°ëŠ¥??(JavaScript SDK)
  // ?´ë¼?´ì–¸?¸ì— ?¸ì¶œ ê°€?¥í•œ ê³µê°œ ê°’ë§Œ ?¬í•¨
  // ?ˆë? Service Role Key??ë¹„ë? ê°??¬í•¨ ê¸ˆì?
});

// ?œë²„/Edge ?„ìš© ê³µí†µ ?¤í‚¤ë§?(?±ëª…, ë²„ì „?•ë³´ ??
// ?´ë¼?´ì–¸?¸ì—???„ìš”??ê°’ì? NEXT_PUBLIC_*ë¡?envClient???¬í•¨
export const envCommonSchema = z.object({
  APP_NAME: z.string().min(1).optional(),
  APP_VERSION: z.string().min(1).optional(),
  INDUSTRY_MODE: z.enum(['academy', 'salon', 'realestate', 'gym', 'ngo']).optional(),
  // ?œë²„/Edge?ì„œë§??¬ìš©?˜ëŠ” ê³µê°œ ê°?
});

export type EnvServer = z.infer<typeof envServerSchema>;
export type EnvClient = z.infer<typeof envClientSchema>;
export type EnvCommon = z.infer<typeof envCommonSchema>;

