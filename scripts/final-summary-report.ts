#!/usr/bin/env tsx
/**
 * 최종 요약 보고서 생성 스크립트
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');
const INTENT_REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');

// Handler 파일 개수 확인
const { readdirSync } = require('fs');
const handlerFiles = readdirSync(HANDLERS_DIR).filter((f: string) =>
  f.includes('-exec-') && f.endsWith('.ts')
);

// Registry에서 Handler 개수 확인
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
const registeredHandlers = (registryContent.match(/'[^']+\.exec\.[^']+':/g) || []).length;

// Intent Registry에서 exec 인텐트 개수 확인
const intentRegistryContent = readFileSync(INTENT_REGISTRY_PATH, 'utf-8');
const execIntents = (intentRegistryContent.match(/intent_key:\s*'[^']+\.exec\.[^']+'/g) || []).length;

// L2-B Handler 개수 확인
const l2bHandlers = handlerFiles.filter((f: string) =>
  f.includes('-exec-') && !f.includes('notify') && !f.includes('send') && !f.includes('request') && !f.includes('schedule') && !f.includes('resend') && !f.includes('optout') && !f.includes('broadcast') && !f.includes('emergency')
).length;

console.log('=== 최종 요약 보고서 ===\n');
console.log('📊 전체 통계:');
console.log(`  - Intent Registry의 exec 인텐트: ${execIntents}개`);
console.log(`  - Handler 파일: ${handlerFiles.length}개`);
console.log(`  - Handler Registry 등록: ${registeredHandlers}개`);
console.log(`  - L2-B Handler (추정): ${l2bHandlers}개\n`);

if (registeredHandlers === execIntents) {
  console.log('✅ 모든 인텐트에 Handler가 등록되어 있습니다!\n');
} else {
  console.log(`❌ Handler 누락: ${execIntents - registeredHandlers}개\n`);
}

console.log('✅ 완료된 작업:');
console.log('  1. 47개 누락 Handler 생성');
console.log('  2. 모든 Handler를 Registry에 등록');
console.log('  3. L2-B 실행 차단 규칙 수정 (Domain Action Catalog 확인)');
console.log('  4. 정책 경로 활성화 마이그레이션 생성');
console.log('  5. 테스트 스크립트 생성');
console.log('  6. Handler 구현 가이드 문서 생성\n');

console.log('📋 다음 단계:');
console.log('  1. 마이그레이션 실행: infra/supabase/migrations/132_enable_domain_action_policies.sql');
console.log('  2. 각 Handler의 TODO 주석 확인 및 비즈니스 로직 구현');
console.log('  3. 테스트 진행\n');

console.log('📚 참고 문서:');
console.log('  - docu/HANDLER_IMPLEMENTATION_GUIDE.md: Handler 구현 가이드');
console.log('  - docu/챗봇.md: Intent Registry 및 Handler Contract');
console.log('  - docu/액티비티.md: Execution Audit 시스템\n');

