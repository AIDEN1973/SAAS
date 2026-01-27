#!/usr/bin/env tsx
/**
 * AI 기반 매뉴얼 자동 업데이트 스크립트
 *
 * 페이지 컴포넌트의 코드 변경을 감지하고, ChatGPT API를 사용하여
 * 기존 매뉴얼 형식에 맞춰 자동으로 매뉴얼 내용을 생성/업데이트합니다.
 *
 * 변경 내용은 Supabase manual_change_logs 테이블에 기록되어
 * 슈퍼어드민에서 검토/승인할 수 있습니다.
 *
 * 사용법:
 *   npm run auto:manual-update                      # 변경된 페이지만 업데이트
 *   npm run auto:manual-update -- --page=students  # 특정 페이지 업데이트
 *   npm run auto:manual-update -- --all            # 모든 페이지 업데이트
 *   npm run auto:manual-update -- --dry-run        # 실제 저장 없이 미리보기
 *   npm run auto:manual-update -- --no-log         # DB 로그 기록 안함
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { loadManualPageMeta, type ManualPageMeta } from './lib/manual-meta-loader';

const rootDir = process.cwd();
const academyAdminDir = join(rootDir, 'apps/academy-admin/src');
const manualsDir = join(academyAdminDir, 'data/manuals');

// 환경변수에서 OpenAI API 키 및 Supabase 설정 로드
let OPENAI_API_KEY: string | undefined;
let SUPABASE_URL: string | undefined;
let SUPABASE_SERVICE_ROLE_KEY: string | undefined;

try {
  const envRegistryPath = join(rootDir, 'packages/env-registry/src/server');
  const { envServer } = require(envRegistryPath);
  OPENAI_API_KEY = envServer.OPENAI_API_KEY;
  SUPABASE_URL = envServer.SUPABASE_URL;
  SUPABASE_SERVICE_ROLE_KEY = envServer.SUPABASE_SERVICE_ROLE_KEY;
} catch {
  OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  SUPABASE_URL = process.env.SUPABASE_URL;
  SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Supabase 클라이언트 (서비스 역할)
let supabase: ReturnType<typeof createClient> | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function log_message(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// 공용 로더 사용 (SSOT)
function getManualPageMeta(): Record<string, ManualPageMeta> {
  return loadManualPageMeta(academyAdminDir);
}

interface CodeAnalysis {
  hooks: string[];
  components: string[];
  stateVariables: string[];
  functions: string[];
  imports: string[];
  jsxStructure: string;
}

interface ManualSection {
  id: string;
  title: string;
  type: string;
  intro?: string;
  features?: string[];
  stepGuides?: {
    title: string;
    steps: { step: number; content: string }[];
    alert?: { type: string; content: string };
  }[];
}

interface ManualChangeLog {
  manual_id: string;
  manual_title: string;
  change_type: 'create' | 'update' | 'delete';
  previous_content: Record<string, unknown> | null;
  new_content: Record<string, unknown>;
  diff_summary: string | null;
  trigger_type: 'auto' | 'manual' | 'ci';
  triggered_by: string;
  trigger_reason: string;
  changed_files: string[];
  status: 'pending' | 'auto_approved';
}

/**
 * 변경 로그를 Supabase에 저장
 */
async function saveChangeLog(log: ManualChangeLog): Promise<boolean> {
  if (!supabase) {
    log_message('  ⚠ Supabase 설정이 없어 로그를 저장하지 않습니다.', colors.yellow);
    return false;
  }

  try {
    const { error } = await supabase.from('manual_change_logs').insert(log as never);
    if (error) {
      log_message(`  ⚠ 로그 저장 실패: ${error.message}`, colors.yellow);
      return false;
    }
    log_message('  ✓ 변경 로그 저장됨 (슈퍼어드민에서 검토 가능)', colors.green);
    return true;
  } catch (err) {
    log_message(`  ⚠ 로그 저장 중 오류: ${(err as Error).message}`, colors.yellow);
    return false;
  }
}

/**
 * 기존 매뉴얼을 JSON 객체로 파싱
 */
