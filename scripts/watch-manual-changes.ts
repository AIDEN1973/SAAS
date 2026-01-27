#!/usr/bin/env tsx
/**
 * 매뉴얼 변경 감지 및 자동 업데이트 워처
 *
 * Git pre-push hook 또는 CI에서 실행되어:
 * 1. 페이지 코드 변경 감지
 * 2. 매뉴얼 업데이트 필요 여부 판단
 * 3. 자동으로 AI 기반 매뉴얼 업데이트 실행
 *
 * 사용법:
 *   npm run watch:manual-changes                    # 변경 감지 및 자동 업데이트
 *   npm run watch:manual-changes -- --check-only   # 변경 감지만 (업데이트 안함)
 *   npm run watch:manual-changes -- --since=HEAD~3 # 특정 커밋 이후 변경
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadManualPageMeta, type ManualPageMeta } from './lib/manual-meta-loader';

const rootDir = process.cwd();
const academyAdminDir = join(rootDir, 'apps/academy-admin/src');
const manualsDir = join(academyAdminDir, 'data/manuals');

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// 공용 로더 사용 (SSOT)
function getManualPageMeta(): Record<string, ManualPageMeta> {
  return loadManualPageMeta(academyAdminDir);
}

interface ChangeDetection {
  manualId: string;
  changedFiles: string[];
  manualLastUpdated: string | null;
  codeLastModified: string | null;
  needsUpdate: boolean;
  reason: string;
}

/**
 * Git에서 변경된 파일 목록 조회
 */
function getChangedFiles(since: string = 'HEAD~5'): string[] {
  try {
    const cmd = `git diff --name-only ${since} HEAD -- "apps/academy-admin/src/pages/**/*.tsx"`;
    const output = execSync(cmd, { cwd: rootDir, encoding: 'utf-8' }).trim();
    if (!output) return [];
    return output.split('\n').filter(f => f.length > 0);
  } catch {
    return [];
  }
}

/**
 * 파일의 마지막 커밋 날짜 조회
 */
function getLastCommitDate(filePath: string): string | null {
  try {
    const cmd = `git log -1 --format=%ci -- "${filePath}"`;
    const output = execSync(cmd, { cwd: rootDir, encoding: 'utf-8' }).trim();
    return output ? output.split(' ')[0] : null;
  } catch {
    return null;
  }
}

/**
 * 매뉴얼 파일에서 lastUpdated 추출
 */
function getManualLastUpdated(manualId: string): string | null {
  const manualPath = join(manualsDir, `${manualId}-manual.ts`);
  if (!existsSync(manualPath)) return null;

  const content = readFileSync(manualPath, 'utf-8');
  const match = content.match(/lastUpdated:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/**
 * 변경 감지 및 분석
 */
function detectChanges(since: string): ChangeDetection[] {
  const changedFiles = getChangedFiles(since);
  const results: ChangeDetection[] = [];

  for (const [manualId, meta] of Object.entries(getManualPageMeta())) {
    // sourceFiles에서 파일명만 추출 (예: 'pages/HomePage.tsx' -> 'HomePage.tsx')
    const pageFiles = meta.sourceFiles.map(f => f.split('/').pop() || f);
    const matchedFiles = changedFiles.filter(f =>
      pageFiles.some(pf => f.includes(pf))
    );

    if (matchedFiles.length === 0) continue;

    const manualLastUpdated = getManualLastUpdated(manualId);
    const codeLastModified = matchedFiles.length > 0
      ? getLastCommitDate(matchedFiles[0])
      : null;

    let needsUpdate = false;
    let reason = '';

    if (!manualLastUpdated) {
      needsUpdate = true;
      reason = '매뉴얼 파일에 lastUpdated 없음';
    } else if (codeLastModified && new Date(codeLastModified) > new Date(manualLastUpdated)) {
      needsUpdate = true;
      reason = `코드 변경(${codeLastModified}) > 매뉴얼 업데이트(${manualLastUpdated})`;
    } else {
      reason = '최신 상태';
    }

    results.push({
      manualId,
      changedFiles: matchedFiles,
      manualLastUpdated,
      codeLastModified,
      needsUpdate,
      reason,
    });
  }

  return results;
}

/**
 * 자동 업데이트 실행
 */
async function runAutoUpdate(manualIds: string[]): Promise<boolean> {
  if (manualIds.length === 0) return true;

  log('\n자동 업데이트 실행 중...', colors.cyan);

  for (const manualId of manualIds) {
    try {
      log(`  ${manualId} 업데이트 중...`, colors.gray);
      execSync(`npm run auto:manual-update -- --page=${manualId}`, {
        cwd: rootDir,
        stdio: 'inherit',
      });
    } catch (error) {
      log(`  ✗ ${manualId} 업데이트 실패`, colors.red);
      return false;
    }
  }

  return true;
}

/**
 * 메인 실행
 */
async function main() {
  log('\n========================================', colors.cyan);
  log('  매뉴얼 변경 감지 워처', colors.cyan);
  log('========================================', colors.cyan);

  // 인자 파싱
  const args = process.argv.slice(2);
  const sinceArg = args.find(a => a.startsWith('--since='));
  const checkOnly = args.includes('--check-only');
  const autoUpdate = args.includes('--auto-update');

  const since = sinceArg ? sinceArg.split('=')[1] : 'HEAD~5';

  log(`\n검사 범위: ${since} ~ HEAD`, colors.gray);

  // 변경 감지
  const detections = detectChanges(since);

  if (detections.length === 0) {
    log('\n✓ 변경된 페이지 파일 없음', colors.green);
    process.exit(0);
  }

  // 결과 출력
  log('\n=== 변경 감지 결과 ===\n', colors.cyan);

  const needsUpdateList: string[] = [];

  for (const detection of detections) {
    const status = detection.needsUpdate
      ? `${colors.yellow}⚠ 업데이트 필요${colors.reset}`
      : `${colors.green}✓ 최신${colors.reset}`;

    log(`${colors.bold}${detection.manualId}${colors.reset} ${status}`);
    log(`  변경 파일: ${detection.changedFiles.join(', ')}`, colors.gray);
    log(`  사유: ${detection.reason}`, colors.gray);

    if (detection.needsUpdate) {
      needsUpdateList.push(detection.manualId);
    }
  }

  // 요약
  log('\n=== 요약 ===', colors.cyan);
  log(`  감지된 변경: ${detections.length}개 매뉴얼`, colors.reset);
  log(`  업데이트 필요: ${needsUpdateList.length}개`, needsUpdateList.length > 0 ? colors.yellow : colors.green);

  if (checkOnly) {
    log('\n[Check Only 모드] 업데이트 실행하지 않음', colors.gray);
    process.exit(needsUpdateList.length > 0 ? 1 : 0);
  }

  // 자동 업데이트
  if (needsUpdateList.length > 0) {
    if (autoUpdate) {
      const success = await runAutoUpdate(needsUpdateList);
      process.exit(success ? 0 : 1);
    } else {
      log('\n다음 명령으로 업데이트하세요:', colors.yellow);
      log(`  npm run auto:manual-update -- --page=${needsUpdateList.join(' --page=')}`, colors.reset);
      log('\n또는 자동 업데이트:', colors.yellow);
      log(`  npm run watch:manual-changes -- --auto-update`, colors.reset);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  log(`\n✗ 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
