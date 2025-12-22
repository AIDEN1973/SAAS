/**
 * 홈 대시보드 페이지
 *
 * 아키텍처 문서 3.7.1 섹션 참조
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 *
 * 카드 우선순위:
 * 1. Emergency (긴급 알림)
 * 2. AI Briefing
 * 3. Student Tasks
 * 4. Classes
 * 5. Stats
 * 6. Billing Summary
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button, PageHeader, ContextRecommendationBanner } from '@ui-core/react';
import { Grid } from '@ui-core/react';
import { useStudentTaskCards, fetchConsultations, fetchPersons } from '@hooks/use-student';
import type { DashboardCard, EmergencyCard, AIBriefingCard, ClassCard, StatsCard, BillingSummaryCard } from '../types/dashboardCard';
import { useAdaptiveNavigation } from '@hooks/use-adaptive-navigation';
import { useMonthEndAdaptation } from '@hooks/use-month-end-adaptation';
import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useClasses } from '@hooks/use-class';
import { useAttendanceLogs, fetchAttendanceLogs } from '@hooks/use-attendance';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchAIInsights } from '@hooks/use-ai-insights';
import { fetchPayments } from '@hooks/use-payments';
import type { DayOfWeek } from '@services/class-service';
import { toKST } from '@lib/date-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { AttendanceLog } from '@services/attendance-service';
import type { StudentConsultation } from '@services/student-service';
import { renderCard } from '../utils/dashboardCardRenderer';

export function HomePage() {
  const navigate = useNavigate();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // Context Signals (상황 신호 수집 및 UI 조정)
  // 프론트 자동화 문서 1.2.1 섹션 참조: 자동 화면 전환 금지, 상황 신호 수집만 수행
  const adaptiveNav = useAdaptiveNavigation();

  // 월말 적응 (청구 카드 priority 가중치 조정)
  const { shouldPrioritizeBilling } = useMonthEndAdaptation();

  // Student Task Cards 조회
  const { data: studentTaskCards } = useStudentTaskCards();

  // Emergency Cards 조회 (결제 실패, 출결 오류, AI 위험 점수 기반)
  // 아키텍처 문서 4.6 섹션 참조: Emergency Card 표시 조건
  const { data: emergencyCards } = useQuery({
    queryKey: ['emergency-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: EmergencyCard[] = [];

      // 1. 결제 실패 2회 이상 체크 (아키텍처 문서 4747줄 참조)
      // 정본 규칙: fetchPayments 함수 사용 (Hook의 queryFn 로직 재사용)
      const failedPayments = await fetchPayments(tenantId, {
        status: 'failed',
      });

      if (failedPayments && failedPayments.length > 0) {
        const failedCount = failedPayments.length;
        if (failedCount >= 2) {
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

      // 2. 출결 오류 이벤트가 10분 이내 발생 체크 (아키텍처 문서 4747줄 참조)
      // 기술문서 5-2: KST 기준 날짜 처리
      // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
      const tenMinutesAgo = toKST().subtract(10, 'minute').toISOString();
      const attendanceErrors = await fetchAttendanceLogs(tenantId, {
        date_from: tenMinutesAgo,
        // TODO: 출결 오류 상태 필터링 (실제 테이블 구조에 맞게 조정 필요)
      });

      if (attendanceErrors && attendanceErrors.length > 0) {
        cards.push({
          id: 'attendance-error-emergency',
          type: 'emergency',
          title: '출결 오류 알림',
          message: '최근 10분 이내 출결 오류가 발생했습니다.',
          priority: 2,
          action_url: '/attendance',
        });
      }

      // 3. AI 위험 점수 90 이상 체크는 studentTaskCards에서 파생 (정본 규칙: task_cards 직접 조회 제거)
      // 정본 규칙: Emergency 쿼리 내부에서 apiClient.get('task_cards') 직접 조회 금지
      // studentTaskCards에서 risk 타입 카드를 파생하여 사용 (라인 138 이후 useMemo에서 처리)

      // 4. 시스템 오류 체크 (추가)
      // TODO: 시스템 오류 로그 테이블이 생성되면 실제 조회로 변경

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // 1분마다 갱신
  });

  // 정본 규칙: Emergency 쿼리 내부에서 task_cards 직접 조회 제거
  // studentTaskCards에서 risk 카드를 파생하여 Emergency 카드에 합성
  const enhancedEmergencyCards = useMemo(() => {
    if (!emergencyCards || !studentTaskCards) return emergencyCards || [];

    // studentTaskCards에서 priority >= 90인 risk 타입 카드 찾기
    const highRiskCard = studentTaskCards.find(
      (card) => card.task_type === 'risk' && card.priority >= 90 && card.action_url
    );

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
  }, [emergencyCards, studentTaskCards]);

  // AI Briefing Cards 조회
  // 아키텍처 문서 3.7.1 섹션 참조: AI 브리핑 카드
  const { data: aiBriefingCards } = useQuery({
    queryKey: ['ai-briefing-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: AIBriefingCard[] = [];

      try {
        // AI 브리핑 카드는 배치 작업에서 서버가 생성함 (아키텍처 문서 3911줄: 매일 07:00 생성, AI 호출 포함)
        // ai_insights 테이블에서 오늘 날짜의 브리핑 카드 조회
        // 정본 규칙: fetchAIInsights 함수 사용 (Hook의 queryFn 로직 재사용)
        const todayDate = toKST().format('YYYY-MM-DD');
        const aiInsights = await fetchAIInsights(tenantId, {
          insight_type: 'daily_briefing',
          created_at: { gte: `${todayDate}T00:00:00`, lte: `${todayDate}T23:59:59` },
        });

        if (aiInsights && aiInsights.length > 0) {
          // ai_insights 테이블에서 조회한 데이터를 AIBriefingCard 형식으로 변환
          const insights = aiInsights.map((insight) => ({
            id: insight.id,
            type: 'ai_briefing' as const,
            title: insight.title,
            summary: insight.summary,
            insights: typeof insight.insights === 'string' ? JSON.parse(insight.insights) : insight.insights,
            created_at: insight.created_at,
            action_url: insight.action_url,
          }));

          return insights;
        }

        // ai_insights 테이블에 데이터가 없는 경우 (배치 작업 전 또는 실패 시) fallback 로직
        // 주의: 이는 임시 fallback이며, 정상적으로는 배치 작업에서 생성된 카드를 사용해야 함
        // 정본 규칙: fetchConsultations 함수 사용 (Hook의 queryFn 로직 재사용)
        const todayConsultations = await fetchConsultations(tenantId, {
          consultation_date: { gte: todayDate },
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
        // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
        const currentMonth = toKST().format('YYYY-MM');
        const invoices = await fetchBillingHistory(tenantId, {
          period_start: { gte: `${currentMonth}-01` },
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
                expectedCollectionRate >= 90
                  ? '수납률이 양호합니다. 현재 운영 방식을 유지하세요.'
                  : '수납률 개선이 필요합니다. 미납 학생에게 연락을 취하세요.',
              ],
              created_at: toKST().toISOString(),
              action_url: '/billing/home', // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
            });
          }
        }

        // 3. 출결 이상 패턴 확인 (최근 7일)
        // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
        const sevenDaysAgo = toKST().subtract(7, 'days').format('YYYY-MM-DD');
        const logs = await fetchAttendanceLogs(tenantId, {
          date_from: `${sevenDaysAgo}T00:00:00`,
        });

        if (logs && logs.length > 0) {
          const absentCount = logs.filter((log: AttendanceLog) => log.status === 'absent').length;
          const lateCount = logs.filter((log: AttendanceLog) => log.status === 'late').length;

          if (absentCount > 5 || lateCount > 10) {
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

        // 4. 이탈 위험 학생 확인은 studentTaskCards에서 파생 (정본 규칙: task_cards 직접 조회 제거)
        // 정본 규칙: AI Briefing 쿼리 내부에서 apiClient.get('task_cards') 직접 조회 금지
        // studentTaskCards에서 risk 타입 카드를 파생하여 사용 (라인 299 이후 useMemo에서 처리)
      } catch (error) {
        console.error('Failed to generate AI briefing cards:', error);
        // 에러 발생 시 빈 배열 반환
      }

      // 최대 2개만 반환 (아키텍처 문서 4644줄 참조: AI_BRIEFING 그룹 최대 2개)
      return cards.slice(0, 2);
    },
    enabled: !!tenantId,
    refetchInterval: 300000, // 5분마다 갱신
  });

  // 오늘 요일 계산 (기술문서 5-2: KST 기준 날짜 처리)
  const todayDayOfWeek = React.useMemo<DayOfWeek>(() => {
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
  const todayDate = React.useMemo(() => toKST().format('YYYY-MM-DD'), []);

  // 정본 규칙: apiClient.get('attendance_logs') 직접 조회 제거, useAttendanceLogs Hook 사용
  const { data: todayAttendanceLogs } = useAttendanceLogs({
    date_from: `${todayDate}T00:00:00`,
    date_to: `${todayDate}T23:59:59`,
    attendance_type: 'check_in',
  });

  // 오늘 수업의 출석 데이터 조회 및 ClassCard 변환
  const todayClasses = React.useMemo<ClassCard[]>(() => {
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

      // 1. 학생 수 통계
      // 정본 규칙: fetchPersons 함수 사용 (Hook의 queryFn 로직 재사용)
      const students = await fetchPersons(tenantId, {
        person_type: 'student',
      });
      if (students && students.length > 0) {
        const studentCount = students.length;
        cards.push({
          id: 'stats-students',
          type: 'stats',
          title: '전체 학생 수',
          value: studentCount.toString(),
          action_url: '/students/list',
        });
      }

      // 2. 이번 달 매출 통계
      // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
      const currentMonth = toKST().format('YYYY-MM');
      const invoices = await fetchBillingHistory(tenantId, {
        period_start: { gte: `${currentMonth}-01` },
      });

      if (invoices && invoices.length > 0) {
        const totalRevenue = invoices.reduce((sum: number, inv: BillingHistoryItem) => {
          return sum + (inv.amount_paid || 0);
        }, 0);
        cards.push({
          id: 'stats-revenue',
          type: 'stats',
          title: '이번 달 매출',
          value: `${totalRevenue.toLocaleString()}원`,
          action_url: '/billing/home',
        });
      }

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 300000, // 5분마다 갱신
  });

  // Billing Summary 조회
  const { data: billingSummary } = useQuery({
    queryKey: ['billing-summary', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const currentMonth = toKST().format('YYYY-MM');

      // 이번 달 청구서 조회
      // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
      const invoices = await fetchBillingHistory(tenantId, {
        period_start: { gte: `${currentMonth}-01` },
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
  // 아키텍처 문서 4630줄 참조: 카드 개수 제한 규칙 (최대 8개, 그룹별 제한)
  const sortedCards = React.useMemo(() => {
    const cards: DashboardCard[] = [];

    // 그룹별 최대 카드 개수 제한 (아키텍처 문서 4642줄 참조)
    const groupLimits = {
      EMERGENCY: 3,
      AI_BRIEFING: 2,
      TASKS: 3, // 정본: STUDENT_TASKS → TASKS (업종 중립)
      CLASSES: 2,
      BILLING: 2,
      STATS: 1,
    };

    // 1. Emergency Cards (최우선, 항상 최상단, 최대 3개)
    // 정본 규칙: enhancedEmergencyCards 사용 (risk emergency가 맨 앞에 있어서 항상 포함됨)
    if (enhancedEmergencyCards && enhancedEmergencyCards.length > 0) {
      // Emergency 카드는 그룹 내부 정렬 없이 그대로 추가하되, 최대 3개만
      // risk emergency가 맨 앞에 있어서 slice(0, 3)에도 항상 포함됨
      cards.push(...enhancedEmergencyCards.slice(0, groupLimits.EMERGENCY));
    }

    // 2. AI Briefing Cards (생성 시간 기준 내림차순 정렬, 최대 2개)
    // 정본 규칙: enhancedAiBriefingCards 사용
    if (enhancedAiBriefingCards && enhancedAiBriefingCards.length > 0) {
      const sortedBriefing = [...enhancedAiBriefingCards].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // 최신 우선
      });
      cards.push(...sortedBriefing.slice(0, groupLimits.AI_BRIEFING));
    }

    // 3. Student Task Cards (priority 값 기준 내림차순 정렬, 최대 3개)
    if (studentTaskCards && Array.isArray(studentTaskCards) && studentTaskCards.length > 0) {
      const sortedTasks = studentTaskCards.slice().sort((a, b) => {
        // priority가 높을수록(큰 수) 우선순위가 높음
        const priorityA = typeof a === 'object' && 'priority' in a ? Number(a.priority) || 0 : 0;
        const priorityB = typeof b === 'object' && 'priority' in b ? Number(b.priority) || 0 : 0;
        return priorityB - priorityA;
      });
      cards.push(...(sortedTasks.slice(0, groupLimits.TASKS) as unknown as DashboardCard[]));
    }

    // 4. Today Classes (수업 시작 시간 기준 오름차순 정렬, 최대 2개)
    if (todayClasses && todayClasses.length > 0) {
      const sortedClasses = [...todayClasses].sort((a, b) => {
        // start_time을 시간으로 변환하여 비교
        const timeA = a.start_time ? new Date(`2000-01-01 ${a.start_time}`).getTime() : 0;
        const timeB = b.start_time ? new Date(`2000-01-01 ${b.start_time}`).getTime() : 0;
        return timeA - timeB; // 빠른 시간 우선
      });
      cards.push(...sortedClasses.slice(0, groupLimits.CLASSES));
    }

    // 5. Stats Cards (최대 1개)
    if (statsCards && statsCards.length > 0) {
      cards.push(...statsCards.slice(0, groupLimits.STATS));
    }

    // 6. Billing Summary (최대 2개, Billing 그룹에 포함)
    // 아키텍처 문서 4647줄 참조: BILLING 그룹 최대 2개
    // 정본 규칙: 그룹 순서는 불변, 월말에는 priority만 +2 (내부 정렬만 변동)
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
    }

    // 정본 규칙: 그룹 내부 priority 가중치 적용 (월말 등)
    // Billing 카드의 priority가 조정되었으므로, Billing 그룹 내부 정렬만 변동
    // 전체 그룹 순서는 불변: EMERGENCY > AI_BRIEFING > TASKS > CLASSES > BILLING > STATS

    // 전체 카드 최대 8개 제한 (아키텍처 문서 4639줄 참조)
    const maxCards = 8;
    if (cards.length > maxCards) {
      // 우선순위가 높은 카드만 유지하고 나머지는 제거
      return cards.slice(0, maxCards);
    }

    return cards;
  }, [enhancedEmergencyCards, enhancedAiBriefingCards, studentTaskCards, todayClasses, statsCards, billingSummary, shouldPrioritizeBilling]);


  // 전체 카드 수 계산 (제한 전)
  // 정본 규칙: enhancedEmergencyCards, enhancedAiBriefingCards 기준으로 계산 (합성된 카드 수 반영)
  const totalCardsCount = React.useMemo(() => {
    let count = 0;
    if (enhancedEmergencyCards) count += enhancedEmergencyCards.length;
    if (enhancedAiBriefingCards) count += enhancedAiBriefingCards.length;
    if (studentTaskCards) count += studentTaskCards.length;
    if (todayClasses) count += todayClasses.length;
    if (statsCards) count += statsCards.length;
    if (billingSummary) count += 1;
    return count;
  }, [enhancedEmergencyCards, enhancedAiBriefingCards, studentTaskCards, todayClasses, statsCards, billingSummary]);

  const hasMoreCards = totalCardsCount > sortedCards.length;

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="홈 대시보드"
        />

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

        {/* 카드 그리드 */}
          {sortedCards.length > 0 ? (
            <>
              <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap="md">
                {sortedCards.map((card) => renderCard(card, navigate))}
              </Grid>
              {hasMoreCards && (
                <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'center' }}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigate('/home/all-cards');
                    }}
                  >
                    더 {totalCardsCount - sortedCards.length}개 보기
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card padding="lg" variant="default">
              <div style={{
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                padding: 'var(--spacing-xl)'
              }}>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                  표시할 카드가 없습니다.
                </p>
              </div>
            </Card>
        )}
      </Container>
    </ErrorBoundary>
  );
}
