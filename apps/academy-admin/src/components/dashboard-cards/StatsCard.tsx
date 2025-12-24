/**
 * Stats Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 */

import React, { useMemo } from 'react';
import {
  ClipboardCheck, Users, DollarSign, CreditCard, Clock,
  UserPlus, TrendingUp, Calendar, Package, Receipt,
  AlertCircle, BarChart3, UserCheck, UserX
} from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import type { StatsCard as StatsCardType } from '../../types/dashboardCard';
import { EMPTY_CARD_ID_PREFIX } from '../../constants/dashboard-cards';

export interface StatsCardProps {
  card: StatsCardType;
  onAction?: (card: StatsCardType) => void;
  onChartClick?: (card: StatsCardType) => void;
}

export function StatsCard({ card, onAction, onChartClick }: StatsCardProps) {
  // 빈 카드 여부 확인 (ID가 empty-로 시작하는 경우)
  const isEmpty = card.id.startsWith(EMPTY_CARD_ID_PREFIX);

  // 카드 ID에 따라 적절한 아이콘 선택
  const getIcon = useMemo(() => {
    if (isEmpty) return <BarChart3 style={{ width: '100%', height: '100%' }} />;

    // 출석 관련 지표
    if (card.id === 'stats-attendance-rate') {
      return <ClipboardCheck style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-late-rate') {
      return <Clock style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-absent-rate') {
      return <AlertCircle style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-weekly-attendance') {
      return <Calendar style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-monthly-attendance-rate') {
      return <Calendar style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-attendance-improvement-rate') {
      return <TrendingUp style={{ width: '100%', height: '100%' }} />;
    }

    // 학생 관련 지표
    if (card.id === 'stats-students') {
      return <Users style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-new-students') {
      return <UserPlus style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-weekly-new-students') {
      return <UserPlus style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-active-students') {
      return <UserCheck style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-inactive-students') {
      return <UserX style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-student-growth') {
      return <TrendingUp style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-student-retention-rate') {
      return <UserCheck style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-avg-students-per-class') {
      return <Package style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-avg-capacity-rate') {
      return <BarChart3 style={{ width: '100%', height: '100%' }} />;
    }

    // 매출 관련 지표
    if (card.id === 'stats-revenue') {
      return <DollarSign style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-expected-revenue') {
      return <DollarSign style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-arpu') {
      return <TrendingUp style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-revenue-growth') {
      return <TrendingUp style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-weekly-revenue') {
      return <DollarSign style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-avg-invoice-amount') {
      return <DollarSign style={{ width: '100%', height: '100%' }} />;
    }

    // 수납 관련 지표
    if (card.id === 'stats-unpaid-rate') {
      return <AlertCircle style={{ width: '100%', height: '100%' }} />;
    }
    if (card.id === 'stats-avg-collection-period') {
      return <Receipt style={{ width: '100%', height: '100%' }} />;
    }

    // 기본 아이콘
    return <BarChart3 style={{ width: '100%', height: '100%' }} />;
  }, [card.id, isEmpty]);

  return (
    <NotificationCardLayout
      key={card.id}
      title={card.title}
      value={card.value}
      unit={card.unit}
      trend={card.trend}
      isEmpty={isEmpty}
      onClick={() => !isEmpty && card.action_url && onAction?.(card)}
      icon={getIcon}
      onChartClick={card.chartDataKey && !isEmpty ? () => onChartClick?.(card) : undefined}
    />
  );
}
