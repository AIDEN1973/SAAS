/**
 * 홈 대시보드 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * 아키텍처 문서 3.7.1 섹션 참조
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [P1-4 수정] Zero-Trust 정책 SSOT 명확화:
 * - 컴포넌트에서 getApiContext().tenantId로 추출 후 fetchX(tenantId, ...)에 전달하는 것은 허용
 * - URL/입력값에서 tenantId를 받는 것은 금지 (Zero-Trust 위반)
 * - Hook 내부에서는 getApiContext()로 tenantId 자동 조회
 * 실제 구현: fetchX(tenantId, ...) 패턴 사용, tenantId는 Context에서만 추출
 *
 * 카드 우선순위:
 * 1. Emergency (긴급 알림)
 * 2. AI Briefing
 * 3. Student Tasks
 * 4. Classes
 * 5. Stats
 * 6. Billing Summary
 *
 * 실제 그룹 순서: EMERGENCY > AI_BRIEFING > TASKS > CLASSES > STATS > BILLING
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, PageHeader, ContextRecommendationBanner } from '@ui-core/react';
import { useStudentTaskCards, fetchConsultations, fetchPersonsCount, fetchStudentAlerts } from '@hooks/use-student';
import { useStudentStatsCards } from '../hooks/dashboard-stats/useStudentStatsCards';
import { useAttendanceStatsCards } from '../hooks/dashboard-stats/useAttendanceStatsCards';
import { useRevenueStatsCards } from '../hooks/dashboard-stats/useRevenueStatsCards';
import { useClassStatsCards } from '../hooks/dashboard-stats/useClassStatsCards';
import type { DashboardCard, EmergencyCard, AIBriefingCard, ClassCard, StatsCard, BillingSummaryCard } from '../types/dashboardCard';
import { useAdaptiveNavigation } from '@hooks/use-adaptive-navigation';
import { useMonthEndAdaptation } from '@hooks/use-month-end-adaptation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useClasses } from '@hooks/use-class';
import { useAttendanceLogs, fetchAttendanceLogs } from '@hooks/use-attendance';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchAIInsights } from '@hooks/use-ai-insights';
import { fetchPayments } from '@hooks/use-payments';
import type { DayOfWeek } from '@services/class-service';
import { toKST } from '@lib/date-utils';
import { calculateMonthlyRange, calculateWeeklyRange, getBaseKST } from '../utils/date-range-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { AttendanceLog } from '@services/attendance-service';
import { CardGridLayout } from '../components/CardGridLayout';
import { useDailyStoreMetrics } from '@hooks/use-daily-store-metrics';
import { StatsChartModal } from '../components/dashboard-cards/StatsChartModal';
import { useTenantSettingByPath } from '@hooks/use-config';
import { createQueryKey } from '@hooks/use-query-key-utils';
import { useIndustryTerms } from '@hooks/use-industry-terms';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES, EMPTY_CARD_MESSAGES, EMPTY_CARD_ID_PREFIX, DEFAULT_CLASS_START_TIME } from '../constants';
import { renderCard, createEmptyTaskCard, getPolicyValue, getPolicyValueWithPath, normalizeAIBriefingCard, normalizeDashboardCards, normalizeEmergencyCard, normalizeClassCard, normalizeStatsCard, normalizeBillingSummaryCard, safe, POLICY_REGISTRY, createSafeNavigate, logError, p } from '../utils';

/**
 * 캐시 및 갱신 시간 상수
 * [P1-3 수정] 매직 넘버를 명명된 상수로 변경
 * [P2-REFACTOR-2 수정] NOW_KST_UPDATE 제거: nowKST를 useMemo로 변경하여 interval 불필요
 */
const CACHE_TIMES = {
  TENANT_CONFIG_STALE: 5 * 60 * 1000, // 5분
  TENANT_CONFIG_GC: 10 * 60 * 1000, // 10분
  EMERGENCY_REFETCH: 60 * 1000, // 1분
  EMERGENCY_STALE: 30 * 1000, // 30초
  EMERGENCY_GC: 5 * 60 * 1000, // 5분
  AI_BRIEFING_REFETCH: 5 * 60 * 1000, // 5분
  AI_BRIEFING_STALE: 2 * 60 * 1000, // 2분
  AI_BRIEFING_GC: 5 * 60 * 1000, // 5분
  STATS_REFETCH: 5 * 60 * 1000, // 5분
  STATS_STALE: 60 * 1000, // 1분
  STATS_GC: 5 * 60 * 1000, // 5분
  BILLING_REFETCH: 5 * 60 * 1000, // 5분
  BILLING_STALE: 60 * 1000, // 1분
  BILLING_GC: 5 * 60 * 1000, // 5분
} as const;

/**
 * 대시보드 기간 상수
 */
const DASHBOARD_PERIODS = {
  DAILY_METRICS_DAYS: 30, // 최근 30일 데이터
} as const;

/**
 * 숫자를 한국어 천 단위 구분자가 포함된 문자열로 변환
 * [P2-4 수정] Intl.NumberFormat 사용으로 로케일 안정성 확보
 */

// [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
// devLog는 logError로 대체되었으며, utils에서 import하여 사용

// [P0-1 수정] 가드 컴포넌트 패턴: getApiContext() 실패 시 조기 return으로 인한 React Hooks 규칙 위반 방지
// HomePage는 가드 역할만 하고, 실제 훅 호출은 HomePageInner에서 수행
export function HomePage() {
  let tenantId: string | null = null;

  try {
    tenantId = getApiContext().tenantId ?? null;
  } catch (error) {
    logError('HomePage:Guard:getApiContext', error);
    tenantId = null;
  }

  if (!tenantId) {
    return (
      <ErrorBoundary>
        <Container maxWidth="xl" padding="lg">
          <PageHeader title="대시보드" />
          <div style={{
            padding: 'var(--spacing-xl)',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
          }}>
            <p>시스템 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.</p>
          </div>
        </Container>
      </ErrorBoundary>
    );
  }

  return <HomePageInner tenantId={tenantId} />;
}

