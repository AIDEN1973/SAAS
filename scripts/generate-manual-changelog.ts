#!/usr/bin/env tsx
/**
 * 매뉴얼 변경 이력(Changelog) 자동 생성 스크립트
 *
 * Git diff를 분석하여 매뉴얼 파일의 변경 이력을 추적하고
 * 사람이 읽기 쉬운 형태의 changelog를 생성합니다.
 *
 * 사용법:
 *   npm run gen:manual-changelog                    # 최근 변경 분석
 *   npm run gen:manual-changelog -- --since=7d     # 최근 7일 변경
 *   npm run gen:manual-changelog -- --since=2026-01-01  # 특정 날짜 이후
 *   npm run gen:manual-changelog -- --output=CHANGELOG.md
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const rootDir = process.cwd();
const manualsDir = 'apps/academy-admin/src/data/manuals';

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

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

interface ManualChange {
  file: string;
  manualId: string;
  manualName: string;
  changeType: 'added' | 'modified' | 'deleted';
  commits: GitCommit[];
  sections: SectionChange[];
}

interface SectionChange {
  sectionId: string;
  sectionTitle: string;
  changeType: 'added' | 'modified' | 'deleted';
  description: string;
}

// 매뉴얼 ID -> 한국어 이름 매핑
const manualNames: Record<string, string> = {
  dashboard: '대시보드',
  students: '학생관리',
  attendance: '출결관리',
  notifications: '문자발송',
  analytics: '통계분석',
  ai: '인공지능',
  classes: '수업관리',
  teachers: '강사관리',
  billing: '수납관리',
  automation: '자동화 설정',
  alimtalk: '알림톡 설정',
  search: '검색',
  timeline: '타임라인',
  agent: '에이전트 모드',
};

/**
 * Git 명령어 실행
 */
function execGit(command: string): string {
  try {
    return execSync(command, { cwd: rootDir, encoding: 'utf-8' }).trim();
  } catch (error) {
    return '';
  }
}

/**
 * since 인자 파싱 (예: 7d, 30d, 2026-01-01)
 */
function parseSinceArg(since: string): string {
  if (/^\d+d$/.test(since)) {
    // 7d -> 7 days ago
    const days = parseInt(since);
    return `${days} days ago`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    // 날짜 형식
    return since;
  }
  return since;
}

/**
 * 매뉴얼 파일 관련 커밋 조회
 */
function getManualCommits(since?: string): GitCommit[] {
  let gitLogCmd = `git log --pretty=format:"%H|%h|%an|%ad|%s" --date=short --name-only`;

  if (since) {
    gitLogCmd += ` --since="${parseSinceArg(since)}"`;
  } else {
    // 기본: 최근 30개 커밋
    gitLogCmd += ` -30`;
  }

  gitLogCmd += ` -- "${manualsDir}/*.ts"`;

  const output = execGit(gitLogCmd);
  if (!output) return [];

  const commits: GitCommit[] = [];
  const entries = output.split('\n\n').filter(Boolean);

  for (const entry of entries) {
    const lines = entry.split('\n');
    if (lines.length < 2) continue;

    const [info, ...fileLines] = lines;
    const [hash, shortHash, author, date, ...messageParts] = info.split('|');
    const message = messageParts.join('|');

    const files = fileLines
      .filter(f => f.includes(manualsDir) && f.endsWith('.ts'))
      .map(f => basename(f));

    if (files.length > 0) {
      commits.push({
        hash,
        shortHash,
        author,
        date,
        message,
        files,
      });
    }
  }

  return commits;
}

/**
 * 파일의 변경 내용 분석 (git diff)
 */
