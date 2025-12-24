/**
 * Regional Metric Card 컴포넌트
 *
 * 지역 통계 메트릭 카드 (학생 수, 매출, 출석률, 성장률)
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 */

import React from 'react';
import { Users, DollarSign, ClipboardCheck, TrendingUp } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';

export interface RegionalStats {
  region: string;
  rank: number;
  percentile: number;
  value: number;
  average: number;
  top10Percent: number;
  trend: string;
  insights: string[];
  comparisonGroup: 'same_dong' | 'same_sigungu' | 'same_sido' | 'same_region_zone' | 'insufficient';
  sampleCount: number;
  usedFallback: boolean;
  fallbackLevel: 'same_sigungu' | 'same_sido' | 'same_region_zone' | null;
  industryFilterRemoved: boolean;
  location_code: string;
  sigungu_code: string;
  sido_code: string;
}

export interface RegionalMetricCardProps {
  /** 메트릭 타입 */
  metric: 'students' | 'revenue' | 'attendance' | 'growth';
  /** 지역 통계 데이터 */
  regionalStats: RegionalStats;
  /** 현재 선택된 메트릭 */
  selectedMetric: 'students' | 'revenue' | 'attendance' | 'growth';
  /** 메트릭 선택 핸들러 */
  onSelect: (metric: 'students' | 'revenue' | 'attendance' | 'growth') => void;
}

const metricLabels: Record<'students' | 'revenue' | 'attendance' | 'growth', string> = {
  students: '학생 수',
  revenue: '매출',
  attendance: '출석률',
  growth: '성장률',
};

export function RegionalMetricCard({ metric, regionalStats, selectedMetric, onSelect }: RegionalMetricCardProps) {
  const isSelected = selectedMetric === metric;
  const canCalculateRank = regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount >= 3;

  // 값 포맷팅
  const formatValue = (): string => {
    if (!isSelected && metric !== 'students') {
      return '클릭하여 확인';
    }

    if (metric === 'students') {
      return regionalStats.value.toString();
    } else if (metric === 'revenue') {
      return regionalStats.value.toLocaleString();
    } else if (metric === 'attendance' || metric === 'growth') {
      return regionalStats.value.toString();
    }
    return regionalStats.value.toString();
  };

  // 단위 결정
  const formatUnit = (): string | undefined => {
    if (!isSelected && metric !== 'students') {
      return undefined;
    }

    if (metric === 'attendance' || metric === 'growth') {
      return '%';
    }
    return undefined; // 학생 수, 매출은 단위 없음
  };

  // 트렌드 표시 (선택된 메트릭일 때만 표시)
  // regionalStats.trend는 현재 selectedMetric에 대한 값이므로, 해당 메트릭일 때만 표시
  const displayTrend = isSelected && regionalStats.trend ? regionalStats.trend : undefined;

  // 아이콘 선택
  const getIcon = () => {
    switch (metric) {
      case 'students':
        return <Users style={{ width: '100%', height: '100%' }} />;
      case 'revenue':
        return <DollarSign style={{ width: '100%', height: '100%' }} />;
      case 'attendance':
        return <ClipboardCheck style={{ width: '100%', height: '100%' }} />;
      case 'growth':
        return <TrendingUp style={{ width: '100%', height: '100%' }} />;
      default:
        return null;
    }
  };

  return (
    <NotificationCardLayout
      title={metricLabels[metric]}
      value={formatValue()}
      unit={formatUnit()}
      trend={displayTrend}
      onClick={() => onSelect(metric)}
      icon={getIcon()}
    />
  );
}

