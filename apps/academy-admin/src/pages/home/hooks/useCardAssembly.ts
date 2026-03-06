/**
 * Card Assembly 훅 — sortedCards + groupedCards 조합
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo, useRef } from 'react';
import { useStudentTaskCards } from '@hooks/use-student';
import { useMonthEndAdaptation } from '@hooks/use-month-end-adaptation';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { toKST } from '@lib/date-utils';
import type {
  DashboardCard,
  EmergencyCard,
  AIBriefingCard,
  ClassCard,
  StatsCard,
  BillingSummaryCard,
} from '../../../types/dashboardCard';
import {
  normalizeEmergencyCard,
  normalizeAIBriefingCard,
  normalizeClassCard,
  normalizeStatsCard,
  normalizeBillingSummaryCard,
  normalizeDashboardCards,
  createEmptyTaskCard,
} from '../../../utils';
import { EMPTY_CARD_MESSAGES, EMPTY_CARD_ID_PREFIX, DEFAULT_CLASS_START_TIME, ROUTES } from '../../../constants';

function asObjectArray<T extends { id: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is T =>
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    'id' in v &&
    typeof (v as { id?: unknown }).id === 'string'
  );
}

export interface CardGroup {
  type: string;
  label: string;
  cards: DashboardCard[];
}

interface UseCardAssemblyParams {
  enhancedEmergencyCards: EmergencyCard[] | undefined;
  enhancedAiBriefingCards: AIBriefingCard[] | undefined;
  todayClasses: ClassCard[];
  statsCards: StatsCard[];
  billingSummary: BillingSummaryCard | null | undefined;
}

export function useCardAssembly({
  enhancedEmergencyCards,
  enhancedAiBriefingCards,
  todayClasses,
  statsCards,
  billingSummary,
}: UseCardAssemblyParams) {
  const terms = useIndustryTerms();
  const { data: studentTaskCards } = useStudentTaskCards();
  const { shouldPrioritizeBilling } = useMonthEndAdaptation();
  const emptyCardTimestampRef = useRef<string>(toKST().toISOString());

  const sortedCards = useMemo(() => {
    const cards: DashboardCard[] = [];

    // 1. Emergency Cards
    if (enhancedEmergencyCards) {
      const safeEmergency = asObjectArray<Partial<DashboardCard> & { id: string }>(enhancedEmergencyCards);
      const normalizedEmergency = normalizeDashboardCards(safeEmergency);
      if (normalizedEmergency.length > 0) {
        const sortedEmergency = [...normalizedEmergency].sort((a, b) => {
          const priorityA = ('priority' in a && typeof a.priority === 'number') ? a.priority : 999;
          const priorityB = ('priority' in b && typeof b.priority === 'number') ? b.priority : 999;
          return priorityA - priorityB;
        });
        cards.push(...sortedEmergency);
      }
    } else {
      cards.push(normalizeEmergencyCard({
        id: `${EMPTY_CARD_ID_PREFIX}-emergency`,
        type: 'emergency',
        title: EMPTY_CARD_MESSAGES.EMERGENCY.TITLE,
        message: EMPTY_CARD_MESSAGES.EMERGENCY.MESSAGE.replace('{ENTITY}', '기관'),
        priority: 0,
      }));
    }

    // 2. AI Briefing Cards
    if (enhancedAiBriefingCards && Array.isArray(enhancedAiBriefingCards) && enhancedAiBriefingCards.length > 0) {
      const safeBriefing = asObjectArray<Partial<DashboardCard> & { id: string }>(enhancedAiBriefingCards);
      const normalizedBriefing = normalizeDashboardCards(safeBriefing);
      const sortedBriefing = [...normalizedBriefing].sort((a, b) => {
        const aTime = 'created_at' in a ? a.created_at : '';
        const bTime = 'created_at' in b ? b.created_at : '';
        return String(bTime).localeCompare(String(aTime));
      });
      cards.push(...sortedBriefing);
    } else {
      cards.push(normalizeAIBriefingCard({
        id: `${EMPTY_CARD_ID_PREFIX}-ai-briefing`,
        type: 'ai_briefing',
        title: EMPTY_CARD_MESSAGES.AI_BRIEFING.TITLE,
        summary: EMPTY_CARD_MESSAGES.AI_BRIEFING.SUMMARY.replace('{PERSON_LABEL}', terms.PERSON_LABEL_PRIMARY),
        insights: [],
        created_at: emptyCardTimestampRef.current,
      }));
    }

    // 3. Student Task Cards
    const safeTasks = asObjectArray<Partial<DashboardCard> & { id: string }>(studentTaskCards);
    if (safeTasks.length > 0) {
      const normalizedTasks = normalizeDashboardCards(safeTasks);
      const sortedTasks = normalizedTasks.slice().sort((a, b) => {
        const priorityA = ('priority' in a && typeof a.priority === 'number') ? a.priority : 0;
        const priorityB = ('priority' in b && typeof b.priority === 'number') ? b.priority : 0;
        return priorityB - priorityA;
      });
      cards.push(...sortedTasks);
    } else {
      cards.push(createEmptyTaskCard());
    }

    // 4. Today Classes
    if (todayClasses && todayClasses.length > 0) {
      const sortedClasses = [...todayClasses].sort((a, b) => {
        const timeA = a.start_time || DEFAULT_CLASS_START_TIME;
        const timeB = b.start_time || DEFAULT_CLASS_START_TIME;
        return timeA.localeCompare(timeB);
      });
      cards.push(...sortedClasses);
    } else {
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

    // 5. Stats Cards
    if (statsCards && statsCards.length > 0) {
      cards.push(...statsCards);
    } else {
      cards.push(normalizeStatsCard({
        id: `${EMPTY_CARD_ID_PREFIX}-stats`,
        type: 'stats',
        title: EMPTY_CARD_MESSAGES.STATS.TITLE,
        value: EMPTY_CARD_MESSAGES.STATS.VALUE,
      }));
    }

    // 6. Billing Summary
    if (billingSummary) {
      cards.push(normalizeBillingSummaryCard({
        ...billingSummary,
        priority: (billingSummary.priority || 50) + (shouldPrioritizeBilling ? 2 : 0),
      }));
    } else {
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

    return cards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enhancedEmergencyCards, enhancedAiBriefingCards, studentTaskCards, todayClasses, statsCards, billingSummary, shouldPrioritizeBilling]);

  const groupedCards = useMemo<CardGroup[]>(() => {
    const emergencyCards = sortedCards.filter((card): card is EmergencyCard => 'type' in card && card.type === 'emergency');
    const aiBriefingCardsInView = sortedCards.filter((card): card is AIBriefingCard => 'type' in card && card.type === 'ai_briefing');
    const briefingCards = [...emergencyCards, ...aiBriefingCardsInView];
    const taskCardsInView = sortedCards.filter((card) => card && typeof card === 'object' && 'task_type' in card);
    const classCards = sortedCards.filter((card): card is ClassCard => 'type' in card && card.type === 'class');
    const allStatsCards = sortedCards.filter((card): card is StatsCard => 'type' in card && card.type === 'stats');
    const billingCards = sortedCards.filter((card): card is BillingSummaryCard => 'type' in card && card.type === 'billing_summary');

    function ensureNonEmpty<T>(items: T[], fallback: T): T[] {
      return items.length > 0 ? items : [fallback];
    }

    const attendanceStatsCards = ensureNonEmpty(
      allStatsCards.filter((card) =>
        card.id === 'stats-attendance-rate' || card.id === 'stats-late-rate' ||
        card.id === 'stats-absent-rate' || card.id === 'stats-weekly-attendance' ||
        card.id === 'stats-monthly-attendance-rate' || card.id === 'stats-attendance-improvement-rate'
      ),
      normalizeStatsCard({ id: `${EMPTY_CARD_ID_PREFIX}-attendance-stats`, type: 'stats', title: terms.CARD_GROUP_LABELS.attendance_stats, value: '-' })
    );

    const studentGrowthStatsCards = ensureNonEmpty(
      allStatsCards.filter((card) =>
        card.id === 'stats-students' || card.id === 'stats-new-students' ||
        card.id === 'stats-weekly-new-students' || card.id === 'stats-active-students' ||
        card.id === 'stats-inactive-students' || card.id === 'stats-student-growth' ||
        card.id === 'stats-student-retention-rate' || card.id === 'stats-avg-students-per-class' ||
        card.id === 'stats-avg-capacity-rate'
      ),
      normalizeStatsCard({ id: `${EMPTY_CARD_ID_PREFIX}-student-growth-stats`, type: 'stats', title: terms.CARD_GROUP_LABELS.student_growth_stats, value: '-' })
    );

    const revenueStatsCards = ensureNonEmpty(
      allStatsCards.filter((card) =>
        card.id === 'stats-revenue' || card.id === 'stats-expected-revenue' ||
        card.id === 'stats-arpu' || card.id === 'stats-revenue-growth' ||
        card.id === 'stats-weekly-revenue' || card.id === 'stats-avg-invoice-amount'
      ),
      normalizeStatsCard({ id: `${EMPTY_CARD_ID_PREFIX}-revenue-stats`, type: 'stats', title: terms.CARD_GROUP_LABELS.revenue_stats, value: '-' })
    );

    const collectionStatsCards = ensureNonEmpty(
      normalizeDashboardCards([
        ...billingCards,
        ...allStatsCards.filter((card) =>
          card.id === 'stats-unpaid-rate' || card.id === 'stats-avg-collection-period'
        ),
      ]),
      normalizeStatsCard({ id: `${EMPTY_CARD_ID_PREFIX}-collection-stats`, type: 'stats', title: terms.CARD_GROUP_LABELS.collection_stats, value: '-' })
    );

    return [
      { type: 'briefing', label: terms.CARD_GROUP_LABELS.briefing, cards: briefingCards },
      { type: 'student_task', label: terms.CARD_GROUP_LABELS.student_task, cards: taskCardsInView },
      { type: 'class', label: terms.CARD_GROUP_LABELS.class, cards: classCards },
      { type: 'attendance_stats', label: terms.CARD_GROUP_LABELS.attendance_stats, cards: attendanceStatsCards },
      { type: 'student_growth_stats', label: terms.CARD_GROUP_LABELS.student_growth_stats, cards: studentGrowthStatsCards },
      { type: 'revenue_stats', label: terms.CARD_GROUP_LABELS.revenue_stats, cards: revenueStatsCards },
      { type: 'collection_stats', label: terms.CARD_GROUP_LABELS.collection_stats, cards: collectionStatsCards },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedCards]);

  return { sortedCards, groupedCards };
}
