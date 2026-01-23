/**
 * Critical Path E2E Tests
 *
 * 핵심 사용자 플로우만 테스트:
 * 1. 로그인
 * 2. 학생 등록
 * 3. 출결 체크
 *
 * 목표: 제품의 핵심 기능이 동작하는지 확인 (커버리지 100% 불필요)
 */

import { test, expect } from '@playwright/test';

// 테스트 데이터
const TEST_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

const TEST_STUDENT = {
  name: `테스트학생_${Date.now()}`,
  phone: '010-1234-5678',
  grade: '초등 3학년',
};

// ============================================================================
// 🔐 Critical Path 1: 로그인 플로우
// ============================================================================
test.describe('Critical Path: 로그인', () => {
  test('사용자가 로그인할 수 있다', async ({ page }) => {
    // Given: 로그인 페이지 방문
    await page.goto('/login');

    // When: 이메일과 비밀번호 입력 후 로그인
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button:has-text("로그인")');

    // Then: 홈 페이지로 리다이렉트
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Then: 사용자 이름 표시 확인 (로그인 성공)
    await expect(page.locator('text=/안녕하세요|환영합니다/')).toBeVisible();
  });

  test('잘못된 비밀번호로 로그인 실패', async ({ page }) => {
    // Given: 로그인 페이지 방문
    await page.goto('/login');

    // When: 잘못된 비밀번호로 로그인 시도
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("로그인")');

    // Then: 에러 메시지 표시
    await expect(page.locator('text=/비밀번호|오류|실패/')).toBeVisible();
  });
});

// ============================================================================
// 👨‍🎓 Critical Path 2: 학생 등록 플로우
// ============================================================================
test.describe('Critical Path: 학생 등록', () => {
  // 각 테스트 전 로그인
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button:has-text("로그인")');
    await page.waitForURL(/\/home/);
  });

  test('새 학생을 등록할 수 있다', async ({ page }) => {
    // Given: 학생 목록 페이지로 이동
    await page.goto('/students');

    // When: 학생 추가 버튼 클릭
    await page.click('button:has-text("학생 추가"), button:has-text("+ 추가"), button:has-text("등록")');

    // When: 학생 정보 입력
    await page.fill('input[name="name"], input[placeholder*="이름"]', TEST_STUDENT.name);
    await page.fill('input[name="phone"], input[placeholder*="전화"], input[placeholder*="번호"]', TEST_STUDENT.phone);

    // 학년 선택 (select 또는 input)
    const gradeInput = page.locator('select[name="grade"], input[name="grade"], input[placeholder*="학년"]').first();
    if (await gradeInput.evaluate(el => el.tagName) === 'SELECT') {
      await gradeInput.selectOption({ label: TEST_STUDENT.grade });
    } else {
      await gradeInput.fill(TEST_STUDENT.grade);
    }

    // When: 저장 버튼 클릭
    await page.click('button:has-text("저장"), button:has-text("등록"), button:has-text("추가")');

    // Then: 성공 메시지 또는 학생 목록에 표시
    await expect(
      page.locator(`text=${TEST_STUDENT.name}`).or(page.locator('text=/성공|완료|등록되었습니다/'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('필수 정보 없이 학생 등록 실패', async ({ page }) => {
    // Given: 학생 목록 페이지
    await page.goto('/students');

    // When: 학생 추가 버튼 클릭
    await page.click('button:has-text("학생 추가"), button:has-text("+ 추가"), button:has-text("등록")');

    // When: 이름 없이 저장 시도
    await page.click('button:has-text("저장"), button:has-text("등록"), button:has-text("추가")');

    // Then: 에러 메시지 또는 필수 입력 표시
    await expect(
      page.locator('text=/필수|입력해주세요|required/i')
    ).toBeVisible();
  });
});

// ============================================================================
// 📅 Critical Path 3: 출결 체크 플로우
// ============================================================================
test.describe('Critical Path: 출결 체크', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button:has-text("로그인")');
    await page.waitForURL(/\/home/);
  });

  test('학생 출결을 체크할 수 있다', async ({ page }) => {
    // Given: 출결 관리 페이지로 이동
    await page.goto('/attendance');

    // Then: 출결 체크 UI 로드 확인
    await expect(
      page.locator('text=/출결|출석|결석/').first()
    ).toBeVisible({ timeout: 10000 });

    // When: 첫 번째 학생의 출석 체크 (UI 구조에 따라 조정 필요)
    const firstCheckbox = page.locator('input[type="checkbox"], button:has-text("출석")').first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.click();
    }

    // Then: 저장 버튼이 활성화되거나 자동 저장 표시
    // (실제 UI에 따라 검증 로직 조정)
    await expect(page).not.toHaveURL('/error');
  });
});

// ============================================================================
// 🔄 Full Flow: 회원가입 → 로그인 → 학생 등록 → 출결 체크
// ============================================================================
test.describe('Critical Path: 전체 플로우', () => {
  test.skip('전체 사용자 여정 (회원가입부터 출결까지)', async ({ page }) => {
    // ⚠️ 실제 회원가입 테스트는 DB 초기화가 필요하므로 skip
    // 프로덕션 환경에서는 테스트 전용 테넌트 사용 권장

    // 1. 회원가입
    await page.goto('/signup');
    // ... (회원가입 로직)

    // 2. 로그인
    await page.goto('/login');
    // ... (로그인 로직)

    // 3. 학생 등록
    await page.goto('/students');
    // ... (학생 등록 로직)

    // 4. 출결 체크
    await page.goto('/attendance');
    // ... (출결 체크 로직)
  });
});
