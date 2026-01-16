/**
 * StatsDashboard Component
 *
 * 통계 카드와 그래프를 포함하는 대시보드 공통 컴포넌트
 *
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] 재사용 가능한 공통 컴포넌트
 */

import { useMemo, useState, useEffect, useRef, createElement } from 'react';
import { Card, NotificationCardLayout, EmptyState, useIconSize } from '@ui-core/react';
import { CardGridLayout } from '../CardGridLayout';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

export interface StatsItem {
  key: string;
  icon: LucideIcon;
  title: string;
  value: number;
  unit: string;
  iconBackgroundColor: string;
  /** 지난달 대비 증감 (이번달 선택 시 표시, 예: "+10%", "-5%") */
  trend?: string;
}

export interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

export type PeriodFilter = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | '1month' | '3months' | '6months' | '1year';

export interface StatsDashboardProps {
  /** 통계 카드 데이터 (2x2 배열) */
  statsItems: StatsItem[];
  /** 차트 데이터 */
  chartData: ChartDataItem[];
  /** 기간 필터 값 */
  period: PeriodFilter;
  /** 기간 필터 변경 핸들러 */
  onPeriodChange: (period: PeriodFilter) => void;
  /** 차트 레이블 포맷 함수 (선택적) */
  chartLabelFormatter?: (params: { name: string; value: number; percent?: number }) => string;
  /** 범례 포맷 함수 (선택적) */
  legendFormatter?: (value: string, entry: Record<string, unknown>) => string;
  /** 기간 필터 표시 여부 (기본값: true) */
  showPeriodFilter?: boolean;
  /** 선택된 통계 카드 key */
  selectedStatsKey?: string;
  /** 통계 카드 클릭 핸들러 */
  onStatsCardClick?: (key: string) => void;
}

/**
 * StatsDashboard 컴포넌트
 *
 * 좌측 50%: 통계 카드 (2x2)
 * 우측 50%: 도넛 차트 + 기간 필터
 */
