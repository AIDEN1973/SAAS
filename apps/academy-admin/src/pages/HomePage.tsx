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

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, PageHeader, ContextRecommendationBanner } from '@ui-core/react';
import { useStudentTaskCards, fetchConsultations, fetchPersons, fetchStudentStats, fetchAttendanceStats, fetchStudentAlerts } from '@hooks/use-student';
import type { DashboardCard, EmergencyCard, AIBriefingCard, ClassCard, StatsCard, BillingSummaryCard } from '../types/dashboardCard';
import { useAdaptiveNavigation } from '@hooks/use-adaptive-navigation';
import { useMonthEndAdaptation } from '@hooks/use-month-end-adaptation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useClasses, fetchClasses } from '@hooks/use-class';
import { useAttendanceLogs, fetchAttendanceLogs } from '@hooks/use-attendance';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchAIInsights } from '@hooks/use-ai-insights';
import { fetchPayments } from '@hooks/use-payments';
import type { DayOfWeek } from '@services/class-service';
import { toKST } from '@lib/date-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { AttendanceLog } from '@services/attendance-service';
import { CardGridLayout } from '../components/CardGridLayout';
import { useDailyStoreMetrics } from '@hooks/use-daily-store-metrics';
import { StatsChartModal } from '../components/dashboard-cards/StatsChartModal';
import { useTenantSettingByPath } from '@hooks/use-config';
import { createQueryKey } from '@hooks/use-query-key-utils';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES, EMPTY_CARD_MESSAGES, EMPTY_CARD_ID_PREFIX, DEFAULT_CLASS_START_TIME } from '../constants';
import { renderCard, createEmptyTaskCard, isInvoicePaid, getPolicyValue, getPolicyValueWithPath, normalizeAIBriefingCard, normalizeDashboardCards, normalizeEmergencyCard, normalizeClassCard, normalizeStatsCard, normalizeBillingSummaryCard, safe, POLICY_REGISTRY, createSafeNavigate, calculateTrend, calculateTrendPercentPoint, logError } from '../utils';

/**
 * 캐시 및 갱신 시간 상수
 * [P1-3 수정] 매직 넘버를 명명된 상수로 변경
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
  NOW_KST_UPDATE: 60 * 1000, // 1분
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
 * @param num 변환할 숫자
 * @returns 천 단위 구분자가 포함된 문자열
 */
