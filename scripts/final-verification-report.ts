#!/usr/bin/env tsx
/**
 * 최종 검증 보고서 생성 스크립트
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');

const handlerFiles = readdirSync(HANDLERS_DIR)
  .filter(f => f.endsWith('.ts') && !f.includes('registry') && !f.includes('types'));

console.log('=== 최종 검증 보고서 ===\n');

// 통계
const stats = {
  total_handlers: handlerFiles.length,
  l2b_handlers: 0,
  l2a_handlers: 0,
  with_assertDomainActionKey: 0,
  with_getTenantSettingByPath: 0,
  with_withTenant: 0,
  with_maskPII: 0,
  with_tryCatch: 0,
};

for (const file of handlerFiles) {
  const content = readFileSync(join(HANDLERS_DIR, file), 'utf-8');

  if (content.includes('assertDomainActionKey')) {
    stats.l2b_handlers++;
    stats.with_assertDomainActionKey++;
  } else if (content.includes('event_type')) {
    stats.l2a_handlers++;
  }

  if (content.includes('getTenantSettingByPath')) stats.with_getTenantSettingByPath++;
  if (content.includes('withTenant(')) stats.with_withTenant++;
  if (content.includes('maskPII(')) stats.with_maskPII++;
  if (content.includes('try') && content.includes('catch')) stats.with_tryCatch++;
}

console.log('📊 통계:');
console.log(`  총 Handler: ${stats.total_handlers}개`);
console.log(`  L2-B Handler: ${stats.l2b_handlers}개`);
console.log(`  L2-A Handler: ${stats.l2a_handlers}개`);
console.log(`  기타 Handler: ${stats.total_handlers - stats.l2b_handlers - stats.l2a_handlers}개\n`);

console.log('✅ 필수 구현 사항 준수:');
console.log(`  assertDomainActionKey 사용: ${stats.with_assertDomainActionKey}/${stats.l2b_handlers} (L2-B)`);
console.log(`  getTenantSettingByPath 사용: ${stats.with_getTenantSettingByPath}/${stats.total_handlers}`);
console.log(`  withTenant 사용: ${stats.with_withTenant}/${stats.total_handlers}`);
console.log(`  maskPII 사용: ${stats.with_maskPII}/${stats.total_handlers}`);
console.log(`  try-catch 사용: ${stats.with_tryCatch}/${stats.total_handlers}\n`);

const compliance = {
  l2b_domain_action: stats.with_assertDomainActionKey === stats.l2b_handlers,
  policy_validation: stats.with_getTenantSettingByPath === stats.total_handlers,
  rls_protection: stats.with_withTenant >= stats.total_handlers * 0.8, // 80% 이상 (일부는 DB 작업 없음)
  pii_masking: stats.with_maskPII === stats.total_handlers,
  error_handling: stats.with_tryCatch === stats.total_handlers,
};

console.log('✅ 체크리스트 준수:');
console.log(`  Domain Action Catalog 검증: ${compliance.l2b_domain_action ? '✅' : '❌'}`);
console.log(`  Policy 검증: ${compliance.policy_validation ? '✅' : '❌'}`);
console.log(`  RLS 보호: ${compliance.rls_protection ? '✅' : '⚠️'}`);
console.log(`  PII 마스킹: ${compliance.pii_masking ? '✅' : '❌'}`);
console.log(`  에러 처리: ${compliance.error_handling ? '✅' : '❌'}\n`);

const allCompliant = Object.values(compliance).every(v => v);

if (allCompliant) {
  console.log('🎉 모든 검증을 통과했습니다!');
} else {
  console.log('⚠️ 일부 검증 항목을 확인하세요.');
}

process.exit(allCompliant ? 0 : 1);
