/**
 * Shared Catalog (SSOT) - 공통화 요소 정본 인덱스
 *
 * [불변 규칙] 이 카탈로그에 없는 공통화 요소는 사용하지 않습니다.
 * [불변 규칙] 카탈로그 수정 시 관련 문서와 동기화 필수
 * [불변 규칙] 새 공통 로직(Hook/Feature/Adapter/Component) 추가 시 반드시 이 카탈로그에 항목 추가
 *
 * 목적: "처음부터 어디를 써야 하지?"를 자동으로 안내
 *
 * ⚠️ 중요: 이 파일은 런타임 import용이 아니라 정적 검사/가이드 SSOT입니다.
 *
 * 상태 정의:
 * - implemented: 구현 완료, 사용 가능
 * - planned: 계획됨, 아직 미구현
 * - deprecated: 더 이상 사용하지 않음 (레거시)
 */

/**
 * CatalogItem 상태 정의
 */
export type CatalogItemStatus = 'implemented' | 'planned' | 'deprecated';

export interface CatalogItem {
  path: string;
  import: string;
  status: CatalogItemStatus;
  useWhen: string;
  input?: string;
  output?: string;
  extensionPoints?: string[];
  doNot?: string[];
  examples?: string[];
  related?: {
    feature?: string;
    adapter?: string;
    hook?: string;
    component?: string;
  };
}

export interface SharedCatalog {
  hooks: Record<string, CatalogItem>;
  features: Record<string, CatalogItem>;
  adapters: Record<string, CatalogItem>;
  components: Record<string, CatalogItem>;
}

