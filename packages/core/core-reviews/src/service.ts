/**
 * Core Reviews Service
 *
 * 리뷰/평점 관리 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Review,
  CreateReviewInput,
  UpdateReviewInput,
  ReviewFilter,
} from './types';

export class ReviewsService {
  private supabase = createServerClient();

  /**
   * 리뷰 목록 조회
   */
  async getReviews(
    tenantId: string,
    filter?: ReviewFilter
  ): Promise<Review[]> {
    let query = withTenant(
      this.supabase.from('reviews').select('*'),
      tenantId
    );

    if (filter?.person_id) {
      query = query.eq('person_id', filter.person_id);
    }

    if (filter?.rating) {
      query = query.eq('rating', filter.rating);
    }

    if (filter?.is_visible !== undefined) {
      query = query.eq('is_visible', filter.is_visible);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`);
    }

    return (data || []) as Review[];
  }

  /**
   * 리뷰 상세 조회
   */
  async getReview(tenantId: string, reviewId: string): Promise<Review | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('reviews')
        .select('*')
        .eq('id', reviewId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch review: ${error.message}`);
    }

    return data as Review;
  }

  /**
   * 리뷰 생성
   */
  async createReview(
    tenantId: string,
    input: CreateReviewInput
  ): Promise<Review> {
    if (input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const { data, error } = await this.supabase
      .from('reviews')
      .insert({
        tenant_id: tenantId,
        person_id: input.person_id,
        rating: input.rating,
        title: input.title,
        content: input.content,
        is_visible: input.is_visible ?? true,
        created_by: null, // TODO: auth.uid()에서 가져오기
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create review: ${error.message}`);
    }

    return data as Review;
  }

  /**
   * 리뷰 수정
   */
  async updateReview(
    tenantId: string,
    reviewId: string,
    input: UpdateReviewInput
  ): Promise<Review> {
    if (input.rating !== undefined && (input.rating < 1 || input.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    const { data, error } = await withTenant(
      this.supabase
        .from('reviews')
        .update(input)
        .eq('id', reviewId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update review: ${error.message}`);
    }

    return data as Review;
  }

  /**
   * 리뷰 삭제
   */
  async deleteReview(tenantId: string, reviewId: string): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete review: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const reviewsService = new ReviewsService();
