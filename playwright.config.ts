/**
 * Playwright E2E 테스트 설정
 *
 * [SSOT] 중앙 설정 관리
 * [업종중립] 모든 업종에서 동일하게 작동
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// 테스트 환경 변수 로드
dotenv.config({ path: '.env.test' });

/**
 * 환경 변수에서 Base URL 가져오기
 * 로컬: http://localhost:3000
 * 스테이징: https://staging.example.com
 * 프로덕션: https://app.example.com
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',

  /* 병렬 실행 설정 */
  fullyParallel: true,

  /* CI 환경에서만 빌드 실패 시 재시도 */
  forbidOnly: !!process.env.CI,

  /* CI에서는 재시도, 로컬에서는 재시도 안 함 */
  retries: process.env.CI ? 2 : 0,

  /* 병렬 워커 수 */
  workers: process.env.CI ? 1 : undefined,

  /* 리포터 설정 */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  /* 공통 설정 */
  use: {
    /* Base URL */
    baseURL,

    /* 스크린샷 및 비디오 수집 */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    /* 타임아웃 */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  /* 테스트 프로젝트 설정 (브라우저별) */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* 모바일 테스트 (선택적) */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* 로컬 개발 서버 설정 */
  webServer: {
    command: 'npm run dev:admin',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
