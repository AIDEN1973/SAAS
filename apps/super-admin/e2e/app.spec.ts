import { test, expect } from '@playwright/test';

test.describe('Super Admin App - 핵심 기능 E2E 테스트', () => {
  test.describe('앱 로드', () => {
    test('앱이 정상 로드되어야 함', async ({ page }) => {
      await page.goto('/');

      // 페이지 타이틀 확인
      await expect(page).toHaveTitle(/디어쌤.*본사|본사.*관리/);

      // React 앱 루트 요소 확인
      await expect(page.locator('#root')).toBeAttached();
    });

    test('HTML lang 속성이 한국어로 설정되어야 함', async ({ page }) => {
      await page.goto('/');

      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBe('ko');
    });
  });

  test.describe('인증 및 보호된 라우트', () => {
    test('인증 없이 접근 시 로그인 페이지로 리다이렉트되어야 함', async ({ page }) => {
      await page.goto('/');

      // AuthGuard가 로그인 페이지로 리다이렉트할 때까지 대기
      await page.waitForURL(/\/auth\/login/, { timeout: 10000 });

      // 로그인 페이지 확인
      expect(page.url()).toContain('/auth/login');
    });
  });

  test.describe('기본 접근성', () => {
    test('viewport meta 태그가 있어야 함', async ({ page }) => {
      await page.goto('/');

      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('width=device-width');
    });
  });
});
