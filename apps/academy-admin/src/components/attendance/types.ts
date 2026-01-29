/**
 * 출석 관리 컴포넌트 타입 정의
 *
 * [불변 규칙] 모든 타입은 명확하게 정의하고 주석을 작성합니다.
 */

import type { Student } from '@services/student-service';
import type { AttendanceStatus, AttendanceLog } from '@services/attendance-service';

/** 수업 정보 (Class 타입 확장) */
export interface ClassInfo {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  day_of_week: string;
  status: string;
}


/** 학생 출결 상태 */
export interface StudentAttendanceState {
  student_id: string;
  check_in: boolean;
  check_out: boolean;
  status: AttendanceStatus | null; // null = 출석 상태 미확정
  check_in_time?: string; // HH:mm 형식
  check_out_time?: string; // HH:mm 형식
  ai_predicted?: boolean;
  user_modified?: boolean;
  manual_status_override?: boolean;
}

/** 수업별 출석 통계 */
export interface ClassAttendanceStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
}

/** AttendanceCheckbox Props */
export interface AttendanceCheckboxProps {
  /** 체크 상태 */
  checked: boolean;
  /** 시간 (HH:mm) */
  time?: string;
  /** 변경 핸들러 */
  onChange: (checked: boolean, time?: string) => void;
  /** 비활성화 */
  disabled?: boolean;
  /** 키오스크 체크인 여부 */
  isKiosk?: boolean;
  /** 라벨 */
  label?: string;
}

/** StudentAttendanceRow Props */
export interface StudentAttendanceRowProps {
  /** 학생 정보 */
  student: Student;
  /** 출결 상태 */
  attendanceState: StudentAttendanceState;
  /** 등원 체크 변경 핸들러 */
  onCheckInChange: (checked: boolean, time?: string) => void;
  /** 하원 체크 변경 핸들러 */
  onCheckOutChange: (checked: boolean, time?: string) => void;
  /** 상태 변경 핸들러 */
  onStatusChange: (status: AttendanceStatus) => void;
  /** 키오스크 등원 여부 */
  isKioskCheckIn?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 수업 시작 시간 (지각 판정용) */
  classStartTime?: string;
}


/** ClassAttendanceLayer Props */
export interface ClassAttendanceLayerProps {
  /** 수업 정보 */
  classInfo: ClassInfo;
  /** 학생 목록 */
  students: Student[];
  /** 출결 상태 맵 */
  attendanceStates: Record<string, StudentAttendanceState>;
  /** 출석 로그 맵 (키오스크 등 체크인 방법 확인용) */
  checkInLogsMap: Map<string, AttendanceLog>;
  /** 출결 상태 변경 핸들러 */
  onAttendanceChange: (studentId: string, state: Partial<StudentAttendanceState>) => void;
  /** 일괄 등원 핸들러 */
  onBulkCheckIn: () => void;
  /** 일괄 하원 핸들러 */
  onBulkCheckOut: () => void;
  /** 저장 핸들러 */
  onSave: () => void;
  /** 저장 중 여부 */
  isSaving: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
}


// ============================================================
// Phase 2: 출결 기록(History) 탭 관련 타입
// ============================================================

/** 출결 상태 (History 탭용) */
export type HistoryAttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

/** 학생별 일일 출결 정보 */
export interface StudentDailyAttendance {
  /** 학생 ID */
  studentId: string;
  /** 학생 이름 */
  studentName: string;
  /** 출결 상태 */
  status: HistoryAttendanceStatus;
  /** 등원 시간 (HH:mm) */
  checkInTime?: string;
  /** 하원 시간 (HH:mm) */
  checkOutTime?: string;
  /** 체류 시간 (예: "1시간 7분") */
  duration?: string;
}

/** 수업별 일일 출결 정보 */
export interface ClassDailyAttendance {
  /** 수업 ID */
  classId: string;
  /** 수업명 */
  className: string;
  /** 수업 시작 시간 (HH:mm) */
  startTime: string;
  /** 수업 종료 시간 (HH:mm) */
  endTime: string;
  /** 출결 통계 */
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  /** 학생별 출결 목록 */
  students: StudentDailyAttendance[];
}

/** 날짜별 출결 그룹 */
export interface DailyAttendanceGroup {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 표시용 날짜 라벨 (예: "2026년 1월 19일 (일)") */
  dateLabel: string;
  /** 요일 */
  dayOfWeek: string;
  /** 수업별 출결 목록 */
  classes: ClassDailyAttendance[];
}

/** DailyAttendanceSection Props */
export interface DailyAttendanceSectionProps {
  /** 날짜별 출결 그룹 */
  group: DailyAttendanceGroup;
  /** 펼쳐진 수업 ID 목록 */
  expandedClassIds: Set<string>;
  /** 수업 펼침/접힘 토글 핸들러 */
  onToggleClass: (classId: string) => void;
}

/** ClassDailyCard Props */
export interface ClassDailyCardProps {
  /** 수업 출결 정보 */
  classAttendance: ClassDailyAttendance;
  /** 펼침 상태 */
  isExpanded: boolean;
  /** 펼침/접힘 토글 핸들러 */
  onToggle: () => void;
}

/** StudentAttendanceTable Props */
export interface StudentAttendanceTableProps {
  /** 학생 출결 목록 */
  students: StudentDailyAttendance[];
}
