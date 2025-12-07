import { envCommonSchema, type EnvCommon } from './schema';
import { resolveEnv } from './resolve';

let cachedEnv: EnvCommon | null = null;

/**
 * ?œë²„/Edge ?„ìš© ê³µê°œ ê°?
 * APP_NAME, APP_VERSION, INDUSTRY_MODE ??
 */
export function getEnvCommon(): EnvCommon {
  if (cachedEnv) {
    return cachedEnv;
  }

  const raw = resolveEnv();
  const result = envCommonSchema.safeParse(raw);

  if (!result.success) {
    // ê³µí†µ ?˜ê²½ë³€?˜ëŠ” ? íƒ?ì´ë¯€ë¡?ê¸°ë³¸ê°??¬ìš©
    cachedEnv = envCommonSchema.parse({});
    return cachedEnv;
  }

  cachedEnv = result.data;
  return cachedEnv;
}

// ê¸°ë³¸ export
export const envCommon = getEnvCommon();

