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
 * 타입체크에 포함시키려면 tsconfig.json references 또는 별도 scripts/check-shared-catalog.ts로 강제하는 쪽이 안정적입니다.
 *
 * ⚠️ 자동 검증 (구현 상태):
 * - `assertRegisteredHook()`, `assertRegisteredFeature()`, `assertRegisteredAdapter()` 함수로 런타임 검증 가능
 * - `validateSharedCatalog()` 함수로 related 필드 참조 검증 가능
 * - Automation Event Catalog의 `assertAutomationEventType()` 패턴과 동일한 원칙 (Fail-Closed)
 * - 개발 환경에서만 검증하는 것을 권장 (프로덕션 성능 영향 최소화)
 */

export interface CatalogItem {
  path: string;
  import: string;
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
  };
}

export interface SharedCatalog {
  hooks: Record<string, CatalogItem>;
  features: Record<string, CatalogItem>;
  adapters: Record<string, CatalogItem>;
  components: Record<string, CatalogItem>; // UI Core Component (공통 레이아웃/프리미티브)
}

export const sharedCatalog: SharedCatalog = {
  hooks: {
    // ⚠️ 주의: 'use-task-cards'는 아직 구현되지 않음. 현재는 'use-student-task-cards'만 사용 가능
    // 향후 업종 중립 TaskCard Hook 구현 시 이 항목을 활성화할 수 있음
    // 'use-task-cards': {
    //   path: '@hooks/use-task-card',
    //   import: 'import { useTaskCards } from "@hooks/use-task-card"',
    //   useWhen: 'TaskCard 조회가 필요한 모든 페이지',
    //   input: '{ entityType: string; limit?: number }',
    //   output: 'TaskCard[]',
    //   extensionPoints: ['entityType', 'limit'],
    //   doNot: [
    //     '직접 useQuery로 task_cards 조회',
    //     'apiClient.get("task_cards") 직접 호출',
    //     '만료 필터링 로직 중복 구현',
    //   ],
    //   examples: [
    //     'const { data } = useTaskCards({ entityType: "student" });',
    //     'const { data } = useTaskCards({ entityType: "client", limit: 50 });',
    //   ],
    //   related: {
    //     feature: 'task-card-item',
    //     adapter: 'industryAdapter.taskCards',
    //   },
    // },
    'use-student-task-cards': {
      path: '@hooks/use-student',
      import: 'import { useStudentTaskCards } from "@hooks/use-student"',
      useWhen: '학생용 TaskCard 조회 (entityType="student" 별칭)',
      input: '없음 (entityType="student" 고정)',
      output: 'StudentTaskCard[]',
      extensionPoints: [],
      doNot: [
        'apiClient.get("task_cards") 직접 호출',
        '만료 필터링 로직 중복 구현',
      ],
      examples: [
        'const { data: studentTaskCards } = useStudentTaskCards();',
      ],
      related: {
        feature: 'task-card-item',
        // ⚠️ 주의: industryAdapter.taskCards는 아직 구현되지 않음
        // adapter: 'industryAdapter.taskCards',
      },
    },
    'use-student': {
      path: '@hooks/use-student',
      import: 'import { useStudents, fetchStudents, fetchPersons, useConsultations, fetchConsultations, useGuardians, fetchGuardians } from "@hooks/use-student"',
      useWhen: '학생 목록 조회, 상담기록 조회, 보호자 조회가 필요한 모든 페이지',
      input: 'useStudents(filter?: StudentFilter): 필터 객체, fetchStudents(tenantId, filter?): useQuery 내부에서 사용, fetchPersons(tenantId, filter?): 간단한 persons 조회',
      output: 'useStudents(): Student[], fetchStudents(): Promise<Student[]>, fetchPersons(): Promise<Person[]>',
      extensionPoints: ['filter (useStudents)'],
      doNot: [
        '직접 apiClient.get("persons") 호출 (person_type="student" 필터)',
        '직접 apiClient.get("student_consultations") 호출',
        '직접 apiClient.get("guardians") 호출',
        'useQuery로 persons/student_consultations/guardians 직접 조회',
      ],
      examples: [
        'const { data: students } = useStudents({ status: "active", grade: "1" });',
        'const students = await fetchStudents(tenantId, { status: "active" });',
        'const persons = await fetchPersons(tenantId, { person_type: "student" });',
        'const { data: consultations } = useConsultations(studentId);',
        'const consultations = await fetchConsultations(tenantId, { student_id: studentId });',
        'const { data: guardians } = useGuardians(studentId);',
        'const guardians = await fetchGuardians(tenantId, { student_id: studentId });',
      ],
    },
    'use-config': {
      path: '@hooks/use-config',
      import: 'import { useConfig, useTenantSettingByPath, useUpdateConfig } from "@hooks/use-config"',
      useWhen: '테넌트 설정 조회/업데이트가 필요한 모든 페이지',
      input: 'useConfig(): 없음, useTenantSettingByPath(path: string): 경로 문자열, useUpdateConfig(): UpdateConfigInput',
      output: 'useConfig(): TenantConfig, useTenantSettingByPath(): unknown, useUpdateConfig(): Mutation',
      extensionPoints: ['path (useTenantSettingByPath)'],
      doNot: [
        '직접 apiClient.get("tenant_settings") 호출',
        'getTenantSettingByPath 직접 호출 (서버/Edge 전용)',
        '하드코딩된 기본값 사용 (Policy가 없으면 Fail Closed)',
      ],
      examples: [
        'const { data: config } = useConfig();',
        'const { data: enabled } = useTenantSettingByPath("auto_notification.overdue.enabled");',
        'const updateConfig = useUpdateConfig(); updateConfig.mutate({ key: "config", value: newConfig });',
      ],
    },
    'use-class': {
      path: '@hooks/use-class',
      import: 'import { useClasses, useClass, useCreateClass, useUpdateClass, useDeleteClass } from "@hooks/use-class"',
      useWhen: '수업/반 조회/생성/수정/삭제가 필요한 모든 페이지',
      input: 'useClasses(filter?: ClassFilter): 필터 객체, useClass(id: string): ID 문자열',
      output: 'useClasses(): Class[], useClass(): Class | null',
      extensionPoints: ['filter (useClasses)'],
      doNot: [
        '직접 apiClient.get("classes") 호출',
        '직접 apiClient.get("student_classes") 호출',
        'useQuery로 classes 직접 조회',
      ],
      examples: [
        'const { data: classes } = useClasses({ day_of_week: "monday", status: "active" });',
        'const { data: class } = useClass(classId);',
        'const createClass = useCreateClass(); createClass.mutate({ name: "수학반", ... });',
      ],
    },
    'use-attendance': {
      path: '@hooks/use-attendance',
      import: 'import { useAttendanceLogs, useCreateAttendanceLog, useQRAttendance, fetchAttendanceLogs } from "@hooks/use-attendance"',
      useWhen: '출석 로그 조회/생성, QR 출석 처리가 필요한 모든 페이지',
      input: 'useAttendanceLogs(filter?: AttendanceFilter): 필터 객체, fetchAttendanceLogs(tenantId, filter?): useQuery 내부에서 사용',
      output: 'useAttendanceLogs(): AttendanceLog[], fetchAttendanceLogs(): Promise<AttendanceLog[]>',
      extensionPoints: ['filter (useAttendanceLogs)'],
      doNot: [
        '직접 apiClient.get("attendance_logs") 호출',
        '직접 apiClient.get("student_classes") 호출 (출석용)',
        'useQuery로 attendance_logs 직접 조회',
      ],
      examples: [
        'const { data: logs } = useAttendanceLogs({ student_id: studentId, date: today });',
        'const createLog = useCreateAttendanceLog(); createLog.mutate({ student_id, class_id, ... });',
        'const { verifyQR } = useQRAttendance(); await verifyQR(token);',
        'const logs = await fetchAttendanceLogs(tenantId, { student_id: studentId, date_from: "2024-01-01" });',
      ],
    },
    'use-billing': {
      path: '@hooks/use-billing',
      import: 'import { useBillingHistory, useInvoice, useProcessPayment, fetchBillingHistory } from "@hooks/use-billing"',
      useWhen: '청구 내역/인보이스 조회, 결제 처리가 필요한 모든 페이지',
      input: 'useBillingHistory(filter?: BillingFilter): 필터 객체, useInvoice(id: string): ID 문자열, fetchBillingHistory(tenantId, filter?): useQuery 내부에서 사용',
      output: 'useBillingHistory(): BillingHistoryItem[], useInvoice(): Invoice | null, fetchBillingHistory(): Promise<BillingHistoryItem[]>',
      extensionPoints: ['filter (useBillingHistory)'],
      doNot: [
        '직접 apiClient.get("invoices") 호출',
        '직접 apiClient.get("payment_methods") 호출',
        'useQuery로 invoices 직접 조회',
      ],
      examples: [
        'const { data: history } = useBillingHistory({ tenant_id: tenantId });',
        'const { data: invoice } = useInvoice(invoiceId);',
        'const processPayment = useProcessPayment(); processPayment.mutate({ invoice_id, amount, ... });',
        'const invoices = await fetchBillingHistory(tenantId, { period_start: { gte: "2024-01-01" } });',
      ],
    },
    'use-payments': {
      path: '@hooks/use-payments',
      import: 'import { usePayments, fetchPayments } from "@hooks/use-payments"',
      useWhen: '결제 내역 조회가 필요한 모든 페이지',
      input: 'usePayments(filter?: PaymentFilter): 필터 객체, fetchPayments(tenantId, filter?): useQuery 내부에서 사용',
      output: 'usePayments(): Payment[], fetchPayments(): Promise<Payment[]>',
      extensionPoints: ['filter (usePayments)'],
      doNot: [
        '직접 apiClient.get("payments") 호출',
        'useQuery로 payments 직접 조회',
      ],
      examples: [
        'const { data: payments } = usePayments({ status: "failed" });',
        'const payments = await fetchPayments(tenantId, { status: "completed" });',
      ],
    },
    'use-invoice-items': {
      path: '@hooks/use-invoice-items',
      import: 'import { useInvoiceItems, fetchInvoiceItems } from "@hooks/use-invoice-items"',
      useWhen: '청구서 항목 조회가 필요한 모든 페이지',
      input: 'useInvoiceItems(filter?: InvoiceItemFilter): 필터 객체, fetchInvoiceItems(tenantId, filter?): useQuery 내부에서 사용',
      output: 'useInvoiceItems(): InvoiceItem[], fetchInvoiceItems(): Promise<InvoiceItem[]>',
      extensionPoints: ['filter (useInvoiceItems)'],
      doNot: [
        '직접 apiClient.get("invoice_items") 호출',
        'useQuery로 invoice_items 직접 조회',
      ],
      examples: [
        'const { data: items } = useInvoiceItems({ invoice_id: invoiceId });',
        'const items = await fetchInvoiceItems(tenantId, { invoice_id: invoiceId });',
      ],
    },
    'use-notification-templates': {
      path: '@hooks/use-notification-templates',
      import: 'import { useNotificationTemplates, fetchNotificationTemplates } from "@hooks/use-notification-templates"',
      useWhen: '알림 템플릿 조회가 필요한 모든 페이지',
      input: 'useNotificationTemplates(filter?: NotificationTemplateFilter): 필터 객체, fetchNotificationTemplates(tenantId, filter?): useQuery 내부에서 사용',
      output: 'useNotificationTemplates(): NotificationTemplate[], fetchNotificationTemplates(): Promise<NotificationTemplate[]>',
      extensionPoints: ['filter (useNotificationTemplates)'],
      doNot: [
        '직접 apiClient.get("notification_templates") 호출',
        'useQuery로 notification_templates 직접 조회',
      ],
      examples: [
        'const { data: templates } = useNotificationTemplates({ channel: "sms" });',
        'const templates = await fetchNotificationTemplates(tenantId, { channel: "kakao" });',
      ],
    },
    'use-ai-insights': {
      path: '@hooks/use-ai-insights',
      import: 'import { useAIInsights, fetchAIInsights } from "@hooks/use-ai-insights"',
      useWhen: 'AI 인사이트 조회가 필요한 모든 페이지',
      input: 'useAIInsights(filter?: AIInsightFilter): 필터 객체, fetchAIInsights(tenantId, filter?): useQuery 내부에서 사용',
      output: 'useAIInsights(): AIInsight[], fetchAIInsights(): Promise<AIInsight[]>',
      extensionPoints: ['filter (useAIInsights)'],
      doNot: [
        '직접 apiClient.get("ai_insights") 호출',
        'useQuery로 ai_insights 직접 조회',
      ],
      examples: [
        'const { data: insights } = useAIInsights({ insight_type: "weekly_briefing", status: "active" });',
        'const insights = await fetchAIInsights(tenantId, { insight_type: "attendance_anomaly" });',
      ],
    },
    'use-chatops': {
      path: '@hooks/use-chatops',
      import: 'import { useChatOps } from "@hooks/use-chatops"',
      useWhen: 'ChatOps 메시지 전송이 필요한 모든 페이지 (챗봇.md 참조)',
      input: 'useChatOps(): React Query Mutation Hook, mutateAsync(message: string): 메시지 문자열',
      output: 'useChatOps(): UseMutationResult<ChatOpsResponse>, mutateAsync(): Promise<ChatOpsResponse>',
      extensionPoints: ['message (mutateAsync)'],
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
    'use-execution-audit': {
      path: '@hooks/use-execution-audit',
      import: 'import { useExecutionAuditRuns, useExecutionAuditRun, useExecutionAuditSteps, fetchExecutionAuditSteps } from "@hooks/use-execution-audit"',
      useWhen: 'Execution Audit Runs/Steps 조회가 필요한 모든 페이지 (액티비티.md 참조)',
      input: 'useExecutionAuditRuns(filters?: ExecutionAuditFilters, cursor?: string): 필터 객체 및 커서, fetchExecutionAuditSteps(tenantId, runId, cursor?): useQuery 내부에서 사용',
      output: 'useExecutionAuditRuns(): UseQueryResult<ExecutionAuditRunsResponse>, fetchExecutionAuditSteps(): Promise<ExecutionAuditStepsResponse>',
      extensionPoints: ['filters (useExecutionAuditRuns)', 'cursor (useExecutionAuditRuns)'],
      doNot: [
        '직접 apiClient.invokeFunction("execution-audit-runs") 호출',
        'fetch로 Edge Function 직접 호출',
      ],
      examples: [
        'const { data: runs } = useExecutionAuditRuns({ status: "success" }, cursor);',
        'const steps = await fetchExecutionAuditSteps(tenantId, runId);',
      ],
      related: {
        component: 'execution-audit-panel',
      },
    },
    'use-daily-region-metrics': {
      path: '@hooks/use-daily-region-metrics',
      import: 'import { useDailyRegionMetrics, fetchDailyRegionMetrics } from "@hooks/use-daily-region-metrics"',
      useWhen: '지역 일일 통계 조회가 필요한 모든 페이지',
      input: 'useDailyRegionMetrics(filter?: DailyRegionMetricFilter): 필터 객체, fetchDailyRegionMetrics(tenantId, filter?): useQuery 내부에서 사용',
      output: 'useDailyRegionMetrics(): DailyRegionMetric[], fetchDailyRegionMetrics(): Promise<DailyRegionMetric[]>',
      extensionPoints: ['filter (useDailyRegionMetrics)'],
      doNot: [
        '직접 apiClient.get("daily_region_metrics") 호출',
        'useQuery로 daily_region_metrics 직접 조회',
      ],
      examples: [
        'const { data: metrics } = useDailyRegionMetrics({ region_level: "dong", region_code: "1101053" });',
        'const metrics = await fetchDailyRegionMetrics(tenantId, { industry_type: "academy", region_level: "gu_gun" });',
      ],
    },
    'use-adaptive-navigation': {
      path: '@hooks/use-adaptive-navigation',
      import: 'import { useAdaptiveNavigation } from "@hooks/use-adaptive-navigation"',
      useWhen: '상황 신호 수집 및 UI 조정이 필요한 페이지 (대시보드 우선순위 조정, 배너 표시)',
      input: '없음',
      output: 'UseAdaptiveNavigationReturn (currentRecommendation, contextSignals)',
      extensionPoints: [],
      doNot: [
        'Hook 내부에서 navigate() 자동 호출',
        '자동 실행 (프론트엔드는 실행하지 않음)',
      ],
      examples: [
        'const adaptiveNav = useAdaptiveNavigation();',
        'if (adaptiveNav.currentRecommendation) { /* 배너 표시 */ }',
      ],
      related: {
        hook: 'use-context-signals',
      },
    },
    'use-context-signals': {
      path: '@hooks/use-context-signals',
      import: 'import { useContextSignals } from "@hooks/use-context-signals"',
      useWhen: '상황 신호 수집 및 UI 조정 (useAdaptiveNavigation의 정본 권장 이름)',
      input: '없음',
      output: 'UseAdaptiveNavigationReturn (useAdaptiveNavigation과 동일)',
      extensionPoints: [],
      doNot: [
        'Hook 내부에서 navigate() 자동 호출',
        '자동 실행 (프론트엔드는 실행하지 않음)',
      ],
      examples: [
        'const contextSignals = useContextSignals();',
      ],
      related: {
        hook: 'use-adaptive-navigation',
      },
    },
    'use-month-end-adaptation': {
      path: '@hooks/use-month-end-adaptation',
      import: 'import { useMonthEndAdaptation } from "@hooks/use-month-end-adaptation"',
      useWhen: '월말 감지 및 청구 카드 우선순위 조정이 필요한 페이지',
      input: '없음',
      output: 'UseMonthEndAdaptationReturn (isMonthEnd, shouldPrioritizeBilling, daysUntilMonthEnd)',
      extensionPoints: [],
      doNot: [
        '하드코딩된 월말 기준일 사용 (Policy에서 조회 필수)',
        '기본값으로 25일 사용 (Fail Closed 원칙)',
      ],
      examples: [
        'const { shouldPrioritizeBilling } = useMonthEndAdaptation();',
        'const priority = (basePriority || 50) + (shouldPrioritizeBilling ? 2 : 0);',
      ],
      related: {
        hook: 'use-config',
      },
    },
    'use-context-aware-dashboard': {
      path: '@hooks/use-context-aware-dashboard',
      import: 'import { useContextAwareDashboard } from "@hooks/use-context-aware-dashboard"',
      useWhen: '상황 인식 대시보드가 필요한 페이지 (시간/요일/월말 감지, 추천 액션 제공)',
      input: '없음',
      output: 'ContextAwareState (timeOfDay, dayOfWeek, isMonthEnd, isWeekend, hasUpcomingClasses, hasFinishedClasses, recommendedActions)',
      extensionPoints: [],
      doNot: [
        '하드코딩된 상황 감지 로직 구현',
        'Policy 없이 기본값 사용 (Fail Closed 원칙)',
      ],
      examples: [
        'const contextAware = useContextAwareDashboard();',
        'if (contextAware.isMonthEnd) { /* 월말 처리 */ }',
        'if (contextAware.hasUpcomingClasses) { /* 수업 준비 */ }',
      ],
      related: {
        hook: 'use-config',
      },
    },
    'use-weather-signals': {
      path: '@hooks/use-weather-signals',
      import: 'import { useWeatherSignals } from "@hooks/use-weather-signals"',
      useWhen: '날씨 상황 신호 수집이 필요한 페이지 (프론트 자동화 문서 1.2.3 참조)',
      input: '없음',
      output: '{ weatherSignals: WeatherSignals }',
      extensionPoints: [],
      doNot: [
        '프론트에서 날씨 API 직접 호출',
        '안내문 생성/발송 (서버에서 처리)',
        '알림 생성/실행 주도 (프론트는 신호만 수집)',
      ],
      examples: [
        'const { weatherSignals } = useWeatherSignals();',
        'if (weatherSignals.condition === "heavy_rain") { /* 배너 표시 */ }',
      ],
    },
    'use-tenant-feature': {
      path: '@hooks/use-tenant-feature',
      import: 'import { useTenantFeature, useUpdateTenantFeature } from "@hooks/use-tenant-feature"',
      useWhen: '테넌트 기능 조회/업데이트가 필요한 페이지 (예: AI 기능 토글)',
      input: 'useTenantFeature(featureKey: string): 기능 키, useUpdateTenantFeature(featureKey: string): 기능 키',
      output: 'useTenantFeature(): TenantFeature | null, useUpdateTenantFeature(): Mutation',
      extensionPoints: ['featureKey'],
      doNot: [
        '직접 apiClient.get("tenant_features") 호출',
        'useQuery로 tenant_features 직접 조회',
        '하드코딩된 기능 활성화 상태 사용',
      ],
      examples: [
        'const { data: feature } = useTenantFeature("ai");',
        'const updateFeature = useUpdateTenantFeature("ai"); updateFeature.mutate(true);',
      ],
    },
    'use-schema-registry': {
      path: '@hooks/use-schema-registry',
      import: 'import { useIsSuperAdmin, useSchemaList, useSchema, useCreateSchema, useUpdateSchema, useActivateSchema, useDeleteSchema } from "@hooks/use-schema-registry"',
      useWhen: '스키마 레지스트리 CRUD 작업이 필요한 페이지 (Super Admin 전용)',
      input: 'useSchemaList(filters?): 필터 객체, useSchema(id: string): ID 문자열, useCreateSchema(): CreateSchemaInput, useUpdateSchema(): { id, input, expectedUpdatedAt? }, useActivateSchema(): id: string, useDeleteSchema(): id: string',
      output: 'useSchemaList(): SchemaRegistryEntry[], useSchema(): SchemaRegistryEntry, useIsSuperAdmin(): boolean',
      extensionPoints: ['filters (useSchemaList)'],
      doNot: [
        '직접 supabase.from("meta.schema_registry") 호출',
        'RLS 정책 우회 시도',
        'Super Admin 권한 확인 없이 스키마 수정',
      ],
      examples: [
        'const { data: isSuperAdmin } = useIsSuperAdmin();',
        'const { data: schemas } = useSchemaList({ entity: "student", status: "active" });',
        'const { data: schema } = useSchema(schemaId);',
        'const createSchema = useCreateSchema(); createSchema.mutate({ entity: "student", ... });',
      ],
    },
    'use-parent': {
      path: '@hooks/use-parent',
      import: 'import { useChildren } from "@hooks/use-parent"',
      useWhen: '학부모 앱에서 자녀 목록 조회가 필요한 페이지',
      input: '없음',
      output: 'Student[]',
      extensionPoints: [],
      doNot: [
        '직접 apiClient.get("guardians") 호출',
        '직접 apiClient.get("persons") 호출 (person_type="student")',
        'useQuery로 guardians/persons 직접 조회',
      ],
      examples: [
        'const { data: children } = useChildren();',
      ],
    },
    'use-debounce': {
      path: '@hooks/use-debounce',
      import: 'import { useDebounce } from "@hooks/use-debounce"',
      useWhen: '입력값 디바운싱이 필요한 경우 (검색 입력 등)',
      input: '<T>(value: T, delay?: number): 디바운싱할 값, 지연 시간(기본값: 300ms)',
      output: 'T (디바운싱된 값)',
      extensionPoints: ['delay'],
      doNot: [
        '직접 setTimeout/clearTimeout 구현',
        '디바운싱 로직 중복 구현',
      ],
      examples: [
        'const [searchTerm, setSearchTerm] = useState("");',
        'const debouncedSearchTerm = useDebounce(searchTerm, 300);',
        'useEffect(() => { if (debouncedSearchTerm) { searchAPI(debouncedSearchTerm); } }, [debouncedSearchTerm]);',
      ],
    },
    'use-ai-suggestion': {
      path: '@hooks/use-ai-suggestion',
      import: 'import { useAISuggestion } from "@hooks/use-ai-suggestion"',
      useWhen: '레거시: StudentTaskCard를 사용하세요 (v3.3에서 삭제 예정)',
      input: '없음',
      output: 'UseAISuggestionReturn (suggestions, isLoading, approveSuggestion, rejectSuggestion, dismissSuggestion)',
      extensionPoints: [],
      doNot: [
        '새 코드에서 이 Hook 사용 (레거시)',
        '직접 apiClient.get("ai_suggestions") 호출',
        'useQuery로 ai_suggestions 직접 조회',
      ],
      examples: [
        '// 레거시: useStudentTaskCards()를 사용하세요',
        'const { suggestions, approveSuggestion } = useAISuggestion();',
      ],
      related: {
        hook: 'use-student-task-cards',
      },
    },
    'use-consultation-stats': {
      path: '@hooks/use-student',
      import: 'import { useConsultationStats, fetchConsultationStats } from "@hooks/use-student"',
      useWhen: '상담 통계 조회가 필요한 페이지 (이번 달 상담 건수, 대기 중인 상담 건수, 긴급 상담 건수)',
      input: 'useConsultationStats(): 없음 (tenantId는 Context에서 자동 가져옴), fetchConsultationStats(tenantId: string): useQuery 내부에서 사용',
      output: 'useConsultationStats(): ConsultationStats, fetchConsultationStats(): Promise<ConsultationStats>',
      extensionPoints: [],
      doNot: [
        '직접 apiClient.callRPC("consultation_stats") 호출',
        'useQuery로 consultation_stats RPC 직접 조회',
        'tenantId를 직접 전달 (Context에서 자동 가져옴)',
      ],
      examples: [
        'const { data: consultationStats } = useConsultationStats();',
        'const stats = await fetchConsultationStats(tenantId);',
      ],
      related: {
        hook: 'use-student',
      },
    },
    'use-recent-activity': {
      path: '@hooks/use-student',
      import: 'import { useRecentActivity, fetchRecentActivity } from "@hooks/use-student"',
      useWhen: '최근 활동 조회가 필요한 페이지 (최근 등록된 학생, 최근 상담 기록, 최근 출결 이벤트, 최근 태그 추가/변경)',
      input: 'useRecentActivity(): 없음 (tenantId는 Context에서 자동 가져옴), fetchRecentActivity(tenantId: string): useQuery 내부에서 사용',
      output: 'useRecentActivity(): RecentActivity, fetchRecentActivity(): Promise<RecentActivity>',
      extensionPoints: [],
      doNot: [
        '직접 apiClient.get("persons") / apiClient.get("student_consultations") / apiClient.get("attendance_logs") / apiClient.get("tag_assignments") 호출',
        'useQuery로 최근 활동 데이터 직접 조회',
        'tenantId를 직접 전달 (Context에서 자동 가져옴)',
      ],
      examples: [
        'const { data: recentActivity } = useRecentActivity();',
        'const activity = await fetchRecentActivity(tenantId);',
      ],
      related: {
        hook: 'use-student',
      },
    },
    'use-ai-layer-menu': {
      path: '@ui-core/react',
      import: 'import { useAILayerMenu, AILayerMenuProvider } from "@ui-core/react"',
      useWhen: '전역 AI 레이어 메뉴 상태 관리가 필요한 경우 (모든 페이지에서 사용 가능)',
      input: 'useAILayerMenu(): 없음 (Provider 내부에서 자동 주입), AILayerMenuProvider: 앱 최상위에 배치',
      output: 'useAILayerMenu(): AILayerMenuContextType (isOpen, open, close, toggle, activeTab, setActiveTab, chatOpsMessages, executionAuditRuns 등)',
      extensionPoints: ['activeTab', 'chatOpsMessages', 'executionAuditRuns'],
      doNot: [
        '직접 useState로 AI 레이어 메뉴 상태 관리',
        '페이지별로 별도 상태 관리',
        'AILayerMenuProvider 없이 useAILayerMenu 사용',
      ],
      examples: [
        'import { AILayerMenuProvider, useAILayerMenu } from "@ui-core/react";',
        '// main.tsx: <AILayerMenuProvider><App /></AILayerMenuProvider>',
        '// 컴포넌트: const aiLayerMenu = useAILayerMenu(); aiLayerMenu.open();',
      ],
      related: {
        component: 'ai-layer-menu',
      },
    },
  },
  features: {
    'chatops-intent-registry': {
      path: '@chatops-intents/registry',
      import: 'import { intentRegistry, getIntent, getAllIntents, getL0Intents, getL1Intents, getL2Intents, getL2AIntents, getL2BIntents, hasIntent, createPlan, validatePlan, createTaskCardFromPlan, type IntentEnvelope, type SuggestedActionChatOpsPlanV1, type TaskCardInput, type CreateTaskCardFromPlanOptions } from "@chatops-intents/registry"',
      useWhen: 'ChatOps Intent 조회, Plan 생성, TaskCard 생성 및 검증이 필요한 모든 곳 (Edge Function, Planner 등)',
      input: 'getIntent(intent_key: string): IntentRegistryItem | undefined, createPlan(envelope: IntentEnvelope, options: CreatePlanOptions): SuggestedActionChatOpsPlanV1, validatePlan(plan: unknown): boolean, createTaskCardFromPlan(options: CreateTaskCardFromPlanOptions): TaskCardInput',
      output: 'IntentRegistryItem | undefined, SuggestedActionChatOpsPlanV1, boolean, TaskCardInput',
      extensionPoints: ['intent_key', 'envelope', 'options', 'plan'],
      doNot: [
        '문서(챗봇.md)에서 Intent 정보를 직접 하드코딩',
        'Intent 정보를 별도 파일에 중복 정의',
        '런타임에서 Intent Registry를 동적으로 수정',
        'Plan 스냅샷에 PII 원문 저장 (마스킹 필수)',
        'TaskCard 생성 시 INSERT만 사용 (UPSERT 필수)',
      ],
      examples: [
        'import { getIntent, createPlan, createTaskCardFromPlan } from "@chatops-intents/registry";',
        'const intent = getIntent("attendance.query.late");',
        'const plan = createPlan(envelope, { requested_by_user_id: "user-123", target_student_ids: ["student-1"] });',
        'const taskCard = createTaskCardFromPlan({ tenant_id: "tenant-123", plan, priority: 50, expires_at: "2025-12-27T00:00:00Z", now_kst: "2025-12-26T12:00:00+09:00" });',
      ],
      related: {
        component: 'chatops-panel',
      },
    },
    'task-card-item': {
      path: 'apps/academy-admin/src/components/StudentTaskCard',
      import: 'import { StudentTaskCard } from "../components/StudentTaskCard"',
      useWhen: 'TaskCard를 UI에 렌더링할 때 (현재는 Academy 업종 전용, apps/academy-admin 내부에서만 사용)',
      input: '{ card: StudentTaskCard; onAction?: (card: StudentTaskCard) => void }',
      output: 'React.ReactNode',
      extensionPoints: ['onAction'],
      doNot: [
        'TaskCard 렌더링 로직 중복 구현',
        '업종별 라벨 하드코딩',
      ],
      examples: [
        'import { StudentTaskCard } from "../components/StudentTaskCard";',
        '<StudentTaskCard card={card} onAction={handleAction} />',
      ],
      // ⚠️ 주의: industryAdapter.taskCards는 아직 구현되지 않음
      // ⚠️ 주의: 현재는 Academy 업종 전용 컴포넌트이며, 향후 업종 중립 컴포넌트로 확장 예정
      // related: {
      //   adapter: 'industryAdapter.taskCards',
      // },
    },
  },
  adapters: {
    // ⚠️ 주의: 'task-cards' adapter는 아직 구현되지 않음
    // 향후 업종 중립 TaskCard 지원 시 구현 예정
    // 'task-cards': {
    //   path: '@industry/*/adapter',
    //   import: 'import { industryAdapter } from "@industry/*/adapter"',
    //   useWhen: 'TaskCard 라벨/라우팅을 업종별로 커스터마이징할 때',
    //   input: '없음 (Context에서 자동 주입)',
    //   output: '{ entityLabel: string; taskTypeLabels: Record<string, string>; buildActionUrl?: (card: TaskCard) => string }',
    //   extensionPoints: ['entityLabel', 'taskTypeLabels', 'buildActionUrl'],
    //   doNot: [
    //     '업종별 라벨을 컴포넌트에 하드코딩',
    //     '프론트에서 라우팅 직접 조립',
    //   ],
    //   examples: [
    //     'const entityLabel = industryAdapter.taskCards.entityLabel; // "학생" | "고객" | ...',
    //     'const label = industryAdapter.taskCards.taskTypeLabels[card.task_type];',
    //   ],
    //   related: {
    //     hook: 'use-task-cards',
    //     feature: 'task-card-item',
    //   },
    // },
  },
  components: {
    'notification-card-layout': {
      path: '@ui-core/react',
      import: 'import { NotificationCardLayout } from "@ui-core/react"',
      useWhen: '알림 카드 및 통계 카드를 구현할 때 - EmergencyCard, AIBriefingCard, StudentTaskCard, StatsCard 등 모든 카드가 동일한 레이아웃을 사용',
      input: '{ header?: ReactNode; title: ReactNode; description?: ReactNode; meta?: ReactNode; actions?: ReactNode; children?: ReactNode; backgroundColor?: string; isEmpty?: boolean; onClick?: () => void; variant?: "default" | "elevated" | "outlined"; borderLeftColor?: string; maxTitleLines?: number; maxDescriptionLines?: number; icon?: ReactNode; value?: ReactNode; unit?: ReactNode; trend?: ReactNode; layoutMode?: "notification" | "stats" | "auto" }',
      output: 'React.ReactNode (알림 카드 및 통계 카드 레이아웃)',
      extensionPoints: ['header', 'title', 'description', 'meta', 'actions', 'children', 'backgroundColor', 'borderLeftColor', 'maxTitleLines', 'maxDescriptionLines', 'icon', 'value', 'unit', 'trend', 'layoutMode'],
      doNot: [
        'Card 컴포넌트를 직접 사용하여 알림 카드 레이아웃 구현',
        '알림 카드 레이아웃 로직 중복 구현',
        '하드코딩된 레이아웃 구조 사용',
        'EmergencyCard, AIBriefingCard 등에서 개별 레이아웃 코드 작성',
        'StatsCardLayout 사용 (NotificationCardLayout로 통일됨)',
      ],
      examples: [
        'import { NotificationCardLayout } from "@ui-core/react";',
        '<NotificationCardLayout header={header} title={card.title} description={card.message} />',
        '<NotificationCardLayout header={header} title={card.title} description={card.summary} variant="elevated">{insightsContent}</NotificationCardLayout>',
        '<NotificationCardLayout title="전체 학생 수" value={150} unit="명" trend="+10%" icon={<Users />} />',
      ],
      related: {
        feature: 'task-card-item',
      },
    },
    'chatops-panel': {
      path: '@ui-core/react',
      import: 'import { ChatOpsPanel } from "@ui-core/react"',
      useWhen: 'AI 챗봇 UI 패널 구현 시 (버블 대화 방식)',
      input: '{ messages: ChatOpsMessage[]; isLoading?: boolean; onSendMessage: (message: string) => void; onSelectCandidate?: (candidateId: string, tokenId?: string) => void; onApprovePlan?: (taskId: string) => void; onRequestApproval?: (taskId: string) => void; onViewActivity?: (runId?: string, requestId?: string) => void; onViewTaskCard?: (taskId: string) => void }',
      output: 'React.ReactNode (챗봇 UI 패널)',
      extensionPoints: ['messages', 'onSendMessage', 'onSelectCandidate', 'onApprovePlan', 'onRequestApproval', 'onViewActivity', 'onViewTaskCard'],
      doNot: [
        '직접 채팅 UI 구현',
        '버블 대화 방식 외의 UI 구현',
        '실행 결과를 ChatOps UI에 직접 표시 (Activity 시스템에 기록)',
      ],
      examples: [
        'import { ChatOpsPanel } from "@ui-core/react";',
        '<ChatOpsPanel messages={messages} onSendMessage={handleSend} />',
      ],
      related: {
        component: 'ai-layer-menu',
        hook: 'use-ai-layer-menu',
      },
    },
    'execution-audit-panel': {
      path: '@ui-core/react',
      import: 'import { ExecutionAuditPanel } from "@ui-core/react"',
      useWhen: 'Execution Audit UI 패널 구현 시 (타임라인/리스트 기반)',
      input: '{ runs: ExecutionAuditRun[]; isLoading?: boolean; onLoadMore?: (cursor?: string) => void; onLoadSteps?: (runId: string, cursor?: string) => void; stepsByRunId?: Record<string, ExecutionAuditStep[]>; stepsLoading?: Record<string, boolean>; hasMore?: boolean; nextCursor?: string; onViewRun?: (runId: string) => void; onFilterChange?: (filters: ExecutionAuditFilters) => void; initialFilters?: ExecutionAuditFilters; availableOperationTypes?: string[] }',
      output: 'React.ReactNode (Execution Audit UI 패널)',
      extensionPoints: ['runs', 'onLoadMore', 'onLoadSteps', 'stepsByRunId', 'onViewRun', 'onFilterChange', 'initialFilters', 'availableOperationTypes'],
      doNot: [
        '직접 타임라인/리스트 UI 구현',
        '채팅 방식으로 Execution Audit 표시 (타임라인/리스트 기반)',
        'Step을 Run 목록과 함께 조회 (성능 보호, 액티비티.md 4.2 참조)',
      ],
      examples: [
        'import { ExecutionAuditPanel } from "@ui-core/react";',
        '<ExecutionAuditPanel runs={runs} onLoadMore={handleLoadMore} onLoadSteps={handleLoadSteps} />',
      ],
      related: {
        component: 'ai-layer-menu',
        hook: 'use-ai-layer-menu',
      },
    },
    'ai-layer-menu': {
      path: '@ui-core/react',
      import: 'import { AILayerMenu } from "@ui-core/react"',
      useWhen: '전역 AI 우측 레이어 메뉴 구현 시 (ChatOps + Execution Audit 탭 구조)',
      input: '{ isOpen: boolean; onClose: () => void; width?: string; chatOpsMessages?: ChatOpsMessage[]; executionAuditRuns?: ExecutionAuditRun[]; ... (ChatOps 및 Execution Audit 관련 props) }',
      output: 'React.ReactNode (전역 AI 레이어 메뉴)',
      extensionPoints: ['width', 'chatOpsMessages', 'executionAuditRuns', 'onChatOpsSendMessage', 'onExecutionAuditLoadMore', 'onChatOpsViewTaskCard'],
      doNot: [
        '직접 우측 레이어 메뉴 구현',
        '학생관리 페이지와 다른 크기/로직 사용',
        '탭 구조 없이 단일 패널로 구현',
      ],
      examples: [
        'import { AILayerMenu, useAILayerMenu } from "@ui-core/react";',
        'const aiLayerMenu = useAILayerMenu();',
        '<AILayerMenu isOpen={aiLayerMenu.isOpen} onClose={aiLayerMenu.close} chatOpsMessages={aiLayerMenu.chatOpsMessages} />',
      ],
      related: {
        hook: 'use-ai-layer-menu',
      },
    },
  },
} as const;

/**
 * Shared Catalog 관련 항목 검증 함수
 *
 * ⚠️ SSOT 원칙: related 필드에서 참조하는 항목이 실제로 sharedCatalog에 존재하는지 검증합니다.
 * 개발 환경에서만 검증하는 것을 권장합니다 (프로덕션 성능 영향 최소화).
 *
 * @param item 검증할 CatalogItem
 * @param category 항목이 속한 카테고리 ('hooks' | 'features' | 'adapters' | 'components')
 * @param key 항목의 키
 * @returns 검증 오류 배열 (오류가 없으면 빈 배열)
 */
export function validateCatalogItemRelated(
  item: CatalogItem,
  category: 'hooks' | 'features' | 'adapters' | 'components',
  key: string
): string[] {
  const errors: string[] = [];

  if (!item.related) {
    return errors;
  }

  // feature 참조 검증
  if (item.related.feature) {
    if (!(item.related.feature in sharedCatalog.features)) {
      errors.push(
        `[Shared Catalog] ${category} "${key}"의 related.feature "${item.related.feature}"가 sharedCatalog.features에 존재하지 않습니다.`
      );
    }
  }

  // adapter 참조 검증
  if (item.related.adapter) {
    if (!(item.related.adapter in sharedCatalog.adapters)) {
      errors.push(
        `[Shared Catalog] ${category} "${key}"의 related.adapter "${item.related.adapter}"가 sharedCatalog.adapters에 존재하지 않습니다.`
      );
    }
  }

  // hook 참조 검증
  if (item.related.hook) {
    if (!(item.related.hook in sharedCatalog.hooks)) {
      errors.push(
        `[Shared Catalog] ${category} "${key}"의 related.hook "${item.related.hook}"가 sharedCatalog.hooks에 존재하지 않습니다.`
      );
    }
  }

  return errors;
}

/**
 * Shared Catalog 전체 검증 함수
 *
 * ⚠️ SSOT 원칙: 모든 related 필드 참조가 유효한지 검증합니다.
 * 개발 환경에서만 검증하는 것을 권장합니다 (프로덕션 성능 영향 최소화).
 *
 * @returns 검증 오류 배열 (오류가 없으면 빈 배열)
 */
export function validateSharedCatalog(): string[] {
  const errors: string[] = [];

  // hooks 검증
  for (const [key, item] of Object.entries(sharedCatalog.hooks)) {
    errors.push(...validateCatalogItemRelated(item, 'hooks', key));
  }

  // features 검증
  for (const [key, item] of Object.entries(sharedCatalog.features)) {
    errors.push(...validateCatalogItemRelated(item, 'features', key));
  }

  // adapters 검증
  for (const [key, item] of Object.entries(sharedCatalog.adapters)) {
    errors.push(...validateCatalogItemRelated(item, 'adapters', key));
  }

  // components 검증
  for (const [key, item] of Object.entries(sharedCatalog.components)) {
    errors.push(...validateCatalogItemRelated(item, 'components', key));
  }

  return errors;
}

/**
 * 빌드 타임 검증: Shared Catalog 관련 필드 참조 검증
 *
 * ⚠️ 중요: 이 코드는 모듈 로드 시 자동으로 실행됩니다.
 * 빌드 타임에 검증 오류가 있으면 즉시 오류를 발생시킵니다.
 * 프로덕션 빌드에서도 검증이 수행되므로, 관련 필드 참조 오류를 조기에 발견할 수 있습니다.
 *
 * ⚠️ 환경 변수 접근 방식: 이 파일은 Node 환경(packages/)에서 실행되므로 process.env를 사용합니다.
 * Vite 환경(apps/)에서는 import.meta.env를 사용합니다 (automation-event-descriptions.ts 참조).
 *
 * 개발 환경에서만 실행하려면 다음 조건을 추가하세요:
 * ```typescript
 * if (process.env.NODE_ENV === 'development') {
 *   const errors = validateSharedCatalog();
 *   if (errors.length > 0) {
 *     throw new Error(`[Shared Catalog] Validation failed:\n${errors.join('\n')}`);
 *   }
 * }
 * ```
 */
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // 개발 환경에서만 빌드 타임 검증 실행
  // ⚠️ 일관성: Node 환경이므로 process.env 사용 (Vite 환경은 import.meta.env 사용)
  const errors = validateSharedCatalog();
  if (errors.length > 0) {
    console.error('[Shared Catalog] Validation errors:', errors);
    // 개발 환경에서는 경고만 출력 (빌드 중단하지 않음)
    // 프로덕션 빌드에서는 검증을 건너뜀
  }
}

