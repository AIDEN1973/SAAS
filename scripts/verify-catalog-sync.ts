#!/usr/bin/env tsx
/**
 * 카탈로그 동기화 검증 스크립트
 *
 * SSOT 원칙에 따라 다음 카탈로그들이 동기화되었는지 검증합니다:
 * 1. automation-event-catalog.ts (packages vs infra)
 * 2. industry_type enum (industry-registry vs RLS policies vs schema registry)
 * 3. shared-catalog.ts (등록된 항목이 실제 파일로 존재하는지)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

const rootDir = process.cwd();

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

/**
 * 1. Automation Event Catalog 동기화 검증
 */
async function verifyAutomationEventCatalog(): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  log('\n=== Automation Event Catalog 동기화 검증 ===', colors.cyan);

  const packagesCatalogPath = join(rootDir, 'packages/core/core-automation/src/automation-event-catalog.ts');
  const infraCatalogPath = join(rootDir, 'infra/supabase/functions/_shared/automation-event-catalog.ts');

  if (!existsSync(packagesCatalogPath)) {
    result.errors.push(`packages 카탈로그 파일을 찾을 수 없습니다: ${packagesCatalogPath}`);
    result.success = false;
    return result;
  }

  if (!existsSync(infraCatalogPath)) {
    result.warnings.push(`infra 카탈로그 파일을 찾을 수 없습니다: ${infraCatalogPath} (Edge Functions 미배포 시 정상)`);
    // infra가 없으면 검증 스킵
    log(`⚠ infra 카탈로그 미발견 (스킵)`, colors.yellow);
    return result;
  }

  const packagesContent = readFileSync(packagesCatalogPath, 'utf-8');
  const infraContent = readFileSync(infraCatalogPath, 'utf-8');

  // AUTOMATION_EVENT_CATALOG 추출
  const extractCatalog = (content: string): string[] => {
    const catalogMatch = content.match(/export const AUTOMATION_EVENT_CATALOG[\s\S]*?=[\s\S]*?\{([\s\S]*?)\};/);
    if (!catalogMatch) return [];

    // 이벤트 키 추출 (event_type)
    const eventMatches = catalogMatch[1].matchAll(/['"]([^'"]+)['"]\s*:\s*\{/g);
    return Array.from(eventMatches, m => m[1]).sort();
  };

  const packagesEvents = extractCatalog(packagesContent);
  const infraEvents = extractCatalog(infraContent);

  if (packagesEvents.length === 0) {
    result.warnings.push('packages 카탈로그에서 이벤트를 추출할 수 없습니다.');
  }

  if (infraEvents.length === 0) {
    result.warnings.push('infra 카탈로그에서 이벤트를 추출할 수 없습니다.');
  }

  // 동기화 검증
  const packagesOnly = packagesEvents.filter(e => !infraEvents.includes(e));
  const infraOnly = infraEvents.filter(e => !packagesEvents.includes(e));

  if (packagesOnly.length > 0) {
    result.errors.push(`packages에만 있는 이벤트: ${packagesOnly.join(', ')}`);
    result.success = false;
  }

  if (infraOnly.length > 0) {
    result.errors.push(`infra에만 있는 이벤트: ${infraOnly.join(', ')}`);
    result.success = false;
  }

  if (result.success && packagesEvents.length > 0) {
    log(`✓ Automation Event Catalog 동기화 확인 (${packagesEvents.length}개 이벤트)`, colors.green);
  }

  return result;
}

/**
 * 2. industry_type enum 동기화 검증
 */
