/**
 * AI Briefing Cards 쿼리 훅
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStudentTaskCards, fetchConsultations } from '@hooks/use-student';
import { fetchAttendanceLogs } from '@hooks/use-attendance';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchAIInsights } from '@hooks/use-ai-insights';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { createQueryKey } from '@hooks/use-query-key-utils';
import { toKST } from '@lib/date-utils';
import type { AIBriefingCard } from '../../../types/dashboardCard';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { AttendanceLog } from '@services/attendance-service';
import { getBaseKST, calculateMonthlyRange } from '../../../utils/date-range-utils';
import {
  getPolicyValue,
  normalizeAIBriefingCard,
  logError,
  p,
} from '../../../utils';
import { ROUTES } from '../../../constants';

const CACHE_TIMES = {
  AI_BRIEFING_REFETCH: 5 * 60 * 1000,
  AI_BRIEFING_STALE: 2 * 60 * 1000,
  AI_BRIEFING_GC: 5 * 60 * 1000,
} as const;

interface UseAiBriefingCardsParams {
  tenantId: string;
  loadConfigOnce: () => Promise<Record<string, unknown> | null>;
}

export function useAiBriefingCards({ tenantId, loadConfigOnce }: UseAiBriefingCardsParams) {
  const terms = useIndustryTerms();
  const { data: studentTaskCards } = useStudentTaskCards();

  const riskBriefingCreatedAtRef = useRef<string>(toKST().toISOString());

  const { data: aiBriefingCards } = useQuery({
    queryKey: createQueryKey('ai-briefing-cards', tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const cards: AIBriefingCard[] = [];
      const config = await loadConfigOnce();
      const baseKST = getBaseKST();

      try {
        const todayStartISO = baseKST.clone().startOf('day').toISOString();
        const todayEndISO = baseKST.clone().endOf('day').toISOString();
        const aiInsights = await fetchAIInsights(tenantId, {
          insight_type: 'daily_briefing',
          created_at: { gte: todayStartISO, lte: todayEndISO },
        });

        const safeAiInsights = Array.isArray(aiInsights) ? aiInsights : [];
        if (safeAiInsights.length > 0) {
          const serverInsights = safeAiInsights.map((insight) => {
            let parsedInsights: unknown = insight.insights;
            if (typeof insight.insights === 'string') {
              try {
                parsedInsights = JSON.parse(insight.insights);
              } catch (error) {
                logError('useAiBriefingCards:JSONParse', error);
                parsedInsights = [];
              }
            }
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
          cards.push(...serverInsights);
        } else {
          const todayStart = baseKST.clone().startOf('day').format('YYYY-MM-DD');
          const todayEnd = baseKST.clone().endOf('day').format('YYYY-MM-DD');
          const todayConsultations = await fetchConsultations(tenantId, {
            consultation_date: { gte: todayStart, lte: todayEnd },
          });
          const safeTodayConsultations = Array.isArray(todayConsultations) ? todayConsultations : [];
          if (safeTodayConsultations.length > 0) {
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
              action_url: ROUTES.AI_CONSULTATION,
            }));
          }
        }

        if (!config) return cards;

        // 2. 이번 달 청구서 상태
        const collectionRateThreshold = getPolicyValue<number>('COLLECTION_RATE_THRESHOLD', config);
        if (collectionRateThreshold !== null) {
          const monthlyRange = calculateMonthlyRange(baseKST);
          const invoices = await fetchBillingHistory(tenantId, {
            period_start: { gte: monthlyRange.current.dateString.from, lte: monthlyRange.current.dateString.to },
          });
          const safeInvoices = Array.isArray(invoices) ? invoices : [];
          if (safeInvoices.length > 0) {
            const totalAmount = safeInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
            const paidAmount = safeInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);
            const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
            if (safeInvoices.length > 0) {
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
                action_url: ROUTES.BILLING_HOME,
              }));
            }
          }
        }

        // 3. 출결 이상 패턴 확인 (최근 7일)
        const attendanceAnomalyAbsentThreshold = getPolicyValue<number>('ATTENDANCE_ANOMALY_ABSENT_THRESHOLD', config);
        const attendanceAnomalyLateThreshold = getPolicyValue<number>('ATTENDANCE_ANOMALY_LATE_THRESHOLD', config);
        if (attendanceAnomalyAbsentThreshold !== null && attendanceAnomalyLateThreshold !== null) {
          const sevenDaysAgoBase = baseKST.clone().subtract(7, 'days');
          const logs = await fetchAttendanceLogs(tenantId, {
            date_from: sevenDaysAgoBase.clone().startOf('day').format('YYYY-MM-DD'),
            date_to: baseKST.clone().endOf('day').format('YYYY-MM-DD'),
          });
          const safeLogs = Array.isArray(logs) ? logs : [];
          if (safeLogs.length > 0) {
            const absentCount = safeLogs.filter((log: AttendanceLog) => log.status === 'absent').length;
            const lateCount = safeLogs.filter((log: AttendanceLog) => log.status === 'late').length;
            if (absentCount > attendanceAnomalyAbsentThreshold || lateCount > attendanceAnomalyLateThreshold) {
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
                action_url: ROUTES.AI_ATTENDANCE,
              }));
            }
          }
        }
      } catch (error) {
        logError('useAiBriefingCards:CardGeneration', error);
      }

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: CACHE_TIMES.AI_BRIEFING_REFETCH,
    staleTime: CACHE_TIMES.AI_BRIEFING_STALE,
    gcTime: CACHE_TIMES.AI_BRIEFING_GC,
  });

  // studentTaskCards에서 risk 카드를 파생하여 AI Briefing에 합성
  const enhancedAiBriefingCards = useMemo(() => {
    if (!aiBriefingCards || !studentTaskCards) return aiBriefingCards || [];
    const safeStudentTaskCards = Array.isArray(studentTaskCards) ? studentTaskCards : [];
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
      const firstRiskCard = riskCards[0];
      const riskActionUrl = firstRiskCard?.action_url;
      if (riskActionUrl) {
        const riskCardCreatedAt = (firstRiskCard as { created_at?: string })?.created_at ?? riskBriefingCreatedAtRef.current;
        const riskBriefingCard = normalizeAIBriefingCard({
          id: 'briefing-risk',
          type: 'ai_briefing',
          title: `${terms.EMERGENCY_RISK_LABEL} ${terms.PERSON_LABEL_PLURAL} 알림`,
          summary: `${riskCount}명의 ${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} ${terms.EMERGENCY_RISK_LABEL}입니다.`,
          insights: [
            `${terms.EMERGENCY_RISK_LABEL} ${terms.PERSON_LABEL_PLURAL}에게 즉시 ${terms.CONSULTATION_LABEL}${p.을를(terms.CONSULTATION_LABEL)} 진행하세요.`,
            `${terms.PERSON_LABEL_PRIMARY}의 진행 동기를 높이기 위한 방안을 모색하세요.`,
          ],
          created_at: riskCardCreatedAt,
          action_url: riskActionUrl,
        });
        return [...aiBriefingCards, riskBriefingCard];
      }
    }

    return aiBriefingCards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiBriefingCards, studentTaskCards]);

  return { enhancedAiBriefingCards };
}
