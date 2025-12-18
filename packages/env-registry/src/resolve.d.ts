/**
 * 서버/Edge 환경변수 로딩 전략
 * - Edge Function (Supabase): Deno.env.toObject()
 * - Vercel (App/Node): process.env
 * - 로컬 개발: process.env (dotenv 로드 후)
 *
 * ⚠️ 주의: 브라우저 환경에서는 사용 불가 (resolveEnv() 호출 시 에러 발생)
 *
 * 환경변수 파일 위치:
 * - 루트 디렉토리: .env.local (로컬 개발용, 중앙 관리)
 * - dotenv는 server.ts에서 초기 진입점에서 로드됨
 */
export declare function resolveEnv(): Record<string, string | undefined>;
//# sourceMappingURL=resolve.d.ts.map