#!/usr/bin/env tsx
/**
 * Handler TODO 분석 스크립트
 *
 * 모든 Handler의 TODO 주석을 분석하여 우선순위를 정리합니다.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');

interface HandlerTodo {
  handler: string;
  intent_key: string;
  action_key?: string;
  hasBusinessLogic: boolean;
  todoCount: number;
  todos: string[];
}

const handlerTodos: HandlerTodo[] = [];

// Handler 파일 목록 가져오기
const files = readdirSync(HANDLERS_DIR).filter(f => f.includes('-exec-') && f.endsWith('.ts'));

for (const file of files) {
  const filePath = join(HANDLERS_DIR, file);
  const content = readFileSync(filePath, 'utf-8');

  // intent_key 추출
  const intentKeyMatch = content.match(/intent_key:\s*['"]([^'"]+)['"]/);
  if (!intentKeyMatch) continue;

  const intent_key = intentKeyMatch[1];

  // action_key 추출
  const actionKeyMatch = content.match(/Action Key:\s*([^\s]+)/);
  const action_key = actionKeyMatch ? actionKeyMatch[1] : undefined;

  // TODO 주석 추출
  const todoMatches = content.matchAll(/TODO:([^\n]+)/g);
  const todos: string[] = [];
  for (const match of todoMatches) {
    todos.push(match[1].trim());
  }

  // 비즈니스 로직 존재 여부 확인 (TODO만 있고 실제 로직이 없는지)
  const hasBusinessLogic = !content.includes('TODO: 실제 비즈니스 로직 구현') ||
                           content.includes('await withTenant') ||
                           content.includes('context.supabase') ||
                           content.includes('.insert(') ||
                           content.includes('.update(') ||
                           content.includes('.delete(');

  handlerTodos.push({
    handler: file.replace('.ts', ''),
    intent_key,
    action_key,
    hasBusinessLogic,
    todoCount: todos.length,
    todos,
  });
}

// 결과 출력
console.log('=== Handler TODO 분석 결과 ===\n');

const withBusinessLogic = handlerTodos.filter(h => h.hasBusinessLogic);
const withoutBusinessLogic = handlerTodos.filter(h => !h.hasBusinessLogic);

console.log(`📊 통계:`);
console.log(`  - 전체 Handler: ${handlerTodos.length}개`);
console.log(`  - 비즈니스 로직 구현됨: ${withBusinessLogic.length}개`);
console.log(`  - 비즈니스 로직 미구현: ${withoutBusinessLogic.length}개\n`);

if (withoutBusinessLogic.length > 0) {
  console.log(`⚠️  비즈니스 로직 미구현 Handler (${withoutBusinessLogic.length}개):\n`);
  withoutBusinessLogic.forEach(h => {
    console.log(`  - ${h.intent_key}`);
    if (h.action_key) {
      console.log(`    Action Key: ${h.action_key}`);
    }
    if (h.todos.length > 0) {
      console.log(`    TODO: ${h.todos.join(', ')}`);
    }
  });
  console.log('');
}

// 도메인별 그룹화
const byDomain: Record<string, HandlerTodo[]> = {};
handlerTodos.forEach(h => {
  const domain = h.intent_key.split('.')[0];
  if (!byDomain[domain]) {
    byDomain[domain] = [];
  }
  byDomain[domain].push(h);
});

console.log('=== 도메인별 분류 ===\n');
for (const [domain, handlers] of Object.entries(byDomain)) {
  const implemented = handlers.filter(h => h.hasBusinessLogic).length;
  const total = handlers.length;
  console.log(`${domain}: ${implemented}/${total} 구현됨`);
}

// JSON 출력
console.log('\n=== JSON 출력 ===');
console.log(JSON.stringify({
  total: handlerTodos.length,
  implemented: withBusinessLogic.length,
  notImplemented: withoutBusinessLogic.length,
  notImplementedList: withoutBusinessLogic.map(h => ({
    intent_key: h.intent_key,
    action_key: h.action_key,
    handler: h.handler,
  })),
  byDomain: Object.fromEntries(
    Object.entries(byDomain).map(([domain, handlers]) => [
      domain,
      {
        total: handlers.length,
        implemented: handlers.filter(h => h.hasBusinessLogic).length,
        notImplemented: handlers.filter(h => !h.hasBusinessLogic).map(h => h.intent_key),
      },
    ])
  ),
}, null, 2));

