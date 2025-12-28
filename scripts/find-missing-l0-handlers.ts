#!/usr/bin/env tsx
/**
 * 누락된 L0 Handler 찾기
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const INTENT_REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const L0_HANDLERS_PATH = join(process.cwd(), 'infra/supabase/functions/_shared/l0-handlers.ts');

const intentRegistryContent = readFileSync(INTENT_REGISTRY_PATH, 'utf-8');
const l0HandlersContent = readFileSync(L0_HANDLERS_PATH, 'utf-8');

// L0 인텐트 추출
const l0Intents: string[] = [];
const intentKeyRegex = /intent_key:\s*['"]([^'"]+)['"]/g;
const allIntents: Array<{ key: string; level: string }> = [];
let match;

// 모든 인텐트 추출
while ((match = intentKeyRegex.exec(intentRegistryContent)) !== null) {
  const intentKey = match[1];
  const pos = match.index;

  // 해당 intent_key 블록 찾기
  const blockStart = intentRegistryContent.lastIndexOf("'", pos - 1);
  const blockEnd = intentRegistryContent.indexOf('},', pos);
  if (blockEnd === -1) continue;

  const block = intentRegistryContent.substring(blockStart, blockEnd);

  // automation_level 추출
  const levelMatch = block.match(/automation_level:\s*['"](L[012])['"]/);
  if (levelMatch) {
    allIntents.push({ key: intentKey, level: levelMatch[1] });
    if (levelMatch[1] === 'L0') {
      l0Intents.push(intentKey);
    }
  }
}

console.log(`📋 L0 인텐트: ${l0Intents.length}개\n`);

// L0 Handler Registry에서 등록된 Handler 추출
const handlerRegistryPattern = /['"]([^'"]+)['"]:\s*\w+Handler/g;
const registeredHandlers = new Set<string>();
let handlerMatch;

while ((handlerMatch = handlerRegistryPattern.exec(l0HandlersContent)) !== null) {
  registeredHandlers.add(handlerMatch[1]);
}

console.log(`✅ 등록된 L0 Handler: ${registeredHandlers.size}개\n`);

// 누락된 Handler 찾기
const missingHandlers = l0Intents.filter(intent => !registeredHandlers.has(intent));

if (missingHandlers.length > 0) {
  console.log(`❌ 누락된 L0 Handler (${missingHandlers.length}개):\n`);
  missingHandlers.forEach(intent => {
    console.log(`  - ${intent}`);
  });
} else {
  console.log('✅ 모든 L0 인텐트에 Handler가 등록되어 있습니다!');
}

// 상세 비교
console.log('\n=== 상세 비교 ===\n');
console.log('L0 인텐트 목록:');
l0Intents.sort().forEach(intent => {
  const hasHandler = registeredHandlers.has(intent);
  console.log(`  ${hasHandler ? '✅' : '❌'} ${intent}`);
});

