/**
 * Attendance Stats Card 컴포넌트
 *
 * 출석 통계 카드 (출석률, 출석/지각/결석/미체크)
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 */

import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import type { AttendanceStats } from '@hooks/use-student';

export interface AttendanceStatsCardProps {
  stats: AttendanceStats | undefined;
  isLoading?: boolean;
  onAction?: () => void;
}

export function AttendanceStatsCard({ stats, isLoading, onAction }: AttendanceStatsCardProps) {
  const isEmpty = !stats || isLoading;

  return (
    <NotificationCardLayout
      title="오늘 출석률"
      value={isEmpty ? '-' : stats.attendance_rate}
      unit="%"
      isEmpty={isEmpty}
      onClick={onAction}
      icon={<ClipboardCheck style={{ width: '100%', height: '100%' }} />}
    />
  );
}

