#!/usr/bin/env tsx
/**
 * Domain Action Catalog 완전 검증 스크립트
 *
 * 1. Catalog와 Registry 간 일관성
 * 2. 모든 L2-B Intent에 action_key 존재
 * 3. 모든 action_key가 Catalog에 등록
 * 4. Catalog와 Edge Function 파일 동기화
 * 5. 문서와 코드 동기화
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const CATALOG_PATH = join(process.cwd(), 'packages/core/core-automation/src/domain-action-catalog.ts');
const EDGE_CATALOG_PATH = join(process.cwd(), 'infra/supabase/functions/_shared/domain-action-catalog.ts');
const DOC_PATH = join(process.cwd(), 'docu/챗봇.md');

console.log('🔍 Domain Action Catalog 완전 검증 시작...\n');

// 1. Catalog 파일 읽기
const catalogContent = readFileSync(CATALOG_PATH, 'utf-8');
const edgeCatalogContent = readFileSync(EDGE_CATALOG_PATH, 'utf-8');

// Catalog에서 action_key 추출
const catalogMatch = catalogContent.match(/export const DOMAIN_ACTION_CATALOG = \[([\s\S]*?)\]/);
const edgeCatalogMatch = edgeCatalogContent.match(/export const DOMAIN_ACTION_CATALOG = \[([\s\S]*?)\]/);

if (!catalogMatch || !edgeCatalogMatch) {
  console.error('❌ Catalog 파일을 파싱할 수 없습니다.');
  process.exit(1);
}

const extractActionKeys = (content: string): string[] => {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith("'") && line.endsWith("',"))
    .map(line => line.replace(/^'|',$/g, ''))
    .filter(Boolean);
};

const catalogItems = extractActionKeys(catalogMatch[1]);
const edgeCatalogItems = extractActionKeys(edgeCatalogMatch[1]);

console.log(`📋 Packages Catalog: ${catalogItems.length}개`);
console.log(`📋 Edge Function Catalog: ${edgeCatalogItems.length}개\n`);

// 2. Catalog 동기화 검증
const errors: string[] = [];
const warnings: string[] = [];

if (catalogItems.length !== edgeCatalogItems.length) {
  errors.push(`❌ Catalog 동기화 실패: Packages(${catalogItems.length}) != Edge(${edgeCatalogItems.length})`);
}

const catalogSet = new Set(catalogItems);
const edgeCatalogSet = new Set(edgeCatalogItems);

for (const item of catalogItems) {
  if (!edgeCatalogSet.has(item)) {
    errors.push(`❌ Edge Catalog에 누락: ${item}`);
  }
}

for (const item of edgeCatalogItems) {
  if (!catalogSet.has(item)) {
    errors.push(`❌ Edge Catalog에 추가 항목: ${item}`);
  }
}

// 3. Registry에서 L2-B Intent 추출
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
const lines = registryContent.split('\n');

const l2bIntents: Array<{ intent_key: string; action_key?: string }> = [];
let currentIntent: { intent_key?: string; execution_class?: string; action_key?: string } | null = null;
let inBlock = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

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

    const execMatch = line.match(/execution_class:\s*'([^']+)'/);
    if (execMatch) {
      currentIntent.execution_class = execMatch[1];
    }

    const actionMatch = line.match(/action_key:\s*'([^']+)'/);
    if (actionMatch) {
      currentIntent.action_key = actionMatch[1];
    }

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

// 4. action_key 검증
const missingActionKey = l2bIntents.filter(i => !i.action_key);
if (missingActionKey.length > 0) {
  errors.push(`❌ action_key 누락 (${missingActionKey.length}개):`);
  missingActionKey.forEach(i => errors.push(`   - ${i.intent_key}`));
}

const actionKeysInRegistry = l2bIntents
  .filter(i => i.action_key)
  .map(i => i.action_key!);

const missingInCatalog = actionKeysInRegistry.filter(key => !catalogSet.has(key));
if (missingInCatalog.length > 0) {
  errors.push(`❌ Catalog에 없는 action_key (${missingInCatalog.length}개):`);
  missingInCatalog.forEach(key => {
    const intent = l2bIntents.find(i => i.action_key === key);
    errors.push(`   - ${key} (${intent?.intent_key})`);
  });
}

const unusedInCatalog = catalogItems.filter(key => !actionKeysInRegistry.includes(key));
if (unusedInCatalog.length > 0) {
  warnings.push(`⚠️  사용되지 않는 action_key (${unusedInCatalog.length}개):`);
  unusedInCatalog.forEach(key => warnings.push(`   - ${key}`));
}

// 5. 문서 검증
const docContent = readFileSync(DOC_PATH, 'utf-8');
const docCountMatch = docContent.match(/카탈로그 항목.*?(\d+)개 action_key/);
if (docCountMatch) {
  const docCount = parseInt(docCountMatch[1], 10);
  if (docCount !== catalogItems.length) {
    errors.push(`❌ 문서와 코드 불일치: 문서(${docCount}) != 코드(${catalogItems.length})`);
  }
} else {
  warnings.push(`⚠️  문서에서 카탈로그 항목 수를 찾을 수 없습니다.`);
}

// 결과 출력
if (errors.length > 0) {
  console.error('❌ 검증 실패:\n');
  errors.forEach(e => console.error(e));
  console.log('');
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️  경고:\n');
  warnings.forEach(w => console.warn(w));
  console.log('');
}

console.log('✅ 모든 검증 통과!\n');
console.log(`📊 최종 통계:`);
console.log(`   - Domain Action Catalog: ${catalogItems.length}개`);
console.log(`   - Edge Function Catalog: ${edgeCatalogItems.length}개 (동기화 완료)`);
console.log(`   - L2-B Intent: ${l2bIntents.length}개`);
console.log(`   - action_key 매핑: ${actionKeysInRegistry.length}개 (100%)`);
console.log(`   - 사용되지 않는 action_key: ${unusedInCatalog.length}개`);

