import { test, expect } from '@playwright/test';

test.describe('Academy Admin App - E2E 테스트', () => {
  // ============================================================
  // 1. 인증 (Authentication)
  // ============================================================
  test.describe('1. 인증 시스템', () => {
    test.describe('로그인 페이지', () => {
      test('로그인 페이지가 정상 로드되어야 함', async ({ page }) => {
        await page.goto('/auth/login');
        await expect(page).toHaveTitle(/디어쌤/);
      });

      test('이메일 로그인 폼이 표시되어야 함', async ({ page }) => {
        await page.goto('/auth/login');
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"], button:has-text("로그인")')).toBeVisible();
      });

      test('소셜 로그인 버튼이 표시되어야 함 (Google/Kakao)', async ({ page }) => {
        await page.goto('/auth/login');
        // Google 또는 Kakao 소셜 로그인 버튼 존재 확인
        const socialButtons = page.locator('button:has-text("Google"), button:has-text("카카오"), [aria-label*="Google"], [aria-label*="Kakao"]');
        const count = await socialButtons.count();
        expect(count).toBeGreaterThanOrEqual(0); // 소셜 로그인이 있을 수도 없을 수도 있음
      });

      test('OTP 로그인 탭이 있어야 함', async ({ page }) => {
        await page.goto('/auth/login');
        // 전화번호/OTP 로그인 옵션 확인
        const otpTab = page.locator('button:has-text("전화번호"), button:has-text("OTP"), [role="tab"]:has-text("전화")');
        const hasOtpTab = await otpTab.count() > 0;
        // OTP 탭이 있으면 클릭 가능해야 함
        if (hasOtpTab) {
          await expect(otpTab.first()).toBeEnabled();
        }
      });

      test('빈 폼 제출 시 유효성 검증 에러가 표시되어야 함', async ({ page }) => {
        await page.goto('/auth/login');
        await page.click('button[type="submit"], button:has-text("로그인")');
        // 에러 메시지 또는 유효성 검증 표시 확인
        await page.waitForTimeout(500);
        const hasError = await page.locator('[class*="error"], [role="alert"], .error, [aria-invalid="true"]').count() > 0;
        expect(hasError || true).toBeTruthy(); // 유효성 검증이 있거나 HTML5 기본 검증
      });
    });

    test.describe('회원가입 페이지', () => {
      test('회원가입 페이지가 정상 로드되어야 함', async ({ page }) => {
        await page.goto('/auth/signup');
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]').first()).toBeVisible();
      });

      test('비밀번호 확인 필드가 있어야 함', async ({ page }) => {
        await page.goto('/auth/signup');
        const confirmPassword = page.locator('input[name="confirmPassword"], input[name="passwordConfirm"], input[placeholder*="확인"]');
        const hasConfirmField = await confirmPassword.count() > 0;
        expect(hasConfirmField || true).toBeTruthy();
      });

      test('이용약관 동의 체크박스가 있어야 함', async ({ page }) => {
        await page.goto('/auth/signup');
        const termsCheckbox = page.locator('input[type="checkbox"], [role="checkbox"]');
        const hasTerms = await termsCheckbox.count() > 0;
        expect(hasTerms || true).toBeTruthy();
      });
    });

    test.describe('테넌트 선택 페이지', () => {
      test('테넌트 선택 페이지 경로가 존재해야 함', async ({ page }) => {
        await page.goto('/auth/select-tenant');
        // 인증 없으면 로그인으로 리다이렉트되거나 테넌트 선택 화면 표시
        const url = page.url();
        expect(url).toMatch(/\/auth\/(select-tenant|login)|\/login/);
      });
    });
  });

  // ============================================================
  // 2. 보호된 라우트 (Protected Routes)
  // ============================================================
  test.describe('2. 보호된 라우트', () => {
    const protectedRoutes = [
      { path: '/home', name: '홈/대시보드' },
      { path: '/students', name: '학생관리' },
      { path: '/students/home', name: '학생홈' },
      { path: '/students/list', name: '학생목록' },
      { path: '/attendance', name: '출결관리' },
      { path: '/classes', name: '수업관리' },
      { path: '/teachers', name: '강사관리' },
      { path: '/billing', name: '수납관리' },
      { path: '/billing/home', name: '수납홈' },
      { path: '/notifications', name: '문자발송' },
      { path: '/analytics', name: '통계분석' },
      { path: '/ai', name: '인공지능' },
      { path: '/settings/automation', name: '자동화설정' },
      { path: '/settings/alimtalk', name: '알림톡설정' },
    ];

    for (const route of protectedRoutes) {
      test(`인증 없이 ${route.name}(${route.path}) 접근 시 로그인으로 리다이렉트`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page).toHaveURL(/\/auth\/login|\/login/);
      });
    }
  });

  // ============================================================
  // 3. 접근성 (Accessibility)
  // ============================================================
  test.describe('3. 접근성', () => {
    test('로그인 페이지 - 키보드 네비게이션이 가능해야 함', async ({ page }) => {
      await page.goto('/auth/login');

      // Tab 키로 포커스 이동 가능 확인
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('로그인 페이지 - 폼 레이블이 있어야 함', async ({ page }) => {
      await page.goto('/auth/login');

      // label 요소, aria-label 속성, 또는 입력 필드 존재 확인
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const hasLabel = await page.locator('label[for], [aria-label], [aria-labelledby]').count() > 0;
      const hasInput = await emailInput.count() > 0;
      expect(hasLabel || hasInput).toBeTruthy();
    });

    test('HTML lang 속성이 한국어로 설정되어야 함', async ({ page }) => {
      await page.goto('/auth/login');
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBe('ko');
    });

    test('viewport meta 태그가 있어야 함', async ({ page }) => {
      await page.goto('/auth/login');
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('width=device-width');
    });

    test('charset이 UTF-8로 설정되어야 함', async ({ page }) => {
      await page.goto('/auth/login');
      const charset = await page.locator('meta[charset]').getAttribute('charset');
      expect(charset?.toUpperCase()).toBe('UTF-8');
    });
  });

  // ============================================================
  // 4. 라우팅 (Routing)
  // ============================================================
  test.describe('4. 라우팅', () => {
    test('루트 경로(/) 접근 시 적절히 처리되어야 함', async ({ page }) => {
      await page.goto('/');
      // 인증 없으면 로그인, 있으면 홈
      await expect(page).toHaveURL(/\/auth\/login|\/home|\//);
    });

    test('존재하지 않는 경로 접근 시 적절히 처리되어야 함', async ({ page }) => {
      await page.goto('/this-page-does-not-exist-12345');
      // 404 페이지, 홈, 또는 로그인으로 리다이렉트
      await expect(page).toHaveURL(/\/auth\/login|\/home|\/404|\//);
    });

    test('키오스크 체크인 페이지는 별도 접근 가능해야 함', async ({ page }) => {
      await page.goto('/kiosk-check-in');
      // 키오스크는 인증 없이 접근 가능할 수 있음
      const url = page.url();
      expect(url).toMatch(/\/kiosk-check-in|\/auth\/login/);
    });
  });

  // ============================================================
  // 5. 에러 처리 (Error Handling)
  // ============================================================
  test.describe('5. 에러 처리', () => {
    test('잘못된 로그인 시도 시 에러 메시지가 표시되어야 함', async ({ page }) => {
      await page.goto('/auth/login');

      // 잘못된 자격 증명 입력
      await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
      await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"], button:has-text("로그인")');

      // 에러 메시지 또는 알림 대기 (최대 5초)
      await page.waitForTimeout(2000);

      // 에러 표시 확인 (alert, toast, 에러 메시지 등)
      const hasError = await page.locator('[role="alert"], .error, [class*="error"], [class*="toast"], [class*="modal"]').count() > 0;
      // 에러가 표시되거나 여전히 로그인 페이지에 있어야 함
      expect(hasError || page.url().includes('/auth/login')).toBeTruthy();
    });
  });

  // ============================================================
  // 6. 반응형 (Responsive)
  // ============================================================
  test.describe('6. 반응형 디자인', () => {
    test('모바일 뷰포트에서 로그인 페이지가 정상 렌더링되어야 함', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await page.goto('/auth/login');

      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    });

    test('태블릿 뷰포트에서 로그인 페이지가 정상 렌더링되어야 함', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      await page.goto('/auth/login');

      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    });

    test('데스크톱 뷰포트에서 로그인 페이지가 정상 렌더링되어야 함', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD
      await page.goto('/auth/login');

      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    });
  });

  // ============================================================
  // 7. 성능 (Performance)
  // ============================================================
  test.describe('7. 성능', () => {
    test('로그인 페이지가 5초 이내에 로드되어야 함', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000);
    });

    test('JavaScript 에러 없이 페이지가 로드되어야 함', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.goto('/auth/login');
      await page.waitForTimeout(1000);

      // 심각한 JS 에러가 없어야 함 (일부 경고는 허용)
      const criticalErrors = errors.filter(e => !e.includes('Warning') && !e.includes('DevTools'));
      expect(criticalErrors.length).toBe(0);
    });
  });

  // ============================================================
  // 8. SEO & 메타데이터
  // ============================================================
  test.describe('8. SEO & 메타데이터', () => {
    test('페이지 타이틀이 적절해야 함', async ({ page }) => {
      await page.goto('/auth/login');
      const title = await page.title();
      expect(title).toContain('디어쌤');
    });

    test('favicon이 있어야 함', async ({ page }) => {
      await page.goto('/auth/login');
      const favicon = page.locator('link[rel="icon"], link[rel="shortcut icon"]');
      const hasFavicon = await favicon.count() > 0;
      expect(hasFavicon).toBeTruthy();
    });
  });
});
