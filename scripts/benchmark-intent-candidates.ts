#!/usr/bin/env tsx
/**
 * Intent 후보 추출 성능 벤치마크 스크립트
 *
 * 측정 항목:
 * 1. 후보 추출 시간 (147개 Intent 기준)
 * 2. 평균 후보 수
 * 3. 점수 분포
 */

import { getAllIntents } from '../packages/chatops-intents/src/registry';

// Edge Function의 extractIntentCandidates 로직 재현
function extractIntentCandidates(
  message: string,
  intentRegistry: Record<string, any>,
  maxCandidates: number = 10
): Array<{ intent_key: string; score: number; reason: string }> {
  const lowerMessage = message.toLowerCase();
  const candidates: Array<{ intent_key: string; score: number; reason: string }> = [];

  for (const [intentKey, intent] of Object.entries(intentRegistry)) {
    let score = 0;
    const reasons: string[] = [];

    // 1. examples 필드 기반 매칭
    if (intent.examples && intent.examples.length > 0) {
      for (const example of intent.examples) {
        const lowerExample = example.toLowerCase();
        if (lowerMessage === lowerExample) {
          score += 10;
          reasons.push(`예시 정확 일치: "${example}"`);
        } else if (lowerMessage.includes(lowerExample) || lowerExample.includes(lowerMessage)) {
          score += 5;
          reasons.push(`예시 부분 일치: "${example}"`);
        } else {
          const exampleWords = lowerExample.split(/\s+/);
          const matchedWords = exampleWords.filter(word => lowerMessage.includes(word));
          if (matchedWords.length > 0) {
            score += matchedWords.length;
            reasons.push(`예시 키워드 일치: ${matchedWords.join(', ')}`);
          }
        }
      }
    }

    // 2. description 기반 매칭
    if (intent.description) {
      const lowerDesc = intent.description.toLowerCase();
      if (lowerMessage.includes(lowerDesc)) {
        score += 3;
        reasons.push(`설명 일치: "${intent.description}"`);
      }
    }

    if (score > 0) {
      candidates.push({
        intent_key: intentKey,
        score,
        reason: reasons.join('; '),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxCandidates);
}

// Registry 준비
const allIntents = getAllIntents();
const intentRegistry: Record<string, any> = {};

for (const intent of allIntents) {
  intentRegistry[intent.intent_key] = {
    intent_key: intent.intent_key,
    automation_level: intent.automation_level,
    description: intent.description,
    examples: intent.examples || [],
  };
}

// 벤치마크 테스트 메시지
const testMessages = [
  '지각한 학생 조회',
  '연체 목록 조회',
  '박소영 검색',
  '오늘 지각한 애들 보여줘',
  '돈 안낸 사람',
  '미납자 목록',
  '학생 프로필 조회',
  '출결 조회',
  '결제 내역 확인',
  '반 목록 보여줘',
];

console.log('⚡ Intent 후보 추출 성능 벤치마크 시작...\n');
console.log(`📋 테스트 메시지: ${testMessages.length}개`);
console.log(`📊 Intent Registry: ${Object.keys(intentRegistry).length}개\n`);

const results: Array<{
  message: string;
  time: number;
  candidateCount: number;
  topScore: number;
}> = [];

for (const message of testMessages) {
  const startTime = performance.now();
  const candidates = extractIntentCandidates(message, intentRegistry, 10);
  const endTime = performance.now();
  const time = endTime - startTime;

  results.push({
    message,
    time,
    candidateCount: candidates.length,
    topScore: candidates[0]?.score || 0,
  });
}

// 결과 요약
const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
const avgCandidates = results.reduce((sum, r) => sum + r.candidateCount, 0) / results.length;
const maxTime = Math.max(...results.map(r => r.time));
const minTime = Math.min(...results.map(r => r.time));

console.log('='.repeat(60));
console.log('📊 성능 측정 결과:');
console.log(`   평균 추출 시간: ${avgTime.toFixed(2)}ms`);
console.log(`   최소 시간: ${minTime.toFixed(2)}ms`);
console.log(`   최대 시간: ${maxTime.toFixed(2)}ms`);
console.log(`   평균 후보 수: ${avgCandidates.toFixed(1)}개`);
console.log('='.repeat(60));

console.log('\n📋 상세 결과:');
results.forEach((r, i) => {
  console.log(`\n${i + 1}. "${r.message}"`);
  console.log(`   시간: ${r.time.toFixed(2)}ms`);
  console.log(`   후보 수: ${r.candidateCount}개`);
  console.log(`   최고 점수: ${r.topScore}`);
});

console.log('\n✅ 벤치마크 완료!');

