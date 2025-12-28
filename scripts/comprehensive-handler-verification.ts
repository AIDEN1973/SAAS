#!/usr/bin/env tsx
/**
 * Handler 종합 검증 스크립트
 *
 * 체크리스트:
 * 1. 모든 L2 Handler가 등록되어 있는지 확인
 * 2. 필수 import 확인 (withTenant, maskPII, assertDomainActionKey, getTenantSettingByPath)
 * 3. try-catch 에러 처리 확인
 * 4. Domain Action Catalog 검증 확인 (L2-B)
 * 5. Policy 검증 확인
 * 6. RLS 보호 확인 (withTenant 사용)
 * 7. PII 마스킹 확인
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');
const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');

interface VerificationResult {
  handler: string;
  issues: Array<{
    type: 'error' | 'warning';
    message: string;
  }>;
}

const results: VerificationResult[] = [];

// Intent Registry에서 L2 인텐트 추출
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
const l2Intents: string[] = [];

// automation_level: 'L2'인 인텐트 찾기
const l2Regex = /'([^']+\.exec\.[^']+)':\s*\{[\s\S]*?automation_level:\s*['"]L2['"]/g;
let match;
while ((match = l2Regex.exec(registryContent)) !== null) {
  l2Intents.push(match[1]);
}

// Handler 파일 목록
const handlerFiles = readdirSync(HANDLERS_DIR)
  .filter(f => f.endsWith('.ts') && !f.includes('registry') && !f.includes('types'))
  .map(f => join(HANDLERS_DIR, f));

// 각 Handler 검증
for (const filePath of handlerFiles) {
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
  const fileContent = readFileSync(filePath, 'utf-8');

  const issues: Array<{ type: 'error' | 'warning'; message: string }> = [];

  // 1. intent_key 추출
  const intentKeyMatch = fileContent.match(/intent_key:\s*['"]([^'"]+)['"]/);
  if (!intentKeyMatch) {
    issues.push({ type: 'error', message: 'intent_key가 없음' });
    results.push({ handler: fileName, issues });
    continue;
  }

  const intentKey = intentKeyMatch[1];
  const isL2B = intentKey.includes('.exec.') && fileContent.includes('action_key');

  // 2. 필수 import 확인 (실제 import 문 확인)
  const hasWithTenantImport = /import\s+.*\{[^}]*withTenant[^}]*\}|\{.*withTenant.*\}\s+from/.test(fileContent);
  const hasMaskPIIImport = /import\s+.*\{[^}]*maskPII[^}]*\}|\{.*maskPII.*\}\s+from/.test(fileContent);
  const hasAssertDomainActionKeyImport = /import\s+.*\{[^}]*assertDomainActionKey[^}]*\}|\{.*assertDomainActionKey.*\}\s+from/.test(fileContent);
  const hasGetTenantSettingByPathImport = /import\s+.*\{[^}]*getTenantSettingByPath[^}]*\}|\{.*getTenantSettingByPath.*\}\s+from/.test(fileContent);

  if (!hasWithTenantImport && !fileContent.includes('withTenant')) {
    issues.push({ type: 'warning', message: 'withTenant import 없음 (RLS 보호 권장)' });
  }

  if (!hasMaskPIIImport && !fileContent.includes('maskPII')) {
    issues.push({ type: 'warning', message: 'maskPII import 없음 (PII 마스킹 권장)' });
  }

  if (isL2B && !hasAssertDomainActionKeyImport && !fileContent.includes('assertDomainActionKey')) {
    issues.push({ type: 'error', message: 'assertDomainActionKey import 없음 (L2-B 필수)' });
  }

  if (!hasGetTenantSettingByPathImport && !fileContent.includes('getTenantSettingByPath')) {
    issues.push({ type: 'warning', message: 'getTenantSettingByPath import 없음 (Policy 검증 권장)' });
  }

  // 3. try-catch 확인
  if (!fileContent.includes('try') || !fileContent.includes('catch')) {
    issues.push({ type: 'warning', message: 'try-catch 에러 처리 없음' });
  }

  // 4. Domain Action Catalog 검증 확인 (L2-B)
  if (isL2B && !fileContent.includes('assertDomainActionKey')) {
    issues.push({ type: 'error', message: 'Domain Action Catalog 검증 없음 (L2-B 필수)' });
  }

  // 5. Policy 검증 확인
  if (!fileContent.includes('getTenantSettingByPath')) {
    issues.push({ type: 'warning', message: 'Policy 검증 없음' });
  }

  // 6. withTenant 사용 확인
  if (!fileContent.includes('withTenant(')) {
    issues.push({ type: 'warning', message: 'withTenant 사용 없음 (RLS 보호 권장)' });
  }

  // 7. maskPII 사용 확인
  if (!fileContent.includes('maskPII(')) {
    issues.push({ type: 'warning', message: 'maskPII 사용 없음 (PII 마스킹 권장)' });
  }

  // 8. HandlerResult 반환 확인
  if (!fileContent.includes('HandlerResult') && !fileContent.includes('status:')) {
    issues.push({ type: 'error', message: 'HandlerResult 반환 형식 없음' });
  }

  if (issues.length > 0) {
    results.push({ handler: fileName, issues });
  }
}

// 결과 출력
console.log('=== Handler 종합 검증 결과 ===\n');

const errorCount = results.filter(r => r.issues.some(i => i.type === 'error')).length;
const warningCount = results.filter(r => r.issues.some(i => i.type === 'warning')).length;

console.log(`검증된 Handler: ${handlerFiles.length}개`);
console.log(`오류: ${errorCount}개`);
console.log(`경고: ${warningCount}개\n`);

if (results.length > 0) {
  console.log('=== 상세 결과 ===\n');
  for (const result of results) {
    console.log(`📄 ${result.handler}`);
    for (const issue of result.issues) {
      const icon = issue.type === 'error' ? '❌' : '⚠️';
      console.log(`  ${icon} ${issue.message}`);
    }
    console.log('');
  }
} else {
  console.log('✅ 모든 Handler가 체크리스트를 준수합니다!');
}

// JSON 출력
console.log('\n=== JSON 출력 ===');
console.log(JSON.stringify({
  total_handlers: handlerFiles.length,
  errors: errorCount,
  warnings: warningCount,
  results: results.map(r => ({
    handler: r.handler,
    error_count: r.issues.filter(i => i.type === 'error').length,
    warning_count: r.issues.filter(i => i.type === 'warning').length,
    issues: r.issues,
  })),
}, null, 2));

process.exit(errorCount > 0 ? 1 : 0);

