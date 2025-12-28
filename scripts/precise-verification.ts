#!/usr/bin/env tsx
/**
 * Handler 정밀 검증 스크립트
 *
 * 모든 Handler의 실제 파일 존재, export 이름, intent_key 등을 검증합니다.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');
const REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');
const INTENT_REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');

interface VerificationResult {
  errors: string[];
  warnings: string[];
  fixed: string[];
}

const result: VerificationResult = {
  errors: [],
  warnings: [],
  fixed: [],
};

// Registry 파일 읽기
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');

// Registry에서 등록된 Handler 추출
const registeredHandlers: Array<{
  intent_key: string;
  handlerName: string;
  importPath: string;
}> = [];

// Import 문 파싱
const importRegex = /import\s+{\s*(\w+)\s*}\s+from\s+['"]([^'"]+)['"];/g;
let importMatch;
while ((importMatch = importRegex.exec(registryContent)) !== null) {
  const handlerName = importMatch[1];
  const importPath = importMatch[2];

  // Handler 이름에서 intent_key 추론 (예: attendance_exec_correct_recordHandler -> attendance.exec.correct_record)
  // Registry entry에서 찾기
  const entryRegex = new RegExp(`'([^']+)':\\s*${handlerName}`, 'g');
  let entryMatch;
  while ((entryMatch = entryRegex.exec(registryContent)) !== null) {
    registeredHandlers.push({
      intent_key: entryMatch[1],
      handlerName,
      importPath,
    });
  }
}

console.log(`📋 등록된 Handler: ${registeredHandlers.length}개\n`);

// 각 Handler 검증
for (const handler of registeredHandlers) {
  const filePath = join(HANDLERS_DIR, handler.importPath.replace('./', ''));

  // 1. 파일 존재 확인
  if (!existsSync(filePath)) {
    result.errors.push(`❌ 파일 없음: ${handler.intent_key} -> ${filePath}`);
    continue;
  }

  // 2. 파일 내용 읽기
  const fileContent = readFileSync(filePath, 'utf-8');

  // 3. Export 이름 확인
  const exportRegex = new RegExp(`export\\s+const\\s+${handler.handlerName}\\s*:`, 'g');
  if (!exportRegex.test(fileContent)) {
    result.errors.push(`❌ Export 이름 불일치: ${handler.intent_key} -> ${handler.handlerName}`);
  }

  // 4. intent_key 확인
  const intentKeyRegex = /intent_key:\s*['"]([^'"]+)['"]/;
  const intentKeyMatch = fileContent.match(intentKeyRegex);
  if (!intentKeyMatch) {
    result.errors.push(`❌ intent_key 없음: ${handler.intent_key} -> ${filePath}`);
  } else if (intentKeyMatch[1] !== handler.intent_key) {
    result.errors.push(`❌ intent_key 불일치: ${handler.intent_key} -> 파일에는 ${intentKeyMatch[1]}`);
  }

  // 5. Handler 구조 확인
  if (!fileContent.includes('IntentHandler')) {
    result.errors.push(`❌ IntentHandler 타입 없음: ${handler.intent_key}`);
  }

  if (!fileContent.includes('async execute')) {
    result.errors.push(`❌ execute 함수 없음: ${handler.intent_key}`);
  }

  // 6. L2-B Handler의 Domain Action Catalog 검증 확인
  if (handler.intent_key.includes('.exec.') && fileContent.includes('execution_class')) {
    if (!fileContent.includes('assertDomainActionKey') && !fileContent.includes('isDomainActionKey')) {
      result.warnings.push(`⚠️  Domain Action Catalog 검증 없음: ${handler.intent_key}`);
    }
  }

  // 7. Policy 검증 확인
  if (!fileContent.includes('getTenantSettingByPath')) {
    result.warnings.push(`⚠️  Policy 검증 없음: ${handler.intent_key}`);
  }

  // 8. PII 마스킹 확인
  if (!fileContent.includes('maskPII')) {
    result.warnings.push(`⚠️  PII 마스킹 없음: ${handler.intent_key}`);
  }
}

// Intent Registry와 비교
const intentRegistryContent = readFileSync(INTENT_REGISTRY_PATH, 'utf-8');
const execIntentRegex = /intent_key:\s*['"]([^'"]+\.exec\.[^'"]+)['"]/g;
const allExecIntents = new Set<string>();
let execMatch;
while ((execMatch = execIntentRegex.exec(intentRegistryContent)) !== null) {
  allExecIntents.add(execMatch[1]);
}

const registeredIntentKeys = new Set(registeredHandlers.map(h => h.intent_key));
const missingInRegistry = Array.from(allExecIntents).filter(i => !registeredIntentKeys.has(i));
const extraInRegistry = Array.from(registeredIntentKeys).filter(i => !allExecIntents.has(i));

if (missingInRegistry.length > 0) {
  result.errors.push(`❌ Registry에 누락된 Intent: ${missingInRegistry.join(', ')}`);
}

if (extraInRegistry.length > 0) {
  result.warnings.push(`⚠️  Registry에 있지만 Intent Registry에 없는 Intent: ${extraInRegistry.join(', ')}`);
}

// 결과 출력
console.log('=== 검증 결과 ===\n');

if (result.errors.length === 0 && result.warnings.length === 0) {
  console.log('✅ 모든 검증 통과!\n');
} else {
  if (result.errors.length > 0) {
    console.log(`❌ 오류: ${result.errors.length}개\n`);
    result.errors.forEach(e => console.log(e));
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log(`⚠️  경고: ${result.warnings.length}개\n`);
    result.warnings.forEach(w => console.log(w));
    console.log('');
  }
}

// JSON 출력
console.log('\n=== JSON 출력 ===');
console.log(JSON.stringify({
  total: registeredHandlers.length,
  errors: result.errors.length,
  warnings: result.warnings.length,
  errors_detail: result.errors,
  warnings_detail: result.warnings,
  missingInRegistry,
  extraInRegistry,
}, null, 2));

// 종료 코드
process.exit(result.errors.length > 0 ? 1 : 0);

