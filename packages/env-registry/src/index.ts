/**
 * 중앙 환경변수 관리 시스템
 * 
 * 사용법:
 * - 서버/Edge: import { envServer } from '@env-registry/core/server'
 * - 클라이언트: import { envClient } from '@env-registry/core/client'
 * - 공통: import { envCommon } from '@env-registry/core/common'
 */

// 서버 전용 (Service Role Key 등 비밀 값 포함)
export { envServer } from './server';
export type { EnvServer } from './schema';

// 클라이언트 전용 (NEXT_PUBLIC_* 값만)
export { envClient } from './client';
export type { EnvClient } from './schema';

// 서버/Edge 전용 공개 값
export { envCommon, getEnvCommon } from './common';
export type { EnvCommon } from './schema';

