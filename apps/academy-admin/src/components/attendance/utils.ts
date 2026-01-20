/**
 * 출석 관리 유틸리티 함수
 *
 * [불변 규칙] 모든 날짜/시간은 KST 기준으로 처리합니다.
 */

import { toKST } from '@lib/date-utils';
import { ATTENDANCE_TIME_CONFIG, HISTORY_DEFAULT_DAYS, DAY_NAMES } from './constants';
import type {
  ClassAttendanceStats,
  StudentAttendanceState,
  DailyAttendanceGroup,
  ClassDailyAttendance,
  StudentDailyAttendance,
  HistoryAttendanceStatus,
} from './types';
import type { CreateAttendanceLogInput, AttendanceLog } from '@services/attendance-service';

/**
 * HH:mm 형식의 시간 문자열을 파싱
 * @param timeStr - "09:30" 형식의 시간 문자열
 * @returns { hour, minute } 또는 null (파싱 실패 시)
 */
export const parseTimeString = (timeStr: string | undefined): { hour: number; minute: number } | null => {
  if (!timeStr) return null;

  // HH:mm 형식 검증
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(timeStr)) return null;

  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (isNaN(hour) || isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
};

/**
 * 두 시간(HH:mm)의 차이를 분 단위로 계산
 * @param time1 - 첫 번째 시간
 * @param time2 - 두 번째 시간
 * @returns 분 단위 차이 또는 null
 */
export const getTimeDifferenceInMinutes = (time1: string, time2: string): number | null => {
  const parsed1 = parseTimeString(time1);
  const parsed2 = parseTimeString(time2);

  if (!parsed1 || !parsed2) return null;

  const minutes1 = parsed1.hour * 60 + parsed1.minute;
  const minutes2 = parsed2.hour * 60 + parsed2.minute;

  return minutes2 - minutes1;
};

/**
 * 체크인 시간과 수업 시작 시간을 비교하여 지각 여부 판정
 * @param checkInTime - 체크인 시간 (HH:mm)
 * @param classStartTime - 수업 시작 시간 (HH:mm)
 * @returns 'present' | 'late' | null
 */
export const determineLateStatus = (
  checkInTime: string | undefined,
  classStartTime: string | undefined
): 'present' | 'late' | null => {
  if (!checkInTime || !classStartTime) return null;

  const diff = getTimeDifferenceInMinutes(classStartTime, checkInTime);
  if (diff === null) {
    if (import.meta.env?.DEV) {
      console.warn('[determineLateStatus] 시간 파싱 실패:', { checkInTime, classStartTime });
    }
    return null;
  }

  // 음수면 일찍 온 것, 양수면 늦은 것
  if (diff > ATTENDANCE_TIME_CONFIG.LATE_THRESHOLD_MINUTES) {
    return 'late';
  }

  return 'present';
};

/**
 * 수업별 출석 통계 계산
 */
export const calculateClassStats = (
  students: { id: string }[],
  attendanceStates: Record<string, StudentAttendanceState>
): ClassAttendanceStats => {
  const total = students.length;
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  students.forEach((student) => {
    const state = attendanceStates[student.id];
    if (!state) return;

    if (state.check_in) {
      if (state.status === 'late') {
        late++;
      } else if (state.status === 'present') {
        present++;
      }
    } else if (state.status === 'absent') {
      absent++;
    } else if (state.status === 'excused') {
      excused++;
    }
  });

  return { total, present, late, absent, excused };
};

// ============================================================
// Phase 2: 출결 기록(History) 탭 관련 유틸리티 함수
// ============================================================

/**
 * 날짜를 표시용 라벨로 포맷
 * @example "2026-01-19" -> "2026년 1월 19일 (일)"
 */
export const formatDateLabel = (dateStr: string): string => {
  const date = toKST(dateStr);
  const year = date.year();
  const month = date.month() + 1;
  const day = date.date();
  const dayOfWeek = DAY_NAMES[date.day()];
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
};

/**
 * 요일 이름 반환
 */
export const getDayOfWeek = (dateStr: string): string => {
  const date = toKST(dateStr);
  return DAY_NAMES[date.day()];
};

/**
 * 체류 시간 계산
 * @example calculateDuration("09:00", "10:07") -> "1시간 7분"
 */
