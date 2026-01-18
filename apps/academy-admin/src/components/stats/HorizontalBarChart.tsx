/**
 * HorizontalBarChart Component
 *
 * 태그별/상담 유형별 분포를 표시하는 가로 막대 차트 컴포넌트
 *
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] 재사용 가능한 공통 컴포넌트
 */

import React, { useMemo } from 'react';
import { Card, EmptyState } from '@ui-core/react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Cell, LabelList } from 'recharts';
import { BarChart3 } from 'lucide-react';

export interface HorizontalBarDataItem {
  name: string;
  value: number;
  color: string;
  id?: string;
}

export interface HorizontalBarChartProps {
  /** 차트 제목 */
  title: string;
  /** 차트 데이터 */
  data: HorizontalBarDataItem[];
  /** 단위 (기본값: '명') */
  unit?: string;
  /** 높이 (기본값: 280) */
  height?: number;
  /** 빈 데이터 메시지 */
  emptyMessage?: string;
  /** 최대 표시 개수 (기본값: 5) */
  maxItems?: number;
  /** Y축 라벨 최대 길이 (기본값: 8) */
  yAxisLabelMaxLength?: number;
  /** 클릭 핸들러 */
  onClick?: (item: HorizontalBarDataItem) => void;
}

/**
 * 커스텀 툴팁 컴포넌트
 */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number; payload: HorizontalBarDataItem }>;
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
        {data.payload.name}
      </div>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
        {data.value}{unit} ({percent}%)
      </div>
    </div>
  );
};

/**
 * 커스텀 Y축 라벨 생성 함수
 */
const createCustomYAxisTick = (maxLength: number) => {
  const CustomYAxisTick: React.FC<{
    x?: number;
    y?: number;
    payload?: { value: string };
  }> = ({ x, y, payload }) => {
    if (!payload) return null;

    // 긴 이름은 잘라서 표시
    const displayName = payload.value.length > maxLength
      ? `${payload.value.substring(0, maxLength)}...`
      : payload.value;

    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill="var(--color-text-secondary)"
        fontSize="var(--font-size-sm)"
      >
        {displayName}
      </text>
    );
  };
  return CustomYAxisTick;
};

/**
 * HorizontalBarChart 컴포넌트
 *
 * 가로 막대 차트 + 값 라벨
 */
export function HorizontalBarChart({
  title,
  data,
  unit = '명',
  height = 280,
  emptyMessage = '표시할 데이터가 없습니다',
  maxItems = 5,
  yAxisLabelMaxLength = 8,
  onClick,
}: HorizontalBarChartProps) {
  // 데이터 정렬 및 제한
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems);
  }, [data, maxItems]);

  // 총 합계
  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  // 최대값 (차트 도메인용)
  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map((item) => item.value));
  }, [chartData]);

  // 바 높이 계산 (데이터 수에 따라 동적)
  const barHeight = useMemo(() => {
    const itemCount = chartData.length;
    if (itemCount <= 3) return 32;
    if (itemCount <= 5) return 28;
    return 24;
  }, [chartData.length]);

  // 차트 마진
  const chartMargin = useMemo(() => ({
    top: 10,
    right: 60,
    left: 80,
    bottom: 10,
  }), []);

  // 클릭 핸들러
  const handleBarClick = (data: HorizontalBarDataItem) => {
    if (onClick) {
      onClick(data);
    }
  };

  return (
    <Card padding="lg" variant="default" style={{ height: '100%' }}>
      {/* 제목 + 총계 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          총 {total}{unit}
        </div>
      </div>

      {/* 차트 영역 */}
      {chartData.length > 0 ? (
        <div style={{ width: '100%', height: height - 40 }}>
          <style>
            {`
              .recharts-wrapper,
              .recharts-wrapper *,
              .recharts-surface,
              .recharts-surface * {
                outline: none !important;
              }
              .horizontal-bar-chart .recharts-bar-rectangle {
                cursor: ${onClick ? 'pointer' : 'default'};
              }
            `}
          </style>
          <ResponsiveContainer width="100%" height={height - 40} debounce={50}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={chartMargin}
              className="horizontal-bar-chart"
            >
              <XAxis
                type="number"
                domain={[0, maxValue * 1.2]}
                tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--color-gray-200)' }}
                tickLine={{ stroke: 'var(--color-gray-200)' }}
                hide
              />
              <YAxis
                type="category"
                dataKey="name"
                width={75}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
                tick={createCustomYAxisTick(yAxisLabelMaxLength) as any}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                content={<CustomTooltip unit={unit} total={total} />}
                cursor={{ fill: 'var(--color-gray-50)' }}
              />
              <Bar
                dataKey="value"
                barSize={barHeight}
                radius={[0, 4, 4, 0]}
                onClick={(data) => handleBarClick(data as HorizontalBarDataItem)}
                isAnimationActive={true}
                animationDuration={1000}
                animationEasing="ease-out"
                animationBegin={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value) => `${value}${unit}`}
                  style={{
                    fill: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: height - 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon={BarChart3} message={emptyMessage} />
        </div>
      )}

      {/* 더 많은 항목이 있는 경우 표시 */}
      {data.length > maxItems && (
        <div
          style={{
            marginTop: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            textAlign: 'center',
          }}
        >
          외 {data.length - maxItems}개 항목
        </div>
      )}
    </Card>
  );
}
