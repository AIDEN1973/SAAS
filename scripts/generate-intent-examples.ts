#!/usr/bin/env tsx
/**
 * Intent Registry Examples 자동 생성 스크립트
 *
 * 목적: 모든 Intent(147개)에 발화 예시(examples)를 자동으로 생성하여 Registry에 반영
 *
 * [불변 규칙] SSOT 준수: Registry가 정본, 프론트는 판정 로직 금지
 * [불변 규칙] PII 금지: 실제 전화번호/계좌/주민번호/주소 패턴 제거
 * [불변 규칙] 품질 게이트: 다양성 점수, 중복 제거, 민감정보 필터링
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getAllIntents, type IntentRegistryItem } from '../packages/chatops-intents/src/registry';

// 환경변수 중앙 관리 시스템 사용
let OPENAI_API_KEY: string | undefined;
try {
  // env-registry를 통해 환경변수 가져오기
  // scripts 폴더에서 실행되므로 상대 경로 조정
  const envRegistryPath = join(process.cwd(), 'packages/env-registry/src/server');
  const { envServer } = require(envRegistryPath);
  OPENAI_API_KEY = envServer.OPENAI_API_KEY;
  if (OPENAI_API_KEY) {
    console.log('[env-registry] OPENAI_API_KEY 로드 성공 (env-registry 사용)');
  }
} catch (error) {
  // env-registry 로드 실패 시 process.env에서 직접 가져오기 (fallback)
  OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (OPENAI_API_KEY) {
    console.warn('[env-registry] env-registry 로드 실패, process.env에서 직접 사용');
  }
}

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_COUNT = parseInt(process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1] || '8', 10);
const ONLY_MISSING = process.argv.includes('--only-missing');

if (!OPENAI_API_KEY && !DRY_RUN) {
  console.error('❌ OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  console.error('   프로젝트 루트의 .env.local 파일에 OPENAI_API_KEY를 설정하세요.');
  console.error('   또는 --dry-run 옵션을 사용하여 샘플 생성 모드로 실행할 수 있습니다.');
  process.exit(1);
}

// Registry 파일 경로
const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');

// 품질 게이트 설정
const QUALITY_GATES = {
  MIN_EXAMPLES: 6,
  TARGET_EXAMPLES: TARGET_COUNT,
  MAX_LENGTH: 200,
  MAX_RETRIES: 3,
  MIN_DIVERSITY_SCORE: 0.25, // 토큰 다양성 최소 점수 (0.3은 너무 엄격)
};

// 민감정보 패턴 (한국 기준)
const PII_PATTERNS = [
  // 휴대폰 번호 (010-1234-5678, 01012345678 등)
  /\d{3}[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
  // 주민번호 패턴
  /\d{6}[-]\d{7}/g,
  // 계좌번호 유사 패턴 (10자리 이상 연속 숫자)
  /\d{10,}/g,
  // 이메일 패턴
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // 주소 패턴 (시/도, 구/군 등)
  /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(시|도|특별시|광역시)/g,
];

/**
 * 민감정보 필터링
 */
function filterPII(text: string): boolean {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      return false; // PII 발견, 제거
    }
  }
  return true; // PII 없음, 통과
}

/**
 * 텍스트 정규화 (중복 검사용)
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // 다중 공백을 단일 공백으로
    .toLowerCase();
}

/**
 * 유사도 계산 (간단한 편집거리 기반)
 */
function similarity(text1: string, text2: string): number {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);

  if (norm1 === norm2) return 1.0;

  // 간단한 토큰 기반 유사도
  const tokens1 = new Set(norm1.split(/\s+/));
  const tokens2 = new Set(norm2.split(/\s+/));

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * 다양성 점수 계산
 */
function calculateDiversityScore(examples: string[]): number {
  if (examples.length < 2) return 1.0;

  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < examples.length; i++) {
    for (let j = i + 1; j < examples.length; j++) {
      totalSimilarity += similarity(examples[i], examples[j]);
      comparisons++;
    }
  }

  const avgSimilarity = totalSimilarity / comparisons;
  return 1.0 - avgSimilarity; // 다양성 = 1 - 평균 유사도
}

