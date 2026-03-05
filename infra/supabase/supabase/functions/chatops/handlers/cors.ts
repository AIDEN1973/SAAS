// LAYER: EDGE_FUNCTION_HANDLER
/**
 * CORS 헤더 관리
 * - Origin 검증
 * - 동적 CORS 헤더 생성
 */

/**
 * 🔧 FIX: P0-SEC - CORS 헤더 생성 (allowlist 지원)
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // 환경변수에서 허용된 origin 목록 가져오기 (쉼표로 구분)
  // @ts-ignore - Deno는 Edge Function 환경에서만 존재
  const allowedOriginsEnv: string = (typeof Deno !== 'undefined' ? Deno.env.get('ALLOWED_ORIGINS') : undefined) ?? '*';
  const allowedOrigins = allowedOriginsEnv === '*'
    ? ['*']
    : allowedOriginsEnv.split(',').map((o: string) => o.trim());

  // Origin 검증
  let corsOrigin = '*';
  if (origin) {
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      corsOrigin = origin;
    } else if (allowedOrigins.length > 0) {
      // 허용되지 않은 origin이면 첫 번째 허용된 origin 사용
      corsOrigin = allowedOrigins[0];
    }
  }

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

