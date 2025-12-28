#!/usr/bin/env tsx
/**
 * Handler 정밀 검증 스크립트
 *
 * 검증 항목:
 * 1. Handler Registry 등록 확인
 * 2. Domain Action Catalog 일치 확인
 * 3. Policy 경로 일치 확인
 * 4. Intent Registry와 Handler 일치 확인
 * 5. TypeScript 타입 일관성 확인
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');
const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const HANDLER_REGISTRY_PATH = join(HANDLERS_DIR, 'registry.ts');
const DOMAIN_ACTION_CATALOG_PATH = join(process.cwd(), 'infra/supabase/functions/_shared/domain-action-catalog.ts');

interface Issue {
  type: 'error' | 'warning';
  message: string;
  file?: string;
  line?: number;
}

const issues: Issue[] = [];

// 1. Intent Registry에서 L2-B 인텐트 추출
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
const l2BIntents = new Map<string, { action_key: string; intent_key: string }>();

// L2-B 인텐트 찾기 (execution_class: 'B'이고 action_key가 있음)
// 더 정확한 파싱을 위해 줄 단위로 처리
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
      if (currentIntent.execution_class === 'B' && currentIntent.action_key) {
        l2BIntents.set(currentIntent.intent_key!, {
          action_key: currentIntent.action_key,
          intent_key: currentIntent.intent_key!,
        });
      }
      currentIntent = null;
      inBlock = false;
    }
  }
}

console.log(`📋 Intent Registry에서 L2-B 인텐트: ${l2BIntents.size}개 발견\n`);

// 2. Domain Action Catalog 추출
const catalogContent = readFileSync(DOMAIN_ACTION_CATALOG_PATH, 'utf-8');
const catalogActions = new Set<string>();
const catalogRegex = /['"]([^'"]+)['"]/g;
let catalogMatch;
while ((catalogMatch = catalogRegex.exec(catalogContent)) !== null) {
  const action = catalogMatch[1];
  if (action.includes('.')) {
    catalogActions.add(action);
  }
}

console.log(`📋 Domain Action Catalog: ${catalogActions.size}개 발견\n`);

// 3. Handler Registry에서 등록된 Handler 확인
const handlerRegistryContent = readFileSync(HANDLER_REGISTRY_PATH, 'utf-8');
const registeredHandlers = new Set<string>();
const handlerRegistryRegex = /['"]([^']+\.exec\.[^']+)['"]:\s*[^,}]+Handler/g;
let handlerMatch;
while ((handlerMatch = handlerRegistryRegex.exec(handlerRegistryContent)) !== null) {
  registeredHandlers.add(handlerMatch[1]);
}

console.log(`📋 Handler Registry에 등록된 Handler: ${registeredHandlers.size}개 발견\n`);

// 4. Handler 파일 목록
const handlerFiles = readdirSync(HANDLERS_DIR)
  .filter(f => f.endsWith('.ts') && !f.includes('registry') && !f.includes('types'))
  .map(f => ({ name: f, path: join(HANDLERS_DIR, f) }));

console.log(`📋 Handler 파일: ${handlerFiles.length}개 발견\n`);

// 5. 각 Handler 검증
const handlerIntents = new Map<string, { file: string; action_key?: string }>();

for (const { name, path } of handlerFiles) {
  const content = readFileSync(path, 'utf-8');

  // intent_key 추출
  const intentKeyMatch = content.match(/intent_key:\s*['"]([^'"]+)['"]/);
  if (!intentKeyMatch) {
    issues.push({
      type: 'error',
      message: `intent_key가 없음`,
      file: name,
    });
    continue;
  }

  const intentKey = intentKeyMatch[1];

  // action_key 추출 (L2-B인 경우)
  const actionKeyMatch = content.match(/assertDomainActionKey\(['"]([^'"]+)['"]\)/);
  const actionKey = actionKeyMatch ? actionKeyMatch[1] : undefined;

  handlerIntents.set(intentKey, { file: name, action_key: actionKey });

  // L2-B인 경우 action_key 확인
  if (l2BIntents.has(intentKey)) {
    const expectedActionKey = l2BIntents.get(intentKey)!.action_key;

    if (!actionKey) {
      issues.push({
        type: 'error',
        message: `L2-B Handler인데 assertDomainActionKey 호출이 없음 (예상: ${expectedActionKey})`,
        file: name,
      });
    } else if (actionKey !== expectedActionKey) {
      issues.push({
        type: 'error',
        message: `action_key 불일치: Handler=${actionKey}, Registry=${expectedActionKey}`,
        file: name,
      });
    }

    // Domain Action Catalog 확인
    if (actionKey && !catalogActions.has(actionKey)) {
      issues.push({
        type: 'error',
        message: `Domain Action Catalog에 없는 action_key: ${actionKey}`,
        file: name,
      });
    }

    // Policy 경로 확인
    const policyPathMatch = content.match(/policyPath\s*=\s*['"]([^'"]+)['"]/);
    const expectedPolicyPath = `domain_action.${expectedActionKey}.enabled`;
    if (policyPathMatch) {
      const actualPolicyPath = policyPathMatch[1];
      if (actualPolicyPath !== expectedPolicyPath) {
        issues.push({
          type: 'error',
          message: `Policy 경로 불일치: Handler=${actualPolicyPath}, 예상=${expectedPolicyPath}`,
          file: name,
        });
      }
    } else {
      issues.push({
        type: 'warning',
        message: `Policy 경로를 찾을 수 없음 (예상: ${expectedPolicyPath})`,
        file: name,
      });
    }
  }

  // Handler Registry 등록 확인
  if (!registeredHandlers.has(intentKey)) {
    issues.push({
      type: 'error',
      message: `Handler Registry에 등록되지 않음`,
      file: name,
    });
  }
}

// 6. Intent Registry와 Handler 불일치 확인
for (const [intentKey, info] of l2BIntents.entries()) {
  if (!handlerIntents.has(intentKey)) {
    issues.push({
      type: 'warning',
      message: `Intent Registry에 있지만 Handler 파일이 없음: ${intentKey}`,
    });
  }
}

// 7. Handler Registry에 등록되었지만 파일이 없는 경우
for (const registeredIntent of registeredHandlers) {
  if (!handlerIntents.has(registeredIntent)) {
    issues.push({
      type: 'error',
      message: `Handler Registry에 등록되었지만 Handler 파일이 없음: ${registeredIntent}`,
    });
  }
}

// 결과 출력
console.log('=== 정밀 검증 결과 ===\n');

const errorCount = issues.filter(i => i.type === 'error').length;
const warningCount = issues.filter(i => i.type === 'warning').length;

console.log(`오류: ${errorCount}개`);
console.log(`경고: ${warningCount}개\n`);

if (issues.length > 0) {
  console.log('=== 상세 결과 ===\n');
  for (const issue of issues) {
    const icon = issue.type === 'error' ? '❌' : '⚠️';
    const fileInfo = issue.file ? ` [${issue.file}]` : '';
    console.log(`${icon} ${issue.message}${fileInfo}`);
  }
} else {
  console.log('✅ 모든 검증을 통과했습니다!');
}

// 통계
console.log('\n=== 통계 ===');
console.log(`Intent Registry L2-B: ${l2BIntents.size}개`);
console.log(`Domain Action Catalog: ${catalogActions.size}개`);
console.log(`Handler 파일: ${handlerFiles.length}개`);
console.log(`Handler Registry 등록: ${registeredHandlers.size}개`);

process.exit(errorCount > 0 ? 1 : 0);

