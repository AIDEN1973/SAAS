#!/usr/bin/env tsx
/**
 * TODO 스캔 및 이슈 추적 스크립트
 *
 * 코드 내 TODO 주석을 스캔하여 다음을 수행합니다:
 * 1. 모든 TODO 주석 추출
 * 2. Issue 번호 포함 여부 확인
 * 3. TODO 우선순위 및 상태 분류
 * 4. 마크다운 리포트 생성
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';

interface TodoItem {
  file: string;
  line: number;
  content: string;
  issueNumber?: string;
  priority?: 'P0' | 'P1' | 'P2';
  category?: string;
}

const rootDir = process.cwd();

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * TODO 주석 파싱
 */
function parseTodo(line: string, lineNumber: number, filePath: string): TodoItem | null {
  // TODO 패턴:
  // - // TODO: 설명
  // - // TODO(#123): 설명
  // - // TODO [P1]: 설명
  // - /* TODO: 설명 */
  // - /* TODO(#123) [P1]: 설명 */

  // 라인 주석 패턴
  const lineTodoPattern = /\/\/\s*TODO(?:\s*\(#(\d+)\))?(?:\s*\[([^\]]+)\])?:\s*(.+)/i;
  let match = line.match(lineTodoPattern);

  // 블록 주석 패턴
  if (!match) {
    const blockTodoPattern = /\/\*\s*TODO(?:\s*\(#(\d+)\))?(?:\s*\[([^\]]+)\])?:\s*(.+?)\s*\*\//i;
    match = line.match(blockTodoPattern);
  }

  if (!match) return null;

  const [, issueNumber, priorityOrCategory, content] = match;

  const todo: TodoItem = {
    file: relative(rootDir, filePath),
    line: lineNumber,
    content: content.trim(),
  };

  if (issueNumber) {
    todo.issueNumber = issueNumber;
  }

  // 우선순위 또는 카테고리 파싱
  if (priorityOrCategory) {
    if (priorityOrCategory.match(/^P[012]$/i)) {
      todo.priority = priorityOrCategory.toUpperCase() as 'P0' | 'P1' | 'P2';
    } else {
      todo.category = priorityOrCategory;
    }
  }

  return todo;
}

/**
 * 파일에서 TODO 추출
 */
function extractTodosFromFile(filePath: string): TodoItem[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const todos: TodoItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const todo = parseTodo(lines[i], i + 1, filePath);
    if (todo) {
      todos.push(todo);
    }
  }

  return todos;
}

/**
 * 메인 실행
 */
async function main() {
  log('\n========================================', colors.cyan);
  log('  TODO 스캔 및 이슈 추적', colors.cyan);
  log('========================================\n', colors.cyan);

  // TypeScript/TSX 파일 검색 (성능 최적화)
  const tsFiles = await glob('**/*.{ts,tsx}', {
    cwd: rootDir,
    ignore: [
      'node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/*.d.ts', // 타입 정의 파일 제외
    ],
  });

  log(`스캔 대상 파일: ${tsFiles.length}개`, colors.gray);

  // TODO 추출
  const allTodos: TodoItem[] = [];

  for (const file of tsFiles) {
    const filePath = join(rootDir, file);
    const todos = extractTodosFromFile(filePath);
    allTodos.push(...todos);
  }

  log(`\n총 TODO 발견: ${allTodos.length}개`, colors.cyan);

  // 분류
  const todosWithIssue = allTodos.filter(t => t.issueNumber);
  const todosWithoutIssue = allTodos.filter(t => !t.issueNumber);
  const todosByPriority = {
    P0: allTodos.filter(t => t.priority === 'P0'),
    P1: allTodos.filter(t => t.priority === 'P1'),
    P2: allTodos.filter(t => t.priority === 'P2'),
    None: allTodos.filter(t => !t.priority),
  };

  // 결과 출력
  log('\n=== 이슈 번호 연결 현황 ===', colors.cyan);
  log(`✓ 이슈 번호 포함: ${todosWithIssue.length}개`, colors.green);
  log(`✗ 이슈 번호 없음: ${todosWithoutIssue.length}개`, colors.yellow);

  log('\n=== 우선순위별 분류 ===', colors.cyan);
  log(`P0 (즉시 처리): ${todosByPriority.P0.length}개`, todosByPriority.P0.length > 0 ? colors.red : colors.gray);
  log(`P1 (중요): ${todosByPriority.P1.length}개`, todosByPriority.P1.length > 0 ? colors.yellow : colors.gray);
  log(`P2 (일반): ${todosByPriority.P2.length}개`, todosByPriority.P2.length > 0 ? colors.cyan : colors.gray);
  log(`미분류: ${todosByPriority.None.length}개`, todosByPriority.None.length > 0 ? colors.gray : colors.gray);

  // 상세 리스트 출력 (이슈 번호 없는 TODO만)
  if (todosWithoutIssue.length > 0) {
    log('\n=== 이슈 번호가 없는 TODO (상위 10개) ===', colors.yellow);
    todosWithoutIssue.slice(0, 10).forEach(todo => {
      log(`  ${todo.file}:${todo.line}`, colors.gray);
      log(`    ${todo.content}`, colors.reset);
    });

    if (todosWithoutIssue.length > 10) {
      log(`  ... 외 ${todosWithoutIssue.length - 10}개`, colors.gray);
    }
  }

  // 마크다운 리포트 생성
  const reportPath = join(rootDir, 'TODO_REPORT.md');
  const report = generateMarkdownReport(allTodos, todosByPriority, todosWithIssue, todosWithoutIssue);
  writeFileSync(reportPath, report, 'utf-8');

  log(`\n리포트 생성 완료: ${reportPath}`, colors.green);

  // 경고 (이슈 번호 없는 TODO가 너무 많은 경우)
  if (todosWithoutIssue.length > allTodos.length * 0.5) {
    log('\n⚠ 경고: 이슈 번호가 없는 TODO가 50% 이상입니다.', colors.yellow);
    log('  - TODO 주석 작성 시 이슈 번호 포함 권장: TODO(#123): 설명', colors.yellow);
  }

  log('\n========================================\n', colors.cyan);
}

/**
 * 마크다운 리포트 생성
 */
function generateMarkdownReport(
  allTodos: TodoItem[],
  todosByPriority: Record<string, TodoItem[]>,
  todosWithIssue: TodoItem[],
  todosWithoutIssue: TodoItem[]
): string {
  const now = new Date().toISOString().split('T')[0];

  let report = `# TODO 리포트\n\n`;
  report += `**생성 일시**: ${now}\n`;
  report += `**총 TODO 수**: ${allTodos.length}개\n\n`;
  report += `---\n\n`;

  // 요약
  report += `## 📊 요약\n\n`;
  report += `| 항목 | 수량 |\n`;
  report += `|------|------|\n`;
  report += `| 총 TODO | ${allTodos.length}개 |\n`;
  report += `| 이슈 번호 포함 | ${todosWithIssue.length}개 (${Math.round(todosWithIssue.length / allTodos.length * 100)}%) |\n`;
  report += `| 이슈 번호 없음 | ${todosWithoutIssue.length}개 (${Math.round(todosWithoutIssue.length / allTodos.length * 100)}%) |\n`;
  report += `| P0 (즉시 처리) | ${todosByPriority.P0.length}개 |\n`;
  report += `| P1 (중요) | ${todosByPriority.P1.length}개 |\n`;
  report += `| P2 (일반) | ${todosByPriority.P2.length}개 |\n`;
  report += `| 미분류 | ${todosByPriority.None.length}개 |\n\n`;

  // 우선순위별 TODO
  report += `## 🔴 P0 (즉시 처리)\n\n`;
  if (todosByPriority.P0.length > 0) {
    todosByPriority.P0.forEach(todo => {
      report += `- [${todo.file}:${todo.line}](${todo.file}#L${todo.line})${todo.issueNumber ? ` [#${todo.issueNumber}]` : ''}\n`;
      report += `  - ${todo.content}\n\n`;
    });
  } else {
    report += `없음\n\n`;
  }

  report += `## 🟠 P1 (중요)\n\n`;
  if (todosByPriority.P1.length > 0) {
    todosByPriority.P1.forEach(todo => {
      report += `- [${todo.file}:${todo.line}](${todo.file}#L${todo.line})${todo.issueNumber ? ` [#${todo.issueNumber}]` : ''}\n`;
      report += `  - ${todo.content}\n\n`;
    });
  } else {
    report += `없음\n\n`;
  }

  report += `## 🟡 P2 (일반)\n\n`;
  if (todosByPriority.P2.length > 0) {
    todosByPriority.P2.forEach(todo => {
      report += `- [${todo.file}:${todo.line}](${todo.file}#L${todo.line})${todo.issueNumber ? ` [#${todo.issueNumber}]` : ''}\n`;
      report += `  - ${todo.content}\n\n`;
    });
  } else {
    report += `없음\n\n`;
  }

  report += `## ⚪ 미분류\n\n`;
  if (todosByPriority.None.length > 0) {
    todosByPriority.None.forEach(todo => {
      report += `- [${todo.file}:${todo.line}](${todo.file}#L${todo.line})${todo.issueNumber ? ` [#${todo.issueNumber}]` : ''}\n`;
      report += `  - ${todo.content}\n\n`;
    });
  } else {
    report += `없음\n\n`;
  }

  // 이슈 번호 없는 TODO
  report += `## ⚠️ 이슈 번호가 없는 TODO\n\n`;
  if (todosWithoutIssue.length > 0) {
    report += `총 ${todosWithoutIssue.length}개의 TODO에 이슈 번호가 없습니다.\n\n`;
    todosWithoutIssue.forEach(todo => {
      report += `- [${todo.file}:${todo.line}](${todo.file}#L${todo.line})\n`;
      report += `  - ${todo.content}\n\n`;
    });
  } else {
    report += `모든 TODO에 이슈 번호가 포함되어 있습니다. ✓\n\n`;
  }

  // 가이드
  report += `---\n\n`;
  report += `## 📝 TODO 작성 가이드\n\n`;
  report += `### 권장 형식\n\n`;
  report += `\`\`\`typescript\n`;
  report += `// TODO(#123): 학생 목록 API 통합\n`;
  report += `// TODO [P1]: 정책 시점 일관성 개선\n`;
  report += `// TODO(#456) [P0]: RLS 정책 검증 추가\n`;
  report += `\`\`\`\n\n`;
  report += `### 우선순위\n\n`;
  report += `- **P0**: 즉시 처리 필요 (보안, 장애 위험)\n`;
  report += `- **P1**: 중요 (중기 운영 리스크)\n`;
  report += `- **P2**: 일반 (품질 개선)\n\n`;
  report += `### 이슈 번호\n\n`;
  report += `- GitHub Issue 번호를 포함하여 추적 가능하도록 작성\n`;
  report += `- 예: \`TODO(#123): 설명\`\n\n`;

  return report;
}

main().catch((error) => {
  log(`\n✗ 스캔 중 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
