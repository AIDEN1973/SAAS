/**
 * Core Community Types
 * 
 * ê²Œì‹œ???“ê?/ê³µì? ê³µí†µ ëª¨ë“ˆ
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
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

