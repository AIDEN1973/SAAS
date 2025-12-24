/**
 * 홈 대시보드 페이지
 *
 * 아키텍처 문서 3.7.1 섹션 참조
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [참고] fetch 함수들은 tenantId를 인자로 받으며, Hook 내부에서 Context를 사용합니다.
 * 실제 구현: fetchX(tenantId, ...) 패턴 사용, Hook은 내부에서 getApiContext()로 tenantId 자동 조회
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

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, PageHeader, ContextRecommendationBanner } from '@ui-core/react';
import { useStudentTaskCards, fetchConsultations, fetchPersons, fetchStudents, fetchStudentStats, fetchAttendanceStats, fetchStudentAlerts } from '@hooks/use-student';
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
import { renderCard } from '../utils/dashboardCardRenderer';
import { EMPTY_CARD_MESSAGES, EMPTY_CARD_ID_PREFIX } from '../constants/dashboard-cards';
import { CardGridLayout } from '../components/CardGridLayout';
import { useDailyStoreMetrics } from '@hooks/use-daily-store-metrics';
import { StatsChartModal } from '../components/dashboard-cards/StatsChartModal';
import { useTenantSettingByPath } from '@hooks/use-config';
import {
  EMERGENCY_CARDS_POLICY_PATHS,
} from '../constants/emergency-cards-policy';

export function HomePage() {
  const navigate = useNavigate();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  // Config를 React Query로 캐시 (성능 최적화: 여러 queryFn에서 중복 호출 방지)
  useQuery({
    queryKey: ['tenant-config', tenantId],
    queryFn: async (): Promise<Record<string, unknown> | null> => {
      if (!tenantId) return null;

      try {
        const response = await apiClient.get<{ key: string; value: Record<string, unknown> }>('tenant_settings', {
          filters: { key: 'config' },
        });

        if (response.error) {
          if (response.error.code === 'PGRST116' || response.error.code === 'PGRST205') {
            return null; // Fail Closed
          }
          return null; // Fail Closed
        }

        // 방어 코드: response.data가 배열이 아닐 경우 배열로 정규화
        const rows = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
        if (rows.length === 0) {
          return null; // Fail Closed
        }

        // filters: { key: 'config' }로 필터링했지만, 방어적 코드로 find 사용
        // (apiClient.get의 filters가 정확히 작동하지 않을 경우 대비)
        const configRecord = rows.find((item) => item.key === 'config');
        if (!configRecord || !configRecord.value) {
          return null; // Fail Closed
        }

        return configRecord.value as Record<string, unknown>;
      } catch {
        return null; // Fail Closed
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 방지
  });

  // 그래프 모달 상태 관리
  const [chartModalOpen, setChartModalOpen] = useState<{ cardId: string | null }>({ cardId: null });

  // 최근 30일 데이터 조회
  const thirtyDaysAgo = useMemo(() => {
    const date = toKST().subtract(30, 'day');
    return date.format('YYYY-MM-DD');
  }, []);
  const today = useMemo(() => {
    return toKST().format('YYYY-MM-DD');
  }, []);

  const { data: dailyStoreMetrics } = useDailyStoreMetrics({
    date_kst: { gte: thirtyDaysAgo, lte: today },
  });

  // Context Signals (상황 신호 수집 및 UI 조정)
  // 프론트 자동화 문서 1.2.1 섹션 참조: 자동 화면 전환 금지, 상황 신호 수집만 수행
  const adaptiveNav = useAdaptiveNavigation();

  // 월말 적응 (청구 카드 priority 가중치 조정)
  const { shouldPrioritizeBilling } = useMonthEndAdaptation();

  // Student Task Cards 조회
  const { data: studentTaskCards } = useStudentTaskCards();

  // Policy 조회 헬퍼 함수 (queryFn 내부에서만 사용, 외부에서는 useTenantSettingByPath Hook 사용)
  // [불변 규칙] Automation Config First: 모든 자동화는 Policy 기반으로만 동작
  // [불변 규칙] Fail Closed: Policy가 없으면 null 반환
  // 성능 최적화: React Query 캐시에서 config를 가져오거나, 없으면 로드 후 캐시에 저장
  const loadConfigOnce = async (): Promise<Record<string, unknown> | null> => {
    if (!tenantId) return null;

    // React Query 캐시에서 먼저 확인
    const cached = queryClient.getQueryData<Record<string, unknown> | null>(['tenant-config', tenantId]);
    if (cached !== undefined) {
      return cached;
    }

    // 캐시에 없으면 로드
    try {
      const response = await apiClient.get<{ key: string; value: Record<string, unknown> }>('tenant_settings', {
        filters: { key: 'config' },
      });

      if (response.error) {
        if (response.error.code === 'PGRST116' || response.error.code === 'PGRST205') {
          return null; // Fail Closed
        }
        return null; // Fail Closed
      }

      // 방어 코드: response.data가 배열이 아닐 경우 배열로 정규화
      const rows = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
      if (rows.length === 0) {
        return null; // Fail Closed
      }

      // filters: { key: 'config' }로 필터링했지만, 방어적 코드로 find 사용
      // (apiClient.get의 filters가 정확히 작동하지 않을 경우 대비)
      const configRecord = rows.find((item) => item.key === 'config');
      if (!configRecord || !configRecord.value) {
        return null; // Fail Closed
      }

      const config = configRecord.value as Record<string, unknown>;
      // 캐시에 저장
      queryClient.setQueryData(['tenant-config', tenantId], config);
      return config;
    } catch {
      return null; // Fail Closed
    }
  };

  const getPolicyValueFromConfig = (config: Record<string, unknown> | null, path: string): unknown => {
    if (!config) {
      return null; // Fail Closed
    }

    // 경로 추출
    const keys = path.split('.');
    let current: unknown = config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return null; // Fail Closed
      }
    }

    // [불변 규칙] Fail Closed: undefined도 null로 정규화하여 Fail Closed 보장
    return current === undefined ? null : current;
  };


  // Emergency Cards 조회 (결제 실패, 출결 오류, AI 위험 점수 기반)
  // 아키텍처 문서 4.6 섹션 참조: Emergency Card 표시 조건
  // [불변 규칙] Automation Config First: 모든 임계값은 Policy 기반으로만 동작
  const { data: emergencyCards } = useQuery({
    queryKey: ['emergency-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: EmergencyCard[] = [];

      // 성능 최적화: config를 한 번만 조회하고 재사용
      const config = await loadConfigOnce();

      // 1. 결제 실패 임계값 체크 (아키텍처 문서 4747줄 참조)
      // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
      // 정본 규칙: fetchPayments 함수 사용 (Hook의 queryFn 로직 재사용)
      const paymentFailedThresholdValue = getPolicyValueFromConfig(config, EMERGENCY_CARDS_POLICY_PATHS.PAYMENT_FAILED_THRESHOLD);
      const paymentFailedThreshold = typeof paymentFailedThresholdValue === 'number' ? paymentFailedThresholdValue : null;
      if (paymentFailedThreshold !== null) {
        const failedPayments = await fetchPayments(tenantId, {
          status: 'failed',
        });

        if (failedPayments && failedPayments.length > 0) {
          const failedCount = failedPayments.length;
          if (failedCount >= paymentFailedThreshold) {
            cards.push({
              id: 'payment-failed-emergency',
              type: 'emergency',
              title: '결제 실패 알림',
              message: `최근 결제 실패가 ${failedCount}건 발생했습니다.`,
              priority: 1,
              action_url: '/billing/home',
            });
          }
        }
      }

      // 2. 출결 오류 이벤트 시간 임계값 체크 (아키텍처 문서 4747줄 참조)
      // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
      // 기술문서 5-2: KST 기준 날짜 처리
      // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
      // [주의] 출결 오류 Emergency는 정식 데이터 소스가 없어 임시 구현 상태
      // Policy enabled 플래그로 활성화 여부 제어
      const attendanceErrorEnabled = getPolicyValueFromConfig(config, EMERGENCY_CARDS_POLICY_PATHS.ATTENDANCE_ERROR_ENABLED);
      if (attendanceErrorEnabled === true) {
        const attendanceErrorMinutesValue = getPolicyValueFromConfig(config, EMERGENCY_CARDS_POLICY_PATHS.ATTENDANCE_ERROR_MINUTES);
        const attendanceErrorMinutes = typeof attendanceErrorMinutesValue === 'number' ? attendanceErrorMinutesValue : null;
        if (attendanceErrorMinutes !== null) {
          const minutesAgo = toKST().subtract(attendanceErrorMinutes, 'minute').toISOString();
          // 출결 오류 필터링: attendance_logs 테이블의 status는 'present' | 'late' | 'absent' | 'excused'만 허용
          // 실제 오류는 별도 필드나 테이블에서 관리되므로, 현재는 모든 로그를 조회하고 클라이언트에서 필터링
          // TODO: 출결 오류 전용 필드/테이블이 추가되면 해당 필터 적용
          const allLogs = await fetchAttendanceLogs(tenantId, {
            date_from: minutesAgo,
          });
          // 임시: notes에 오류 관련 키워드가 있거나, 특정 조건으로 필터링
          // 실제 구현 시 오류 전용 필드/테이블 사용
          const attendanceErrors = allLogs?.filter((log: AttendanceLog) =>
            log.notes?.toLowerCase().includes('error') ||
            log.notes?.toLowerCase().includes('오류') ||
            false // 실제 오류 필터링 로직 추가 필요
          ) || [];

          if (attendanceErrors && attendanceErrors.length > 0) {
            cards.push({
              id: 'attendance-error-emergency',
              type: 'emergency',
              title: '출결 오류 알림',
              message: `최근 ${attendanceErrorMinutes}분 이내 출결 오류가 발생했습니다.`,
              priority: 2,
              action_url: '/attendance',
            });
          }
        }
      }

      // 3. AI 위험 점수 90 이상 체크는 studentTaskCards에서 파생 (정본 규칙: task_cards 직접 조회 제거)
      // 정본 규칙: Emergency 쿼리 내부에서 apiClient.get('task_cards') 직접 조회 금지
      // studentTaskCards에서 risk 타입 카드를 파생하여 사용 (라인 138 이후 useMemo에서 처리)

      // 4. 학생 알림 요약 (이탈 위험, 결석, 상담 대기)
      // 정본 규칙: fetchStudentAlerts 함수 사용 (Hook의 queryFn 로직 재사용)
      try {
        const studentAlerts = await fetchStudentAlerts(tenantId);
        if (studentAlerts.risk_count > 0) {
          cards.push({
            id: 'emergency-risk-students',
            type: 'emergency',
            title: '이탈 위험 학생',
            message: `${studentAlerts.risk_count}명의 학생이 이탈 위험 단계입니다.`,
            priority: 4,
            action_url: '/students/list?filter=risk',
          });
        }
        if (studentAlerts.absent_count > 0) {
          cards.push({
            id: 'emergency-absent-students',
            type: 'emergency',
            title: '결석 학생 알림',
            message: `${studentAlerts.absent_count}명의 학생이 결석 상태입니다.`,
            priority: 5,
            action_url: '/students/list?filter=absent',
          });
        }
        if (studentAlerts.consultation_pending_count > 0) {
          cards.push({
            id: 'emergency-consultation-pending',
            type: 'emergency',
            title: '상담 대기 학생',
            message: `${studentAlerts.consultation_pending_count}명의 학생이 상담 대기 중입니다.`,
            priority: 6,
            action_url: '/students/list?filter=consultation',
          });
        }
      } catch (error) {
        console.error('Failed to fetch student alerts:', error);
      }

      // 5. 시스템 오류 체크 (추가)
      // TODO: 시스템 오류 로그 테이블이 생성되면 실제 조회로 변경

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // 1분마다 갱신
    staleTime: 30000, // 30초간 캐시 유지
    gcTime: 300000, // 5분간 가비지 컬렉션 방지
  });

  // Policy 조회: AI 위험 점수 임계값
  // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
  // [불변 규칙] Fail Closed: Policy가 없으면 실행하지 않음
  const { data: aiRiskScoreThreshold } = useTenantSettingByPath(EMERGENCY_CARDS_POLICY_PATHS.AI_RISK_SCORE_THRESHOLD);
  const aiRiskScoreThresholdValue = typeof aiRiskScoreThreshold === 'number' ? aiRiskScoreThreshold : null;

  // 정본 규칙: Emergency 쿼리 내부에서 task_cards 직접 조회 제거
  // studentTaskCards에서 risk 카드를 파생하여 Emergency 카드에 합성
  const enhancedEmergencyCards = useMemo(() => {
    if (!emergencyCards || !studentTaskCards) return emergencyCards || [];

    // [불변 규칙] Fail Closed: Policy가 없으면 Emergency Card 생성하지 않음
    if (typeof aiRiskScoreThresholdValue !== 'number') {
      return emergencyCards;
    }

    // studentTaskCards에서 Policy 기반 임계값 이상인 risk 타입 카드 찾기
    // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
    // ⚠️ 중요: task_type='risk'인 카드에서 priority는 risk_score를 담습니다
    // (create_risk_task_card RPC에서 p_risk_score를 priority에 저장)
    // 따라서 priority >= aiRiskScoreThresholdValue 비교는 위험 점수 임계값 비교와 동일합니다
    const highRiskCard = studentTaskCards.find((card) => {
      if (card.task_type !== 'risk' || !card.action_url) return false;
      const score = Number(card.priority);
      return Number.isFinite(score) && score >= aiRiskScoreThresholdValue;
    });

    if (highRiskCard) {
      // AI risk emergency 카드를 맨 앞에 추가 (slice에 잘리지 않도록)
      const aiRiskEmergency: EmergencyCard = {
        id: 'ai-risk-emergency',
        type: 'emergency',
        title: 'AI 위험 감지',
        message: '높은 위험 점수를 가진 학생이 감지되었습니다.',
        priority: 3,
        action_url: highRiskCard.action_url, // 정본: 서버에서 제공된 action_url 사용
      };

      // 맨 앞에 추가 (unshift 대신 새 배열 생성)
      return [aiRiskEmergency, ...emergencyCards];
    }

    return emergencyCards;
  }, [emergencyCards, studentTaskCards, aiRiskScoreThresholdValue]);

  // AI Briefing Cards 조회
  // 아키텍처 문서 3.7.1 섹션 참조: AI 브리핑 카드
  const { data: aiBriefingCards } = useQuery({
    queryKey: ['ai-briefing-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: AIBriefingCard[] = [];

      // 성능 최적화: config를 한 번만 조회하고 재사용
      const config = await loadConfigOnce();

      try {
        // AI 브리핑 카드는 배치 작업에서 서버가 생성함 (아키텍처 문서 3911줄: 매일 07:00 생성, AI 호출 포함)
        // ai_insights 테이블에서 오늘 날짜의 브리핑 카드 조회
        // 정본 규칙: fetchAIInsights 함수 사용 (Hook의 queryFn 로직 재사용)
        const todayDateKST = toKST();
        const aiInsights = await fetchAIInsights(tenantId, {
          insight_type: 'daily_briefing',
          created_at: { gte: todayDateKST.startOf('day').toISOString(), lte: todayDateKST.endOf('day').toISOString() },
        });

        if (aiInsights && aiInsights.length > 0) {
          // ai_insights 테이블에서 조회한 데이터를 AIBriefingCard 형식으로 변환
          const insights = aiInsights.map((insight) => {
            let parsedInsights: unknown = insight.insights;
            if (typeof insight.insights === 'string') {
              try {
                parsedInsights = JSON.parse(insight.insights);
              } catch (error) {
                console.error('Failed to parse insight.insights:', error);
                parsedInsights = [];
              }
            }
            return {
              id: insight.id,
              type: 'ai_briefing' as const,
              title: insight.title,
              summary: insight.summary,
              insights: Array.isArray(parsedInsights) ? parsedInsights as string[] : [],
              created_at: insight.created_at,
              action_url: insight.action_url,
            };
          });

          return insights;
        }

        // ai_insights 테이블에 데이터가 없는 경우 (배치 작업 전 또는 실패 시) fallback 로직
        // 주의: 이는 임시 fallback이며, 정상적으로는 배치 작업에서 생성된 카드를 사용해야 함
        // 정본 규칙: fetchConsultations 함수 사용 (Hook의 queryFn 로직 재사용)
        const todayDateStr = toKST().format('YYYY-MM-DD');
        const todayConsultations = await fetchConsultations(tenantId, {
          consultation_date: { gte: todayDateStr },
        });
        if (todayConsultations.length > 0) {
          cards.push({
            id: 'briefing-consultations',
            type: 'ai_briefing',
            title: '오늘의 상담 일정',
            summary: `오늘 ${todayConsultations.length}건의 상담이 예정되어 있습니다.`,
            insights: [
              '상담일지를 작성하여 학생 관리를 강화하세요.',
              '상담 내용을 바탕으로 학생의 학습 방향을 조정할 수 있습니다.',
            ],
            created_at: toKST().toISOString(),
            action_url: '/ai?tab=consultation', // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
          });
        }

        // 2. 이번 달 청구서 상태 확인
        // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
        // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
        const collectionRateThresholdValue = getPolicyValueFromConfig(config, EMERGENCY_CARDS_POLICY_PATHS.COLLECTION_RATE_THRESHOLD);
        const collectionRateThreshold = typeof collectionRateThresholdValue === 'number' ? collectionRateThresholdValue : null;
        if (collectionRateThreshold !== null) {
          const currentMonth = toKST().format('YYYY-MM');
          const nextMonthStartDateForCollection = toKST().add(1, 'month').startOf('month');
          const currentMonthEndDateForCollection = nextMonthStartDateForCollection.clone().subtract(1, 'day').endOf('day');
          const invoices = await fetchBillingHistory(tenantId, {
            period_start: { gte: `${currentMonth}-01`, lte: currentMonthEndDateForCollection.format('YYYY-MM-DD') },
          });

          if (invoices && invoices.length > 0) {
            const totalAmount = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
            const paidAmount = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);
            const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

            if (invoices.length > 0) {
              cards.push({
                id: 'briefing-billing',
                type: 'ai_briefing',
                title: '이번 달 수납 현황',
                summary: `이번 달 청구서가 자동 발송되었습니다. 예상 수납률은 ${expectedCollectionRate}%입니다.`,
                insights: [
                  expectedCollectionRate >= collectionRateThreshold
                    ? '수납률이 양호합니다. 현재 운영 방식을 유지하세요.'
                    : '수납률 개선이 필요합니다. 미납 학생에게 연락을 취하세요.',
                ],
                created_at: toKST().toISOString(),
                action_url: '/billing/home', // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
              });
            }
          }
        }

        // 3. 출결 이상 패턴 확인 (최근 7일)
        // [불변 규칙] Automation Config First: Policy 기반 임계값 사용
        // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
        const attendanceAnomalyAbsentThresholdValue = getPolicyValueFromConfig(config, EMERGENCY_CARDS_POLICY_PATHS.ATTENDANCE_ANOMALY_ABSENT_THRESHOLD);
        const attendanceAnomalyLateThresholdValue = getPolicyValueFromConfig(config, EMERGENCY_CARDS_POLICY_PATHS.ATTENDANCE_ANOMALY_LATE_THRESHOLD);
        const attendanceAnomalyAbsentThreshold = typeof attendanceAnomalyAbsentThresholdValue === 'number' ? attendanceAnomalyAbsentThresholdValue : null;
        const attendanceAnomalyLateThreshold = typeof attendanceAnomalyLateThresholdValue === 'number' ? attendanceAnomalyLateThresholdValue : null;
        if (attendanceAnomalyAbsentThreshold !== null && attendanceAnomalyLateThreshold !== null) {
          const sevenDaysAgo = toKST().subtract(7, 'days');
          const logs = await fetchAttendanceLogs(tenantId, {
            date_from: sevenDaysAgo.startOf('day').toISOString(),
          });

          if (logs && logs.length > 0) {
            const absentCount = logs.filter((log: AttendanceLog) => log.status === 'absent').length;
            const lateCount = logs.filter((log: AttendanceLog) => log.status === 'late').length;

            if (absentCount > attendanceAnomalyAbsentThreshold || lateCount > attendanceAnomalyLateThreshold) {
              cards.push({
                id: 'briefing-attendance',
                type: 'ai_briefing',
                title: '출결 이상 패턴 감지',
                summary: `최근 7일간 결석 ${absentCount}건, 지각 ${lateCount}건이 발생했습니다.`,
                insights: [
                  '출결 패턴을 분석하여 원인을 파악하세요.',
                  '지각이 많은 학생들에게 사전 안내를 제공하세요.',
                ],
                created_at: toKST().toISOString(),
                action_url: '/ai?tab=attendance', // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
              });
            }
          }
        }

        // 4. 이탈 위험 학생 확인은 studentTaskCards에서 파생 (정본 규칙: task_cards 직접 조회 제거)
        // 정본 규칙: AI Briefing 쿼리 내부에서 apiClient.get('task_cards') 직접 조회 금지
        // studentTaskCards에서 risk 타입 카드를 파생하여 사용 (라인 299 이후 useMemo에서 처리)
      } catch (error) {
        console.error('Failed to generate AI briefing cards:', error);
        // 에러 발생 시 빈 배열 반환
      }

      // 모든 AI Briefing 카드 반환 (제한 없음, UI에서 모든 카드 출력)
      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 300000, // 5분마다 갱신
    staleTime: 120000, // 2분간 캐시 유지
    gcTime: 300000, // 5분간 가비지 컬렉션 방지
  });

  // 오늘 요일 계산 (기술문서 5-2: KST 기준 날짜 처리)
  const todayDayOfWeek = useMemo<DayOfWeek>(() => {
    const todayKST = toKST();
    const dayOfWeek = todayKST.day(); // 0(일) ~ 6(토)
    const dayOfWeekMap: Record<number, DayOfWeek> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return dayOfWeekMap[dayOfWeek];
  }, []);

  // 오늘 수업 반 목록 조회
  const { data: todayClassesData } = useClasses({
    day_of_week: todayDayOfWeek,
    status: 'active',
  });

  // 오늘 날짜의 출석 데이터 조회
  const todayDate = useMemo(() => toKST().format('YYYY-MM-DD'), []);

  // 정본 규칙: apiClient.get('attendance_logs') 직접 조회 제거, useAttendanceLogs Hook 사용
  const todayDateKST = toKST();
  const { data: todayAttendanceLogs } = useAttendanceLogs({
    date_from: todayDateKST.startOf('day').toISOString(),
    date_to: todayDateKST.endOf('day').toISOString(),
    attendance_type: 'check_in',
  });

  // 오늘 수업의 출석 데이터 조회 및 ClassCard 변환
  const todayClasses = useMemo<ClassCard[]>(() => {
    if (!todayClassesData || todayClassesData.length === 0) return [];

    return todayClassesData.map((cls) => {
      // 오늘 날짜의 출석 데이터에서 해당 반의 출석 수 계산
      const logs = (todayAttendanceLogs || []) as unknown as AttendanceLog[];
      const attendanceCount = logs.filter((log: AttendanceLog) =>
        log.class_id === cls.id && log.status === 'present'
      ).length;
      const studentCount = cls.current_count || 0;

      return {
        id: cls.id,
        type: 'class' as const,
        class_name: cls.name,
        start_time: cls.start_time,
        student_count: studentCount,
        attendance_count: attendanceCount,
        action_url: `/attendance?class_id=${cls.id}`,
      };
    });
  }, [todayClassesData, todayAttendanceLogs]);

  // Stats Cards 조회 (학생 수, 출석률, 매출 등)
  const { data: statsCards } = useQuery({
    queryKey: ['stats-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: StatsCard[] = [];
      const currentMonth = toKST();
      const currentMonthStr = currentMonth.format('YYYY-MM');
      const lastMonth = currentMonth.clone().subtract(1, 'month');
      const lastMonthStr = lastMonth.format('YYYY-MM');
      // 성능 최적화: 날짜 계산을 한 번만 수행하여 재사용
      const lastMonthEnd = lastMonth.endOf('month').toISOString();
      const lastMonthStart = lastMonth.startOf('month').format('YYYY-MM-DD');
      const currentMonthEnd = currentMonth.endOf('month').toISOString();
      const currentMonthEndDate = new Date(currentMonthEnd);
      const sevenDaysAgo = toKST().subtract(7, 'days');
      const sevenDaysAgoStr = sevenDaysAgo.format('YYYY-MM-DD');
      const sevenDaysAgoISO = sevenDaysAgo.startOf('day').toISOString();
      const fourteenDaysAgo = toKST().subtract(14, 'days');
      const fourteenDaysAgoStr = fourteenDaysAgo.format('YYYY-MM-DD');
      const fourteenDaysAgoISO = fourteenDaysAgo.startOf('day').toISOString();

      // 성능 최적화: studentStats를 외부 변수로 저장하여 재사용
      let studentStatsCache: Awaited<ReturnType<typeof fetchStudentStats>> | null = null;

      // 성능 최적화: 트렌드 계산 헬퍼 함수
      const calculateTrend = (current: number, lastMonth: number): string | undefined => {
        if (lastMonth > 0) {
          const change = current - lastMonth;
          const percent = Math.round((change / lastMonth) * 100);
          return `${change > 0 ? '+' : ''}${percent}%`;
        }
        return current > 0 ? '+100%' : undefined;
      };

      // 1. 학생 수 통계
      // 정본 규칙: fetchPersons 함수 사용 (Hook의 queryFn 로직 재사용)
      // 성능 최적화: 병렬 호출
      const [students, lastMonthStudents] = await Promise.all([
        fetchPersons(tenantId, {
          person_type: 'student',
        }),
        fetchPersons(tenantId, {
          person_type: 'student',
          created_at: { lte: lastMonthEnd },
        }),
      ]);
      const studentCount = students?.length || 0;
      const lastMonthStudentCount = lastMonthStudents?.length || 0;
      const studentTrend = calculateTrend(studentCount, lastMonthStudentCount);

      cards.push({
        id: 'stats-students',
        type: 'stats',
        title: '전체 학생 수',
        value: studentCount.toString(),
        unit: '명',
        trend: studentTrend,
        action_url: '/students/list',
        chartDataKey: 'student_count',
      });

      // 2. 학생 통계 (신규 등록, 활성/비활성)
      // 정본 규칙: fetchStudentStats 함수 사용 (Hook의 queryFn 로직 재사용)
      // 성능 최적화: 병렬 호출 및 중복 제거
      try {
        const [studentStats, lastMonthNewStudents, lastMonthActiveStudents, lastMonthInactiveStudents] = await Promise.all([
          fetchStudentStats(tenantId),
          fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: lastMonthStart, lte: lastMonthEnd },
          }),
          fetchStudents(tenantId, {
            status: 'active',
          }),
          fetchStudents(tenantId, {
            status: 'withdrawn',
          }),
        ]);
        // 성능 최적화: studentStats를 캐시에 저장하여 3-2 섹션에서 재사용
        studentStatsCache = studentStats;
        const lastMonthNewCount = lastMonthNewStudents?.length || 0;
        const newStudentsTrend = calculateTrend(studentStats.new_this_month, lastMonthNewCount);

        const lastMonthActiveCount = lastMonthActiveStudents?.length || 0;
        const activeTrend = calculateTrend(studentStats.active, lastMonthActiveCount);

        const lastMonthInactiveCount = lastMonthInactiveStudents?.length || 0;
        const inactiveTrend = calculateTrend(studentStats.inactive, lastMonthInactiveCount);

        cards.push({
          id: 'stats-new-students',
          type: 'stats',
          title: '이번 달 신규 등록',
          value: studentStats.new_this_month.toString(),
          unit: '명',
          trend: newStudentsTrend,
          action_url: '/students/list',
          chartDataKey: 'new_enrollments',
        });
        cards.push({
          id: 'stats-active-students',
          type: 'stats',
          title: '활성 학생 수',
          value: studentStats.active.toString(),
          unit: '명',
          trend: activeTrend,
          action_url: '/students/list',
          chartDataKey: 'active_student_count',
        });
        cards.push({
          id: 'stats-inactive-students',
          type: 'stats',
          title: '비활성 학생 수',
          value: studentStats.inactive.toString(),
          unit: '명',
          trend: inactiveTrend,
          action_url: '/students/list',
          chartDataKey: 'inactive_student_count',
        });
      } catch (error) {
        console.error('Failed to fetch student stats:', error);
        // 에러 발생 시에도 기본값으로 카드 추가
        cards.push({
          id: 'stats-new-students',
          type: 'stats',
          title: '이번 달 신규 등록',
          value: '0',
          unit: '명',
          trend: undefined,
          action_url: '/students/list',
          chartDataKey: 'new_enrollments',
        });
        cards.push({
          id: 'stats-active-students',
          type: 'stats',
          title: '활성 학생 수',
          value: '0',
          unit: '명',
          trend: undefined,
          action_url: '/students/list',
          chartDataKey: 'active_student_count',
        });
        cards.push({
          id: 'stats-inactive-students',
          type: 'stats',
          title: '비활성 학생 수',
          value: '0',
          unit: '명',
          trend: undefined,
          action_url: '/students/list',
          chartDataKey: 'inactive_student_count',
        });
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
        cards.push({
          id: 'stats-student-growth',
          type: 'stats',
          title: '월간 학생 성장률',
          value: `${growthRate > 0 ? '+' : ''}${growthRate}`,
          unit: '%',
          action_url: '/students/list',
        });
      } catch (error) {
        console.error('Failed to calculate student growth rate:', error);
        // 에러 발생 시에도 기본값으로 카드 추가
        cards.push({
          id: 'stats-student-growth',
          type: 'stats',
          title: '월간 학생 성장률',
          value: '0',
          unit: '%',
          action_url: '/students/list',
        });
      }

      // 3-1. 이번 주 신규 등록
      // 성능 최적화: 병렬 호출 및 날짜 계산 재사용
      try {
        const [weeklyNewStudents, lastWeekNewStudents] = await Promise.all([
          fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: sevenDaysAgoISO },
          }),
          fetchPersons(tenantId, {
            person_type: 'student',
            created_at: { gte: fourteenDaysAgoISO, lte: sevenDaysAgoISO },
          }),
        ]);
        const weeklyNewCount = weeklyNewStudents?.length || 0;
        const lastWeekNewCount = lastWeekNewStudents?.length || 0;
        const weeklyNewTrend = calculateTrend(weeklyNewCount, lastWeekNewCount);

        cards.push({
          id: 'stats-weekly-new-students',
          type: 'stats',
          title: '이번 주 신규 등록',
          value: weeklyNewCount.toString(),
          unit: '명',
          trend: weeklyNewTrend,
          action_url: '/students/list',
          chartDataKey: 'new_enrollments',
        });
      } catch (error) {
        console.error('Failed to calculate weekly new students:', error);
        cards.push({
          id: 'stats-weekly-new-students',
          type: 'stats',
          title: '이번 주 신규 등록',
          value: '0',
          unit: '명',
          trend: undefined,
          action_url: '/students/list',
          chartDataKey: 'new_enrollments',
        });
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
          } catch {
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
        const lastMonthTotalCount = lastMonthStudentCount; // 이미 조회한 값 재사용
        // ⚠️ 주의: 전월 유지율은 "추정치"입니다
        // - 전월 활성 학생 수는 전월 전체 학생 수와 현재 활성 학생 수를 비교하여 추정
        // - 정확한 전월 활성 학생 수는 별도 조회가 필요하므로, 현재 활성 학생 수를 기준으로 트렌드 계산
        // - 논리적 한계: 전월 활성 학생 수와 현재 활성 학생 수가 다를 수 있어 트렌드가 부정확할 수 있음
        // - 정확한 계산을 위해서는 전월 시점의 activeCount를 별도 조회해야 함
        const lastMonthRetentionRate = lastMonthTotalCount > 0 && lastMonthTotalCount >= activeCount
          ? Math.round((activeCount / lastMonthTotalCount) * 100)
          : 0;
        const retentionTrend = lastMonthRetentionRate > 0 && lastMonthRetentionRate !== retentionRate
          ? `${retentionRate > lastMonthRetentionRate ? '+' : ''}${Math.round(((retentionRate - lastMonthRetentionRate) / lastMonthRetentionRate) * 100)}%`
          : undefined;

        cards.push({
          id: 'stats-student-retention-rate',
          type: 'stats',
          title: '학생 유지율',
          value: retentionRate.toString(),
          unit: '%',
          trend: retentionTrend,
          action_url: '/students/list',
          chartDataKey: 'active_student_count',
        });
      } catch (error) {
        console.error('Failed to calculate student retention rate:', error);
        cards.push({
          id: 'stats-student-retention-rate',
          type: 'stats',
          title: '학생 유지율',
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: '/students/list',
          chartDataKey: 'active_student_count',
        });
      }

      // 4. 출석 통계 (출석률, 지각률, 결석률)
      // 정본 규칙: fetchAttendanceStats 함수 사용 (Hook의 queryFn 로직 재사용)
      // 성능 최적화: 병렬 호출
      try {
        // KST 기준 날짜 객체 생성 (fetchAttendanceStats는 Date 타입을 받고 내부에서 KST 변환)
        const todayKST = toKST();
        const todayDateForStats = new Date(todayKST.format('YYYY-MM-DD') + 'T00:00:00+09:00');
        const yesterdayKST = todayKST.clone().subtract(1, 'day');
        const yesterdayDateForStats = new Date(yesterdayKST.format('YYYY-MM-DD') + 'T00:00:00+09:00');
        const [attendanceStatsResult, yesterdayAttendanceStatsResult] = await Promise.allSettled([
          fetchAttendanceStats(tenantId, todayDateForStats),
          fetchAttendanceStats(tenantId, yesterdayDateForStats),
        ]);
        const attendanceStats = attendanceStatsResult.status === 'fulfilled' ? attendanceStatsResult.value : null;
        const yesterdayAttendanceStats = yesterdayAttendanceStatsResult.status === 'fulfilled' ? yesterdayAttendanceStatsResult.value : null;

        if (!attendanceStats) {
          throw new Error('Failed to fetch attendance stats');
        }

        const attendanceTrend = yesterdayAttendanceStats && yesterdayAttendanceStats.attendance_rate > 0
          ? `${attendanceStats.attendance_rate > yesterdayAttendanceStats.attendance_rate ? '+' : ''}${Math.round(((attendanceStats.attendance_rate - yesterdayAttendanceStats.attendance_rate) / yesterdayAttendanceStats.attendance_rate) * 100)}%`
          : undefined;

        const yesterdayLateRate = yesterdayAttendanceStats && yesterdayAttendanceStats.total_students > 0
          ? Math.round((yesterdayAttendanceStats.late / yesterdayAttendanceStats.total_students) * 100)
          : 0;
        const lateRate = attendanceStats.total_students > 0
          ? Math.round((attendanceStats.late / attendanceStats.total_students) * 100)
          : 0;
        const lateTrend = yesterdayLateRate > 0
          ? `${lateRate > yesterdayLateRate ? '+' : ''}${Math.round(((lateRate - yesterdayLateRate) / yesterdayLateRate) * 100)}%`
          : undefined;

        const yesterdayAbsentRate = yesterdayAttendanceStats && yesterdayAttendanceStats.total_students > 0
          ? Math.round((yesterdayAttendanceStats.absent / yesterdayAttendanceStats.total_students) * 100)
          : 0;
        const absentRate = attendanceStats.total_students > 0
          ? Math.round((attendanceStats.absent / attendanceStats.total_students) * 100)
          : 0;
        const absentTrend = yesterdayAbsentRate > 0
          ? `${absentRate > yesterdayAbsentRate ? '+' : ''}${Math.round(((absentRate - yesterdayAbsentRate) / yesterdayAbsentRate) * 100)}%`
          : undefined;

        cards.push({
          id: 'stats-attendance-rate',
          type: 'stats',
          title: '오늘 출석률',
          value: attendanceStats.attendance_rate.toFixed(1),
          unit: '%',
          trend: attendanceTrend,
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        });
        cards.push({
          id: 'stats-late-rate',
          type: 'stats',
          title: '오늘 지각률',
          value: lateRate.toString(),
          unit: '%',
          trend: lateTrend,
          action_url: '/attendance',
          chartDataKey: 'late_rate',
        });
        cards.push({
          id: 'stats-absent-rate',
          type: 'stats',
          title: '오늘 결석률',
          value: absentRate.toString(),
          unit: '%',
          trend: absentTrend,
          action_url: '/attendance',
          chartDataKey: 'absent_rate',
        });
      } catch (error) {
        console.error('Failed to fetch attendance stats:', error);
        // 에러 발생 시에도 기본값으로 카드 추가
        cards.push({
          id: 'stats-attendance-rate',
          type: 'stats',
          title: '오늘 출석률',
          value: '0.0',
          unit: '%',
          trend: undefined,
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        });
        cards.push({
          id: 'stats-late-rate',
          type: 'stats',
          title: '오늘 지각률',
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: '/attendance',
          chartDataKey: 'late_rate',
        });
        cards.push({
          id: 'stats-absent-rate',
          type: 'stats',
          title: '오늘 결석률',
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: '/attendance',
          chartDataKey: 'absent_rate',
        });
      }

      // 5. 이번 주 평균 출석률
      // 성능 최적화: 병렬 호출 및 날짜 계산 재사용
      try {
        // 출석 통계 계산은 check_in 로그만 사용 (정확한 출석률 계산)
        const [weeklyLogs, lastWeekLogs] = await Promise.all([
          fetchAttendanceLogs(tenantId, {
            date_from: sevenDaysAgoISO,
            attendance_type: 'check_in', // 등원 로그만 사용
          }),
          fetchAttendanceLogs(tenantId, {
            date_from: fourteenDaysAgoISO,
            date_to: sevenDaysAgo.endOf('day').toISOString(), // 전주 범위: 14일 전 시작 ~ 7일 전 종료 (inclusive)
            attendance_type: 'check_in', // 등원 로그만 사용
          }),
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
        const weeklyTrend = calculateTrend(weeklyAttendanceRate, lastWeekAttendanceRate);

        cards.push({
          id: 'stats-weekly-attendance',
          type: 'stats',
          title: '이번 주 평균 출석률',
          value: weeklyAttendanceRate.toString(),
          unit: '%',
          trend: weeklyTrend,
          action_url: '/attendance',
        });
      } catch (error) {
        console.error('Failed to calculate weekly attendance rate:', error);
        // 에러 발생 시에도 기본값으로 카드 추가
        cards.push({
          id: 'stats-weekly-attendance',
          type: 'stats',
          title: '이번 주 평균 출석률',
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: '/attendance',
        });
      }

      // 5-1. 이번 달 평균 출석률 & 5-2. 출석률 개선율 (전월 대비)
      // 성능 최적화: 병렬 호출 및 중복 제거 (5-1과 5-2 통합, 날짜 계산 재사용)
      try {
        // 출석 통계 계산은 check_in 로그만 사용 (정확한 출석률 계산)
        const [monthlyLogs, lastMonthLogs] = await Promise.all([
          fetchAttendanceLogs(tenantId, {
            date_from: currentMonth.startOf('month').toISOString(),
            attendance_type: 'check_in', // 등원 로그만 사용
          }),
          fetchAttendanceLogs(tenantId, {
            date_from: lastMonth.startOf('month').toISOString(),
            date_to: lastMonth.endOf('month').toISOString(), // 전월 범위: 전월 시작 ~ 전월 종료 (inclusive)
            attendance_type: 'check_in', // 등원 로그만 사용
          }),
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
        const monthlyTrend = calculateTrend(monthlyAttendanceRate, lastMonthAttendanceRate);

        cards.push({
          id: 'stats-monthly-attendance-rate',
          type: 'stats',
          title: '이번 달 평균 출석률',
          value: monthlyAttendanceRate.toString(),
          unit: '%',
          trend: monthlyTrend,
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        });

        // 5-2. 출석률 개선율 계산 (동일한 데이터 재사용)
        const currentMonthRate = monthlyAttendanceRate; // 위에서 계산한 값 재사용
        const lastMonthRate = lastMonthAttendanceRate; // 위에서 계산한 값 재사용
        const improvementRate = lastMonthRate > 0
          ? Math.round(((currentMonthRate - lastMonthRate) / lastMonthRate) * 100)
          : currentMonthRate > 0 ? 100 : 0;

        cards.push({
          id: 'stats-attendance-improvement-rate',
          type: 'stats',
          title: '출석률 개선율',
          value: `${improvementRate > 0 ? '+' : ''}${improvementRate}`,
          unit: '%',
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        });
      } catch (error) {
        console.error('Failed to calculate monthly attendance rate and improvement rate:', error);
        // 에러 발생 시에도 기본값으로 카드 추가
        cards.push({
          id: 'stats-monthly-attendance-rate',
          type: 'stats',
          title: '이번 달 평균 출석률',
          value: '0',
          unit: '%',
          trend: undefined,
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        });
        cards.push({
          id: 'stats-attendance-improvement-rate',
          type: 'stats',
          title: '출석률 개선율',
          value: '0',
          unit: '%',
          action_url: '/attendance',
          chartDataKey: 'attendance_rate',
        });
      }

      // 6. 이번 달 매출 통계
      // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
      // 성능 최적화: 병렬 호출 및 reduce 중복 제거
      const nextMonthStartDateForStats = toKST().add(1, 'month').startOf('month');
      const currentMonthEndDateForStats = nextMonthStartDateForStats.clone().subtract(1, 'day').endOf('day');
      const currentMonthStartDateForStats = toKST().startOf('month');
      const lastMonthEndDateForStats = currentMonthStartDateForStats.clone().subtract(1, 'day').endOf('day');
      const [invoices, lastMonthInvoices] = await Promise.all([
        fetchBillingHistory(tenantId, {
          period_start: { gte: `${currentMonthStr}-01`, lte: currentMonthEndDateForStats.format('YYYY-MM-DD') },
        }),
        fetchBillingHistory(tenantId, {
          period_start: { gte: `${lastMonthStr}-01`, lte: lastMonthEndDateForStats.format('YYYY-MM-DD') },
        }),
      ]);

      // 성능 최적화: invoices를 한 번만 순회하여 모든 값 계산
      let totalRevenue = 0;
      let expectedRevenue = 0;
      let totalAmount = 0;
      let unpaidAmount = 0;
      if (invoices && invoices.length > 0) {
        invoices.forEach((inv: BillingHistoryItem) => {
          totalRevenue += inv.amount_paid || 0;
          expectedRevenue += inv.amount || 0;
          totalAmount += inv.amount || 0;
          if (inv.status === 'pending' || inv.status === 'overdue') {
            unpaidAmount += (inv.amount || 0) - (inv.amount_paid || 0);
          }
        });
      }

      // 성능 최적화: lastMonthInvoices를 한 번만 순회하여 모든 값 계산
      let lastMonthRevenue = 0;
      let lastMonthExpectedRevenue = 0;
      let lastMonthTotalAmount = 0;
      let lastMonthUnpaidAmount = 0;
      if (lastMonthInvoices && lastMonthInvoices.length > 0) {
        lastMonthInvoices.forEach((inv: BillingHistoryItem) => {
          lastMonthRevenue += inv.amount_paid || 0;
          lastMonthExpectedRevenue += inv.amount || 0;
          lastMonthTotalAmount += inv.amount || 0;
          if (inv.status === 'pending' || inv.status === 'overdue') {
            lastMonthUnpaidAmount += (inv.amount || 0) - (inv.amount_paid || 0);
          }
        });
      }

      const revenueTrend = lastMonthRevenue > 0
        ? `${totalRevenue > lastMonthRevenue ? '+' : ''}${Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)}%`
        : totalRevenue > 0 ? '+100%' : undefined;

      cards.push({
        id: 'stats-revenue',
        type: 'stats',
        title: '이번 달 매출',
        value: totalRevenue.toLocaleString(),
        unit: '원',
        trend: revenueTrend,
        action_url: '/billing/home',
        chartDataKey: 'revenue',
      });

      // 7. 예정 매출
      const expectedRevenueTrend = calculateTrend(expectedRevenue, lastMonthExpectedRevenue);

      cards.push({
        id: 'stats-expected-revenue',
        type: 'stats',
        title: '이번 달 예정 매출',
        value: expectedRevenue.toLocaleString(),
        unit: '원',
        trend: expectedRevenueTrend,
        action_url: '/billing/home',
      });

      // 8. ARPU (학생 1인당 평균 매출)
      const arpu = studentCount > 0
        ? Math.round(totalRevenue / studentCount)
        : 0;
      const lastMonthArpu = lastMonthStudentCount > 0
        ? Math.round(lastMonthRevenue / lastMonthStudentCount)
        : 0;
      const arpuTrend = calculateTrend(arpu, lastMonthArpu);

      cards.push({
        id: 'stats-arpu',
        type: 'stats',
        title: 'ARPU (학생 1인당 매출)',
        value: arpu.toLocaleString(),
        unit: '원',
        trend: arpuTrend,
        action_url: '/billing/home',
        chartDataKey: 'arpu',
      });

      // 9. 월간 매출 성장률
      try {
        const revenueGrowthRate = lastMonthRevenue > 0
          ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
          : totalRevenue > 0 ? 100 : 0;
        cards.push({
          id: 'stats-revenue-growth',
          type: 'stats',
          title: '월간 매출 성장률',
          value: `${revenueGrowthRate > 0 ? '+' : ''}${revenueGrowthRate}`,
          unit: '%',
          action_url: '/billing/home',
        });
      } catch (error) {
        console.error('Failed to calculate revenue growth rate:', error);
        // 에러 발생 시에도 기본값으로 카드 추가
        cards.push({
          id: 'stats-revenue-growth',
          type: 'stats',
          title: '월간 매출 성장률',
          value: '0',
          unit: '%',
          action_url: '/billing/home',
        });
      }

      // 9-1. 이번 주 매출
      // 성능 최적화: 병렬 호출 및 날짜 계산 재사용
      try {
        const [weeklyInvoices, lastWeekInvoices] = await Promise.all([
          fetchBillingHistory(tenantId, {
            period_start: { gte: sevenDaysAgoStr },
          }),
          fetchBillingHistory(tenantId, {
            period_start: { gte: fourteenDaysAgoStr, lte: sevenDaysAgo.endOf('day').format('YYYY-MM-DD') },
          }),
        ]);
        // 성능 최적화: reduce를 한 번만 수행 (현재는 각각 한 번씩만 호출되므로 최적화 완료)
        const weeklyRevenue = weeklyInvoices?.reduce((sum: number, inv: BillingHistoryItem) => {
          return sum + (inv.amount_paid || 0);
        }, 0) || 0;
        const lastWeekRevenue = lastWeekInvoices?.reduce((sum: number, inv: BillingHistoryItem) => {
          return sum + (inv.amount_paid || 0);
        }, 0) || 0;
        const weeklyRevenueTrend = calculateTrend(weeklyRevenue, lastWeekRevenue);

        cards.push({
          id: 'stats-weekly-revenue',
          type: 'stats',
          title: '이번 주 매출',
          value: weeklyRevenue.toLocaleString(),
          unit: '원',
          trend: weeklyRevenueTrend,
          action_url: '/billing/home',
          chartDataKey: 'revenue',
        });
      } catch (error) {
        console.error('Failed to calculate weekly revenue:', error);
        cards.push({
          id: 'stats-weekly-revenue',
          type: 'stats',
          title: '이번 주 매출',
          value: '0',
          unit: '원',
          trend: undefined,
          action_url: '/billing/home',
          chartDataKey: 'revenue',
        });
      }

      // 9-2. 평균 청구 금액
      try {
        const invoiceCount = invoices?.length || 0;
        const avgInvoiceAmount = invoiceCount > 0
          ? Math.round(expectedRevenue / invoiceCount)
          : 0;

        // 전월 평균 청구 금액 조회 (트렌드 계산용)
        const lastMonthInvoiceCount = lastMonthInvoices?.length || 0;
        const lastMonthAvgInvoiceAmount = lastMonthInvoiceCount > 0
          ? Math.round(lastMonthExpectedRevenue / lastMonthInvoiceCount)
          : 0;
        const avgInvoiceTrend = calculateTrend(avgInvoiceAmount, lastMonthAvgInvoiceAmount);

        cards.push({
          id: 'stats-avg-invoice-amount',
          type: 'stats',
          title: '평균 청구 금액',
          value: avgInvoiceAmount.toLocaleString(),
          unit: '원',
          trend: avgInvoiceTrend,
          action_url: '/billing/home',
        });
      } catch (error) {
        console.error('Failed to calculate average invoice amount:', error);
        cards.push({
          id: 'stats-avg-invoice-amount',
          type: 'stats',
          title: '평균 청구 금액',
          value: '0',
          unit: '원',
          trend: undefined,
          action_url: '/billing/home',
        });
      }

      // 10. 미납률
      // 성능 최적화: 이미 계산한 totalAmount, unpaidAmount, lastMonthTotalAmount, lastMonthUnpaidAmount 재사용
      const unpaidRate = totalAmount > 0
        ? Math.round((unpaidAmount / totalAmount) * 100)
        : 0;
      const lastMonthUnpaidRate = lastMonthTotalAmount > 0
        ? Math.round((lastMonthUnpaidAmount / lastMonthTotalAmount) * 100)
        : 0;
      const unpaidTrend = calculateTrend(unpaidRate, lastMonthUnpaidRate);

      cards.push({
        id: 'stats-unpaid-rate',
        type: 'stats',
        title: '미납률',
        value: unpaidRate.toString(),
        unit: '%',
        trend: unpaidTrend,
        action_url: '/billing/home',
      });

      // 11. 반당 평균 인원
      // 성능 최적화: 중복 제거 (classes를 한 번만 조회하고 재사용)
      try {
        // fetchClasses는 날짜 필터를 지원하지 않으므로, 현재 활성 반만 조회 가능
        // 전월 반 데이터는 별도 조회가 불가능하므로, 현재 반 데이터를 재사용
        const classes = await fetchClasses(tenantId, { status: 'active' });
        const classCount = classes?.length || 0;
        const avgStudentsPerClass = classCount > 0 && studentCount > 0
          ? Math.round(studentCount / classCount)
          : 0;

        // 전월 반 데이터는 조회 불가능하므로, 현재 반 데이터를 재사용 (트렌드 계산은 근사치)
        const lastMonthClasses = classes; // 동일한 데이터 재사용
        const lastMonthClassCount = lastMonthClasses?.length || 0;
        const lastMonthAvgStudentsPerClass = lastMonthClassCount > 0 && lastMonthStudentCount > 0
          ? Math.round(lastMonthStudentCount / lastMonthClassCount)
          : 0;
        const avgStudentsTrend = lastMonthAvgStudentsPerClass > 0
          ? `${avgStudentsPerClass > lastMonthAvgStudentsPerClass ? '+' : ''}${Math.round(((avgStudentsPerClass - lastMonthAvgStudentsPerClass) / lastMonthAvgStudentsPerClass) * 100)}%`
          : avgStudentsPerClass > 0 ? '+100%' : undefined;

        cards.push({
          id: 'stats-avg-students-per-class',
          type: 'stats',
          title: '반당 평균 인원',
          value: avgStudentsPerClass.toString(),
          unit: '명',
          trend: avgStudentsTrend,
          action_url: '/classes/list',
          chartDataKey: 'avg_students_per_class',
        });

        // 12. 평균 정원률
        // 성능 최적화: classes와 lastMonthClasses가 동일 데이터이므로 한 번만 순회하여 두 값 모두 계산
        let totalCapacity = 0;
        let totalCurrent = 0;
        let lastMonthTotalCapacity = 0;
        let lastMonthTotalCurrent = 0;
        if (classes && classes.length > 0) {
          classes.forEach((cls) => {
            if (cls.capacity && cls.capacity > 0) {
              totalCapacity += cls.capacity;
              totalCurrent += cls.current_count || 0;
              // lastMonthClasses는 classes와 동일하므로 동일한 값 사용
              lastMonthTotalCapacity += cls.capacity;
              lastMonthTotalCurrent += cls.current_count || 0;
            }
          });
        }
        const avgCapacityRate = totalCapacity > 0
          ? Math.round((totalCurrent / totalCapacity) * 100)
          : 0;
        const lastMonthAvgCapacityRate = lastMonthTotalCapacity > 0
          ? Math.round((lastMonthTotalCurrent / lastMonthTotalCapacity) * 100)
          : 0;
        const avgCapacityTrend = calculateTrend(avgCapacityRate, lastMonthAvgCapacityRate);

        cards.push({
          id: 'stats-avg-capacity-rate',
          type: 'stats',
          title: '평균 정원률',
          value: avgCapacityRate.toString(),
          unit: '%',
          trend: avgCapacityTrend,
          action_url: '/classes/list',
          chartDataKey: 'avg_capacity_rate',
        });
      } catch (error) {
        console.error('Failed to calculate class statistics:', error);
      }

      // 13. 평균 수납 기간 (청구일 ~ 수납일 평균 일수)
      // 성능 최적화: 필터링과 계산을 한 번의 순회로 통합, Date 객체 생성 최적화
      try {
        let totalDays = 0;
        let paidCount = 0;
        const oneDayMs = 1000 * 60 * 60 * 24;
        if (invoices && invoices.length > 0) {
          invoices.forEach((inv: BillingHistoryItem) => {
            if (inv.status === 'paid' && inv.amount_paid > 0 && inv.period_start && inv.updated_at) {
              const periodStart = new Date(inv.period_start).getTime();
              const paidDate = new Date(inv.updated_at).getTime();
              const daysDiff = Math.max(0, Math.round((paidDate - periodStart) / oneDayMs));
              totalDays += daysDiff;
              paidCount++;
            }
          });
        }
        const avgCollectionPeriod = paidCount > 0
          ? Math.round(totalDays / paidCount)
          : 0;
        cards.push({
          id: 'stats-avg-collection-period',
          type: 'stats',
          title: '평균 수납 기간',
          value: avgCollectionPeriod.toString(),
          unit: '일',
          action_url: '/billing/home',
        });
      } catch (error) {
        console.error('Failed to calculate average collection period:', error);
        // 에러 발생 시에도 0일로 표시
        cards.push({
          id: 'stats-avg-collection-period',
          type: 'stats',
          title: '평균 수납 기간',
          value: '0',
          unit: '일',
          action_url: '/billing/home',
        });
      }

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 300000, // 5분마다 갱신
    staleTime: 60000, // 1분간 캐시 유지
    gcTime: 300000, // 5분간 가비지 컬렉션 방지
  });

  // Billing Summary 조회
  const { data: billingSummary } = useQuery({
    queryKey: ['billing-summary', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const currentMonth = toKST().format('YYYY-MM');
      const nextMonthStartDateForBilling = toKST().add(1, 'month').startOf('month');
      const currentMonthEndDateForBilling = nextMonthStartDateForBilling.clone().subtract(1, 'day').endOf('day');

      // 이번 달 청구서 조회
      // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
      const invoices = await fetchBillingHistory(tenantId, {
        period_start: { gte: `${currentMonth}-01`, lte: currentMonthEndDateForBilling.format('YYYY-MM-DD') },
      });

      if (!invoices || invoices.length === 0) {
        return null;
      }
      const totalAmount = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
      const paidAmount = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);
      const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
      const unpaidCount = invoices.filter((inv: BillingHistoryItem) => inv.status === 'pending' || inv.status === 'overdue').length;

      return {
        id: 'billing-summary',
        type: 'billing_summary' as const,
        title: '이번 달 수납 현황',
        expected_collection_rate: expectedCollectionRate,
        unpaid_count: unpaidCount,
        action_url: '/billing/home',
        priority: 50, // 기본 우선순위 (월말 가중치 적용 전)
      } as BillingSummaryCard;
    },
    enabled: !!tenantId,
    refetchInterval: 300000, // 5분마다 갱신
    staleTime: 60000, // 1분간 캐시 유지
    gcTime: 300000, // 5분간 가비지 컬렉션 방지
  });

  // 정본 규칙: AI Briefing 쿼리 내부에서 task_cards 직접 조회 제거
  // studentTaskCards에서 risk 카드를 파생하여 AI Briefing 카드에 합성
  const enhancedAiBriefingCards = useMemo(() => {
    if (!aiBriefingCards || !studentTaskCards) return aiBriefingCards || [];

    // studentTaskCards에서 risk 타입 카드 찾기
    const riskCards = studentTaskCards.filter((card) => card.task_type === 'risk' && card.action_url);
    const riskCount = riskCards.length;

    if (riskCount > 0) {
      // 첫 번째 risk 카드의 action_url 사용 (서버에서 제공된 값)
      const firstRiskCard = riskCards[0];
      const riskActionUrl = firstRiskCard?.action_url;

      if (riskActionUrl) {
        // 이탈 위험 학생 알림 카드를 추가
        const riskBriefingCard: AIBriefingCard = {
          id: 'briefing-risk',
          type: 'ai_briefing',
          title: '이탈 위험 학생 알림',
          summary: `${riskCount}명의 학생이 이탈 위험 단계입니다.`,
          insights: [
            '이탈 위험 학생들에게 즉시 상담을 진행하세요.',
            '학생의 학습 동기를 높이기 위한 방안을 모색하세요.',
          ],
          created_at: toKST().toISOString(),
          action_url: riskActionUrl, // 정본: 서버에서 제공된 action_url 사용
        };

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
    // 정본 규칙: enhancedEmergencyCards 사용 (risk emergency가 맨 앞에 있어서 항상 포함됨)
    if (enhancedEmergencyCards && enhancedEmergencyCards.length > 0) {
      // Emergency 카드는 그룹 내부 정렬 없이 그대로 추가 (모든 카드 포함)
      cards.push(...enhancedEmergencyCards);
    } else {
      // 빈 Emergency 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      cards.push({
        id: `${EMPTY_CARD_ID_PREFIX}-emergency`,
        type: 'emergency',
        title: EMPTY_CARD_MESSAGES.EMERGENCY.TITLE,
        message: EMPTY_CARD_MESSAGES.EMERGENCY.MESSAGE,
        priority: 0,
      } as EmergencyCard);
    }

    // 2. AI Briefing Cards (생성 시간 기준 내림차순 정렬)
    // 정본 규칙: enhancedAiBriefingCards 사용
    // 성능 최적화: 문자열 비교로 최적화 (ISO 8601 형식은 문자열 비교 가능)
    if (enhancedAiBriefingCards && enhancedAiBriefingCards.length > 0) {
      const sortedBriefing = [...enhancedAiBriefingCards].sort((a, b) => {
        // ISO 8601 형식은 문자열 비교로 정렬 가능 (최신 우선)
        return b.created_at.localeCompare(a.created_at);
      });
      cards.push(...sortedBriefing);
    } else {
      // 빈 AI Briefing 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      cards.push({
        id: `${EMPTY_CARD_ID_PREFIX}-ai-briefing`,
        type: 'ai_briefing',
        title: EMPTY_CARD_MESSAGES.AI_BRIEFING.TITLE,
        summary: EMPTY_CARD_MESSAGES.AI_BRIEFING.SUMMARY,
        insights: [],
        created_at: toKST().toISOString(),
      } as AIBriefingCard);
    }

    // 3. Student Task Cards (priority 값 기준 내림차순 정렬)
    if (studentTaskCards && Array.isArray(studentTaskCards) && studentTaskCards.length > 0) {
      const sortedTasks = studentTaskCards.slice().sort((a, b) => {
        // priority가 높을수록(큰 수) 우선순위가 높음
        const priorityA = typeof a === 'object' && 'priority' in a ? Number(a.priority) || 0 : 0;
        const priorityB = typeof b === 'object' && 'priority' in b ? Number(b.priority) || 0 : 0;
        return priorityB - priorityA;
      });
      cards.push(...(sortedTasks as unknown as DashboardCard[]));
    } else {
      // 빈 Student Task 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      // 빈 Student Task 카드 생성 (정본 스키마 준수)
      // [불변 규칙] TaskCard 정본 스키마: entity_id, entity_type, action_url 필수
      cards.push({
        id: `${EMPTY_CARD_ID_PREFIX}-student-task`,
        task_type: 'ai_suggested',
        title: EMPTY_CARD_MESSAGES.STUDENT_TASK.TITLE,
        description: EMPTY_CARD_MESSAGES.STUDENT_TASK.DESCRIPTION,
        priority: 0,
        status: 'completed',
        created_at: toKST().toISOString(),
        expires_at: toKST().add(1, 'day').toISOString(), // TTL 만료 시점 (필수)
        entity_id: '', // 정본 필드 (빈 카드이므로 빈 문자열)
        entity_type: 'student', // 정본 필드
        action_url: '', // 정본 필드 (빈 카드이므로 빈 문자열)
        // 레거시 필드 (하위 호환성)
        student_id: null,
        student_name: null,
      } as unknown as DashboardCard);
    }

    // 4. Today Classes (수업 시작 시간 기준 오름차순 정렬)
    // 성능 최적화: 시간 문자열 직접 비교 (HH:MM 형식은 문자열 비교 가능)
    if (todayClasses && todayClasses.length > 0) {
      const sortedClasses = [...todayClasses].sort((a, b) => {
        // start_time이 HH:MM 형식이면 문자열 비교로 정렬 가능
        const timeA = a.start_time || '00:00';
        const timeB = b.start_time || '00:00';
        return timeA.localeCompare(timeB); // 빠른 시간 우선
      });
      cards.push(...sortedClasses);
    } else {
      // 빈 Class 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      cards.push({
        id: `${EMPTY_CARD_ID_PREFIX}-class`,
        type: 'class',
        class_name: EMPTY_CARD_MESSAGES.CLASS.CLASS_NAME,
        start_time: EMPTY_CARD_MESSAGES.CLASS.START_TIME,
        student_count: 0,
        attendance_count: 0,
        action_url: '',
      } as ClassCard);
    }

    // 5. Stats Cards (모든 카드 포함)
    if (statsCards && statsCards.length > 0) {
      cards.push(...statsCards);
    } else {
      // 빈 Stats 카드 생성 (최대 1개)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      cards.push({
        id: `${EMPTY_CARD_ID_PREFIX}-stats`,
        type: 'stats',
        title: EMPTY_CARD_MESSAGES.STATS.TITLE,
        value: EMPTY_CARD_MESSAGES.STATS.VALUE,
      } as StatsCard);
    }

    // 6. Billing Summary (최대 2개, Billing 그룹에 포함)
    // 아키텍처 문서 4647줄 참조: BILLING 그룹 최대 2개
    // 정본 규칙: 그룹 순서는 불변 (EMERGENCY > AI_BRIEFING > TASKS > CLASSES > STATS > BILLING), 월말에는 priority만 +2 (내부 정렬만 변동)
    // 프론트 자동화 문서 1.2.2 섹션 참조: 월말 priority 가중치 조정
    if (billingSummary) {
      // 월말에는 priority 가중치만 조정 (그룹 순서 불변)
      const adjustedBilling = {
        ...billingSummary,
        priority: (billingSummary.priority || 50) + (shouldPrioritizeBilling ? 2 : 0), // 정본: 0-100 스케일, 월말 +2 (프론트 자동화 문서 367줄, 559줄 참조)
      };
      cards.push(adjustedBilling);
      // BILLING 그룹에 추가 카드가 있을 수 있으므로, 최대 2개까지 허용
      // 현재는 billingSummary만 있지만, 향후 다른 Billing 카드가 추가될 수 있음
    } else {
      // 빈 Billing Summary 카드 생성 (1개만)
      // [불변 규칙] 하드코딩 금지, 상수 사용
      cards.push({
        id: `${EMPTY_CARD_ID_PREFIX}-billing`,
        type: 'billing_summary',
        title: EMPTY_CARD_MESSAGES.BILLING_SUMMARY.TITLE,
        expected_collection_rate: EMPTY_CARD_MESSAGES.BILLING_SUMMARY.EXPECTED_COLLECTION_RATE,
        unpaid_count: EMPTY_CARD_MESSAGES.BILLING_SUMMARY.UNPAID_COUNT,
        action_url: '/billing/home',
        priority: 0,
      } as BillingSummaryCard);
    }

    // 정본 규칙: 그룹 내부 priority 가중치 적용 (월말 등)
    // Billing 카드의 priority가 조정되었으므로, Billing 그룹 내부 정렬만 변동
    // 전체 그룹 순서는 불변: EMERGENCY > AI_BRIEFING > TASKS > CLASSES > STATS > BILLING

    // 모든 카드 반환 (제한 없음)
    return cards;
  }, [enhancedEmergencyCards, enhancedAiBriefingCards, studentTaskCards, todayClasses, statsCards, billingSummary, shouldPrioritizeBilling]);

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
              navigate(adaptiveNav.currentRecommendation!.action.target);
            }}
            onDismiss={adaptiveNav.dismissRecommendation}
          />
        )}

        {/* 카드 그리드 (항목별 그룹핑, briefing 2열, 그 외 3열) */}
        {(() => {
          // 카드를 타입별로 그룹핑 (우선순위 순서 유지)
          const emergencyCards = sortedCards.filter((card): card is EmergencyCard => 'type' in card && card.type === 'emergency');
          const aiBriefingCards = sortedCards.filter((card): card is AIBriefingCard => 'type' in card && card.type === 'ai_briefing');
          // 브리핑 섹션: 긴급 알림 + AI 브리핑 카드 통합
          const briefingCards = [...emergencyCards, ...aiBriefingCards];
          const taskCardsInView = sortedCards.filter((card) => 'task_type' in card);
          const classCards = sortedCards.filter((card): card is ClassCard => 'type' in card && card.type === 'class');
          const allStatsCards = sortedCards.filter((card): card is StatsCard => 'type' in card && card.type === 'stats');
          const billingCards = sortedCards.filter((card): card is BillingSummaryCard => 'type' in card && card.type === 'billing_summary');

          // 통계 카드를 카테고리별로 분류
          const attendanceStatsCards = allStatsCards.filter((card) =>
            card.id === 'stats-attendance-rate' ||
            card.id === 'stats-late-rate' ||
            card.id === 'stats-absent-rate' ||
            card.id === 'stats-weekly-attendance' ||
            card.id === 'stats-monthly-attendance-rate' ||
            card.id === 'stats-attendance-improvement-rate'
          );
          const studentGrowthStatsCards = allStatsCards.filter((card) =>
            card.id === 'stats-students' ||
            card.id === 'stats-new-students' ||
            card.id === 'stats-weekly-new-students' ||
            card.id === 'stats-active-students' ||
            card.id === 'stats-inactive-students' ||
            card.id === 'stats-student-growth' ||
            card.id === 'stats-student-retention-rate' ||
            card.id === 'stats-avg-students-per-class' ||
            card.id === 'stats-avg-capacity-rate'
          );
          const revenueStatsCards = allStatsCards.filter((card) =>
            card.id === 'stats-revenue' ||
            card.id === 'stats-expected-revenue' ||
            card.id === 'stats-arpu' ||
            card.id === 'stats-revenue-growth' ||
            card.id === 'stats-weekly-revenue' ||
            card.id === 'stats-avg-invoice-amount'
          );
          const collectionStatsCards = [
            ...billingCards, // 수납 현황 카드를 먼저 배치
            ...allStatsCards.filter((card) =>
              card.id === 'stats-unpaid-rate' ||
              card.id === 'stats-avg-collection-period'
            ),
          ];

          const groupedCards = [
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

          return (
            <div>
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
                      cards={group.cards.map((card) => renderCard(card, navigate, {
                        onChartClick: (card) => {
                          if ('type' in card && card.type === 'stats' && 'chartDataKey' in card && card.chartDataKey) {
                            setChartModalOpen({ cardId: card.id });
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
            </div>
          );
        })()}

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

