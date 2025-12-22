/**
 * Core Party Types
 *
 * ?원/고객 공통 모델 (persons ?이?기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존?? ?음
 */

export type PersonType =
  | 'learner'  // 업종 중립 정본 키 (academy: 학생, salon: 고객 등)
  | 'student'  // backward compatibility (deprecated, use learner)
  | 'customer'
  | 'member'
  | 'resident'
  | 'donor'
  | 'instructor'  // 업종 중립 정본 키 (academy: 강사, salon: 스타일리스트 등)
  | 'teacher';  // backward compatibility (deprecated, use instructor)

export interface Person {
  id: string;
  tenant_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  person_type: PersonType;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  person_type: PersonType;
}

export interface UpdatePersonInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  person_type?: PersonType;
}

export interface PersonFilter {
  person_type?: PersonType | PersonType[];
  search?: string;  // ?름 검??
}