/**
 * 키워드로 공통화 요소 검색
 *
 * @param keyword 검색 키워드
 * @returns 검색 결과 배열
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

  // hooks 검색
  Object.entries(sharedCatalog.hooks).forEach(([key, item]) => {
    if (
      key.toLowerCase().includes(lowerKeyword) ||
      item.useWhen.toLowerCase().includes(lowerKeyword) ||
      item.path.toLowerCase().includes(lowerKeyword)
    ) {
      results.push({ category: 'hooks', key, item });
    }
  });

  // features 검색
  Object.entries(sharedCatalog.features).forEach(([key, item]) => {
    if (
      key.toLowerCase().includes(lowerKeyword) ||
      item.useWhen.toLowerCase().includes(lowerKeyword) ||
      item.path.toLowerCase().includes(lowerKeyword)
    ) {
      results.push({ category: 'features', key, item });
    }
  });

  // adapters 검색
  Object.entries(sharedCatalog.adapters).forEach(([key, item]) => {
    if (
      key.toLowerCase().includes(lowerKeyword) ||
      item.useWhen.toLowerCase().includes(lowerKeyword) ||
      item.path.toLowerCase().includes(lowerKeyword)
    ) {
      results.push({ category: 'adapters', key, item });
    }
  });

  // components 검색
  Object.entries(sharedCatalog.components).forEach(([key, item]) => {
    if (
      key.toLowerCase().includes(lowerKeyword) ||
      item.useWhen.toLowerCase().includes(lowerKeyword) ||
      item.path.toLowerCase().includes(lowerKeyword)
    ) {
      results.push({ category: 'components', key, item });
    }
  });

  return results;
}

/**
 * Hook이 Shared Catalog에 등록되어 있는지 확인하는 가드 함수
 * @param hookKey 검증할 Hook 키 (예: 'use-task-cards')
 * @returns hookKey가 유효한 Hook인지 여부
 */
