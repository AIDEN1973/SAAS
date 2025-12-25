/**
 * 날짜 범위 계산 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 날짜 범위 계산은 이 파일에서만 수행
 * [불변 규칙] KST 기준으로 통일, clone() 사용하여 mutating 방지
 *
 * @see docu/rules.md - 5. 시간 & 타임존(KST) 규칙
 */

import { toKST } from '@lib/date-utils';
import type { Dayjs } from 'dayjs';

/**
 * 날짜 범위 타입 정의
 */
export interface DateRange {
  /** ISO 8601 timestamp (필터용) */
  iso: {
    gte: string;
    lte: string;
  };
  /** YYYY-MM-DD date string (필터용) */
  dateString: {
    from: string;
    to: string;
  };
}

/**
 * 월간 범위 계산 (이번 달 / 전월)
 */
export interface MonthlyRange {
  current: DateRange;
  last: DateRange;
  /** YYYY-MM 형식 */
  currentMonthStr: string;
  /** YYYY-MM 형식 */
  lastMonthStr: string;
}

/**
 * 주간 범위 계산 (rolling 7일 / rolling 14일)
 */
export interface WeeklyRange {
  /** 이번 주 (rolling 7일) */
  current: DateRange;
  /** 전주 (rolling 14일 ~ rolling 7일) */
  last: DateRange;
}

/**
 * 일간 범위 계산 (오늘 / 어제)
 */
export interface DailyRange {
  today: DateRange;
  yesterday: DateRange;
}

/**
 * 현재 시각 기준 KST 객체 (SSOT)
 * queryFn 내부에서 한 번만 생성하여 재사용
 */
export function getBaseKST(): Dayjs {
  return toKST();
}

/**
 * 월간 범위 계산 (SSOT)
 * @param baseKST 기준 시각 (getBaseKST()로 생성)
 * @returns 이번 달과 전월의 ISO/dateString 범위
 */
export function calculateMonthlyRange(baseKST: Dayjs): MonthlyRange {
  const currentMonthBase = baseKST;
  const lastMonthBase = currentMonthBase.clone().subtract(1, 'month');

  const currentMonthStr = currentMonthBase.format('YYYY-MM');
  const lastMonthStr = lastMonthBase.format('YYYY-MM');

  // 이번 달 범위
  const nextMonthStart = currentMonthBase.clone().add(1, 'month').startOf('month');
  const currentMonthEnd = nextMonthStart.clone().subtract(1, 'day').endOf('day');
  const currentMonthStart = currentMonthBase.clone().startOf('month');

  // 전월 범위
  const lastMonthEnd = lastMonthBase.clone().endOf('month');
  const lastMonthStart = lastMonthBase.clone().startOf('month');

  return {
    current: {
      iso: {
        gte: currentMonthStart.toISOString(),
        lte: currentMonthEnd.toISOString(),
      },
      dateString: {
        from: currentMonthStart.format('YYYY-MM-DD'),
        to: currentMonthEnd.format('YYYY-MM-DD'),
      },
    },
    last: {
      iso: {
        gte: lastMonthStart.toISOString(),
        lte: lastMonthEnd.toISOString(),
      },
      dateString: {
        from: lastMonthStart.format('YYYY-MM-DD'),
        to: lastMonthEnd.format('YYYY-MM-DD'),
      },
    },
    currentMonthStr,
    lastMonthStr,
  };
}

/**
 * 주간 범위 계산 (rolling 7일 / rolling 14일) (SSOT)
 * @param baseKST 기준 시각 (getBaseKST()로 생성)
 * @param nowISO 현재 시각 ISO (선택적, 기본값: baseKST.toISOString())
 * @returns 이번 주와 전주의 ISO/dateString 범위
 */
export function calculateWeeklyRange(baseKST: Dayjs, nowISO?: string): WeeklyRange {
  const rolling7Start = baseKST.clone().subtract(7, 'days').startOf('day');
  const rolling14Start = baseKST.clone().subtract(14, 'days').startOf('day');
  const rolling7End = rolling7Start.clone().subtract(1, 'millisecond');
  const now = nowISO || baseKST.toISOString();

  return {
    current: {
      iso: {
        gte: rolling7Start.toISOString(),
        lte: now,
      },
      dateString: {
        from: rolling7Start.format('YYYY-MM-DD'),
        to: baseKST.clone().format('YYYY-MM-DD'),
      },
    },
    last: {
      iso: {
        gte: rolling14Start.toISOString(),
        lte: rolling7End.toISOString(),
      },
      dateString: {
        from: rolling14Start.format('YYYY-MM-DD'),
        to: rolling7Start.clone().subtract(1, 'day').format('YYYY-MM-DD'),
      },
    },
  };
}

/**
 * 일간 범위 계산 (오늘 / 어제) (SSOT)
 * @param baseKST 기준 시각 (getBaseKST()로 생성)
 * @returns 오늘과 어제의 ISO/dateString 범위
 */
export function calculateDailyRange(baseKST: Dayjs): DailyRange {
  const todayKST = baseKST;
  const yesterdayKST = todayKST.clone().subtract(1, 'day');

  return {
    today: {
      iso: {
        gte: todayKST.clone().startOf('day').toISOString(),
        lte: todayKST.clone().endOf('day').toISOString(),
      },
      dateString: {
        from: todayKST.clone().startOf('day').format('YYYY-MM-DD'),
        to: todayKST.clone().endOf('day').format('YYYY-MM-DD'),
      },
    },
    yesterday: {
      iso: {
        gte: yesterdayKST.clone().startOf('day').toISOString(),
        lte: yesterdayKST.clone().endOf('day').toISOString(),
      },
      dateString: {
        from: yesterdayKST.clone().startOf('day').format('YYYY-MM-DD'),
        to: yesterdayKST.clone().endOf('day').format('YYYY-MM-DD'),
      },
    },
  };
}

/**
 * 특정 일수 전부터 현재까지의 범위 계산 (SSOT)
 * @param baseKST 기준 시각
 * @param daysAgo 며칠 전부터 (예: 7 = 최근 7일)
 * @returns ISO/dateString 범위
 */
export function calculateDaysAgoRange(baseKST: Dayjs, daysAgo: number): DateRange {
  const start = baseKST.clone().subtract(daysAgo, 'days').startOf('day');
  const end = baseKST.clone().endOf('day');

  return {
    iso: {
      gte: start.toISOString(),
      lte: end.toISOString(),
    },
    dateString: {
      from: start.format('YYYY-MM-DD'),
      to: end.format('YYYY-MM-DD'),
    },
  };
}

/**
 * KST 기준 Date 객체 생성 (SSOT)
 * YYYY-MM-DD 형식의 날짜를 KST 기준으로 파싱
 * @param dateStr YYYY-MM-DD 형식의 날짜 문자열
 * @returns KST 기준 Date 객체
 */
export function parseKSTDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}

