/**
 * ReviewsService Unit Tests
 *
 * 리뷰 CRUD + 평점 검증
 * [SECURITY] withTenant 적용 여부, INSERT tenant_id 포함 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

import { ReviewsService } from '../service';

const TENANT_ID = 'test-tenant-id';

function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range', 'ilike', 'or', 'not', 'contains', 'filter', 'textSearch', 'maybeSingle', 'csv', 'match', 'like', 'upsert'];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => ({ data: resolvedData, error: resolvedError }));
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({ data: resolvedData, error: resolvedError });
    },
  });
  return chain;
}

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(() => {
    service = new ReviewsService();
    vi.clearAllMocks();
  });

  // ─── getReviews ─────────────────────────────────────────────

  describe('getReviews', () => {
    it('성공: from(reviews).select 호출 후 created_at descending 정렬', async () => {
      const reviews = [
        { id: 'r1', rating: 5, title: '최고', created_at: '2026-03-06T10:00:00' },
        { id: 'r2', rating: 3, title: '보통', created_at: '2026-03-05T10:00:00' },
      ];
      const chain = createChainMock(reviews);
      mockFrom.mockReturnValue(chain);

      const result = await service.getReviews(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('reviews');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(reviews);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'DB connection failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getReviews(TENANT_ID)).rejects.toThrow(
        'Failed to fetch reviews: DB connection failed'
      );
    });
  });

  // ─── getReview ──────────────────────────────────────────────

  describe('getReview', () => {
    it('성공: 단건 조회 반환', async () => {
      const review = { id: 'r1', rating: 5, title: '최고' };
      const chain = createChainMock(review);
      mockFrom.mockReturnValue(chain);

      const result = await service.getReview(TENANT_ID, 'r1');

      expect(mockFrom).toHaveBeenCalledWith('reviews');
      expect(chain.eq).toHaveBeenCalledWith('id', 'r1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(review);
    });

    it('PGRST116 에러 시 null 반환', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getReview(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'unexpected error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getReview(TENANT_ID, 'r1')).rejects.toThrow(
        'Failed to fetch review: unexpected error'
      );
    });
  });

  // ─── createReview ───────────────────────────────────────────

  describe('createReview', () => {
    it('성공: tenant_id 포함, is_visible 기본값 true', async () => {
      const created = { id: 'r-new', rating: 4, title: '좋아요', is_visible: true };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await service.createReview(TENANT_ID, {
        person_id: 'p1',
        rating: 4,
        title: '좋아요',
        content: '만족합니다',
      } as never);

      expect(mockFrom).toHaveBeenCalledWith('reviews');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          person_id: 'p1',
          rating: 4,
          title: '좋아요',
          content: '만족합니다',
          is_visible: true,
        })
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('rating < 1 시 Error throw (DB 호출 전 검증)', async () => {
      await expect(
        service.createReview(TENANT_ID, {
          person_id: 'p1',
          rating: 0,
          title: '잘못된 평점',
          content: '내용',
        } as never)
      ).rejects.toThrow('Rating must be between 1 and 5');

      // DB 호출이 일어나지 않아야 함
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('rating > 5 시 Error throw (DB 호출 전 검증)', async () => {
      await expect(
        service.createReview(TENANT_ID, {
          person_id: 'p1',
          rating: 6,
          title: '잘못된 평점',
          content: '내용',
        } as never)
      ).rejects.toThrow('Rating must be between 1 and 5');

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'insert failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.createReview(TENANT_ID, {
          person_id: 'p1',
          rating: 3,
          title: '보통',
          content: '내용',
        } as never)
      ).rejects.toThrow('Failed to create review: insert failed');
    });
  });

  // ─── updateReview ───────────────────────────────────────────

  describe('updateReview', () => {
    it('성공: update + eq + select + single 호출', async () => {
      const updated = { id: 'r1', rating: 5, title: '수정된 리뷰' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updateReview(TENANT_ID, 'r1', { title: '수정된 리뷰', rating: 5 });

      expect(mockFrom).toHaveBeenCalledWith('reviews');
      expect(chain.update).toHaveBeenCalledWith({ title: '수정된 리뷰', rating: 5 });
      expect(chain.eq).toHaveBeenCalledWith('id', 'r1');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('rating < 1 시 Error throw (DB 호출 전 검증)', async () => {
      await expect(
        service.updateReview(TENANT_ID, 'r1', { rating: 0 })
      ).rejects.toThrow('Rating must be between 1 and 5');

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('rating > 5 시 Error throw (DB 호출 전 검증)', async () => {
      await expect(
        service.updateReview(TENANT_ID, 'r1', { rating: 6 })
      ).rejects.toThrow('Rating must be between 1 and 5');

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('rating 미포함 시 검증 스킵 후 정상 update', async () => {
      const updated = { id: 'r1', title: '제목만 수정' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updateReview(TENANT_ID, 'r1', { title: '제목만 수정' });

      expect(mockFrom).toHaveBeenCalledWith('reviews');
      expect(chain.update).toHaveBeenCalledWith({ title: '제목만 수정' });
      expect(result).toEqual(updated);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updateReview(TENANT_ID, 'r1', { title: '수정' })
      ).rejects.toThrow('Failed to update review: update failed');
    });
  });

  // ─── deleteReview ───────────────────────────────────────────

  describe('deleteReview', () => {
    it('성공: delete + eq 호출', async () => {
      const chain = createChainMock(null, null);
      mockFrom.mockReturnValue(chain);

      await service.deleteReview(TENANT_ID, 'r1');

      expect(mockFrom).toHaveBeenCalledWith('reviews');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'r1');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.deleteReview(TENANT_ID, 'r1')).rejects.toThrow(
        'Failed to delete review: delete failed'
      );
    });
  });
});
