#!/usr/bin/env tsx
/**
 * 매뉴얼 초안 자동 생성 스크립트
 *
 * 페이지 컴포넌트를 분석하여 매뉴얼 초안을 생성합니다.
 * AI API 없이 코드 분석 기반으로 구조화된 초안을 생성합니다.
 *
 * 사용법:
 *   npm run gen:manual-draft -- --page=StudentsPage
 *   npm run gen:manual-draft -- --page=BillingPage --output=./drafts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { glob } from 'glob';

const rootDir = process.cwd();
const academyAdminDir = join(rootDir, 'apps/academy-admin/src');

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

interface PageAnalysis {
  pageName: string;
  fileName: string;
  imports: string[];
  hooks: string[];
  components: string[];
  stateVariables: string[];
  subMenuItems: string[];
  features: string[];
}

interface ManualDraft {
  id: string;
  title: string;
  description: string;
  icon: string;
  lastUpdated: string;
  sections: ManualSection[];
}

interface ManualSection {
  id: string;
  title: string;
  type: string;
  intro?: string;
  features?: string[];
  stepGuides?: StepGuide[];
}

interface StepGuide {
  title: string;
  steps: { step: number; content: string }[];
}

/**
 * 페이지 컴포넌트 파일 분석
 */
function analyzePageComponent(filePath: string): PageAnalysis {
  const content = readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath, '.tsx');

  // 1. import 문 추출
  const importMatches = content.matchAll(/import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"]/g);
  const imports = Array.from(importMatches, m => m[1]);

  // 2. 사용된 hooks 추출
  const hookMatches = content.matchAll(/\buse(\w+)\s*\(/g);
  const hooks = [...new Set(Array.from(hookMatches, m => `use${m[1]}`))];

  // 3. 사용된 컴포넌트 추출 (JSX 태그)
  const componentMatches = content.matchAll(/<([A-Z][a-zA-Z0-9]*)/g);
  const components = [...new Set(Array.from(componentMatches, m => m[1]))];

  // 4. useState 변수 추출
  const stateMatches = content.matchAll(/const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/g);
  const stateVariables = Array.from(stateMatches, m => m[1]);

  // 5. SubSidebar 메뉴 아이템 추출
  const subMenuMatches = content.matchAll(/id:\s*['"]([^'"]+)['"]/g);
  const subMenuItems = Array.from(subMenuMatches, m => m[1]);

  // 6. 기능 추론 (컴포넌트명과 훅에서)
  const features = inferFeatures(hooks, components, imports);

  return {
    pageName: fileName.replace('Page', ''),
    fileName,
    imports,
    hooks,
    components,
    stateVariables,
    subMenuItems,
    features,
  };
}

/**
 * 분석 결과에서 기능 추론
 */
function inferFeatures(hooks: string[], components: string[], imports: string[]): string[] {
  const features: string[] = [];

  // 훅 기반 기능 추론
  const hookFeatureMap: Record<string, string> = {
    useQuery: '서버 데이터 조회 및 캐싱',
    useMutation: '데이터 생성/수정/삭제',
    useState: '상태 관리',
    useEffect: '사이드 이펙트 처리',
    useForm: '폼 입력 및 유효성 검사',
    useTable: '테이블 데이터 표시',
    useModal: '모달/다이얼로그 표시',
    useToast: '알림 토스트 표시',
    useDebounce: '검색 최적화',
    usePagination: '페이지네이션',
    useInfiniteQuery: '무한 스크롤',
    useAuth: '사용자 인증',
    useTenant: '테넌트(학원) 정보',
  };

  for (const hook of hooks) {
    for (const [key, feature] of Object.entries(hookFeatureMap)) {
      if (hook.toLowerCase().includes(key.toLowerCase())) {
        features.push(feature);
      }
    }
  }

  // 컴포넌트 기반 기능 추론
  const componentFeatureMap: Record<string, string> = {
    Table: '목록 조회 및 정렬',
    Form: '데이터 입력/수정',
    Modal: '상세 정보 팝업',
    Dialog: '확인/취소 다이얼로그',
    Chart: '차트/그래프 시각화',
    Calendar: '달력 보기',
    DatePicker: '날짜 선택',
    Search: '검색 기능',
    Filter: '필터링 기능',
    Pagination: '페이지 이동',
    Tabs: '탭 전환',
    SubSidebar: '서브 메뉴 네비게이션',
    Card: '카드 형태 정보 표시',
    Badge: '상태/라벨 표시',
    Button: '액션 버튼',
    Dropdown: '드롭다운 선택',
    Select: '선택 입력',
    Input: '텍스트 입력',
    Textarea: '긴 텍스트 입력',
    Checkbox: '체크박스 선택',
    Switch: '토글 스위치',
    Avatar: '프로필 이미지',
    Tooltip: '툴팁 설명',
  };

  for (const comp of components) {
    for (const [key, feature] of Object.entries(componentFeatureMap)) {
      if (comp.includes(key)) {
        features.push(feature);
      }
    }
  }

  // 중복 제거
  return [...new Set(features)];
}

/**
 * 한국어 페이지명 매핑
 */
function getKoreanPageName(pageName: string): string {
  const nameMap: Record<string, string> = {
    Home: '대시보드',
    Dashboard: '대시보드',
    Students: '학생관리',
    StudentsList: '학생관리',
    StudentsHome: '학생관리',
    Attendance: '출결관리',
    Notifications: '문자발송',
    Analytics: '통계분석',
    AI: '인공지능',
    Classes: '수업관리',
    Teachers: '강사관리',
    Billing: '수납관리',
    BillingHome: '수납관리',
    Settings: '설정',
    Automation: '자동화 설정',
    AutomationSettings: '자동화 설정',
    Alimtalk: '알림톡 설정',
    AlimtalkSettings: '알림톡 설정',
    Agent: '에이전트 모드',
    Manual: '매뉴얼',
  };

  return nameMap[pageName] || pageName;
}

/**
 * 아이콘 추론
 */
function inferIcon(pageName: string): string {
  const iconMap: Record<string, string> = {
    Home: 'LayoutDashboard',
    Dashboard: 'LayoutDashboard',
    Students: 'Users',
    Attendance: 'CircleCheckBig',
    Notifications: 'Mail',
    Analytics: 'BarChart3',
    AI: 'Brain',
    Classes: 'GraduationCap',
    Teachers: 'UserPen',
    Billing: 'CreditCard',
    Settings: 'Settings',
    Automation: 'Settings',
    Alimtalk: 'MessageCircle',
    Agent: 'Bot',
  };

  return iconMap[pageName] || 'FileText';
}

/**
 * 매뉴얼 초안 생성
 */
function generateManualDraft(analysis: PageAnalysis): ManualDraft {
  const koreanName = getKoreanPageName(analysis.pageName);
  const today = new Date().toISOString().split('T')[0];

  const sections: ManualSection[] = [
    {
      id: 'intro',
      title: '이 화면, 언제 사용하나요?',
      type: 'intro',
      intro: `${koreanName} 페이지입니다. [TODO: 이 페이지의 주요 목적과 사용 시점을 설명해주세요.]`,
    },
    {
      id: 'features',
      title: '주요 기능',
      type: 'features',
      features: analysis.features.length > 0
        ? analysis.features.map(f => `${f} : [TODO: 상세 설명 추가]`)
        : ['[TODO: 주요 기능을 나열해주세요.]'],
    },
    {
      id: 'steps',
      title: '단계별 사용법',
      type: 'steps',
      stepGuides: [
        {
          title: `${koreanName} 기본 사용법`,
          steps: [
            { step: 1, content: `왼쪽 메뉴에서 "${koreanName}"을 클릭하여 이동합니다.` },
            { step: 2, content: '[TODO: 두 번째 단계를 설명해주세요.]' },
            { step: 3, content: '[TODO: 세 번째 단계를 설명해주세요.]' },
          ],
        },
      ],
    },
  ];

  // SubSidebar가 있으면 탭별 섹션 추가
  if (analysis.subMenuItems.length > 0) {
    sections.push({
      id: 'tabs',
      title: '탭 메뉴 설명',
      type: 'features',
      features: analysis.subMenuItems
        .filter(id => id.length > 2) // 너무 짧은 ID 필터링
        .map(id => `${id} 탭 : [TODO: 이 탭의 기능을 설명해주세요.]`),
    });
  }

  return {
    id: analysis.pageName.toLowerCase().replace(/page$/i, ''),
    title: koreanName,
    description: `[TODO: ${koreanName} 페이지에 대한 간단한 설명을 입력해주세요.]`,
    icon: inferIcon(analysis.pageName),
    lastUpdated: today,
    sections,
  };
}

/**
 * 매뉴얼 초안을 TypeScript 코드로 변환
 */
function draftToTypeScript(draft: ManualDraft): string {
  const sectionsCode = draft.sections.map(section => {
    let sectionCode = `    {
      id: '${section.id}',
      title: '${section.title}',
      type: '${section.type}' as const,`;

    if (section.intro) {
      sectionCode += `
      intro: '${section.intro.replace(/'/g, "\\'")}',`;
    }

    if (section.features) {
      sectionCode += `
      features: [
${section.features.map(f => `        '${f.replace(/'/g, "\\'")}',`).join('\n')}
      ],`;
    }

    if (section.stepGuides) {
      sectionCode += `
      stepGuides: [
${section.stepGuides.map(guide => `        {
          title: '${guide.title.replace(/'/g, "\\'")}',
          steps: [
${guide.steps.map(s => `            { step: ${s.step}, content: '${s.content.replace(/'/g, "\\'")}' },`).join('\n')}
          ],
        },`).join('\n')}
      ],`;
    }

    sectionCode += `
    },`;

    return sectionCode;
  }).join('\n');

  return `/**
 * ${draft.title} 페이지 매뉴얼
 *
 * [자동 생성] 이 파일은 generate-manual-draft.ts로 생성된 초안입니다.
 * [TODO] 마크가 있는 부분을 실제 내용으로 교체해주세요.
 */

import type { ManualPage } from '../../../types/manual';

export const ${draft.id}Manual: ManualPage = {
  id: '${draft.id}',
  title: '${draft.title}',
  description: '${draft.description.replace(/'/g, "\\'")}',
  icon: '${draft.icon}',
  lastUpdated: '${draft.lastUpdated}',
  sections: [
${sectionsCode}
  ],
};
`;
}

