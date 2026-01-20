/**
 * Industry Academy Types
 *
 * 학원 업종 전용 비즈니스 로직
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용, Core는 Industry를 import하지 않음
 */

export type StudentStatus = 'active' | 'on_leave' | 'graduated' | 'withdrawn';
export type Gender = 'male' | 'female' | 'other';
export type GuardianRelationship = 'parent' | 'guardian' | 'other';
export type ConsultationType = 'counseling' | 'learning' | 'behavior' | 'other';

export interface Student {
  id: string;
  tenant_id: string;
  industry_type: string;
  name: string;
  birth_date?: string;
  gender?: Gender;
  phone?: string;
  attendance_number?: string;  // 출결번호 (4자리 이상 숫자)
  email?: string;
  father_phone?: string;  // 아버지 전화번호
  mother_phone?: string;  // 어머니 전화번호
  address?: string;
  school_name?: string;
  grade?: string;
  status: StudentStatus;
  notes?: string;
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Guardian {
  id: string;
  tenant_id: string;
  student_id: string;
  name: string;
  relationship: GuardianRelationship;
  phone: string;
  email?: string;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentClass {
  id: string;
  tenant_id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
  left_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface StudentConsultation {
  id: string;
  tenant_id: string;
  student_id: string;
  consultation_date: string;
  consultation_type: ConsultationType;
  content: string;
  ai_summary?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentInput {
  name: string;
  birth_date?: string;
  gender?: Gender;
  phone?: string;
  attendance_number?: string;  // 출결번호 (4자리 이상 숫자, 미입력 시 전화번호 뒷 4자리 자동 생성)
  email?: string;
  father_phone?: string;  // 아버지 전화번호
  mother_phone?: string;  // 어머니 전화번호
  address?: string;
  school_name?: string;
  grade?: string;
  status?: StudentStatus;
  notes?: string;
  profile_image_url?: string;
  guardians?: Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>[];
  tag_ids?: string[];
}

export interface UpdateStudentInput {
  name?: string;
  birth_date?: string;
  gender?: Gender;
  phone?: string;
  attendance_number?: string;  // 출결번호 (4자리 이상 숫자)
  email?: string;
  father_phone?: string;  // 아버지 전화번호
  mother_phone?: string;  // 어머니 전화번호
  address?: string;
  school_name?: string;
  grade?: string;
  status?: StudentStatus;
  notes?: string;
  profile_image_url?: string;
}

export interface StudentFilter {
  status?: StudentStatus | StudentStatus[];
  grade?: string;
  class_id?: string;
  tag_ids?: string[];
  search?: string;  // 이름 검색
}

// 반(Class) 관리용
export type ClassStatus = 'active' | 'inactive';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Class {
  id: string;
  tenant_id: string;
  name: string;
  subject?: string;
  grade?: string | string[];  // 단일 또는 복수 학년 지원
  day_of_week: DayOfWeek | DayOfWeek[];  // 단일 또는 복수 요일 지원
  start_time: string;  // time 형식 (예: "14:00:00")
  end_time: string;  // time 형식 (예: "15:30:00")
  capacity: number;
  current_count: number;
  color?: string;  // 색상 필드 optional로 변경
  room?: string;
  notes?: string;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface CreateClassInput {
  name: string;
  subject?: string;
  grade?: string | string[];  // 단일 또는 복수 학년 지원
  day_of_week?: DayOfWeek | DayOfWeek[];  // 단일 또는 복수 요일 지원 (optional)
  start_time?: string;  // optional로 변경
  end_time?: string;  // optional로 변경
  capacity?: number;  // optional로 변경
  notes?: string;
  status?: ClassStatus;
  teacher_ids?: string[];  // 강사 배정 (person_id 배열)
}

export interface UpdateClassInput {
  name?: string;
  subject?: string;
  grade?: string | string[];  // 단일 또는 복수 학년 지원
  day_of_week?: DayOfWeek | DayOfWeek[];  // 단일 또는 복수 요일 지원
  start_time?: string;
  end_time?: string;
  capacity?: number;
  notes?: string;
  status?: ClassStatus;
  teacher_ids?: string[];  // 강사 배정 수정 (person_id 배열)
}

export interface ClassFilter {
  status?: ClassStatus | ClassStatus[];
  day_of_week?: DayOfWeek | DayOfWeek[];  // 단일 또는 복수 요일 지원
  subject?: string;
  grade?: string | string[];  // 단일 또는 복수 학년 지원
  teacher_id?: string;
  search?: string;  // 이름 검색
}

// 강사(Teacher) 관리용
export type TeacherStatus = 'active' | 'on_leave' | 'resigned';
export type TeacherRole = 'teacher' | 'assistant';  // 담임/부담임

export interface Teacher {
  id: string;  // person_id
  tenant_id: string;
  name: string;  // persons.name
  email?: string;  // persons.email
  phone?: string;  // persons.phone
  address?: string;  // persons.address
  employee_id?: string;
  specialization?: string;
  hire_date?: string;
  status: TeacherStatus;
  profile_image_url?: string;
  bio?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface CreateTeacherInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  employee_id?: string;
  specialization?: string;
  hire_date?: string;
  status?: TeacherStatus;
  profile_image_url?: string;
  bio?: string;
  notes?: string;
}

export interface UpdateTeacherInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  employee_id?: string;
  specialization?: string;
  hire_date?: string;
  status?: TeacherStatus;
  profile_image_url?: string;
  bio?: string;
  notes?: string;
}

export interface TeacherFilter {
  status?: TeacherStatus | TeacherStatus[];
  specialization?: string;
  search?: string;  // 이름 검색
}

// 반-강사 배정용
export interface ClassTeacher {
  id: string;
  tenant_id: string;
  class_id: string;
  teacher_id: string;  // academy_teachers.person_id
  role: TeacherRole;
  assigned_at: string;
  unassigned_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface AssignTeacherInput {
  class_id: string;
  teacher_id: string;
  role: TeacherRole;
  assigned_at?: string;  // 기본값 null
}

// 출결 관리용
export type AttendanceType = 'check_in' | 'check_out' | 'absent' | 'late';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface AttendanceLog {
  id: string;
  tenant_id: string;
  student_id: string;
  class_id?: string;
  occurred_at: string;  // timestamptz
  attendance_type: AttendanceType;
  status: AttendanceStatus;
  check_in_method?: 'manual' | 'kiosk_phone' | 'qr_scan' | 'phone_auth';  // 체크인 방법
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface CreateAttendanceLogInput {
  student_id: string;
  class_id?: string;
  occurred_at: string;  // timestamptz
  attendance_type: AttendanceType;
  status: AttendanceStatus;
  check_in_method?: 'manual' | 'kiosk_phone' | 'qr_scan' | 'phone_auth';  // 체크인 방법
  notes?: string;
}

export interface AttendanceFilter {
  student_id?: string;
  class_id?: string;
  date_from?: string;  // date
  date_to?: string;    // date
  attendance_type?: AttendanceType;
  status?: AttendanceStatus;
}

// 일정 충돌 감지용
export type ConflictType = 'teacher_conflict' | 'room_conflict';

export interface ScheduleConflict {
  type: ConflictType;
  class_id: string;
  class_name: string;
  teacher_name?: string;
  room?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  message: string;
}

export interface ScheduleConflictResult {
  has_conflicts: boolean;
  conflict_count: number;
  conflicts: ScheduleConflict[];
}

