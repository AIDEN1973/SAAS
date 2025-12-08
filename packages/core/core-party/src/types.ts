/**
 * Core Party Types
 * 
 * ?원/고객 공통 모델 (persons ?이?기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존?? ?음
 */

export type PersonType = 'student' | 'customer' | 'member' | 'resident' | 'donor' | 'teacher';

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

