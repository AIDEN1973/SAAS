/**
 * Core Tags Types
 *
 * 공통 태깅 시스템(학생 태그, 고객 태그, 매물 태그 등)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type EntityType = 'student' | 'customer' | 'property' | 'donor' | 'other';

export interface Tag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  description?: string;
  entity_type?: EntityType;  // 업종별 엔티티 타입(선택)
  created_at: string;
}

export interface TagAssignment {
  id: string;
  tenant_id: string;
  entity_id: string;  // student_id, customer_id 등
  entity_type: EntityType;
  tag_id: string;
  created_at: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  description?: string;
  entity_type?: EntityType;
}

export interface TagFilter {
  entity_type?: EntityType;
  entity_id?: string;
}
