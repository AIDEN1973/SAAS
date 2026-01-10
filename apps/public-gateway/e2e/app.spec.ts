import { test, expect } from '@playwright/test';

test.describe('Public Gateway App - 핵심 기능 E2E 테스트', () => {
  test.describe('앱 로드', () => {
    test('앱이 정상 로드되어야 함', async ({ page }) => {
      await page.goto('/');

      // 페이지 타이틀 확인
      await expect(page).toHaveTitle(/디어쌤.*게이트웨이|공개/);

      // React 앱 루트 요소 확인
      await expect(page.locator('#root')).toBeAttached();
    });

    test('HTML lang 속성이 한국어로 설정되어야 함', async ({ page }) => {
      await page.goto('/');

      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBe('ko');
    });
  });

  test.describe('공개 접근', () => {
    test('공개 게이트웨이는 인증 없이 접근 가능해야 함', async ({ page }) => {
      const response = await page.goto('/');

      // 200 OK 또는 리다이렉트 성공
      expect(response?.status()).toBeLessThan(400);
    });
  });

  test.describe('기본 접근성', () => {
    test('viewport meta 태그가 있어야 함', async ({ page }) => {
      await page.goto('/');

      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('width=device-width');
    });

    test('charset이 UTF-8로 설정되어야 함', async ({ page }) => {
      await page.goto('/');

      const charset = await page.locator('meta[charset]').getAttribute('charset');
      expect(charset?.toUpperCase()).toBe('UTF-8');
    });
  });
});