export const sharedCatalog: SharedCatalog = {
  hooks: {
    // ========================================
    // 학생 관리 관련 Hooks
    // ========================================
    'use-student': {
      path: 'packages/hooks/use-student/src/index.ts',
      import: 'import { useStudents, fetchStudents, useStudent, useCreateStudent, useUpdateStudent, useDeleteStudent, useGuardians, useConsultations, useStudentTaskCards } from "@hooks/use-student"',
      status: 'implemented',
      useWhen: '학생 목록 조회, 상담기록 조회, 보호자 조회, TaskCard 관리가 필요한 모든 페이지',
      input: 'useStudents(filter?: StudentFilter): 필터 객체',
      output: 'useStudents(): Student[], useStudentTaskCards(): StudentTaskCard[]',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("persons") 호출',
        '직접 apiClient.get("student_consultations") 호출',
        'useQuery로 persons 직접 조회',
      ],
      examples: [
        'const { data: students } = useStudents({ status: "active" });',
        'const { data: taskCards } = useStudentTaskCards();',
      ],
    },

    // ========================================
    // 수업/반 관리 관련 Hooks
    // ========================================
    'use-class': {
      path: 'packages/hooks/use-class/src/index.ts',
      import: 'import { useClasses, useClass, useCreateClass, useUpdateClass, useDeleteClass, useTeachers, useClassTeachers } from "@hooks/use-class"',
      status: 'implemented',
      useWhen: '수업/반 조회/생성/수정/삭제, 강사 관리가 필요한 모든 페이지',
      input: 'useClasses(filter?: ClassFilter): 필터 객체',
      output: 'useClasses(): Class[], useClass(): Class | null',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("classes") 호출',
        'useQuery로 classes 직접 조회',
      ],
      examples: [
        'const { data: classes } = useClasses({ status: "active" });',
        'const { data: teachers } = useTeachers();',
      ],
    },

    // ========================================
    // 출석 관리 관련 Hooks
    // ========================================
    'use-attendance': {
      path: 'packages/hooks/use-attendance/src/index.ts',
      import: 'import { useAttendanceLogs, useCreateAttendanceLog, useQRAttendance, fetchAttendanceLogs } from "@hooks/use-attendance"',
      status: 'implemented',
      useWhen: '출석 로그 조회/생성, QR 출석 처리가 필요한 모든 페이지',
      input: 'useAttendanceLogs(filter?: AttendanceFilter): 필터 객체',
      output: 'useAttendanceLogs(): AttendanceLog[], useQRAttendance(): QR 처리 함수',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("attendance_logs") 호출',
        'useQuery로 attendance_logs 직접 조회',
      ],
      examples: [
        'const { data: logs } = useAttendanceLogs({ student_id: studentId });',
        'const { verifyQR } = useQRAttendance(); await verifyQR(token);',
      ],
    },

    // ========================================
    // 설정 관련 Hooks
    // ========================================
    'use-config': {
      path: 'packages/hooks/use-config/src/index.ts',
      import: 'import { useConfig, useTenantSettingByPath, useUpdateConfig, useStoreLocation } from "@hooks/use-config"',
      status: 'implemented',
      useWhen: '테넌트 설정 조회/업데이트, 매장 위치 정보가 필요한 모든 페이지',
      input: 'useTenantSettingByPath(path: string): 경로 문자열',
      output: 'useConfig(): TenantConfig, useTenantSettingByPath(): unknown',
      extensionPoints: ['path'],
      doNot: [
        '직접 apiClient.get("tenant_settings") 호출',
        '하드코딩된 기본값 사용',
      ],
      examples: [
        'const { data: config } = useConfig();',
        'const { data: enabled } = useTenantSettingByPath("auto_notification.enabled");',
      ],
    },

    // ========================================
    // 청구/결제 관련 Hooks
    // ========================================
    'use-billing': {
      path: 'packages/hooks/use-billing/src/index.ts',
      import: 'import { useBillingHistory, useInvoice, useProcessPayment } from "@hooks/use-billing"',
      status: 'implemented',
      useWhen: '청구 내역/인보이스 조회, 결제 처리가 필요한 모든 페이지',
      input: 'useBillingHistory(filter?: BillingFilter): 필터 객체',
      output: 'useBillingHistory(): BillingHistoryItem[], useInvoice(): Invoice | null',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("invoices") 호출',
        'useQuery로 invoices 직접 조회',
      ],
      examples: [
        'const { data: history } = useBillingHistory({ tenant_id: tenantId });',
      ],
    },

    'use-payments': {
      path: 'packages/hooks/use-payments/src/index.ts',
      import: 'import { usePayments, fetchPayments } from "@hooks/use-payments"',
      status: 'implemented',
      useWhen: '결제 내역 조회가 필요한 모든 페이지',
      input: 'usePayments(filter?: PaymentFilter): 필터 객체',
      output: 'usePayments(): Payment[]',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("payments") 호출',
      ],
      examples: [
        'const { data: payments } = usePayments({ status: "failed" });',
      ],
    },

    'use-invoice-items': {
      path: 'packages/hooks/use-invoice-items/src/index.ts',
      import: 'import { useInvoiceItems, fetchInvoiceItems } from "@hooks/use-invoice-items"',
      status: 'implemented',
      useWhen: '청구서 항목 조회가 필요한 모든 페이지',
      input: 'useInvoiceItems(filter?: InvoiceItemFilter): 필터 객체',
      output: 'useInvoiceItems(): InvoiceItem[]',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("invoice_items") 호출',
      ],
      examples: [
        'const { data: items } = useInvoiceItems({ invoice_id: invoiceId });',
      ],
    },

    // ========================================
    // 대시보드/통계 관련 Hooks
    // ========================================
    'use-dashboard-stats': {
      path: 'packages/hooks/use-dashboard-stats/src/index.ts',
      import: 'import { useStudentStatsCards, useAttendanceStatsCards, useRevenueStatsCards, useClassStatsCards } from "@hooks/use-dashboard-stats"',
      status: 'implemented',
      useWhen: '대시보드 KPI 통계 카드 조회가 필요한 모든 페이지',
      input: '각 Hook별 선택적 파라미터',
      output: 'StatsCard[] (각 Hook별로 해당 도메인 통계 카드 배열)',
      extensionPoints: ['params'],
      doNot: [
        '직접 apiClient로 통계 데이터 조회',
        'useQuery로 통계 쿼리 직접 작성',
      ],
      examples: [
        'const { data: studentCards } = useStudentStatsCards();',
        'const { data: attendanceCards } = useAttendanceStatsCards();',
      ],
    },

    'use-daily-region-metrics': {
      path: 'packages/hooks/use-daily-region-metrics/src/index.ts',
      import: 'import { useDailyRegionMetrics, fetchDailyRegionMetrics } from "@hooks/use-daily-region-metrics"',
      status: 'implemented',
      useWhen: '지역 일일 통계 조회가 필요한 모든 페이지',
      input: 'useDailyRegionMetrics(filter?: DailyRegionMetricFilter): 필터 객체',
      output: 'useDailyRegionMetrics(): DailyRegionMetric[]',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("daily_region_metrics") 호출',
      ],
      examples: [
        'const { data: metrics } = useDailyRegionMetrics({ region_level: "dong" });',
      ],
    },

    'use-regional-stats-cards': {
      path: 'packages/hooks/use-regional-stats-cards/src/index.ts',
      import: 'import { useRegionalStatsCards } from "@hooks/use-regional-stats-cards"',
      status: 'implemented',
      useWhen: '지역 통계 카드 조회가 필요한 페이지 (Super Admin)',
      input: '없음',
      output: 'RegionalStatsCard[]',
      extensionPoints: [],
      doNot: [
        '직접 지역 통계 쿼리 작성',
      ],
      examples: [
        'const { data: regionalCards } = useRegionalStatsCards();',
      ],
    },

    // ========================================
    // AI/ChatOps 관련 Hooks
    // ========================================
    'use-chatops': {
      path: 'packages/hooks/use-chatops/src/index.ts',
      import: 'import { useChatOps } from "@hooks/use-chatops"',
      status: 'implemented',
      useWhen: 'ChatOps 메시지 전송이 필요한 모든 페이지',
      input: 'useChatOps(): React Query Mutation Hook',
      output: 'useChatOps(): UseMutationResult<ChatOpsResponse>',
      extensionPoints: ['message'],
      doNot: [
        '직접 apiClient.invokeFunction("chatops") 호출',
        'fetch로 Edge Function 직접 호출',
      ],
      examples: [
        'const chatOpsMutation = useChatOps();',
        'const response = await chatOpsMutation.mutateAsync("오늘 지각한 학생 목록 보여줘");',
      ],
      related: {
        component: 'chatops-panel',
      },
    },

    'use-ai-insights': {
      path: 'packages/hooks/use-ai-insights/src/index.ts',
      import: 'import { useAIInsights, fetchAIInsights } from "@hooks/use-ai-insights"',
      status: 'implemented',
      useWhen: 'AI 인사이트 조회가 필요한 모든 페이지',
      input: 'useAIInsights(filter?: AIInsightFilter): 필터 객체',
      output: 'useAIInsights(): AIInsight[]',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("ai_insights") 호출',
      ],
      examples: [
        'const { data: insights } = useAIInsights({ insight_type: "weekly_briefing" });',
      ],
    },

    'use-execution-audit': {
      path: 'packages/hooks/use-execution-audit/src/index.ts',
      import: 'import { useExecutionAuditRuns, useExecutionAuditRun, useExecutionAuditSteps } from "@hooks/use-execution-audit"',
      status: 'implemented',
      useWhen: 'Execution Audit Runs/Steps 조회가 필요한 모든 페이지',
      input: 'useExecutionAuditRuns(filters?: ExecutionAuditFilters)',
      output: 'UseQueryResult<ExecutionAuditRunsResponse>',
      extensionPoints: ['filters', 'cursor'],
      doNot: [
        '직접 apiClient.invokeFunction("execution-audit-runs") 호출',
      ],
      examples: [
        'const { data: runs } = useExecutionAuditRuns({ status: "success" });',
      ],
      related: {
        component: 'execution-audit-panel',
      },
    },

    'use-ai-suggestion': {
      path: 'packages/hooks/use-ai-suggestion/src/index.ts',
      import: 'import { useAISuggestion } from "@hooks/use-ai-suggestion"',
      status: 'deprecated',
      useWhen: '레거시: useStudentTaskCards를 사용하세요',
      input: '없음',
      output: 'UseAISuggestionReturn',
      extensionPoints: [],
      doNot: [
        '새 코드에서 이 Hook 사용 (레거시)',
      ],
      examples: [
        '// 레거시: useStudentTaskCards()를 사용하세요',
      ],
      related: {
        hook: 'use-student',
      },
    },

    // ========================================
    // 업종별 설정 관련 Hooks
    // ========================================
    'use-industry-terms': {
      path: 'packages/hooks/use-industry-terms/src/index.ts',
      import: 'import { useIndustryTerms } from "@hooks/use-industry-terms"',
      status: 'implemented',
      useWhen: '업종별 용어가 필요한 모든 UI 컴포넌트',
      input: '없음 (Context에서 자동 조회)',
      output: 'IndustryTerms (업종별 용어 객체)',
      extensionPoints: [],
      doNot: [
        '업종별 용어를 하드코딩',
        '"학생", "강사" 등의 문자열 직접 사용',
      ],
      examples: [
        'const terms = useIndustryTerms();',
        'console.log(terms.PERSON_LABEL_PRIMARY); // "학생" 또는 "회원"',
      ],
      related: {
        hook: 'use-industry-config',
      },
    },

    'use-industry-config': {
      path: 'packages/hooks/use-industry-config/src/index.ts',
      import: 'import { useIndustryConfig } from "@hooks/use-industry-config"',
      status: 'implemented',
      useWhen: '업종별 페이지 가시성, 라우트 경로 등 설정이 필요한 경우',
      input: '없음 (Context에서 자동 조회)',
      output: '{ visiblePages, routes, isPageVisible, getRoutePath, terms }',
      extensionPoints: [],
      doNot: [
        '페이지 가시성을 하드코딩으로 분기',
      ],
      examples: [
        'const { isPageVisible } = useIndustryConfig();',
        'if (isPageVisible("attendance")) { /* 출석 페이지 표시 */ }',
      ],
      related: {
        hook: 'use-industry-terms',
      },
    },

    // ========================================
    // 상황 인식 관련 Hooks
    // ========================================
    'use-adaptive-navigation': {
      path: 'packages/hooks/use-adaptive-navigation/src/index.ts',
      import: 'import { useAdaptiveNavigation } from "@hooks/use-adaptive-navigation"',
      status: 'implemented',
      useWhen: '상황 신호 수집 및 UI 조정이 필요한 페이지',
      input: '없음',
      output: 'UseAdaptiveNavigationReturn',
      extensionPoints: [],
      doNot: [
        'Hook 내부에서 navigate() 자동 호출',
      ],
      examples: [
        'const adaptiveNav = useAdaptiveNavigation();',
      ],
      related: {
        hook: 'use-context-signals',
      },
    },

    'use-context-signals': {
      path: 'packages/hooks/use-context-signals/src/index.ts',
      import: 'import { useContextSignals } from "@hooks/use-context-signals"',
      status: 'implemented',
      useWhen: '상황 신호 수집 및 UI 조정',
      input: '없음',
      output: 'UseAdaptiveNavigationReturn',
      extensionPoints: [],
      doNot: [
        'Hook 내부에서 navigate() 자동 호출',
      ],
      examples: [
        'const contextSignals = useContextSignals();',
      ],
      related: {
        hook: 'use-adaptive-navigation',
      },
    },

    'use-month-end-adaptation': {
      path: 'packages/hooks/use-month-end-adaptation/src/index.ts',
      import: 'import { useMonthEndAdaptation } from "@hooks/use-month-end-adaptation"',
      status: 'implemented',
      useWhen: '월말 감지 및 청구 카드 우선순위 조정이 필요한 페이지',
      input: '없음',
      output: '{ isMonthEnd, shouldPrioritizeBilling, daysUntilMonthEnd }',
      extensionPoints: [],
      doNot: [
        '하드코딩된 월말 기준일 사용',
      ],
      examples: [
        'const { shouldPrioritizeBilling } = useMonthEndAdaptation();',
      ],
    },

    'use-context-aware-dashboard': {
      path: 'packages/hooks/use-context-aware-dashboard/src/index.ts',
      import: 'import { useContextAwareDashboard } from "@hooks/use-context-aware-dashboard"',
      status: 'implemented',
      useWhen: '상황 인식 대시보드가 필요한 페이지',
      input: '없음',
      output: 'ContextAwareState',
      extensionPoints: [],
      doNot: [
        '하드코딩된 상황 감지 로직 구현',
      ],
      examples: [
        'const contextAware = useContextAwareDashboard();',
        'if (contextAware.isMonthEnd) { /* 월말 처리 */ }',
      ],
    },

    'use-weather-signals': {
      path: 'packages/hooks/use-weather-signals/src/index.ts',
      import: 'import { useWeatherSignals } from "@hooks/use-weather-signals"',
      status: 'implemented',
      useWhen: '날씨 상황 신호 수집이 필요한 페이지',
      input: '없음',
      output: '{ weatherSignals: WeatherSignals }',
      extensionPoints: [],
      doNot: [
        '프론트에서 날씨 API 직접 호출',
      ],
      examples: [
        'const { weatherSignals } = useWeatherSignals();',
      ],
    },

    // ========================================
    // 테넌트 관련 Hooks
    // ========================================
    'use-tenant-feature': {
      path: 'packages/hooks/use-tenant-feature/src/index.ts',
      import: 'import { useTenantFeature, useUpdateTenantFeature } from "@hooks/use-tenant-feature"',
      status: 'implemented',
      useWhen: '테넌트 기능 조회/업데이트가 필요한 페이지',
      input: 'useTenantFeature(featureKey: string): 기능 키',
      output: 'useTenantFeature(): TenantFeature | null',
      extensionPoints: ['featureKey'],
      doNot: [
        '직접 apiClient.get("tenant_features") 호출',
        '하드코딩된 기능 활성화 상태 사용',
      ],
      examples: [
        'const { data: feature } = useTenantFeature("ai");',
      ],
    },

    // ========================================
    // 알림 관련 Hooks
    // ========================================
    'use-notification-templates': {
      path: 'packages/hooks/use-notification-templates/src/index.ts',
      import: 'import { useNotificationTemplates } from "@hooks/use-notification-templates"',
      status: 'implemented',
      useWhen: '알림 템플릿 조회가 필요한 모든 페이지',
      input: 'useNotificationTemplates(filter?: NotificationTemplateFilter)',
      output: 'useNotificationTemplates(): NotificationTemplate[]',
      extensionPoints: ['filter'],
      doNot: [
        '직접 apiClient.get("notification_templates") 호출',
      ],
      examples: [
        'const { data: templates } = useNotificationTemplates({ channel: "sms" });',
      ],
    },

    'use-alimtalk': {
      path: 'packages/hooks/use-alimtalk/src/index.ts',
      import: 'import { useAlimtalk, useAlimtalkSettings } from "@hooks/use-alimtalk"',
      status: 'implemented',
      useWhen: '알림톡 발송 및 설정 관리가 필요한 페이지',
      input: '다양한 파라미터',
      output: 'Mutation 및 Query 결과',
      extensionPoints: [],
      doNot: [
        '직접 Aligo API 호출',
      ],
      examples: [
        'const { mutate: sendAlimtalk } = useAlimtalk();',
      ],
    },

    'use-sms': {
      path: 'packages/hooks/use-sms/src/index.ts',
      import: 'import { useSms } from "@hooks/use-sms"',
      status: 'implemented',
      useWhen: 'SMS 발송이 필요한 페이지',
      input: 'SMS 발송 파라미터',
      output: 'Mutation 결과',
      extensionPoints: [],
      doNot: [
        '직접 SMS API 호출',
      ],
      examples: [
        'const { mutate: sendSms } = useSms();',
      ],
    },

    // ========================================
    // 스키마 관련 Hooks
    // ========================================
    'use-schema-registry': {
      path: 'packages/hooks/use-schema-registry/src/index.ts',
      import: 'import { useIsSuperAdmin, useSchemaList, useSchema, useCreateSchema, useUpdateSchema } from "@hooks/use-schema-registry"',
      status: 'implemented',
      useWhen: '스키마 레지스트리 CRUD 작업이 필요한 페이지 (Super Admin 전용)',
      input: 'useSchemaList(filters?): 필터 객체',
      output: 'useSchemaList(): SchemaRegistryEntry[]',
      extensionPoints: ['filters'],
      doNot: [
        '직접 supabase.from("meta.schema_registry") 호출',
        'Super Admin 권한 확인 없이 스키마 수정',
      ],
      examples: [
        'const { data: isSuperAdmin } = useIsSuperAdmin();',
        'const { data: schemas } = useSchemaList({ entity: "student" });',
      ],
    },

    'use-schema': {
      path: 'packages/hooks/use-schema/src/index.ts',
      import: 'import { useSchema } from "@hooks/use-schema"',
      status: 'implemented',
      useWhen: '스키마 조회가 필요한 페이지',
      input: 'useSchema(entityName: string)',
      output: 'Schema 객체',
      extensionPoints: ['entityName'],
      doNot: [
        '스키마 정보 하드코딩',
      ],
      examples: [
        'const { data: schema } = useSchema("student");',
      ],
    },

    // ========================================
    // 학부모 앱 관련 Hooks
    // ========================================
    'use-parent': {
      path: 'packages/hooks/use-parent/src/index.ts',
      import: 'import { useChildren } from "@hooks/use-parent"',
      status: 'implemented',
      useWhen: '학부모 앱에서 자녀 목록 조회가 필요한 페이지',
      input: '없음',
      output: 'Student[]',
      extensionPoints: [],
      doNot: [
        '직접 apiClient.get("guardians") 호출',
      ],
      examples: [
        'const { data: children } = useChildren();',
      ],
    },

    // ========================================
    // 유틸리티 Hooks
    // ========================================
    'use-debounce': {
      path: 'packages/hooks/use-debounce/src/index.ts',
      import: 'import { useDebounce } from "@hooks/use-debounce"',
      status: 'implemented',
      useWhen: '입력값 디바운싱이 필요한 경우 (검색 입력 등)',
      input: '<T>(value: T, delay?: number): 디바운싱할 값, 지연 시간(기본값: 300ms)',
      output: 'T (디바운싱된 값)',
      extensionPoints: ['delay'],
      doNot: [
        '직접 setTimeout/clearTimeout 구현',
        '디바운싱 로직 중복 구현',
      ],
      examples: [
        'const debouncedSearchTerm = useDebounce(searchTerm, 300);',
      ],
    },

    'use-auth': {
      path: 'packages/hooks/use-auth/src/index.ts',
      import: 'import { useAuth } from "@hooks/use-auth"',
      status: 'implemented',
      useWhen: '인증 상태 확인, 로그인/로그아웃이 필요한 페이지',
      input: '없음',
      output: '{ user, session, signIn, signOut, isLoading }',
      extensionPoints: [],
      doNot: [
        '직접 supabase.auth 호출',
      ],
      examples: [
        'const { user, signOut } = useAuth();',
      ],
    },

    'use-optimized-query': {
      path: 'packages/hooks/use-optimized-query/src/index.ts',
      import: 'import { useOptimizedQuery, useDebouncedValue } from "@hooks/use-optimized-query"',
      status: 'implemented',
      useWhen: '최적화된 쿼리 및 디바운싱이 필요한 경우',
      input: '다양한 파라미터',
      output: 'React Query 결과',
      extensionPoints: [],
      doNot: [
        '비효율적인 쿼리 작성',
      ],
      examples: [
        'const { data } = useOptimizedQuery(queryKey, queryFn);',
      ],
    },
  },

  features: {
    'chatops-intent-registry': {
      path: 'packages/chatops-intents/src/index.ts',
      import: 'import { intentRegistry, getIntent, createPlan, validatePlan, createTaskCardFromPlan } from "@chatops-intents/registry"',
      status: 'implemented',
      useWhen: 'ChatOps Intent 조회, Plan 생성, TaskCard 생성이 필요한 모든 곳',
      input: 'getIntent(intent_key: string), createPlan(envelope, options)',
      output: 'IntentRegistryItem, SuggestedActionChatOpsPlanV1, TaskCardInput',
      extensionPoints: ['intent_key', 'envelope', 'options'],
      doNot: [
        'Intent 정보를 별도 파일에 중복 정의',
        'Plan 스냅샷에 PII 원문 저장',
      ],
      examples: [
        'const intent = getIntent("attendance.query.late");',
        'const plan = createPlan(envelope, options);',
      ],
      related: {
        component: 'chatops-panel',
      },
    },

    'task-card-item': {
      path: 'apps/academy-admin/src/components/StudentTaskCard.tsx',
      import: 'import { StudentTaskCard } from "../components/StudentTaskCard"',
      status: 'implemented',
      useWhen: 'TaskCard를 UI에 렌더링할 때 (Academy 업종)',
      input: '{ card: StudentTaskCard; onAction?: (card) => void }',
      output: 'React.ReactNode',
      extensionPoints: ['onAction'],
      doNot: [
        'TaskCard 렌더링 로직 중복 구현',
        '업종별 라벨 하드코딩',
      ],
      examples: [
        '<StudentTaskCard card={card} onAction={handleAction} />',
      ],
    },
  },

  adapters: {
    // 현재 구현된 adapter 없음 - 향후 다업종 확장 시 구현 예정
  },

  components: {
    'notification-card-layout': {
      path: 'packages/ui-core/src/components/NotificationCardLayout.tsx',
      import: 'import { NotificationCardLayout } from "@ui-core/react"',
      status: 'implemented',
      useWhen: '알림 카드 및 통계 카드를 구현할 때',
      input: '{ header?, title, description?, meta?, actions?, children?, ... }',
      output: 'React.ReactNode (알림 카드 레이아웃)',
      extensionPoints: ['header', 'title', 'description', 'meta', 'actions', 'children'],
      doNot: [
        'Card 컴포넌트를 직접 사용하여 알림 카드 레이아웃 구현',
        '알림 카드 레이아웃 로직 중복 구현',
      ],
      examples: [
        '<NotificationCardLayout header={header} title={card.title} description={card.message} />',
      ],
    },

    'chatops-panel': {
      path: 'packages/ui-core/src/components/ChatOpsPanel.tsx',
      import: 'import { ChatOpsPanel } from "@ui-core/react"',
      status: 'implemented',
      useWhen: 'AI 챗봇 UI 패널 구현 시',
      input: '{ messages, isLoading?, onSendMessage, onSelectCandidate?, ... }',
      output: 'React.ReactNode (챗봇 UI 패널)',
      extensionPoints: ['messages', 'onSendMessage', 'onSelectCandidate'],
      doNot: [
        '직접 채팅 UI 구현',
      ],
      examples: [
        '<ChatOpsPanel messages={messages} onSendMessage={handleSend} />',
      ],
      related: {
        component: 'ai-layer-menu',
        hook: 'use-chatops',
      },
    },

    'execution-audit-panel': {
      path: 'packages/ui-core/src/components/ExecutionAuditPanel.tsx',
      import: 'import { ExecutionAuditPanel } from "@ui-core/react"',
      status: 'implemented',
      useWhen: 'Execution Audit UI 패널 구현 시',
      input: '{ runs, isLoading?, onLoadMore?, onLoadSteps?, ... }',
      output: 'React.ReactNode (Execution Audit UI 패널)',
      extensionPoints: ['runs', 'onLoadMore', 'onLoadSteps'],
      doNot: [
        '직접 타임라인 UI 구현',
      ],
      examples: [
        '<ExecutionAuditPanel runs={runs} onLoadMore={handleLoadMore} />',
      ],
      related: {
        component: 'ai-layer-menu',
      },
    },

    'ai-layer-menu': {
      path: 'packages/ui-core/src/components/AILayerMenu.tsx',
      import: 'import { AILayerMenu, useAILayerMenu, AILayerMenuProvider } from "@ui-core/react"',
      status: 'implemented',
      useWhen: '전역 AI 우측 레이어 메뉴 구현 시',
      input: '{ isOpen, onClose, width?, chatOpsMessages?, executionAuditRuns?, ... }',
      output: 'React.ReactNode (전역 AI 레이어 메뉴)',
      extensionPoints: ['width', 'chatOpsMessages', 'executionAuditRuns'],
      doNot: [
        '직접 우측 레이어 메뉴 구현',
      ],
      examples: [
        '<AILayerMenu isOpen={isOpen} onClose={onClose} />',
      ],
    },
  },
} as const;

