#!/usr/bin/env node
/**
 * Shared Catalog 검증 스크립트
 *
 * 이 스크립트는 다음을 검증합니다:
 * 1. packages/shared-catalog.ts에 등록되지 않은 Hook 탐지
 * 2. 직접 구현 패턴 자동 탐지 (apiClient.get, useQuery 직접 사용)
 * 3. ESLint 규칙 누락 탐지
 *
 * 사용법:
 *   npm run check:shared-catalog
 *   또는
 *   npx tsx scripts/check-shared-catalog.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface CatalogHook {
  key: string;
  path: string;
  import: string;
}

interface HookPackage {
  name: string;
  path: string;
  exports: string[];
  indexFile: string;
}

interface DirectImplementationPattern {
  file: string;
  line: number;
  pattern: string;
  suggestedHook?: string;
}

interface ValidationResult {
  unregisteredHooks: HookPackage[];
  directImplementationPatterns: DirectImplementationPattern[];
  missingEslintRules: string[];
}

/**
 * packages/shared-catalog.ts에서 등록된 Hook 목록 추출
 */
function getRegisteredHooks(catalogPath: string): CatalogHook[] {
  if (!fs.existsSync(catalogPath)) {
    return [];
  }

  const catalogContent = fs.readFileSync(catalogPath, 'utf-8');
  const hooks: CatalogHook[] = [];

  // hooks 섹션 찾기 (중첩된 객체 구조 처리)
  const hooksStartMatch = catalogContent.match(/hooks:\s*\{/);
  if (!hooksStartMatch) {
    return hooks;
  }

  const hooksStartIndex = hooksStartMatch.index! + hooksStartMatch[0].length;
  let braceCount = 1;
  let i = hooksStartIndex;
  let hooksEndIndex = hooksStartIndex;

  // 중첩된 중괄호를 추적하여 hooks 섹션의 끝 찾기
  while (i < catalogContent.length && braceCount > 0) {
    if (catalogContent[i] === '{') {
      braceCount++;
    } else if (catalogContent[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        hooksEndIndex = i;
        break;
      }
    }
    i++;
  }

  const hooksSection = catalogContent.substring(hooksStartIndex, hooksEndIndex);

  // 각 Hook 엔트리 추출 (더 견고한 정규식)
  // 패턴: 'key': { ... path: '...', ... import: '...', ... }
  const hookKeyPattern = /'([^']+)':\s*\{/g;
  let keyMatch;

  while ((keyMatch = hookKeyPattern.exec(hooksSection)) !== null) {
    const key = keyMatch[1];
    const entryStart = keyMatch.index + keyMatch[0].length;

    // 이 Hook 엔트리의 끝 찾기
    let entryBraceCount = 1;
    let entryEnd = entryStart;
    let j = entryStart;

    while (j < hooksSection.length && entryBraceCount > 0) {
      if (hooksSection[j] === '{') {
        entryBraceCount++;
      } else if (hooksSection[j] === '}') {
        entryBraceCount--;
        if (entryBraceCount === 0) {
          entryEnd = j;
          break;
        }
      }
      j++;
    }

    const entryContent = hooksSection.substring(entryStart, entryEnd);

    // path와 import 추출
    const pathMatch = entryContent.match(/path:\s*['"]([^'"]+)['"]/);
    const importMatch = entryContent.match(/import:\s*['"]([^'"]+)['"]/);

    if (pathMatch && importMatch) {
      hooks.push({
        key,
        path: pathMatch[1],
        import: importMatch[1],
      });
    }
  }

  return hooks;
}

/**
 * packages/hooks 디렉토리에서 모든 Hook 패키지 스캔
 */
async function scanHookPackages(hooksDir: string): Promise<HookPackage[]> {
  const hookPackages: HookPackage[] = [];
  const packageDirs = await glob('*/src/index.ts', { cwd: hooksDir });

  for (const indexFile of packageDirs) {
    const packageDir = path.dirname(path.dirname(indexFile));
    const packageName = packageDir;
    const fullIndexPath = path.join(hooksDir, indexFile);
    const exports = extractExports(fullIndexPath);

    if (exports.length > 0) {
      hookPackages.push({
        name: packageName,
        path: `@hooks/${packageName}`,
        exports,
        indexFile: fullIndexPath,
      });
    }
  }

  return hookPackages;
}

/**
 * index.ts 파일에서 export된 Hook 이름 추출
 */
