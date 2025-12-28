#!/usr/bin/env tsx
/**
 * Edge Function Intent Registry 자동 생성 스크립트
 *
 * SSOT(packages/chatops-intents/src/registry.ts)에서 모든 Intent를 추출하여
 * Edge Function용 간소화된 Registry를 생성합니다.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SSOT_REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const EDGE_REGISTRY_PATH = join(process.cwd(), 'infra/supabase/supabase/functions/_shared/intent-registry.ts');

const registryContent = readFileSync(SSOT_REGISTRY_PATH, 'utf-8');

// Intent 블록을 더 정확하게 추출하기 위해 줄 단위로 처리
const lines = registryContent.split('\n');
const intents: Array<{
  key: string;
  automation_level: string;
  execution_class?: string;
  description?: string;
  examples?: string[];
}> = [];

let currentIntent: {
  key?: string;
  automation_level?: string;
  execution_class?: string;
  description?: string;
  examples?: string[];
} | null = null;
let braceCount = 0;
let inIntentBlock = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Intent 키 찾기: 'domain.action.subaction': {
  const intentKeyMatch = line.match(/^'([a-z_]+\.[a-z_]+\.[a-z_]+)':\s*\{/);
  if (intentKeyMatch) {
    currentIntent = { key: intentKeyMatch[1] };
    inIntentBlock = true;
    braceCount = 1;
    continue;
  }

  if (inIntentBlock && currentIntent) {
    // 중괄호 카운트
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;

    // automation_level 추출
    const automationLevelMatch = line.match(/automation_level:\s*'([^']+)'/);
    if (automationLevelMatch) {
      currentIntent.automation_level = automationLevelMatch[1];
    }

    // execution_class 추출
    const executionClassMatch = line.match(/execution_class:\s*'([^']+)'/);
    if (executionClassMatch) {
      currentIntent.execution_class = executionClassMatch[1];
    }

    // description 추출
    const descriptionMatch = line.match(/description:\s*'([^']+)'/);
    if (descriptionMatch) {
      currentIntent.description = descriptionMatch[1];
    }

    // examples 추출 시작
    if (line.includes('examples:') && line.includes('[')) {
      currentIntent.examples = [];
      // 한 줄에 examples가 모두 있는 경우
      const singleLineMatch = line.match(/examples:\s*\[(.*?)\]/);
      if (singleLineMatch) {
        const examplesStr = singleLineMatch[1];
        const examples = examplesStr
          .split(',')
          .map(ex => ex.trim().replace(/^['"]|['"]$/g, ''))
          .filter(ex => ex.length > 0);
        currentIntent.examples = examples;
      } else {
        // 여러 줄에 걸친 examples 추출
        let examplesStart = i;
        let examplesEnd = i;
        let examplesBraceCount = 1;
        for (let j = i + 1; j < lines.length; j++) {
          const exLine = lines[j];
          examplesBraceCount += (exLine.match(/\[/g) || []).length;
          examplesBraceCount -= (exLine.match(/\]/g) || []).length;
          if (examplesBraceCount === 0) {
            examplesEnd = j;
            break;
          }
        }
        // examples 블록 파싱
        const examplesBlock = lines.slice(examplesStart, examplesEnd + 1).join('\n');
        const examplesMatches = examplesBlock.match(/'([^']+)'/g);
        if (examplesMatches) {
          currentIntent.examples = examplesMatches.map(m => m.replace(/^'|'$/g, ''));
        }
      }
    }

    // Intent 블록 종료
    if (braceCount === 0) {
      if (currentIntent.key && currentIntent.automation_level) {
        intents.push({
          key: currentIntent.key,
          automation_level: currentIntent.automation_level,
          execution_class: currentIntent.execution_class,
          description: currentIntent.description,
          examples: currentIntent.examples,
        });
      }
      currentIntent = null;
      inIntentBlock = false;
    }
  }
}

// 도메인별로 그룹화하여 주석 추가
const domainMap: Record<string, string> = {
  attendance: '// 출결(Attendance) 도메인',
  billing: '// 수납/청구(Billing) 도메인',
  message: '// 메시지/공지(Messaging) 도메인',
  student: '// 학생 라이프사이클(Student) 도메인',
  class: '// 반/수업/시간표(Class/Schedule) 도메인',
  schedule: '// 반/수업/시간표(Class/Schedule) 도메인',
  note: '// 상담/학습/메모 + AI(Notes/AI) 도메인',
  ai: '// 상담/학습/메모 + AI(Notes/AI) 도메인',
  report: '// 리포트/대시보드(Reports) 도메인',
  policy: '// 정책/권한/시스템(System) 도메인',
  rbac: '// 정책/권한/시스템(System) 도메인',
  system: '// 정책/권한/시스템(System) 도메인',
};

// Edge Function Registry 생성
const registryEntries: string[] = [];
let lastDomain = '';

for (const intent of intents) {
  const domain = intent.key.split('.')[0];

  // 도메인 변경 시 주석 추가
  if (domain !== lastDomain) {
    if (registryEntries.length > 0) {
      registryEntries.push(''); // 빈 줄 추가
    }
    registryEntries.push(`  ${domainMap[domain] || `// ${domain} 도메인`}`);
    lastDomain = domain;
  }

  const executionClassLine = intent.execution_class
    ? `    execution_class: '${intent.execution_class}',`
    : '';

  const descriptionLine = intent.description
    ? `    description: '${intent.description.replace(/'/g, "\\'")}',`
    : '';

  const examplesLines: string[] = [];
  if (intent.examples && intent.examples.length > 0) {
    const examplesStr = intent.examples
      .map(ex => `      '${ex.replace(/'/g, "\\'")}'`)
      .join(',\n');
    examplesLines.push(`    examples: [\n${examplesStr},\n    ],`);
  }

  const fields: string[] = [];
  fields.push(`    intent_key: '${intent.key}',`);
  fields.push(`    automation_level: '${intent.automation_level}',`);
  if (executionClassLine) fields.push(executionClassLine);
  if (descriptionLine) fields.push(descriptionLine);
  if (examplesLines.length > 0) fields.push(...examplesLines);

  registryEntries.push(`  '${intent.key}': {
${fields.join('\n')}
  },`);
}

const edgeRegistryContent = `/**
 * Intent Registry for Edge Functions
 *
 * 챗봇.md 8.2, 12.1 참조
 * 목적: Edge Function에서 사용할 수 있는 간소화된 Intent Registry
 *
 * [SSOT] packages/chatops-intents/src/registry.ts가 Intent Registry의 SSOT입니다.
 * 이 파일은 환경 제약(Deno)으로 인한 간소화된 버전이며, SSOT와 동기화되어야 합니다.
 *
 * [불변 규칙] 새로운 Intent를 추가할 때는 SSOT(packages/chatops-intents/src/registry.ts)에
 * 먼저 추가한 후, 이 파일에도 동일한 intent_key로 추가해야 합니다.
 *
 * 주의: Edge Function은 Deno 환경이므로, npm 패키지를 직접 import하기 어렵습니다.
 * 따라서 이 파일은 registry의 핵심 정보만 포함합니다.
 * 실제 스키마 검증은 서버 측에서 수행해야 합니다.
 *
 * ⚠️ 자동 생성 파일: 이 파일은 scripts/generate-edge-intent-registry.ts에 의해 자동 생성됩니다.
 * 수동 수정 금지: SSOT Registry를 수정한 후 이 스크립트를 실행하여 동기화하세요.
 */

import type { IntentRegistryItem } from './intent-parser.ts';

/**
 * Intent Registry (간소화된 버전)
 *
 * [SSOT] packages/chatops-intents/src/registry.ts가 SSOT입니다.
 * 이 registry는 SSOT와 동기화되어야 하며, 새로운 Intent를 추가할 때는
 * SSOT에 먼저 추가한 후 이 파일에도 동일한 intent_key로 추가해야 합니다.
 */
export const intentRegistry: Record<string, IntentRegistryItem> = {
${registryEntries.join('\n\n')}
};

/**
 * Intent Registry 조회 함수
 */
export function getIntent(intent_key: string): IntentRegistryItem | undefined {
  return intentRegistry[intent_key];
}

/**
 * Intent 존재 여부 확인
 */
export function hasIntent(intent_key: string): boolean {
  return intent_key in intentRegistry;
}
`;

writeFileSync(EDGE_REGISTRY_PATH, edgeRegistryContent, 'utf-8');
console.log(`✅ Edge Function Registry 생성 완료: ${intents.length}개 Intent 등록`);
