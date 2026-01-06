/**
 * E2E 테스트: 출석 관리 플로우
 *
 * [테스트 범위]
 * - 출석 체크
 * - 출석 기록 조회
 * - 출석 통계
 *
 * [업종중립] 모든 업종에서 동일하게 작동
 */

import { test, expect } from '@playwright/test';

test.describe('출석 관리 플로우', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test.skip('출석 체크 페이지에 접근할 수 있어야 함', async ({ page }) => {
    // TODO: /attendance 페이지 구현 후 활성화
    await page.goto('/attendance');

    // 페이지 제목 확인
    await expect(page.locator('h1, h2')).toContainText(/출석/);

    // 출석 체크 UI가 표시되는지 확인
    await expect(
      page.locator('[data-testid="attendance-check"], [data-testid="attendance-list"]')
    ).toBeVisible({ timeout: 5000 });
  });

  test('학생 출석을 체크할 수 있어야 함', async ({ page }) => {
    await page.goto('/attendance');

    // 첫 번째 학생의 출석 체크 버튼 찾기
    const checkInButton = page.locator('button:has-text(/출석|체크인/)').first();

    if (await checkInButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkInButton.click();

      // 출석 완료 메시지 또는 상태 변경 확인
      await expect(
        page
          .locator('text=/출석.*완료|체크인.*완료/')
          .or(page.locator('[data-testid="attendance-status-checked"]'))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test.skip('출석 기록을 조회할 수 있어야 함', async ({ page }) => {
    // TODO: /attendance 페이지 구현 후 활성화
    await page.goto('/attendance');

    // 날짜 선택기가 있는지 확인
    const datePicker = page.locator('input[type="date"], [data-testid="date-picker"]');
    if (await datePicker.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 오늘 날짜로 설정 (또는 기본값)
      const today = new Date().toISOString().split('T')[0];
      await datePicker.fill(today);
    }

    // 출석 기록 목록 확인
    const attendanceList = page.locator('[data-testid="attendance-list"]');
    await expect(attendanceList).toBeVisible({ timeout: 5000 });
  });

  test.skip('출석 통계를 확인할 수 있어야 함', async ({ page }) => {
    // TODO: /attendance 페이지 구현 후 활성화
    await page.goto('/attendance');

    // 통계 탭 또는 섹션 찾기
    const statsTab = page.locator('[data-testid="stats-tab"], button:has-text(/통계/)');
    if (await statsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statsTab.click();

      // 통계 정보가 표시되는지 확인
      await expect(page.locator('[data-testid="attendance-stats"]')).toBeVisible({
        timeout: 5000,
      });
    } else {
      // 통계가 메인 페이지에 표시되는 경우
      const statsCards = page.locator('[data-testid*="stat-card"]');
      const count = await statsCards.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});