function extractExports(indexFilePath: string): string[] {
  if (!fs.existsSync(indexFilePath)) {
    return [];
  }

  const content = fs.readFileSync(indexFilePath, 'utf-8');
  const exports: string[] = [];

  // export { ... } 패턴
  const exportBlockMatches = content.matchAll(/export\s*\{([^}]+)\}/g);
  for (const match of exportBlockMatches) {
    const exportList = match[1];
    const names = exportList
      .split(',')
      .map((name) => name.trim().split(/\s+/)[0])
      .filter((name) => name && !name.startsWith('//'));
    exports.push(...names);
  }

  // export function ... 패턴
  const exportFunctionMatches = content.matchAll(/export\s+function\s+(\w+)/g);
  for (const match of exportFunctionMatches) {
    exports.push(match[1]);
  }

  // export const ... = ... 패턴
  const exportConstMatches = content.matchAll(/export\s+const\s+(\w+)/g);
  for (const match of exportConstMatches) {
    exports.push(match[1]);
  }

  // export { ... } from ... 패턴
  const exportFromMatches = content.matchAll(/export\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g);
  for (const match of exportFromMatches) {
    const exportList = match[1];
    const names = exportList
      .split(',')
      .map((name) => name.trim().split(/\s+/)[0])
      .filter((name) => name && !name.startsWith('//'));
    exports.push(...names);
  }

  return [...new Set(exports)];
}

/**
 * 직접 구현 패턴 탐지 (apiClient.get, useQuery 직접 사용)
 */
async function detectDirectImplementationPatterns(
  appsDir: string,
  registeredHooks: CatalogHook[]
): Promise<DirectImplementationPattern[]> {
  const patterns: DirectImplementationPattern[] = [];
  const sourceFiles = await glob('**/*.{ts,tsx}', {
    cwd: appsDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
  });

  for (const file of sourceFiles) {
    const fullPath = path.join(appsDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // 주석 처리된 라인 제외
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
        return;
      }

      // apiClient.get('...') 패턴 탐지
      const apiClientMatch = line.match(/apiClient\.get\s*<\s*\w+\s*>\s*\(\s*['"]([^'"]+)['"]/);
      if (apiClientMatch) {
        const tableName = apiClientMatch[1];
        // 등록된 Hook이 있는지 확인
        const suggestedHook = registeredHooks.find((h) =>
          h.import.toLowerCase().includes(tableName.toLowerCase())
        );

        patterns.push({
          file,
          line: index + 1,
          pattern: `apiClient.get('${tableName}')`,
          suggestedHook: suggestedHook?.key,
        });
      }

      // useQuery 직접 사용 패턴 (Hook이 아닌 직접 사용)
      const useQueryMatch = line.match(/useQuery\s*<[^>]*>\s*\(\s*\{[^}]*queryFn:\s*async/);
      if (useQueryMatch && !line.includes('// ✅') && !line.includes('// ⚠️')) {
        // 이미 Hook으로 래핑된 경우는 제외 (주석으로 표시된 경우)
        patterns.push({
          file,
          line: index + 1,
          pattern: 'useQuery 직접 사용 (Hook으로 래핑 권장)',
        });
      }
    });
  }

  return patterns;
}

/**
 * ESLint 규칙 누락 탐지
 */
async function detectMissingEslintRules(
  appsDir: string,
  registeredHooks: CatalogHook[]
): Promise<string[]> {
  const missingRules: string[] = [];
  const eslintFiles = await glob('**/.eslintrc.cjs', { cwd: appsDir });

  for (const eslintFile of eslintFiles) {
    const fullPath = path.join(appsDir, eslintFile);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // 각 등록된 Hook에 대해 ESLint 규칙이 있는지 확인
    for (const hook of registeredHooks) {
      // Hook의 doNot 패턴을 기반으로 ESLint 규칙 필요 여부 판단
      // 예: apiClient.get('task_cards') 같은 패턴
      const tableNameMatch = hook.import.match(/['"]([^'"]+)['"]/);
      if (tableNameMatch) {
        const tableName = tableNameMatch[1];
        const rulePattern = `apiClient.*get.*['"]${tableName}['"]`;
        if (!content.includes(rulePattern) && !content.includes('no-restricted-syntax')) {
          missingRules.push(`${eslintFile}: ${hook.key}에 대한 ESLint 규칙 누락`);
        }
      }
    }
  }

  return missingRules;
}

/**
 * 메인 검증 함수
 */