/**
 * 분석 보고서 출력
 */
function printAnalysisReport(analysis: PageAnalysis) {
  log('\n=== 페이지 분석 결과 ===', colors.cyan);
  log(`페이지명: ${analysis.pageName}`, colors.reset);
  log(`파일명: ${analysis.fileName}.tsx`, colors.reset);

  if (analysis.hooks.length > 0) {
    log(`\n사용된 Hooks (${analysis.hooks.length}개):`, colors.yellow);
    analysis.hooks.forEach(h => log(`  - ${h}`, colors.gray));
  }

  if (analysis.components.length > 0) {
    log(`\n사용된 컴포넌트 (${analysis.components.length}개):`, colors.yellow);
    analysis.components.slice(0, 15).forEach(c => log(`  - ${c}`, colors.gray));
    if (analysis.components.length > 15) {
      log(`  ... 외 ${analysis.components.length - 15}개`, colors.gray);
    }
  }

  if (analysis.stateVariables.length > 0) {
    log(`\n상태 변수 (${analysis.stateVariables.length}개):`, colors.yellow);
    analysis.stateVariables.forEach(s => log(`  - ${s}`, colors.gray));
  }

  if (analysis.features.length > 0) {
    log(`\n추론된 기능 (${analysis.features.length}개):`, colors.green);
    analysis.features.forEach(f => log(`  - ${f}`, colors.reset));
  }
}

