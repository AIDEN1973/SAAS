module.exports = {
  root: false,
  env: { browser: true, es2020: true },
  extends: [
    '../../.eslintrc.cjs',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'vite.config.ts'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@env-registry/core/server',
            message: '클라이언트 코드에서는 @env-registry/core/server를 import할 수 없습니다.',
          },
        ],
      },
    ],
    // ✅ 추가: task_cards 직접 조회 차단 (apiClient 객체 명시)
    // ⚠️ 주의: apiClient는 별칭 없이 사용해야 함 (import { apiClient } from '@api-sdk/core')
    // ⚠️ 한계: apiClient['get']('task_cards'), const { get } = apiClient 같은 패턴은 차단하지 못함
    //          별칭 사용(apiClient as client)도 차단하지 못하므로, 코드 리뷰에서 확인 필요
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='task_cards']",
        message: 'task_cards 직접 조회 금지. @hooks/use-task-card의 useTaskCards()를 사용하세요. (import { useTaskCards } from "@hooks/use-task-card")',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='attendance_logs']",
        message: 'attendance_logs 직접 조회 금지. @hooks/use-attendance의 useAttendanceLogs()를 사용하세요. (import { useAttendanceLogs } from "@hooks/use-attendance")',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='invoices']",
        message: 'invoices 직접 조회 금지. @hooks/use-billing의 useBillingHistory() 또는 useInvoice()를 사용하세요. (import { useBillingHistory, useInvoice } from "@hooks/use-billing")',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='student_classes']",
        message: 'student_classes 직접 조회 금지. @hooks/use-class의 useClasses()를 사용하세요. (import { useClasses } from "@hooks/use-class")',
      },
    ],
  },
};