/**
 * 품질 게이트 통과 검사
 */
function passesQualityGate(examples: string[]): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  // 1. 최소 개수 확인
  if (examples.length < QUALITY_GATES.MIN_EXAMPLES) {
    issues.push(`예시 개수 부족: ${examples.length}개 (최소 ${QUALITY_GATES.MIN_EXAMPLES}개 필요)`);
  }

  // 2. 길이 제한 확인
  const tooLong = examples.filter(ex => ex.length > QUALITY_GATES.MAX_LENGTH);
  if (tooLong.length > 0) {
    issues.push(`길이 초과 예시 ${tooLong.length}개 발견`);
  }

  // 3. 중복 확인
  const normalized = examples.map(normalizeText);
  const unique = new Set(normalized);
  if (unique.size < examples.length) {
    issues.push(`중복 예시 ${examples.length - unique.size}개 발견`);
  }

  // 4. 유사도 확인 (너무 비슷한 문장 제거)
  const tooSimilar: string[] = [];
  for (let i = 0; i < examples.length; i++) {
    for (let j = i + 1; j < examples.length; j++) {
      if (similarity(examples[i], examples[j]) > 0.8) {
        tooSimilar.push(`${i}와 ${j}`);
      }
    }
  }
  if (tooSimilar.length > 0) {
    issues.push(`유사도 높은 예시 쌍 ${tooSimilar.length}개 발견`);
  }

  // 5. 다양성 점수 확인 (예시가 3개 이상일 때만)
  if (examples.length >= 3) {
    const diversityScore = calculateDiversityScore(examples);
    if (diversityScore < QUALITY_GATES.MIN_DIVERSITY_SCORE) {
      issues.push(`다양성 점수 부족: ${diversityScore.toFixed(2)} (최소 ${QUALITY_GATES.MIN_DIVERSITY_SCORE} 필요)`);
    }
  }

  // 6. PII 확인
  const hasPII = examples.filter(ex => !filterPII(ex));
  if (hasPII.length > 0) {
    issues.push(`민감정보 포함 예시 ${hasPII.length}개 발견`);
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * 예시 필터링 및 정제
 */
function filterAndCleanExamples(examples: string[]): string[] {
  return examples
    .map(ex => ex.trim())
    .filter(ex => ex.length > 0) // 빈 문자열 제거
    .filter(ex => ex.length <= QUALITY_GATES.MAX_LENGTH) // 길이 제한
    .filter(filterPII) // PII 제거
    .filter((ex, idx, arr) => {
      // 중복 제거 (정규화 후)
      const normalized = normalizeText(ex);
      return arr.findIndex(e => normalizeText(e) === normalized) === idx;
    })
    .filter((ex, idx, arr) => {
      // 유사도 높은 문장 제거 (0.8 이상)
      return !arr.some((other, otherIdx) =>
        otherIdx !== idx && similarity(ex, other) > 0.8
      );
    });
}

/**
 * LLM을 통한 예시 생성
 */
async function generateExamplesWithLLM(
  intentKey: string,
  intent: IntentRegistryItem,
  retryReason?: string
): Promise<string[]> {
  const { description, automation_level, execution_class } = intent;
  const prompt = `당신은 기관 관리 시스템의 AI 어시스턴트입니다.

다음 Intent에 대한 사용자 발화 예시를 생성하세요.

Intent 정보:
- intent_key: ${intentKey}
- description: ${description}
- automation_level: ${automation_level}
${execution_class ? `- execution_class: ${execution_class}` : ''}
${retryReason ? `\n이전 생성 시도에서 다음 이슈가 발견되었습니다:\n${retryReason}\n\n이를 해결하여 더 나은 예시를 생성하세요.` : ''}

요구사항:
1. 이 Intent에 대한 사용자가 실제로 입력할 법한 자연어 문장을 생성하세요.
2. 발화 스타일을 다양하게 섞어서 생성하세요:
   - 짧은 명령형: "지각한 학생 조회"
   - 구어체: "지각한 애들 보여줘"
   - 띄어쓰기/축약: "지각학생조회"
   - 동의어/유의어: "늦게 온 사람들", "늦은 학생 목록"
   - 조건 포함: "오늘 지각한 학생", "이번 주 지각자"
3. 업종 중립: "학생" 대신 "대상", "원생", "회원", "수강생" 등 다양한 표현 사용
4. 절대 금지:
   - 실제 전화번호, 계좌번호, 주민번호, 주소 패턴 포함 금지
   - 실제 사람 이름 사용 금지 (예: "김철수" 대신 "학생 A", "대상" 등)
   - intent_key를 새로 만들지 말 것 (주어진 intent만 사용)
5. 출력 형식: JSON 배열만 출력하세요. 다른 설명 없이 string[] 형식으로만 출력하세요.

생성할 예시 개수: ${QUALITY_GATES.TARGET_EXAMPLES}개

출력 (JSON 배열만):`;

  if (DRY_RUN) {
    // Dry-run 모드: 샘플 생성
    return [
      `${description} 조회`,
      `${description} 확인`,
      `${description} 보여줘`,
      `${description} 찾기`,
      `${description} 검색`,
      `${description} 목록`,
      `${description} 내역`,
      `${description} 정보`,
    ];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates user utterance examples for a Korean educational management system. Always respond with a valid JSON array of strings only, no other text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // JSON 배열 파싱 (마크다운 코드 블록 제거)
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*(\[.*?\])\s*```/s);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    const examples = JSON.parse(jsonContent);

    if (!Array.isArray(examples) || !examples.every(ex => typeof ex === 'string')) {
      throw new Error('Invalid response format: expected string array');
    }

    return examples;
  } catch (error) {
    console.error(`[${intentKey}] LLM 생성 실패:`, error);
    throw error;
  }
}

/**
 * Intent에 예시 생성 (재시도 포함)
 */
async function generateExamplesForIntent(
  intentKey: string,
  intent: IntentRegistryItem,
  existingExamples?: string[]
): Promise<string[]> {
  let examples: string[] = existingExamples || [];
  let retries = 0;
  let lastError: Error | null = null;

  while (retries < QUALITY_GATES.MAX_RETRIES) {
    try {
      // 기존 예시가 있고 충분하면 재생성 스킵
      if (examples.length >= QUALITY_GATES.TARGET_EXAMPLES) {
        const quality = passesQualityGate(examples);
        if (quality.passed) {
          return filterAndCleanExamples(examples);
        }
      }

      // LLM으로 예시 생성
      let retryReason: string | undefined = undefined;
      if (retries > 0 && examples.length > 0) {
        const prevQuality = passesQualityGate(examples);
        retryReason = prevQuality.issues.join('; ');
      }
      const generated = await generateExamplesWithLLM(
        intentKey,
        intent,
        retryReason
      );

      // 기존 예시와 병합
      examples = [...(existingExamples || []), ...generated];

      // 필터링 및 정제
      examples = filterAndCleanExamples(examples);

      // 품질 게이트 확인
      const qualityCheck = passesQualityGate(examples);

      if (qualityCheck.passed) {
        return examples.slice(0, QUALITY_GATES.TARGET_EXAMPLES);
      }

      // 품질 게이트 실패 시 재시도
      console.warn(`[${intentKey}] 품질 게이트 실패 (시도 ${retries + 1}/${QUALITY_GATES.MAX_RETRIES}):`, qualityCheck.issues);
      retries++;

      // 재시도 시 더 많은 예시 생성 요청
      if (retries < QUALITY_GATES.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
      }
    } catch (error) {
      lastError = error as Error;
      retries++;
      if (retries < QUALITY_GATES.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // 최대 재시도 후에도 실패하면 가능한 범위에서 반환
  if (examples.length > 0) {
    console.warn(`[${intentKey}] 최대 재시도 후 부분 성공: ${examples.length}개 예시`);
    return filterAndCleanExamples(examples).slice(0, QUALITY_GATES.TARGET_EXAMPLES);
  }

  throw lastError || new Error('Failed to generate examples');
}

/**
 * Registry에서 Intent 목록 읽기
 */
function readRegistry(): { content: string; intents: Map<string, IntentRegistryItem & { existingExamples?: string[] }> } {
  const content = readFileSync(REGISTRY_PATH, 'utf-8');
  const allIntents = getAllIntents();

  const intents = new Map<string, IntentRegistryItem & { existingExamples?: string[] }>();

  // 각 Intent의 기존 examples 추출 (파일에서 직접 파싱)
  for (const intent of allIntents) {
    const intentKey = intent.intent_key;
    const intentPattern = new RegExp(`'${intentKey.replace(/\./g, '\\.')}':\\s*\\{([\\s\\S]*?)\\},`, 'm');
    const match = content.match(intentPattern);

    let existingExamples: string[] | undefined;
    if (match) {
      const examplesMatch = match[1].match(/examples:\s*\[([\s\S]*?)\]/);
      if (examplesMatch) {
        existingExamples = examplesMatch[1]
          .split(',')
          .map(ex => ex.trim().replace(/^['"]|['"]$/g, ''))
          .filter(ex => ex.length > 0);
      }
    }

    intents.set(intentKey, {
      ...intent,
      existingExamples,
    });
  }

  return { content, intents };
}

/**
 * Registry 파일 업데이트
 */
function updateRegistry(
  originalContent: string,
  intentExamples: Map<string, string[]>
): string {
  let updatedContent = originalContent;

  for (const [intentKey, examples] of intentExamples.entries()) {
    const examplesStr = examples.map(ex => `      '${ex.replace(/'/g, "\\'")}'`).join(',\n');
    const examplesBlock = `    examples: [\n${examplesStr},\n    ],`;

    // Intent 블록 찾기 (더 정확한 패턴)
    const escapedKey = intentKey.replace(/\./g, '\\.');
    // taskcard 필드 뒤에 examples를 추가하거나 교체
    const intentPattern = new RegExp(
      `('${escapedKey}':\\s*\\{[\\s\\S]*?)(taskcard:\\s*\\{[\\s\\S]*?\\},)([\\s\\S]*?)(warnings?:\\s*\\[[\\s\\S]*?\\],)?([\\s\\S]*?)(examples?:\\s*\\[[\\s\\S]*?\\],)?([\\s\\S]*?)(\\},)`,
      'm'
    );
    const match = updatedContent.match(intentPattern);

    if (match) {
      // examples 필드가 이미 있으면 교체
      if (match[6]) {
        const beforeExamples = match[1] + match[2] + match[3] + (match[4] || '');
        const afterExamples = match[7] + match[8];
        updatedContent = updatedContent.replace(
          match[0],
          beforeExamples + '\n' + examplesBlock + '\n' + afterExamples
        );
      } else {
        // examples 필드 추가 (taskcard 뒤, warnings 앞 또는 끝에)
        const beforeExamples = match[1] + match[2] + match[3] + (match[4] || '');
        const afterExamples = match[5] + match[7] + match[8];
        updatedContent = updatedContent.replace(
          match[0],
          beforeExamples + '\n' + examplesBlock + '\n' + afterExamples
        );
      }
    } else {
      console.warn(`[${intentKey}] Intent 블록을 찾을 수 없습니다. 수동으로 추가해야 합니다.`);
    }
  }

  return updatedContent;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 Intent Registry Examples 자동 생성 시작...\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY-RUN 모드: 실제 LLM 호출 없이 샘플 생성\n');
  }

  // Registry 읽기
  console.log('📖 Registry 파일 읽기...');
  const { content: originalContent, intents } = readRegistry();
  console.log(`   총 ${intents.size}개 Intent 발견\n`);

  // 처리할 Intent 필터링
  const intentsToProcess = Array.from(intents.entries()).filter(([key, intent]) => {
    if (ONLY_MISSING && intent.existingExamples && intent.existingExamples.length > 0) {
      return false; // 이미 examples가 있으면 스킵
    }
    return true;
  });

  console.log(`📝 처리할 Intent: ${intentsToProcess.length}개\n`);

  const results = new Map<string, { examples: string[]; status: 'success' | 'partial' | 'failed'; error?: string }>();
  const lowConfidence: string[] = [];

  // 각 Intent에 대해 예시 생성
  for (let i = 0; i < intentsToProcess.length; i++) {
    const [intentKey, intentInfo] = intentsToProcess[i];
    console.log(`[${i + 1}/${intentsToProcess.length}] ${intentKey} 처리 중...`);

    try {
      const examples = await generateExamplesForIntent(
        intentKey,
        intentInfo,
        intentInfo.existingExamples
      );

      const quality = passesQualityGate(examples);

      if (quality.passed && examples.length >= QUALITY_GATES.MIN_EXAMPLES) {
        results.set(intentKey, { examples, status: 'success' });
        console.log(`   ✅ 성공: ${examples.length}개 예시 생성`);
      } else {
        results.set(intentKey, { examples, status: 'partial' });
        lowConfidence.push(intentKey);
        console.log(`   ⚠️  부분 성공: ${examples.length}개 예시 (품질 이슈: ${quality.issues.join(', ')})`);
      }
    } catch (error) {
      results.set(intentKey, {
        examples: [],
        status: 'failed',
        error: (error as Error).message,
      });
      lowConfidence.push(intentKey);
      console.log(`   ❌ 실패: ${(error as Error).message}`);
    }

    // API 호출 제한 방지를 위한 대기
    if (i < intentsToProcess.length - 1 && !DRY_RUN) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 결과 요약
  console.log('\n📊 생성 결과 요약:');
  console.log(`   성공: ${Array.from(results.values()).filter(r => r.status === 'success').length}개`);
  console.log(`   부분 성공: ${Array.from(results.values()).filter(r => r.status === 'partial').length}개`);
  console.log(`   실패: ${Array.from(results.values()).filter(r => r.status === 'failed').length}개`);

  if (lowConfidence.length > 0) {
    console.log(`\n⚠️  Low Confidence Intent (${lowConfidence.length}개):`);
    lowConfidence.forEach(key => console.log(`   - ${key}`));

    // low_confidence.txt 파일에 저장
    const lowConfidencePath = join(process.cwd(), 'scripts/low_confidence_intents.txt');
    writeFileSync(lowConfidencePath, lowConfidence.join('\n'), 'utf-8');
    console.log(`\n   📄 ${lowConfidencePath}에 저장됨`);
  }

  // Registry 업데이트
  if (!DRY_RUN) {
    console.log('\n💾 Registry 파일 업데이트 중...');
    const examplesMap = new Map<string, string[]>();
    for (const [key, result] of results.entries()) {
      if (result.examples.length > 0) {
        examplesMap.set(key, result.examples);
      }
    }

    const updatedContent = updateRegistry(originalContent, examplesMap);
    writeFileSync(REGISTRY_PATH, updatedContent, 'utf-8');
    console.log('   ✅ Registry 파일 업데이트 완료');

    // Prettier 포맷팅 적용
    try {
      const { execSync } = require('child_process');
      execSync(`npx prettier --write "${REGISTRY_PATH}"`, { stdio: 'inherit' });
      console.log('   ✅ Prettier 포맷팅 완료');
    } catch (formatError) {
      console.warn('   ⚠️  Prettier 포맷팅 실패 (수동 실행 필요):', (formatError as Error).message);
    }
  } else {
    console.log('\n⚠️  DRY-RUN 모드: Registry 파일 업데이트 스킵');
  }

  console.log('\n✨ 완료!');
}

// 실행
main().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error);
  process.exit(1);
});
