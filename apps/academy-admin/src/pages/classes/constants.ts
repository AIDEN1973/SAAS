/**
 * 수업 관리 페이지 상수
 *
 * [LAYER: UI_PAGE]
 */

import type { DayOfWeek } from '@services/class-service';

export const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: '월요일' },
  { value: 'tuesday', label: '화요일' },
  { value: 'wednesday', label: '수요일' },
  { value: 'thursday', label: '목요일' },
  { value: 'friday', label: '금요일' },
  { value: 'saturday', label: '토요일' },
  { value: 'sunday', label: '일요일' },
];

/** 요일 번호 -> 영문 키 맵 (일요일부터 시작) */
export const DAY_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/** 요일 이름 (일요일부터 시작) */
export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