// ========================================
// 유틸리티 함수들
// ========================================

/**
 * 특정 상태의 항목만 필터링
 */
export function getCatalogItemsByStatus(status: CatalogItemStatus): Array<{
  category: 'hooks' | 'features' | 'adapters' | 'components';
  key: string;
  item: CatalogItem;
}> {
  const results: Array<{
    category: 'hooks' | 'features' | 'adapters' | 'components';
    key: string;
    item: CatalogItem;
  }> = [];

  const categories = ['hooks', 'features', 'adapters', 'components'] as const;

  for (const category of categories) {
    for (const [key, item] of Object.entries(sharedCatalog[category])) {
      if (item.status === status) {
        results.push({ category, key, item });
      }
    }
  }

  return results;
}

/**
 * 구현된 항목 수 통계
 */
export function getCatalogStats(): {
  total: number;
  implemented: number;
  planned: number;
  deprecated: number;
} {
  let total = 0;
  let implemented = 0;
  let planned = 0;
  let deprecated = 0;

  const categories = ['hooks', 'features', 'adapters', 'components'] as const;

  for (const category of categories) {
    for (const item of Object.values(sharedCatalog[category])) {
      total++;
      switch (item.status) {
        case 'implemented':
          implemented++;
          break;
        case 'planned':
          planned++;
          break;
        case 'deprecated':
          deprecated++;
          break;
      }
    }
  }

  return { total, implemented, planned, deprecated };
}

