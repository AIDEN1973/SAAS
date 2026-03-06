/**
 * 대시보드 카드 그리드 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import type { NavigateFunction } from 'react-router-dom';
import type { DashboardCard, StatsCard } from '../../../types/dashboardCard';
import { CardGridLayout } from '../../../components/CardGridLayout';
import { StatsChartModal } from '../../../components/dashboard-cards/StatsChartModal';
import { renderCard } from '../../../utils';
import type { CardGroup } from '../hooks/useCardAssembly';
import type { DailyStoreMetric } from '@hooks/use-daily-store-metrics';

interface DashboardCardGroupsProps {
  groupedCards: CardGroup[];
  sortedCards: DashboardCard[];
  safeNavigate: NavigateFunction;
  chartModalOpen: { cardId: string | null };
  setChartModalOpen: (state: { cardId: string | null }) => void;
  dailyStoreMetrics: DailyStoreMetric[] | undefined;
}

export function DashboardCardGroups({
  groupedCards,
  sortedCards,
  safeNavigate,
  chartModalOpen,
  setChartModalOpen,
  dailyStoreMetrics,
}: DashboardCardGroupsProps) {
  return (
    <>
      {groupedCards.map((group) => {
        if (group.cards.length === 0) return null;
        return (
          <div key={group.type} style={{ marginBottom: 'var(--spacing-2xl)' }}>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}>
                {group.label}
              </h2>
            </div>
            <CardGridLayout
              cards={group.cards.map((card) => renderCard(card, safeNavigate, {
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

      {chartModalOpen.cardId && (() => {
        const selectedCard = sortedCards.find((card): card is StatsCard =>
          card.id === chartModalOpen.cardId && 'type' in card && card.type === 'stats'
        );
        return (
          <StatsChartModal
            isOpen={!!selectedCard}
            onClose={() => setChartModalOpen({ cardId: null })}
            card={selectedCard || null}
            data={dailyStoreMetrics || []}
          />
        );
      })()}
    </>
  );
}
