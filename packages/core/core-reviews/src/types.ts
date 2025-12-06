/**
 * Core Reviews Types
 * 
 * 리뷰/평가 시스템
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export interface Review {
  id: string;
  tenant_id: string;
  person_id?: string;
  rating: number;  // 1-5
  title?: string;
  content?: string;
  is_visible: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewInput {
  person_id?: string;
  rating: number;
  title?: string;
  content?: string;
  is_visible?: boolean;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  content?: string;
  is_visible?: boolean;
}

export interface ReviewFilter {
  person_id?: string;
  rating?: number;
  is_visible?: boolean;
}

