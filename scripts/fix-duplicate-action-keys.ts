#!/usr/bin/env tsx
/**
 * 중복된 action_key 제거 스크립트
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');

const content = readFileSync(REGISTRY_PATH, 'utf-8');
const lines = content.split('\n');

let fixed = false;
let i = 0;

while (i < lines.length) {
  const line = lines[i];

  // action_key 라인 찾기
  if (line.includes('action_key:') && line.includes('// Domain Action Catalog')) {
    // 다음 라인도 action_key인지 확인
    if (i + 1 < lines.length && lines[i + 1].includes('action_key:') && lines[i + 1].includes('// Domain Action Catalog')) {
      // 중복 발견 - 다음 라인 제거
      console.log(`❌ 중복 발견 (라인 ${i + 1}): ${line.trim()}`);
      lines.splice(i + 1, 1);
      fixed = true;
    }
  }

  i++;
}

if (fixed) {
  writeFileSync(REGISTRY_PATH, lines.join('\n'), 'utf-8');
  console.log(`\n✅ 중복된 action_key 제거 완료`);
} else {
  console.log(`✅ 중복된 action_key 없음`);
}

