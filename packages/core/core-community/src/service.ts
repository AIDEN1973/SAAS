/**
 * Core Community Service
 * 
 * ê²Œì‹œ???“ê?/ê³µì? ?œë¹„??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Post,
  Comment,
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  PostFilter,
} from './types';

export class CommunityService {
  private supabase = createServerClient();

  /**
   * ê²Œì‹œê¸€ ëª©ë¡ ì¡°íšŒ
   */
  async getPosts(
    tenantId: string,
    filter?: PostFilter
  ): Promise<Post[]> {
    let query = withTenant(
      this.supabase.from('posts').select('*'),
      tenantId
    );

    if (filter?.post_type) {
      query = query.eq('post_type', filter.post_type);
    }

    if (filter?.is_pinned !== undefined) {
      query = query.eq('is_pinned', filter.is_pinned);
    }

    if (filter?.search) {
      query = query.or(`title.ilike.%${filter.search}%,content.ilike.%${filter.search}%`);
    }

    // ê³ ì •ê¸€ ë¨¼ì?, ê·??¤ìŒ ìµœì‹ ??
    query = query.order('is_pinned', { ascending: false });
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    return (data || []) as Post[];
  }

  /**
   * ê²Œì‹œê¸€ ?ì„¸ ì¡°íšŒ
   */
  async getPost(tenantId: string, postId: string): Promise<Post | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('posts')
        .select('*')
        .eq('id', postId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch post: ${error.message}`);
    }

    return data as Post;
  }

  /**
   * ê²Œì‹œê¸€ ?ì„±
   */
  async createPost(
    tenantId: string,
    input: CreatePostInput
  ): Promise<Post> {
    const { data, error } = await this.supabase
      .from('posts')
      .insert({
        tenant_id: tenantId,
        title: input.title,
        content: input.content,
        post_type: input.post_type,
        is_pinned: input.is_pinned ?? false,
        created_by: null, // TODO: auth.uid()?ì„œ ê°€?¸ì˜¤ê¸?
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create post: ${error.message}`);
    }

    return data as Post;
  }

  /**
   * ê²Œì‹œê¸€ ?˜ì •
   */
  async updatePost(
    tenantId: string,
    postId: string,
    input: UpdatePostInput
  ): Promise<Post> {
    const { data, error } = await withTenant(
      this.supabase
        .from('posts')
        .update(input)
        .eq('id', postId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update post: ${error.message}`);
    }

    return data as Post;
  }

  /**
   * ê²Œì‹œê¸€ ?? œ
   */
  async deletePost(tenantId: string, postId: string): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('posts')
        .delete()
        .eq('id', postId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete post: ${error.message}`);
    }
  }

  /**
   * ?“ê? ëª©ë¡ ì¡°íšŒ
   */
  async getComments(
    tenantId: string,
    postId: string
  ): Promise<Comment[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    return (data || []) as Comment[];
  }

  /**
   * ?“ê? ?ì„±
   */
  async createComment(
    tenantId: string,
    input: CreateCommentInput
  ): Promise<Comment> {
    const { data, error } = await this.supabase
      .from('comments')
      .insert({
        tenant_id: tenantId,
        post_id: input.post_id,
        content: input.content,
        created_by: null, // TODO: auth.uid()?ì„œ ê°€?¸ì˜¤ê¸?
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create comment: ${error.message}`);
    }

    return data as Comment;
  }

  /**
   * ?“ê? ?? œ
   */
  async deleteComment(
    tenantId: string,
    commentId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('comments')
        .delete()
        .eq('id', commentId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete comment: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const communityService = new CommunityService();

