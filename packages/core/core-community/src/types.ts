/**
 * Core Community Types
 * 
 * 게시판/댓글/공지 공통 모듈
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type PostType = 'notice' | 'board' | 'announcement';

export interface Post {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  post_type: PostType;
  is_pinned: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  tenant_id: string;
  post_id: string;
  content: string;
  created_by?: string;
  created_at: string;
}

export interface CreatePostInput {
  title: string;
  content: string;
  post_type: PostType;
  is_pinned?: boolean;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  post_type?: PostType;
  is_pinned?: boolean;
}

export interface CreateCommentInput {
  post_id: string;
  content: string;
}

export interface PostFilter {
  post_type?: PostType;
  is_pinned?: boolean;
  search?: string;
}