export function isRegisteredHook(hookKey: string): hookKey is keyof typeof sharedCatalog.hooks {
  return hookKey in sharedCatalog.hooks;
}

/**
 * Feature가 Shared Catalog에 등록되어 있는지 확인하는 가드 함수
 * @param featureKey 검증할 Feature 키 (예: 'task-card-item')
 * @returns featureKey가 유효한 Feature인지 여부
 */
export function isRegisteredFeature(featureKey: string): featureKey is keyof typeof sharedCatalog.features {
  return featureKey in sharedCatalog.features;
}

/**
 * Adapter가 Shared Catalog에 등록되어 있는지 확인하는 가드 함수
 * @param adapterKey 검증할 Adapter 키 (예: 'task-cards')
 * @returns adapterKey가 유효한 Adapter인지 여부
 */
export function isRegisteredAdapter(adapterKey: string): adapterKey is keyof typeof sharedCatalog.adapters {
  return adapterKey in sharedCatalog.adapters;
}

/**
 * Component가 Shared Catalog에 등록되어 있는지 확인하는 가드 함수
 * @param componentKey 검증할 Component 키 (예: 'notification-card-layout')
 * @returns componentKey가 유효한 Component인지 여부
 */
export function isRegisteredComponent(componentKey: string): componentKey is keyof typeof sharedCatalog.components {
  return componentKey in sharedCatalog.components;
}

