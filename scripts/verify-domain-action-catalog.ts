#!/usr/bin/env tsx
/**
 * Domain Action Catalog 검증 스크립트
 *
 * 1. 모든 L2-B Intent에 action_key가 있는지 확인
 * 2. action_key가 Domain Action Catalog에 등록되어 있는지 확인
 * 3. Domain Action Catalog와 Registry 간 일관성 확인
 * 4. 중복/누락 검증
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const CATALOG_PATH = join(process.cwd(), 'packages/core/core-automation/src/domain-action-catalog.ts');

const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
const catalogContent = readFileSync(CATALOG_PATH, 'utf-8');

// Domain Action Catalog에서 action_key 추출
const catalogMatch = catalogContent.match(/export const DOMAIN_ACTION_CATALOG = \[([\s\S]*?)\]/);
if (!catalogMatch) {
  console.error('❌ Domain Action Catalog를 찾을 수 없습니다.');
  process.exit(1);
}

const catalogItems = catalogMatch[1]
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.startsWith("'") && line.endsWith("',"))
  .map(line => line.replace(/^'|',$/g, ''))
  .filter(Boolean);

console.log(`📋 Domain Action Catalog: ${catalogItems.length}개 항목\n`);

// Registry에서 L2-B Intent와 action_key 추출
const l2bIntents: Array<{ intent_key: string; action_key?: string }> = [];
const lines = registryContent.split('\n');

let currentIntent: { intent_key?: string; execution_class?: string; action_key?: string } | null = null;
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

    // execution_class 추출
    const execMatch = line.match(/execution_class:\s*'([^']+)'/);
    if (execMatch) {
      currentIntent.execution_class = execMatch[1];
    }

    // action_key 추출
    const actionMatch = line.match(/action_key:\s*'([^']+)'/);
    if (actionMatch) {
      currentIntent.action_key = actionMatch[1];
    }

    // Intent 블록 종료
    if (braceCount === 0) {
      if (currentIntent.execution_class === 'B') {
        l2bIntents.push({
          intent_key: currentIntent.intent_key!,
          action_key: currentIntent.action_key,
        });
      }
      currentIntent = null;
      inBlock = false;
    }
  }
}

console.log(`📋 L2-B Intent: ${l2bIntents.length}개\n`);

// 검증
const errors: string[] = [];
const warnings: string[] = [];

// 1. action_key 누락 확인
const missingActionKey = l2bIntents.filter(i => !i.action_key);
if (missingActionKey.length > 0) {
  errors.push(`❌ action_key 누락 (${missingActionKey.length}개):`);
  missingActionKey.forEach(i => {
    errors.push(`   - ${i.intent_key}`);
  });
}

// 2. action_key가 Catalog에 있는지 확인
const actionKeysInRegistry = l2bIntents
  .filter(i => i.action_key)
  .map(i => i.action_key!);

const missingInCatalog = actionKeysInRegistry.filter(key => !catalogItems.includes(key));
if (missingInCatalog.length > 0) {
  errors.push(`\n❌ Catalog에 없는 action_key (${missingInCatalog.length}개):`);
  missingInCatalog.forEach(key => {
    const intent = l2bIntents.find(i => i.action_key === key);
    errors.push(`   - ${key} (${intent?.intent_key})`);
  });
}

// 3. Catalog에 있지만 Registry에 없는 action_key 확인
const unusedInCatalog = catalogItems.filter(key => !actionKeysInRegistry.includes(key));
if (unusedInCatalog.length > 0) {
  warnings.push(`\n⚠️  Catalog에 있지만 사용되지 않는 action_key (${unusedInCatalog.length}개):`);
  unusedInCatalog.forEach(key => {
    warnings.push(`   - ${key}`);
  });
}

// 4. 중복 action_key 확인
const actionKeyCounts = new Map<string, number>();
actionKeysInRegistry.forEach(key => {
  actionKeyCounts.set(key, (actionKeyCounts.get(key) || 0) + 1);
});

const duplicates = Array.from(actionKeyCounts.entries())
  .filter(([_, count]) => count > 1);
if (duplicates.length > 0) {
  errors.push(`\n❌ 중복된 action_key (${duplicates.length}개):`);
  duplicates.forEach(([key, count]) => {
    const intents = l2bIntents.filter(i => i.action_key === key);
    errors.push(`   - ${key} (${count}번 사용):`);
    intents.forEach(i => {
      errors.push(`     * ${i.intent_key}`);
    });
  });
}

// 5. intent_key에서 action_key 추론 가능한지 확인
const intentToActionKeyMap = new Map<string, string>();
l2bIntents.forEach(i => {
  if (i.action_key) {
    intentToActionKeyMap.set(i.intent_key, i.action_key);
  }
});

// 결과 출력
if (errors.length > 0) {
  console.error('❌ 검증 실패:\n');
  errors.forEach(e => console.error(e));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️  경고:\n');
  warnings.forEach(w => console.warn(w));
}

console.log('✅ 모든 검증 통과!\n');
console.log(`📊 통계:`);
console.log(`   - Domain Action Catalog: ${catalogItems.length}개`);
console.log(`   - L2-B Intent: ${l2bIntents.length}개`);
console.log(`   - action_key 매핑: ${actionKeysInRegistry.length}개`);
console.log(`   - 사용되지 않는 action_key: ${unusedInCatalog.length}개`);

