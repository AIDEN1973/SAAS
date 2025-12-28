#!/usr/bin/env tsx
/**
 * Handler 실행 테스트 스크립트
 *
 * 모든 Handler가 올바르게 등록되어 있고 실행 가능한지 테스트합니다.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');
const INTENT_REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');

interface TestResult {
  intent_key: string;
  handlerExists: boolean;
  handlerRegistered: boolean;
  hasDomainActionKey: boolean;
  domainActionKey?: string;
  errors: string[];
}

const results: TestResult[] = [];

// Intent Registry에서 모든 exec 인텐트 추출
const intentRegistryContent = readFileSync(INTENT_REGISTRY_PATH, 'utf-8');
const execIntentRegex = /intent_key:\s*['"]([^'"]+\.exec\.[^'"]+)['"]/g;
const allExecIntents = new Set<string>();
let execMatch;
while ((execMatch = execIntentRegex.exec(intentRegistryContent)) !== null) {
  allExecIntents.add(execMatch[1]);
}

// Registry에서 Handler 확인
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');

// 각 Intent에 대해 테스트
for (const intentKey of allExecIntents) {
  const result: TestResult = {
    intent_key: intentKey,
    handlerExists: false,
    handlerRegistered: false,
    hasDomainActionKey: false,
    errors: [],
  };

  // Handler Registry에 등록되어 있는지 확인
  const handlerRegistered = registryContent.includes(`'${intentKey}':`);
  result.handlerRegistered = handlerRegistered;

  if (!handlerRegistered) {
    result.errors.push('Handler가 Registry에 등록되지 않음');
  }

  // Intent Registry에서 execution_class와 action_key 확인
  // 더 정확한 파싱: intent_key로 시작하는 블록 전체를 찾기
  const intentKeyEscaped = intentKey.replace(/\./g, '\\.');
  const intentKeyPattern = new RegExp(`'${intentKeyEscaped}':\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm');
  const intentBlockMatch = intentRegistryContent.match(intentKeyPattern);

  if (intentBlockMatch) {
    const intentBlock = intentBlockMatch[0];

    // execution_class 확인
    const executionClassMatch = intentBlock.match(/execution_class:\s*['"]([AB])['"]/);
    if (executionClassMatch && executionClassMatch[1] === 'B') {
      // L2-B인 경우 action_key 확인
      const actionKeyMatch = intentBlock.match(/action_key:\s*['"]([^'"]+)['"]/);
      if (actionKeyMatch) {
        result.hasDomainActionKey = true;
        result.domainActionKey = actionKeyMatch[1];
      } else {
        result.errors.push('L2-B인데 action_key가 없음');
      }
    }
  } else {
    // 대안: 단순 검색으로 확인
    const hasExecutionClassB = intentRegistryContent.includes(`'${intentKey}'`) &&
                                intentRegistryContent.includes(`execution_class: 'B'`) &&
                                intentRegistryContent.indexOf(`'${intentKey}'`) < intentRegistryContent.indexOf(`execution_class: 'B'`);
    if (hasExecutionClassB) {
      // action_key 검색
      const actionKeyPattern = new RegExp(`'${intentKeyEscaped}'[\\s\\S]{0,500}action_key:\\s*['"]([^'"]+)['"]`, 'm');
      const actionKeyMatch = intentRegistryContent.match(actionKeyPattern);
      if (actionKeyMatch) {
        result.hasDomainActionKey = true;
        result.domainActionKey = actionKeyMatch[1];
      } else {
        result.errors.push('L2-B인데 action_key가 없음');
      }
    }
  }

  results.push(result);
}

// 결과 출력
console.log('=== Handler 실행 테스트 결과 ===\n');

const passed = results.filter(r => r.errors.length === 0);
const failed = results.filter(r => r.errors.length > 0);

console.log(`📊 통계:`);
console.log(`  - 전체 Intent: ${results.length}개`);
console.log(`  - 통과: ${passed.length}개`);
console.log(`  - 실패: ${failed.length}개\n`);

if (failed.length > 0) {
  console.log(`❌ 실패한 Intent (${failed.length}개):\n`);
  failed.forEach(r => {
    console.log(`  - ${r.intent_key}`);
    r.errors.forEach(e => console.log(`    ❌ ${e}`));
  });
  console.log('');
}

// L2-B Intent의 Domain Action Key 확인
const l2bIntents = results.filter(r => r.hasDomainActionKey);
console.log(`📋 L2-B Intent: ${l2bIntents.length}개`);
l2bIntents.forEach(r => {
  console.log(`  - ${r.intent_key}: ${r.domainActionKey}`);
});

// JSON 출력
console.log('\n=== JSON 출력 ===');
console.log(JSON.stringify({
  total: results.length,
  passed: passed.length,
  failed: failed.length,
  results: results.map(r => ({
    intent_key: r.intent_key,
    handlerRegistered: r.handlerRegistered,
    hasDomainActionKey: r.hasDomainActionKey,
    domainActionKey: r.domainActionKey,
    errors: r.errors,
  })),
}, null, 2));

// 종료 코드
process.exit(failed.length > 0 ? 1 : 0);