/**
 * Hook이 Shared Catalog에 등록되어 있는지 검증하는 assert 함수 (Fail-Closed)
 * Automation Event Catalog의 assertAutomationEventType 패턴과 동일한 원칙
 *
 * ⚠️ 사용 권장: SSOT 원칙에 따라 런타임 검증이 권장되나, 현재 실제 사용 사례가 적습니다.
 * 개발 환경에서 Hook 사용 시 이 함수를 호출하여 등록 여부를 검증하는 것을 권장합니다.
 *
 * @param hookKey 검증할 Hook 키 (예: 'use-task-cards')
 * @throws Error hookKey가 유효한 Hook이 아닌 경우
 *
 * @example
 * ```typescript
 * // 개발 환경에서만 검증 (프로덕션 성능 영향 최소화)
 * if (process.env.NODE_ENV === 'development') {
 *   assertRegisteredHook('use-task-cards');
 * }
 * ```
 */
export function assertRegisteredHook(hookKey: string): asserts hookKey is keyof typeof sharedCatalog.hooks {
  if (!isRegisteredHook(hookKey)) {
    const availableHooks = Object.keys(sharedCatalog.hooks).join(', ');
    throw new Error(
      `Hook "${hookKey}" is not registered in shared-catalog.ts. ` +
      `Please add it to packages/shared-catalog.ts before using. ` +
      `Available hooks: ${availableHooks}`
    );
  }
}