function parseManualToJson(content: string): Record<string, unknown> | null {
  if (!content) return null;

  try {
    // id 추출
    const idMatch = content.match(/id:\s*['"]([^'"]+)['"]/);
    // title 추출
    const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
    // description 추출
    const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
    // sections 개수
    const sectionsMatch = content.match(/sections:\s*\[/);
    const sectionCount = sectionsMatch
      ? (content.match(/{\s*id:\s*['"][^'"]+['"]/g) || []).length
      : 0;

    return {
      id: idMatch?.[1] || '',
      title: titleMatch?.[1] || '',
      description: descMatch?.[1] || '',
      sectionCount,
      // 전체 내용 (미리보기용)
      rawContent: content.substring(0, 3000),
    };
  } catch {
    return null;
  }
}

/**
 * 변경 요약 생성
 */
function generateDiffSummary(
  prevContent: Record<string, unknown> | null,
  newContent: Record<string, unknown>
): string {
  if (!prevContent) {
    return '신규 매뉴얼 생성';
  }

  const changes: string[] = [];

  // 섹션 수 비교
  const prevSections = (prevContent.sectionCount as number) || 0;
  const newSections = (newContent.sectionCount as number) || 0;
  if (newSections !== prevSections) {
    changes.push(`섹션 수: ${prevSections}개 → ${newSections}개`);
  }

  // 설명 비교
  if (prevContent.description !== newContent.description) {
    changes.push('설명 변경됨');
  }

  return changes.length > 0 ? changes.join(', ') : '내용 업데이트';
}

/**
 * Git에서 최근 변경된 페이지 파일 조회
 */
function getChangedPageFiles(since: string = '1 day ago'): string[] {
  try {
    const cmd = `git diff --name-only HEAD~5 HEAD -- "apps/academy-admin/src/pages/**/*.tsx"`;
    const output = execSync(cmd, { cwd: rootDir, encoding: 'utf-8' }).trim();
    if (!output) return [];
    return output.split('\n').filter(f => f.endsWith('.tsx'));
  } catch {
    return [];
  }
}

/**
 * 페이지 컴포넌트 코드 분석
 */
function analyzePageCode(filePath: string): CodeAnalysis {
  const content = readFileSync(filePath, 'utf-8');

  // Hooks 추출
  const hookMatches = content.matchAll(/\buse(\w+)\s*\(/g);
  const hooks = [...new Set(Array.from(hookMatches, m => `use${m[1]}`))];

  // 컴포넌트 추출
  const componentMatches = content.matchAll(/<([A-Z][a-zA-Z0-9]*)/g);
  const components = [...new Set(Array.from(componentMatches, m => m[1]))];

  // State 변수 추출
  const stateMatches = content.matchAll(/const\s+\[(\w+),\s*set(\w+)\]\s*=\s*useState/g);
  const stateVariables = Array.from(stateMatches, m => m[1]);

  // 함수 추출
  const funcMatches = content.matchAll(/(?:const|function)\s+(\w+)\s*(?:=\s*(?:async\s*)?\(|<|\()/g);
  const functions = Array.from(funcMatches, m => m[1]).filter(f => !f.startsWith('use'));

  // Import 추출
  const importMatches = content.matchAll(/import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"]/g);
  const imports = Array.from(importMatches, m => m[1]);

  // JSX 구조 추출 (return 문 내용)
  const returnMatch = content.match(/return\s*\(\s*([\s\S]*?)\s*\);?\s*(?:}|$)/);
  const jsxStructure = returnMatch ? returnMatch[1].substring(0, 2000) : '';

  return { hooks, components, stateVariables, functions, imports, jsxStructure };
}

/**
 * 기존 매뉴얼 파일 읽기
 */
function readExistingManual(manualId: string): string | null {
  const manualPath = join(manualsDir, `${manualId}-manual.ts`);
  if (!existsSync(manualPath)) return null;
  return readFileSync(manualPath, 'utf-8');
}

/**
 * ChatGPT API 호출
 */
async function callChatGPT(prompt: string, systemPrompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ChatGPT API 오류: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * AI로 매뉴얼 섹션 생성
 */
async function generateManualSections(
  manualId: string,
  codeAnalysis: CodeAnalysis,
  existingManual: string | null
): Promise<ManualSection[]> {
  const mapping = getManualPageMeta()[manualId];
  if (!mapping) throw new Error(`알 수 없는 매뉴얼 ID: ${manualId}`);

  const systemPrompt = `당신은 비즈니스 관리 SaaS 솔루션의 사용자 매뉴얼 작성 전문가입니다.
주어진 코드 분석 결과를 바탕으로 사용자가 이해하기 쉬운 매뉴얼을 작성합니다.

반드시 아래 JSON 형식으로 응답하세요:
{
  "sections": [
    {
      "id": "intro",
      "title": "이 화면, 언제 사용하나요?",
      "type": "intro",
      "intro": "화면 설명 텍스트 (마크다운 굵은글씨** 사용 가능)"
    },
    {
      "id": "features",
      "title": "주요 기능",
      "type": "features",
      "features": ["기능1 : 설명", "기능2 : 설명"]
    },
    {
      "id": "steps",
      "title": "단계별 사용법",
      "type": "steps",
      "stepGuides": [
        {
          "title": "작업명",
          "steps": [
            {"step": 1, "content": "단계 설명"},
            {"step": 2, "content": "단계 설명"}
          ],
          "alert": {"type": "info", "content": "알림 메시지"}
        }
      ]
    }
  ]
}

규칙:
1. intro는 이 화면의 목적과 언제 사용하는지 설명
2. features는 "기능명 : 설명" 형식으로 작성
3. stepGuides는 실제 사용 시나리오별로 3-5단계로 구성
4. alert.type은 "info", "warning", "success", "error" 중 선택
5. 비즈니스 운영자(관리자, 직원)가 쉽게 이해할 수 있는 용어 사용
6. 코드에서 발견된 기능만 작성 (없는 기능 추측 금지)`;

  const userPrompt = `## 페이지 정보
- 페이지명: ${mapping.koreanName}
- 매뉴얼 ID: ${manualId}

## 코드 분석 결과
- 사용된 Hooks: ${codeAnalysis.hooks.join(', ') || '없음'}
- 주요 컴포넌트: ${codeAnalysis.components.slice(0, 20).join(', ') || '없음'}
- 상태 변수: ${codeAnalysis.stateVariables.join(', ') || '없음'}
- 주요 함수: ${codeAnalysis.functions.slice(0, 15).join(', ') || '없음'}

## JSX 구조 (일부)
\`\`\`tsx
${codeAnalysis.jsxStructure.substring(0, 1500)}
\`\`\`

${existingManual ? `
## 기존 매뉴얼 참고 (형식과 톤 유지)
\`\`\`typescript
${existingManual.substring(0, 2000)}
\`\`\`
` : ''}

위 코드 분석 결과를 바탕으로 "${mapping.koreanName}" 페이지의 매뉴얼 섹션을 JSON 형식으로 생성해주세요.`;

  const response = await callChatGPT(userPrompt, systemPrompt);

  // JSON 파싱
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON을 찾을 수 없습니다.');
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.sections || [];
  } catch (error) {
    log_message(`JSON 파싱 실패: ${(error as Error).message}`, colors.red);
    log_message(`응답 내용: ${response.substring(0, 500)}`, colors.gray);
    throw error;
  }
}

/**
 * 매뉴얼 파일 생성
 */
function generateManualFile(manualId: string, sections: ManualSection[]): string {
  const mapping = getManualPageMeta()[manualId];
  const today = new Date().toISOString().split('T')[0];

  const sectionsCode = sections.map(section => {
    let code = `    {
      id: '${section.id}',
      title: '${section.title}',
      type: '${section.type}',`;

    if (section.intro) {
      code += `
      intro: '${section.intro.replace(/'/g, "\\'")}',`;
    }

    if (section.features) {
      code += `
      features: [
${section.features.map(f => `        '${f.replace(/'/g, "\\'")}',`).join('\n')}
      ],`;
    }

    if (section.stepGuides) {
      code += `
      stepGuides: [
${section.stepGuides.map(guide => {
  let guideCode = `        {
          title: '${guide.title.replace(/'/g, "\\'")}',
          steps: [
${guide.steps.map(s => `            { step: ${s.step}, content: '${s.content.replace(/'/g, "\\'")}' },`).join('\n')}
          ],`;

  if (guide.alert) {
    guideCode += `
          alert: {
            type: '${guide.alert.type}',
            content: '${guide.alert.content.replace(/'/g, "\\'")}',
          },`;
  }

  guideCode += `
        },`;
  return guideCode;
}).join('\n')}
      ],`;
    }

    code += `
    },`;
    return code;
  }).join('\n');

  return `/**
 * ${mapping.koreanName} 페이지 매뉴얼
 *
 * [자동 생성] 이 파일은 auto-update-manual.ts로 생성되었습니다.
 * 마지막 업데이트: ${today}
 */

import type { ManualPage } from '../../types/manual';

export const ${manualId}Manual: ManualPage = {
  id: '${manualId}',
  title: '${mapping.koreanName}',
  description: '${mapping.koreanName} 페이지에 대한 사용 가이드입니다.',
  icon: '${mapping.icon}',
  lastUpdated: '${today}',
  sections: [
${sectionsCode}
  ],
};
`;
}

