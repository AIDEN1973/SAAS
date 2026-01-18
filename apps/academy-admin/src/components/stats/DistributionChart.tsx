/**
 * DistributionChart Component (Donut Chart)
 *
 * 학년별/성별 분포를 표시하는 도넛 차트 컴포넌트
 *
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] 재사용 가능한 공통 컴포넌트
 */

import React, { useMemo } from 'react';
import { Card, EmptyState } from '@ui-core/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, type PieProps } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

export interface DistributionDataItem {
  name: string;
  value: number;
  color: string;
}

export interface DistributionChartProps {
  /** 차트 제목 */
  title: string;
  /** 차트 데이터 */
  data: DistributionDataItem[];
  /** 단위 (기본값: '명') */
  unit?: string;
  /** 높이 (기본값: 280) */
  height?: number;
  /** 빈 데이터 메시지 */
  emptyMessage?: string;
}

/**
 * 커스텀 툴팁 컴포넌트
 */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DistributionDataItem }>;
  unit: string;
  total: number;
}> = ({ active, payload, unit, total }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];
  const percent = total > 0 ? Math.round((data.value / total) * 1000) / 10 : 0;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-white)',
        border: 'var(--border-width-thin) solid var(--color-gray-200)',
        borderRadius: 'var(--border-radius-sm)',
        padding: 'var(--spacing-sm)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)' }}>
        {data.name}
      </div>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
        {data.value}{unit} ({percent}%)
      </div>
    </div>
  );
};

/**
 * 커스텀 범례 컴포넌트
 */
const CustomLegend: React.FC<{
  payload?: Array<{ value: string; color: string; payload: { value: number } }>;
  unit: string;
  total: number;
}> = ({ payload, unit, total }) => {
  if (!payload) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        marginTop: 'var(--spacing-md)',
      }}
    >
      {payload.map((entry, index) => {
        const percent = total > 0 ? Math.round((entry.payload.value / total) * 1000) / 10 : 0;
        return (
          <div
            key={`legend-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 'var(--border-radius-xs)',
                backgroundColor: entry.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: 'var(--color-text)', flex: 1 }}>{entry.value}</span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
              {entry.payload.value}{unit}
            </span>
            <span style={{ color: 'var(--color-text-tertiary)', minWidth: 45, textAlign: 'right' }}>
              ({percent}%)
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * DistributionChart 컴포넌트
 *
 * 도넛 차트 + 중앙 총계 + 범례
 */
export function DistributionChart({
  title,
  data,
  unit = '명',
  height = 280,
  emptyMessage = '표시할 데이터가 없습니다',
}: DistributionChartProps) {
  // 총 합계 계산
  const total = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
  }, [data]);

  // 차트 스타일
  const chartStyles = useMemo(() => ({
    tooltipContent: {
      backgroundColor: 'var(--color-white)',
      border: 'var(--border-width-thin) solid var(--color-gray-200)',
      borderRadius: 'var(--border-radius-sm)',
      padding: 'var(--spacing-sm)',
    },
  }), []);

  return (
    <Card padding="lg" variant="default" style={{ height: '100%' }}>
      {/* 제목 */}
      <div
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        {title}
      </div>

      {/* 차트 영역 */}
      {data.length > 0 ? (
        <>
          {/* 도넛 차트 영역 - 고정 높이 */}
          <div style={{ width: '100%', height: 200 }}>
            <style>
              {`
                .recharts-wrapper,
                .recharts-wrapper *,
                .recharts-surface,
                .recharts-surface * {
                  outline: none !important;
                }
              `}
            </style>
            <ResponsiveContainer width="100%" height={200} debounce={50}>
              <PieChart>
                <Pie
                  data={data as unknown as PieProps['data']}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationEasing="ease-out"
                  animationBegin={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={<CustomTooltip unit={unit} total={total} />}
                  contentStyle={chartStyles.tooltipContent}
                />
                {/* 중앙 총계 텍스트 - SVG text는 CSS 변수를 해석하지 못하므로 픽셀값 직접 사용 */}
                {/* tspan을 사용하여 숫자와 단위를 하나의 text 요소로 표시 */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ userSelect: 'none' }}
                >
                  <tspan
                    fontSize={20}
                    fontWeight={700}
                    fill="#2c3e50"
                  >
                    {total}
                  </tspan>
                  <tspan
                    fontSize={13}
                    fill="#64748b"
                    dx={4}
                  >
                    {unit}
                  </tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* 범례 영역 - 별도 영역으로 분리 */}
          <CustomLegend payload={data.map((item) => ({ value: item.name, color: item.color, payload: { value: item.value } }))} unit={unit} total={total} />
        </>
      ) : (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon={PieChartIcon} message={emptyMessage} />
        </div>
      )}
    </Card>
  );
}
