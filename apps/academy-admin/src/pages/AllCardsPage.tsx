/**
 * 전체 카드 목록 페이지
 *
 * 아키텍처 문서 3.7.1 섹션 참조: overflow_card_handling
 * 홈 화면에서 8개를 초과하는 카드들을 모두 표시하는 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button, PageHeader } from '@ui-core/react';
import { Grid } from '@ui-core/react';
import { StudentTaskCard } from '../components/StudentTaskCard';
import { useStudentTaskCards } from '@hooks/use-student';
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';
import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useClasses } from '@hooks/use-class';
import type { DayOfWeek } from '@services/class-service';
import { toKST } from '@lib/date-utils';
import type { Invoice } from '@core/billing';
import type { AttendanceLog } from '@services/attendance-service';

interface EmergencyCard {
  id: string;
  type: 'emergency';
  title: string;
  message: string;
  priority: number;
  action_url?: string;
}

interface AIBriefingCard {
  id: string;
  type: 'ai_briefing';
  title: string;
  summary: string;
  insights: string[];
  created_at: string;
  action_url?: string; // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
}

interface ClassCard {
  id: string;
  type: 'class';
  class_name: string;
  start_time: string;
  student_count: number;
  attendance_count: number;
  action_url: string;
}

interface StatsCard {
  id: string;
  type: 'stats';
  title: string;
  value: string;
  trend?: string;
  action_url?: string;
}

interface BillingSummaryCard {
  id: string;
  type: 'billing_summary';
  title: string;
  expected_collection_rate: number;
  unpaid_count: number;
  action_url: string;
}

type DashboardCard = EmergencyCard | AIBriefingCard | ClassCard | StatsCard | BillingSummaryCard | StudentTaskCardType;

export function AllCardsPage() {
  const navigate = useNavigate();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // 모든 카드 데이터 조회 (HomePage와 동일한 로직)
  const { data: studentTaskCards } = useStudentTaskCards();

  // Emergency Cards 조회
  const { data: emergencyCards } = useQuery({
    queryKey: ['emergency-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const cards: EmergencyCard[] = [];
      // HomePage와 동일한 로직
      const failedPaymentsResponse = await apiClient.get<Array<{ id: string; status: string; created_at: string }>>('payments', {
        filters: { status: 'failed' },
        orderBy: { column: 'created_at', ascending: false },
        limit: 10,
      });
      if (!failedPaymentsResponse.error && failedPaymentsResponse.data) {
        const failedCount = failedPaymentsResponse.data.length;
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
        const consultationsResponse = await apiClient.get<Array<{ id: string; student_id: string; consultation_date: string }>>('student_consultations', {
          filters: { consultation_date: { gte: todayDate } },
          limit: 10,
        });
        const todayConsultations = consultationsResponse.data || [];
        if (todayConsultations.length > 0) {
            cards.push({
              id: 'briefing-consultations',
              type: 'ai_briefing',
              title: '오늘의 상담 일정',
              summary: `오늘 ${todayConsultations.length}건의 상담이 예정되어 있습니다.`,
              insights: ['상담일지를 작성하여 학생 관리를 강화하세요.'],
              created_at: toKST().toISOString(),
              action_url: '/ai?tab=consultation',
            });
        }
        const currentMonth = toKST().format('YYYY-MM');
        const invoicesResponse = await apiClient.get<Invoice>('invoices', {
          filters: { period_start: { gte: `${currentMonth}-01` } },
        });
        if (!invoicesResponse.error && invoicesResponse.data) {
          const invoices = invoicesResponse.data;
          const totalAmount = invoices.reduce((sum: number, inv: Invoice) => sum + (inv.amount || 0), 0);
          const paidAmount = invoices.reduce((sum: number, inv: Invoice) => sum + ((inv as Invoice & { amount_paid?: number }).amount_paid || 0), 0);
          const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
          if (invoices.length > 0) {
            cards.push({
              id: 'briefing-billing',
              type: 'ai_briefing',
              title: '이번 달 수납 현황',
              summary: `이번 달 청구서가 자동 발송되었습니다. 예상 수납률은 ${expectedCollectionRate}%입니다.`,
              insights: [expectedCollectionRate >= 90 ? '수납률이 양호합니다.' : '수납률 개선이 필요합니다.'],
              created_at: toKST().toISOString(),
              action_url: '/billing/home',
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
  const todayDayOfWeek = React.useMemo<DayOfWeek>(() => {
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

  const todayDate = React.useMemo(() => toKST().format('YYYY-MM-DD'), []);
  const { data: todayAttendanceLogs } = useQuery({
    queryKey: ['today-attendance-logs', tenantId, todayDate],
    queryFn: async () => {
      if (!tenantId) return [];
      const response = await apiClient.get<AttendanceLog[]>('attendance_logs', {
        filters: {
          occurred_at: { gte: `${todayDate}T00:00:00`, lte: `${todayDate}T23:59:59` },
          attendance_type: 'check_in',
        },
      });
      return response.error ? [] : response.data || [];
    },
    enabled: !!tenantId,
  });

  const todayClasses = React.useMemo<ClassCard[]>(() => {
    if (!todayClassesData || todayClassesData.length === 0) return [];
    return todayClassesData.map((cls) => {
      const attendanceCount = (todayAttendanceLogs as AttendanceLog[] | undefined)?.filter((log: AttendanceLog) =>
        log.class_id === cls.id && log.status === 'present'
      ).length || 0;
      return {
        id: cls.id,
        type: 'class' as const,
        class_name: cls.name,
        start_time: cls.start_time,
        student_count: cls.current_count || 0,
        attendance_count: attendanceCount,
        action_url: `/attendance?class_id=${cls.id}`,
      };
    });
  }, [todayClassesData, todayAttendanceLogs]);

  // Stats Cards 조회
  const { data: statsCards } = useQuery({
    queryKey: ['stats-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const cards: StatsCard[] = [];
      const studentsResponse = await apiClient.get<{ id: string }>('persons', { filters: {} });
      if (!studentsResponse.error && studentsResponse.data) {
        cards.push({
          id: 'stats-students',
          type: 'stats',
          title: '전체 학생 수',
          value: studentsResponse.data.length.toString(),
          action_url: '/students/list',
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
      const invoicesResponse = await apiClient.get<Invoice>('invoices', {
        filters: { period_start: { gte: `${currentMonth}-01` } },
      });
      if (invoicesResponse.error || !invoicesResponse.data || invoicesResponse.data.length === 0) {
        return null;
      }
      const invoices = invoicesResponse.data;
      const totalAmount = invoices.reduce((sum: number, inv: Invoice) => sum + (inv.amount || 0), 0);
      const paidAmount = invoices.reduce((sum: number, inv: Invoice) => sum + ((inv as Invoice & { amount_paid?: number }).amount_paid || 0), 0);
      const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
      const unpaidCount = invoices.filter((inv: Invoice) => inv.status === 'pending' || inv.status === 'overdue').length;
      return {
        id: 'billing-summary',
        type: 'billing_summary' as const,
        title: '이번 달 수납 현황',
        expected_collection_rate: expectedCollectionRate,
        unpaid_count: unpaidCount,
        action_url: '/billing/home',
      };
    },
    enabled: !!tenantId,
  });

  // 모든 카드 합치기 (제한 없이)
  const allCards = React.useMemo(() => {
    const cards: DashboardCard[] = [];
    if (emergencyCards) cards.push(...emergencyCards);
    if (aiBriefingCards) cards.push(...aiBriefingCards);
    if (studentTaskCards) cards.push(...(studentTaskCards as unknown as DashboardCard[]));
    if (todayClasses) cards.push(...todayClasses);
    if (statsCards) cards.push(...statsCards);
    if (billingSummary) cards.push(billingSummary);
    return cards;
  }, [emergencyCards, aiBriefingCards, studentTaskCards, todayClasses, statsCards, billingSummary]);

  const handleCardClick = (card: DashboardCard) => {
    if ('action_url' in card && card.action_url) {
      navigate(card.action_url);
    }
  };

  const renderCard = (card: DashboardCard) => {
    if ('task_type' in card) {
      return (
        <StudentTaskCard
          key={card.id}
          card={card as StudentTaskCardType}
          onAction={(c) => navigate(c.action_url)}
        />
      );
    }
    if (card.type === 'emergency') {
      return (
        <Card
          key={card.id}
          padding="md"
          variant="elevated"
          style={{ borderLeft: `var(--border-width-thick) solid var(--color-error)`, cursor: card.action_url ? 'pointer' : 'default' }}
          onClick={() => card.action_url && handleCardClick(card)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                {card.title}
              </h3>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {card.message}
              </p>
            </div>
          </div>
        </Card>
      );
    }
    if (card.type === 'ai_briefing') {
      return (
        <Card key={card.id} padding="md" variant="elevated" style={{ cursor: card.action_url ? 'pointer' : 'default' }} onClick={() => card.action_url && handleCardClick(card)}>
          <div style={{ marginBottom: 'var(--spacing-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>{card.title}</h3>
            </div>
            <p style={{ color: 'var(--color-text-secondary)' }}>{card.summary}</p>
          </div>
          {card.insights && card.insights.length > 0 && (
            <ul style={{ marginTop: 'var(--spacing-sm)', paddingLeft: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
              {card.insights.map((insight, idx) => (
                <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>{insight}</li>
              ))}
            </ul>
          )}
        </Card>
      );
    }
    if (card.type === 'class') {
      return (
        <Card key={card.id} padding="md" variant="default" style={{ cursor: 'pointer' }} onClick={() => handleCardClick(card)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xs)' }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>{card.class_name}</h3>
            <div style={{ color: 'var(--color-text-secondary)' }}>{card.start_time}</div>
          </div>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            출석: {card.attendance_count}/{card.student_count}
          </div>
        </Card>
      );
    }
    if (card.type === 'stats') {
      return (
        <Card key={card.id} padding="md" variant="default" style={{ cursor: card.action_url ? 'pointer' : 'default' }} onClick={() => card.action_url && handleCardClick(card)}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>{card.title}</h3>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{card.value}</div>
        </Card>
      );
    }
    if (card.type === 'billing_summary') {
      return (
        <Card key={card.id} padding="md" variant="default" style={{ cursor: 'pointer' }} onClick={() => handleCardClick(card)}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>{card.title}</h3>
          <div style={{ marginBottom: 'var(--spacing-xs)' }}>
            <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>예상 수납률</div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{card.expected_collection_rate}%</div>
          </div>
          {card.unpaid_count > 0 && (
            <div style={{ color: 'var(--color-error)' }}>미납 {card.unpaid_count}건</div>
          )}
        </Card>
      );
    }
    return null;
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="전체 카드 목록"
          actions={
            <Button variant="outline" onClick={() => navigate('/home')}>
              홈으로 돌아가기
            </Button>
          }
        />

        {allCards.length > 0 ? (
            <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap="md">
              {allCards.map((card) => renderCard(card))}
            </Grid>
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

