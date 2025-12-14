/**
 * 중앙 환경변수 관리 레지스트리
 *
 * 사용법:
 * - 서버/Edge: import { envServer } from '@env-registry/server'
 * - 클라이언트: import { envClient } from '@env-registry/client'
 * - 공통: import { envCommon } from '@env-registry/common'
 *
 * ⚠️ 주의: 이 index.ts에서는 서버 전용 코드를 export하지 않습니다.
 * 클라이언트에서 '@env-registry'를 import해도 서버 코드가 번들에 포함되지 않습니다.
 */

// 클라이언트용 (NEXT_PUBLIC_* 값만)
export { envClient } from './client';
export type { EnvClient } from './schema';

// 서버 전용 코드는 직접 경로로만 import하세요.
// import { envServer } from '@env-registry/server'
// import { envCommon } from '@env-registry/common'
