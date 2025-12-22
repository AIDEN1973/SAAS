/**
 * useAdaptiveNavigation Hook
 *
 * 레거시: 이 Hook은 레거시 호환을 위해 유지됩니다.
 * 정본 권장 이름: useContextSignals (프론트 자동화 문서 1.2.1 섹션 참조)
 *
 * 프론트 자동화 문서 역할 재정의:
 * - 상황 신호 수집 (Context Signal Collection)
 * - UI 조정 (Priority 가중치, 배너 표시)
 * - 자동 화면 전환 금지 (navigate() 자동 호출 금지)
 * - 실행 금지 (프론트엔드는 실행하지 않음)
 *
 * 아키텍처 문서 요구사항:
 * - 수업 시작 10분 전 → 출석부 카드 우선순위 상승 + 추천 배너 표시
 * - 수업 종료 후 → 상담일지 작성 StudentTaskCard 생성 (서버가 생성)
 * - 월말 → 청구 카드 priority +2 (그룹 순서는 불변)
 */

import { useMemo, useState } from 'react';
import { useClasses } from '@hooks/use-class';
import { useConfig } from '@hooks/use-config';
import { toKST } from '@lib/date-utils';
import type { DayOfWeek } from '@services/class-service';

// v3.3 정본: ContextRecommendation (레거시: AdaptiveNavigationRule)
export interface ContextRecommendation {
  id: string;
  trigger_type: 'time_based' | 'event_based' | 'pattern_based';
  condition: {
    time_range?: { start: string; end: string }; // HH:mm 형식
    day_of_week?: DayOfWeek[];
    class_id?: string;
    minutes_before?: number; // 수업 시작 N분 전
    minutes_after?: number; // 수업 종료 N분 후
  };
  action: {
    type: 'show_banner' | 'highlight_card' | 'adjust_priority'; // 정본: navigate 제거
    target: string; // 경로 또는 컴포넌트 ID (사용자가 클릭 시 이동)
    priority: number; // 0-100, 높을수록 우선순위 높음 (정본: 0-100 스케일)
    require_confirmation?: boolean; // 승인 필요 여부
    // auto_execute 제거: 정본 규칙에 따라 자동 실행 금지
  };
  enabled: boolean;
}

// 레거시 호환: AdaptiveNavigationRule = ContextRecommendation
export type AdaptiveNavigationRule = ContextRecommendation;

export interface ContextSignals {
  time_of_day: 'morning' | 'afternoon' | 'evening';
  is_month_end: boolean;
  has_upcoming_class: boolean;
  has_finished_class: boolean;
  device_mode: 'desktop' | 'tablet' | 'mobile';
}

export interface UseAdaptiveNavigationReturn {
  currentRecommendation: ContextRecommendation | null;
  contextSignals: ContextSignals; // 정본: 상황 신호만 제공
  goToRecommendation: () => void; // 정본: 사용자 클릭 시 이동 (실행 아님, executeRecommendation → goToRecommendation)
  dismissRecommendation: () => void;
  // shouldAutoNavigate 제거: 정본 규칙에 따라 자동 이동 금지
  isDismissed: boolean; // 레거시 호환
}

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

/**
 * Adaptive Navigation Hook (레거시 호환)
 *
 * 정본 권장 이름: useContextSignals
 * 프론트 자동화 문서 1.2.1 섹션 참조
 *
 * 역할 재정의:
 * - 상황 신호 수집 및 UI 조정
 * - 수업 시작 10분 전 감지 시 출석부 카드 priority 가중치 + 추천 배너 표시
 * - 수업 종료 후 → 서버가 StudentTaskCard 생성 (프론트엔드는 생성하지 않음)
 * - 자동 navigate() 호출 금지
 * - 자동 실행 금지
 */