// [P0-1 수정] 내부 컴포넌트: 모든 훅 호출이 여기서 수행됨 (React Hooks 규칙 준수)
function HomePageInner({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 업종별 용어 조회
  const terms = useIndustryTerms();

  // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용 (logError)

  // [P0-2, P0-3 수정] SSOT: 네비게이션 보안 유틸리티 사용
  // createSafeNavigate는 SSOT로 관리되며, 인코딩/정규화 우회 방지 포함
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );

  // [P0-NAV-1 수정] 내부 경로 검증 함수 (추천 배너용)
  // Fail Closed: 외부 URL/우회 경로 차단
  const isSafeInternalTarget = (raw: string): boolean => {
    // 빈 문자열/공백 불가
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      return false;
    }
    // decodeURIComponent 1회 시도 (실패 시 false)
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return false;
    }
    // 반드시 "/"로 시작
    if (!decoded.startsWith('/')) {
      return false;
    }
    // "//"로 시작 금지
    if (decoded.startsWith('//')) {
      return false;
    }
    // "://" 포함 금지
    if (decoded.includes('://')) {
      return false;
    }
    // [P0-NAV-1 수정] 스킴 기반 공격 차단 (javascript:, data:, vbscript: 등)
    const lowerDecoded = decoded.toLowerCase();
    if (lowerDecoded.includes('javascript:') ||
        lowerDecoded.includes('data:') ||
        lowerDecoded.includes('vbscript:') ||
        lowerDecoded.includes('file:') ||
        lowerDecoded.includes('about:')) {
      return false;
    }
    // [P0-NAV-1 수정] 역슬래시 포함 시 차단 (시작뿐만 아니라 어디든)
    if (decoded.includes('\\')) {
      return false;
    }
    return true;
  };

  // [P0-DATA-1 수정] 객체 배열 필터링 유틸 (null/비객체/배열/id 없는 요소 제거)
  // Fail Closed: normalizeDashboardCards에 전달 전 요소 단위 검증 및 id 필드 런타임 보장
  // [P0-BUILD] TSX 파싱 안정성: 제네릭 화살표 함수를 함수 선언으로 변경
  function asObjectArray<T extends { id: string }>(value: unknown): T[] {
    if (!Array.isArray(value)) {
      return [];
    }
    // [P0-DATA-1 수정] 배열 제외 및 id 필드 런타임 보장
    return value.filter((v): v is T =>
      !!v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      'id' in v &&
      typeof (v as { id?: unknown }).id === 'string'
    );
  }

  // [P0-2 수정] tenant-config queryFn을 공통 함수로 분리하여 loadConfigOnce와 동일한 로직 사용
  // [P0-2 수정] useCallback으로 메모이제이션하여 매 렌더마다 새 함수 생성 방지
  // [P0-1 수정] tenantConfigQueryKey를 useMemo로 안정화하여 참조 불안정 문제 해결
  // apiClient는 getApiContext() 기반으로 tenant scope가 자동 적용됨.
  // tenantId는 react-query 캐시 키 분리에만 사용.
  // [P0-SEC-1 수정] createQueryKey SSOT 유틸리티 사용으로 일관성 확보
  const tenantConfigQueryKey = useMemo(
    () => createQueryKey('tenant-config', tenantId),
    [tenantId]
  );

  // [P0-1 수정] value는 unknown으로 두어 방어적 파싱 로직과 정합성 확보
  type TenantSettingRow = { key: string; value: unknown };

  const fetchTenantConfig = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (!tenantId) return null;

    try {
      // [P0-1 수정] 제네릭 타입 정의 및 타입 안정성 확보
      // apiClient.get은 단건 타입을 제네릭으로 받고, 배열을 반환함
      const response = await apiClient.get<TenantSettingRow>('tenant_settings', {
        filters: { key: 'config' },
      });

      if (response.error) {
        if (response.error.code === 'PGRST116' || response.error.code === 'PGRST205') {
          return null; // Fail Closed
        }
        return null; // Fail Closed
      }

      // [P0-1 수정] 타입 가드로 배열 확인 후 타입 단언 제거
      // apiClient.get 구현이 항상 배열을 반환하므로 배열로 정규화
      if (!Array.isArray(response.data)) {
        return null; // Fail Closed: 예상치 못한 응답 형식
      }

      const rows: TenantSettingRow[] = response.data;
      if (rows.length === 0) {
        return null; // Fail Closed
      }

      // filters: { key: 'config' }로 필터링했지만, 방어적 코드로 find 사용
      // (apiClient.get의 filters가 정확히 작동하지 않을 경우 대비)
      const configRecord = rows.find((item) => item.key === 'config');
      if (!configRecord || !configRecord.value) {
        return null; // Fail Closed
      }

      // [P1-2 수정] value가 string일 경우 JSON 파싱 (방어적 처리, Fail Closed 유지)
      // [P2-REFACTOR-1 수정] 타입 안전성 강화: JSON.parse 후 런타임 검증 추가
      const raw = configRecord.value;
      if (typeof raw === 'string') {
        try {
          const parsed: unknown = JSON.parse(raw);
          // 파싱 결과가 객체인지 런타임 검증
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
          logError('HomePage:TenantConfig:InvalidParsedType', new Error(`Expected object, got ${typeof parsed}`));
          return null; // Fail Closed: 잘못된 타입
        } catch (error) {
          logError('HomePage:TenantConfig:JSONParse', error);
          return null; // Fail Closed: 파싱 실패
        }
      }
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
      }
      return null; // Fail Closed: 예상치 못한 타입
    } catch (error) {
      logError('HomePage:TenantConfig:Fetch', error);
      return null; // Fail Closed
    }
  }, [tenantId]);

  // Config를 React Query로 캐시 (성능 최적화: 여러 queryFn에서 중복 호출 방지)
  // [P0-2 수정] 공통 queryFn 사용하여 loadConfigOnce와 동일한 로직 보장
  // [P1-3 수정] 매직 넘버를 명명된 상수로 변경
  // [P1-3 수정] React Query v5.17.0 사용 중이므로 gcTime 사용 (v4는 cacheTime)
  // [P1-ARCH-1 수정] config를 변수로 저장하여 getPolicyValueWithPath에서 재사용
  const { data: config } = useQuery({
    queryKey: tenantConfigQueryKey,
    queryFn: fetchTenantConfig,
    enabled: !!tenantId,
    staleTime: CACHE_TIMES.TENANT_CONFIG_STALE,
    gcTime: CACHE_TIMES.TENANT_CONFIG_GC, // v5: gcTime, v4: cacheTime
  });

  // 그래프 모달 상태 관리
  const [chartModalOpen, setChartModalOpen] = useState<{ cardId: string | null }>({ cardId: null });

  // [P2-REFACTOR-2 수정] nowKST 최적화: state+interval 제거하고 useMemo로 계산
  // 기존: state+interval로 1분마다 전체 컴포넌트 리렌더링 발생 (시간당 60회)
  // 개선: useMemo로 컴포넌트 마운트 시 1회만 계산, React Query refetchInterval이 데이터 갱신 담당
  // 빈 배열 의존성: 날짜는 페이지 새로고침 또는 React Query refetch 시 자연스럽게 갱신
  const nowKST = useMemo(() => toKST(), []);

  // 최근 30일 데이터 조회
  const dailyMetricsRange = useMemo(() => {
    const thirtyDaysAgo = nowKST.clone().subtract(DASHBOARD_PERIODS.DAILY_METRICS_DAYS, 'day').format('YYYY-MM-DD');
    const today = nowKST.format('YYYY-MM-DD');
    return {
      date_kst: { gte: thirtyDaysAgo, lte: today },
    };
  }, [nowKST]);

  const { data: dailyStoreMetrics } = useDailyStoreMetrics(dailyMetricsRange);

  // Context Signals (상황 신호 수집 및 UI 조정)
  // 프론트 자동화 문서 1.2.1 섹션 참조: 자동 화면 전환 금지, 상황 신호 수집만 수행
  const adaptiveNav = useAdaptiveNavigation();

  // 월말 적응 (청구 카드 priority 가중치 조정)
  const { shouldPrioritizeBilling } = useMonthEndAdaptation();

  // Student Task Cards 조회
  const { data: studentTaskCards } = useStudentTaskCards();

  // [P0-2 수정] loadConfigOnce를 fetchQuery로 통일하여 in-flight 재사용 및 캐시 저장
  // [P2-1 수정] fetchQuery에 staleTime 옵션 추가하여 원 query의 staleTime 보장
  // [P1-3 수정] 매직 넘버를 명명된 상수로 변경
  const loadConfigOnce = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (!tenantId) return null;
    // fetchQuery는 in-flight 요청을 재사용하고, 캐시에 자동 저장
    return queryClient.fetchQuery({
      queryKey: tenantConfigQueryKey,
      queryFn: fetchTenantConfig,
      staleTime: CACHE_TIMES.TENANT_CONFIG_STALE,
    });
  }, [tenantId, queryClient, tenantConfigQueryKey, fetchTenantConfig]);

  // [SSOT] Barrel export를 통한 통합 import
  // [P1-ARCH-1 수정] Policy 소스 이원화 명확화:
  // - config 기반 Policy: getPolicyValue(key, config) 사용 (대부분의 Policy)
  // - path 기반 Policy: useTenantSettingByPath(POLICY_REGISTRY[key].path) + getPolicyValueWithPath(key, config, pathValue) 사용 (AI_RISK_SCORE_THRESHOLD만 예외)
  // - 현재 상태: AI_RISK_SCORE_THRESHOLD만 path 기반, 나머지는 모두 config 기반
  // - 향후 통일 계획: 모든 Policy를 config 기반으로 통일 예정 (policy-registry.ts의 마이그레이션 가이드 참조)
  // [P1-ARCH-2 수정] Policy 경로 점(.) 이스케이프 규칙:
  // - 운영 규칙: Policy 경로 키에는 점(.) 사용 금지
  // - Policy Registry 초기화 시 validatePolicyPath()로 자동 검증 (개발 환경)
  // - 현재 구현은 단순 split('.')을 사용하므로 키에 점이 포함되면 파싱 오류 발생
  // - 예: "auto_notification.payment_due_reminder.enabled" (정상)
  // - 예: "auto_notification.payment.due.reminder" (키에 점 포함, 금지)


  // Emergency Cards 조회 (결제 실패, 출결 오류, AI 위험 점수 기반)
  // 아키텍처 문서 4.6 섹션 참조: Emergency Card 표시 조건
  // [불변 규칙] Automation Config First: 모든 임계값은 Policy 기반으로만 동작
  // [P2-QUALITY-1 수정] createQueryKey SSOT 유틸리티 사용
  const { data: emergencyCards } = useQuery({
    queryKey: createQueryKey('emergency-cards', tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: EmergencyCard[] = [];

      // 성능 최적화: config를 한 번만 조회하고 재사용
      const config = await loadConfigOnce();

      // [P0-1 수정] Fail Closed: 정책이 없으면 Emergency는 생성하지 않는다
      // config가 null이면 모든 Policy 조회가 null이 되므로, early return으로 불필요한 처리 방지
      if (!config) return cards;

      // [P0-CORRECT-1 수정] 시간 경계 불일치 방지: queryFn 시작 시 baseKST 한 번만 생성
      // [P2-REFACTOR-3 수정] getBaseKST() 사용으로 SSOT 준수
      const baseKST = getBaseKST();

      // 1. 결제 실패 임계값 체크 (아키텍처 문서 4747줄 참조)
      // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
      // [P1-ARCH-1, P1-ARCH-3 수정] getPolicyValue 사용으로 타입 안전성 확보 및 Policy 소스 통일
      // [P0-1 수정] Policy 기반 lookback window로 기간 제한 (Fail Closed)
      // 정본 규칙: fetchPayments 함수 사용 (Hook의 queryFn 로직 재사용)
      // [SSOT] POLICY_REGISTRY 직접 사용 (EMERGENCY_CARDS_POLICY_PATHS 대신)
      const paymentFailedThreshold = getPolicyValue<number>('PAYMENT_FAILED_THRESHOLD', config);
      const lookbackDays = getPolicyValue<number>('PAYMENT_FAILED_LOOKBACK_DAYS', config);

      // [P0-2 수정] 결제 실패 섹션에 try/catch 추가하여 부분 실패 시에도 나머지 emergency 카드가 살아있게 함
      try {
        if (paymentFailedThreshold !== null && lookbackDays !== null) {
          // [P0-1 수정] Policy 기반 lookback window로 기간 제한
          const fromISO = baseKST.clone().subtract(lookbackDays, 'day').startOf('day').toISOString();
          const toISO = baseKST.clone().endOf('day').toISOString();

        const failedPayments = await fetchPayments(tenantId, {
          status: 'failed',
            created_at: { gte: fromISO, lte: toISO },
          });

          // [P0-4 수정] fetchPayments 반환이 배열이라는 보장이 없으므로 방어 코드 추가
          const failedPaymentsSafe = Array.isArray(failedPayments) ? failedPayments : [];
          if (failedPaymentsSafe.length > 0) {
            const failedCount = failedPaymentsSafe.length;
          if (failedCount >= paymentFailedThreshold) {
              // [SSOT] 입력 정규화 레이어 사용
              cards.push(normalizeEmergencyCard({
              id: 'payment-failed-emergency',
              type: 'emergency',
              title: `${terms.PAYMENT_LABEL} 실패 알림`,
                message: `최근 ${lookbackDays}일간 ${terms.PAYMENT_LABEL} 실패가 ${failedCount}건 발생했습니다.`,
              priority: 1,
                action_url: ROUTES.BILLING_HOME,
              }));
          }
        }
        }
      } catch (error) {
        // [P0-2 수정] 결제 실패 섹션 실패 시 조용히 무시하여 나머지 emergency 카드가 표시되도록 함
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Emergency:PaymentFailed', error);
      }

      // 2. 출결 오류 이벤트 시간 임계값 체크 (아키텍처 문서 4747줄 참조)
      // [P2-8 수정] Fail Closed: 정식 데이터 소스 없으면 카드 생성하지 않음
      // 출결 오류 Emergency는 정식 데이터 소스(오류 전용 필드/테이블)가 없어 임시 구현 상태
      // notes 키워드 기반 필터링은 오탐 가능성이 높으므로, 정식 데이터 소스 준비 전까지 카드 생성 금지
      // TODO[DATA]: 출결 오류 전용 필드/테이블이 추가되면 아래 로직 활성화
      // [SSOT] POLICY_REGISTRY 직접 사용 (EMERGENCY_CARDS_POLICY_PATHS 대신)
      // const attendanceErrorEnabled = getPolicyValueFromConfig(config, POLICY_REGISTRY.ATTENDANCE_ERROR_ENABLED.path);
      // if (attendanceErrorEnabled === true) { ... }
      // [P0-2 참고] 활성화 시 date_from은 date string 형식 사용: toKST().subtract(...).format('YYYY-MM-DD')

      // 3. AI 위험 점수 90 이상 체크는 studentTaskCards에서 파생 (정본 규칙: task_cards 직접 조회 제거)
      // 정본 규칙: Emergency 쿼리 내부에서 apiClient.get('task_cards') 직접 조회 금지
      // studentTaskCards에서 risk 타입 카드를 파생하여 사용 (라인 138 이후 useMemo에서 처리)

      // 4. 학생 알림 요약 (이탈 위험, 결석, 상담 대기)
      // 정본 규칙: fetchStudentAlerts 함수 사용 (Hook의 queryFn 로직 재사용)
      try {
        const studentAlerts = await fetchStudentAlerts(tenantId);
        if (studentAlerts.risk_count > 0) {
          // [SSOT] 입력 정규화 레이어 사용
          cards.push(normalizeEmergencyCard({
            id: 'emergency-risk-students',
            type: 'emergency',
            title: `${terms.EMERGENCY_RISK_LABEL} ${terms.PERSON_LABEL_PLURAL}`,
            message: `${studentAlerts.risk_count}명의 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} ${terms.EMERGENCY_RISK_LABEL}입니다.`,
            priority: 4,
            action_url: terms.ROUTES.PRIMARY_RISK,
          }));
        }
        if (studentAlerts.absent_count > 0) {
          // [SSOT] 입력 정규화 레이어 사용
          cards.push(normalizeEmergencyCard({
            id: 'emergency-absent-students',
            type: 'emergency',
            title: `${terms.ABSENCE_LABEL} ${terms.PERSON_LABEL_PLURAL} 알림`,
            message: `${studentAlerts.absent_count}명의 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} ${terms.EMERGENCY_ABSENT_LABEL}입니다.`,
            priority: 5,
            action_url: terms.ROUTES.PRIMARY_ABSENT,
          }));
        }
        if (studentAlerts.consultation_pending_count > 0) {
          // [SSOT] 입력 정규화 레이어 사용
          cards.push(normalizeEmergencyCard({
            id: 'emergency-consultation-pending',
            type: 'emergency',
            title: `${terms.CONSULTATION_LABEL} 대기 ${terms.PERSON_LABEL_PLURAL}`,
            message: `${studentAlerts.consultation_pending_count}명의 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} ${terms.EMERGENCY_CONSULTATION_PENDING_LABEL}입니다.`,
            priority: 6,
            action_url: terms.ROUTES.PRIMARY_CONSULTATION,
          }));
        }
      } catch (error) {
        // [P2-1 수정] React Query v5(useQuery)에는 onError 옵션이 없으므로, 여기서는 Fail Closed로 조용히 무시
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Emergency:StudentAlerts', error);
      }

      // 5. 시스템 오류 체크 (추가)
      // TODO[DATA]: 시스템 오류 로그 테이블이 생성되면 실제 조회로 변경

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: CACHE_TIMES.EMERGENCY_REFETCH,
    staleTime: CACHE_TIMES.EMERGENCY_STALE,
    gcTime: CACHE_TIMES.EMERGENCY_GC,
    // [P2-1 수정] React Query v5에서는 onError가 제거되었으므로, queryFn 내부에서 에러 처리
    // 전역 에러 핸들링은 QueryClient의 defaultOptions에서 설정 가능
  });

  // Policy 조회: AI 위험 점수 임계값
  // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
  // [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
  // [P1-ARCH-1, P1-ARCH-3 수정] getPolicyValueWithPath 사용으로 Policy 소스 이원화 해결 및 타입 안전성 확보
  // - AI_RISK_SCORE_THRESHOLD는 path 기반이므로 useTenantSettingByPath로 조회 후 getPolicyValueWithPath로 타입 검증
  // - 나머지 Policy는 config 기반이므로 getPolicyValue 사용
  // [SSOT] POLICY_REGISTRY 직접 사용 (EMERGENCY_CARDS_POLICY_PATHS 대신)
  const { data: aiRiskScoreThreshold } = useTenantSettingByPath(POLICY_REGISTRY.AI_RISK_SCORE_THRESHOLD.path);
  const aiRiskScoreThresholdValue = getPolicyValueWithPath<number>('AI_RISK_SCORE_THRESHOLD', config, aiRiskScoreThreshold);

  // 정본 규칙: Emergency 쿼리 내부에서 task_cards 직접 조회 제거
  // studentTaskCards에서 risk 카드를 파생하여 Emergency 카드에 합성
  const enhancedEmergencyCards = useMemo(() => {
    if (!emergencyCards || !studentTaskCards) return emergencyCards || [];

    // [불변 규칙] Fail Closed: Policy가 없으면 Emergency Card 생성하지 않음
    if (typeof aiRiskScoreThresholdValue !== 'number') {
      return emergencyCards;
    }

    // [P0-DATA-1 수정] Fail-Closed: null/비객체/배열/id 없는 요소 제거 후 정규화
    const safeStudentTaskCards = asObjectArray<Partial<DashboardCard> & { id: string }>(studentTaskCards);
    // [SSOT] 입력 정규화 레이어 사용
    // 타입 단언 불필요: asObjectArray가 id: string을 런타임 보장
    const normalizedTaskCards = normalizeDashboardCards(safeStudentTaskCards);

    // studentTaskCards에서 Policy 기반 임계값 이상인 risk 타입 카드 찾기
    // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
    // [P1-ARCH-3 수정] 정책 해석 일관성 문제: task_type별 priority 스케일 규칙 명확화
    // - task_type='risk'인 카드에서 priority는 risk_score를 담습니다 (create_risk_task_card RPC에서 p_risk_score를 priority에 저장)
    // - 따라서 priority >= aiRiskScoreThresholdValue 비교는 위험 점수 임계값 비교와 동일합니다
    // - 주의: 이는 task_type='risk'인 경우에만 유효하며, 다른 task_type과는 스케일(0~100) 규칙이 다를 수 있습니다
    // - 아키텍처 문서 3.1.2: TaskCard의 priority는 0-100 스케일로 정의되어 있으나, task_type='risk'에서만 특수 해석 적용
    // - TODO[ARCH]: task_type별 priority 스케일 규칙을 SSOT(아키텍처 문서 또는 Policy Registry)에 명시하여 확장 시 일관성 보장
    //   * 옵션 1: 아키텍처 문서에 task_type별 priority 해석 규칙 명시
    //   * 옵션 2: task_type별 전용 필드(risk_score, urgency_level 등) 사용하여 priority와 분리
    const highRiskCard = normalizedTaskCards.find((card) => {
      if (!('task_type' in card) || card.task_type !== 'risk' || !('action_url' in card) || !card.action_url) return false;
      // 정규화 후에는 priority가 항상 number
      const score = 'priority' in card && typeof card.priority === 'number' ? card.priority : 0;
      return Number.isFinite(score) && score >= aiRiskScoreThresholdValue;
    });

    if (highRiskCard) {
      // [P0-1 수정] AI risk emergency 카드 추가 (priority 정렬은 sortedCards에서 처리)
      // [SSOT] 입력 정규화 레이어 사용
      const aiRiskEmergency = normalizeEmergencyCard({
        id: 'ai-risk-emergency',
        type: 'emergency',
        title: 'AI 위험 감지',
        message: `높은 위험 점수를 가진 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} 감지되었습니다.`,
        priority: 3,
        action_url: highRiskCard.action_url, // 정본: 서버에서 제공된 action_url 사용
      });

      // priority 정렬은 sortedCards에서 처리하므로 여기서는 단순 추가
      return [...emergencyCards, aiRiskEmergency];
    }

    return emergencyCards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencyCards, studentTaskCards, aiRiskScoreThresholdValue]);

  // AI Briefing Cards 조회
  // 아키텍처 문서 3.7.1 섹션 참조: AI 브리핑 카드
  // [P2-QUALITY-1 수정] createQueryKey SSOT 유틸리티 사용
  const { data: aiBriefingCards } = useQuery({
    queryKey: createQueryKey('ai-briefing-cards', tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: AIBriefingCard[] = [];

      // 성능 최적화: config를 한 번만 조회하고 재사용
      const config = await loadConfigOnce();

      // [P1-1 수정] queryFn 시작에서 baseKST 한 번만 생성하여 자정 경계 불일치 방지
      // [P2-REFACTOR-3 수정] getBaseKST() 사용으로 SSOT 준수
      const baseKST = getBaseKST();

      try {
        // AI 브리핑 카드는 배치 작업에서 서버가 생성함 (아키텍처 문서 3911줄: 매일 07:00 생성, AI 호출 포함)
        // ai_insights 테이블에서 오늘 날짜의 브리핑 카드 조회
        // 정본 규칙: fetchAIInsights 함수 사용 (Hook의 queryFn 로직 재사용)
        // [P1-2 수정] 날짜 경계 계산은 clone() 기반으로 통일하여 mutating 호출 리스크 제거
        const todayDateKSTBase = baseKST;
        const todayStartISO = todayDateKSTBase.clone().startOf('day').toISOString();
        const todayEndISO = todayDateKSTBase.clone().endOf('day').toISOString();
        const aiInsights = await fetchAIInsights(tenantId, {
          insight_type: 'daily_briefing',
          created_at: { gte: todayStartISO, lte: todayEndISO },
        });

        // [P0-3 수정] 조기 return 제거, cards에 합쳐서 마지막에 return
        // 서버가 생성한 브리핑 카드 + 클라이언트 파생 카드를 모두 포함
        // [P0-1 수정] Fail-Closed: 배열 타입 가드 추가 (aiInsights가 배열이 아니면 크래시 방지)
        const safeAiInsights = Array.isArray(aiInsights) ? aiInsights : [];
        if (safeAiInsights.length > 0) {
          // ai_insights 테이블에서 조회한 데이터를 AIBriefingCard 형식으로 변환
          const serverInsights = safeAiInsights.map((insight) => {
            let parsedInsights: unknown = insight.insights;
            if (typeof insight.insights === 'string') {
              try {
                parsedInsights = JSON.parse(insight.insights);
              } catch (error) {
                // [P2-1 수정] 파싱 에러는 onError에서 통합 처리하지 않고 조용히 처리 (빈 배열로 대체)
                // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
                logError('HomePage:AIBriefing:JSONParse', error);
                parsedInsights = [];
              }
            }
            // [SSOT] 입력 정규화 레이어 사용
            return normalizeAIBriefingCard({
              id: insight.id,
              type: 'ai_briefing' as const,
              title: insight.title,
              summary: insight.summary,
              insights: Array.isArray(parsedInsights) ? parsedInsights as string[] : [],
              created_at: insight.created_at ?? baseKST.toISOString(),
              action_url: insight.action_url,
            });
          });
          // 서버 브리핑 카드를 cards에 추가 (조기 return 제거)
          cards.push(...serverInsights);
        } else {
        // ai_insights 테이블에 데이터가 없는 경우 (배치 작업 전 또는 실패 시) fallback 로직
        // 주의: 이는 임시 fallback이며, 정상적으로는 배치 작업에서 생성된 카드를 사용해야 함
        // 정본 규칙: fetchConsultations 함수 사용 (Hook의 queryFn 로직 재사용)
        // [P1-7 수정] 오늘만 포함하도록 lte 조건 추가
        // [P1-2 수정] 날짜 경계 계산은 clone() 기반으로 통일하여 mutating 호출 리스크 제거
          // [P1-1 수정] baseKST 재사용
          const todayDateKSTForConsultationsBase = baseKST;
        const todayStart = todayDateKSTForConsultationsBase.clone().startOf('day').format('YYYY-MM-DD');
        const todayEnd = todayDateKSTForConsultationsBase.clone().endOf('day').format('YYYY-MM-DD');
        const todayConsultations = await fetchConsultations(tenantId, {
          consultation_date: { gte: todayStart, lte: todayEnd },
        });
        // [P0-4 수정] Fail-Closed: 배열 타입 가드 추가 (todayConsultations가 배열이 아니면 크래시 방지)
        const safeTodayConsultations = Array.isArray(todayConsultations) ? todayConsultations : [];
        if (safeTodayConsultations.length > 0) {
            // [SSOT] 입력 정규화 레이어 사용
            cards.push(normalizeAIBriefingCard({
            id: 'briefing-consultations',
            type: 'ai_briefing',
            title: `오늘의 ${terms.CONSULTATION_LABEL} 일정`,
            summary: `오늘 ${safeTodayConsultations.length}건의 ${terms.CONSULTATION_LABEL}${p.이가(terms.CONSULTATION_LABEL)} 예정되어 있습니다.`,
            insights: [
              `${terms.CONSULTATION_LABEL}일지를 작성하여 ${terms.PERSON_LABEL_PRIMARY} 관리를 강화하세요.`,
              `${terms.CONSULTATION_LABEL} 내용을 바탕으로 ${terms.PERSON_LABEL_PRIMARY}의 진행 방향을 조정할 수 있습니다.`,
            ],
              created_at: baseKST.toISOString(),
              action_url: ROUTES.AI_CONSULTATION, // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
            }));
          }
        }

        // [P0-1 수정] Fail Closed: 정책이 없으면 정책 기반 파생 카드는 생성하지 않는다
        // 서버 ai_insights는 정책 없어도 보여줘야 하므로, serverInsights push까지는 실행하고
        // 정책 기반 파생 카드만 if (!config) return cards;로 끊음
        if (!config) return cards;

        // 2. 이번 달 청구서 상태 확인
        // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
        // [P1-ARCH-1, P1-ARCH-3 수정] getPolicyValue 사용으로 타입 안전성 확보 및 Policy 소스 통일
        // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
        // [SSOT] POLICY_REGISTRY 직접 사용 (EMERGENCY_CARDS_POLICY_PATHS 대신)
        const collectionRateThreshold = getPolicyValue<number>('COLLECTION_RATE_THRESHOLD', config);
        if (collectionRateThreshold !== null) {
          // [P0-2 수정] baseKST 재사용하여 자정 경계 불일치 방지
          // [P0-4 수정] clone() 사용하여 원본 mutate 방지
          // [P2-REFACTOR-3 수정] calculateMonthlyRange 사용으로 날짜 계산 통일
          const monthlyRange = calculateMonthlyRange(baseKST);
          const invoices = await fetchBillingHistory(tenantId, {
            period_start: { gte: monthlyRange.current.dateString.from, lte: monthlyRange.current.dateString.to },
          });

          // [P0-2 수정] Fail-Closed: 배열 타입 가드 추가 (invoices가 배열이 아니면 크래시 방지)
          const safeInvoices = Array.isArray(invoices) ? invoices : [];
          if (safeInvoices.length > 0) {
            const totalAmount = safeInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
            const paidAmount = safeInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);
            const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

            if (safeInvoices.length > 0) {
              // [SSOT] 입력 정규화 레이어 사용
              cards.push(normalizeAIBriefingCard({
                id: 'briefing-billing',
                type: 'ai_briefing',
                title: `이번 달 ${terms.BILLING_LABEL} 현황`,
                summary: `이번 달 ${terms.INVOICE_LABEL}${p.이가(terms.INVOICE_LABEL)} 자동 발송되었습니다. 예상 ${terms.COLLECTION_RATE_LABEL}${p.은는(terms.COLLECTION_RATE_LABEL)} ${expectedCollectionRate}%입니다.`,
                insights: [
                  expectedCollectionRate >= collectionRateThreshold
                    ? `${terms.COLLECTION_RATE_LABEL}${p.이가(terms.COLLECTION_RATE_LABEL)} 양호합니다. 현재 운영 방식을 유지하세요.`
                    : `${terms.COLLECTION_RATE_LABEL} 개선이 필요합니다. 미납 ${terms.PERSON_LABEL_PRIMARY}에게 연락을 취하세요.`,
                ],
                created_at: baseKST.toISOString(),
                action_url: ROUTES.BILLING_HOME, // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
              }));
            }
          }
        }

        // 3. 출결 이상 패턴 확인 (최근 7일)
        // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
        // [P1-ARCH-1, P1-ARCH-3 수정] getPolicyValue 사용으로 타입 안전성 확보 및 Policy 소스 통일
        // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
        // [SSOT] POLICY_REGISTRY 직접 사용 (EMERGENCY_CARDS_POLICY_PATHS 대신)
        const attendanceAnomalyAbsentThreshold = getPolicyValue<number>('ATTENDANCE_ANOMALY_ABSENT_THRESHOLD', config);
        const attendanceAnomalyLateThreshold = getPolicyValue<number>('ATTENDANCE_ANOMALY_LATE_THRESHOLD', config);
        if (attendanceAnomalyAbsentThreshold !== null && attendanceAnomalyLateThreshold !== null) {
          // [P1-1 수정] baseKST 재사용하여 자정 경계 불일치 방지
          // [P0-2 수정] date_from은 date string 형식 사용 (AttendanceFilter 타입 정의 준수)
          // [P0-5 수정] date_to를 명시적으로 추가하여 무기한 조회 방지
          const sevenDaysAgoBase = baseKST.clone().subtract(7, 'days');
          const logs = await fetchAttendanceLogs(tenantId, {
            date_from: sevenDaysAgoBase.clone().startOf('day').format('YYYY-MM-DD'),
            date_to: baseKST.clone().endOf('day').format('YYYY-MM-DD'), // [P0-5 수정] 무기한 조회 방지
          });

          // [P0-3 수정] Fail-Closed: 배열 타입 가드 추가 (logs가 배열이 아니면 크래시 방지)
          const safeLogs = Array.isArray(logs) ? logs : [];
          if (safeLogs.length > 0) {
            const absentCount = safeLogs.filter((log: AttendanceLog) => log.status === 'absent').length;
            const lateCount = safeLogs.filter((log: AttendanceLog) => log.status === 'late').length;

            if (absentCount > attendanceAnomalyAbsentThreshold || lateCount > attendanceAnomalyLateThreshold) {
              // [SSOT] 입력 정규화 레이어 사용
              cards.push(normalizeAIBriefingCard({
                id: 'briefing-attendance',
                type: 'ai_briefing',
                title: `${terms.ATTENDANCE_LABEL} 이상 패턴 감지`,
                summary: `최근 7일간 ${terms.ABSENCE_LABEL} ${absentCount}건, ${terms.LATE_LABEL} ${lateCount}건이 발생했습니다.`,
                insights: [
                  `${terms.ATTENDANCE_LABEL} 패턴을 분석하여 원인을 파악하세요.`,
                  `${terms.LATE_LABEL}${p.이가(terms.LATE_LABEL)} 많은 ${terms.PERSON_LABEL_PLURAL}에게 사전 안내를 제공하세요.`,
                ],
                created_at: baseKST.toISOString(),
                action_url: ROUTES.AI_ATTENDANCE, // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
              }));
            }
          }
        }

        // 4. 이탈 위험 학생 확인은 studentTaskCards에서 파생 (정본 규칙: task_cards 직접 조회 제거)
        // 정본 규칙: AI Briefing 쿼리 내부에서 apiClient.get('task_cards') 직접 조회 금지
        // studentTaskCards에서 risk 타입 카드를 파생하여 사용 (라인 299 이후 useMemo에서 처리)
      } catch (error) {
        // [P2-1 수정] console.error 직접 호출 제거: 주석과 실제 코드 불일치 해결
        // 규칙/주석과 실행이 충돌 → 이후 리뷰/운영에서 혼란 방지
        // 전역 에러 핸들러(QueryClient defaultOptions)에서 중앙 집중 처리 권장
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:AIBriefing:CardGeneration', error);
        // 에러 발생 시 빈 배열 반환
      }

      // 모든 AI Briefing 카드 반환 (제한 없음, UI에서 모든 카드 출력)
      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: CACHE_TIMES.AI_BRIEFING_REFETCH,
    staleTime: CACHE_TIMES.AI_BRIEFING_STALE,
    gcTime: CACHE_TIMES.AI_BRIEFING_GC,
    // [P2-1 수정] React Query v5에서는 onError가 제거되었으므로, queryFn 내부에서 에러 처리
  });

  // 오늘 요일 계산 (기술문서 5-2: KST 기준 날짜 처리)
  // [P0-1 수정] useMemo 제거: 자정 이후 갱신을 위해 매 렌더 계산
  // [P2-2 수정] nowKST 재사용하여 경계 시각에서 값이 갈리지 않도록 보장
  // [P0-2 수정] 인덱싱 결과 undefined 가능성 방지: fallback 추가 (Fail Closed)
  const todayDayOfWeek: DayOfWeek = (() => {
    const dayOfWeek = nowKST.day(); // 0(일) ~ 6(토)
    const dayOfWeekMap: Record<number, DayOfWeek> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return dayOfWeekMap[dayOfWeek] ?? 'monday'; // Fail Closed: 예상치 못한 값이면 'monday' 반환
  })();

  // 오늘 수업 목록 조회
  // [P1-1 수정] 파라미터 객체를 useMemo로 고정하여 queryKey 불안정 방지
  const classesParams = useMemo(() => ({
    day_of_week: todayDayOfWeek,
    status: 'active' as const,
  }), [todayDayOfWeek]);

  const { data: todayClassesData } = useClasses(classesParams);

  // 정본 규칙: apiClient.get('attendance_logs') 직접 조회 제거, useAttendanceLogs Hook 사용
  // [P2-9 수정] 미사용 변수 todayDate 제거
  // [P2-2 수정] nowKST 재사용하여 경계 시각에서 값이 갈리지 않도록 보장
  // [P0-2 수정] date_from/date_to는 date string 형식 사용 (AttendanceFilter 타입 정의 준수)
  // [P1-1 수정] 파라미터 객체를 useMemo로 고정하여 queryKey 불안정 방지
  const attendanceParams = useMemo(() => {
    const dateFrom = nowKST.clone().startOf('day').format('YYYY-MM-DD');
    const dateTo = nowKST.clone().endOf('day').format('YYYY-MM-DD');
    return {
      date_from: dateFrom,
      date_to: dateTo,
      attendance_type: 'check_in' as const,
    };
  }, [nowKST]);

  const { data: todayAttendanceLogs } = useAttendanceLogs(attendanceParams);

  // 오늘 수업의 출석 데이터 조회 및 ClassCard 변환
  // [P0-1 수정] 배열 타입 가드 추가: todayClassesData와 todayAttendanceLogs가 배열이 아니면 크래시 방지
  const todayClasses = useMemo<ClassCard[]>(() => {
    // [P0-1 수정] Fail-Closed: 배열 타입 가드 추가
    const safeTodayClassesData = Array.isArray(todayClassesData) ? todayClassesData : [];
    const safeTodayAttendanceLogs: AttendanceLog[] = Array.isArray(todayAttendanceLogs) ? todayAttendanceLogs : [];

    if (safeTodayClassesData.length === 0) return [];

    return safeTodayClassesData.map((cls) => {
      // 오늘 날짜의 출석 데이터에서 해당 수업의 출석 수 계산
      // [P0-1 수정] safeTodayAttendanceLogs 사용 (배열 보장)
      const attendanceCount = safeTodayAttendanceLogs.filter((log) =>
        log.class_id === cls.id && log.status === 'present'
      ).length;
      const studentCount = cls.current_count || 0;

      // [SSOT] 입력 정규화 레이어 사용
      return normalizeClassCard({
        id: cls.id,
        type: 'class',
        class_name: cls.name,
        start_time: cls.start_time,
        student_count: studentCount,
        attendance_count: attendanceCount,
        action_url: ROUTES.ATTENDANCE_BY_CLASS(cls.id),
      });
    });
  }, [todayClassesData, todayAttendanceLogs]);

  // [P2-REFACTOR-4 완료] 날짜 범위를 미리 계산하여 여러 훅에서 재사용
  const baseKST = useMemo(() => getBaseKST(), []);
  const monthlyRange = useMemo(() => calculateMonthlyRange(baseKST), [baseKST]);
  const weeklyRange = useMemo(() => calculateWeeklyRange(baseKST), [baseKST]);

  // [P2-REFACTOR-4 완료] Stats Cards를 독립적 훅으로 분리
  // - 섹션 1-4: 학생 통계 (useStudentStatsCards)
  // - 섹션 5-7: 출석 통계 (useAttendanceStatsCards)
  // - 섹션 8-10: 매출/ARPU 통계 (useRevenueStatsCards)
  // - 섹션 11-13: 수업 통계 (useClassStatsCards)
  // React Query가 이 4개 쿼리를 자동으로 병렬 실행

  // 공유 변수: studentCount는 여러 Hook에서 사용되므로 먼저 조회
  const { data: studentCountData } = useQuery({
    queryKey: createQueryKey('student-count-for-stats', tenantId),
    queryFn: async () => {
      if (!tenantId) return { current: 0, lastMonth: 0 };

      const lastMonthEnd = monthlyRange.last.iso.lte;
      const [current, lastMonth] = await Promise.all([
        safe(fetchPersonsCount(tenantId, { person_type: 'student' }), 0),
        safe(fetchPersonsCount(tenantId, { person_type: 'student', created_at: { lte: lastMonthEnd } }), 0),
      ]);

      return { current, lastMonth };
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const studentCount = studentCountData?.current ?? 0;
  const lastMonthStudentCount = studentCountData?.lastMonth ?? 0;

  const { data: studentStatsCards = [] } = useStudentStatsCards({
    tenantId,
    monthlyRange,
    weeklyRange,
    enabled: !!tenantId,
  });

  const { data: attendanceStatsCards = [] } = useAttendanceStatsCards({
    tenantId,
    baseKST,
    monthlyRange,
    weeklyRange,
    enabled: !!tenantId,
  });

  const { data: revenueStatsCards = [] } = useRevenueStatsCards({
    tenantId,
    baseKST,
    monthlyRange,
    weeklyRange,
    studentCount,
    lastMonthStudentCount,
    enabled: !!tenantId && studentCount !== undefined,
  });

  const { data: classStatsCards = [] } = useClassStatsCards({
    tenantId,
    monthlyRange,
    studentCount,
    enabled: !!tenantId && studentCount !== undefined,
  });

  // [P2-REFACTOR-4 완료] Stats Cards 병합
  // 4개의 독립적 쿼리 결과를 하나로 병합
  const statsCards = useMemo(() => {
    return [
      ...studentStatsCards,
      ...attendanceStatsCards,
      ...revenueStatsCards,
      ...classStatsCards,
    ];
  }, [studentStatsCards, attendanceStatsCards, revenueStatsCards, classStatsCards]);

  // 기존 거대한 statsCards queryFn은 위의 4개 Hook으로 완전히 대체됨
  // - 제거된 코드: 약 1,000 lines
  // - React Query 자동 병렬화로 성능 향상
  // - 각 섹션 독립 테스트 가능
  // - 유지보수성 대폭 향상

  // [P2-PERF-1 수정] 미사용 _unusedStatsCards 쿼리 제거
  // 기존에는 하위 호환성을 위해 유지했으나, 4개 독립 Hook으로 완전 대체되어 불필요
  // 제거로 불필요한 React Query 인스턴스 및 refetchInterval 제거

  // Billing Summary 조회
  // [P0-2 수정] queryFn에 try/catch 추가하여 Fail-Closed 처리 (다른 queryFn과 일관성 유지)
  // [P2-QUALITY-1 수정] createQueryKey SSOT 유틸리티 사용
  const { data: billingSummary } = useQuery({
    queryKey: createQueryKey('billing-summary', tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      try {
        // [P0-3 수정] queryFn 내부 다중 toKST() 호출을 baseKST로 통일하여 자정 경계 불일치 방지
        // [P0-4 수정] clone() 사용하여 원본 mutate 방지 (일관성)
        // [P2-REFACTOR-3 수정] calculateMonthlyRange 사용으로 날짜 계산 통일
        const baseKSTForBilling = getBaseKST();
        const monthlyRange = calculateMonthlyRange(baseKSTForBilling);

        // 이번 달 청구서 조회
        // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
        const invoices = await fetchBillingHistory(tenantId, {
          period_start: { gte: monthlyRange.current.dateString.from, lte: monthlyRange.current.dateString.to },
        });

        // [P0-2 수정] Fail-Closed: 배열 타입 가드 추가 (invoices가 배열이 아니면 크래시 방지)
        const safeInvoices = Array.isArray(invoices) ? invoices : [];
        if (safeInvoices.length === 0) {
          return null;
        }
        const totalAmount = safeInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
        const paidAmount = safeInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);
        const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
        const unpaidCount = safeInvoices.filter((inv: BillingHistoryItem) => inv.status === 'pending' || inv.status === 'overdue').length;

        // [SSOT] 입력 정규화 레이어 사용
        return normalizeBillingSummaryCard({
          id: 'billing-summary',
          type: 'billing_summary',
          title: `이번 달 ${terms.BILLING_LABEL} 현황`,
          expected_collection_rate: expectedCollectionRate,
          unpaid_count: unpaidCount,
          action_url: ROUTES.BILLING_HOME,
          priority: 50, // 기본 우선순위 (월말 가중치 적용 전)
        });
      } catch (error) {
        // [P0-2 수정] Fail Closed: 에러 발생 시 null 반환 (다른 queryFn과 일관성 유지)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Billing:Summary', error);
        return null;
      }
    },
    enabled: !!tenantId,
    refetchInterval: CACHE_TIMES.BILLING_REFETCH,
    staleTime: CACHE_TIMES.BILLING_STALE,
    gcTime: CACHE_TIMES.BILLING_GC,
  });

  // 정본 규칙: AI Briefing 쿼리 내부에서 task_cards 직접 조회 제거
  // studentTaskCards에서 risk 카드를 파생하여 AI Briefing 카드에 합성
  // [P0-2 수정] created_at을 useRef로 고정하여 1분마다 갱신되는 nowKST로 인한 정렬 흔들림 방지
  const riskBriefingCreatedAtRef = useRef<string>(toKST().toISOString());
  // [P2-QUALITY-1] 빈 카드 created_at 고정: useRef 패턴 사용
  const emptyCardTimestampRef = useRef<string>(toKST().toISOString());
  const enhancedAiBriefingCards = useMemo(() => {
    if (!aiBriefingCards || !studentTaskCards) return aiBriefingCards || [];

    // [P0-2 수정] Fail-Closed: 배열 타입 가드 추가 (studentTaskCards가 배열이 아니면 크래시 방지)
    const safeStudentTaskCards = Array.isArray(studentTaskCards) ? studentTaskCards : [];
    // [P0-2 수정] 타입 안전성: 각 카드가 객체이고 필요한 속성을 가진지 확인
    const riskCards = safeStudentTaskCards.filter((card) =>
      card &&
      typeof card === 'object' &&
      'task_type' in card &&
      card.task_type === 'risk' &&
      'action_url' in card &&
      card.action_url
    );
    const riskCount = riskCards.length;

    if (riskCount > 0) {
      // 첫 번째 risk 카드의 action_url 사용 (서버에서 제공된 값)
      const firstRiskCard = riskCards[0];
      const riskActionUrl = firstRiskCard?.action_url;

      if (riskActionUrl) {
        // 이탈 위험 학생 알림 카드를 추가
        // [P0-2 수정] created_at을 파생 근거인 firstRiskCard의 created_at으로 고정 (없으면 useRef 고정값 사용)
        // 파생 카드의 created_at이 "현재 시각"이면 정렬 기준으로 쓰는 순간 UI가 흔들림
        const riskCardCreatedAt = (firstRiskCard as { created_at?: string })?.created_at ?? riskBriefingCreatedAtRef.current;
        // [SSOT] 입력 정규화 레이어 사용
        const riskBriefingCard = normalizeAIBriefingCard({
          id: 'briefing-risk',
          type: 'ai_briefing',
          title: `${terms.EMERGENCY_RISK_LABEL} ${terms.PERSON_LABEL_PLURAL} 알림`,
          summary: `${riskCount}명의 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} ${terms.EMERGENCY_RISK_LABEL}입니다.`,
          insights: [
            `${terms.EMERGENCY_RISK_LABEL} ${terms.PERSON_LABEL_PLURAL}에게 즉시 ${terms.CONSULTATION_LABEL}${p.을를(terms.CONSULTATION_LABEL)} 진행하세요.`,
            `${terms.PERSON_LABEL_PRIMARY}의 진행 동기를 높이기 위한 방안을 모색하세요.`,
          ],
          created_at: riskCardCreatedAt, // [P0-2 수정] 원천 데이터 기준으로 고정
          action_url: riskActionUrl, // 정본: 서버에서 제공된 action_url 사용
        });

        return [...aiBriefingCards, riskBriefingCard];
      }
    }

    return aiBriefingCards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiBriefingCards, studentTaskCards]);

  // 카드 우선순위 정렬 (아키텍처 문서 3.7.1 섹션 참조)
  // 모든 카드 출력 (제한 없음, 그룹별로 분류하여 표시)
  const sortedCards = useMemo(() => {
    const cards: DashboardCard[] = [];


    // 1. Emergency Cards (최우선, 항상 최상단)
    // 정본 규칙: enhancedEmergencyCards 사용
    // [P0-1 수정] Emergency 그룹 내부는 priority 오름차순 정렬 (작을수록 더 긴급)
    // [P0-배열-1 수정] Fail-Closed: 배열 타입 가드 추가 (enhancedEmergencyCards가 배열이 아니면 크래시 방지)
    // [P2-TYPE-1 수정] asObjectArray가 이미 Array.isArray 체크를 수행하므로 중복 제거
    if (enhancedEmergencyCards) {
      // [P0-DATA-1 수정] Fail-Closed: null/비객체/배열/id 없는 요소 제거
      const safeEmergency = asObjectArray<Partial<DashboardCard> & { id: string }>(enhancedEmergencyCards);
      // [SSOT] 입력 정규화 레이어 사용
      const normalizedEmergency = normalizeDashboardCards(safeEmergency);
      if (normalizedEmergency.length > 0) {
        // Emergency 카드는 priority 기준 오름차순 정렬 (SSOT: 작을수록 더 긴급)
        // 정규화 후에는 priority가 항상 number이므로 타입 단언 불필요 (타입 가드만 사용)
        const sortedEmergency = [...normalizedEmergency].sort((a, b) => {
          const priorityA = ('priority' in a && typeof a.priority === 'number') ? a.priority : 999;
          const priorityB = ('priority' in b && typeof b.priority === 'number') ? b.priority : 999;
          return priorityA - priorityB; // 오름차순 (1 < 3 < 5)
        });
        cards.push(...sortedEmergency);
      }
    } else {
      // 빈 Emergency 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      // [SSOT] 입력 정규화 레이어 사용
      // [P2-업종중립] 업종별 용어 적용
      cards.push(normalizeEmergencyCard({
        id: `${EMPTY_CARD_ID_PREFIX}-emergency`,
        type: 'emergency',
        title: EMPTY_CARD_MESSAGES.EMERGENCY.TITLE,
        message: EMPTY_CARD_MESSAGES.EMERGENCY.MESSAGE.replace('{ENTITY}', '기관'),
        priority: 0,
      }));
    }

    // 2. AI Briefing Cards (생성 시간 기준 내림차순 정렬)
    // 정본 규칙: enhancedAiBriefingCards 사용
    // 성능 최적화: 문자열 비교로 최적화 (ISO 8601 형식은 문자열 비교 가능)
    // [SSOT] 입력 정규화 레이어 사용
    // [P0-배열-1 수정] Fail-Closed: 배열 타입 가드 추가 (enhancedAiBriefingCards가 배열이 아니면 크래시 방지)
    if (enhancedAiBriefingCards && Array.isArray(enhancedAiBriefingCards) && enhancedAiBriefingCards.length > 0) {
      // [P0-DATA-1 수정] Fail-Closed: null/비객체/배열/id 없는 요소 제거
      const safeBriefing = asObjectArray<Partial<DashboardCard> & { id: string }>(enhancedAiBriefingCards);
      // 정규화 후 정렬 (created_at, priority 등이 정규화됨)
      const normalizedBriefing = normalizeDashboardCards(safeBriefing);
      const sortedBriefing = [...normalizedBriefing].sort((a, b) => {
        // ISO 8601 형식은 문자열 비교로 정렬 가능 (최신 우선)
        // 정규화 후에는 created_at이 항상 string이므로 타입 가드 불필요
        const aTime = 'created_at' in a ? a.created_at : '';
        const bTime = 'created_at' in b ? b.created_at : '';
        return String(bTime).localeCompare(String(aTime));
      });
      cards.push(...sortedBriefing);
    } else {
      // 빈 AI Briefing 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      // [P2-3 수정] 빈 카드 created_at은 useMemo 실행 시점의 시간 사용 (nowKST 의존성 제거)
      // [P2-QUALITY-1] 빈 카드 created_at 고정: useRef 패턴 사용
      // [SSOT] 입력 정규화 레이어 사용
      // [P2-업종중립] 업종별 용어 적용
      cards.push(normalizeAIBriefingCard({
        id: `${EMPTY_CARD_ID_PREFIX}-ai-briefing`,
        type: 'ai_briefing',
        title: EMPTY_CARD_MESSAGES.AI_BRIEFING.TITLE,
        summary: EMPTY_CARD_MESSAGES.AI_BRIEFING.SUMMARY.replace('{PERSON_LABEL}', terms.PERSON_LABEL_PRIMARY),
        insights: [],
        created_at: emptyCardTimestampRef.current,
      }));
    }

    // 3. Student Task Cards (priority 값 기준 내림차순 정렬)
    // [P0-DATA-1 수정] Fail-Closed: null/비객체/배열/id 없는 요소 제거 후 정규화
    const safeTasks = asObjectArray<Partial<DashboardCard> & { id: string }>(studentTaskCards);
    if (safeTasks.length > 0) {
      // 정규화 후 정렬 (priority가 정규화됨)
      // 타입 단언 불필요: asObjectArray가 id: string을 런타임 보장
      const normalizedTasks = normalizeDashboardCards(safeTasks);
      const sortedTasks = normalizedTasks.slice().sort((a, b) => {
        // priority가 높을수록(큰 수) 우선순위가 높음
        // 정규화 후에는 priority가 항상 number이므로 타입 단언 불필요 (타입 가드만 사용)
        const priorityA = ('priority' in a && typeof a.priority === 'number') ? a.priority : 0;
        const priorityB = ('priority' in b && typeof b.priority === 'number') ? b.priority : 0;
        return priorityB - priorityA;
      });
      cards.push(...sortedTasks);
    } else {
      // 빈 Student Task 카드 생성 (1개만)
      // [P1-1 수정] placeholder 전용 빌더 함수 사용하여 타입 안정성 확보
      cards.push(createEmptyTaskCard());
    }

    // 4. Today Classes (수업 시작 시간 기준 오름차순 정렬)
    // 성능 최적화: 시간 문자열 직접 비교 (HH:MM 형식은 문자열 비교 가능)
      // [P2-1 수정] 기본값 상수는 constants 파일에서 import
    if (todayClasses && todayClasses.length > 0) {
      const sortedClasses = [...todayClasses].sort((a, b) => {
        // start_time이 HH:MM 형식이면 문자열 비교로 정렬 가능
          const timeA = a.start_time || DEFAULT_CLASS_START_TIME;
          const timeB = b.start_time || DEFAULT_CLASS_START_TIME;
        return timeA.localeCompare(timeB); // 빠른 시간 우선
      });
      cards.push(...sortedClasses);
    } else {
      // 빈 Class 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      // [SSOT] 입력 정규화 레이어 사용
      // [P2-업종중립] 업종별 용어 적용
      cards.push(normalizeClassCard({
        id: `${EMPTY_CARD_ID_PREFIX}-class`,
        type: 'class',
        class_name: `오늘 ${terms.GROUP_LABEL} 없음`,
        start_time: EMPTY_CARD_MESSAGES.CLASS.START_TIME,
        student_count: 0,
        attendance_count: 0,
        action_url: '',
      }));
    }

    // 5. Stats Cards (모든 카드 포함)
    if (statsCards && statsCards.length > 0) {
      cards.push(...statsCards);
    } else {
      // 빈 Stats 카드 생성 (최대 1개)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      // [SSOT] 입력 정규화 레이어 사용
      cards.push(normalizeStatsCard({
        id: `${EMPTY_CARD_ID_PREFIX}-stats`,
        type: 'stats',
        title: EMPTY_CARD_MESSAGES.STATS.TITLE,
        value: EMPTY_CARD_MESSAGES.STATS.VALUE,
      }));
    }

    // 6. Billing Summary (최대 2개, Billing 그룹에 포함)
    // 아키텍처 문서 4647줄 참조: BILLING 그룹 최대 2개
    // 정본 규칙: 그룹 순서는 불변 (EMERGENCY > AI_BRIEFING > TASKS > CLASSES > STATS > BILLING), 월말에는 priority만 +2 (내부 정렬만 변동)
    // 프론트 자동화 문서 1.2.2 섹션 참조: 월말 priority 가중치 조정
    if (billingSummary) {
      // 월말에는 priority 가중치만 조정 (그룹 순서 불변)
      // [SSOT] 입력 정규화 레이어 사용: 수정된 객체도 정규화 함수를 거쳐야 함
      cards.push(normalizeBillingSummaryCard({
        ...billingSummary,
        priority: (billingSummary.priority || 50) + (shouldPrioritizeBilling ? 2 : 0), // 정본: 0-100 스케일, 월말 +2 (프론트 자동화 문서 367줄, 559줄 참조)
      }));
      // BILLING 그룹에 추가 카드가 있을 수 있으므로, 최대 2개까지 허용
      // 현재는 billingSummary만 있지만, 향후 다른 Billing 카드가 추가될 수 있음
    } else {
      // 빈 Billing Summary 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      // [SSOT] 입력 정규화 레이어 사용
      // [P2-업종중립] 업종별 용어 적용
      cards.push(normalizeBillingSummaryCard({
        id: `${EMPTY_CARD_ID_PREFIX}-billing`,
        type: 'billing_summary',
        title: `${terms.BILLING_LABEL} 데이터 없음`,
        expected_collection_rate: EMPTY_CARD_MESSAGES.BILLING_SUMMARY.EXPECTED_COLLECTION_RATE,
        unpaid_count: EMPTY_CARD_MESSAGES.BILLING_SUMMARY.UNPAID_COUNT,
        action_url: ROUTES.BILLING_HOME,
        priority: 0,
      }));
    }

    // 정본 규칙: 그룹 내부 priority 가중치 적용 (월말 등)
    // Billing 카드의 priority가 조정되었으므로, Billing 그룹 내부 정렬만 변동
    // 전체 그룹 순서는 불변: EMERGENCY > AI_BRIEFING > TASKS > CLASSES > STATS > BILLING

    // 모든 카드 반환 (제한 없음)
    return cards;
    // [P2-2 수정] nowKST 의존성 제거: 빈 카드 생성 시 toKST() 직접 호출로 변경
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enhancedEmergencyCards, enhancedAiBriefingCards, studentTaskCards, todayClasses, statsCards, billingSummary, shouldPrioritizeBilling]);

  // [P0-1 수정] groupedCards를 return 위로 이동하여 React Hooks 규칙 준수
  // useMemo는 컴포넌트 최상위에서만 호출되어야 함 (JSX 내부 호출 금지)
  const groupedCards = useMemo(() => {
          // 카드를 타입별로 그룹핑 (우선순위 순서 유지)
          const emergencyCards = sortedCards.filter((card): card is EmergencyCard => 'type' in card && card.type === 'emergency');
          const aiBriefingCards = sortedCards.filter((card): card is AIBriefingCard => 'type' in card && card.type === 'ai_briefing');
          // 브리핑 섹션: 긴급 알림 + AI 브리핑 카드 통합
          const briefingCards = [...emergencyCards, ...aiBriefingCards];
          // [P0-DATA-2 수정] Fail-Closed: 비객체 요소 제거 후 task_type 체크
          const taskCardsInView = sortedCards.filter((card) => card && typeof card === 'object' && 'task_type' in card);
          const classCards = sortedCards.filter((card): card is ClassCard => 'type' in card && card.type === 'class');
          const allStatsCards = sortedCards.filter((card): card is StatsCard => 'type' in card && card.type === 'stats');
          const billingCards = sortedCards.filter((card): card is BillingSummaryCard => 'type' in card && card.type === 'billing_summary');

          // 통계 카드를 카테고리별로 분류
          // [P0-1 수정] 각 세부 그룹별로 빈 카드 placeholder 생성하여 그룹이 사라지지 않도록 보장
          // [P0-1 수정] 제네릭 화살표 함수는 TSX 파싱 이슈 가능하므로 함수 선언으로 변경
          function ensureNonEmpty<T>(items: T[], fallback: T): T[] {
            return items.length > 0 ? items : [fallback];
          }

    // [SSOT] 입력 정규화 레이어 사용
          const attendanceStatsCards = ensureNonEmpty(
            allStatsCards.filter((card) =>
              card.id === 'stats-attendance-rate' ||
              card.id === 'stats-late-rate' ||
              card.id === 'stats-absent-rate' ||
              card.id === 'stats-weekly-attendance' ||
              card.id === 'stats-monthly-attendance-rate' ||
              card.id === 'stats-attendance-improvement-rate'
            ),
      normalizeStatsCard({
              id: `${EMPTY_CARD_ID_PREFIX}-attendance-stats`,
              type: 'stats',
              title: terms.CARD_GROUP_LABELS.attendance_stats,
              value: '-',
      })
          );
    // [SSOT] 입력 정규화 레이어 사용
          const studentGrowthStatsCards = ensureNonEmpty(
            allStatsCards.filter((card) =>
              card.id === 'stats-students' ||
              card.id === 'stats-new-students' ||
              card.id === 'stats-weekly-new-students' ||
              card.id === 'stats-active-students' ||
              card.id === 'stats-inactive-students' ||
              card.id === 'stats-student-growth' ||
              card.id === 'stats-student-retention-rate' ||
              card.id === 'stats-avg-students-per-class' ||
              card.id === 'stats-avg-capacity-rate'
            ),
      normalizeStatsCard({
              id: `${EMPTY_CARD_ID_PREFIX}-student-growth-stats`,
              type: 'stats',
              title: terms.CARD_GROUP_LABELS.student_growth_stats,
              value: '-',
      })
          );
    // [SSOT] 입력 정규화 레이어 사용
          const revenueStatsCards = ensureNonEmpty(
            allStatsCards.filter((card) =>
              card.id === 'stats-revenue' ||
              card.id === 'stats-expected-revenue' ||
              card.id === 'stats-arpu' ||
              card.id === 'stats-revenue-growth' ||
              card.id === 'stats-weekly-revenue' ||
              card.id === 'stats-avg-invoice-amount'
            ),
      normalizeStatsCard({
              id: `${EMPTY_CARD_ID_PREFIX}-revenue-stats`,
              type: 'stats',
              title: terms.CARD_GROUP_LABELS.revenue_stats,
              value: '-',
      })
          );
    // [P1-5 수정] collection_stats 그룹 타입 혼합 문제 해결: DashboardCard[]로 통일하여 타입 안정성 확보
    // BillingSummaryCard와 StatsCard를 섞는 대신, 모두 DashboardCard[]로 처리하여 renderCard가 안전하게 처리
    // [SSOT] 입력 정규화 레이어 사용
          const collectionStatsCards = ensureNonEmpty(
      normalizeDashboardCards([
              ...billingCards, // 수납 현황 카드를 먼저 배치
              ...allStatsCards.filter((card) =>
                card.id === 'stats-unpaid-rate' ||
                card.id === 'stats-avg-collection-period'
              ),
      ]),
      normalizeStatsCard({
              id: `${EMPTY_CARD_ID_PREFIX}-collection-stats`,
              type: 'stats',
              title: terms.CARD_GROUP_LABELS.collection_stats,
              value: '-',
      })
          );

    return [
            {
              type: 'briefing',
              label: terms.CARD_GROUP_LABELS.briefing,
              cards: briefingCards,
            },
            {
              type: 'student_task',
              label: terms.CARD_GROUP_LABELS.student_task,
              cards: taskCardsInView,
            },
            {
              type: 'class',
              label: terms.CARD_GROUP_LABELS.class,
              cards: classCards,
            },
            {
              type: 'attendance_stats',
              label: terms.CARD_GROUP_LABELS.attendance_stats,
              cards: attendanceStatsCards,
            },
            {
              type: 'student_growth_stats',
              label: terms.CARD_GROUP_LABELS.student_growth_stats,
              cards: studentGrowthStatsCards,
            },
            {
              type: 'revenue_stats',
              label: terms.CARD_GROUP_LABELS.revenue_stats,
              cards: revenueStatsCards,
            },
            {
              type: 'collection_stats',
              label: terms.CARD_GROUP_LABELS.collection_stats,
              cards: collectionStatsCards,
            },
          ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedCards]);

          return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="홈 대시보드"
        />

        {/* 대시보드 안내 문구 */}
        <div style={{
          marginBottom: 'var(--spacing-xl)',
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-gray-50)',
          borderRadius: 'var(--border-radius-md)',
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-secondary)',
          lineHeight: 'var(--line-height-relaxed)',
        }}>
          <p style={{ margin: 0 }}>
            이 대시보드에서는 <strong style={{ color: 'var(--color-text)' }}>긴급 알림, AI 브리핑, {terms.PERSON_LABEL_PRIMARY} 업무, {terms.ATTENDANCE_LABEL} 통계, 매출 현황</strong> 등 운영에 필요한 핵심 정보를 한눈에 확인할 수 있습니다.
            긴급 알림을 통해 즉시 대응이 필요한 사항을 파악하고, AI 브리핑으로 {terms.PERSON_LABEL_PLURAL}의 상태와 트렌드를 분석하며,
            실시간 통계를 통해 {terms.ATTENDANCE_LABEL}률과 매출을 모니터링하여 더욱 효율적으로 운영하세요.
          </p>
        </div>

        {/* Context Recommendation Banner (프론트 자동화 문서 1.3.1 섹션 참조) */}
        {adaptiveNav.currentRecommendation && (
          <ContextRecommendationBanner
            recommendation={adaptiveNav.currentRecommendation}
            onNavigate={() => {
              // 정본 규칙: 사용자 클릭 시에만 이동 (자동 이동 없음)
              // [P0-NAV-1 수정] Fail Closed: 외부/우회 경로 차단
              const target = adaptiveNav.currentRecommendation?.action.target ?? '';
              if (!isSafeInternalTarget(target)) return;
              safeNavigate(target);
            }}
            onDismiss={adaptiveNav.dismissRecommendation}
          />
        )}

        {/* 카드 그리드 (항목별 그룹핑, briefing 2열, 그 외 3열) */}
        {/* [P0-1 수정] groupedCards는 return 위에서 useMemo로 계산됨 (React Hooks 규칙 준수) */}
              {groupedCards.map((group) => {
                // 카드가 없으면 그룹 표시 안 함
                if (group.cards.length === 0) return null;

                return (
                  <div key={group.type} style={{ marginBottom: 'var(--spacing-2xl)' }}>
                    {/* 그룹 헤더 */}
                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                      <h2
                        style={{
                          fontSize: 'var(--font-size-xl)',
                          fontWeight: 'var(--font-weight-semibold)',
                          color: 'var(--color-text)',
                          marginBottom: 'var(--spacing-xs)',
                        }}
                      >
                        {group.label}
                      </h2>
                    </div>

                    {/* 카드 그리드 */}
                    <CardGridLayout
                      cards={group.cards.map((card) => renderCard(card, safeNavigate, {
                  // [P2-6 수정] 변수명 섀도잉 방지: card → clickedCard
                  onChartClick: (clickedCard) => {
                    if ('type' in clickedCard && clickedCard.type === 'stats' && 'chartDataKey' in clickedCard && clickedCard.chartDataKey) {
                      setChartModalOpen({ cardId: clickedCard.id });
                          }
                        },
                      }))}
                      desktopColumns={group.type === 'briefing' ? 2 : 3}
                      tabletColumns={2}
                      mobileColumns={1}
                    />
                  </div>
                );
              })}

        {/* 그래프 모달 */}
        {chartModalOpen.cardId && (() => {
          const selectedCard = sortedCards.find((card): card is StatsCard => card.id === chartModalOpen.cardId && 'type' in card && card.type === 'stats');
          return (
            <StatsChartModal
              isOpen={!!selectedCard}
              onClose={() => setChartModalOpen({ cardId: null })}
              card={selectedCard || null}
              data={dailyStoreMetrics || []}
            />
          );
        })()}
      </Container>
    </ErrorBoundary>
  );
}
