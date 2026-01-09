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
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='task_cards']",
        message: 'task_cards 직접 조회 금지. @hooks/use-task-card의 useTaskCards()를 사용하세요.',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='attendance_logs']",
        message: 'attendance_logs 직접 조회 금지. @hooks/use-attendance의 useAttendanceLogs()를 사용하세요.',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='invoices']",
        message: 'invoices 직접 조회 금지. @hooks/use-billing의 useBillingHistory() 또는 useInvoice()를 사용하세요.',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='student_classes']",
        message: 'student_classes 직접 조회 금지. @hooks/use-class의 useClasses()를 사용하세요.',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='payments']",
        message: 'payments 직접 조회 금지. @hooks/use-payments의 usePayments() 또는 fetchPayments()를 사용하세요.',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='invoice_items']",
        message: 'invoice_items 직접 조회 금지. @hooks/use-invoice-items의 useInvoiceItems() 또는 fetchInvoiceItems()를 사용하세요.',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='notification_templates']",
        message: 'notification_templates 직접 조회 금지. @hooks/use-notification-templates의 useNotificationTemplates() 또는 fetchNotificationTemplates()를 사용하세요.',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='ai_insights']",
        message: 'ai_insights 직접 조회 금지. @hooks/use-ai-insights의 useAIInsights() 또는 fetchAIInsights()를 사용하세요.',
      },
      {
        selector: "CallExpression[callee.object.name='apiClient'][callee.property.name='get'][arguments.0.value='daily_region_metrics']",
        message: 'daily_region_metrics 직접 조회 금지. @hooks/use-daily-region-metrics의 useDailyRegionMetrics() 또는 fetchDailyRegionMetrics()를 사용하세요.',
      },
    ],
  },
};