/**
 * 메인 실행
 */
async function main() {
  log('\n========================================', colors.cyan);
  log('  매뉴얼 초안 생성 도구', colors.cyan);
  log('========================================', colors.cyan);

  // 인자 파싱
  const args = process.argv.slice(2);
  const pageArg = args.find(a => a.startsWith('--page='));
  const outputArg = args.find(a => a.startsWith('--output='));
  const listArg = args.includes('--list');

  const outputDir = outputArg
    ? outputArg.split('=')[1]
    : join(rootDir, 'apps/academy-admin/src/data/manuals/drafts');

  // --list 옵션: 사용 가능한 페이지 목록 출력
  if (listArg) {
    const pageFiles = await glob('pages/*Page.tsx', { cwd: academyAdminDir });
    log('\n사용 가능한 페이지 목록:', colors.cyan);
    pageFiles.forEach(f => {
      const name = basename(f, '.tsx');
      log(`  --page=${name}`, colors.reset);
    });
    process.exit(0);
  }

  if (!pageArg) {
    log('\n사용법:', colors.yellow);
    log('  npm run gen:manual-draft -- --page=<PageName>', colors.reset);
    log('  npm run gen:manual-draft -- --page=StudentsPage', colors.reset);
    log('  npm run gen:manual-draft -- --list', colors.reset);
    log('\n옵션:', colors.yellow);
    log('  --page=<name>    분석할 페이지 컴포넌트명 (필수)', colors.reset);
    log('  --output=<path>  출력 디렉토리 (기본: data/manuals/drafts)', colors.reset);
    log('  --list           사용 가능한 페이지 목록 출력', colors.reset);
    process.exit(1);
  }

  const pageName = pageArg.split('=')[1];
  const pageFile = join(academyAdminDir, `pages/${pageName}.tsx`);

  if (!existsSync(pageFile)) {
    log(`\n✗ 페이지 파일을 찾을 수 없습니다: ${pageFile}`, colors.red);
    log('  --list 옵션으로 사용 가능한 페이지를 확인하세요.', colors.yellow);
    process.exit(1);
  }

  // 페이지 분석
  const analysis = analyzePageComponent(pageFile);
  printAnalysisReport(analysis);

  // 매뉴얼 초안 생성
  const draft = generateManualDraft(analysis);
  const tsCode = draftToTypeScript(draft);

  // 출력 디렉토리 생성
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 파일 저장
  const outputFile = join(outputDir, `${draft.id}-manual.draft.ts`);
  writeFileSync(outputFile, tsCode, 'utf-8');

  log('\n========================================', colors.cyan);
  log('  생성 완료', colors.cyan);
  log('========================================', colors.cyan);
  log(`\n✓ 초안 파일 생성: ${outputFile}`, colors.green);
  log('\n다음 단계:', colors.yellow);
  log('  1. 생성된 파일을 열어 [TODO] 부분을 실제 내용으로 교체', colors.reset);
  log('  2. 파일명에서 .draft를 제거하고 data/manuals/ 폴더로 이동', colors.reset);
  log('  3. data/manuals/index.ts에 import 및 등록 추가', colors.reset);
}

main().catch((error) => {
  log(`\n✗ 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