function analyzeFileChanges(commit: GitCommit, file: string): SectionChange[] {
  const changes: SectionChange[] = [];

  try {
    // 이전 커밋과의 diff 가져오기
    const diffCmd = `git diff ${commit.hash}^..${commit.hash} -- "${manualsDir}/${file}"`;
    const diff = execGit(diffCmd);

    if (!diff) return changes;

    // 섹션 변경 분석
    const addedSections = diff.matchAll(/\+\s*id:\s*['"]([^'"]+)['"]/g);
    const removedSections = diff.matchAll(/-\s*id:\s*['"]([^'"]+)['"]/g);
    const modifiedTitles = diff.matchAll(/[-+]\s*title:\s*['"]([^'"]+)['"]/g);

    const addedIds = new Set(Array.from(addedSections, m => m[1]));
    const removedIds = new Set(Array.from(removedSections, m => m[1]));

    // 추가된 섹션
    for (const id of addedIds) {
      if (!removedIds.has(id)) {
        changes.push({
          sectionId: id,
          sectionTitle: '',
          changeType: 'added',
          description: `'${id}' 섹션 추가`,
        });
      }
    }

    // 삭제된 섹션
    for (const id of removedIds) {
      if (!addedIds.has(id)) {
        changes.push({
          sectionId: id,
          sectionTitle: '',
          changeType: 'deleted',
          description: `'${id}' 섹션 삭제`,
        });
      }
    }

    // 내용 변경 감지
    const contentChanges = diff.match(/[-+]\s*(intro|features|steps|content):/g);
    if (contentChanges && contentChanges.length > 0) {
      const uniqueTypes = [...new Set(contentChanges.map(c => c.replace(/[-+]\s*/, '').replace(':', '')))];
      for (const type of uniqueTypes) {
        changes.push({
          sectionId: type,
          sectionTitle: '',
          changeType: 'modified',
          description: `${type} 콘텐츠 수정`,
        });
      }
    }

    // lastUpdated 변경 감지
    if (diff.includes('lastUpdated')) {
      changes.push({
        sectionId: 'meta',
        sectionTitle: '메타데이터',
        changeType: 'modified',
        description: '최종 수정일 업데이트',
      });
    }

  } catch (error) {
    // diff 분석 실패 시 일반적인 수정으로 표시
    changes.push({
      sectionId: 'general',
      sectionTitle: '',
      changeType: 'modified',
      description: '내용 수정',
    });
  }

  return changes;
}

/**
 * 변경 내용을 파일별로 그룹화
 */
function groupChangesByFile(commits: GitCommit[]): ManualChange[] {
  const changesByFile = new Map<string, ManualChange>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const manualId = file.replace('-manual.ts', '');
      const manualName = manualNames[manualId] || manualId;

      if (!changesByFile.has(file)) {
        changesByFile.set(file, {
          file,
          manualId,
          manualName,
          changeType: 'modified',
          commits: [],
          sections: [],
        });
      }

      const change = changesByFile.get(file)!;
      change.commits.push(commit);

      // 섹션별 변경 분석
      const sectionChanges = analyzeFileChanges(commit, file);
      change.sections.push(...sectionChanges);
    }
  }

  return Array.from(changesByFile.values());
}

/**
 * Markdown 형식의 Changelog 생성
 */
function generateMarkdownChangelog(changes: ManualChange[], since?: string): string {
  const now = new Date().toISOString().split('T')[0];
  const sinceText = since ? ` (${since} 이후)` : '';

  let md = `# 매뉴얼 변경 이력${sinceText}\n\n`;
  md += `> 생성일: ${now}\n\n`;

  if (changes.length === 0) {
    md += `변경된 매뉴얼이 없습니다.\n`;
    return md;
  }

  // 날짜별 그룹화
  const commitsByDate = new Map<string, GitCommit[]>();
  for (const change of changes) {
    for (const commit of change.commits) {
      if (!commitsByDate.has(commit.date)) {
        commitsByDate.set(commit.date, []);
      }
      commitsByDate.get(commit.date)!.push(commit);
    }
  }

  // 날짜 내림차순 정렬
  const sortedDates = Array.from(commitsByDate.keys()).sort().reverse();

  for (const date of sortedDates) {
    md += `## ${date}\n\n`;

    const commits = commitsByDate.get(date)!;
    const uniqueCommits = commits.filter(
      (c, i, arr) => arr.findIndex(x => x.hash === c.hash) === i
    );

    for (const commit of uniqueCommits) {
      md += `### ${commit.message}\n\n`;
      md += `- **커밋**: \`${commit.shortHash}\`\n`;
      md += `- **작성자**: ${commit.author}\n`;
      md += `- **변경 파일**:\n`;

      for (const file of commit.files) {
        const manualId = file.replace('-manual.ts', '');
        const manualName = manualNames[manualId] || manualId;
        md += `  - ${manualName} (\`${file}\`)\n`;
      }

      md += `\n`;
    }
  }

  // 파일별 요약
  md += `---\n\n## 📊 변경 요약\n\n`;
  md += `| 매뉴얼 | 변경 횟수 | 최근 변경일 |\n`;
  md += `|--------|----------|------------|\n`;

  for (const change of changes) {
    const latestDate = change.commits[0]?.date || '-';
    md += `| ${change.manualName} | ${change.commits.length}회 | ${latestDate} |\n`;
  }

  return md;
}

