#!/usr/bin/env tsx
/**
 * 매뉴얼 스크린샷 자동 캡처 스크립트
 *
 * Playwright를 사용하여 각 페이지의 스크린샷을 자동으로 캡처합니다.
 * 캡처된 이미지는 매뉴얼에서 참조할 수 있습니다.
 *
 * 사전 요구사항:
 *   - 로컬 서버 실행: npm run dev:admin
 *   - Playwright 설치: npx playwright install chromium
 *
 * 사용법:
 *   npm run capture:manual-screenshots
 *   npm run capture:manual-screenshots -- --page=students
 *   npm run capture:manual-screenshots -- --viewport=mobile
 */

import { chromium, Browser, Page } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();
const outputDir = join(rootDir, 'apps/academy-admin/public/manual-screenshots');

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// 캡처할 페이지 설정
interface PageConfig {
  id: string;
  name: string;
  path: string;
  tabs?: string[];
  waitFor?: string; // 대기할 셀렉터
  actions?: PageAction[];
}

interface PageAction {
  type: 'click' | 'wait' | 'scroll';
  selector?: string;
  duration?: number;
  screenshotName?: string;
}

// 뷰포트 설정
const viewports = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 390, height: 844 },
};

// 캡처 대상 페이지 정의
const pageConfigs: PageConfig[] = [
  {
    id: 'dashboard',
    name: '대시보드',
    path: '/home',
    waitFor: '[data-testid="dashboard"]',
  },
  {
    id: 'students',
    name: '학생관리',
    path: '/students/list',
    tabs: ['list', 'tags', 'statistics', 'consultations'],
    waitFor: '[data-testid="students-page"]',
  },
  {
    id: 'attendance',
    name: '출결관리',
    path: '/attendance',
    tabs: ['today', 'history', 'statistics'],
    waitFor: '[data-testid="attendance-page"]',
  },
  {
    id: 'notifications',
    name: '문자발송',
    path: '/notifications',
    tabs: ['history', 'send', 'templates'],
    waitFor: '[data-testid="notifications-page"]',
  },
  {
    id: 'analytics',
    name: '통계분석',
    path: '/analytics',
    waitFor: '[data-testid="analytics-page"]',
  },
  {
    id: 'ai',
    name: '인공지능',
    path: '/ai',
    tabs: ['insights', 'briefing'],
    waitFor: '[data-testid="ai-page"]',
  },
  {
    id: 'classes',
    name: '수업관리',
    path: '/classes',
    tabs: ['list', 'calendar', 'statistics'],
    waitFor: '[data-testid="classes-page"]',
  },
  {
    id: 'teachers',
    name: '강사관리',
    path: '/teachers',
    tabs: ['list', 'statistics'],
    waitFor: '[data-testid="teachers-page"]',
  },
  {
    id: 'billing',
    name: '수납관리',
    path: '/billing/home',
    waitFor: '[data-testid="billing-page"]',
  },
  {
    id: 'settings',
    name: '설정',
    path: '/settings',
    tabs: ['store', 'automation', 'permissions'],
    waitFor: '[data-testid="settings-page"]',
  },
  {
    id: 'agent',
    name: '에이전트',
    path: '/agent',
    waitFor: '[data-testid="agent-page"]',
  },
];

/**
 * 로그인 수행 (테스트 계정 사용)
 */
async function performLogin(page: Page, baseUrl: string): Promise<boolean> {
  try {
    log('  로그인 시도...', colors.gray);

    await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });

    // 테스트 계정 정보 (환경변수 또는 기본값)
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'testpassword';

    // 이메일/비밀번호 입력
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);

      // 로그인 버튼 클릭
      const loginButton = page.locator('button[type="submit"], button:has-text("로그인")');
      await loginButton.click();

      // 로그인 후 리다이렉트 대기
      await page.waitForURL(/\/(home|students|dashboard)/, { timeout: 10000 });
      log('  ✓ 로그인 성공', colors.green);
      return true;
    }

    return false;
  } catch (error) {
    log(`  ⚠ 로그인 실패: ${(error as Error).message}`, colors.yellow);
    return false;
  }
}

/**
 * 단일 페이지 스크린샷 캡처
 */
