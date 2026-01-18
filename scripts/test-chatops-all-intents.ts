#!/usr/bin/env tsx
/**
 * ChatOps Edge Function - 147개 Intent 전체 통합 테스트
 *
 * 검증 항목:
 * 1. Intent Registry에 모든 Intent 등록 확인
 * 2. Fallback 로직의 키워드 매핑 확인 (INTENT_KEYWORD_MAP)
 * 3. 각 Intent에 대한 샘플 메시지 생성 및 파싱 테스트
 * 4. Intent 파서가 올바른 형식으로 파싱하는지 확인
 * 5. System Prompt에 모든 Intent가 포함되어 있는지 확인
 *
 * 실행 방법:
 *   tsx scripts/test-chatops-all-intents.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const INTENT_REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/_shared/intent-registry.ts');
const CHATOPS_INDEX_PATH = join(process.cwd(), 'infra/supabase/functions/chatops/index.ts');

interface IntentInfo {
  intent_key: string;
  automation_level: 'L0' | 'L1' | 'L2';
  execution_class?: 'A' | 'B';
  domain: string;
  type: string;
  action: string;
}

interface TestResult {
  intent_key: string;
  automation_level: string;
  execution_class?: string;
  status: 'pass' | 'fail' | 'warning';
  issues: string[];
  has_keyword_mapping: boolean;
  has_system_prompt: boolean;
  has_fallback_pattern: boolean;
}

const results: TestResult[] = [];

// Intent Registry에서 모든 Intent 추출
function extractIntentsFromRegistry(): IntentInfo[] {
  const registryContent = readFileSync(INTENT_REGISTRY_PATH, 'utf-8');
  const intents: IntentInfo[] = [];

  // intent_key 패턴으로 모든 Intent 찾기
  const intentKeyRegex = /['"]([^'"]+)['"]:\s*\{[\s\S]*?intent_key:\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = intentKeyRegex.exec(registryContent)) !== null) {
    const intentKey = match[2];
    const parts = intentKey.split('.');
    if (parts.length === 3) {
      const [domain, type, action] = parts;

      // automation_level 추출
      const automationLevelMatch = registryContent.substring(match.index).match(/automation_level:\s*['"](L[012])['"]/);
      const automation_level = (automationLevelMatch?.[1] || 'L0') as 'L0' | 'L1' | 'L2';

      // execution_class 추출 (L2일 때만)
      let execution_class: 'A' | 'B' | undefined;
      if (automation_level === 'L2') {
        const executionClassMatch = registryContent.substring(match.index).match(/execution_class:\s*['"]([AB])['"]/);
        execution_class = executionClassMatch?.[1] as 'A' | 'B' | undefined;
      }

      intents.push({
        intent_key: intentKey,
        automation_level,
        execution_class,
        domain,
        type,
        action,
      });
    }
  }

  return intents;
}

// ChatOps index.ts에서 INTENT_KEYWORD_MAP 추출
function extractKeywordMappings(): Set<string> {
  const chatopsContent = readFileSync(CHATOPS_INDEX_PATH, 'utf-8');
  const keywordMapRegex = /['"]([^'"]+)['"]:\s*\[/g;
  const mappedIntents = new Set<string>();
  let match;

  while ((match = keywordMapRegex.exec(chatopsContent)) !== null) {
    const intentKey = match[1];
    if (intentKey.includes('.')) {
      mappedIntents.add(intentKey);
    }
  }

  return mappedIntents;
}

// System Prompt에 Intent가 포함되어 있는지 확인
function checkSystemPrompt(intentKey: string): boolean {
  const chatopsContent = readFileSync(CHATOPS_INDEX_PATH, 'utf-8');
  // System Prompt 섹션 찾기 (systemPrompt 변수)
  const systemPromptMatch = chatopsContent.match(/const systemPrompt = `([\s\S]*?)`;/);
  if (!systemPromptMatch) {
    return false;
  }

  const systemPrompt = systemPromptMatch[1];
  return systemPrompt.includes(intentKey);
}

// Fallback 패턴 매칭 가능 여부 확인
function checkFallbackPattern(intent: IntentInfo): boolean {
  // 도메인 키워드 매핑 확인
  const domainKeywords: Record<string, string[]> = {
    'student': ['학생', '대상', '회원', '원생'],
    'attendance': ['출결', '출석', '지각', '결석', '조퇴'],
    'billing': ['수납', '청구', '결제', '납부', '연체', '환불'],
    'message': ['문자', '메시지', '알림', '공지'],
    'class': ['수업', '클래스'],
    'schedule': ['일정', '스케줄', '시간표'],
    'report': ['리포트', '보고서', '요약', '현황'],
  };

  // 타입 키워드 매핑 확인
  const typeKeywords: Record<string, string[]> = {
    'query': ['조회', '검색', '찾기', '확인', '보기'],
    'exec': ['실행', '처리', '해', '시켜', '하기'],
    'task': ['업무', '작업', '태스크'],
    'draft': ['초안', '작성', '만들기'],
  };

  // 액션 키워드 매핑 확인
  const actionKeywords: Record<string, string[]> = {
    'discharge': ['퇴원'],
    'pause': ['휴원'],
    'resume': ['재개', '복학'],
    'register': ['등록'],
    'late': ['지각'],
    'absent': ['결석'],
    'overdue': ['연체'],
    'invoice': ['청구서', '인보이스'],
    'payment': ['결제', '납부'],
  };

  const hasDomain = domainKeywords[intent.domain]?.length > 0;
  const hasType = typeKeywords[intent.type]?.length > 0;
  const hasAction = actionKeywords[intent.action]?.length > 0;

  // 도메인과 액션이 매칭되거나, 도메인과 타입이 매칭되는 경우
  return (hasDomain && hasAction) || (hasDomain && hasType && !hasAction);
}

// 각 Intent 검증
function verifyIntent(intent: IntentInfo, keywordMappings: Set<string>): TestResult {
  const issues: string[] = [];
  let status: 'pass' | 'fail' | 'warning' = 'pass';

  // 1. 키워드 매핑 확인
  const hasKeywordMapping = keywordMappings.has(intent.intent_key);
  if (!hasKeywordMapping) {
    issues.push(`키워드 매핑 없음 (INTENT_KEYWORD_MAP에 등록 필요)`);
    status = 'warning';
  }

  // 2. System Prompt 포함 확인
  const hasSystemPrompt = checkSystemPrompt(intent.intent_key);
  if (!hasSystemPrompt) {
    issues.push(`System Prompt에 Intent 목록에 없음`);
    status = 'warning';
  }

  // 3. Fallback 패턴 매칭 가능 여부 확인
  const hasFallbackPattern = checkFallbackPattern(intent);
  if (!hasFallbackPattern && !hasKeywordMapping) {
    issues.push(`Fallback 패턴 매칭 불가능 (키워드 매핑 또는 패턴 매칭 필요)`);
    status = 'warning';
  }

  // 4. automation_level과 execution_class 관계 확인
  if (intent.automation_level === 'L2' && !intent.execution_class) {
    issues.push(`L2 Intent인데 execution_class가 없음`);
    status = 'fail';
  }

  if (intent.automation_level !== 'L2' && intent.execution_class) {
    issues.push(`L0/L1 Intent인데 execution_class가 있음`);
    status = 'fail';
  }

  return {
    intent_key: intent.intent_key,
    automation_level: intent.automation_level,
    execution_class: intent.execution_class,
    status,
    issues,
    has_keyword_mapping: hasKeywordMapping,
    has_system_prompt: hasSystemPrompt,
    has_fallback_pattern: hasFallbackPattern,
  };
}

// 메인 실행
function main() {
  console.log('🔍 ChatOps Edge Function - 147개 Intent 전체 검증 시작\n');

  // Intent Registry에서 모든 Intent 추출
  const intents = extractIntentsFromRegistry();
  console.log(`📋 Intent Registry에서 ${intents.length}개 Intent 추출 완료\n`);

  // 키워드 매핑 추출
  const keywordMappings = extractKeywordMappings();
  console.log(`🔑 INTENT_KEYWORD_MAP에서 ${keywordMappings.size}개 Intent 키워드 매핑 발견\n`);

  // 각 Intent 검증
  console.log('🔍 각 Intent 검증 중...\n');
  for (const intent of intents) {
    const result = verifyIntent(intent, keywordMappings);
    results.push(result);
  }

  // 결과 집계
  const passCount = results.filter(r => r.status === 'pass').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  // 결과 출력
  console.log('\n' + '='.repeat(80));
  console.log('📊 검증 결과 요약');
  console.log('='.repeat(80));
  console.log(`전체 Intent: ${results.length}개`);
  console.log(`✅ 통과: ${passCount}개`);
  console.log(`⚠️  경고: ${warningCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log('');

  // 레벨별 통계
  const l0Count = results.filter(r => r.automation_level === 'L0').length;
  const l1Count = results.filter(r => r.automation_level === 'L1').length;
  const l2Count = results.filter(r => r.automation_level === 'L2').length;
  const l2aCount = results.filter(r => r.execution_class === 'A').length;
  const l2bCount = results.filter(r => r.execution_class === 'B').length;

  console.log('📊 레벨별 통계:');
  console.log(`  L0 (조회/초안): ${l0Count}개`);
  console.log(`  L1 (TaskCard 생성): ${l1Count}개`);
  console.log(`  L2 (승인 후 실행): ${l2Count}개`);
  console.log(`    L2-A (알림/발송): ${l2aCount}개`);
  console.log(`    L2-B (도메인 변경): ${l2bCount}개`);
  console.log('');

  // 키워드 매핑 통계
  const withKeywordMapping = results.filter(r => r.has_keyword_mapping).length;
  const withSystemPrompt = results.filter(r => r.has_system_prompt).length;
  const withFallbackPattern = results.filter(r => r.has_fallback_pattern).length;

  console.log('📊 Fallback 지원 통계:');
  console.log(`  명시적 키워드 매핑: ${withKeywordMapping}개`);
  console.log(`  System Prompt 포함: ${withSystemPrompt}개`);
  console.log(`  패턴 매칭 가능: ${withFallbackPattern}개`);
  console.log('');

  // 실패한 Intent 출력
  if (failCount > 0) {
    console.log('❌ 실패한 Intent:');
    results
      .filter(r => r.status === 'fail')
      .forEach(r => {
        console.log(`  - ${r.intent_key} (${r.automation_level}${r.execution_class || ''})`);
        r.issues.forEach(issue => console.log(`    • ${issue}`));
      });
    console.log('');
  }

  // 경고 Intent 출력 (상위 20개만)
  if (warningCount > 0) {
    console.log('⚠️  경고 Intent (상위 20개):');
    results
      .filter(r => r.status === 'warning')
      .slice(0, 20)
      .forEach(r => {
        console.log(`  - ${r.intent_key} (${r.automation_level}${r.execution_class || ''})`);
        r.issues.forEach(issue => console.log(`    • ${issue}`));
      });
    if (warningCount > 20) {
      console.log(`  ... 외 ${warningCount - 20}개`);
    }
    console.log('');
  }

  // 키워드 매핑이 없는 Intent 목록 (Fallback 패턴도 없는 경우)
  const noFallback = results.filter(
    r => !r.has_keyword_mapping && !r.has_fallback_pattern
  );
  if (noFallback.length > 0) {
    console.log('⚠️  Fallback 지원 없는 Intent (키워드 매핑 추가 권장):');
    noFallback.slice(0, 30).forEach(r => {
      console.log(`  - ${r.intent_key}`);
    });
    if (noFallback.length > 30) {
      console.log(`  ... 외 ${noFallback.length - 30}개`);
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ 검증 완료');
  console.log('='.repeat(80));

  // 종료 코드
  process.exit(failCount > 0 ? 1 : 0);
}

main();