/**
 * 단일 매뉴얼 업데이트
 */
async function updateManual(manualId: string, dryRun: boolean = false): Promise<boolean> {
  const mapping = getManualPageMeta()[manualId];
  if (!mapping) {
    log_message(`  ⚠ 알 수 없는 매뉴얼 ID: ${manualId}`, colors.yellow);
    return false;
  }

  log_message(`\n${colors.cyan}[${mapping.koreanName}]${colors.reset} 업데이트 중...`);

  try {
    // 1. 페이지 코드 분석
    let combinedAnalysis: CodeAnalysis = {
      hooks: [],
      components: [],
      stateVariables: [],
      functions: [],
      imports: [],
      jsxStructure: '',
    };

    for (const pageFile of mapping.sourceFiles) {
      const filePath = join(academyAdminDir, pageFile);
      if (existsSync(filePath)) {
        const analysis = analyzePageCode(filePath);
        combinedAnalysis.hooks.push(...analysis.hooks);
        combinedAnalysis.components.push(...analysis.components);
        combinedAnalysis.stateVariables.push(...analysis.stateVariables);
        combinedAnalysis.functions.push(...analysis.functions);
        combinedAnalysis.imports.push(...analysis.imports);
        combinedAnalysis.jsxStructure += analysis.jsxStructure + '\n';
      }
    }

    // 중복 제거
    combinedAnalysis.hooks = [...new Set(combinedAnalysis.hooks)];
    combinedAnalysis.components = [...new Set(combinedAnalysis.components)];
    combinedAnalysis.stateVariables = [...new Set(combinedAnalysis.stateVariables)];
    combinedAnalysis.functions = [...new Set(combinedAnalysis.functions)];

    log_message(`  코드 분석 완료: ${combinedAnalysis.hooks.length} hooks, ${combinedAnalysis.components.length} components`, colors.gray);

    // 2. 기존 매뉴얼 읽기
    const existingManual = readExistingManual(manualId);

    // 3. AI로 섹션 생성
    log_message(`  AI 매뉴얼 생성 중...`, colors.gray);
    const sections = await generateManualSections(manualId, combinedAnalysis, existingManual);
    log_message(`  ${sections.length}개 섹션 생성됨`, colors.green);

    // 4. 파일 생성
    const manualContent = generateManualFile(manualId, sections);

    if (dryRun) {
      log_message(`  [Dry Run] 저장하지 않음`, colors.yellow);
      log_message(`\n--- 생성된 내용 미리보기 ---`, colors.cyan);
      console.log(manualContent.substring(0, 1500) + '\n...');
    } else {
      const outputPath = join(manualsDir, `${manualId}-manual.ts`);
      writeFileSync(outputPath, manualContent, 'utf-8');
      log_message(`  ✓ 저장됨: ${outputPath}`, colors.green);

      // 5. 변경 로그 저장 (--no-log 옵션이 없는 경우)
      const noLogFlag = process.argv.includes('--no-log');
      if (!noLogFlag && supabase) {
        const prevJson = existingManual ? parseManualToJson(existingManual) : null;
        const newJson = parseManualToJson(manualContent) || {
          id: manualId,
          title: mapping.koreanName,
          description: `${mapping.koreanName} 페이지에 대한 사용 가이드입니다.`,
          sectionCount: sections.length,
        };

        const changeLog: ManualChangeLog = {
          manual_id: manualId,
          manual_title: mapping.koreanName,
          change_type: existingManual ? 'update' : 'create',
          previous_content: prevJson,
          new_content: newJson,
          diff_summary: generateDiffSummary(prevJson, newJson),
          trigger_type: process.env.CI ? 'ci' : 'manual',
          triggered_by: process.env.CI ? 'github-actions' : 'developer',
          trigger_reason: `코드 변경 감지: ${mapping.sourceFiles.join(', ')}`,
          changed_files: mapping.sourceFiles,
          status: 'pending',
        };

        await saveChangeLog(changeLog);
      }
    }

    return true;
  } catch (error) {
    log_message(`  ✗ 오류: ${(error as Error).message}`, colors.red);
    return false;
  }
}

