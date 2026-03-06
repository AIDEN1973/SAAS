/**
 * Vitest 테스트 설정 파일
 *
 * 전역 테스트 설정 및 모킹 설정
 */

import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// env-registry/server 전역 모킹: NODE_ENV=test에서 환경변수 검증 우회
// (env-registry는 development|staging|production만 허용하므로 테스트 시 모킹 필수)
vi.mock('@env-registry/server', () => ({
  envServer: {
    NODE_ENV: 'development',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SERVICE_ROLE_KEY: 'test-service-role-key',
    PLATFORM_AI_ENABLED: true,
  },
  getPlatformAIEnabled: () => true,
}));

// 전역 모킹 설정
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

