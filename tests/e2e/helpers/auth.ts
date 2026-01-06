/**
 * E2E 테스트 인증 헬퍼 함수
 */

import { Page } from '@playwright/test';

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * 로그인 헬퍼 함수
 */
export async function login(page: Page, credentials: LoginCredentials) {
  await page.goto('/login');

  // 이메일 입력
  await page.fill('input[type="email"]', credentials.email);

  // 비밀번호 입력
  await page.fill('input[type="password"]', credentials.password);

  // 로그인 버튼 클릭 (submit 버튼 사용)
  await page.click('button[type="submit"]');

  // 로그인 성공 대기 (테넌트 선택 또는 홈 페이지)
  await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });
}

/**
 * 로그아웃 헬퍼 함수
 */
export async function logout(page: Page) {
  // 사용자 메뉴 열기
  await page.click('[data-testid="user-menu"]');

  // 로그아웃 버튼 클릭
  await page.click('button:has-text("로그아웃")');

  // 로그인 페이지로 리다이렉션 대기
  await page.waitForURL('/login', { timeout: 10000 });
}

/**
 * 테넌트 선택 헬퍼 함수
 */
export async function selectTenant(page: Page, tenantName: string) {
  // 테넌트 선택 페이지로 이동
  await page.goto('/auth/tenant-selection');

  // 테넌트 카드 클릭
  await page.click(`[data-testid="tenant-card"]:has-text("${tenantName}")`);

  // 홈 페이지로 리다이렉션 대기
  await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
}

/**
 * 관리자로 로그인
 */
export async function loginAsAdmin(page: Page) {
  const credentials: LoginCredentials = {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'AdminPassword123!',
  };

  await login(page, credentials);
}

/**
 * 일반 사용자로 로그인
 */
export async function loginAsRegularUser(page: Page) {
  const credentials: LoginCredentials = {
    email: process.env.TEST_REGULAR_EMAIL || 'user@example.com',
    password: process.env.TEST_REGULAR_PASSWORD || 'UserPassword123!',
  };

  await login(page, credentials);
}

/**
 * 기본 테스트 사용자로 로그인
 */
export async function loginAsTestUser(page: Page) {
  const credentials: LoginCredentials = {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
  };

  await login(page, credentials);
}
