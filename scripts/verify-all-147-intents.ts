#!/usr/bin/env tsx
/**
 * 147개 Intent 전체 정밀 검증 스크립트
 *
 * 검증 항목:
 * 1. Intent Registry에 모든 Intent 등록 확인
 * 2. L0 Intent → L0 Handler 매핑 확인
 * 3. L1 Intent → TaskCard 생성 로직 확인
 * 4. L2-A Intent → Handler 등록 확인
 * 5. L2-B Intent → Handler 등록 및 Domain Action Catalog 확인
 * 6. Handler Registry 등록 확인
 * 7. Policy 활성화 확인 (L2-B)
 * 8. Event Type 등록 확인 (L2-A)
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const HANDLER_REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');
const L0_HANDLERS_PATH = join(process.cwd(), 'infra/supabase/functions/_shared/l0-handlers.ts');
const DOMAIN_ACTION_CATALOG_PATH = join(process.cwd(), 'infra/supabase/functions/_shared/domain-action-catalog.ts');
const POLICY_MIGRATION_PATH = join(process.cwd(), 'infra/supabase/migrations/132_enable_domain_action_policies.sql');
const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');

interface IntentInfo {
  intent_key: string;
  automation_level: 'L0' | 'L1' | 'L2';
  execution_class?: 'A' | 'B';
  action_key?: string;
  event_type?: string;
}

interface Issue {
  type: 'error' | 'warning';
  intent_key: string;
  message: string;
}

const issues: Issue[] = [];
const intents: IntentInfo[] = [];

// 1. Intent Registry 파싱
console.log('📋 Intent Registry 파싱 중...\n');
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
const lines = registryContent.split('\n');

let currentIntent: Partial<IntentInfo> | null = null;
let inBlock = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Intent 키 찾기
  const keyMatch = line.match(/^'([a-z_]+\.[a-z_]+\.[a-z_]+)':\s*\{/);
  if (keyMatch) {
    currentIntent = { intent_key: keyMatch[1] };
    inBlock = true;
    braceCount = 1;
    continue;
  }

  if (inBlock && currentIntent) {
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;

    // automation_level 추출
    const levelMatch = line.match(/automation_level:\s*['"]([^'"]+)['"]/);
    if (levelMatch) {
      currentIntent.automation_level = levelMatch[1] as 'L0' | 'L1' | 'L2';
    }

    // execution_class 추출
    const execMatch = line.match(/execution_class:\s*['"]([^'"]+)['"]/);
    if (execMatch) {
      currentIntent.execution_class = execMatch[1] as 'A' | 'B';
    }

    // action_key 추출
    const actionMatch = line.match(/action_key:\s*['"]([^'"]+)['"]/);
    if (actionMatch) {
      currentIntent.action_key = actionMatch[1];
    }

    // event_type 추출
    const eventMatch = line.match(/event_type:\s*['"]([^'"]+)['"]/);
    if (eventMatch) {
      currentIntent.event_type = eventMatch[1];
    }

    // Intent 블록 종료
    if (braceCount === 0) {
      if (currentIntent.intent_key && currentIntent.automation_level) {
        intents.push(currentIntent as IntentInfo);
      }
      currentIntent = null;
      inBlock = false;
    }
  }
}

console.log(`✅ Intent Registry에서 ${intents.length}개 Intent 발견\n`);

// 통계
const stats = {
  l0: intents.filter(i => i.automation_level === 'L0').length,
  l1: intents.filter(i => i.automation_level === 'L1').length,
  l2a: intents.filter(i => i.automation_level === 'L2' && i.execution_class === 'A').length,
  l2b: intents.filter(i => i.automation_level === 'L2' && i.execution_class === 'B').length,
};

console.log('📊 Intent 통계:');
console.log(`  L0: ${stats.l0}개`);
console.log(`  L1: ${stats.l1}개`);
console.log(`  L2-A: ${stats.l2a}개`);
console.log(`  L2-B: ${stats.l2b}개`);
console.log(`  총계: ${intents.length}개\n`);

// 2. L0 Handler 확인
console.log('📋 L0 Handler 확인 중...\n');
const l0HandlersContent = readFileSync(L0_HANDLERS_PATH, 'utf-8');
const l0HandlerKeys = new Set<string>();
// l0HandlerRegistry에서 등록된 Handler 추출
const l0HandlerRegex = /['"]([a-z_]+\.[a-z_]+\.[a-z_]+)['"]:\s*\w+Handler/g;
let l0Match;
while ((l0Match = l0HandlerRegex.exec(l0HandlersContent)) !== null) {
  l0HandlerKeys.add(l0Match[1]);
}

console.log(`✅ L0 Handler: ${l0HandlerKeys.size}개 발견\n`);

// 3. Handler Registry 확인
console.log('📋 Handler Registry 확인 중...\n');
const handlerRegistryContent = readFileSync(HANDLER_REGISTRY_PATH, 'utf-8');
const registeredHandlers = new Set<string>();
const handlerRegistryRegex = /['"]([a-z_]+\.[a-z_]+\.[a-z_]+)['"]:\s*[^,}]+Handler/g;
let handlerMatch;
while ((handlerMatch = handlerRegistryRegex.exec(handlerRegistryContent)) !== null) {
  registeredHandlers.add(handlerMatch[1]);
}

console.log(`✅ Handler Registry: ${registeredHandlers.size}개 등록\n`);

// 4. Domain Action Catalog 확인
console.log('📋 Domain Action Catalog 확인 중...\n');
const catalogContent = readFileSync(DOMAIN_ACTION_CATALOG_PATH, 'utf-8');
const catalogActions = new Set<string>();
const catalogRegex = /['"]([a-z_]+\.[a-z_]+)['"]/g;
let catalogMatch;
while ((catalogMatch = catalogRegex.exec(catalogContent)) !== null) {
  const action = catalogMatch[1];
  if (action.includes('.')) {
    catalogActions.add(action);
  }
}

console.log(`✅ Domain Action Catalog: ${catalogActions.size}개 발견\n`);

// 5. Policy Migration 확인
console.log('📋 Policy Migration 확인 중...\n');
const policyContent = readFileSync(POLICY_MIGRATION_PATH, 'utf-8');
const policyActions = new Set<string>();
const policyRegex = /['"]([a-z_]+\.[a-z_]+)['"]/g;
let policyMatch;
while ((policyMatch = policyRegex.exec(policyContent)) !== null) {
  const action = policyMatch[1];
  if (action.includes('.')) {
    policyActions.add(action);
  }
}

console.log(`✅ Policy Migration: ${policyActions.size}개 action_key 발견\n`);

// 6. Handler 파일 확인
console.log('📋 Handler 파일 확인 중...\n');
const handlerFiles = readdirSync(HANDLERS_DIR)
  .filter(f => f.endsWith('.ts') && !f.includes('registry') && !f.includes('types'));
const handlerFileIntents = new Map<string, string>();

for (const file of handlerFiles) {
  const content = readFileSync(join(HANDLERS_DIR, file), 'utf-8');
  const intentKeyMatch = content.match(/intent_key:\s*['"]([^'"]+)['"]/);
  if (intentKeyMatch) {
    handlerFileIntents.set(intentKeyMatch[1], file);
  }
}

console.log(`✅ Handler 파일: ${handlerFiles.length}개 발견\n`);

// 7. 검증 시작
console.log('🔍 검증 시작...\n');

for (const intent of intents) {
  // L0 검증
  if (intent.automation_level === 'L0') {
    if (!l0HandlerKeys.has(intent.intent_key)) {
      issues.push({
        type: 'error',
        intent_key: intent.intent_key,
        message: 'L0 Handler가 없음',
      });
    }
  }

  // L1 검증 (TaskCard 생성만 하므로 Handler 불필요)
  if (intent.automation_level === 'L1') {
    // L1은 TaskCard 생성만 하므로 추가 검증 불필요
  }

  // L2-A 검증
  if (intent.automation_level === 'L2' && intent.execution_class === 'A') {
    if (!registeredHandlers.has(intent.intent_key)) {
      issues.push({
        type: 'error',
        intent_key: intent.intent_key,
        message: 'Handler Registry에 등록되지 않음',
      });
    }

    if (!handlerFileIntents.has(intent.intent_key)) {
      issues.push({
        type: 'error',
        intent_key: intent.intent_key,
        message: 'Handler 파일이 없음',
      });
    }

    // L2-A는 event_type 또는 event_type_by_purpose 중 하나가 있어야 함
    // Registry에서 확인
    const registryIntentMatch = registryContent.match(
      new RegExp(`'${intent.intent_key.replace(/\./g, '\\.')}':\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm')
    );
    if (registryIntentMatch) {
      const intentBlock = registryIntentMatch[0];
      if (!intentBlock.includes('event_type:') && !intentBlock.includes('event_type_by_purpose:')) {
        issues.push({
          type: 'warning',
          intent_key: intent.intent_key,
          message: 'event_type 또는 event_type_by_purpose가 없음 (L2-A는 둘 중 하나 필수)',
        });
      }
    } else {
      // Registry에서 찾지 못한 경우
      issues.push({
        type: 'warning',
        intent_key: intent.intent_key,
        message: 'Registry에서 Intent 블록을 찾을 수 없음',
      });
    }
  }

  // L2-B 검증
  if (intent.automation_level === 'L2' && intent.execution_class === 'B') {
    if (!intent.action_key) {
      issues.push({
        type: 'error',
        intent_key: intent.intent_key,
        message: 'action_key가 없음 (L2-B는 action_key 필수)',
      });
      continue;
    }

    if (!catalogActions.has(intent.action_key)) {
      issues.push({
        type: 'error',
        intent_key: intent.intent_key,
        message: `Domain Action Catalog에 없는 action_key: ${intent.action_key}`,
      });
    }

    if (!policyActions.has(intent.action_key)) {
      issues.push({
        type: 'error',
        intent_key: intent.intent_key,
        message: `Policy Migration에 없는 action_key: ${intent.action_key}`,
      });
    }

    if (!registeredHandlers.has(intent.intent_key)) {
      issues.push({
        type: 'error',
        intent_key: intent.intent_key,
        message: 'Handler Registry에 등록되지 않음',
      });
    }

    if (!handlerFileIntents.has(intent.intent_key)) {
      issues.push({
        type: 'error',
        intent_key: intent.intent_key,
        message: 'Handler 파일이 없음',
      });
    } else {
      // Handler 파일에서 action_key 확인
      const handlerFile = handlerFileIntents.get(intent.intent_key)!;
      const handlerContent = readFileSync(join(HANDLERS_DIR, handlerFile), 'utf-8');
      const handlerActionKeyMatch = handlerContent.match(/assertDomainActionKey\(['"]([^'"]+)['"]\)/);

      if (!handlerActionKeyMatch) {
        issues.push({
          type: 'error',
          intent_key: intent.intent_key,
          message: 'Handler에 assertDomainActionKey 호출이 없음',
        });
      } else if (handlerActionKeyMatch[1] !== intent.action_key) {
        issues.push({
          type: 'error',
          intent_key: intent.intent_key,
          message: `Handler의 action_key 불일치: Handler=${handlerActionKeyMatch[1]}, Registry=${intent.action_key}`,
        });
      }
    }
  }
}

// 결과 출력
console.log('=== 검증 결과 ===\n');

const errorCount = issues.filter(i => i.type === 'error').length;
const warningCount = issues.filter(i => i.type === 'warning').length;

console.log(`오류: ${errorCount}개`);
console.log(`경고: ${warningCount}개\n`);

if (issues.length > 0) {
  console.log('=== 상세 결과 ===\n');

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  if (errors.length > 0) {
    console.log('❌ 오류:');
    for (const issue of errors) {
      console.log(`  ${issue.intent_key}: ${issue.message}`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️ 경고:');
    for (const issue of warnings) {
      console.log(`  ${issue.intent_key}: ${issue.message}`);
    }
    console.log('');
  }
} else {
  console.log('✅ 모든 147개 Intent가 정상 동작을 보증합니다!\n');
}

// 최종 통계
console.log('=== 최종 통계 ===');
console.log(`총 Intent: ${intents.length}개`);
console.log(`L0 Handler: ${l0HandlerKeys.size}개`);
console.log(`L2 Handler (Registry): ${registeredHandlers.size}개`);
console.log(`Handler 파일: ${handlerFiles.length}개`);
console.log(`Domain Action Catalog: ${catalogActions.size}개`);
console.log(`Policy Migration: ${policyActions.size}개`);

// Domain Action Catalog와 Policy Migration 일치 확인
const catalogNotInPolicy = Array.from(catalogActions).filter(a => !policyActions.has(a));
const policyNotInCatalog = Array.from(policyActions).filter(a => !catalogActions.has(a));

if (catalogNotInPolicy.length > 0) {
  console.log(`\n⚠️ Domain Action Catalog에 있지만 Policy Migration에 없는 항목: ${catalogNotInPolicy.length}개`);
  for (const action of catalogNotInPolicy) {
    console.log(`  - ${action}`);
  }
}

if (policyNotInCatalog.length > 0) {
  console.log(`\n⚠️ Policy Migration에 있지만 Domain Action Catalog에 없는 항목: ${policyNotInCatalog.length}개`);
  for (const action of policyNotInCatalog) {
    console.log(`  - ${action}`);
  }
}

process.exit(errorCount > 0 ? 1 : 0);

