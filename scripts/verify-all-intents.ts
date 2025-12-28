#!/usr/bin/env tsx
/**
 * 전체 인텐트 검증 스크립트
 *
 * 147개 전체 인텐트가 모두 작동하는지 검증합니다.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const INTENT_REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const HANDLER_REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');
const L0_HANDLERS_PATH = join(process.cwd(), 'infra/supabase/functions/_shared/l0-handlers.ts');

interface IntentInfo {
  intent_key: string;
  automation_level: 'L0' | 'L1' | 'L2';
  execution_class?: 'A' | 'B';
  action_key?: string;
  event_type?: string;
}

interface VerificationResult {
  intent: IntentInfo;
  handlerExists: boolean;
  handlerType: 'L0' | 'L2' | 'none';
  errors: string[];
  warnings: string[];
}

const results: VerificationResult[] = [];

// Intent Registry에서 모든 인텐트 추출
const intentRegistryContent = readFileSync(INTENT_REGISTRY_PATH, 'utf-8');
const allIntents: IntentInfo[] = [];

// intent_key 패턴으로 모든 인텐트 찾기
const intentKeyRegex = /intent_key:\s*['"]([^'"]+)['"]/g;
let match;
const intentKeys = new Set<string>();

while ((match = intentKeyRegex.exec(intentRegistryContent)) !== null) {
  intentKeys.add(match[1]);
}

console.log(`📋 전체 인텐트 개수: ${intentKeys.size}개\n`);

// 각 인텐트에 대한 상세 정보 추출
for (const intentKey of intentKeys) {
  const intentInfo: IntentInfo = {
    intent_key: intentKey,
    automation_level: 'L0', // 기본값
  };

  // intent_key로 시작하는 블록 찾기
  const intentKeyEscaped = intentKey.replace(/\./g, '\\.');
  const intentBlockPattern = new RegExp(`'${intentKeyEscaped}':\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm');
  const blockMatch = intentRegistryContent.match(intentBlockPattern);

  if (blockMatch) {
    const block = blockMatch[0];

    // automation_level 추출
    const levelMatch = block.match(/automation_level:\s*['"](L[012])['"]/);
    if (levelMatch) {
      intentInfo.automation_level = levelMatch[1] as 'L0' | 'L1' | 'L2';
    }

    // execution_class 추출 (L2인 경우)
    if (intentInfo.automation_level === 'L2') {
      const execMatch = block.match(/execution_class:\s*['"]([AB])['"]/);
      if (execMatch) {
        intentInfo.execution_class = execMatch[1] as 'A' | 'B';
      }

      // action_key 추출 (L2-B인 경우)
      if (intentInfo.execution_class === 'B') {
        const actionKeyMatch = block.match(/action_key:\s*['"]([^'"]+)['"]/);
        if (actionKeyMatch) {
          intentInfo.action_key = actionKeyMatch[1];
        }
      }

      // event_type 추출 (L2-A인 경우)
      if (intentInfo.execution_class === 'A') {
        const eventTypeMatch = block.match(/event_type:\s*['"]([^'"]+)['"]/);
        if (eventTypeMatch) {
          intentInfo.event_type = eventTypeMatch[1];
        }
      }
    }
  }

  allIntents.push(intentInfo);
}

// Handler Registry 확인
const handlerRegistryContent = readFileSync(HANDLER_REGISTRY_PATH, 'utf-8');

// L0 Handler 확인
const l0HandlersContent = readFileSync(L0_HANDLERS_PATH, 'utf-8');

// 각 인텐트 검증
for (const intent of allIntents) {
  const result: VerificationResult = {
    intent,
    handlerExists: false,
    handlerType: 'none',
    errors: [],
    warnings: [],
  };

  // L0 인텐트: l0-handlers.ts에서 확인
  if (intent.automation_level === 'L0') {
    const l0HandlerPattern = new RegExp(`'${intent.intent_key.replace(/\./g, '\\.')}':`, 'g');
    if (l0HandlersContent.match(l0HandlerPattern)) {
      result.handlerExists = true;
      result.handlerType = 'L0';
    } else {
      result.errors.push('L0 Handler가 l0-handlers.ts에 등록되지 않음');
    }
  }

  // L1 인텐트: Handler 불필요 (TaskCard 생성만)
  else if (intent.automation_level === 'L1') {
    result.handlerExists = true; // L1은 Handler 불필요
    result.handlerType = 'none';
    result.warnings.push('L1 인텐트는 Handler가 필요 없음 (TaskCard 생성만)');
  }

  // L2 인텐트: Handler Registry에서 확인
  else if (intent.automation_level === 'L2') {
    const handlerPattern = new RegExp(`'${intent.intent_key.replace(/\./g, '\\.')}':`, 'g');
    if (handlerRegistryContent.match(handlerPattern)) {
      result.handlerExists = true;
      result.handlerType = 'L2';

      // L2-B인 경우 action_key 확인
      if (intent.execution_class === 'B') {
        if (!intent.action_key) {
          result.errors.push('L2-B인데 action_key가 없음');
        }
      }

      // L2-A인 경우 event_type 또는 event_type_by_purpose 확인
      if (intent.execution_class === 'A') {
        // event_type_by_purpose도 확인
        const intentBlockPattern2 = new RegExp(`'${intent.intent_key.replace(/\./g, '\\.')}':\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm');
        const blockMatch2 = intentRegistryContent.match(intentBlockPattern2);
        if (blockMatch2) {
          const block2 = blockMatch2[0];
          const hasEventTypeByPurpose = block2.includes('event_type_by_purpose:');
          if (!intent.event_type && !hasEventTypeByPurpose) {
            result.warnings.push('L2-A인데 event_type 또는 event_type_by_purpose가 없음');
          }
        }
      }
    } else {
      result.errors.push('L2 Handler가 Handler Registry에 등록되지 않음');
    }
  }

  results.push(result);
}

// 결과 출력
console.log('=== 전체 인텐트 검증 결과 ===\n');

const byLevel = {
  L0: results.filter(r => r.intent.automation_level === 'L0'),
  L1: results.filter(r => r.intent.automation_level === 'L1'),
  L2A: results.filter(r => r.intent.automation_level === 'L2' && r.intent.execution_class === 'A'),
  L2B: results.filter(r => r.intent.automation_level === 'L2' && r.intent.execution_class === 'B'),
};

console.log(`📊 레벨별 통계:`);
console.log(`  - L0 (조회): ${byLevel.L0.length}개`);
console.log(`  - L1 (TaskCard 생성): ${byLevel.L1.length}개`);
console.log(`  - L2-A (실행): ${byLevel.L2A.length}개`);
console.log(`  - L2-B (실행): ${byLevel.L2B.length}개`);
console.log(`  - 전체: ${results.length}개\n`);

const passed = results.filter(r => r.errors.length === 0);
const failed = results.filter(r => r.errors.length > 0);
const withWarnings = results.filter(r => r.warnings.length > 0);

console.log(`✅ 통과: ${passed.length}개`);
console.log(`❌ 실패: ${failed.length}개`);
if (withWarnings.length > 0) {
  console.log(`⚠️  경고: ${withWarnings.length}개`);
}
console.log('');

if (failed.length > 0) {
  console.log(`❌ 실패한 인텐트 (${failed.length}개):\n`);
  failed.forEach(r => {
    console.log(`  - ${r.intent.intent_key} (${r.intent.automation_level}${r.intent.execution_class || ''})`);
    r.errors.forEach(e => console.log(`    ❌ ${e}`));
  });
  console.log('');
}

if (withWarnings.length > 0) {
  console.log(`⚠️  경고가 있는 인텐트 (${withWarnings.length}개):\n`);
  withWarnings.forEach(r => {
    console.log(`  - ${r.intent.intent_key} (${r.intent.automation_level}${r.intent.execution_class || ''})`);
    r.warnings.forEach(w => console.log(`    ⚠️  ${w}`));
  });
  console.log('');
}

// L0 Handler 누락 확인
const l0WithoutHandler = byLevel.L0.filter(r => !r.handlerExists);
if (l0WithoutHandler.length > 0) {
  console.log(`⚠️  L0 Handler 누락 (${l0WithoutHandler.length}개):\n`);
  l0WithoutHandler.forEach(r => {
    console.log(`  - ${r.intent.intent_key}`);
  });
  console.log('');
}

// L2 Handler 누락 확인
const l2WithoutHandler = byLevel.L2A.concat(byLevel.L2B).filter(r => !r.handlerExists);
if (l2WithoutHandler.length > 0) {
  console.log(`❌ L2 Handler 누락 (${l2WithoutHandler.length}개):\n`);
  l2WithoutHandler.forEach(r => {
    console.log(`  - ${r.intent.intent_key} (${r.intent.execution_class})`);
  });
  console.log('');
}

// JSON 출력
console.log('=== JSON 출력 ===');
console.log(JSON.stringify({
  total: results.length,
  byLevel: {
    L0: byLevel.L0.length,
    L1: byLevel.L1.length,
    L2A: byLevel.L2A.length,
    L2B: byLevel.L2B.length,
  },
  passed: passed.length,
  failed: failed.length,
  warnings: withWarnings.length,
  failedIntents: failed.map(r => ({
    intent_key: r.intent.intent_key,
    automation_level: r.intent.automation_level,
    execution_class: r.intent.execution_class,
    errors: r.errors,
  })),
  l0WithoutHandler: l0WithoutHandler.map(r => r.intent.intent_key),
  l2WithoutHandler: l2WithoutHandler.map(r => r.intent.intent_key),
}, null, 2));

// 종료 코드
process.exit(failed.length > 0 ? 1 : 0);