/**
 * 변경된 파일에서 매뉴얼 ID 추출
 */
function getManualIdsFromChangedFiles(changedFiles: string[]): string[] {
  const manualIds: Set<string> = new Set();

  for (const [manualId, mapping] of Object.entries(getManualPageMeta())) {
    for (const pageFile of mapping.sourceFiles) {
      if (changedFiles.some(f => f.includes(pageFile.replace('pages/', '')))) {
        manualIds.add(manualId);
      }
    }
  }

  return Array.from(manualIds);
}

/**
 * 메인 실행
 */
async function main() {
  log_message('\n========================================', colors.cyan);
  log_message('  AI 기반 매뉴얼 자동 업데이트', colors.cyan);
  log_message('========================================', colors.cyan);

  // 인자 파싱
  const args = process.argv.slice(2);
  const pageArg = args.find(a => a.startsWith('--page='));
  const allFlag = args.includes('--all');
  const dryRun = args.includes('--dry-run');
  const listFlag = args.includes('--list');

  // API 키 확인
  if (!OPENAI_API_KEY && !dryRun && !listFlag) {
    log_message('\n✗ OPENAI_API_KEY가 설정되지 않았습니다.', colors.red);
    log_message('  .env.local 파일에 OPENAI_API_KEY를 설정하세요.', colors.yellow);
    process.exit(1);
  }

  // --list: 사용 가능한 매뉴얼 목록
  if (listFlag) {
    log_message('\n사용 가능한 매뉴얼:', colors.cyan);
    for (const [id, mapping] of Object.entries(getManualPageMeta())) {
      log_message(`  --page=${id}  (${mapping.koreanName})`, colors.reset);
    }
    process.exit(0);
  }

  let targetManualIds: string[] = [];

  if (pageArg) {
    // 특정 페이지 지정
    const manualId = pageArg.split('=')[1];
    if (!getManualPageMeta()[manualId]) {
      log_message(`\n✗ 알 수 없는 매뉴얼 ID: ${manualId}`, colors.red);
      log_message('  --list 옵션으로 사용 가능한 목록을 확인하세요.', colors.yellow);
      process.exit(1);
    }
    targetManualIds = [manualId];
  } else if (allFlag) {
    // 전체 업데이트
    targetManualIds = Object.keys(getManualPageMeta());
  } else {
    // 변경된 파일만
    const changedFiles = getChangedPageFiles();
    if (changedFiles.length === 0) {
      log_message('\n변경된 페이지 파일이 없습니다.', colors.yellow);
      log_message('  --all 옵션으로 전체 업데이트하거나', colors.gray);
      log_message('  --page=<id> 옵션으로 특정 페이지를 지정하세요.', colors.gray);
      process.exit(0);
    }
    targetManualIds = getManualIdsFromChangedFiles(changedFiles);
    log_message(`\n변경 감지된 페이지: ${changedFiles.length}개`, colors.cyan);
  }

  log_message(`\n대상 매뉴얼: ${targetManualIds.length}개`, colors.cyan);
  if (dryRun) {
    log_message(`[Dry Run 모드] 실제 파일 저장 없음`, colors.yellow);
  }

  // 순차 업데이트 (API 레이트 리밋 고려)
  let successCount = 0;
  for (const manualId of targetManualIds) {
    const success = await updateManual(manualId, dryRun);
    if (success) successCount++;

    // API 레이트 리밋 방지
    if (targetManualIds.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  log_message('\n========================================', colors.cyan);
  log_message('  완료', colors.cyan);
  log_message('========================================', colors.cyan);
  log_message(`\n✓ ${successCount}/${targetManualIds.length}개 매뉴얼 업데이트됨`, colors.green);
}

main().catch((error) => {
  log_message(`\n✗ 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
