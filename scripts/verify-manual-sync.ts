#!/usr/bin/env tsx
/**
 * 매뉴얼 동기화 검증 스크립트
 *
 * 코드베이스와 매뉴얼 간 불일치를 감지합니다:
 * 1. 라우트 vs 매뉴얼 매핑 검증
 * 2. 서브메뉴 ID vs 매뉴얼 ID 동기화 검증
 * 3. 매뉴얼 신선도 검증 (lastUpdated)
 * 4. 페이지 컴포넌트 파일 존재 검증
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadManualPageMeta, type ManualPageMeta } from './lib/manual-meta-loader';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

const rootDir = process.cwd();
const academyAdminDir = join(rootDir, 'apps/academy-admin/src');

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// 공용 로더 사용 (SSOT)
function getManualPageMeta(): Record<string, ManualPageMeta> {
  return loadManualPageMeta(academyAdminDir);
}

/**
 * 1. manualsByRoute vs manualPageMeta 라우트 매핑 검증
 */
async function verifyRouteManualMapping(): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  log('\n=== 라우트-매뉴얼 매핑 검증 ===', colors.cyan);

  const manualsIndexPath = join(academyAdminDir, 'data/manuals/index.ts');

  if (!existsSync(manualsIndexPath)) {
    result.errors.push(`매뉴얼 인덱스 파일을 찾을 수 없습니다: ${manualsIndexPath}`);
    result.success = false;
    return result;
  }

  const content = readFileSync(manualsIndexPath, 'utf-8');

  // manualsByRoute에서 등록된 라우트 추출
  const routeMatch = content.match(/export const manualsByRoute[\s\S]*?=[\s\S]*?\{([\s\S]*?)\};/);
  if (!routeMatch) {
    result.errors.push('manualsByRoute를 파싱할 수 없습니다.');
    result.success = false;
    return result;
  }

  // 라우트 키 추출 (예: '/home': dashboardManual)
  const routeKeys = Array.from(routeMatch[1].matchAll(/['"]([^'"]+)['"]\s*:/g), m => m[1]);

  // manualPageMeta에서 정의된 모든 라우트
  const metaRoutes = Object.values(getManualPageMeta()).flatMap(m => m.routes);

  // 검증 1: manualsByRoute에 있는데 meta에 없는 라우트
  const unmappedRoutes = routeKeys.filter(r => !metaRoutes.includes(r));
  if (unmappedRoutes.length > 0) {
    result.warnings.push(`manualPageMeta에 정의되지 않은 라우트: ${unmappedRoutes.join(', ')}`);
  }

  // 검증 2: meta에 있는데 manualsByRoute에 없는 라우트
  const missingRoutes = metaRoutes.filter(r => r && !routeKeys.includes(r));
  if (missingRoutes.length > 0) {
    result.warnings.push(`manualsByRoute에 등록되지 않은 라우트: ${missingRoutes.join(', ')}`);
  }

  log(`✓ manualsByRoute 등록: ${routeKeys.length}개 라우트`, colors.green);

  return result;
}

/**
 * 2. MANUAL_SUB_MENU_ITEMS vs 매뉴얼 파일 동기화 검증
 */
async function verifySubMenuManualSync(): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  log('\n=== 서브메뉴-매뉴얼 동기화 검증 ===', colors.cyan);

  const subSidebarPath = join(academyAdminDir, 'constants/sub-sidebar-menus.ts');
  const manualsIndexPath = join(academyAdminDir, 'data/manuals/index.ts');

  if (!existsSync(subSidebarPath)) {
    result.errors.push(`서브 사이드바 파일을 찾을 수 없습니다: ${subSidebarPath}`);
    result.success = false;
    return result;
  }

  const subSidebarContent = readFileSync(subSidebarPath, 'utf-8');
  const manualsContent = readFileSync(manualsIndexPath, 'utf-8');

  // MANUAL_SUB_MENU_ITEMS에서 ID 추출
  const menuMatch = subSidebarContent.match(/MANUAL_SUB_MENU_ITEMS[\s\S]*?=[\s\S]*?\[([\s\S]*?)\];/);
  if (!menuMatch) {
    result.errors.push('MANUAL_SUB_MENU_ITEMS를 파싱할 수 없습니다.');
    result.success = false;
    return result;
  }

  const menuIds = Array.from(menuMatch[1].matchAll(/id:\s*['"]([^'"]+)['"]/g), m => m[1]);

  // allManualPages에서 매뉴얼 ID 추출
  const allPagesMatch = manualsContent.match(/export const allManualPages[\s\S]*?=[\s\S]*?\[([\s\S]*?)\];/);
  if (!allPagesMatch) {
    result.errors.push('allManualPages를 파싱할 수 없습니다.');
    result.success = false;
    return result;
  }

  // 매뉴얼 파일명에서 ID 추출 (예: dashboardManual -> dashboard)
  const manualVars = Array.from(allPagesMatch[1].matchAll(/(\w+)Manual/g), m => m[1]);

  // 검증: 서브메뉴 ID와 매뉴얼 ID 일치 여부
  const missingInManuals = menuIds.filter(id => !manualVars.includes(id));
  const missingInMenu = manualVars.filter(id => !menuIds.includes(id));

  if (missingInManuals.length > 0) {
    result.errors.push(`매뉴얼 파일 없음 (서브메뉴에는 있음): ${missingInManuals.join(', ')}`);
    result.success = false;
  }

  if (missingInMenu.length > 0) {
    result.warnings.push(`서브메뉴에 없음 (매뉴얼은 있음): ${missingInMenu.join(', ')}`);
  }

  log(`✓ MANUAL_SUB_MENU_ITEMS: ${menuIds.length}개`, colors.green);
  log(`✓ allManualPages: ${manualVars.length}개`, colors.green);

  if (missingInManuals.length === 0 && missingInMenu.length === 0) {
    log(`✓ 모든 ID 일치`, colors.green);
  }

  return result;
}

