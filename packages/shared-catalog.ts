/**
 * Shared Catalog (SSOT) - 공통화 요소 정본 인덱스
 *
 * [불변 규칙] 이 카탈로그에 없는 공통화 요소는 사용하지 않습니다.
 * [불변 규칙] 카탈로그 수정 시 관련 문서와 동기화 필수
 * [불변 규칙] 새 공통 로직 추가 시 반드시 이 카탈로그에 항목 추가
 *
 * 목적: "처음부터 어디를 써야 하지?"를 자동으로 안내
 *
 * ⚠️ 중요: 이 파일은 런타임 import용이 아니라 정적 검사/가이드 SSOT입니다.
 * 타입체크에 포함시키려면 tsconfig.json references 또는 별도 scripts/check-shared-catalog.ts로 강제하는 쪽이 안정적입니다.
 *
 * ⚠️ 자동 검증 (구현 상태):
 * - `assertRegisteredHook()`, `assertRegisteredFeature()`, `assertRegisteredAdapter()` 함수로 런타임 검증 가능
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
}

export const sharedCatalog: SharedCatalog = {
  hooks: {
    'use-task-cards': {
      path: '@hooks/use-task-card',
      import: 'import { useTaskCards } from "@hooks/use-task-card"',
      useWhen: 'TaskCard 조회가 필요한 모든 페이지',
      input: '{ entityType: string; limit?: number }',
      output: 'TaskCard[]',
      extensionPoints: ['entityType', 'limit'],
      doNot: [
        '직접 useQuery로 task_cards 조회',
        'apiClient.get("task_cards") 직접 호출',
        '만료 필터링 로직 중복 구현',
      ],
      examples: [
        'const { data } = useTaskCards({ entityType: "student" });',
        'const { data } = useTaskCards({ entityType: "client", limit: 50 });',
      ],
      related: {
        feature: 'task-card-item',
        adapter: 'industryAdapter.taskCards',
      },
    },
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
        adapter: 'industryAdapter.taskCards',
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
  },
  features: {
    'task-card-item': {
      path: '@features/task-card',
      import: 'import { TaskCardItem } from "@features/task-card"',
      useWhen: 'TaskCard를 UI에 렌더링할 때',
      input: '{ card: TaskCard; onAction?: (card: TaskCard) => void }',
      output: 'React.ReactNode',
      extensionPoints: ['onAction'],
      doNot: [
        'TaskCard 렌더링 로직 중복 구현',
        '업종별 라벨 하드코딩',
      ],
      examples: [
        '<TaskCardItem card={card} onAction={handleAction} />',
      ],
      related: {
        adapter: 'industryAdapter.taskCards',
      },
    },
  },
  adapters: {
    'task-cards': {
      path: '@industry/*/adapter',
      import: 'import { industryAdapter } from "@industry/*/adapter"',
      useWhen: 'TaskCard 라벨/라우팅을 업종별로 커스터마이징할 때',
      input: '없음 (Context에서 자동 주입)',
      output: '{ entityLabel: string; taskTypeLabels: Record<string, string>; buildActionUrl?: (card: TaskCard) => string }',
      extensionPoints: ['entityLabel', 'taskTypeLabels', 'buildActionUrl'],
      doNot: [
        '업종별 라벨을 컴포넌트에 하드코딩',
        '프론트에서 라우팅 직접 조립',
      ],
      examples: [
        'const entityLabel = industryAdapter.taskCards.entityLabel; // "학생" | "고객" | ...',
        'const label = industryAdapter.taskCards.taskTypeLabels[card.task_type];',
      ],
      related: {
        hook: 'use-task-cards',
        feature: 'task-card-item',
      },
    },
  },
} as const;

/**
 * 키워드로 공통화 요소 검색
 *
 * @param keyword 검색 키워드
 * @returns 검색 결과 배열
 */
export function searchCatalog(keyword: string): Array<{
  category: 'hooks' | 'features' | 'adapters';
  key: string;
  item: CatalogItem;
}> {
  const results: Array<{
    category: 'hooks' | 'features' | 'adapters';
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
 * Hook이 Shared Catalog에 등록되어 있는지 검증하는 assert 함수 (Fail-Closed)
 * Automation Event Catalog의 assertAutomationEventType 패턴과 동일한 원칙
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

