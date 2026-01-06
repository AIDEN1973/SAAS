/**
 * E2E 테스트: 권한 기반 접근 제어 (RBAC)
 *
 * [테스트 범위]
 * - 관리자 권한 확인
 * - 일반 사용자 권한 확인
 * - 권한 없는 페이지 접근 차단
 *
 * [업종중립] 모든 업종에서 동일하게 작동
 */

import { test, expect } from '@playwright/test';

test.describe('권한 기반 접근 제어 (RBAC)', () => {
  test.skip('관리자는 모든 페이지에 접근할 수 있어야 함', async ({ page }) => {
    // TODO: /students, /classes, /teachers, /analytics 페이지 구현 후 활성화
    // 관리자로 로그인
    await page.goto('/login');
    await page.fill(
      'input[type="email"]',
      process.env.TEST_ADMIN_EMAIL || 'admin@example.com'
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_ADMIN_PASSWORD || 'AdminPassword123!'
    );
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });
    if (page.url().includes('tenant-selection')) {
      await page.locator('[data-testid="tenant-card"]').first().click();
      await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
    }

    // 주요 페이지들에 접근 가능한지 확인
    const pages = [
      { path: '/students', title: /학생|수강생/ },
      { path: '/classes', title: /수업|클래스/ },
      { path: '/teachers', title: /강사|교사/ },
      { path: '/billing', title: /청구|결제/ },
      { path: '/attendance', title: /출석/ },
      { path: '/analytics', title: /분석|통계/ },
    ];

    for (const { path, title } of pages) {
      await page.goto(path);

      // 403 Forbidden 또는 권한 오류가 발생하지 않아야 함
      await expect(page.locator('text=/권한.*없습니다|접근.*거부/')).not.toBeVisible({
        timeout: 2000,
      });

      // 페이지 제목이 표시되어야 함
      await expect(page.locator('h1, h2')).toContainText(title, { timeout: 5000 });
    }
  });

  test.skip('일반 사용자는 제한된 페이지만 접근할 수 있어야 함', async ({ page }) => {
    // TODO: /billing 페이지 구현 후 활성화
    // 일반 사용자로 로그인 (학부모 등)
    await page.goto('/login');
    await page.fill(
      'input[type="email"]',
      process.env.TEST_USER_EMAIL || 'user@example.com'
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_USER_PASSWORD || 'UserPassword123!'
    );
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });
    if (page.url().includes('tenant-selection')) {
      await page.locator('[data-testid="tenant-card"]').first().click();
      await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
    }

    // 접근 가능한 페이지
    const allowedPages = [{ path: '/billing', title: /청구|결제/ }];

    for (const { path, title } of allowedPages) {
      await page.goto(path);

      // 페이지에 접근할 수 있어야 함
      await expect(page.locator('h1, h2')).toContainText(title, { timeout: 5000 });
    }
  });

  test.skip('권한 없는 페이지 접근 시 리다이렉션되어야 함', async ({ page }) => {
    // TODO: /analytics, /settings 페이지 구현 후 활성화
    // 일반 사용자로 로그인
    await page.goto('/login');
    await page.fill(
      'input[type="email"]',
      process.env.TEST_USER_EMAIL || 'user@example.com'
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_USER_PASSWORD || 'UserPassword123!'
    );
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });
    if (page.url().includes('tenant-selection')) {
      await page.locator('[data-testid="tenant-card"]').first().click();
      await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
    }

    // 권한 없는 페이지에 접근 시도
    const restrictedPages = [
      '/analytics', // 분석 페이지 (관리자 전용)
      '/settings', // 설정 페이지 (관리자 전용)
    ];

    for (const path of restrictedPages) {
      await page.goto(path);

      // 권한 오류 메시지 또는 홈으로 리다이렉션 확인
      const hasError = await page
        .locator('text=/권한.*없습니다|접근.*거부|403/')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      const isRedirected = page.url().includes('/home') || page.url().includes('/login');

      expect(hasError || isRedirected).toBe(true);
    }
  });

  test.skip('로그아웃 후 보호된 페이지 접근 시 로그인 페이지로 리다이렉션되어야 함', async ({
    page,
  }) => {
    // TODO: 로그아웃 기능 (user-menu-button) 구현 후 활성화
    // 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });
    if (page.url().includes('tenant-selection')) {
      await page.locator('[data-testid="tenant-card"]').first().click();
      await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
    }

    // 로그아웃
    await page.click('[data-testid="user-menu-button"]');
    await page.click('button:has-text("로그아웃")');
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // 보호된 페이지 접근 시도
    await page.goto('/students');

    // 로그인 페이지로 리다이렉션되어야 함
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test.skip('다른 테넌트의 데이터에 접근할 수 없어야 함', async ({ page }) => {
    // TODO: /students 페이지 구현 후 활성화
    // 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });
    if (page.url().includes('tenant-selection')) {
      await page.locator('[data-testid="tenant-card"]').first().click();
      await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
    }

    // 다른 테넌트의 리소스 ID로 직접 접근 시도
    const otherTenantResourceUrl = '/students/other-tenant-student-id-12345';
    await page.goto(otherTenantResourceUrl);

    // 404 Not Found 또는 권한 오류가 발생해야 함
    const hasError = await page
      .locator('text=/찾을 수 없습니다|권한.*없습니다|404|403/')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasError).toBe(true);
  });
});