/**
 * 3. 매뉴얼 신선도 검증 (lastUpdated가 90일 이내인지)
 */
async function verifyManualFreshness(): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  log('\n=== 매뉴얼 신선도 검증 ===', colors.cyan);

  const manualsDir = join(academyAdminDir, 'data/manuals');
  const manualFiles = Object.keys(getManualPageMeta()).map(id => `${id}-manual.ts`);

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let freshCount = 0;
  let staleCount = 0;

  for (const file of manualFiles) {
    const filePath = join(manualsDir, file);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, 'utf-8');
    const lastUpdatedMatch = content.match(/lastUpdated:\s*['"]([^'"]+)['"]/);

    if (lastUpdatedMatch) {
      const lastUpdated = new Date(lastUpdatedMatch[1]);
      if (lastUpdated < ninetyDaysAgo) {
        result.warnings.push(`90일 이상 경과: ${file} (${lastUpdatedMatch[1]})`);
        staleCount++;
      } else {
        freshCount++;
      }
    } else {
      result.warnings.push(`lastUpdated 필드 없음: ${file}`);
    }
  }

  if (staleCount === 0) {
    log(`✓ 모든 매뉴얼이 90일 이내 업데이트됨 (${freshCount}개)`, colors.green);
  } else {
    log(`⚠ ${staleCount}개 매뉴얼이 90일 이상 경과`, colors.yellow);
  }

  return result;
}

/**
 * 4. 페이지 컴포넌트 파일 존재 검증
 */
async function verifyPageComponentExists(): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  log('\n=== 페이지 컴포넌트 존재 검증 ===', colors.cyan);

  let existCount = 0;
  let missingCount = 0;

  for (const [manualId, meta] of Object.entries(getManualPageMeta())) {
    for (const sourceFile of meta.sourceFiles) {
      const filePath = join(academyAdminDir, sourceFile);
      if (!existsSync(filePath)) {
        result.errors.push(`[${manualId}] 페이지 파일 없음: ${sourceFile}`);
        result.success = false;
        missingCount++;
      } else {
        existCount++;
      }
    }
  }

  if (missingCount === 0) {
    log(`✓ 모든 sourceFiles 존재 확인 (${existCount}개)`, colors.green);
  } else {
    log(`✗ ${missingCount}개 파일 누락`, colors.red);
  }

  return result;
}

/**
 * 메인 실행
 */
async function main() {
  log('\n========================================', colors.cyan);
  log('  매뉴얼 동기화 검증', colors.cyan);
  log('========================================', colors.cyan);

  const results = await Promise.all([
    verifyRouteManualMapping(),
    verifySubMenuManualSync(),
    verifyManualFreshness(),
    verifyPageComponentExists(),
  ]);

  // 결과 집계
  const allErrors = results.flatMap(r => r.errors);
  const allWarnings = results.flatMap(r => r.warnings);
  const allSuccess = results.every(r => r.success);

  log('\n========================================', colors.cyan);
  log('  검증 결과 요약', colors.cyan);
  log('========================================', colors.cyan);

  if (allErrors.length > 0) {
    log(`\n✗ 오류 ${allErrors.length}개:`, colors.red);
    allErrors.forEach(err => log(`  - ${err}`, colors.red));
  }

  if (allWarnings.length > 0) {
    log(`\n⚠ 경고 ${allWarnings.length}개:`, colors.yellow);
    allWarnings.forEach(warn => log(`  - ${warn}`, colors.yellow));
  }

  if (allSuccess && allErrors.length === 0) {
    log('\n✓ 매뉴얼 동기화 검증 통과', colors.green);
    process.exit(0);
  } else {
    log('\n✗ 매뉴얼 동기화 검증 실패', colors.red);
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n✗ 검증 중 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