/**
 * 키워드로 공통화 요소 검색
 */
export function searchCatalog(keyword: string): Array<{
  category: 'hooks' | 'features' | 'adapters' | 'components';
  key: string;
  item: CatalogItem;
}> {
  const results: Array<{
    category: 'hooks' | 'features' | 'adapters' | 'components';
    key: string;
    item: CatalogItem;
  }> = [];

  const lowerKeyword = keyword.toLowerCase();
  const categories = ['hooks', 'features', 'adapters', 'components'] as const;

  for (const category of categories) {
    for (const [key, item] of Object.entries(sharedCatalog[category])) {
      if (
        key.toLowerCase().includes(lowerKeyword) ||
        item.useWhen.toLowerCase().includes(lowerKeyword) ||
        item.path.toLowerCase().includes(lowerKeyword)
      ) {
        results.push({ category, key, item });
      }
    }
  }

  return results;
}

// ========================================
// 검증 함수들
// ========================================

/**
 * Hook이 Shared Catalog에 등록되어 있는지 확인
 */
export function isRegisteredHook(hookKey: string): hookKey is keyof typeof sharedCatalog.hooks {
  return hookKey in sharedCatalog.hooks;
}

/**
 * Feature가 Shared Catalog에 등록되어 있는지 확인
 */
