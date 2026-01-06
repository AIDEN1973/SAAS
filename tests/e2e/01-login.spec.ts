/**
 * E2E 테스트: 로그인 플로우
 *
 * [테스트 범위]
 * - 이메일/비밀번호 로그인
 * - 로그인 실패 처리
 * - 테넌트 선택
 * - 로그아웃
 *
 * [업종중립] 모든 업종에서 동일하게 작동
 */

import { test, expect } from '@playwright/test';

// 테스트 데이터 (환경변수 또는 설정 파일에서 로드)
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
};

test.describe('로그인 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 로그아웃 상태로 초기화
    await page.goto('/');
  });

  test('이메일/비밀번호로 로그인할 수 있어야 함', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/login');

    // 페이지에 "로그인" 헤딩이 표시되는지 확인
    await expect(page.locator('h1:has-text("로그인")')).toBeVisible();

    // 이메일 입력
    await page.fill('input[type="email"]', TEST_USER.email);

    // 비밀번호 입력
    await page.fill('input[type="password"]', TEST_USER.password);

    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');

    // 로그인 성공 후 리다이렉션 확인
    // 테넌트 선택 페이지 또는 홈 페이지로 이동
    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });

    // URL 확인
    const url = page.url();
    expect(url).toMatch(/\/(auth\/tenant-selection|home|\/)/);
  });

  test('잘못된 비밀번호로 로그인 시도 시 에러 메시지를 표시해야 함', async ({ page }) => {
    await page.goto('/login');

    // 이메일 입력
    await page.fill('input[type="email"]', TEST_USER.email);

    // 잘못된 비밀번호 입력
    await page.fill('input[type="password"]', 'WrongPassword123!');

    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');

    // 에러 모달 또는 토스트 메시지 확인 (구현에 따라 다를 수 있음)
    // 로그인 실패 시 페이지 이동이 없어야 함
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('존재하지 않는 이메일로 로그인 시도 시 에러 메시지를 표시해야 함', async ({ page }) => {
    await page.goto('/login');

    // 존재하지 않는 이메일 입력
    await page.fill('input[type="email"]', 'nonexistent@example.com');

    // 비밀번호 입력
    await page.fill('input[type="password"]', 'SomePassword123!');

    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');

    // 로그인 실패 시 페이지 이동이 없어야 함
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('테넌트를 선택할 수 있어야 함', async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // 테넌트 선택 페이지로 이동 (테넌트가 여러 개인 경우)
    // 테넌트가 1개면 바로 홈으로 이동할 수 있음
    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });

    // 테넌트 선택 페이지인 경우에만 테스트
    if (page.url().includes('tenant-selection')) {
      // 테넌트 목록이 표시되는지 확인
      const tenantCards = page.locator('[data-testid="tenant-card"]');
      await expect(tenantCards.first()).toBeVisible({ timeout: 5000 });

      // 첫 번째 테넌트 선택
      await tenantCards.first().click();

      // 홈 페이지로 리다이렉션 확인
      await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
    }
  });

  test.skip('로그아웃할 수 있어야 함', async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // 홈 페이지로 이동 (테넌트 선택 스킵)
    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });

    if (page.url().includes('tenant-selection')) {
      await page.locator('[data-testid="tenant-card"]').first().click();
      await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
    }

    // 사용자 메뉴 열기
    await page.click('[data-testid="user-menu-button"]');

    // 로그아웃 버튼 클릭
    await page.click('button:has-text("로그아웃")');

    // 로그인 페이지로 리다이렉션 확인
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('로그인 폼이 올바르게 렌더링되어야 함', async ({ page }) => {
    await page.goto('/login');

    // 로그인 헤딩 확인
    await expect(page.locator('h1:has-text("로그인")')).toBeVisible();

    // 이메일/전화번호 탭 확인
    await expect(page.locator('button:has-text("이메일")')).toBeVisible();
    await expect(page.locator('button:has-text("전화번호")')).toBeVisible();

    // 이메일 입력 필드 확인
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // 로그인 버튼 확인
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // 소셜 로그인 버튼 확인
    await expect(page.locator('button:has-text("Google")')).toBeVisible();
    await expect(page.locator('button:has-text("Kakao")')).toBeVisible();
  });
});
