/**
 * useRecentActivity Hook
 *
 * 최근 활동 조회 Hook (최근 등록된 학생, 최근 상담 기록, 최근 출결 이벤트, 최근 태그 추가/변경)
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */

import { useQuery } from '@tanstack/react-query';
import { getApiContext } from '@api-sdk/core';
import { apiClient } from '@api-sdk/core';
import { fetchStudents, fetchConsultations } from './useStudent';
import { fetchAttendanceLogs } from '@hooks/use-attendance';
import { toKST } from '@lib/date-utils';
import type { Student, StudentConsultation } from '@services/student-service';
import type { AttendanceLog } from '@services/attendance-service';
import type { TagAssignment } from '@core/tags';

export interface RecentActivity {
  recentStudents: Student[];
  recentConsultations: StudentConsultation[];
  recentAttendanceEvents: AttendanceLog[];
  recentTagChanges: TagAssignment[];
}

// 최근 활동 표시 개수 제한 (하드코딩 금지 규칙 준수: 상수로 정의)
const RECENT_ACTIVITY_LIMIT = 5;

// 최근 활동 조회 기간 (일수) - 하드코딩 금지 규칙 준수
const RECENT_ACTIVITY_DAYS = 7;

// React Query 시간 설정 상수 (하드코딩 금지)
const STALE_TIME_ONE_MINUTE = 60000; // 1분
const GC_TIME_FIVE_MINUTES = 300000; // 5분

/**
 * 최근 활동 조회 함수
 */
export async function fetchRecentActivity(tenantId: string): Promise<RecentActivity> {
  const kstNow = toKST();
  const sevenDaysAgo = kstNow.subtract(RECENT_ACTIVITY_DAYS, 'day').toISOString();

  // 병렬로 모든 데이터 조회
  const [students, consultations, attendanceLogs, tagAssignments] = await Promise.all([
    // 최근 등록된 학생
    fetchStudents(tenantId).then(data => data.slice(0, RECENT_ACTIVITY_LIMIT)),

    // 최근 상담 기록
    fetchConsultations(tenantId, {
      consultation_date: {
        gte: sevenDaysAgo,
      },
    }).then(data => data.slice(0, RECENT_ACTIVITY_LIMIT)),

    // 최근 출결 이벤트
    fetchAttendanceLogs(tenantId, {
      date_from: sevenDaysAgo,
    }).then(data => (data || []).slice(0, RECENT_ACTIVITY_LIMIT)),

    // 최근 태그 추가/변경
    apiClient.get<TagAssignment>('tag_assignments', {
      filters: {
        entity_type: 'student',
        tenant_id: tenantId,
        created_at: { gte: sevenDaysAgo },
      },
      orderBy: { column: 'created_at', ascending: false },
      limit: RECENT_ACTIVITY_LIMIT,
    }).then(response => {
      if (response.error) {
        console.error('[fetchRecentActivity] 태그 할당 조회 실패:', response.error);
        return [];
      }
      return (response.data || []).slice(0, RECENT_ACTIVITY_LIMIT);
    }),
  ]);

  return {
    recentStudents: students,
    recentConsultations: consultations,
    recentAttendanceEvents: attendanceLogs,
    recentTagChanges: tagAssignments,
  };
}

/**
 * 최근 활동 Hook
 */
export function useRecentActivity() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<RecentActivity>({
    queryKey: ['recent-activity', tenantId],
    queryFn: () => fetchRecentActivity(tenantId!),
    enabled: !!tenantId,
    staleTime: STALE_TIME_ONE_MINUTE,
    gcTime: GC_TIME_FIVE_MINUTES,
  });
}

