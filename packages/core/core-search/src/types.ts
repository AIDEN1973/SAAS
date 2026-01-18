/**
 * Core Search Types
 *
 * Full Text Search 공통 시스템 (Phase 2: PostgreSQL FTS 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 중요: Phase 2는 PostgreSQL Full Text Search (simple 사전, 공백 기준 토큰화)
 * Phase 3+에서 전문 검색엔진(Meilisearch, Algolia 등) 검토
 */

/**
 * 검색 가능한 엔티티 타입
 * - student: 학생 (persons 테이블, person_type='student')
 * - teacher: 강사 (persons 테이블, person_type='teacher')
 * - class: 반/수업 (academy_classes 테이블)
 * - guardian: 보호자 (guardians 테이블)
 * - consultation: 상담 (student_consultations 테이블)
 * - announcement: 공지사항 (announcements 테이블)
 * - tag: 태그 (tags 테이블)
 */
export type SearchEntityType =
  | 'student'
  | 'teacher'
  | 'class'
  | 'guardian'
  | 'consultation'
  | 'announcement'
  | 'tag';

/**
 * 검색 결과 항목
 */
export interface SearchResult {
  id: string;
  entity_type: SearchEntityType;
  title: string;
  subtitle: string;
  relevance: number;
  created_at: string;
}

/**
 * 검색 입력 파라미터
 */
export interface SearchInput {
  query: string;
  entity_types?: SearchEntityType[];
  limit?: number;
}

/**
 * 기본 검색 엔티티 타입
 */
export const DEFAULT_SEARCH_ENTITY_TYPES: SearchEntityType[] = [
  'student',
  'teacher',
  'class',
  'guardian',
  'consultation',
  'announcement',
  'tag',
];

/**
 * 엔티티 타입별 한글 라벨
 */
export const SEARCH_ENTITY_TYPE_LABELS: Record<SearchEntityType, string> = {
  student: '학생',
  teacher: '강사',
  class: '수업',
  guardian: '보호자',
  consultation: '상담',
  announcement: '공지사항',
  tag: '태그',
};

/**
 * 엔티티 타입별 아이콘 이름 (Phosphor Icons)
 */
export const SEARCH_ENTITY_TYPE_ICONS: Record<SearchEntityType, string> = {
  student: 'User',
  teacher: 'Chalkboard',
  class: 'Chalkboard',
  guardian: 'Users',
  consultation: 'ChatCircle',
  announcement: 'Megaphone',
  tag: 'Tag',
};
