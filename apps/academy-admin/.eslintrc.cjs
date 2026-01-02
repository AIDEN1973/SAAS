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
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
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
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='payments']",
        message: 'payments 직접 조회 금지. @hooks/use-payments의 usePayments() 또는 fetchPayments()를 사용하세요. (import { usePayments, fetchPayments } from "@hooks/use-payments")',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='invoice_items']",
        message: 'invoice_items 직접 조회 금지. @hooks/use-invoice-items의 useInvoiceItems() 또는 fetchInvoiceItems()를 사용하세요. (import { useInvoiceItems, fetchInvoiceItems } from "@hooks/use-invoice-items")',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='notification_templates']",
        message: 'notification_templates 직접 조회 금지. @hooks/use-notification-templates의 useNotificationTemplates() 또는 fetchNotificationTemplates()를 사용하세요. (import { useNotificationTemplates, fetchNotificationTemplates } from "@hooks/use-notification-templates")',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='ai_insights']",
        message: 'ai_insights 직접 조회 금지. @hooks/use-ai-insights의 useAIInsights() 또는 fetchAIInsights()를 사용하세요. (import { useAIInsights, fetchAIInsights } from "@hooks/use-ai-insights")',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='daily_region_metrics']",
        message: 'daily_region_metrics 직접 조회 금지. @hooks/use-daily-region-metrics의 useDailyRegionMetrics() 또는 fetchDailyRegionMetrics()를 사용하세요. (import { useDailyRegionMetrics, fetchDailyRegionMetrics } from "@hooks/use-daily-region-metrics")',
      },
    ],
  },
};