export function isRegisteredFeature(featureKey: string): featureKey is keyof typeof sharedCatalog.features {
  return featureKey in sharedCatalog.features;
}

/**
 * Component가 Shared Catalog에 등록되어 있는지 확인
 */
export function isRegisteredComponent(componentKey: string): componentKey is keyof typeof sharedCatalog.components {
  return componentKey in sharedCatalog.components;
}

/**
 * Hook이 등록되어 있는지 검증 (Fail-Closed)
 */
export function assertRegisteredHook(hookKey: string): asserts hookKey is keyof typeof sharedCatalog.hooks {
  if (!isRegisteredHook(hookKey)) {
    const availableHooks = Object.keys(sharedCatalog.hooks).join(', ');
    throw new Error(
      `Hook "${hookKey}" is not registered in shared-catalog.ts. Available hooks: ${availableHooks}`
    );
  }
}

/**
 * Feature가 등록되어 있는지 검증 (Fail-Closed)
 */
export function assertRegisteredFeature(featureKey: string): asserts featureKey is keyof typeof sharedCatalog.features {
  if (!isRegisteredFeature(featureKey)) {
    const availableFeatures = Object.keys(sharedCatalog.features).join(', ');
    throw new Error(
      `Feature "${featureKey}" is not registered in shared-catalog.ts. Available features: ${availableFeatures}`
    );
  }
}

/**
 * Component가 등록되어 있는지 검증 (Fail-Closed)
 */
export function assertRegisteredComponent(componentKey: string): asserts componentKey is keyof typeof sharedCatalog.components {
  if (!isRegisteredComponent(componentKey)) {
    const availableComponents = Object.keys(sharedCatalog.components).join(', ');
    throw new Error(
      `Component "${componentKey}" is not registered in shared-catalog.ts. Available components: ${availableComponents}`
    );
  }
}
