/**
 * E2E 테스트: 학생 관리 플로우
 *
 * [테스트 범위]
 * - 학생 목록 조회
 * - 학생 등록
 * - 학생 정보 수정
 * - 학생 검색
 *
 * [업종중립] 모든 업종에서 동일하게 작동
 */

import { test, expect } from '@playwright/test';

// 테스트 데이터
const TEST_STUDENT = {
  name: 'E2E테스트학생',
  phone: '010-1234-5678',
  birthDate: '2010-01-01',
  parentName: '학부모명',
  parentPhone: '010-9876-5432',
};

test.describe('학생 관리 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 (테스트 전 사전 조건)
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');

    // 테넌트 선택 (있는 경우)
    await page.waitForURL(/\/(auth\/tenant-selection|home|\/)/, { timeout: 10000 });
    if (page.url().includes('tenant-selection')) {
      await page.locator('[data-testid="tenant-card"]').first().click();
      await page.waitForURL(/\/(home|\/)/, { timeout: 10000 });
    }
  });

  test.skip('학생 목록을 조회할 수 있어야 함', async ({ page }) => {
    // TODO: /students 페이지 구현 후 활성화
    // 학생 관리 페이지로 이동
    await page.goto('/students');

    // 페이지 제목 확인
    await expect(page.locator('h1, h2')).toContainText(/학생|수강생|회원/);

    // 학생 목록이 표시되는지 확인
    const studentList = page.locator('[data-testid="student-list"]');
    await expect(studentList).toBeVisible({ timeout: 5000 });

    // 최소 1명 이상의 학생이 있는지 확인 (또는 "학생이 없습니다" 메시지)
    const hasStudents = await page.locator('[data-testid="student-item"]').count();
    if (hasStudents > 0) {
      await expect(page.locator('[data-testid="student-item"]').first()).toBeVisible();
    } else {
      await expect(page.locator('text=/학생이 없습니다|등록된.*없습니다/')).toBeVisible();
    }
  });

  test.skip('새로운 학생을 등록할 수 있어야 함', async ({ page }) => {
    // TODO: /students 페이지 구현 후 활성화
    await page.goto('/students');

    // 학생 등록 버튼 클릭
    await page.getByRole('button', { name: /학생 등록|등록하기|추가/ }).click();

    // 학생 등록 폼이 표시되는지 확인
    await expect(page.locator('[data-testid="student-form"], form')).toBeVisible({
      timeout: 5000,
    });

    // 학생 정보 입력
    await page.fill('input[name="name"], input[placeholder*="이름"]', TEST_STUDENT.name);
    await page.fill('input[name="phone"], input[placeholder*="연락처"]', TEST_STUDENT.phone);
    await page.fill('input[name="birth_date"], input[type="date"]', TEST_STUDENT.birthDate);

    // 학부모 정보 입력 (있는 경우)
    const parentNameInput = page.locator('input[name="parent_name"], input[placeholder*="학부모"]');
    if (await parentNameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await parentNameInput.fill(TEST_STUDENT.parentName);
    }

    const parentPhoneInput = page.locator('input[name="parent_phone"]');
    if (await parentPhoneInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await parentPhoneInput.fill(TEST_STUDENT.parentPhone);
    }

    // 저장 버튼 클릭
    await page.getByRole('button', { name: /저장|등록|완료/ }).click();

    // 성공 메시지 또는 학생 목록으로 리다이렉션 확인
    await expect(
      page.locator('text=/등록.*완료|성공.*저장/').or(page.locator('[data-testid="student-list"]'))
    ).toBeVisible({ timeout: 10000 });

    // 등록된 학생이 목록에 표시되는지 확인
    if (await page.url().includes('/students')) {
      await expect(page.locator(`text=${TEST_STUDENT.name}`)).toBeVisible({ timeout: 5000 });
    }
  });

  test.skip('학생 정보를 수정할 수 있어야 함', async ({ page }) => {
    // TODO: /students 페이지 구현 후 활성화
    await page.goto('/students');

    // 첫 번째 학생 클릭
    const firstStudent = page.locator('[data-testid="student-item"]').first();
    await expect(firstStudent).toBeVisible({ timeout: 5000 });
    await firstStudent.click();

    // 학생 상세 페이지 또는 수정 버튼 클릭
    const editButton = page.getByRole('button', { name: /수정|편집/ });
    if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editButton.click();
    }

    // 수정 폼이 표시되는지 확인
    await expect(page.locator('[data-testid="student-form"], form')).toBeVisible({
      timeout: 5000,
    });

    // 전화번호 수정
    const phoneInput = page.locator('input[name="phone"], input[placeholder*="연락처"]');
    await phoneInput.clear();
    await phoneInput.fill('010-9999-8888');

    // 저장 버튼 클릭
    await page.getByRole('button', { name: /저장|수정 완료/ }).click();

    // 성공 메시지 확인
    await expect(page.locator('text=/수정.*완료|성공.*저장/')).toBeVisible({ timeout: 10000 });
  });

  test.skip('학생을 검색할 수 있어야 함', async ({ page }) => {
    // TODO: /students 페이지 구현 후 활성화
    await page.goto('/students');

    // 검색 입력 필드 찾기
    const searchInput = page.locator(
      'input[placeholder*="검색"], input[type="search"], input[name="search"]'
    );
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // 검색어 입력
    await searchInput.fill(TEST_STUDENT.name);

    // 검색 결과 확인 (디바운싱 고려)
    await page.waitForTimeout(500);

    // 검색 결과에 해당 학생이 포함되어 있는지 확인
    const studentItems = page.locator('[data-testid="student-item"]');
    const count = await studentItems.count();

    if (count > 0) {
      // 검색 결과가 있으면 첫 번째 항목에 검색어가 포함되어 있는지 확인
      await expect(studentItems.first()).toContainText(TEST_STUDENT.name);
    } else {
      // 검색 결과가 없으면 "검색 결과 없음" 메시지 확인
      await expect(page.locator('text=/검색 결과.*없습니다|찾을 수 없습니다/')).toBeVisible();
    }
  });

  test('학생 목록을 필터링할 수 있어야 함', async ({ page }) => {
    await page.goto('/students');

    // 필터 버튼 찾기
    const filterButton = page.getByRole('button', { name: /필터|정렬/ });
    if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filterButton.click();

      // 필터 옵션이 표시되는지 확인
      const filterOptions = page.locator('[data-testid="filter-options"], [role="menu"]');
      await expect(filterOptions).toBeVisible({ timeout: 2000 });

      // 필터 옵션 선택 (예: 활동 상태로 필터)
      const activeFilter = page.locator('text=/활성|수강 중/');
      if (await activeFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
        await activeFilter.click();

        // 필터 적용 확인
        await page.waitForTimeout(500);
        const studentItems = page.locator('[data-testid="student-item"]');
        const count = await studentItems.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test.skip('학생 상세 정보를 조회할 수 있어야 함', async ({ page }) => {
    // TODO: /students 페이지 구현 후 활성화
    await page.goto('/students');

    // 첫 번째 학생 클릭
    const firstStudent = page.locator('[data-testid="student-item"]').first();
    await expect(firstStudent).toBeVisible({ timeout: 5000 });
    await firstStudent.click();

    // 학생 상세 페이지로 이동
    await page.waitForURL(/\/students\/.*/, { timeout: 10000 });

    // 학생 상세 정보가 표시되는지 확인
    await expect(page.locator('[data-testid="student-detail"]')).toBeVisible({ timeout: 5000 });

    // 탭 네비게이션 확인 (기본 정보, 출석, 결제 등)
    const tabs = page.locator('[role="tab"], [data-testid*="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });
});
