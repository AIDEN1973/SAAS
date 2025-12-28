#!/usr/bin/env tsx
/**
 * Intent Examples 기반 매칭 테스트 스크립트
 *
 * 검증 항목:
 * 1. extractIntentCandidates 함수가 examples를 올바르게 사용하는지 확인
 * 2. 다양한 발화 예시로 Intent 매칭 정확도 검증
 * 3. 후보 추출 점수 및 순위 확인
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { getAllIntents } from '../packages/chatops-intents/src/registry';

// Edge Function의 extractIntentCandidates 로직을 재현
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

    // 1. examples 필드 기반 매칭 (가장 높은 가중치)
    let hasExampleMatch = false;
    let bestExampleScore = 0;
    if (intent.examples && intent.examples.length > 0) {
      for (const example of intent.examples) {
        const lowerExample = example.toLowerCase();
        let exampleScore = 0;

        // 정확히 일치 (최고 점수)
        if (lowerMessage === lowerExample) {
          exampleScore = 30; // 점수 증가
          hasExampleMatch = true;
          reasons.push(`예시 정확 일치: "${example}"`);
        }
        // 부분 일치 (최소 길이 요구사항 추가)
        else if (lowerExample.length >= 5 && (lowerMessage.includes(lowerExample) || lowerExample.includes(lowerMessage))) {
          // 부분 일치 시 길이 비율에 따라 점수 조정
          const overlapRatio = Math.min(lowerMessage.length, lowerExample.length) / Math.max(lowerMessage.length, lowerExample.length);
          if (overlapRatio >= 0.7) { // 60% -> 70%로 강화
            exampleScore = Math.floor(12 * overlapRatio); // 8 -> 12로 증가
            hasExampleMatch = true;
            reasons.push(`예시 부분 일치: "${example}" (${Math.floor(overlapRatio * 100)}%)`);
          }
        }
        // 키워드 일치 (최소 2개 이상 키워드 매칭 요구, 중요 키워드 가중치)
        else {
          const exampleWords = lowerExample.split(/\s+/).filter(w => w.length >= 2);
          const matchedWords = exampleWords.filter(word => lowerMessage.includes(word));

          // 중요 키워드 확인 (도메인 특화 키워드)
          const importantKeywords = ['지각', '결석', '출석', '출결', '연체', '미납', '프로필', '검색'];
          const matchedImportant = matchedWords.filter(w => importantKeywords.some(kw => w.includes(kw) || kw.includes(w)));

          if (matchedWords.length >= 2) {
            // 중요 키워드가 매칭되면 추가 점수
            const baseScore = matchedWords.length * 2;
            const importantBonus = matchedImportant.length * 3;
            exampleScore = baseScore + importantBonus;
            hasExampleMatch = true;
            reasons.push(`예시 키워드 일치: ${matchedWords.join(', ')}${matchedImportant.length > 0 ? ` (중요 키워드: ${matchedImportant.join(', ')})` : ''}`);
          }
        }

        // 최고 점수 업데이트 (여러 examples 중 최고 점수만 사용)
        if (exampleScore > bestExampleScore) {
          bestExampleScore = exampleScore;
        }
      }

      // 최고 점수만 추가 (중복 점수 방지)
      score += bestExampleScore;
    }

    // 2. description 기반 매칭 (examples 매칭이 없을 때만 높은 점수)
    if (intent.description) {
      const lowerDesc = intent.description.toLowerCase();
      if (lowerMessage.includes(lowerDesc)) {
        if (hasExampleMatch) {
          score += 1; // examples가 있으면 낮은 점수
        } else {
          score += 5; // examples가 없으면 높은 점수
        }
        reasons.push(`설명 일치: "${intent.description}"`);
      }
    }

    // 점수가 0보다 크면 후보에 추가
    if (score > 0) {
      candidates.push({
        intent_key: intentKey,
        score,
        reason: reasons.join('; '),
      });
    }
  }

  // 점수 내림차순 정렬 후 상위 N개 반환
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxCandidates);
}

// 테스트 케이스
const testCases = [
  { message: '지각한 학생 조회', expectedIntent: 'attendance.query.late' },
  { message: '오늘 지각한 애들 보여줘', expectedIntent: 'attendance.query.late' },
  { message: '지각학생조회', expectedIntent: 'attendance.query.late' },
  { message: '늦게 온 사람들', expectedIntent: 'attendance.query.late' },
  { message: '연체 목록 조회', expectedIntent: 'billing.query.overdue_list' },
  { message: '미납자 목록', expectedIntent: 'billing.query.overdue_list' },
  { message: '돈 안낸 사람', expectedIntent: 'billing.query.overdue_list' },
  { message: '박소영 검색', expectedIntent: 'student.query.search' },
  { message: '학생 검색', expectedIntent: 'student.query.search' },
  { message: '박소영 프로필', expectedIntent: 'student.query.profile' },
  { message: '박소영 전화번호', expectedIntent: 'student.query.profile' },
];

// Registry에서 Intent 목록 읽기
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

console.log('🧪 Intent Examples 기반 매칭 테스트 시작...\n');
console.log(`📋 테스트 케이스: ${testCases.length}개\n`);

let passCount = 0;
let failCount = 0;

for (const testCase of testCases) {
  const candidates = extractIntentCandidates(testCase.message, intentRegistry, 5);
  const topCandidate = candidates[0];

  if (topCandidate && topCandidate.intent_key === testCase.expectedIntent) {
    console.log(`✅ "${testCase.message}"`);
    console.log(`   → ${topCandidate.intent_key} (점수: ${topCandidate.score})`);
    console.log(`   이유: ${topCandidate.reason.substring(0, 80)}...\n`);
    passCount++;
  } else {
    console.log(`❌ "${testCase.message}"`);
    console.log(`   예상: ${testCase.expectedIntent}`);
    if (topCandidate) {
      console.log(`   실제: ${topCandidate.intent_key} (점수: ${topCandidate.score})`);
      console.log(`   상위 3개 후보:`);
      candidates.slice(0, 3).forEach((c, i) => {
        console.log(`     ${i + 1}. ${c.intent_key} (점수: ${c.score})`);
      });
    } else {
      console.log(`   실제: 후보 없음`);
    }
    console.log('');
    failCount++;
  }
}

console.log('='.repeat(60));
console.log('📊 테스트 결과 요약:');
console.log(`   ✅ 통과: ${passCount}개`);
console.log(`   ❌ 실패: ${failCount}개`);
console.log(`   정확도: ${((passCount / testCases.length) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (failCount > 0) {
  process.exit(1);
}

