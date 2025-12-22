/**
 * ESLint no-restricted-syntax 규칙 템플릿
 *
 * 이 템플릿을 복사하여 apps/*/.eslintrc.cjs의 rules 섹션에 추가하세요.
 * selector와 message는 실제 Hook에 맞게 수정해야 합니다.
 */

module.exports = {
  // ... 기존 설정 ...
  rules: {
    // ... 기존 규칙 ...

    // ✅ 추가: [Hook 이름] 직접 조회 차단 (apiClient 객체 명시)
    // ⚠️ 주의: apiClient는 별칭 없이 사용해야 함 (import { apiClient } from '@api-sdk/core')
    // ⚠️ 한계: apiClient['get']('table_name'), const { get } = apiClient 같은 패턴은 차단하지 못함
    //          별칭 사용(apiClient as client)도 차단하지 못하므로, 코드 리뷰에서 확인 필요
    'no-restricted-syntax': [
      'error',
      {
        // ⚠️ 수정 필요: selector는 실제 패턴에 맞게 수정
        // 예: apiClient.get('task_cards') → "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='task_cards']"
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='table_name']",

        // ⚠️ 수정 필요: message는 실제 Hook에 맞게 수정
        // 예: 'task_cards 직접 조회 금지. @hooks/use-task-card의 useTaskCards()를 사용하세요. (import { useTaskCards } from "@hooks/use-task-card")'
        message: 'table_name 직접 조회 금지. @hooks/use-example의 useExample()를 사용하세요. (import { useExample } from "@hooks/use-example")',
      },
    ],
  },
};

/**
 * 사용 가이드:
 *
 * 1. 위 템플릿을 복사하여 apps/*/.eslintrc.cjs의 rules 섹션에 추가
 * 2. selector의 'table_name'을 실제 테이블명으로 변경
 * 3. message의 Hook 정보를 실제 Hook에 맞게 변경
 * 4. 여러 패턴을 차단해야 하는 경우, 배열에 여러 객체 추가 가능
 * 5. scripts/check-shared-catalog.ts로 ESLint 규칙 누락 확인
 */

/**
 * 예시: 여러 패턴을 차단하는 경우
 */
const multiplePatternsExample = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='task_cards']",
      message: 'task_cards 직접 조회 금지. @hooks/use-task-card의 useTaskCards()를 사용하세요.',
    },
    {
      selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='students']",
      message: 'students 직접 조회 금지. @hooks/use-student의 useStudents()를 사용하세요.',
    },
  ],
};

