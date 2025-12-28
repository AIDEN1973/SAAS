#!/usr/bin/env tsx
/**
 * Intent 목록 생성 스크립트
 *
 * packages/chatops-intents/src/registry.ts에서 모든 Intent를 추출하여
 * 간단한 항목 목록을 생성합니다.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const DOC_PATH = join(process.cwd(), 'docu/챗봇.md');

const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');

// Intent 정보 추출
interface IntentInfo {
  key: string;
  description: string;
  automation_level: string;
  execution_class?: string;
}

const intents: IntentInfo[] = [];
const lines = registryContent.split('\n');

let inBlock = false;
let currentIntent: Partial<IntentInfo> | null = null;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Intent 키 찾기
  const keyMatch = line.match(/^\s+'([a-z_]+\.[a-z_]+\.[a-z_]+)':\s*\{/);
  if (keyMatch) {
    inBlock = true;
    currentIntent = { key: keyMatch[1] };
    braceCount = 1;
    continue;
  }

  if (inBlock && currentIntent) {
    // description 찾기
    const descMatch = line.match(/description:\s*'([^']+)'/);
    if (descMatch) {
      currentIntent.description = descMatch[1];
    }

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

    // 중괄호 카운트
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;

    // Intent 블록 종료
    if (braceCount === 0) {
      if (currentIntent.key && currentIntent.automation_level && currentIntent.description) {
        intents.push(currentIntent as IntentInfo);
      }
      currentIntent = null;
      inBlock = false;
    }
  }
}

// Level별로 분류
const byLevel = {
  L0: [] as string[],
  L1: [] as string[],
  L2A: [] as string[],
  L2B: [] as string[],
};

intents.forEach(intent => {
  if (intent.automation_level === 'L0') {
    byLevel.L0.push(intent.key);
  } else if (intent.automation_level === 'L1') {
    byLevel.L1.push(intent.key);
  } else if (intent.automation_level === 'L2' && intent.execution_class === 'A') {
    byLevel.L2A.push(intent.key);
  } else if (intent.automation_level === 'L2' && intent.execution_class === 'B') {
    byLevel.L2B.push(intent.key);
  }
});

// 정렬
byLevel.L0.sort();
byLevel.L1.sort();
byLevel.L2A.sort();
byLevel.L2B.sort();

// 목록 생성
let listContent = `\n\n## 9-Z. Intent 전체 목록 (147개)\n\n`;
listContent += `이 섹션은 모든 Intent를 Level별로 나열한 간단한 목록입니다.\n\n`;

listContent += `### L0 Intent (조회/초안) - 58개\n\n`;
byLevel.L0.forEach(key => {
  const intent = intents.find(i => i.key === key);
  const desc = intent?.description || '설명 없음';
  listContent += `- \`${key}\`: ${desc}\n`;
});

listContent += `\n### L1 Intent (TaskCard 생성) - 18개\n\n`;
byLevel.L1.forEach(key => {
  const intent = intents.find(i => i.key === key);
  const desc = intent?.description || '설명 없음';
  listContent += `- \`${key}\`: ${desc}\n`;
});

listContent += `\n### L2-A Intent (알림/발송 실행) - 23개\n\n`;
byLevel.L2A.forEach(key => {
  const intent = intents.find(i => i.key === key);
  const desc = intent?.description || '설명 없음';
  listContent += `- \`${key}\`: ${desc}\n`;
});

listContent += `\n### L2-B Intent (도메인 변경 실행) - 48개\n\n`;
byLevel.L2B.forEach(key => {
  const intent = intents.find(i => i.key === key);
  const desc = intent?.description || '설명 없음';
  listContent += `- \`${key}\`: ${desc}\n`;
});

// 문서 읽기
const docContent = readFileSync(DOC_PATH, 'utf-8');

// 기존 목록 섹션이 있으면 제거
const listSectionStart = docContent.indexOf('## 9-Z. Intent 전체 목록');
if (listSectionStart >= 0) {
  const listSectionEnd = docContent.indexOf('\n## ', listSectionStart + 1);
  const beforeList = docContent.substring(0, listSectionStart);
  const afterList = listSectionEnd >= 0 ? docContent.substring(listSectionEnd) : '';
  const newContent = beforeList + listContent + (afterList || '');
  writeFileSync(DOC_PATH, newContent, 'utf-8');
} else {
  // 문서 끝에 추가
  const newContent = docContent.trimEnd() + listContent;
  writeFileSync(DOC_PATH, newContent, 'utf-8');
}

console.log(`✅ Intent 목록 추가 완료: 총 ${intents.length}개`);