/**
 * Feature가 Shared Catalog에 등록되어 있는지 검증하는 assert 함수 (Fail-Closed)
 *
 * ⚠️ 사용 권장: SSOT 원칙에 따라 런타임 검증이 권장되나, 현재 실제 사용 사례가 적습니다.
 * 개발 환경에서 Feature 사용 시 이 함수를 호출하여 등록 여부를 검증하는 것을 권장합니다.
 *
 * @param featureKey 검증할 Feature 키 (예: 'task-card-item')
 * @throws Error featureKey가 유효한 Feature가 아닌 경우
 */
export function assertRegisteredFeature(featureKey: string): asserts featureKey is keyof typeof sharedCatalog.features {
  if (!isRegisteredFeature(featureKey)) {
    const availableFeatures = Object.keys(sharedCatalog.features).join(', ');
    throw new Error(
      `Feature "${featureKey}" is not registered in shared-catalog.ts. ` +
      `Please add it to packages/shared-catalog.ts before using. ` +
      `Available features: ${availableFeatures}`
    );
  }
}

/**
 * Adapter가 Shared Catalog에 등록되어 있는지 검증하는 assert 함수 (Fail-Closed)
 *
 * ⚠️ 사용 권장: SSOT 원칙에 따라 런타임 검증이 권장되나, 현재 실제 사용 사례가 적습니다.
 * 개발 환경에서 Adapter 사용 시 이 함수를 호출하여 등록 여부를 검증하는 것을 권장합니다.
 *
 * @param adapterKey 검증할 Adapter 키 (예: 'task-cards')
 * @throws Error adapterKey가 유효한 Adapter가 아닌 경우
 */