/**
 * 콘솔 출력용 요약
 */
function printSummary(changes: ManualChange[]) {
  log('\n========================================', colors.cyan);
  log('  변경 이력 요약', colors.cyan);
  log('========================================', colors.cyan);

  if (changes.length === 0) {
    log('\n변경된 매뉴얼이 없습니다.', colors.yellow);
    return;
  }

  log(`\n총 ${changes.length}개 매뉴얼 변경됨:\n`, colors.reset);

  for (const change of changes) {
    log(`${colors.bold}${change.manualName}${colors.reset} (${change.file})`, colors.reset);
    log(`  커밋 수: ${change.commits.length}회`, colors.gray);

    if (change.sections.length > 0) {
      const uniqueSections = [...new Set(change.sections.map(s => s.description))];
      log(`  변경 내용:`, colors.gray);
      uniqueSections.slice(0, 5).forEach(desc => {
        log(`    - ${desc}`, colors.gray);
      });
      if (uniqueSections.length > 5) {
        log(`    ... 외 ${uniqueSections.length - 5}개`, colors.gray);
      }
    }

    log('', colors.reset);
  }
}

/**
 * 메인 실행
 */
async function main() {
  log('\n========================================', colors.cyan);
  log('  매뉴얼 Changelog 생성', colors.cyan);
  log('========================================', colors.cyan);

  // 인자 파싱
  const args = process.argv.slice(2);
  const sinceArg = args.find(a => a.startsWith('--since='));
  const outputArg = args.find(a => a.startsWith('--output='));

  const since = sinceArg ? sinceArg.split('=')[1] : undefined;
  const outputFile = outputArg
    ? outputArg.split('=')[1]
    : join(rootDir, 'apps/academy-admin/src/data/manuals/CHANGELOG.md');

  log(`\n설정:`, colors.cyan);
  log(`  - 기간: ${since || '최근 30개 커밋'}`, colors.reset);
  log(`  - 출력: ${outputFile}`, colors.reset);

  // Git 상태 확인
  const isGitRepo = existsSync(join(rootDir, '.git'));
  if (!isGitRepo) {
    log('\n✗ Git 저장소가 아닙니다.', colors.red);
    process.exit(1);
  }

  // 커밋 조회
  log('\n커밋 조회 중...', colors.cyan);
  const commits = getManualCommits(since);

  if (commits.length === 0) {
    log('\n⚠ 매뉴얼 관련 커밋이 없습니다.', colors.yellow);

    // 빈 changelog 생성
    const emptyChangelog = generateMarkdownChangelog([], since);
    writeFileSync(outputFile, emptyChangelog, 'utf-8');
    log(`\n빈 Changelog 파일 생성: ${outputFile}`, colors.green);
    return;
  }

  log(`  ${commits.length}개 커밋 발견`, colors.green);

  // 변경 내용 분석
  log('\n변경 내용 분석 중...', colors.cyan);
  const changes = groupChangesByFile(commits);

  // 요약 출력
  printSummary(changes);

  // Markdown Changelog 생성
  const markdown = generateMarkdownChangelog(changes, since);
  writeFileSync(outputFile, markdown, 'utf-8');

  log('========================================', colors.cyan);
  log('  생성 완료', colors.cyan);
  log('========================================', colors.cyan);
  log(`\n✓ Changelog 파일 생성: ${outputFile}`, colors.green);
}

main().catch((error) => {
  log(`\n✗ 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