async function capturePageScreenshot(
  page: Page,
  baseUrl: string,
  config: PageConfig,
  viewport: keyof typeof viewports,
  outputPath: string
): Promise<string[]> {
  const capturedFiles: string[] = [];
  const viewportSize = viewports[viewport];

  await page.setViewportSize(viewportSize);

  try {
    // 페이지 이동
    const url = `${baseUrl}${config.path}`;
    log(`  ${config.name} (${config.path})...`, colors.gray);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // 페이지 로딩 대기
    if (config.waitFor) {
      try {
        await page.waitForSelector(config.waitFor, { timeout: 5000 });
      } catch {
        // waitFor 셀렉터가 없어도 계속 진행
      }
    }

    // 추가 로딩 대기
    await page.waitForTimeout(1000);

    // 메인 스크린샷
    const mainFileName = `${config.id}-${viewport}.png`;
    const mainFilePath = join(outputPath, mainFileName);
    await page.screenshot({ path: mainFilePath, fullPage: false });
    capturedFiles.push(mainFileName);
    log(`    ✓ ${mainFileName}`, colors.green);

    // 탭별 스크린샷
    if (config.tabs && config.tabs.length > 0) {
      for (const tab of config.tabs) {
        try {
          const tabUrl = `${baseUrl}${config.path}?tab=${tab}`;
          await page.goto(tabUrl, { waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(500);

          const tabFileName = `${config.id}-${tab}-${viewport}.png`;
          const tabFilePath = join(outputPath, tabFileName);
          await page.screenshot({ path: tabFilePath, fullPage: false });
          capturedFiles.push(tabFileName);
          log(`    ✓ ${tabFileName}`, colors.green);
        } catch (error) {
          log(`    ⚠ ${tab} 탭 캡처 실패`, colors.yellow);
        }
      }
    }

  } catch (error) {
    log(`  ✗ ${config.name} 캡처 실패: ${(error as Error).message}`, colors.red);
  }

  return capturedFiles;
}

/**
 * 스크린샷 인덱스 파일 생성
 */
function generateScreenshotIndex(capturedFiles: string[], outputPath: string) {
  const indexContent = {
    generatedAt: new Date().toISOString(),
    totalFiles: capturedFiles.length,
    files: capturedFiles.sort(),
    byPage: {} as Record<string, string[]>,
  };

  // 페이지별 그룹화
  for (const file of capturedFiles) {
    const pageId = file.split('-')[0];
    if (!indexContent.byPage[pageId]) {
      indexContent.byPage[pageId] = [];
    }
    indexContent.byPage[pageId].push(file);
  }

  const indexPath = join(outputPath, 'index.json');
  writeFileSync(indexPath, JSON.stringify(indexContent, null, 2), 'utf-8');
  log(`\n✓ 인덱스 파일 생성: index.json`, colors.green);
}

/**
 * 메인 실행
 */
async function main() {
  log('\n========================================', colors.cyan);
  log('  매뉴얼 스크린샷 캡처', colors.cyan);
  log('========================================', colors.cyan);

  // 인자 파싱
  const args = process.argv.slice(2);
  const pageArg = args.find(a => a.startsWith('--page='));
  const viewportArg = args.find(a => a.startsWith('--viewport='));
  const urlArg = args.find(a => a.startsWith('--url='));

  const targetPage = pageArg ? pageArg.split('=')[1] : null;
  const targetViewport = (viewportArg ? viewportArg.split('=')[1] : 'desktop') as keyof typeof viewports;
  const baseUrl = urlArg ? urlArg.split('=')[1] : 'http://localhost:3000';

  // 대상 페이지 필터링
  const pagesToCapture = targetPage
    ? pageConfigs.filter(p => p.id === targetPage)
    : pageConfigs;

  if (pagesToCapture.length === 0) {
    log(`\n✗ 페이지를 찾을 수 없습니다: ${targetPage}`, colors.red);
    log('\n사용 가능한 페이지:', colors.yellow);
    pageConfigs.forEach(p => log(`  - ${p.id}`, colors.reset));
    process.exit(1);
  }

  // 출력 디렉토리 생성
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  log(`\n설정:`, colors.cyan);
  log(`  - 기본 URL: ${baseUrl}`, colors.reset);
  log(`  - 뷰포트: ${targetViewport} (${viewports[targetViewport].width}x${viewports[targetViewport].height})`, colors.reset);
  log(`  - 대상 페이지: ${pagesToCapture.length}개`, colors.reset);
  log(`  - 출력 폴더: ${outputDir}`, colors.reset);

  // 브라우저 시작
  log('\n브라우저 시작...', colors.cyan);
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: viewports[targetViewport],
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });

    const page = await context.newPage();

    // 로그인 시도
    const loggedIn = await performLogin(page, baseUrl);
    if (!loggedIn) {
      log('\n⚠ 로그인 없이 공개 페이지만 캡처합니다.', colors.yellow);
    }

    // 스크린샷 캡처
    log('\n스크린샷 캡처 시작...', colors.cyan);
    const allCapturedFiles: string[] = [];

    for (const config of pagesToCapture) {
      const files = await capturePageScreenshot(
        page,
        baseUrl,
        config,
        targetViewport,
        outputDir
      );
      allCapturedFiles.push(...files);
    }

    // 인덱스 파일 생성
    if (allCapturedFiles.length > 0) {
      generateScreenshotIndex(allCapturedFiles, outputDir);
    }

    await context.close();

    log('\n========================================', colors.cyan);
    log('  캡처 완료', colors.cyan);
    log('========================================', colors.cyan);
    log(`\n총 ${allCapturedFiles.length}개 스크린샷 생성`, colors.green);
    log(`출력 폴더: ${outputDir}`, colors.reset);

  } catch (error) {
    log(`\n✗ 오류 발생: ${(error as Error).message}`, colors.red);

    if ((error as Error).message.includes('Executable doesn\'t exist')) {
      log('\n브라우저가 설치되지 않았습니다. 다음 명령으로 설치하세요:', colors.yellow);
      log('  npx playwright install chromium', colors.reset);
    }

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch((error) => {
  log(`\n✗ 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
