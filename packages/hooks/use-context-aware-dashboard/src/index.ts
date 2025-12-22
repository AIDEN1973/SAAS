/**
 * useContextAwareDashboard Hook
 *
 * 프론트 자동화 문서 6.2.1 섹션 참조
 * 상황 인식 대시보드 Hook
 *
 * 기능:
 * - 현재 시간, 요일, 월말 여부 등 상황 감지
 * - 대시보드 카드 우선순위 자동 조정
 * - 상황별 추천 액션 제공
 */

import { useMemo } from 'react';
import { toKST } from '@lib/date-utils';
import { useTenantSettingByPath } from '@hooks/use-config';
import { useClasses } from '@hooks/use-class';
import type { DayOfWeek } from '@services/class-service';

/**
 * 오늘 요일을 DayOfWeek 형식으로 반환
 */
function getTodayDayOfWeek(): DayOfWeek {
  const todayKST = toKST();
  const dayOfWeek = todayKST.day(); // 0(일) ~ 6(토)
  const dayOfWeekMap: Record<number, DayOfWeek> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };
  return dayOfWeekMap[dayOfWeek];
}

export interface ContextAwareState {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: DayOfWeek;
  isMonthEnd: boolean;
  isWeekend: boolean;
  hasUpcomingClasses: boolean;
  hasFinishedClasses: boolean;
  recommendedActions: string[];
}

/**
 * 상황 인식 대시보드 Hook
 *
 * 현재 시간, 요일, 월말 여부 등 상황을 감지하고,
 * 대시보드 카드 우선순위를 자동 조정하며,
 * 상황별 추천 액션을 제공합니다.
 */
export function useContextAwareDashboard(): ContextAwareState {
  const currentTime = toKST();
  const hour = currentTime.hour();
  const day = currentTime.day();
  const date = currentTime.date();

  const timeOfDay = useMemo(() => {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }, [hour]);

  // 정본: Policy에서 조회 (하드코딩된 기본값 사용 금지)
  const { data: monthEndThresholdPolicy } = useTenantSettingByPath('billing.month_end_threshold_day');

  // 중요: Policy 값이 없으면 실행 안 함 (Default Policy는 테넌트 생성 시 설정값으로 저장됨)
  const monthEndThresholdDay = useMemo(() => {
    if (!monthEndThresholdPolicy) {
      return undefined;
    }
    return typeof monthEndThresholdPolicy === 'number' ? monthEndThresholdPolicy : undefined;
  }, [monthEndThresholdPolicy]);

  const isMonthEnd = useMemo(() => {
    if (monthEndThresholdDay === undefined) {
      return false; // Fail Closed
    }
    return date >= monthEndThresholdDay;
  }, [date, monthEndThresholdDay]);

  const isWeekend = useMemo(() => {
    return day === 0 || day === 6;
  }, [day]);

  const { data: todayClasses } = useClasses({ day_of_week: getTodayDayOfWeek() });

  const hasUpcomingClasses = useMemo(() => {
    if (!todayClasses || todayClasses.length === 0) return false;

    return todayClasses.some((cls) => {
      if (!cls.start_time) return false;

      const [h, m] = cls.start_time.split(':').map(Number);
      const classTime = currentTime.hour(h).minute(m).second(0).millisecond(0);
      return classTime.isAfter(currentTime) && classTime.diff(currentTime, 'minute') <= 60;
    });
  }, [todayClasses, currentTime]);

  // 수업 종료 후 감지 (수업 종료 후 30분 이내)
  const hasFinishedClasses = useMemo(() => {
    if (!todayClasses || todayClasses.length === 0) return false;

    return todayClasses.some((cls) => {
      if (!cls.start_time) return false;

      const [hour, minute] = cls.start_time.split(':').map(Number);
      const classStartTime = currentTime.hour(hour).minute(minute).second(0).millisecond(0);
      // 기본 수업 시간 60분 가정 (실제로는 cls.duration_minutes 사용)
      const durationMinutes = (cls as { duration_minutes?: number }).duration_minutes || 60;
      const classEndTime = classStartTime.add(durationMinutes, 'minute');
      const diffMinutes = currentTime.diff(classEndTime, 'minute');

      // 수업 종료 후 30분 이내
      return diffMinutes > 0 && diffMinutes <= 30;
    });
  }, [todayClasses, currentTime]);

  const recommendedActions = useMemo(() => {
    const actions: string[] = [];

    if (timeOfDay === 'morning' && hasUpcomingClasses) {
      actions.push('오늘 수업 준비');
    }

    if (isMonthEnd) {
      actions.push('이번 달 청구서 확인');
    }

    if (hasFinishedClasses) {
      actions.push('상담일지 작성');
    }

    return actions;
  }, [timeOfDay, hasUpcomingClasses, isMonthEnd, hasFinishedClasses]);

  return {
    timeOfDay,
    dayOfWeek: getTodayDayOfWeek(),
    isMonthEnd,
    isWeekend,
    hasUpcomingClasses,
    hasFinishedClasses, // 구현 완료: 수업 종료 후 30분 이내 감지
    recommendedActions,
  };
}

