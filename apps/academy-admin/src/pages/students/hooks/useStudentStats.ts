/**
 * 학생 통계 계산 Hook
 *
 * [LAYER: APPLICATION]
 *
 * 학생통계 페이지(StudentStatsSubPage)에서 사용하는 통계 계산 로직
 * - 학생 현황 통계 (상태별)
 * - 학년별 분포
 * - 성별 분포
 * - 태그별 분포
 * - 상담 유형별 분포
 * - KPI 지표 (유지율, 성장률, 주간 신규)
 */

import { useMemo } from 'react';
import type { Student, StudentConsultation } from '@services/student-service';
import type { PeriodFilter } from '../../../components/stats';

export interface StudentStatusStats {
  total: number;
  active: number;
  onLeave: number;
  graduated: number;
  withdrawn: number;
}

export interface GradeDistribution {
  name: string;
  value: number;
  color: string;
}

export interface GenderDistribution {
  name: string;
  value: number;
  color: string;
}

export interface TagDistribution {
  id: string;
  name: string;
  value: number;
  color: string;
}

export interface ConsultationTypeDistribution {
  name: string;
  type: string;
  value: number;
  color: string;
}

export interface KPIStats {
  retentionRate: number; // 유지율 (%)
  monthlyGrowthRate: number; // 월간 성장률 (%)
  weeklyNewStudents: number; // 주간 신규 등록
}

export interface UseStudentStatsProps {
  students: Student[];
  consultations: StudentConsultation[];
  tags: Array<{ id: string; name: string; color: string }> | undefined;
  tagAssignments?: Array<{ student_id: string; tag_id: string }>;
  period: PeriodFilter;
  // 업종 중립성을 위한 라벨 (optional, 기본값 사용)
  genderLabels?: {
    male: string;
    female: string;
    other: string;
    unknown: string;
  };
  consultationTypeLabels?: {
    learning: string;
    counseling: string;
    behavior: string;
    other: string;
  };
}

export interface UseStudentStatsReturn {
  // 학생 현황 통계
  statusStats: StudentStatusStats;
  lastMonthStatusStats: StudentStatusStats;

  // 분포 통계
  gradeDistribution: GradeDistribution[];
  genderDistribution: GenderDistribution[];
  tagDistribution: TagDistribution[];
  consultationTypeDistribution: ConsultationTypeDistribution[];

  // KPI 지표
  kpiStats: KPIStats;

  // 차트 데이터 (월별 등록 추이 - 5개 상태별 멀티라인)
  chartData: Array<{ name: string; total: number; active: number; onLeave: number; withdrawn: number; graduated: number }>;
}

/**
 * 학년 문자열을 카테고리로 분류
 */
function categorizeGrade(grade: string | undefined | null): '초등' | '중등' | '고등' | '기타' {
  if (!grade) return '기타';

  const normalized = grade.trim().toLowerCase();

  // 초등학생
  if (
    normalized.includes('초') ||
    /^[1-6]학년$/.test(normalized) ||
    /^초[1-6]$/.test(normalized) ||
    normalized === '1학년' ||
    normalized === '2학년' ||
    normalized === '3학년' ||
    normalized === '4학년' ||
    normalized === '5학년' ||
    normalized === '6학년'
  ) {
    // 중학생/고등학생 제외
    if (!normalized.includes('중') && !normalized.includes('고')) {
      return '초등';
    }
  }

  // 중학생
  if (
    normalized.includes('중') ||
    /^중[1-3]$/.test(normalized) ||
    /^중학[1-3]$/.test(normalized)
  ) {
    return '중등';
  }

  // 고등학생
  if (
    normalized.includes('고') ||
    /^고[1-3]$/.test(normalized) ||
    /^고등[1-3]$/.test(normalized)
  ) {
    return '고등';
  }

  return '기타';
}

/**
 * 기간에 맞는 시작/종료 날짜 계산
 */
function getPeriodDates(period: PeriodFilter): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'yesterday':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      break;
    case 'thisWeek': {
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday, 0, 0, 0);
      break;
    }
    case 'lastWeek': {
      const dayOfWeek = now.getDay();
      const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastMonday, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek), 23, 59, 59);
      break;
    }
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case 'lastMonth': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    }
    case '1month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  }

  return { startDate, endDate };
}

