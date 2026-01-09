/**
 * 지역 비교 차트 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 * [불변 규칙] UI Core Component 사용, SSOT 원칙 준수
 * [요구사항] 통계문서 FR-04: 지역 평균 대비 비교 차트
 *
 * Purpose: AnalyticsPage에서 분리된 지역 비교 바 차트 컴포넌트
 */

import React from 'react';
import { Card, EmptyState } from '@ui-core/react';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface RegionalComparisonData {
  name: string;
  value: number;
  average: number;
  top10: number;
}

export interface RegionalComparisonChartProps {
  /** 차트 데이터 */
  data: RegionalComparisonData[];
  /** 차트 제목 */
  title: string;
  /** 로딩 상태 */
  isLoading?: boolean;
}

export function RegionalComparisonChart({ data, title, isLoading }: RegionalComparisonChartProps) {
  if (isLoading) {
    return (
      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>{title}</h3>
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>{title}</h3>
        <EmptyState
          icon={BarChart3}
          message="데이터가 없습니다."
        />
      </Card>
    );
  }

  return (
    <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <h3 style={{ marginBottom: 'var(--spacing-md)' }}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="var(--color-primary)" name="현재 값" />
          <Bar dataKey="average" fill="var(--color-success)" name="지역 평균" />
          <Bar dataKey="top10" fill="var(--color-warning)" name="상위 10%" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
