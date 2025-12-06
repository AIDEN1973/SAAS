/**
 * Core Party Types
 * 
 * 회원/고객 공통 모델 (persons 테이블 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type PersonType = 'student' | 'customer' | 'member' | 'resident' | 'donor';

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
  search?: string;  // 이름 검색
}

