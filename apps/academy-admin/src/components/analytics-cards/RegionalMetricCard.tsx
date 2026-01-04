/**
 * Regional Metric Card 컴포넌트
 *
 * 지역 통계 메트릭 카드 (Phase 1-3 전체 메트릭 지원)
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 */

import { Users, DollarSign, ClipboardCheck, TrendingUp, UserPlus, Wallet, Target, AlertCircle, UserMinus, Clock, UserX } from 'lucide-react';
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

type MetricType = 'students' | 'revenue' | 'attendance' | 'growth' | 'new_enrollments' | 'arpu' |
  'capacity_rate' | 'overdue_rate' | 'churn_rate' | 'late_rate' | 'absent_rate';

export interface RegionalMetricCardProps {
  /** 메트릭 타입 */
  metric: MetricType;
  /** 지역 통계 데이터 */
  regionalStats: RegionalStats;
  /** 현재 선택된 메트릭 */
  selectedMetric: MetricType;
  /** 메트릭 선택 핸들러 */
  onSelect: (metric: MetricType) => void;
  /** 이 메트릭의 실제 값 */
  metricValue: number;
}

const metricLabels: Record<MetricType, string> = {
  students: '학생 수',
  revenue: '매출',
  attendance: '출석률',
  growth: '성장률',
  new_enrollments: '신규 등록',
  arpu: 'ARPU',
  capacity_rate: '정원률',
  overdue_rate: '미납률',
  churn_rate: '퇴원율',
  late_rate: '지각률',
  absent_rate: '결석률',
};

export function RegionalMetricCard({ metric, regionalStats, selectedMetric, onSelect, metricValue }: RegionalMetricCardProps) {
  const isSelected = selectedMetric === metric;

  // 값 포맷팅 - 각 메트릭의 독립적인 값을 항상 표시
  const formatValue = (): string => {
    if (metric === 'students' || metric === 'new_enrollments') {
      return metricValue.toString();
    } else if (metric === 'revenue' || metric === 'arpu') {
      // [P1 수정] toLocaleString() 대신 Intl.NumberFormat 사용
      const formatter = new Intl.NumberFormat('ko-KR');
      return formatter.format(metricValue);
    } else if (metric === 'attendance' || metric === 'growth' || metric === 'capacity_rate' ||
               metric === 'overdue_rate' || metric === 'churn_rate' || metric === 'late_rate' ||
               metric === 'absent_rate') {
      return metricValue.toString();
    }
    return metricValue.toString();
  };

  // 단위 결정 - 모든 메트릭의 단위를 항상 표시
  const formatUnit = (): string | undefined => {
    if (metric === 'attendance' || metric === 'growth' || metric === 'capacity_rate' ||
        metric === 'overdue_rate' || metric === 'churn_rate' || metric === 'late_rate' ||
        metric === 'absent_rate') {
      return '%';
    }
    if (metric === 'arpu') {
      return '원';
    }
    if (metric === 'students' || metric === 'new_enrollments') {
      return '명';
    }
    return undefined;
  };

  // 트렌드 표시 (선택된 메트릭일 때만 표시)
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
      case 'new_enrollments':
        return <UserPlus style={{ width: '100%', height: '100%' }} />;
      case 'arpu':
        return <Wallet style={{ width: '100%', height: '100%' }} />;
      case 'capacity_rate':
        return <Target style={{ width: '100%', height: '100%' }} />;
      case 'overdue_rate':
        return <AlertCircle style={{ width: '100%', height: '100%' }} />;
      case 'churn_rate':
        return <UserMinus style={{ width: '100%', height: '100%' }} />;
      case 'late_rate':
        return <Clock style={{ width: '100%', height: '100%' }} />;
      case 'absent_rate':
        return <UserX style={{ width: '100%', height: '100%' }} />;
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
      isSelected={isSelected}
    />
  );
}