async function verifyIndustryTypeEnum(): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  log('\n=== industry_type enum 동기화 검증 ===', colors.cyan);

  const industryRegistryPath = join(rootDir, 'packages/industry/industry-registry.ts');

  if (!existsSync(industryRegistryPath)) {
    result.errors.push(`Industry Registry 파일을 찾을 수 없습니다: ${industryRegistryPath}`);
    result.success = false;
    return result;
  }

  const registryContent = readFileSync(industryRegistryPath, 'utf-8');

  // industry_type enum 추출 (동적 개수 지원)
  const enumMatch = registryContent.match(/type IndustryType\s*=\s*((?:['"][^'"]+['"]\s*\|\s*)*['"][^'"]+['"])/);
  if (!enumMatch) {
    result.warnings.push('IndustryType 타입을 추출할 수 없습니다.');
    return result;
  }

  // 모든 타입 값 추출
  const typeMatches = enumMatch[1].matchAll(/['"]([^'"]+)['"]/g);
  const industryTypes = Array.from(typeMatches, m => m[1]).sort();

  // 정본 확인: academy, salon, real_estate
  const expectedTypes = ['academy', 'real_estate', 'salon'].sort();

  if (JSON.stringify(industryTypes) !== JSON.stringify(expectedTypes)) {
    result.errors.push(
      `industry_type enum이 정본과 다릅니다.\n` +
      `  기대값: ${expectedTypes.join(', ')}\n` +
      `  실제값: ${industryTypes.join(', ')}`
    );
    result.success = false;
  }

  // 금지된 값 확인
  const forbiddenValues = ['realestate', 'beauty_salon'];
  for (const forbidden of forbiddenValues) {
    if (registryContent.includes(`'${forbidden}'`) || registryContent.includes(`"${forbidden}"`)) {
      result.errors.push(`금지된 industry_type 값 발견: ${forbidden} (정본: real_estate, salon 사용 필수)`);
      result.success = false;
    }
  }

  if (result.success) {
    log(`✓ industry_type enum 정본 확인 (${industryTypes.join(', ')})`, colors.green);
  }

  return result;
}

/**
 * 3. Shared Catalog 등록 항목 파일 존재 검증
 * status: 'implemented' 항목만 파일 존재 검증
 */
async function verifySharedCatalog(): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  log('\n=== Shared Catalog 등록 항목 검증 ===', colors.cyan);

  const sharedCatalogPath = join(rootDir, 'packages/shared-catalog.ts');

  if (!existsSync(sharedCatalogPath)) {
    result.warnings.push('shared-catalog.ts 파일을 찾을 수 없습니다. 스킵합니다.');
    return result;
  }

  const catalogContent = readFileSync(sharedCatalogPath, 'utf-8');

  // status: 'implemented'인 항목의 path만 추출
  const implementedItems: { path: string; key: string }[] = [];

  // 간단한 접근: path와 status를 개별적으로 추출한 후 매칭
  // path: '...' 다음에 status: 'implemented'가 나오는 패턴 찾기
  const lines = catalogContent.split('\n');
  let currentKey = '';
  let currentPath = '';
  let currentStatus = '';

  for (const line of lines) {
    // 항목 키 추출 (예: 'use-student': {)
    const keyMatch = line.match(/^\s*'([^']+)':\s*\{/);
    if (keyMatch) {
      // 이전 항목 처리
      if (currentKey && currentPath && currentStatus === 'implemented') {
        implementedItems.push({ path: currentPath, key: currentKey });
      }
      currentKey = keyMatch[1];
      currentPath = '';
      currentStatus = '';
    }

    // path 추출
    const pathMatch = line.match(/path:\s*['"]([^'"]+)['"]/);
    if (pathMatch && currentKey) {
      currentPath = pathMatch[1];
    }

    // status 추출
    const statusMatch = line.match(/status:\s*['"]([^'"]+)['"]/);
    if (statusMatch && currentKey) {
      currentStatus = statusMatch[1];
    }
  }

  // 마지막 항목 처리
  if (currentKey && currentPath && currentStatus === 'implemented') {
    implementedItems.push({ path: currentPath, key: currentKey });
  }

  if (implementedItems.length === 0) {
    result.warnings.push('Shared Catalog에 implemented 상태의 항목이 없습니다.');
    return result;
  }

  let missingCount = 0;
  for (const { path, key } of implementedItems) {
    const fullPath = join(rootDir, path);
    if (!existsSync(fullPath)) {
      result.errors.push(`[${key}] implemented 상태이나 파일이 없습니다: ${path}`);
      result.success = false;
      missingCount++;
    }
  }

  // 통계 출력
  const stats = {
    implemented: implementedItems.length,
    missing: missingCount,
  };

  if (missingCount === 0) {
    log(`✓ Shared Catalog implemented 항목 검증 완료 (${stats.implemented}개 모두 존재)`, colors.green);
  } else {
    log(`✗ ${missingCount}/${stats.implemented}개 implemented 항목의 파일이 누락됨`, colors.red);
  }

  return result;
}

