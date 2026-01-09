/**
 * AI 인사이트 카드 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 * [불변 규칙] UI Core Component 사용, SSOT 원칙 준수
 * [요구사항] 통계문서 FR-08: AI 인사이트 표시
 *
 * Purpose: AnalyticsPage에서 분리된 AI 인사이트 표시 컴포넌트
 */

import { Card, EmptyState } from '@ui-core/react';
import { Sparkles, MapPin } from 'lucide-react';

// EmptyState 컴포넌트가 제대로 import되었는지 확인
console.log('[AIInsightCard] EmptyState component:', EmptyState);
console.log('[AIInsightCard] MapPin icon:', MapPin);
console.log('[AIInsightCard] Sparkles icon:', Sparkles);

export interface AIInsightCardProps {
  /** AI 인사이트 텍스트 배열 */
  insights: string[];
  /** 로딩 상태 */
  isLoading?: boolean;
}

export function AIInsightCard({ insights, isLoading }: AIInsightCardProps) {
  console.log('[AIInsightCard] insights:', insights, 'isLoading:', isLoading);

  if (isLoading) {
    return (
      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-md)' }}>AI 인사이트</h2>
        <div style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    console.log('[AIInsightCard] Rendering EmptyState - no insights');
    return (
      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-md)' }}>AI 인사이트</h2>
        <EmptyState
          icon={Sparkles}
          message="AI 인사이트 데이터가 없습니다."
        />
      </Card>
    );
  }

  // 지역 정보 설정 메시지만 있는 경우 EmptyState로 표시
  if (insights.length === 1 && insights[0] === '지역 정보를 설정해주세요.') {
    console.log('[AIInsightCard] Rendering EmptyState - location setup needed');
    return (
      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-md)' }}>AI 인사이트</h2>
        <EmptyState
          icon={MapPin}
          message="지역 정보를 설정해주세요."
        />
      </Card>
    );
  }

  return (
    <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <h2 style={{ marginBottom: 'var(--spacing-md)' }}>AI 인사이트</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {insights.map((insight, index) => (
          <li
            key={index}
            style={{
              padding: 'var(--spacing-sm)',
              marginBottom: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-background-subtle)',
              borderRadius: 'var(--border-radius-base)',
              borderLeft: '4px solid var(--color-primary)',
            }}
          >
            {insight}
          </li>
        ))}
      </ul>
    </Card>
  );
}
