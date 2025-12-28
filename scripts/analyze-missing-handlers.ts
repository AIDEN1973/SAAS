#!/usr/bin/env tsx
/**
 * Handler Registry 누락 분석 스크립트
 *
 * 모든 exec 인텐트와 Handler Registry를 비교하여 누락된 Handler를 찾습니다.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const HANDLER_REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');
const DOMAIN_ACTION_CATALOG_PATH = join(process.cwd(), 'infra/supabase/functions/_shared/domain-action-catalog.ts');

// Intent Registry에서 모든 exec 인텐트 추출
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
const execIntents: Array<{
  intent_key: string;
  automation_level: string;
  execution_class?: string;
  action_key?: string;
}> = [];

const lines = registryContent.split('\n');
let currentIntent: any = null;
let inBlock = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Intent 키 찾기
  const keyMatch = line.match(/^\s+'([a-z_]+\.[a-z_]+\.[a-z_]+)':\s*\{/);
  if (keyMatch && keyMatch[1].includes('.exec.')) {
    inBlock = true;
    currentIntent = { intent_key: keyMatch[1] };
    braceCount = 1;
    continue;
  }

  if (inBlock && currentIntent) {
    // automation_level 찾기
    const levelMatch = line.match(/automation_level:\s*['"](L[012])['"]/);
    if (levelMatch) {
      currentIntent.automation_level = levelMatch[1];
    }

    // execution_class 찾기
    const execMatch = line.match(/execution_class:\s*['"]([AB])['"]/);
    if (execMatch) {
      currentIntent.execution_class = execMatch[1];
    }

    // action_key 찾기
    const actionMatch = line.match(/action_key:\s*['"]([^'"]+)['"]/);
    if (actionMatch) {
      currentIntent.action_key = actionMatch[1];
    }

    // 중괄호 카운트
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;

    // Intent 블록 종료
    if (braceCount === 0) {
      if (currentIntent.intent_key && currentIntent.automation_level === 'L2') {
        execIntents.push(currentIntent);
      }
      currentIntent = null;
      inBlock = false;
    }
  }
}

// Handler Registry에서 등록된 Handler 추출
const handlerRegistryContent = readFileSync(HANDLER_REGISTRY_PATH, 'utf-8');
const registeredHandlers = new Set<string>();
const handlerMatches = handlerRegistryContent.matchAll(/'([a-z_]+\.[a-z_]+\.[a-z_]+)':/g);
for (const match of handlerMatches) {
  if (match[1].includes('.exec.')) {
    registeredHandlers.add(match[1]);
  }
}

// Domain Action Catalog 추출
const catalogContent = readFileSync(DOMAIN_ACTION_CATALOG_PATH, 'utf-8');
const catalogActions = new Set<string>();
const catalogMatches = catalogContent.matchAll(/'([a-z_]+\.[a-z_]+)'/g);
for (const match of catalogMatches) {
  catalogActions.add(match[1]);
}

// 분석 결과
console.log('=== Handler Registry 분석 결과 ===\n');
console.log(`전체 L2 exec 인텐트: ${execIntents.length}개`);
console.log(`등록된 Handler: ${registeredHandlers.size}개`);
console.log(`누락된 Handler: ${execIntents.length - registeredHandlers.size}개\n`);

// L2-A vs L2-B 분류
const l2aIntents = execIntents.filter(i => i.execution_class === 'A');
const l2bIntents = execIntents.filter(i => i.execution_class === 'B');

console.log(`L2-A 인텐트: ${l2aIntents.length}개`);
console.log(`L2-B 인텐트: ${l2bIntents.length}개\n`);

// 누락된 Handler 목록
const missingHandlers = execIntents.filter(i => !registeredHandlers.has(i.intent_key));

console.log('=== 누락된 Handler 목록 ===\n');
missingHandlers.forEach(intent => {
  const isL2B = intent.execution_class === 'B';
  const hasActionKey = intent.action_key && catalogActions.has(intent.action_key);
  const status = isL2B
    ? (hasActionKey ? '✅ Domain Action Catalog 등록됨' : '❌ Domain Action Catalog 미등록')
    : 'L2-A';
  console.log(`${intent.intent_key} (${intent.execution_class || 'N/A'}) - ${status}`);
  if (isL2B && intent.action_key) {
    console.log(`  action_key: ${intent.action_key}`);
  }
});

// L2-B 인텐트의 Domain Action Catalog 확인
console.log('\n=== L2-B 인텐트 Domain Action Catalog 확인 ===\n');
l2bIntents.forEach(intent => {
  if (intent.action_key) {
    const inCatalog = catalogActions.has(intent.action_key);
    console.log(`${intent.intent_key}: ${intent.action_key} - ${inCatalog ? '✅' : '❌'}`);
  } else {
    console.log(`${intent.intent_key}: action_key 없음 - ❌`);
  }
});

// JSON 출력 (자동화용)
const result = {
  total: execIntents.length,
  registered: registeredHandlers.size,
  missing: missingHandlers.length,
  missingHandlers: missingHandlers.map(i => ({
    intent_key: i.intent_key,
    execution_class: i.execution_class,
    action_key: i.action_key,
    inDomainActionCatalog: i.action_key ? catalogActions.has(i.action_key) : null,
  })),
  l2bWithoutActionKey: l2bIntents.filter(i => !i.action_key).map(i => i.intent_key),
  l2bNotInCatalog: l2bIntents.filter(i => i.action_key && !catalogActions.has(i.action_key)).map(i => ({
    intent_key: i.intent_key,
    action_key: i.action_key,
  })),
};

console.log('\n=== JSON 출력 (자동화용) ===');
console.log(JSON.stringify(result, null, 2));

