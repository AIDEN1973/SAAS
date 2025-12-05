/**
 * 서버/Edge 환경별 환경변수 로딩 전략
 * - Edge Function (Supabase): Deno.env.toObject()
 * - Vercel (App/Node): process.env
 * - 로컬 개발: process.env (dotenv 로드 후)
 * 
 * ⚠️ 주의: 브라우저 환경에서는 사용 불가 (resolveEnv() 호출 시 에러 발생)
 * 
 * 환경변수 파일 위치:
 * - 루트 디렉토리: .env.local (로컬 개발용, 중앙 관리)
 * - dotenv는 server.ts에서 초기화 시점에 로드됨
 */
export function resolveEnv(): Record<string, string | undefined> {
  // Edge Function 환경 감지 (Supabase Edge Functions는 Deno 런타임)
  // @ts-ignore - Deno는 Edge Function 환경에서만 존재
  if (typeof Deno !== 'undefined' && Deno.env) {
    // @ts-ignore
    const env: Record<string, string | undefined> = {};
    // @ts-ignore
    const denoEnv = Deno.env.toObject();
    for (const [key, value] of Object.entries(denoEnv)) {
      env[key] = typeof value === 'string' ? value : undefined;
    }
    return env;
  }
  
  // Node.js / Vercel 환경
  // dotenv는 server.ts에서 이미 로드되어 있음
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  
  throw new Error(
    '환경변수 접근 불가: Edge/App/Node 환경을 감지할 수 없습니다.\n' +
    '브라우저 환경에서는 env-registry/server를 사용할 수 없습니다.\n' +
    '클라이언트 코드에서는 NEXT_PUBLIC_* 등 빌드타임 값을 직접 사용하세요.'
  );
}
