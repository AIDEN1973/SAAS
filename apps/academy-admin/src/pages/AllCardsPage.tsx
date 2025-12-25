/**
 * 전체 카드 목록 페이지
 *
 * 아키텍처 문서 3.7.1 섹션 참조: overflow_card_handling
 * 홈 화면에서 8개를 초과하는 카드들을 모두 표시하는 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button, PageHeader } from '@ui-core/react';
import { useStudentTaskCards , fetchConsultations, fetchPersons } from '@hooks/use-student';
import type { DashboardCard, EmergencyCard, AIBriefingCard, ClassCard, StatsCard } from '../types/dashboardCard';
import { useQuery } from '@tanstack/react-query';
import { getApiContext } from '@api-sdk/core';
import { useClasses } from '@hooks/use-class';
import { useAttendanceLogs } from '@hooks/use-attendance';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchPayments } from '@hooks/use-payments';
import type { DayOfWeek } from '@services/class-service';
import { toKST } from '@lib/date-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { AttendanceLog } from '@services/attendance-service';
import { CardGridLayout } from '../components/CardGridLayout';
// [SSOT] Barrel export를 통한 통합 import
import { renderCard, createSafeNavigate } from '../utils';
import { ROUTES } from '../constants';

export function AllCardsPage() {
  const navigate = useNavigate();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );

  // 모든 카드 데이터 조회 (HomePage와 동일한 로직)
  const { data: studentTaskCards } = useStudentTaskCards();

  // Emergency Cards 조회
  const { data: emergencyCards } = useQuery({
    queryKey: ['emergency-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const cards: EmergencyCard[] = [];
      // HomePage와 동일한 로직
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
            action_url: ROUTES.BILLING_HOME,
          });
        }
      }
      return cards;
    },
    enabled: !!tenantId,
  });

  // AI Briefing Cards 조회 (HomePage와 동일한 로직)
  const { data: aiBriefingCards } = useQuery({
    queryKey: ['ai-briefing-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const cards: AIBriefingCard[] = [];
      try {
        const todayDate = toKST().format('YYYY-MM-DD');
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
              insights: ['상담일지를 작성하여 학생 관리를 강화하세요.'],
              created_at: toKST().toISOString(),
              action_url: ROUTES.AI_CONSULTATION,
            });
        }
        const currentMonth = toKST().format('YYYY-MM');
        // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
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
              insights: [expectedCollectionRate >= 90 ? '수납률이 양호합니다.' : '수납률 개선이 필요합니다.'],
              created_at: toKST().toISOString(),
              action_url: ROUTES.BILLING_HOME,
            });
          }
        }
      } catch (error) {
        console.error('Failed to generate AI briefing cards:', error);
      }
      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 300000,
  });

  // 오늘 수업 조회 (기술문서 5-2: KST 기준 날짜 처리)
  const todayDayOfWeek = useMemo<DayOfWeek>(() => {
    const todayKST = toKST();
    const dayOfWeek = todayKST.day(); // 0(일) ~ 6(토)
    const dayOfWeekMap: Record<number, DayOfWeek> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    };
    return dayOfWeekMap[dayOfWeek];
  }, []);

  const { data: todayClassesData } = useClasses({
    day_of_week: todayDayOfWeek,
    status: 'active',
  });

  const todayDate = useMemo(() => toKST().format('YYYY-MM-DD'), []);
  // 정본 규칙: apiClient.get('attendance_logs') 직접 조회 제거, useAttendanceLogs Hook 사용
  const { data: todayAttendanceLogs } = useAttendanceLogs({
    date_from: `${todayDate}T00:00:00`,
    date_to: `${todayDate}T23:59:59`,
    attendance_type: 'check_in',
  });

  const todayClasses = useMemo<ClassCard[]>(() => {
    if (!todayClassesData || todayClassesData.length === 0) return [];
    return todayClassesData.map((cls) => {
      const attendanceCount = todayAttendanceLogs?.filter((log: AttendanceLog) =>
        log.class_id === cls.id && log.status === 'present'
      ).length || 0;
      return {
        id: cls.id,
        type: 'class' as const,
        class_name: cls.name,
        start_time: cls.start_time,
        student_count: cls.current_count || 0,
        attendance_count: attendanceCount,
        action_url: ROUTES.ATTENDANCE_BY_CLASS(cls.id),
      };
    });
  }, [todayClassesData, todayAttendanceLogs]);

  // Stats Cards 조회
  const { data: statsCards } = useQuery({
    queryKey: ['stats-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const cards: StatsCard[] = [];
      // 정본 규칙: fetchPersons 함수 사용 (Hook의 queryFn 로직 재사용)
      const students = await fetchPersons(tenantId, {
        person_type: 'student',
      });
      if (students && students.length > 0) {
        cards.push({
          id: 'stats-students',
          type: 'stats',
          title: '전체 학생 수',
          value: students.length.toString(),
          action_url: ROUTES.STUDENTS_LIST,
        });
      }
      return cards;
    },
    enabled: !!tenantId,
  });

  // Billing Summary 조회
  const { data: billingSummary } = useQuery({
    queryKey: ['billing-summary', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const currentMonth = toKST().format('YYYY-MM');
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
        action_url: ROUTES.BILLING_HOME,
      };
    },
    enabled: !!tenantId,
  });

  // 모든 카드 합치기 (제한 없이)
  const allCards = useMemo(() => {
    const cards: DashboardCard[] = [];
    if (emergencyCards) cards.push(...emergencyCards);
    if (aiBriefingCards) cards.push(...aiBriefingCards);
    if (studentTaskCards) cards.push(...(studentTaskCards as unknown as DashboardCard[]));
    if (todayClasses) cards.push(...todayClasses);
    if (statsCards) cards.push(...statsCards);
    if (billingSummary) cards.push(billingSummary);
    return cards;
  }, [emergencyCards, aiBriefingCards, studentTaskCards, todayClasses, statsCards, billingSummary]);


  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="전체 카드 목록"
          actions={
            <Button variant="outline" onClick={() => safeNavigate(ROUTES.HOME)}>
              홈으로 돌아가기
            </Button>
          }
        />

        {allCards.length > 0 ? (
            <CardGridLayout
              cards={allCards.map((card) => renderCard(card, safeNavigate, { maxInsights: 0 }))}
              desktopColumns={3}
              tabletColumns={2}
              mobileColumns={1}
            />
          ) : (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--spacing-xl)' }}>
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