async function validateSharedCatalog(): Promise<ValidationResult> {
  const rootDir = path.resolve(process.cwd());
  const catalogPath = path.join(rootDir, 'packages', 'shared-catalog.ts');
  const hooksDir = path.join(rootDir, 'packages', 'hooks');
  const appsDir = path.join(rootDir, 'apps');

  console.log('🔍 Shared Catalog 검증 시작...\n');

  // 1. 등록된 Hook 목록 추출
  const registeredHooks = getRegisteredHooks(catalogPath);
  console.log(`✅ 등록된 Hook 수: ${registeredHooks.length}`);

  // 2. Hook 패키지 스캔
  const hookPackages = await scanHookPackages(hooksDir);
  console.log(`📦 발견된 Hook 패키지 수: ${hookPackages.length}`);

  // 3. 등록되지 않은 Hook 탐지
  const unregisteredHooks: HookPackage[] = [];
  for (const hookPackage of hookPackages) {
    // 등록 여부 확인: path가 정확히 일치하거나, import에 패키지 이름이 포함되어 있는지 확인
    const isRegistered = registeredHooks.some((h) => {
      // 정확한 path 매칭: @hooks/use-xxx
      if (h.path === hookPackage.path) {
        return true;
      }
      // import에 패키지 이름이 포함되어 있는지 확인
      if (h.import.includes(hookPackage.name)) {
        return true;
      }
      // path에서 패키지 이름 추출하여 비교
      const pathPackageName = h.path.replace('@hooks/', '');
      if (pathPackageName === hookPackage.name) {
        return true;
      }
      return false;
    });

    if (!isRegistered) {
      unregisteredHooks.push(hookPackage);
    }
  }

  // 4. 직접 구현 패턴 탐지
  const directPatterns = await detectDirectImplementationPatterns(appsDir, registeredHooks);

  // 5. ESLint 규칙 누락 탐지
  const missingRules = await detectMissingEslintRules(appsDir, registeredHooks);

  return {
    unregisteredHooks,
    directImplementationPatterns: directPatterns,
    missingEslintRules: missingRules,
  };
}

/**
 * 결과 출력
 */
function printResults(result: ValidationResult): void {
  console.log('\n📊 검증 결과:\n');

  // 등록되지 않은 Hook
  if (result.unregisteredHooks.length > 0) {
    console.log('⚠️  등록되지 않은 Hook:');
    result.unregisteredHooks.forEach((hook) => {
      console.log(`   - ${hook.name} (${hook.path})`);
      console.log(`     Exports: ${hook.exports.join(', ')}`);
    });
    console.log('');
  } else {
    console.log('✅ 모든 Hook이 등록되어 있습니다.\n');
  }

  // 직접 구현 패턴
  if (result.directImplementationPatterns.length > 0) {
    console.log('⚠️  직접 구현 패턴 발견:');
    const grouped = result.directImplementationPatterns.reduce((acc, p) => {
      if (!acc[p.file]) acc[p.file] = [];
      acc[p.file].push(p);
      return acc;
    }, {} as Record<string, DirectImplementationPattern[]>);

    Object.entries(grouped).forEach(([file, patterns]) => {
      console.log(`   ${file}:`);
      patterns.forEach((p) => {
        console.log(`     Line ${p.line}: ${p.pattern}`);
        if (p.suggestedHook) {
          console.log(`       → 권장: ${p.suggestedHook} 사용`);
        }
      });
    });
    console.log('');
  } else {
    console.log('✅ 직접 구현 패턴이 없습니다.\n');
  }

  // ESLint 규칙 누락
  if (result.missingEslintRules.length > 0) {
    console.log('⚠️  ESLint 규칙 누락:');
    result.missingEslintRules.forEach((rule) => {
      console.log(`   - ${rule}`);
    });
    console.log('');
  } else {
    console.log('✅ 모든 ESLint 규칙이 설정되어 있습니다.\n');
  }

  // 요약
  const totalIssues =
    result.unregisteredHooks.length +
    result.directImplementationPatterns.length +
    result.missingEslintRules.length;

  if (totalIssues > 0) {
    console.log(`\n❌ 총 ${totalIssues}개의 이슈가 발견되었습니다.`);
    console.log('📋 templates/ 디렉토리의 템플릿을 참고하여 수정하세요.\n');
    process.exit(1);
  } else {
    console.log('✅ 모든 검증을 통과했습니다!\n');
    process.exit(0);
  }
}

// 실행
validateSharedCatalog()
  .then(printResults)
  .catch((error) => {
    console.error('❌ 검증 중 오류 발생:', error);
    process.exit(1);
  });

