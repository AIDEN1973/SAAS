/**
 * Billing Summary 쿼리 훅
 *
 * [LAYER: UI_PAGE]
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBillingHistory } from '@hooks/use-billing';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { createQueryKey } from '@hooks/use-query-key-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import { getBaseKST, calculateMonthlyRange } from '../../../utils/date-range-utils';
import { normalizeBillingSummaryCard, logError } from '../../../utils';
import { ROUTES } from '../../../constants';

const CACHE_TIMES = {
  BILLING_REFETCH: 5 * 60 * 1000,
  BILLING_STALE: 60 * 1000,
  BILLING_GC: 5 * 60 * 1000,
} as const;

export function useBillingSummary(tenantId: string) {
  const terms = useIndustryTerms();

  const { data: billingSummary } = useQuery({
    queryKey: createQueryKey('billing-summary', tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      try {
        const baseKSTForBilling = getBaseKST();
        const monthlyRange = calculateMonthlyRange(baseKSTForBilling);
        const invoices = await fetchBillingHistory(tenantId, {
          period_start: { gte: monthlyRange.current.dateString.from, lte: monthlyRange.current.dateString.to },
        });
        const safeInvoices = Array.isArray(invoices) ? invoices : [];
        if (safeInvoices.length === 0) return null;

        const totalAmount = safeInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
        const paidAmount = safeInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);
        const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
        const unpaidCount = safeInvoices.filter((inv: BillingHistoryItem) => inv.status === 'pending' || inv.status === 'overdue').length;

        return normalizeBillingSummaryCard({
          id: 'billing-summary',
          type: 'billing_summary',
          title: `이번 달 ${terms.BILLING_LABEL} 현황`,
          expected_collection_rate: expectedCollectionRate,
          unpaid_count: unpaidCount,
          action_url: ROUTES.BILLING_HOME,
          priority: 50,
        });
      } catch (error) {
        logError('useBillingSummary:Summary', error);
        return null;
      }
    },
    enabled: !!tenantId,
    refetchInterval: CACHE_TIMES.BILLING_REFETCH,
    staleTime: CACHE_TIMES.BILLING_STALE,
    gcTime: CACHE_TIMES.BILLING_GC,
  });

  return { billingSummary };
}
