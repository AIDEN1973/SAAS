/**
 * Industry Academy Types
 * 
 * 학원 업종 전용 타입 정의
 * [불변 규칙] Industry Layer는 Core Layer를 import할 수 있지만, Core는 Industry를 import할 수 없음
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
  search?: string;  // 이름 검색
}