const koreanNumberFormatter = new Intl.NumberFormat('ko-KR');
const formatNumberWithCommas = (num: number): string => {
  return koreanNumberFormatter.format(num);
};

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
          <PageHeader title="홈 대시보드" />
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
      const raw = configRecord.value;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as Record<string, unknown>;
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

  // 최근 30일 데이터 조회
  // [P1-1 수정] nowKST를 state+interval로 변경하여 useMemo 최적화: 매 렌더마다 재계산 방지
  // [P1-3 수정] 갱신 주기를 명명된 상수로 변경
  // 1분 단위로 갱신하여 자정 포함 "시간 경과"도 자연스럽게 반영
  const [nowKST, setNowKST] = useState(() => toKST());
  useEffect(() => {
    const id = setInterval(() => setNowKST(toKST()), CACHE_TIMES.NOW_KST_UPDATE);
    return () => clearInterval(id);
  }, []);
  const thirtyDaysAgo = nowKST.clone().subtract(DASHBOARD_PERIODS.DAILY_METRICS_DAYS, 'day').format('YYYY-MM-DD');
  const today = nowKST.format('YYYY-MM-DD');

  // [P1-1 수정] 파라미터 객체를 useMemo로 고정하여 queryKey 불안정 방지
  // nowKST가 1분마다 갱신되어도 파라미터 객체 레퍼런스가 안정적이면 불필요한 refetch 방지
  const dailyMetricsRange = useMemo(() => ({
    date_kst: { gte: thirtyDaysAgo, lte: today },
  }), [thirtyDaysAgo, today]);

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
      const baseKST = toKST();

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
              title: '결제 실패 알림',
                message: `최근 ${lookbackDays}일간 결제 실패가 ${failedCount}건 발생했습니다.`,
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
            title: '이탈 위험 학생',
            message: `${studentAlerts.risk_count}명의 학생이 이탈 위험 단계입니다.`,
            priority: 4,
            action_url: ROUTES.STUDENTS_RISK,
          }));
        }
        if (studentAlerts.absent_count > 0) {
          // [SSOT] 입력 정규화 레이어 사용
          cards.push(normalizeEmergencyCard({
            id: 'emergency-absent-students',
            type: 'emergency',
            title: '결석 학생 알림',
            message: `${studentAlerts.absent_count}명의 학생이 결석 상태입니다.`,
            priority: 5,
            action_url: ROUTES.STUDENTS_ABSENT,
          }));
        }
        if (studentAlerts.consultation_pending_count > 0) {
          // [SSOT] 입력 정규화 레이어 사용
          cards.push(normalizeEmergencyCard({
            id: 'emergency-consultation-pending',
            type: 'emergency',
            title: '상담 대기 학생',
            message: `${studentAlerts.consultation_pending_count}명의 학생이 상담 대기 중입니다.`,
            priority: 6,
            action_url: ROUTES.STUDENTS_CONSULTATION,
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
        message: '높은 위험 점수를 가진 학생이 감지되었습니다.',
        priority: 3,
        action_url: highRiskCard.action_url, // 정본: 서버에서 제공된 action_url 사용
      });

      // priority 정렬은 sortedCards에서 처리하므로 여기서는 단순 추가
      return [...emergencyCards, aiRiskEmergency];
    }

    return emergencyCards;
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
      const baseKST = toKST();

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
            title: '오늘의 상담 일정',
            summary: `오늘 ${safeTodayConsultations.length}건의 상담이 예정되어 있습니다.`,
            insights: [
              '상담일지를 작성하여 학생 관리를 강화하세요.',
              '상담 내용을 바탕으로 학생의 학습 방향을 조정할 수 있습니다.',
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
          const currentMonth = baseKST.format('YYYY-MM');
          const nextMonthStartDateForCollection = baseKST.clone().add(1, 'month').startOf('month');
          const currentMonthEndDateForCollection = nextMonthStartDateForCollection.clone().subtract(1, 'day').endOf('day');
          const invoices = await fetchBillingHistory(tenantId, {
            period_start: { gte: `${currentMonth}-01`, lte: currentMonthEndDateForCollection.format('YYYY-MM-DD') },
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
                title: '이번 달 수납 현황',
                summary: `이번 달 청구서가 자동 발송되었습니다. 예상 수납률은 ${expectedCollectionRate}%입니다.`,
                insights: [
                  expectedCollectionRate >= collectionRateThreshold
                    ? '수납률이 양호합니다. 현재 운영 방식을 유지하세요.'
                    : '수납률 개선이 필요합니다. 미납 학생에게 연락을 취하세요.',
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
                title: '출결 이상 패턴 감지',
                summary: `최근 7일간 결석 ${absentCount}건, 지각 ${lateCount}건이 발생했습니다.`,
                insights: [
                  '출결 패턴을 분석하여 원인을 파악하세요.',
                  '지각이 많은 학생들에게 사전 안내를 제공하세요.',
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

  // 오늘 수업 반 목록 조회
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
      // 오늘 날짜의 출석 데이터에서 해당 반의 출석 수 계산
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

  // Stats Cards 조회 (학생 수, 출석률, 매출 등)
  // [P2-QUALITY-1 수정] createQueryKey SSOT 유틸리티 사용
  const { data: statsCards } = useQuery({
    queryKey: createQueryKey('stats-cards', tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: StatsCard[] = [];

      // [SSOT] safe 함수는 utils에서 import하여 사용

      // 성능 최적화: config를 한 번만 조회하고 재사용
      const config = await loadConfigOnce();

      // [P0-1 수정] Fail Closed: 정책이 없으면 정책 기반 로직은 실행하지 않음
      // Stats 카드는 정책 기반 임계값이 많이 사용되므로, config가 null이면 빈 배열 반환
      if (!config) return cards;

      // [P1-1 수정] queryFn 시작에서 baseKST 한 번만 생성하여 자정 경계 불일치 방지
      // [P0-1 수정] 주간 범위 계산 타입 통일: timestamp 필터는 ISO, date string 필터는 YYYY-MM-DD
      // [P0-2 수정] 주간 비교 날짜 범위 겹침 방지: 전주 upper bound를 이번주 시작 직전으로 정확히 설정
      const baseKST = toKST();
      const currentMonthBase = baseKST;
      const currentMonthStr = currentMonthBase.format('YYYY-MM');
      const lastMonthBase = currentMonthBase.clone().subtract(1, 'month');
      const lastMonthStr = lastMonthBase.format('YYYY-MM');
      // 성능 최적화: 날짜 계산을 한 번만 수행하여 재사용 (clone()으로 안전하게)
      // [P0-1 수정] created_at 필터는 timestamp이므로 ISO로 통일
      const lastMonthEnd = lastMonthBase.clone().endOf('month').toISOString();
      const lastMonthStart = lastMonthBase.clone().startOf('month').toISOString();
      // date string 필터용 (필요시) - 현재 사용하지 않으므로 주석 처리
      // const lastMonthStartDateStr = lastMonthBase.clone().startOf('month').format('YYYY-MM-DD');
      const currentMonthEnd = currentMonthBase.clone().endOf('month').toISOString();
      const currentMonthEndDate = new Date(currentMonthEnd);

      // [P0-1 수정] KST 기준 rolling 7일/14일 경계 (timestamp 필터용 - ISO 통일)
      // [P2-6 수정] "주간(week boundary)"가 아닌 "rolling 7 days"이므로 변수명 변경
      const rolling7Start = baseKST.clone().subtract(7, 'days').startOf('day'); // rolling 7일 시작(7일 전 00:00)
      const rolling14Start = baseKST.clone().subtract(14, 'days').startOf('day'); // rolling 14일 시작(14일 전 00:00)
      const rolling7End = rolling7Start.clone().subtract(1, 'millisecond'); // rolling 7일 이전 범위 끝(rolling 7일 시작 직전)
      const rolling7StartISO = rolling7Start.toISOString();
      const rolling14StartISO = rolling14Start.toISOString();
      const rolling7EndISO = rolling7End.toISOString();

      // [P0-1 수정] date string 필터용 (fetchAttendanceLogs 등)
      // [P2-6 수정] 변수명 변경
      const sevenDaysAgoStr = rolling7Start.format('YYYY-MM-DD');
      const fourteenDaysAgoStr = rolling14Start.format('YYYY-MM-DD');
      const beforeSevenDaysAgoStr = rolling7Start.clone().subtract(1, 'day').format('YYYY-MM-DD'); // rolling 7일 이전 범위 upper bound (date string용)

      // 성능 최적화: studentStats를 외부 변수로 저장하여 재사용
      let studentStatsCache: Awaited<ReturnType<typeof fetchStudentStats>> | null = null;

      // [P2-QUALITY-1 수정] 트렌드 계산 함수는 공통 유틸에서 import하여 사용
      // calculateTrend, calculateTrendPercentPoint는 utils에서 import

      // 1. 학생 수 통계
      // 정본 규칙: fetchPersons 함수 사용 (Hook의 queryFn 로직 재사용)
      // 성능 최적화: 병렬 호출
      // [P1-ARCH-4 수정] 확장 시 성능 위험: 전체 배열 조회로 인한 비용 폭발 가능성
      // - 현재는 전체 배열을 받아서 length를 계산하지만, 테넌트당 학생 수가 커지면 네트워크/메모리 비용 급증
      // - 동일 패턴이 여러 곳에 반복될 가능성 (라인 877-884, 1042-1050 등)
      // TODO[PERF]: 성능 개선 - fetchPersonsCount 같은 count 전용 쿼리를 hook/service에 추가하여 서버에서 count만 가져오도록 변경
      // TODO[PERF]: 유사 패턴 전역 점검 및 개선 (fetchPersons로 전체 배열 조회 후 length만 사용하는 모든 위치)
      // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값([])으로 유지
      const [students, lastMonthStudents] = await Promise.all([
        safe(fetchPersons(tenantId, {
          person_type: 'student',
        }), []),
        safe(fetchPersons(tenantId, {
          person_type: 'student',
          created_at: { lte: lastMonthEnd },
        }), []),
      ]);
      const studentCount = students?.length || 0;
      const lastMonthStudentCount = lastMonthStudents?.length || 0;
      const studentTrend = calculateTrend(studentCount, lastMonthStudentCount);

      // [SSOT] 입력 정규화 레이어 사용
      cards.push(normalizeStatsCard({
        id: 'stats-students',
        type: 'stats',
        title: '전체 학생 수',
        value: studentCount.toString(),
        unit: '명',
        trend: studentTrend,
        action_url: ROUTES.STUDENTS_LIST,
        chartDataKey: 'student_count',
      }));

      // 2. 학생 통계 (신규 등록, 활성/비활성)
      // 정본 규칙: fetchStudentStats 함수 사용 (Hook의 queryFn 로직 재사용)
      // 성능 최적화: 병렬 호출 및 중복 제거
      try {
        // [P1-6 수정] 변수명 수정: lastMonthActiveStudents는 실제로는 현재 active 학생 수
        // 전월 활성 학생 수는 별도 조회가 필요하므로, 현재는 현재 active 학생 수를 사용
        // [P1-1 수정] 불필요한 API 호출 제거: fetchStudents(active/withdrawn)는 결과를 사용하지 않으므로 제거
        // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값으로 유지
        const [studentStats, lastMonthNewStudents] = await Promise.all([
          safe(fetchStudentStats(tenantId), { total: 0, active: 0, inactive: 0, new_this_month: 0, by_status: {} }),
          safe(fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: lastMonthStart, lte: lastMonthEnd },
          }), []),
        ]);
        // 성능 최적화: studentStats를 캐시에 저장하여 3-2 섹션에서 재사용
        studentStatsCache = studentStats;
        const lastMonthNewCount = lastMonthNewStudents?.length || 0;
        const newStudentsTrend = calculateTrend(studentStats.new_this_month, lastMonthNewCount);

        // [P1-6 수정] 현재 active 학생 수를 사용 (전월 활성 학생 수는 별도 조회 필요)
        // [P1-1 수정] 트렌드 제거: studentStats.active와 currentActiveCount는 둘 다 "현재 활성"이므로
        // 전월 스냅샷/이력 테이블 없으면 trend: undefined로 내려서 UI에서 트렌드 배지를 숨김 (오해 방지)
        // TODO[DATA]: 정확한 전월 활성 학생 수를 계산하려면 전월 시점의 스냅샷/이력이 필요

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-new-students',
          type: 'stats',
          title: '이번 달 신규 등록',
          value: studentStats.new_this_month.toString(),
          unit: '명',
          trend: newStudentsTrend,
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'new_enrollments',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-active-students',
          type: 'stats',
          title: '활성 학생 수',
          value: studentStats.active.toString(),
          unit: '명',
          trend: undefined, // [P1-1 수정] 전월 스냅샷 없으면 트렌드 제거 (오해 방지)
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'active_student_count',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-inactive-students',
          type: 'stats',
          title: '비활성 학생 수',
          value: studentStats.inactive.toString(),
          unit: '명',
          trend: undefined, // [P1-1 수정] 전월 스냅샷 없으면 트렌드 제거 (오해 방지)
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'inactive_student_count',
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:StudentStats', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-new-students',
          type: 'stats',
          title: '이번 달 신규 등록',
          value: '0',
          unit: '명',
          trend: undefined,
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'new_enrollments',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-active-students',
          type: 'stats',
          title: '활성 학생 수',
          value: '0',
          unit: '명',
          trend: undefined,
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'active_student_count',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-inactive-students',
          type: 'stats',
          title: '비활성 학생 수',
          value: '0',
          unit: '명',
          trend: undefined,
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'inactive_student_count',
        }));
      }

      // 3. 월간 학생 성장률
      // 성능 최적화: 중복 제거 (lastMonthStudents 재사용, currentStudents는 students에서 필터링하여 재사용)
      try {
        // students는 이미 조회했으므로, 클라이언트에서 필터링하여 재사용
        // 단, students는 created_at 필터 없이 조회했으므로 모든 학생을 포함
        // currentMonthEnd 이전에 생성된 학생만 필터링
        // 성능 최적화: Date 객체를 한 번만 생성하여 재사용
        const currentStudentCount = students?.filter((s) => {
          if (!s.created_at) return false;
          const createdDate = new Date(s.created_at);
          return createdDate <= currentMonthEndDate;
        }).length || 0;
        const lastStudentCount = lastMonthStudentCount; // 이미 조회한 값 재사용
        const growthRate = lastStudentCount > 0
          ? Math.round(((currentStudentCount - lastStudentCount) / lastStudentCount) * 100)
          : currentStudentCount > 0 ? 100 : 0;
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-student-growth',
          type: 'stats',
          title: '월간 학생 성장률',
          value: `${growthRate > 0 ? '+' : ''}${growthRate}`,
          unit: '%',
          action_url: ROUTES.STUDENTS_LIST,
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:StudentGrowth', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-student-growth',
          type: 'stats',
          title: '월간 학생 성장률',
          value: '0',
          unit: '%',
          action_url: ROUTES.STUDENTS_LIST,
        }));
      }

      // 3-1. 이번 주 신규 등록
      // 성능 최적화: 병렬 호출 및 날짜 계산 재사용
      try {
        // [P0-1 수정] 주간 비교 범위: 타입 통일 (created_at은 timestamp이므로 ISO 사용)
        // 이번주 = [7일전 시작, 현재), 전주 = [14일전 시작, 7일전 시작 직전)
        // [P2-6 수정] 변수명 변경
        // [추가 항목] gte만 두면 열린 구간이 되므로, lte를 명시하여 "현재 시각"까지로 닫음
        // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값([])으로 유지
        const nowISO = baseKST.toISOString();
        const [weeklyNewStudents, lastWeekNewStudents] = await Promise.all([
          safe(fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: rolling7StartISO, lte: nowISO },
          }), []),
          safe(fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: rolling14StartISO, lte: rolling7EndISO },
          }), []),
        ]);
        const weeklyNewCount = weeklyNewStudents?.length || 0;
        const lastWeekNewCount = lastWeekNewStudents?.length || 0;
        const weeklyNewTrend = calculateTrend(weeklyNewCount, lastWeekNewCount);

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-weekly-new-students',
          type: 'stats',
          title: '이번 주 신규 등록',
          value: weeklyNewCount.toString(),
          unit: '명',
          trend: weeklyNewTrend,
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'new_enrollments',
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:WeeklyNewStudents', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-weekly-new-students',
          type: 'stats',
          title: '이번 주 신규 등록',
          value: '0',
          unit: '명',
          trend: undefined,
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'new_enrollments',
        }));
      }

      // 3-2. 학생 유지율
      // 성능 최적화: fetchStudentStats 중복 호출 제거 (2번 섹션에서 조회한 값 재사용)
      try {
        // studentStats는 2번 섹션에서 이미 조회했으므로 캐시에서 재사용
        // 캐시에 없으면 (2번 섹션에서 에러 발생 시) 다시 조회
        let studentStatsForRetention;
        if (studentStatsCache) {
          studentStatsForRetention = studentStatsCache;
        } else {
          try {
            studentStatsForRetention = await fetchStudentStats(tenantId);
            studentStatsCache = studentStatsForRetention; // 캐시 업데이트
          } catch (error) {
            // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
            logError('HomePage:Stats:StudentStatsRetry', error);
            // 에러 발생 시 기본값 사용
            studentStatsForRetention = { active: 0 };
          }
        }
        const totalCount = studentCount;
        const activeCount = studentStatsForRetention.active;
        const retentionRate = totalCount > 0
          ? Math.round((activeCount / totalCount) * 100)
          : 0;

        // 전월 학생 유지율 조회 (트렌드 계산용)
        // 성능 최적화: 이미 조회한 lastMonthStudents 재사용
        // const lastMonthTotalCount = lastMonthStudentCount; // 현재 사용하지 않음
        // [P1-4 수정] 전월 스냅샷/이력 테이블이 없으면 trend 표시하지 않음 (사용자 오해 방지)
        // 전월 유지율 계산은 불가능하므로 trend: undefined로 고정
        // TODO[DATA]: 전월 시점 스냅샷/이력 테이블이 생성되면 정확한 trend 계산 로직 추가

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-student-retention-rate',
          type: 'stats',
          title: '학생 유지율',
          value: retentionRate.toString(),
          unit: '%',
          trend: undefined, // [P1-4 수정] 스냅샷 없으면 표시 금지
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'active_student_count',
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:StudentRetention', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-student-retention-rate',
          type: 'stats',
          title: '학생 유지율',
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: ROUTES.STUDENTS_LIST,
          chartDataKey: 'active_student_count',
        }));
      }

      // 4. 출석 통계 (출석률, 지각률, 결석률)
      // 정본 규칙: fetchAttendanceStats 함수 사용 (Hook의 queryFn 로직 재사용)
      // 성능 최적화: 병렬 호출
      try {
        // [P1-1 수정] baseKST 재사용하여 자정 경계 불일치 방지
        // KST 기준 날짜 객체 생성 (fetchAttendanceStats는 Date 타입을 받고 내부에서 KST 변환)
        // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값으로 유지
        const todayKST = baseKST;
        const todayDateForStats = new Date(todayKST.format('YYYY-MM-DD') + 'T00:00:00+09:00');
        const yesterdayKST = todayKST.clone().subtract(1, 'day');
        const yesterdayDateForStats = new Date(yesterdayKST.format('YYYY-MM-DD') + 'T00:00:00+09:00');
        const [attendanceStats, yesterdayAttendanceStats] = await Promise.all([
          safe(fetchAttendanceStats(tenantId, todayDateForStats), { attendance_rate: 0, total_students: 0, present: 0, late: 0, absent: 0, not_checked: 0 }),
          safe(fetchAttendanceStats(tenantId, yesterdayDateForStats), { attendance_rate: 0, total_students: 0, present: 0, late: 0, absent: 0, not_checked: 0 }),
        ]);

        // [P2-2 수정] 출석률 추세: attendance_rate는 이미 % 값이므로 퍼센트포인트(%p) 변화로 계산
        // 예: 95% → 97% = +2%p (변화율이 아닌 절대 차이)
        // [P1-1 수정] 0도 의미 있는 기준값이므로, 분모(어제 total_students)가 유효하면 항상 비교
        const attendanceTrend = (yesterdayAttendanceStats?.total_students ?? 0) > 0
          ? `${attendanceStats.attendance_rate >= yesterdayAttendanceStats.attendance_rate ? '+' : ''}${Math.round(attendanceStats.attendance_rate - yesterdayAttendanceStats.attendance_rate)}%p`
          : undefined;

        const yesterdayLateRate = yesterdayAttendanceStats && yesterdayAttendanceStats.total_students > 0
          ? Math.round((yesterdayAttendanceStats.late / yesterdayAttendanceStats.total_students) * 100)
          : 0;
        const lateRate = attendanceStats.total_students > 0
          ? Math.round((attendanceStats.late / attendanceStats.total_students) * 100)
          : 0;
        // [P2-2 수정] 지각률 추세: 퍼센트포인트(%p) 변화로 계산
        // [P1-1 수정] 0도 의미 있는 기준값이므로, 분모(어제 total_students)가 유효하면 항상 비교
        const lateTrend = (yesterdayAttendanceStats?.total_students ?? 0) > 0
          ? `${lateRate >= yesterdayLateRate ? '+' : ''}${Math.round(lateRate - yesterdayLateRate)}%p`
          : undefined;

        const yesterdayAbsentRate = yesterdayAttendanceStats && yesterdayAttendanceStats.total_students > 0
          ? Math.round((yesterdayAttendanceStats.absent / yesterdayAttendanceStats.total_students) * 100)
          : 0;
        const absentRate = attendanceStats.total_students > 0
          ? Math.round((attendanceStats.absent / attendanceStats.total_students) * 100)
          : 0;
        // [P2-2 수정] 결석률 추세: 퍼센트포인트(%p) 변화로 계산
        // [P1-1 수정] 0도 의미 있는 기준값이므로, 분모(어제 total_students)가 유효하면 항상 비교
        const absentTrend = (yesterdayAttendanceStats?.total_students ?? 0) > 0
          ? `${absentRate >= yesterdayAbsentRate ? '+' : ''}${Math.round(absentRate - yesterdayAbsentRate)}%p`
          : undefined;

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-attendance-rate',
          type: 'stats',
          title: '오늘 출석률',
          value: attendanceStats.attendance_rate.toFixed(1),
          unit: '%',
          trend: attendanceTrend,
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'attendance_rate',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-late-rate',
          type: 'stats',
          title: '오늘 지각률',
          value: lateRate.toString(),
          unit: '%',
          trend: lateTrend,
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'late_rate',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-absent-rate',
          type: 'stats',
          title: '오늘 결석률',
          value: absentRate.toString(),
          unit: '%',
          trend: absentTrend,
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'absent_rate',
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:AttendanceStats', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-attendance-rate',
          type: 'stats',
          title: '오늘 출석률',
          value: '0.0',
          unit: '%',
          trend: undefined,
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'attendance_rate',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-late-rate',
          type: 'stats',
          title: '오늘 지각률',
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'late_rate',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-absent-rate',
          type: 'stats',
          title: '오늘 결석률',
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'absent_rate',
        }));
      }

      // 5. 이번 주 평균 출석률
      // 성능 최적화: 병렬 호출 및 날짜 계산 재사용
      try {
        // 출석 통계 계산은 check_in 로그만 사용 (정확한 출석률 계산)
        // [P0-2 수정] date_from/date_to는 date string 형식 사용 (AttendanceFilter 타입 정의 준수)
        // [P0-2 수정] 주간 비교 범위 겹침 방지: 이번주 = [7일전 시작, 현재), 전주 = [14일전 시작, 7일전 시작)
        // [P0-3 수정] date_to를 명시적으로 추가하여 무기한 조회 방지
        // [P1-2 수정] 로그 기반 출석률의 분모가 weeklyLogs.length인데, 학생 1명이 하루에 여러 번 체크인하거나
        //            결석은 로그가 안 남는 구조라면 실제 출석률과 다를 수 있음 (이미 "로그 기반 추정치" 라벨 있음)
        // [P1-3 수정] 운영에서 오해를 부르기 쉬운 구조: 학생이 하루에 여러 번 체크인하면 분모가 늘고, 결석은 로그가 없으면 분모가 줄어드는 방식
        // TODO[PERF]: 정확도 개선 - 백엔드에서 "expected_attendance = (활성학생수 × 영업일수)" 같은 분모를 제공하거나,
        //       attendance_stats RPC에서 "기간 출석률"을 계산해 내려주기
        // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값([])으로 유지
        const todayStr = baseKST.clone().format('YYYY-MM-DD');
        const [weeklyLogs, lastWeekLogs] = await Promise.all([
          safe(fetchAttendanceLogs(tenantId, {
            date_from: sevenDaysAgoStr,
            date_to: todayStr, // [P0-3 수정] 명시적으로 오늘까지로 제한
            attendance_type: 'check_in', // 등원 로그만 사용
          }), []),
          safe(fetchAttendanceLogs(tenantId, {
            date_from: fourteenDaysAgoStr,
            date_to: beforeSevenDaysAgoStr, // 전주 범위: 14일 전 시작 ~ 7일 전 시작 전날 (겹침 방지)
            attendance_type: 'check_in', // 등원 로그만 사용
          }), []),
        ]);
        // 성능 최적화: 필터링 결과를 변수에 저장하여 재사용
        const weeklyPresentLogs = weeklyLogs?.filter((log: AttendanceLog) => log.status === 'present') || [];
        const presentCount = weeklyPresentLogs.length;
        const weeklyAttendanceRate = weeklyLogs && weeklyLogs.length > 0
          ? Math.round((presentCount / weeklyLogs.length) * 100)
          : 0;

        const lastWeekPresentLogs = lastWeekLogs?.filter((log: AttendanceLog) => log.status === 'present') || [];
        const lastWeekPresentCount = lastWeekPresentLogs.length;
        const lastWeekAttendanceRate = lastWeekLogs && lastWeekLogs.length > 0
          ? Math.round((lastWeekPresentCount / lastWeekLogs.length) * 100)
          : 0;
        // [P1-5 수정] 출석률은 비율이므로 %p로 계산
        const weeklyTrend = calculateTrendPercentPoint(weeklyAttendanceRate, lastWeekAttendanceRate);

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-weekly-attendance',
          type: 'stats',
          title: '최근 7일 평균 출석률 (rolling·등원 로그 기반 지표)', // [P1-2 수정] 라벨을 rolling 기준으로 명확화
          value: weeklyAttendanceRate.toString(),
          unit: '%',
          trend: weeklyTrend,
          action_url: ROUTES.ATTENDANCE,
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:WeeklyAttendance', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-weekly-attendance',
          type: 'stats',
          title: '최근 7일 평균 출석률 (rolling·등원 로그 기반 지표)', // [P1-2 수정] 라벨을 rolling 기준으로 명확화
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: ROUTES.ATTENDANCE,
        }));
      }

      // 5-1. 이번 달 평균 출석률 & 5-2. 출석률 개선율 (전월 대비)
      // 성능 최적화: 병렬 호출 및 중복 제거 (5-1과 5-2 통합, 날짜 계산 재사용)
      try {
        // 출석 통계 계산은 check_in 로그만 사용 (정확한 출석률 계산)
        // [P1-2 수정] 날짜 경계 계산은 clone() 기반으로 통일하여 mutating 호출 리스크 제거
        // [P0-2 수정] date_from/date_to는 date string 형식 사용 (AttendanceFilter 타입 정의 준수)
        // [P0-3 수정] date_to를 명시적으로 추가하여 무기한 조회 방지
        // [P1-3 수정] 로그 기반 출석률의 분모 정의 한계: weeklyLogs.length는 실제 출석률과 반대로 움직일 수 있음
        // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값([])으로 유지
        const todayStrForMonthly = baseKST.clone().format('YYYY-MM-DD');
        const [monthlyLogs, lastMonthLogs] = await Promise.all([
          safe(fetchAttendanceLogs(tenantId, {
            date_from: currentMonthBase.clone().startOf('month').format('YYYY-MM-DD'),
            date_to: todayStrForMonthly, // [P0-3 수정] 명시적으로 오늘까지로 제한
            attendance_type: 'check_in', // 등원 로그만 사용
          }), []),
          safe(fetchAttendanceLogs(tenantId, {
            date_from: lastMonthBase.clone().startOf('month').format('YYYY-MM-DD'),
            date_to: lastMonthBase.clone().endOf('month').format('YYYY-MM-DD'), // 전월 범위: 전월 시작 ~ 전월 종료 (inclusive)
            attendance_type: 'check_in', // 등원 로그만 사용
          }), []),
        ]);

        // 5-1. 이번 달 평균 출석률 계산
        // 성능 최적화: 필터링 결과를 변수에 저장하여 재사용
        const monthlyPresentLogs = monthlyLogs?.filter((log: AttendanceLog) => log.status === 'present') || [];
        const monthlyPresentCount = monthlyPresentLogs.length;
        const monthlyAttendanceRate = monthlyLogs && monthlyLogs.length > 0
          ? Math.round((monthlyPresentCount / monthlyLogs.length) * 100)
          : 0;

        const lastMonthPresentLogs = lastMonthLogs?.filter((log: AttendanceLog) => log.status === 'present') || [];
        const lastMonthPresentCount = lastMonthPresentLogs.length;
        const lastMonthAttendanceRate = lastMonthLogs && lastMonthLogs.length > 0
          ? Math.round((lastMonthPresentCount / lastMonthLogs.length) * 100)
          : 0;
        // [P1-5 수정] 출석률은 비율이므로 %p로 계산
        const monthlyTrend = calculateTrendPercentPoint(monthlyAttendanceRate, lastMonthAttendanceRate);

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-monthly-attendance-rate',
          type: 'stats',
          title: '이번 달 평균 출석률 (등원 로그 기반 지표)', // [P1-2 수정] 라벨 강화: "등원 로그 기반 지표"로 명확히 표시
          value: monthlyAttendanceRate.toString(),
          unit: '%',
          trend: monthlyTrend,
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'attendance_rate',
        }));

        // 5-2. 출석률 개선율 계산 (동일한 데이터 재사용)
        const currentMonthRate = monthlyAttendanceRate; // 위에서 계산한 값 재사용
        const lastMonthRate = lastMonthAttendanceRate; // 위에서 계산한 값 재사용
        const improvementRate = lastMonthRate > 0
          ? Math.round(((currentMonthRate - lastMonthRate) / lastMonthRate) * 100)
          : currentMonthRate > 0 ? 100 : 0;

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-attendance-improvement-rate',
          type: 'stats',
          title: '출석률 개선율',
          value: `${improvementRate > 0 ? '+' : ''}${improvementRate}`,
          unit: '%',
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'attendance_rate',
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:MonthlyAttendance', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-monthly-attendance-rate',
          type: 'stats',
          title: '이번 달 평균 출석률 (등원 로그 기반 지표)', // [P1-2 수정] 라벨 강화: "등원 로그 기반 지표"로 명확히 표시
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'attendance_rate',
        }));
        cards.push(normalizeStatsCard({
          id: 'stats-attendance-improvement-rate',
          type: 'stats',
          title: '출석률 개선율',
          value: '0',
          unit: '%',
          action_url: ROUTES.ATTENDANCE,
          chartDataKey: 'attendance_rate',
        }));
      }

      // 6. 이번 달 매출 통계
      // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
      // 성능 최적화: 병렬 호출 및 reduce 중복 제거
      // [P1-2 수정] 날짜 경계 계산은 clone() 기반으로 통일하여 mutating 호출 리스크 제거
      // [P0-3 수정] queryFn 내부 다중 toKST() 호출을 currentMonthBase로 통일하여 자정 경계 불일치 방지
      // [P0-4 수정] clone() 사용하여 원본 mutate 방지
      const nextMonthStartDateForStats = currentMonthBase.clone().add(1, 'month').startOf('month');
      const currentMonthEndDateForStats = nextMonthStartDateForStats.clone().subtract(1, 'day').endOf('day');
      const currentMonthStartDateForStats = currentMonthBase.clone().startOf('month');
      const lastMonthEndDateForStats = currentMonthStartDateForStats.clone().subtract(1, 'day').endOf('day');
      // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값([])으로 유지
      const [invoices, lastMonthInvoices] = await Promise.all([
        safe(fetchBillingHistory(tenantId, {
          period_start: { gte: `${currentMonthStr}-01`, lte: currentMonthEndDateForStats.format('YYYY-MM-DD') },
        }), []),
        safe(fetchBillingHistory(tenantId, {
          period_start: { gte: `${lastMonthStr}-01`, lte: lastMonthEndDateForStats.format('YYYY-MM-DD') },
        }), []),
      ]);

      // 성능 최적화: invoices를 한 번만 순회하여 모든 값 계산
      // [P0-2 수정] Fail-Closed: 배열 타입 가드 추가 (invoices가 배열이 아니면 크래시 방지)
      const safeInvoices = Array.isArray(invoices) ? invoices : [];
      let totalRevenue = 0;
      let expectedRevenue = 0;
      let totalAmount = 0;
      let unpaidAmount = 0;
      if (safeInvoices.length > 0) {
        safeInvoices.forEach((inv: BillingHistoryItem) => {
          totalRevenue += inv.amount_paid || 0;
          expectedRevenue += inv.amount || 0;
          totalAmount += inv.amount || 0;
          if (inv.status === 'pending' || inv.status === 'overdue') {
            // [P2-1 수정] 과납/정정 케이스에서 음수 방지
            const diff = (inv.amount || 0) - (inv.amount_paid || 0);
            unpaidAmount += Math.max(0, diff);
          }
        });
      }

      // 성능 최적화: lastMonthInvoices를 한 번만 순회하여 모든 값 계산
      // [P0-2 수정] Fail-Closed: 배열 타입 가드 추가 (lastMonthInvoices가 배열이 아니면 크래시 방지)
      const safeLastMonthInvoices = Array.isArray(lastMonthInvoices) ? lastMonthInvoices : [];
      let lastMonthRevenue = 0;
      let lastMonthExpectedRevenue = 0;
      let lastMonthTotalAmount = 0;
      let lastMonthUnpaidAmount = 0;
      if (safeLastMonthInvoices.length > 0) {
        safeLastMonthInvoices.forEach((inv: BillingHistoryItem) => {
          lastMonthRevenue += inv.amount_paid || 0;
          lastMonthExpectedRevenue += inv.amount || 0;
          lastMonthTotalAmount += inv.amount || 0;
          if (inv.status === 'pending' || inv.status === 'overdue') {
            // [P2-1 수정] 과납/정정 케이스에서 음수 방지
            const diff = (inv.amount || 0) - (inv.amount_paid || 0);
            lastMonthUnpaidAmount += Math.max(0, diff);
          }
        });
      }

      const revenueTrend = lastMonthRevenue > 0
        ? `${totalRevenue > lastMonthRevenue ? '+' : ''}${Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)}%`
        : totalRevenue > 0 ? '+100%' : undefined;

      // [SSOT] 입력 정규화 레이어 사용
      cards.push(normalizeStatsCard({
        id: 'stats-revenue',
        type: 'stats',
        title: '이번 달 매출',
        value: formatNumberWithCommas(totalRevenue),
        unit: '원',
        trend: revenueTrend,
        action_url: ROUTES.BILLING_HOME,
        chartDataKey: 'revenue',
      }));

      // 7. 예정 매출
      const expectedRevenueTrend = calculateTrend(expectedRevenue, lastMonthExpectedRevenue);

      // [SSOT] 입력 정규화 레이어 사용
      cards.push(normalizeStatsCard({
        id: 'stats-expected-revenue',
        type: 'stats',
        title: '이번 달 예정 매출',
        value: formatNumberWithCommas(expectedRevenue),
        unit: '원',
        trend: expectedRevenueTrend,
        action_url: ROUTES.BILLING_HOME,
      }));

      // 8. ARPU (학생 1인당 평균 매출)
      const arpu = studentCount > 0
        ? Math.round(totalRevenue / studentCount)
        : 0;
      const lastMonthArpu = lastMonthStudentCount > 0
        ? Math.round(lastMonthRevenue / lastMonthStudentCount)
        : 0;
      const arpuTrend = calculateTrend(arpu, lastMonthArpu);

      // [SSOT] 입력 정규화 레이어 사용
      cards.push(normalizeStatsCard({
        id: 'stats-arpu',
        type: 'stats',
        title: 'ARPU (학생 1인당 매출)',
        value: formatNumberWithCommas(arpu),
        unit: '원',
        trend: arpuTrend,
        action_url: ROUTES.BILLING_HOME,
        chartDataKey: 'arpu',
      }));

      // 9. 월간 매출 성장률
      try {
        const revenueGrowthRate = lastMonthRevenue > 0
          ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
          : totalRevenue > 0 ? 100 : 0;
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-revenue-growth',
          type: 'stats',
          title: '월간 매출 성장률',
          value: `${revenueGrowthRate > 0 ? '+' : ''}${revenueGrowthRate}`,
          unit: '%',
          action_url: ROUTES.BILLING_HOME,
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:RevenueGrowth', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-revenue-growth',
          type: 'stats',
          title: '월간 매출 성장률',
          value: '0',
          unit: '%',
          action_url: ROUTES.BILLING_HOME,
        }));
      }

      // 9-1. 이번 주 매출
      // [P1-2 수정] payments 테이블 기준으로 주간 매출 계산 (결제 완료 시각 기준)
      // 주의: fetchPayments는 created_at 필터만 지원하므로, 결제 생성 시각 기준으로 집계됨
      //       실제 결제 완료 시각(paid_at)과 다를 수 있으나, period_start 기준보다 정확함
      // 성능 최적화: 병렬 호출 및 날짜 계산 재사용
      try {
        // [P0-1 수정] 주간 비교 범위: ISO 타입 통일 (created_at은 timestamp)
        // 이번주 = [7일전 시작, 현재), 전주 = [14일전 시작, 7일전 시작 직전)
        // [P2-6 수정] 변수명 변경
        // [추가 항목] gte만 두면 열린 구간이 되므로, lte를 명시하여 "현재 시각"까지로 닫음
        // [P1-4 수정] 주간 매출 계산은 여전히 근사치 + created_at 의미가 결제 완료 시각이 아닐 수 있음
        // - created_at: 결제 생성 시각 (결제 요청 시점)
        // - updated_at: 결제 상태 업데이트 시각 (결제 완료 시각이 아닐 수 있음)
        // - 실제 매출: paid_at(결제 완료 시각) 기준이 가장 정확하나, 현재 필터 스펙에 없음
        // 운영 지표로 사용 시 분쟁 포인트 가능성: 운영자는 숫자만 보고 판단하기 쉬움
        // TODO[DATA]: 정확도 개선 방안
        //   1. paid_at 같은 명시 컬럼이 있으면 그걸 사용
        //   2. 없으면 payments 기반으로 별도 집계 query로 분리
        //   3. 또는 결제 완료 집계는 billing_history/invoice 기반으로 일관되게 처리
        // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값([])으로 유지
        const nowISO = baseKST.toISOString();
        const [weeklyPayments, lastWeekPayments] = await Promise.all([
          safe(fetchPayments(tenantId, {
            status: 'completed',
            created_at: { gte: rolling7StartISO, lte: nowISO },
          }), []),
          safe(fetchPayments(tenantId, {
            status: 'completed',
            created_at: { gte: rolling14StartISO, lte: rolling7EndISO },
          }), []),
        ]);
        // [P0-4 수정] fetchPayments 반환이 배열이라는 보장이 없으므로 방어 코드 추가
        const weeklyPaymentsSafe = Array.isArray(weeklyPayments) ? weeklyPayments : [];
        const lastWeekPaymentsSafe = Array.isArray(lastWeekPayments) ? lastWeekPayments : [];
        // [P1-2 수정] payments 테이블의 amount 필드 합계 계산
        const weeklyRevenue = weeklyPaymentsSafe.reduce((sum: number, payment) => {
          return sum + (payment.amount || 0);
        }, 0);
        const lastWeekRevenue = lastWeekPaymentsSafe.reduce((sum: number, payment) => {
          return sum + (payment.amount || 0);
        }, 0);
        const weeklyRevenueTrend = calculateTrend(weeklyRevenue, lastWeekRevenue);

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-weekly-revenue',
          type: 'stats',
          title: '최근 7일 매출 (rolling·결제 생성 시각 기준·근사치)', // [P1-2 수정] 라벨을 rolling 기준으로 명확화
          value: formatNumberWithCommas(weeklyRevenue),
          unit: '원',
          trend: weeklyRevenueTrend,
          action_url: ROUTES.BILLING_HOME,
          chartDataKey: 'revenue',
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:WeeklyRevenue', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-weekly-revenue',
          type: 'stats',
          title: '최근 7일 매출 (rolling·결제 생성 시각 기준·근사치)', // [P1-2 수정] 라벨을 rolling 기준으로 명확화
          value: '0',
          unit: '원',
          trend: undefined,
          action_url: ROUTES.BILLING_HOME,
          chartDataKey: 'revenue',
        }));
      }

      // 9-2. 평균 청구 금액
      try {
        // [P0-2 수정] safeInvoices와 safeLastMonthInvoices 사용 (배열 타입 보장)
        const invoiceCount = safeInvoices.length;
        const avgInvoiceAmount = invoiceCount > 0
          ? Math.round(expectedRevenue / invoiceCount)
          : 0;

        // 전월 평균 청구 금액 조회 (트렌드 계산용)
        const lastMonthInvoiceCount = safeLastMonthInvoices.length;
        const lastMonthAvgInvoiceAmount = lastMonthInvoiceCount > 0
          ? Math.round(lastMonthExpectedRevenue / lastMonthInvoiceCount)
          : 0;
        const avgInvoiceTrend = calculateTrend(avgInvoiceAmount, lastMonthAvgInvoiceAmount);

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-avg-invoice-amount',
          type: 'stats',
          title: '평균 청구 금액',
          value: formatNumberWithCommas(avgInvoiceAmount),
          unit: '원',
          trend: avgInvoiceTrend,
          action_url: ROUTES.BILLING_HOME,
        }));
      } catch (error) {
        // [P1-3 수정] 에러 발생 시 기본값으로 카드 추가 (Fail Closed)
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:AvgInvoiceAmount', error);
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-avg-invoice-amount',
          type: 'stats',
          title: '평균 청구 금액',
          value: '0',
          unit: '원',
          trend: undefined,
          action_url: ROUTES.BILLING_HOME,
        }));
      }

      // 10. 미납률
      // 성능 최적화: 이미 계산한 totalAmount, unpaidAmount, lastMonthTotalAmount, lastMonthUnpaidAmount 재사용
      const unpaidRate = totalAmount > 0
        ? Math.round((unpaidAmount / totalAmount) * 100)
        : 0;
      const lastMonthUnpaidRate = lastMonthTotalAmount > 0
        ? Math.round((lastMonthUnpaidAmount / lastMonthTotalAmount) * 100)
        : 0;
      // [P1-5 수정] 미납률은 비율이므로 %p로 계산
      const unpaidTrend = calculateTrendPercentPoint(unpaidRate, lastMonthUnpaidRate);

      // [SSOT] 입력 정규화 레이어 사용
      cards.push(normalizeStatsCard({
        id: 'stats-unpaid-rate',
        type: 'stats',
        title: '미납률',
        value: unpaidRate.toString(),
        unit: '%',
        trend: unpaidTrend,
        action_url: ROUTES.BILLING_HOME,
      }));

      // 11. 반당 평균 인원
      // 성능 최적화: 중복 제거 (classes를 한 번만 조회하고 재사용)
      try {
        // fetchClasses는 날짜 필터를 지원하지 않으므로, 현재 활성 반만 조회 가능
        // 전월 반 데이터는 별도 조회가 불가능하므로, 현재 반 데이터를 재사용
        // [P0-1 수정] safe 래퍼로 부분 실패 시에도 기본값([])으로 유지
        const classes = await safe(fetchClasses(tenantId, { status: 'active' }), []);
        const classCount = classes?.length || 0;
        const avgStudentsPerClass = classCount > 0 && studentCount > 0
          ? Math.round(studentCount / classCount)
          : 0;

        // [P1-5 수정] 전월 반 데이터 조회 불가능하므로 trend 표시하지 않음 (사용자 오해 방지)
        // fetchClasses는 날짜 필터를 지원하지 않아 전월 데이터 조회 불가
        // TODO[DATA]: 반 이력 테이블이 생성되면 정확한 trend 계산 로직 추가

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-avg-students-per-class',
          type: 'stats',
          title: '반당 평균 인원',
          value: avgStudentsPerClass.toString(),
          unit: '명',
          trend: undefined, // [P1-5 수정] 전월 데이터 없으면 표시 금지
          action_url: ROUTES.CLASSES_LIST,
          chartDataKey: 'avg_students_per_class',
        }));

        // 12. 평균 정원률
        let totalCapacity = 0;
        let totalCurrent = 0;
        if (classes && classes.length > 0) {
          classes.forEach((cls) => {
            if (cls.capacity && cls.capacity > 0) {
              totalCapacity += cls.capacity;
              totalCurrent += cls.current_count || 0;
            }
          });
        }
        const avgCapacityRate = totalCapacity > 0
          ? Math.round((totalCurrent / totalCapacity) * 100)
          : 0;

        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-avg-capacity-rate',
          type: 'stats',
          title: '평균 정원률',
          value: avgCapacityRate.toString(),
          unit: '%',
          trend: undefined, // [P1-5 수정] 전월 데이터 없으면 표시 금지
          action_url: ROUTES.CLASSES_LIST,
          chartDataKey: 'avg_capacity_rate',
        }));
      } catch (error) {
        // [P2-1 수정] React Query v5(useQuery)에는 onError 옵션이 없으므로, 여기서는 Fail Closed로 조용히 무시
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:ClassStats', error);
      }

      // 13. 평균 수납 기간 (청구일 ~ 수납일 평균 일수)
      // [P1-4 수정] updated_at은 결제 완료 시각이 아닐 수 있음 (다른 업데이트로도 변경 가능)
      // BillingHistoryItem에는 paid_at 필드가 없으므로 updated_at을 사용하되, "근사치"임을 명시
      // 성능 최적화: 필터링과 계산을 한 번의 순회로 통합, Date 객체 생성 최적화
      try {
        let totalDays = 0;
        let paidCount = 0;
        // [P2-2 수정] 매직 넘버 상수화
        const ONE_DAY_MS = 1000 * 60 * 60 * 24;
        // [P0-2 수정] Fail-Closed: 배열 타입 가드 추가 (invoices가 배열이 아니면 크래시 방지)
        // invoices는 위에서 safe() 래퍼로 감싸져 있지만, 방어적 프로그래밍을 위해 배열 타입 가드 추가
        const safeInvoicesForCollection = Array.isArray(invoices) ? invoices : [];
        if (safeInvoicesForCollection.length > 0) {
          safeInvoicesForCollection.forEach((inv: BillingHistoryItem) => {
            // [P0-2 수정] SSOT 기반 헬퍼 함수로 status 비교
            if (isInvoicePaid(inv.status) && (inv.amount_paid ?? 0) > 0 && inv.period_start && inv.updated_at) {
              // [P0-2 수정] period_start Date 파싱을 KST 고정으로 변경: 타임존에 따른 1일 오차 방지
              // YYYY-MM-DD 형태의 date는 UTC로 파싱될 수 있어 KST 기준 일수차가 흔들릴 수 있음
              // [P1-4 수정] updated_at은 결제 완료 시각이 아닐 수 있으므로 근사치로 계산
              const periodStart = new Date(`${inv.period_start}T00:00:00+09:00`).getTime();
              const paidDate = new Date(inv.updated_at).getTime();
              const daysDiff = Math.max(0, Math.round((paidDate - periodStart) / ONE_DAY_MS));
              totalDays += daysDiff;
              paidCount++;
            }
          });
        }
        const avgCollectionPeriod = paidCount > 0
          ? Math.round(totalDays / paidCount)
          : 0;
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-avg-collection-period',
          type: 'stats',
          title: '평균 수납 기간 (근사치)', // [P1-4 수정] updated_at 기준이므로 근사치임을 명시
          value: avgCollectionPeriod.toString(),
          unit: '일',
          action_url: ROUTES.BILLING_HOME,
        }));
      } catch (error) {
        // [P2-1 수정] React Query v5(useQuery)에는 onError 옵션이 없으므로, 여기서는 Fail Closed로 조용히 무시
        // [P2-QUALITY-2 수정] 공통 로깅 유틸리티 사용
        logError('HomePage:Stats:CollectionPeriod', error);
        // 에러 발생 시에도 0일로 표시
        // [SSOT] 입력 정규화 레이어 사용
        cards.push(normalizeStatsCard({
          id: 'stats-avg-collection-period',
          type: 'stats',
          title: '평균 수납 기간 (근사치)', // [P1-4 수정] updated_at 기준이므로 근사치임을 명시
          value: '0',
          unit: '일',
          action_url: ROUTES.BILLING_HOME,
        }));
      }

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: CACHE_TIMES.STATS_REFETCH,
    staleTime: CACHE_TIMES.STATS_STALE,
    gcTime: CACHE_TIMES.STATS_GC,
    // [P2-1 수정] React Query v5에서는 onError가 제거되었으므로, queryFn 내부에서 에러 처리
    // 각 catch 블록에서 조용히 처리하되, 필요시 전역 에러 핸들러에서 중앙 집중 처리 가능
  });

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
        const baseKSTForBilling = toKST();
        const currentMonth = baseKSTForBilling.format('YYYY-MM');
        const nextMonthStartDateForBilling = baseKSTForBilling.clone().add(1, 'month').startOf('month');
        const currentMonthEndDateForBilling = nextMonthStartDateForBilling.clone().subtract(1, 'day').endOf('day');

        // 이번 달 청구서 조회
        // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
        const invoices = await fetchBillingHistory(tenantId, {
          period_start: { gte: `${currentMonth}-01`, lte: currentMonthEndDateForBilling.format('YYYY-MM-DD') },
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
          title: '이번 달 수납 현황',
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
          title: '이탈 위험 학생 알림',
          summary: `${riskCount}명의 학생이 이탈 위험 단계입니다.`,
          insights: [
            '이탈 위험 학생들에게 즉시 상담을 진행하세요.',
            '학생의 학습 동기를 높이기 위한 방안을 모색하세요.',
          ],
          created_at: riskCardCreatedAt, // [P0-2 수정] 원천 데이터 기준으로 고정
          action_url: riskActionUrl, // 정본: 서버에서 제공된 action_url 사용
        });

        return [...aiBriefingCards, riskBriefingCard];
      }
    }

    return aiBriefingCards;
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
      cards.push(normalizeEmergencyCard({
        id: `${EMPTY_CARD_ID_PREFIX}-emergency`,
        type: 'emergency',
        title: EMPTY_CARD_MESSAGES.EMERGENCY.TITLE,
        message: EMPTY_CARD_MESSAGES.EMERGENCY.MESSAGE,
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
      cards.push(normalizeAIBriefingCard({
        id: `${EMPTY_CARD_ID_PREFIX}-ai-briefing`,
        type: 'ai_briefing',
        title: EMPTY_CARD_MESSAGES.AI_BRIEFING.TITLE,
        summary: EMPTY_CARD_MESSAGES.AI_BRIEFING.SUMMARY,
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
      cards.push(normalizeClassCard({
        id: `${EMPTY_CARD_ID_PREFIX}-class`,
        type: 'class',
        class_name: EMPTY_CARD_MESSAGES.CLASS.CLASS_NAME,
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
      cards.push(normalizeBillingSummaryCard({
        id: `${EMPTY_CARD_ID_PREFIX}-billing`,
        type: 'billing_summary',
        title: EMPTY_CARD_MESSAGES.BILLING_SUMMARY.TITLE,
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
              title: '출석 관련 지표',
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
              title: '학생 성장 지표',
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
              title: '매출 관련 지표',
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
              title: '수납 관련 지표',
              value: '-',
      })
          );

    return [
            {
              type: 'briefing',
              label: '브리핑',
              cards: briefingCards,
            },
            {
              type: 'student_task',
              label: '학생 업무',
              cards: taskCardsInView,
            },
            {
              type: 'class',
              label: '오늘 수업',
              cards: classCards,
            },
            {
              type: 'attendance_stats',
              label: '출석 관련 지표',
              cards: attendanceStatsCards,
            },
            {
              type: 'student_growth_stats',
              label: '학생 성장 지표',
              cards: studentGrowthStatsCards,
            },
            {
              type: 'revenue_stats',
              label: '매출 관련 지표',
              cards: revenueStatsCards,
            },
            {
              type: 'collection_stats',
              label: '수납 관련 지표',
              cards: collectionStatsCards,
            },
          ];
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
            이 대시보드에서는 <strong style={{ color: 'var(--color-text)' }}>긴급 알림, AI 브리핑, 학생 업무, 출석 통계, 매출 현황</strong> 등 학원 운영에 필요한 핵심 정보를 한눈에 확인할 수 있습니다.
            긴급 알림을 통해 즉시 대응이 필요한 사항을 파악하고, AI 브리핑으로 학생들의 상태와 트렌드를 분석하며,
            실시간 통계를 통해 출석률과 매출을 모니터링하여 더욱 효율적으로 학원을 운영하세요.
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