export const calculateDuration = (checkInTime?: string, checkOutTime?: string): string | undefined => {
  if (!checkInTime || !checkOutTime) return undefined;

  // 시간 형식 검증 및 파싱
  const inParts = checkInTime.split(':');
  const outParts = checkOutTime.split(':');

  if (inParts.length < 2 || outParts.length < 2) return undefined;

  const [inHour, inMin] = inParts.map(Number);
  const [outHour, outMin] = outParts.map(Number);

  // NaN 체크
  if (isNaN(inHour) || isNaN(inMin) || isNaN(outHour) || isNaN(outMin)) return undefined;

  const inMinutes = inHour * 60 + inMin;
  const outMinutes = outHour * 60 + outMin;

  // 음수 체류시간 (check_out < check_in) 처리
  if (outMinutes <= inMinutes) {
    if (import.meta.env?.DEV) {
      console.warn('[calculateDuration] 체류시간이 음수입니다:', { checkInTime, checkOutTime });
    }
    return undefined;
  }

  const diff = outMinutes - inMinutes;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  } else if (hours > 0) {
    return `${hours}시간`;
  } else {
    return `${minutes}분`;
  }
};

/**
 * 출결 로그를 날짜별로 그룹화
 *
 * AttendanceLog는 check_in/check_out 타입으로 각각 별도 레코드로 저장됨.
 * 이 함수는 같은 날짜/수업/학생에 대해 check_in과 check_out 로그를 병합하여 하나의 StudentDailyAttendance로 만듭니다.
 *
 * @param logs - 출결 로그 배열
 * @param classMap - 수업 ID -> 수업 정보 맵
 * @param studentMap - 학생 ID -> 학생 이름 맵
 * @returns 날짜별 출결 그룹 배열 (최신순 정렬)
 */
export const groupAttendanceByDate = (
  logs: AttendanceLog[],
  classMap: Map<string, { id: string; name: string; start_time: string; end_time: string }>,
  studentMap: Map<string, string>
): DailyAttendanceGroup[] => {
  // 1. 날짜 -> 수업ID -> 학생ID -> 출결 정보 맵 구성
  // 키: `${date}-${classId}-${studentId}`
  const studentAttendanceMap = new Map<string, {
    studentId: string;
    studentName: string;
    status: HistoryAttendanceStatus;
    checkInTime?: string;
    checkOutTime?: string;
    date: string;
    classId: string;
  }>();

  logs.forEach((log) => {
    // occurred_at에서 날짜와 시간 추출
    const occurredAt = toKST(log.occurred_at);
    const date = occurredAt.format('YYYY-MM-DD');
    const time = occurredAt.format('HH:mm');
    const classId = log.class_id;
    const studentId = log.student_id;

    if (!classId) return;

    const key = `${date}-${classId}-${studentId}`;

    // 기존 데이터가 있으면 병합, 없으면 새로 생성
    const existing = studentAttendanceMap.get(key);

    if (existing) {
      // check_in 또는 check_out 정보 업데이트
      if (log.attendance_type === 'check_in') {
        existing.checkInTime = time;
        existing.status = (log.status || 'present') as HistoryAttendanceStatus;
      } else if (log.attendance_type === 'check_out') {
        existing.checkOutTime = time;
      }
    } else {
      // 새 학생 출결 정보 생성
      studentAttendanceMap.set(key, {
        studentId,
        studentName: studentMap.get(studentId) || '알 수 없음',
        status: (log.status || 'present') as HistoryAttendanceStatus,
        checkInTime: log.attendance_type === 'check_in' ? time : undefined,
        checkOutTime: log.attendance_type === 'check_out' ? time : undefined,
        date,
        classId,
      });
    }
  });

  // 2. 날짜 -> 수업 -> 학생 목록으로 재구성
  const dateClassStudentMap = new Map<string, Map<string, StudentDailyAttendance[]>>();

  studentAttendanceMap.forEach((data) => {
    const { date, classId, studentId, studentName, status, checkInTime, checkOutTime } = data;

    if (!dateClassStudentMap.has(date)) {
      dateClassStudentMap.set(date, new Map());
    }

    const classStudentMap = dateClassStudentMap.get(date)!;

    if (!classStudentMap.has(classId)) {
      classStudentMap.set(classId, []);
    }

    const students = classStudentMap.get(classId)!;

    students.push({
      studentId,
      studentName,
      status,
      checkInTime,
      checkOutTime,
      duration: calculateDuration(checkInTime, checkOutTime),
    });
  });

  // 3. DailyAttendanceGroup 배열로 변환
  const groups: DailyAttendanceGroup[] = [];

  dateClassStudentMap.forEach((classStudentMap, date) => {
    const classes: ClassDailyAttendance[] = [];

    classStudentMap.forEach((students, classId) => {
      const classInfo = classMap.get(classId);
      if (!classInfo) return;

      // 통계 계산
      const stats = {
        total: students.length,
        present: students.filter((s) => s.status === 'present').length,
        late: students.filter((s) => s.status === 'late').length,
        absent: students.filter((s) => s.status === 'absent').length,
        excused: students.filter((s) => s.status === 'excused').length,
      };

      classes.push({
        classId,
        className: classInfo.name,
        startTime: classInfo.start_time.substring(0, 5),
        endTime: classInfo.end_time.substring(0, 5),
        stats,
        students: students.sort((a, b) => a.studentName.localeCompare(b.studentName)),
      });
    });

    // 수업을 시작 시간순으로 정렬
    classes.sort((a, b) => a.startTime.localeCompare(b.startTime));

    groups.push({
      date,
      dateLabel: formatDateLabel(date),
      dayOfWeek: getDayOfWeek(date),
      classes,
    });
  });

  // 4. 날짜 최신순 정렬
  groups.sort((a, b) => b.date.localeCompare(a.date));

  return groups;
};