/**
 * 4. Policy Key v1/v2 혼용 검증
 */
async function verifyPolicyKeyUsage(): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  log('\n=== Policy Key v1/v2 혼용 검증 ===', colors.cyan);

  // v1 정책 키 (alias-only, 저장 금지)
  const v1PolicyKeys = [
    'attendance_anomaly',
    'payment_overdue',
    'ai_suggestion',
    'report_generation',
    'dashboard_priority',
  ];

  // v2 정책 키 (정본, 저장 허용)
  const v2PolicyKeys = [
    'financial_health',
    'capacity_optimization',
    'customer_retention',
    'growth_marketing',
    'safety_compliance',
    'workforce_ops',
  ];

  // packages, apps, infra 전체에서 v1 정책 키 저장 패턴 검색 (성능 최적화)
  const tsFiles = await glob('**/*.{ts,tsx}', {
    cwd: rootDir,
    ignore: [
      'node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/*.d.ts', // 타입 정의 파일 제외
    ],
  });

  let v1UsageCount = 0;
  for (const file of tsFiles) {
    const content = readFileSync(join(rootDir, file), 'utf-8');

    for (const v1Key of v1PolicyKeys) {
      // 정책 저장 패턴 탐지 (예: { policy_key: 'attendance_anomaly' })
      const savePattern = new RegExp(`policy_key\\s*:\\s*['"]${v1Key}['"]`, 'g');
      if (savePattern.test(content)) {
        result.warnings.push(
          `파일 ${file}에서 v1 정책 키 저장 패턴 발견: ${v1Key} (v2 사용 권장)`
        );
        v1UsageCount++;
      }
    }
  }

  if (v1UsageCount > 0) {
    result.warnings.push(`총 ${v1UsageCount}곳에서 v1 정책 키 사용 중. v2로 마이그레이션 권장.`);
  } else {
    log(`✓ v1 정책 키 저장 패턴 미발견`, colors.green);
  }

  return result;
}

/**
 * 메인 실행
 */
async function main() {
  log('\n========================================', colors.cyan);
  log('  SSOT 카탈로그 동기화 검증', colors.cyan);
  log('========================================\n', colors.cyan);

  const results = await Promise.all([
    verifyAutomationEventCatalog(),
    verifyIndustryTypeEnum(),
    verifySharedCatalog(),
    verifyPolicyKeyUsage(),
  ]);

  // 결과 집계
  const allErrors = results.flatMap(r => r.errors);
  const allWarnings = results.flatMap(r => r.warnings);
  const allSuccess = results.every(r => r.success);

  log('\n========================================', colors.cyan);
  log('  검증 결과 요약', colors.cyan);
  log('========================================\n', colors.cyan);

  if (allErrors.length > 0) {
    log(`✗ 오류 ${allErrors.length}개:`, colors.red);
    allErrors.forEach(err => log(`  - ${err}`, colors.red));
  }

  if (allWarnings.length > 0) {
    log(`\n⚠ 경고 ${allWarnings.length}개:`, colors.yellow);
    allWarnings.forEach(warn => log(`  - ${warn}`, colors.yellow));
  }

  if (allSuccess && allErrors.length === 0) {
    log('\n✓ 모든 카탈로그 동기화 검증 통과', colors.green);
    process.exit(0);
  } else {
    log('\n✗ 카탈로그 동기화 검증 실패', colors.red);
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n✗ 검증 중 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
