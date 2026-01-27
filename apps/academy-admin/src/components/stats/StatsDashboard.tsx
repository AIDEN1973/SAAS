/**
 * StatsDashboard Component
 *
 * 통계 카드와 그래프를 포함하는 대시보드 공통 컴포넌트
 *
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] 재사용 가능한 공통 컴포넌트
 */

import { useMemo, useState, useEffect, useRef, createElement } from 'react';
import { Card, NotificationCardLayout, EmptyState, useIconSize, useChartColors, useLayerMenuTransition } from '@ui-core/react';
import { CardGridLayout } from '../CardGridLayout';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
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
  /** 기간 필터 값 (hideChart가 true면 선택적) */
  period?: PeriodFilter;
  /** 기간 필터 변경 핸들러 (hideChart가 true면 선택적) */
  onPeriodChange?: (period: PeriodFilter) => void;
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
  /** 차트 영역 숨김 여부 (기본값: false) - true이면 통계 카드만 표시 */
  hideChart?: boolean;
  /** 차트 툴팁 단위 (기본값: '명') */
  chartTooltipUnit?: string;
  /** 차트 툴팁 레이블 (기본값: '총 학생수') */
  chartTooltipLabel?: string;
  /** 데스크탑 컬럼 수 (기본값: statsItems 개수) */
  desktopColumns?: number;
  /** 태블릿 컬럼 수 (기본값: 2) */
  tabletColumns?: number;
  /** 모바일 컬럼 수 (기본값: 1) */
  mobileColumns?: number;
  /** 차트 타입 (기본값: 'area') */
  chartType?: 'area' | 'bar';
  /** 0 값 데이터 표시 여부 (기본값: false, 0 값 필터링) */
  showZeroValues?: boolean;
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
  showPeriodFilter = true,
  selectedStatsKey,
  onStatsCardClick,
  hideChart = false,
  chartTooltipUnit = '명',
  chartTooltipLabel = '총 학생수',
  desktopColumns,
  tabletColumns = 2,
  mobileColumns = 1,
  chartType = 'area',
  showZeroValues = false,
}: StatsDashboardProps) {
  // [SSOT] 아이콘 크기 (CSS 변수 기반)
  const iconSize = useIconSize();

  // [SSOT] 차트 색상 (SVG 속성용)
  const chartColors = useChartColors();

  // [깜빡임 방지] 레이어 메뉴 transition 상태 감지
  const isLayerMenuTransitioning = useLayerMenuTransition();

  // 차트 데이터 필터링 (0 값 포함 여부에 따라)
  const filteredChartData = useMemo(() => {
    console.log('[StatsDashboard] Raw chartData:', chartData);
    console.log('[StatsDashboard] showZeroValues:', showZeroValues);

    if (showZeroValues) {
      console.log('[StatsDashboard] Returning all data (showZeroValues=true)');
      return chartData;
    }

    const filtered = chartData.filter(item => item.value > 0);
    console.log('[StatsDashboard] Filtered data (value > 0):', filtered);
    return filtered;
  }, [chartData, showZeroValues]);

  // [성능 최적화] 차트 스타일 객체 메모이제이션 (매 렌더링마다 새 객체 생성 방지)
  const chartStyles = useMemo(() => ({
    tick: { fill: 'var(--color-text-secondary)', fontSize: 12 },
    tooltipContent: {
      backgroundColor: 'var(--color-white)',
      border: 'var(--border-width-thin) solid var(--color-gray-200)',
      borderRadius: 'var(--border-radius-sm)',
      padding: 'var(--spacing-sm)',
    },
    dot: { fill: chartColors.primary, r: 4 },
    activeDot: { r: 6 },
    margin: { left: 10, right: 40, top: 10, bottom: 10 },
  }), [chartColors.primary]);

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
      console.log('[StatsDashboard] Chart visibility from localStorage:', saved);
      if (saved === 'true') return true;
    }
    return false;
  });

  console.log('[StatsDashboard] Current showChart state:', showChart);
  console.log('[StatsDashboard] hideChart prop:', hideChart);

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
      {/* 기간 필터 배지 (통계카드 외부 우측 상단) - showPeriodFilter가 true일 때만 표시 */}
      {showPeriodFilter && (
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
                onClick={() => onPeriodChange?.(option.value as PeriodFilter)}
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
      )}

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
          desktopColumns={desktopColumns ?? statsItems.length}
          tabletColumns={tabletColumns}
          mobileColumns={mobileColumns}
        />

        {/* CardGridLayout 하단 구분선에 붙는 토글 버튼 (hideChart가 false일 때만 표시) */}
        {!hideChart && (
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
        )}
      </div>

      {/* 그래프 (hideChart가 false일 때만 렌더링) */}
      {!hideChart && (
        <div style={{
          width: '100%',
          maxHeight: showChart ? `${chartHeight}px` : '0px',
          overflow: 'hidden',
          transition: 'max-height var(--transition-slow), opacity var(--transition-slow)',
          opacity: showChart ? 1 : 0,
          marginTop: showChart ? 'var(--spacing-2xl)' : 0,
          contain: 'layout style paint',
          willChange: 'max-height, opacity',
        }}>
        <div ref={chartContentRef} style={{ width: '100%', contain: 'layout style' }}>
        <Card padding="lg" variant="default" style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 'calc(var(--spacing-lg) + var(--spacing-lg))' }}>
          {/* 그래프 - transition 중에는 숨겨서 깜빡임 방지 */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: chartType === 'bar' ? '600px' : '300px',
              overflowY: chartType === 'bar' ? 'auto' : 'visible',
              // transition 중에는 차트를 숨김
              visibility: isLayerMenuTransitioning ? 'hidden' : 'visible',
              opacity: isLayerMenuTransitioning ? 0 : 1,
              transition: 'opacity 0.15s ease-out',
            }}
          >
            {filteredChartData.length > 0 ? (
              <div
                style={{
                  width: '100%',
                  height: chartType === 'bar' ? Math.max(300, filteredChartData.length * 40) : 300,
                  contain: 'strict',
                }}
                className="chart-animate-up"
              >
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
                <ResponsiveContainer width="100%" height={Math.max(300, filteredChartData.length * 40)} debounce={300}>
                  {chartType === 'bar' ? (
                    <BarChart
                      data={filteredChartData}
                      layout="horizontal"
                      margin={{ left: 10, right: 40, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
                      <XAxis
                        type="number"
                        tick={chartStyles.tick}
                        tickMargin={8}
                        tickFormatter={(value: number | string) => {
                          const numValue = typeof value === 'number' ? value : Number(value);
                          return numValue === 0 ? '' : numValue.toString();
                        }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={chartStyles.tick}
                        tickMargin={8}
                        width={100}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;

                          return (
                            <div style={{
                              backgroundColor: 'var(--color-white)',
                              border: 'var(--border-width-thin) solid var(--color-gray-200)',
                              borderRadius: 'var(--border-radius-sm)',
                              padding: 'var(--spacing-sm)',
                            }}>
                              <div style={{
                                marginBottom: 'var(--spacing-xs)',
                                fontSize: 'var(--font-size-sm)',
                              }}>
                                수업명 : {label}
                              </div>
                              {payload.map((entry: { value?: number | string }, index: number) => (
                                <div
                                  key={`item-${index}`}
                                  style={{
                                    fontSize: 'var(--font-size-xs)',
                                    lineHeight: 1.2,
                                    color: 'var(--color-text)',
                                  }}
                                >
                                  {chartTooltipLabel} : {entry.value}{chartTooltipUnit}
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill={chartColors.primary}
                        radius={[0, 4, 4, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  ) : (
                    <AreaChart data={filteredChartData} margin={chartStyles.margin}>
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
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;

                          return (
                            <div style={{
                              backgroundColor: 'var(--color-white)',
                              border: 'var(--border-width-thin) solid var(--color-gray-200)',
                              borderRadius: 'var(--border-radius-sm)',
                              padding: 'var(--spacing-sm)',
                            }}>
                              <div style={{
                                marginBottom: 'var(--spacing-xs)',
                                fontSize: 'var(--font-size-sm)',
                              }}>
                                날짜 : {label}
                              </div>
                              {payload.map((entry: { value?: number | string }, index: number) => (
                                <div
                                  key={`item-${index}`}
                                  style={{
                                    fontSize: 'var(--font-size-xs)',
                                    lineHeight: 1.2,
                                    color: 'var(--color-text)',
                                  }}
                                >
                                  {chartTooltipLabel} : {entry.value}{chartTooltipUnit}
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={chartColors.primary}
                        strokeWidth={2}
                        fill={chartColors.primary50}
                        dot={chartStyles.dot}
                        activeDot={chartStyles.activeDot}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  )}
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
      )}
    </div>
  );
}