/**
 * 기본 날짜 범위 계산 (설정된 기본 일수)
 */
export const getDefaultDateRange = (): { dateFrom: string; dateTo: string } => {
  const today = toKST();
  const dateTo = today.format('YYYY-MM-DD');
  const dateFrom = today.subtract(HISTORY_DEFAULT_DAYS, 'days').format('YYYY-MM-DD');
  return { dateFrom, dateTo };
};

/**
 * 출결 상태 아이콘 반환
 */
export const getStatusIcon = (status: HistoryAttendanceStatus): string => {
  switch (status) {
    case 'present':
      return '✓';
    case 'late':
      return '△';
    case 'absent':
      return '✗';
    case 'excused':
      return '○';
    default:
      return '-';
  }
};

/**
 * 출결 상태 라벨 반환
 */
export const getStatusLabel = (status: HistoryAttendanceStatus): string => {
  switch (status) {
    case 'present':
      return '출석';
    case 'late':
      return '지각';
    case 'absent':
      return '결석';
    case 'excused':
      return '사유';
    default:
      return '-';
  }
};

/**
 * 출결 상태 색상 반환
 */
export const getStatusColor = (status: HistoryAttendanceStatus): string => {
  switch (status) {
    case 'present':
      return 'var(--color-success)';
    case 'late':
      return 'var(--color-warning)';
    case 'absent':
      return 'var(--color-error)';
    case 'excused':
      return 'var(--color-info)';
    default:
      return 'var(--color-text-secondary)';
  }
};

// ============================================================
// Phase 3: 출결 기록 저장 유틸리티
// ============================================================

/**
 * 출결 기록 생성 (UPSERT용)
 *
 * 학생의 출결 상태를 기반으로 AttendanceLog 생성 객체 배열을 반환합니다.
 * - 등원 기록: check_in이 true이거나 status가 'absent'/'excused'인 경우
 * - 하원 기록: check_out이 true인 경우
 *
 * @param state 학생 출결 상태
 * @param selectedDate 선택된 날짜 (YYYY-MM-DD)
 * @param classStartTime 수업 시작 시간 (HH:mm) - 등원 시간이 없을 때 폴백용
 * @returns CreateAttendanceLogInput[]
 */
export const createAttendanceRecords = (
  state: StudentAttendanceState,
  selectedDate: string,
  classStartTime?: string
): CreateAttendanceLogInput[] => {
  const records: CreateAttendanceLogInput[] = [];

  // 등원 기록 또는 결석/사유 기록
  if (state.check_in || state.status === 'absent' || state.status === 'excused') {
    let occurredAt: string;

    if (state.check_in && state.check_in_time) {
      // 체크인 시간이 있으면 사용
      const [hour, minute] = state.check_in_time.split(':').map(Number);
      occurredAt = toKST(selectedDate).hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm:ssZ');
    } else if (classStartTime) {
      // 체크인 시간이 없으면 수업 시작 시간 사용
      const [hour, minute] = classStartTime.split(':').map(Number);
      occurredAt = toKST(selectedDate).hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm:ssZ');
    } else {
      // 폴백: 현재 시각
      occurredAt = toKST().format('YYYY-MM-DDTHH:mm:ssZ');
    }

    records.push({
      student_id: state.student_id,
      class_id: undefined,
      occurred_at: occurredAt,
      attendance_type: 'check_in',
      status: state.status,
      check_in_method: 'manual',
    });
  }

  // 하원 기록
  if (state.check_out) {
    const checkOutTimeStr = state.check_out_time || toKST().format('HH:mm');
    const [hour, minute] = checkOutTimeStr.split(':').map(Number);
    const occurredAt = toKST(selectedDate).hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm:ssZ');

    records.push({
      student_id: state.student_id,
      class_id: undefined,
      occurred_at: occurredAt,
      attendance_type: 'check_out',
      status: state.status,
    });
  }

  return records;
};
