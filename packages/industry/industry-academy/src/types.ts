/**
 * Industry Academy Types
 * 
 * ?™ì› ?…ì¢… ?„ìš© ?€???•ì˜
 * [ë¶ˆë? ê·œì¹™] Industry Layer??Core Layerë¥?import?????ˆì?ë§? Core??Industryë¥?import?????†ìŒ
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
  email?: string;
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
  email?: string;
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
  email?: string;
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
  search?: string;  // ?´ë¦„ ê²€??
}

// ë°?Class) ê´€???€??
export type ClassStatus = 'active' | 'inactive' | 'archived';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Class {
  id: string;
  tenant_id: string;
  name: string;
  subject?: string;
  grade?: string;
  day_of_week: DayOfWeek;
  start_time: string;  // time ?•ì‹ (?? "14:00:00")
  end_time: string;  // time ?•ì‹ (?? "15:30:00")
  capacity: number;
  current_count: number;
  color: string;  // ë°??ë™ ?‰ìƒ ?œê¹…
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
  grade?: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  capacity: number;
  color?: string;  // ì§€?•í•˜ì§€ ?Šìœ¼ë©??ë™ ?ì„±
  room?: string;
  notes?: string;
  status?: ClassStatus;
  teacher_ids?: string[];  // ê°•ì‚¬ ë°°ì • (person_id ë°°ì—´)
}

export interface UpdateClassInput {
  name?: string;
  subject?: string;
  grade?: string;
  day_of_week?: DayOfWeek;
  start_time?: string;
  end_time?: string;
  capacity?: number;
  color?: string;
  room?: string;
  notes?: string;
  status?: ClassStatus;
}

export interface ClassFilter {
  status?: ClassStatus | ClassStatus[];
  day_of_week?: DayOfWeek;
  subject?: string;
  grade?: string;
  teacher_id?: string;
  search?: string;  // ë°??´ë¦„ ê²€??
}

// ê°•ì‚¬(Teacher) ê´€???€??
export type TeacherStatus = 'active' | 'on_leave' | 'resigned';
export type TeacherRole = 'teacher' | 'assistant';  // ?´ì„/ë¶€?´ì„

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
  search?: string;  // ?´ë¦„ ê²€??
}

// ë°?ê°•ì‚¬ ?°ê²° ?€??
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
  assigned_at?: string;  // ê¸°ë³¸ê°? ?¤ëŠ˜
}

// ì¶œê²° ê´€ë¦??€??
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

