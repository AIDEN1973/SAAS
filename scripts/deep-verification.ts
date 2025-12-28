#!/usr/bin/env tsx
/**
 * Handler 심층 검증 스크립트
 *
 * 모든 Handler의 실제 구조, import/export 일치, 타입 안정성 등을 검증합니다.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');
const REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');

interface VerificationIssue {
  type: 'error' | 'warning';
  handler: string;
  message: string;
}

const issues: VerificationIssue[] = [];

// Registry 파일 읽기
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');

// Registry에서 모든 Handler 추출
const handlerMap = new Map<string, { handlerName: string; importPath: string }>();

// Import 문 파싱
const importLines = registryContent.match(/import\s+{\s*(\w+)\s*}\s+from\s+['"]([^'"]+)['"];/g) || [];
for (const line of importLines) {
  const match = line.match(/import\s+{\s*(\w+)\s*}\s+from\s+['"]([^'"]+)['"];/);
  if (match && match[1].endsWith('Handler')) {
    const handlerName = match[1];
    const importPath = match[2];
    handlerMap.set(handlerName, { handlerName, importPath });
  }
}

// Registry entry 파싱
const entryRegex = /'([^']+)':\s*(\w+),/g;
let entryMatch;
const intentToHandler = new Map<string, string>();
while ((entryMatch = entryRegex.exec(registryContent)) !== null) {
  const intentKey = entryMatch[1];
  const handlerName = entryMatch[2];
  intentToHandler.set(intentKey, handlerName);
}

console.log(`📋 검증 대상: ${intentToHandler.size}개 Handler\n`);

// 각 Handler 검증
for (const [intentKey, handlerName] of intentToHandler) {
  const handlerInfo = handlerMap.get(handlerName);
  if (!handlerInfo) {
    issues.push({
      type: 'error',
      handler: intentKey,
      message: `Registry에 등록되었지만 import가 없음: ${handlerName}`,
    });
    continue;
  }

  const filePath = join(HANDLERS_DIR, handlerInfo.importPath.replace('./', ''));

  // 1. 파일 존재 확인
  if (!existsSync(filePath)) {
    issues.push({
      type: 'error',
      handler: intentKey,
      message: `파일이 존재하지 않음: ${filePath}`,
    });
    continue;
  }

  // 2. 파일 내용 읽기
  let fileContent: string;
  try {
    fileContent = readFileSync(filePath, 'utf-8');
  } catch (error) {
    issues.push({
      type: 'error',
      handler: intentKey,
      message: `파일 읽기 실패: ${error}`,
    });
    continue;
  }

  // 3. Export 이름 확인
  const exportPattern = new RegExp(`export\\s+const\\s+${handlerName}\\s*:`);
  if (!exportPattern.test(fileContent)) {
    issues.push({
      type: 'error',
      handler: intentKey,
      message: `Export 이름 불일치: ${handlerName} (파일에서 찾을 수 없음)`,
    });
  }

  // 4. intent_key 확인
  const intentKeyMatch = fileContent.match(/intent_key:\s*['"]([^'"]+)['"]/);
  if (!intentKeyMatch) {
    issues.push({
      type: 'error',
      handler: intentKey,
      message: 'intent_key가 파일에 없음',
    });
  } else if (intentKeyMatch[1] !== intentKey) {
    issues.push({
      type: 'error',
      handler: intentKey,
      message: `intent_key 불일치: 파일에는 "${intentKeyMatch[1]}"`,
    });
  }

  // 5. Handler 구조 확인
  if (!fileContent.includes(': IntentHandler')) {
    issues.push({
      type: 'error',
      handler: intentKey,
      message: 'IntentHandler 타입이 없음',
    });
  }

  if (!fileContent.includes('async execute')) {
    issues.push({
      type: 'error',
      handler: intentKey,
      message: 'execute 함수가 없음',
    });
  }

  // 6. 필수 import 확인
  const requiredImports = [
    'IntentHandler',
    'SuggestedActionChatOpsPlanV1',
    'HandlerContext',
    'HandlerResult',
  ];
  for (const requiredImport of requiredImports) {
    if (!fileContent.includes(requiredImport)) {
      issues.push({
        type: 'warning',
        handler: intentKey,
        message: `필수 타입 import 없음: ${requiredImport}`,
      });
    }
  }

  // 7. 필수 유틸리티 확인
  if (!fileContent.includes('maskPII')) {
    issues.push({
      type: 'warning',
      handler: intentKey,
      message: 'maskPII import 없음 (PII 마스킹 권장)',
    });
  }

  if (!fileContent.includes('withTenant')) {
    issues.push({
      type: 'warning',
      handler: intentKey,
      message: 'withTenant import 없음 (RLS 보호 권장)',
    });
  }

  // 8. L2-B Handler의 Domain Action Catalog 검증 확인
  if (intentKey.includes('.exec.') && fileContent.includes('execution_class')) {
    // L2-B인지 확인 (action_key가 있는지)
    if (fileContent.includes('action_key') || fileContent.includes('Domain Action Catalog')) {
      if (!fileContent.includes('assertDomainActionKey') && !fileContent.includes('isDomainActionKey')) {
        issues.push({
          type: 'warning',
          handler: intentKey,
          message: 'Domain Action Catalog 검증 없음 (L2-B 권장)',
        });
      }
    }
  }

  // 9. Policy 검증 확인
  if (!fileContent.includes('getTenantSettingByPath')) {
    issues.push({
      type: 'warning',
      handler: intentKey,
      message: 'Policy 검증 없음 (권장)',
    });
  }

  // 10. 에러 처리 확인
  if (!fileContent.includes('try') || !fileContent.includes('catch')) {
    issues.push({
      type: 'warning',
      handler: intentKey,
      message: '에러 처리(try-catch) 없음',
    });
  }

  // 11. HandlerResult 반환 확인
  if (!fileContent.includes('HandlerResult') && !fileContent.includes('status:')) {
    issues.push({
      type: 'warning',
      handler: intentKey,
      message: 'HandlerResult 반환 구조 확인 필요',
    });
  }
}

// 결과 출력
console.log('=== 심층 검증 결과 ===\n');

const errors = issues.filter(i => i.type === 'error');
const warnings = issues.filter(i => i.type === 'warning');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ 모든 검증 통과!\n');
} else {
  if (errors.length > 0) {
    console.log(`❌ 오류: ${errors.length}개\n`);
    errors.forEach(e => {
      console.log(`  [${e.handler}] ${e.message}`);
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`⚠️  경고: ${warnings.length}개\n`);
    warnings.forEach(w => {
      console.log(`  [${w.handler}] ${w.message}`);
    });
    console.log('');
  }
}

// 통계
console.log('=== 통계 ===');
console.log(`전체 Handler: ${intentToHandler.size}개`);
console.log(`오류: ${errors.length}개`);
console.log(`경고: ${warnings.length}개`);
console.log(`통과: ${intentToHandler.size - errors.length - warnings.length}개\n`);

// JSON 출력
console.log('=== JSON 출력 ===');
console.log(JSON.stringify({
  total: intentToHandler.size,
  errors: errors.length,
  warnings: warnings.length,
  issues: issues,
}, null, 2));

// 종료 코드
process.exit(errors.length > 0 ? 1 : 0);

