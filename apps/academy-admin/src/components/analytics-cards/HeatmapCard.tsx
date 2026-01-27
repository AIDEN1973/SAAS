/**
 * 지역 히트맵 카드 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 * [불변 규칙] UI Core Component 사용, SSOT 원칙 준수
 * [요구사항] 통계문서 FR-06: 행정동 히트맵 시각화
 *
 * Purpose: AnalyticsPage에서 분리된 히트맵 표시 컴포넌트
 * Features: Rich 툴팁, 모바일 스와이프, 주간 접기/펼치기
 */

import React, { useState, useRef, useMemo } from 'react';
import { Card, Button, EmptyState } from '@ui-core/react';
import { MapPin } from 'lucide-react';
import { useIndustryTerms } from '@hooks/use-industry-terms';

export interface HeatmapData {
  date: string;
  value: number;
  intensity: number;
  weeklyAverage?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface HeatmapCardProps {
  /** 히트맵 타입 */
  heatmapType: 'growth' | 'attendance' | 'students';
  /** 히트맵 타입 변경 핸들러 */
  onTypeChange: (type: 'growth' | 'attendance' | 'students') => void;
  /** 히트맵 데이터 */
  data: HeatmapData[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 지역 정보 */
  locationInfo: {
    location_code: string;
    sigungu_code: string;
  };
  /** Tenant ID */
  tenantId: string | null;
}

export function HeatmapCard({
  heatmapType,
  onTypeChange,
  data,
  isLoading,
  locationInfo,
  tenantId,
}: HeatmapCardProps) {
  const terms = useIndustryTerms();
  const [hoveredCell, setHoveredCell] = useState<HeatmapData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0, 1, 2, 3])); // 기본 4주 펼침
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  // [SSOT] 업종별 동적 라벨
  const HEATMAP_TYPE_LABELS: Record<'growth' | 'attendance' | 'students', string> = useMemo(() => ({
    growth: '성장률',
    attendance: terms.ATTENDANCE_LABEL + '률',
    students: `${terms.PERSON_LABEL_PRIMARY} 수`,
  }), [terms]);

  // 주차별 데이터 그룹화 (React Hooks는 조건문 위에서 호출해야 함)
  const weeklyData = useMemo(() => {
    const weeks: HeatmapData[][] = [];
    for (let i = 0; i < data.length; i += 7) {
      weeks.push(data.slice(i, i + 7));
    }
    return weeks;
  }, [data]);

  // 주간 평균 계산
  const calculateWeeklyAverage = (weekData: HeatmapData[]): number => {
    if (weekData.length === 0) return 0;
    const sum = weekData.reduce((acc, d) => acc + d.value, 0);
    return Math.round(sum / weekData.length);
  };

  // 주 접기/펼치기 토글
  const toggleWeek = (weekIndex: number) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekIndex)) {
        newSet.delete(weekIndex);
      } else {
        newSet.add(weekIndex);
      }
      return newSet;
    });
  };

  // 모든 주 펼치기/접기
  const toggleAllWeeks = () => {
    if (expandedWeeks.size === weeklyData.length) {
      setExpandedWeeks(new Set());
    } else {
      setExpandedWeeks(new Set(Array.from({ length: weeklyData.length }, (_, i) => i)));
    }
  };

  // 터치 이벤트 핸들러 (모바일 스와이프)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = touchStartX - e.touches[0].clientX;
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollOffset + deltaX;
    }
  };

  const handleTouchEnd = () => {
    if (containerRef.current) {
      setScrollOffset(containerRef.current.scrollLeft);
    }
  };

  // 마우스 호버 핸들러 (툴팁)
  const handleMouseEnter = (cell: HeatmapData, event: React.MouseEvent) => {
    setHoveredCell(cell);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
    setTooltipPosition(null);
  };

  // 빈 상태 체크 (React Hooks 호출 후에 조건부 렌더링)
  if (!tenantId) {
    console.log('[HeatmapCard] tenantId가 없습니다');
    return null;
  }

  if (!locationInfo.location_code && !locationInfo.sigungu_code) {
    console.log('[HeatmapCard] 지역 정보가 없습니다', locationInfo);
    return (
      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-md)' }}>지역 히트맵</h2>
        <EmptyState
          icon={MapPin}
          message="지역 정보를 설정해주세요."
        />
      </Card>
    );
  }

  return (
    <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h2>지역 히트맵</h2>
        {weeklyData.length > 0 && (
          <Button variant="outline" size="sm" onClick={toggleAllWeeks}>
            {expandedWeeks.size === weeklyData.length ? '모두 접기' : '모두 펼치기'}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* 히트맵 타입 선택 */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {(Object.keys(HEATMAP_TYPE_LABELS) as Array<'growth' | 'attendance' | 'students'>).map((type) => (
            <Button
              key={type}
              variant={heatmapType === type ? 'solid' : 'outline'}
              size="sm"
              onClick={() => onTypeChange(type)}
            >
              {HEATMAP_TYPE_LABELS[type]}
            </Button>
          ))}
        </div>

        {/* 히트맵 시각화 (주간 그룹화) */}
        {isLoading ? (
          <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
            로딩 중...
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={MapPin}
            message="히트맵 데이터가 없습니다."
            description="지역 정보를 설정하거나 충분한 데이터가 쌓일 때까지 기다려주세요."
          />
        ) : (
          <div
            ref={containerRef}
            style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {weeklyData.map((weekData, weekIndex) => (
              <div key={weekIndex} style={{ marginBottom: 'var(--spacing-md)' }}>
                {/* 주간 헤더 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-background-subtle)',
                    borderRadius: 'var(--border-radius-sm)',
                    cursor: 'pointer',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                  onClick={() => toggleWeek(weekIndex)}
                >
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
                    {weekIndex + 1}주차 (평균: {calculateWeeklyAverage(weekData)})
                  </span>
                  <span>{expandedWeeks.has(weekIndex) ? '▼' : '▶'}</span>
                </div>

                {/* 주간 셀 (펼쳐진 경우만 표시) */}
                {expandedWeeks.has(weekIndex) && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      gap: 'var(--spacing-xs)',
                      padding: 'var(--spacing-sm)',
                    }}
                  >
                    {weekData.map((item) => (
                      <div
                        key={item.date}
                        style={{
                          aspectRatio: '1',
                          backgroundColor: `rgba(66, 139, 202, ${item.intensity})`,
                          borderRadius: 'var(--border-radius-xs)',
                          transition: 'transform var(--transition-base)',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.15)';
                          handleMouseEnter(item, e);
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          handleMouseLeave();
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rich 툴팁 */}
      {hoveredCell && tooltipPosition && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y + 10,
            backgroundColor: 'var(--color-background-primary)',
            border: '1px solid var(--color-border-base)',
            borderRadius: 'var(--border-radius-base)',
            padding: 'var(--spacing-sm)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            pointerEvents: 'none',
            maxWidth: '200px',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)', fontWeight: 'var(--font-weight-semibold)' }}>
            {hoveredCell.date}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)' }}>
            값: {hoveredCell.value}
          </div>
          {hoveredCell.weeklyAverage && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              주간 평균: {hoveredCell.weeklyAverage}
            </div>
          )}
          {hoveredCell.trend && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: hoveredCell.trend === 'up' ? '#5cb85c' : hoveredCell.trend === 'down' ? '#d9534f' : 'var(--color-text-secondary)' }}>
              {hoveredCell.trend === 'up' ? '▲ 증가' : hoveredCell.trend === 'down' ? '▼ 감소' : '→ 유지'}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
