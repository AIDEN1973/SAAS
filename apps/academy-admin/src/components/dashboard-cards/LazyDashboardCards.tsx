/**
 * Lazy Loading 대시보드 카드 컴포넌트
 *
 * [성능 최적화] P0 작업
 * - React.lazy를 사용하여 카드 컴포넌트를 동적으로 import
 * - Suspense fallback으로 로딩 상태 표시
 * - 초기 로딩 속도 약 50% 개선 예상
 */

import { Suspense, lazy } from 'react';
import { Card } from '@ui-core/react';

// Lazy load 대시보드 카드 컴포넌트들
const ClassCard = lazy(() => import('./ClassCard').then(m => ({ default: m.ClassCard })));
const QuickActionCard = lazy(() => import('./QuickActionCard').then(m => ({ default: m.QuickActionCard })));
const RecentActivityCard = lazy(() => import('./RecentActivityCard').then(m => ({ default: m.RecentActivityCard })));
const BillingSummaryCard = lazy(() => import('./BillingSummaryCard').then(m => ({ default: m.BillingSummaryCard })));
const StatsCard = lazy(() => import('./StatsCard').then(m => ({ default: m.StatsCard })));

/**
 * 카드 로딩 Fallback 컴포넌트
 * [SSOT] CSS 변수 사용 규칙 준수
 */
function CardSkeleton() {
  return (
    <Card padding="md">
      <div
        style={{
          textAlign: 'center',
          padding: 'var(--spacing-lg)',
          color: 'var(--color-text-secondary)',
          animation: 'pulse var(--duration-slow) ease-in-out infinite'
        }}
      >
        <div style={{
          width: '100%',
          height: 'var(--height-card-skeleton)',
          backgroundColor: 'var(--color-background-secondary)',
          borderRadius: 'var(--border-radius-md)'
        }} />
      </div>
    </Card>
  );
}

/**
 * Lazy Loaded Class Card
 */
export function LazyClassCard(props: React.ComponentProps<typeof ClassCard>) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <ClassCard {...props} />
    </Suspense>
  );
}

/**
 * Lazy Loaded Quick Action Card
 */
export function LazyQuickActionCard(props: React.ComponentProps<typeof QuickActionCard>) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <QuickActionCard {...props} />
    </Suspense>
  );
}

/**
 * Lazy Loaded Recent Activity Card
 */
export function LazyRecentActivityCard(props: React.ComponentProps<typeof RecentActivityCard>) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <RecentActivityCard {...props} />
    </Suspense>
  );
}

/**
 * Lazy Loaded Billing Summary Card
 */
export function LazyBillingSummaryCard(props: React.ComponentProps<typeof BillingSummaryCard>) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <BillingSummaryCard {...props} />
    </Suspense>
  );
}

/**
 * Lazy Loaded Stats Card
 */
export function LazyStatsCard(props: React.ComponentProps<typeof StatsCard>) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <StatsCard {...props} />
    </Suspense>
  );
}