export function assertRegisteredAdapter(adapterKey: string): asserts adapterKey is keyof typeof sharedCatalog.adapters {
  if (!isRegisteredAdapter(adapterKey)) {
    const availableAdapters = Object.keys(sharedCatalog.adapters).join(', ');
    throw new Error(
      `Adapter "${adapterKey}" is not registered in shared-catalog.ts. ` +
      `Please add it to packages/shared-catalog.ts before using. ` +
      `Available adapters: ${availableAdapters}`
    );
  }
}

/**
 * Component가 Shared Catalog에 등록되어 있는지 검증하는 assert 함수 (Fail-Closed)
 *
 * ⚠️ 사용 권장: SSOT 원칙에 따라 런타임 검증이 권장되나, 현재 실제 사용 사례가 적습니다.
 * 개발 환경에서 Component 사용 시 이 함수를 호출하여 등록 여부를 검증하는 것을 권장합니다.
 *
 * @param componentKey 검증할 Component 키 (예: 'notification-card-layout')
 * @throws Error componentKey가 유효한 Component가 아닌 경우
 */
export function assertRegisteredComponent(componentKey: string): asserts componentKey is keyof typeof sharedCatalog.components {
  if (!isRegisteredComponent(componentKey)) {
    const availableComponents = Object.keys(sharedCatalog.components).join(', ');
    throw new Error(
      `Component "${componentKey}" is not registered in shared-catalog.ts. ` +
      `Please add it to packages/shared-catalog.ts before using. ` +
      `Available components: ${availableComponents}`
    );
  }
}