export function useStudentStats({
  students,
  consultations,
  tags,
  tagAssignments,
  period,
  genderLabels = {
    male: '남',
    female: '여',
    other: '기타',
    unknown: '미입력',
  },
  consultationTypeLabels = {
    learning: '학습상담',
    counseling: '진로상담',
    behavior: '행동상담',
    other: '기타',
  },
}: UseStudentStatsProps): UseStudentStatsReturn {
  // 기간 필터 적용된 학생 목록 (향후 기간별 필터링에 사용 예정)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const filteredStudents = useMemo(() => {
    if (!students || students.length === 0) return [];

    const { startDate, endDate } = getPeriodDates(period);

    return students.filter((student) => {
      if (!student.created_at) return true;
      const createdDate = new Date(student.created_at);
      return createdDate >= startDate && createdDate <= endDate;
    });
  }, [students, period]);

  // 학생 현황 통계 (상태별)
  const statusStats = useMemo<StudentStatusStats>(() => {
    if (!students || students.length === 0) {
      return { total: 0, active: 0, onLeave: 0, graduated: 0, withdrawn: 0 };
    }

    return {
      total: students.length,
      active: students.filter((s) => s.status === 'active').length,
      onLeave: students.filter((s) => s.status === 'on_leave').length,
      graduated: students.filter((s) => s.status === 'graduated').length,
      withdrawn: students.filter((s) => s.status === 'withdrawn').length,
    };
  }, [students]);

  // 지난달 통계 (트렌드 계산용)
  const lastMonthStatusStats = useMemo<StudentStatusStats>(() => {
    if (!students || students.length === 0) {
      return { total: 0, active: 0, onLeave: 0, graduated: 0, withdrawn: 0 };
    }

    const now = new Date();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const lastMonthStudents = students.filter((s) => {
      if (!s.created_at) return false;
      return new Date(s.created_at) <= lastMonthEnd;
    });

    return {
      total: lastMonthStudents.length,
      active: lastMonthStudents.filter((s) => s.status === 'active').length,
      onLeave: lastMonthStudents.filter((s) => s.status === 'on_leave').length,
      graduated: lastMonthStudents.filter((s) => s.status === 'graduated').length,
      withdrawn: lastMonthStudents.filter((s) => s.status === 'withdrawn').length,
    };
  }, [students]);

  // 학년별 분포
  const gradeDistribution = useMemo<GradeDistribution[]>(() => {
    if (!students || students.length === 0) return [];

    const counts = {
      초등: 0,
      중등: 0,
      고등: 0,
      기타: 0,
    };

    students.forEach((student) => {
      const category = categorizeGrade(student.grade);
      counts[category]++;
    });

    const colors = {
      초등: 'var(--color-success)',
      중등: 'var(--color-primary)',
      고등: 'var(--color-warning)',
      기타: 'var(--color-gray-400)',
    };

    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value,
        color: colors[name as keyof typeof colors],
      }));
  }, [students]);

  // 성별 분포
  const genderDistribution = useMemo<GenderDistribution[]>(() => {
    if (!students || students.length === 0) return [];

    const counts = {
      male: 0,
      female: 0,
      other: 0,
      unknown: 0,
    };

    students.forEach((student) => {
      if (student.gender === 'male') counts.male++;
      else if (student.gender === 'female') counts.female++;
      else if (student.gender === 'other') counts.other++;
      else counts.unknown++;
    });

    const colors = {
      male: 'var(--color-primary)',
      female: 'var(--color-error)',
      other: 'var(--color-warning)',
      unknown: 'var(--color-gray-400)',
    };

    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({
        name: genderLabels[key as keyof typeof genderLabels],
        value,
        color: colors[key as keyof typeof colors],
      }));
  }, [students, genderLabels]);

  // 태그별 분포
  const tagDistribution = useMemo<TagDistribution[]>(() => {
    if (!tags || tags.length === 0 || !tagAssignments) return [];

    const tagCounts = new Map<string, number>();

    tagAssignments.forEach((assignment) => {
      const count = tagCounts.get(assignment.tag_id) || 0;
      tagCounts.set(assignment.tag_id, count + 1);
    });

    return tags
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        value: tagCounts.get(tag.id) || 0,
        color: tag.color || 'var(--color-primary)',
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [tags, tagAssignments]);

  // 상담 유형별 분포
  const consultationTypeDistribution = useMemo<ConsultationTypeDistribution[]>(() => {
    if (!consultations || consultations.length === 0) return [];

    const counts = {
      learning: 0,
      counseling: 0,
      behavior: 0,
      other: 0,
    };

    consultations.forEach((consultation) => {
      if (consultation.consultation_type in counts) {
        counts[consultation.consultation_type as keyof typeof counts]++;
      }
    });

    const colors = {
      learning: 'var(--color-success)',
      counseling: 'var(--color-primary)',
      behavior: 'var(--color-warning)',
      other: 'var(--color-gray-400)',
    };

    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([type, value]) => ({
        name: consultationTypeLabels[type as keyof typeof consultationTypeLabels],
        type,
        value,
        color: colors[type as keyof typeof colors],
      }))
      .sort((a, b) => b.value - a.value);
  }, [consultations, consultationTypeLabels]);

  // KPI 지표
  const kpiStats = useMemo<KPIStats>(() => {
    if (!students || students.length === 0) {
      return { retentionRate: 0, monthlyGrowthRate: 0, weeklyNewStudents: 0 };
    }

    // 유지율: 재원 / 전체 × 100
    const retentionRate = statusStats.total > 0
      ? Math.round((statusStats.active / statusStats.total) * 1000) / 10
      : 0;

    // 월간 성장률: ((현월 - 전월) / 전월) × 100
    const monthlyGrowthRate = lastMonthStatusStats.total > 0
      ? Math.round(((statusStats.total - lastMonthStatusStats.total) / lastMonthStatusStats.total) * 1000) / 10
      : 0;

    // 주간 신규 등록: 최근 7일 이내 created_at
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const weeklyNewStudents = students.filter((s) => {
      if (!s.created_at) return false;
      return new Date(s.created_at) >= weekAgo;
    }).length;

    return {
      retentionRate,
      monthlyGrowthRate,
      weeklyNewStudents,
    };
  }, [students, statusStats, lastMonthStatusStats]);

  // 월별 등록 추이 차트 데이터 (4개 상태별 멀티라인)
  const chartData = useMemo(() => {
    if (!students || students.length === 0) return [];

    const { startDate, endDate } = getPeriodDates(period);

    // 상태별 날짜별 학생 수 그룹화
    const statusDateMap = {
      total: new Map<string, number>(),
      active: new Map<string, number>(),
      onLeave: new Map<string, number>(),
      withdrawn: new Map<string, number>(),
      graduated: new Map<string, number>(),
    };

    students.forEach((student) => {
      if (student.created_at) {
        const date = new Date(student.created_at);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        // 전체
        statusDateMap.total.set(dateKey, (statusDateMap.total.get(dateKey) || 0) + 1);

        // 상태별
        if (student.status === 'active') {
          statusDateMap.active.set(dateKey, (statusDateMap.active.get(dateKey) || 0) + 1);
        } else if (student.status === 'on_leave') {
          statusDateMap.onLeave.set(dateKey, (statusDateMap.onLeave.get(dateKey) || 0) + 1);
        } else if (student.status === 'withdrawn') {
          statusDateMap.withdrawn.set(dateKey, (statusDateMap.withdrawn.get(dateKey) || 0) + 1);
        } else if (student.status === 'graduated') {
          statusDateMap.graduated.set(dateKey, (statusDateMap.graduated.get(dateKey) || 0) + 1);
        }
      }
    });

    // 기간 내 모든 날짜 생성
    const allDates: string[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      allDates.push(dateKey);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 상태별 누적 합계 초기화 (startDate 이전)
    const cumulative = {
      total: 0,
      active: 0,
      onLeave: 0,
      withdrawn: 0,
      graduated: 0,
    };

    students.forEach((student) => {
      if (student.created_at) {
        const date = new Date(student.created_at);
        if (date < startDate) {
          cumulative.total++;
          if (student.status === 'active') {
            cumulative.active++;
          } else if (student.status === 'on_leave') {
            cumulative.onLeave++;
          } else if (student.status === 'withdrawn') {
            cumulative.withdrawn++;
          } else if (student.status === 'graduated') {
            cumulative.graduated++;
          }
        }
      }
    });

    return allDates.map((date) => {
      // 각 상태별 누적 업데이트
      cumulative.total += statusDateMap.total.get(date) || 0;
      cumulative.active += statusDateMap.active.get(date) || 0;
      cumulative.onLeave += statusDateMap.onLeave.get(date) || 0;
      cumulative.withdrawn += statusDateMap.withdrawn.get(date) || 0;
      cumulative.graduated += statusDateMap.graduated.get(date) || 0;

      const [, month, day] = date.split('-');
      const shortDate = `${month}-${day}`;

      return {
        name: shortDate,
        total: cumulative.total,
        active: cumulative.active,
        onLeave: cumulative.onLeave,
        withdrawn: cumulative.withdrawn,
        graduated: cumulative.graduated,
      };
    });
  }, [students, period]);

  return {
    statusStats,
    lastMonthStatusStats,
    gradeDistribution,
    genderDistribution,
    tagDistribution,
    consultationTypeDistribution,
    kpiStats,
    chartData,
  };
}