export function useAdaptiveNavigation(): UseAdaptiveNavigationReturn {
  const [isDismissed, setIsDismissed] = useState(false);
  const currentTime = toKST();
  const todayDayOfWeek = getTodayDayOfWeek();

  // 오늘 수업 목록 조회
  const { data: todayClassesData } = useClasses({
    day_of_week: todayDayOfWeek,
    status: 'active',
  });

  // 수업 시작 10분 전 감지
  const upcomingClass = useMemo(() => {
    if (!todayClassesData || todayClassesData.length === 0) return null;

    return todayClassesData.find((cls) => {
      if (!cls.start_time) return false;

      const [hour, minute] = cls.start_time.split(':').map(Number);
      const classStartTime = currentTime.hour(hour).minute(minute).second(0).millisecond(0);
      const diffMinutes = classStartTime.diff(currentTime, 'minute');

      // 수업 시작 10분 전 ~ 수업 시작 시점
      return diffMinutes > 0 && diffMinutes <= 10;
    });
  }, [todayClassesData, currentTime]);

  // 수업 종료 후 감지 (수업 종료 후 30분 이내)
  const finishedClass = useMemo(() => {
    if (!todayClassesData || todayClassesData.length === 0) return null;

    return todayClassesData.find((cls) => {
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
  }, [todayClassesData, currentTime]);

  // Policy에서 월말 판단 기준 조회 (하드코딩 금지)
  const { data: config } = useConfig();
  const monthEndThresholdDay = useMemo(() => {
    // SSOT 경로: billing.month_end_threshold_day (저장 위치는 tenant_settings(key='config').value(JSONB))
    // Policy가 없으면 실행하지 않음 (Fail Closed) - 기본값으로 25 사용하지 않음
    const billing = (config as Record<string, unknown>)?.billing as Record<string, unknown> | undefined;
    const threshold = billing?.month_end_threshold_day;
    // Policy가 없으면 undefined 반환 (Fail Closed 원칙)
    return typeof threshold === 'number' ? threshold : undefined;
  }, [config]);

  // 상황 신호 생성 (정본: 추천 규칙이 아닌 신호만)
  const contextSignals = useMemo<ContextSignals>(() => {
    const hour = currentTime.hour();
    let timeOfDay: 'morning' | 'afternoon' | 'evening' = 'morning';
    if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18) timeOfDay = 'evening';

    // 중요: Policy에서 조회한 값만 사용 (하드코딩 금지)
    // Policy가 없으면 is_month_end는 false (Fail Closed 원칙)
    const isMonthEnd = monthEndThresholdDay !== undefined && currentTime.date() >= monthEndThresholdDay;

    return {
      time_of_day: timeOfDay,
      is_month_end: isMonthEnd,
      has_upcoming_class: !!upcomingClass,
      has_finished_class: !!finishedClass,
      device_mode: window.innerWidth >= 1024 ? 'desktop' : window.innerWidth >= 768 ? 'tablet' : 'mobile',
    };
  }, [currentTime, upcomingClass, finishedClass, monthEndThresholdDay]);

  // 추천 배너 정보 생성 (정본: 자동 실행 없음)
  const recommendation = useMemo<ContextRecommendation | null>(() => {
    if (isDismissed) return null;

    // 1. 수업 시작 10분 전 → 출석부 추천 배너 표시
    if (upcomingClass) {
      return {
        id: `class-start-${upcomingClass.id}`,
        trigger_type: 'time_based',
        condition: {
          class_id: upcomingClass.id,
          minutes_before: 10,
        },
        action: {
          type: 'show_banner', // 정본: navigate 제거
          target: `/attendance?class_id=${upcomingClass.id}`, // 사용자 클릭 시 이동
          priority: 90, // 정본: 0-100 스케일
          require_confirmation: false,
        },
        enabled: true,
      };
    }

    // 2. 수업 종료 후 → 상담일지 작성 추천 배너 표시
    // 정본: 수업 종료 후 StudentTaskCard는 서버가 생성
    // 프론트엔드는 배너만 표시
    if (finishedClass) {
      return {
        id: `class-end-${finishedClass.id}`,
        trigger_type: 'time_based',
        condition: {
          class_id: finishedClass.id,
          minutes_after: 0,
        },
        action: {
          type: 'show_banner', // 정본: show_modal 제거
          target: '/students/consultations', // 사용자 클릭 시 이동
          priority: 70, // 정본: 0-100 스케일
          require_confirmation: false,
        },
        enabled: true,
      };
    }

    return null;
  }, [upcomingClass, finishedClass, isDismissed]);

  // 정본 규칙: 자동 navigate() 호출 금지
  // 프론트엔드는 추천 배너만 제공하고, 사용자가 직접 클릭해야 함
  // 이동은 카드/배너 컴포넌트의 onClick 핸들러에서만 처리
  // Hook 내부에서는 navigate()를 직접 호출하지 않음

  return {
    currentRecommendation: recommendation,
    contextSignals, // 정본: 상황 신호 제공
    goToRecommendation: recommendation ? () => {
      // 정본: 이 함수는 카드/배너 컴포넌트의 onClick에서 호출됨
      // 실제 이동은 컴포넌트 레벨에서 라우터의 navigate() 또는 window.location 사용
      // Hook 내부에서는 navigate()를 직접 호출하지 않음
      // 예시: <ContextRecommendationBanner onClick={() => navigate(recommendation.action.target)} />
    } : () => {}, // 정본: executeRecommendation → goToRecommendation (실행 암시 제거)
    dismissRecommendation: () => {
      setIsDismissed(true);
      // 1시간 후 다시 활성화
      setTimeout(() => {
        setIsDismissed(false);
      }, 60 * 60 * 1000);
    },
    isDismissed,
  };
}

// 레거시 호환: alias (함수 밖에서)
// export const useContextSignals = useAdaptiveNavigation;