export function StatsDashboard({
  statsItems,
  chartData,
  period,
  onPeriodChange,
  // 향후 확장을 위해 props 유지 (현재 미사용)
  // chartLabelFormatter,
  // legendFormatter,
  // showPeriodFilter = true,
  selectedStatsKey,
  onStatsCardClick,
}: StatsDashboardProps) {
  // [SSOT] 아이콘 크기 (CSS 변수 기반)
  const iconSize = useIconSize();

  // 0이 아닌 데이터만 필터링
  const filteredChartData = useMemo(() => {
    return chartData.filter(item => item.value > 0);
  }, [chartData]);

  // [성능 최적화] 차트 스타일 객체 메모이제이션 (매 렌더링마다 새 객체 생성 방지)
  const chartStyles = useMemo(() => ({
    tick: { fill: 'var(--color-text-secondary)', fontSize: 12 },
    tooltipContent: {
      backgroundColor: 'var(--color-white)',
      border: 'var(--border-width-thin) solid var(--color-gray-200)',
      borderRadius: 'var(--border-radius-sm)',
      padding: 'var(--spacing-sm)',
    },
    dot: { fill: 'var(--color-primary)', r: 4 },
    activeDot: { r: 6 },
    margin: { left: 10, right: 40, top: 10, bottom: 10 },
  }), []);

  // 기간 필터 옵션 (배지 버튼용)
  const periodBadgeOptions = [
    { value: 'thisMonth', label: '이번달', tooltip: undefined },
    { value: 'lastMonth', label: '지난달', tooltip: undefined },
    { value: '1month', label: '1m', tooltip: '최근 1개월' },
    { value: '3months', label: '3m', tooltip: '최근 3개월' },
    { value: '6months', label: '6m', tooltip: '최근 6개월' },
    { value: '1year', label: '12m', tooltip: '최근 12개월' },
  ];

  // hover 상태 관리 (Button 컴포넌트와 동일한 패턴)
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  // 그래프 표시 여부 상태 (localStorage에 저장)
  const CHART_VISIBLE_KEY = 'stats-chart-visible';
  const [showChart, setShowChart] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CHART_VISIBLE_KEY);
      if (saved === 'false') return false;
    }
    return true;
  });

  // 그래프 애니메이션 상태
  const chartContentRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState<number>(0);

  // 그래프 높이 측정
  useEffect(() => {
    if (chartContentRef.current) {
      const height = chartContentRef.current.scrollHeight;
      setChartHeight(height);
    }
  }, [filteredChartData]);

  // 그래프 토글 핸들러
  const handleToggleChart = () => {
    const nextValue = !showChart;
    setShowChart(nextValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CHART_VISIBLE_KEY, String(nextValue));
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 기간 필터 배지 (통계카드 외부 우측 상단) */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: 'var(--spacing-md)',
      }}>
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-xs)',
        }}>
          {periodBadgeOptions.map((option) => {
            const isSelected = period === option.value;
            const isHovered = hoveredBadge === option.value;

            // hover 시 배경색 계산 (Button 컴포넌트 패턴 참조)
            const getBackgroundColor = () => {
              if (isSelected) {
                return isHovered ? 'var(--color-primary-dark)' : 'var(--color-primary)';
              }
              return isHovered ? 'var(--color-primary-hover)' : 'var(--color-white)';
            };

            const buttonElement = (
              <button
                onClick={() => onPeriodChange(option.value as PeriodFilter)}
                onMouseEnter={() => setHoveredBadge(option.value)}
                onMouseLeave={() => setHoveredBadge(null)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  backgroundColor: getBackgroundColor(),
                  color: isSelected ? 'var(--color-white)' : 'var(--color-text-secondary)',
                  border: isSelected ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                  borderRadius: 'var(--border-radius-xs)',
                  cursor: 'pointer',
                  transition: 'var(--transition-all)',
                  minWidth: 'auto',
                  minHeight: 'auto',
                }}
              >
                {option.label}
              </button>
            );

            // 툴팁이 있고 선택된 경우에만 고정 툴팁 표시
            if (option.tooltip && isSelected) {
              return (
                <div key={option.value} style={{ position: 'relative', display: 'inline-block' }}>
                  {/* 고정 툴팁 */}
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + var(--spacing-tooltip-offset))',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-white)',
                    fontSize: 'var(--font-size-xs)',
                    borderRadius: 'var(--border-radius-xs)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 1000,
                  }}>
                    {option.tooltip}
                    {/* 화살표 */}
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: 'var(--spacing-xs) solid transparent',
                      borderRight: 'var(--spacing-xs) solid transparent',
                      borderTop: 'var(--spacing-xs) solid var(--color-primary)',
                    }} />
                  </div>
                  {buttonElement}
                </div>
              );
            }

            // 툴팁이 없거나 선택되지 않은 경우 버튼만 반환
            return <div key={option.value} style={{ display: 'inline-block' }}>{buttonElement}</div>;
          })}
        </div>
      </div>

      {/* 통계 카드 (100% 너비, 4개 가로 배열) */}
      <div style={{ width: '100%', position: 'relative' }}>
        <CardGridLayout
          cards={statsItems.map((item) => {
            const isCardSelected = selectedStatsKey === item.key;
            return (
              <NotificationCardLayout
                key={item.key}
                icon={createElement(item.icon)}
                title={item.title}
                value={item.value}
                unit={item.unit}
                trend={period === 'thisMonth' ? item.trend : undefined} // 이번달 선택 시에만 지난달 대비 증감 표시
                layoutMode="stats"
                iconBackgroundColor={isCardSelected ? 'var(--color-primary)' : item.iconBackgroundColor}
                isSelected={isCardSelected}
                onClick={onStatsCardClick ? () => onStatsCardClick(item.key) : undefined}
              />
            );
          })}
          desktopColumns={4}
          tabletColumns={2}
          mobileColumns={1}
        />

        {/* CardGridLayout 하단 구분선에 붙는 토글 버튼 */}
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: 'calc(-1 * var(--spacing-md))',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}>
          <button
            onClick={handleToggleChart}
            aria-label={showChart ? '그래프 숨기기' : '그래프 표시'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'var(--spacing-2xl)',
              height: 'var(--spacing-md)',
              backgroundColor: 'var(--color-text)',
              border: 'var(--border-width-thin) solid var(--color-text)',
              borderTop: 'none',
              borderRadius: '0 0 var(--border-radius-sm) var(--border-radius-sm)',
              cursor: 'pointer',
              padding: 0,
              transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-text)';
            }}
          >
            {showChart ? (
              <ChevronUp size={iconSize} color="var(--color-white)" />
            ) : (
              <ChevronDown size={iconSize} color="var(--color-white)" />
            )}
          </button>
        </div>
      </div>

      {/* 그래프 */}
      <div style={{
        width: '100%',
        maxHeight: showChart ? `${chartHeight}px` : '0px',
        overflow: 'hidden',
        transition: 'max-height var(--transition-slow), opacity var(--transition-slow)',
        opacity: showChart ? 1 : 0,
        marginTop: showChart ? 'var(--spacing-2xl)' : 0,
      }}>
        <div ref={chartContentRef} style={{ width: '100%' }}>
        <Card padding="lg" variant="default" style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 'calc(var(--spacing-lg) + var(--spacing-lg))' }}>
          {/* 그래프 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {filteredChartData.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
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
                <ResponsiveContainer width="100%" height={300} debounce={100}>
                  <AreaChart data={filteredChartData.map((item: ChartDataItem) => ({ ...item }))} margin={chartStyles.margin}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
                    <XAxis
                      dataKey="name"
                      tick={chartStyles.tick}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={chartStyles.tick}
                      tickFormatter={(value: number | string) => {
                        const numValue = typeof value === 'number' ? value : Number(value);
                        return numValue === 0 ? '' : numValue.toString();
                      }}
                      tickMargin={8}
                      width={30}
                    />
                    <RechartsTooltip
                      contentStyle={chartStyles.tooltipContent}
                      formatter={(value: number | undefined) => value !== undefined ? [`${value}명`, '총 학생수'] : ['', '']}
                      labelFormatter={(label) => `날짜: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="var(--color-primary-40)"
                      dot={chartStyles.dot}
                      activeDot={chartStyles.activeDot}
                      isAnimationActive={true}
                      animationDuration={800}
                      animationEasing="ease-in-out"
                      animationBegin={0}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <EmptyState
                  icon={BarChart3}
                  message="표시할 데이터가 없습니다"
                />
              </div>
            )}
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}
