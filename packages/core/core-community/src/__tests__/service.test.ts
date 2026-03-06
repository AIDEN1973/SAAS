/**
 * CommunityService Unit Tests
 *
 * 게시글/댓글 CRUD 검증
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

import { CommunityService } from '../service';

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

describe('CommunityService', () => {
  let service: CommunityService;

  beforeEach(() => {
    service = new CommunityService();
    vi.clearAllMocks();
  });

  // ─── getPosts ───────────────────────────────────────────────

  describe('getPosts', () => {
    it('성공: from(posts).select 호출 후 is_pinned desc, created_at desc 정렬', async () => {
      const posts = [
        { id: 'p1', title: '공지', is_pinned: true, created_at: '2026-03-06T10:00:00' },
        { id: 'p2', title: '일반글', is_pinned: false, created_at: '2026-03-06T09:00:00' },
      ];
      const chain = createChainMock(posts);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPosts(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('posts');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('is_pinned', { ascending: false });
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(posts);
    });

    it('search 필터: .or() 호출로 title/content ilike 검색', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getPosts(TENANT_ID, { search: '공지' });

      expect(chain.or).toHaveBeenCalledWith(
        'title.ilike.%공지%,content.ilike.%공지%'
      );
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'DB connection failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getPosts(TENANT_ID)).rejects.toThrow(
        'Failed to fetch posts: DB connection failed'
      );
    });
  });

  // ─── getPost ────────────────────────────────────────────────

  describe('getPost', () => {
    it('성공: 단건 조회 반환', async () => {
      const post = { id: 'p1', title: '공지', content: '내용' };
      const chain = createChainMock(post);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPost(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('posts');
      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(post);
    });

    it('PGRST116 에러 시 null 반환', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getPost(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'unexpected error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getPost(TENANT_ID, 'p1')).rejects.toThrow(
        'Failed to fetch post: unexpected error'
      );
    });
  });

  // ─── createPost ─────────────────────────────────────────────

  describe('createPost', () => {
    it('성공: tenant_id 포함, is_pinned 기본값 false', async () => {
      const created = { id: 'p-new', title: '새 글', is_pinned: false };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await service.createPost(TENANT_ID, {
        title: '새 글',
        content: '내용입니다',
        post_type: 'general',
      } as never);

      expect(mockFrom).toHaveBeenCalledWith('posts');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          title: '새 글',
          content: '내용입니다',
          post_type: 'general',
          is_pinned: false,
        })
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'insert failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.createPost(TENANT_ID, {
          title: '새 글',
          content: '내용',
          post_type: 'general',
        } as never)
      ).rejects.toThrow('Failed to create post: insert failed');
    });
  });

  // ─── updatePost ─────────────────────────────────────────────

  describe('updatePost', () => {
    it('성공: update + eq + select + single 호출', async () => {
      const updated = { id: 'p1', title: '수정된 글' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updatePost(TENANT_ID, 'p1', { title: '수정된 글' });

      expect(mockFrom).toHaveBeenCalledWith('posts');
      expect(chain.update).toHaveBeenCalledWith({ title: '수정된 글' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updatePost(TENANT_ID, 'p1', { title: '수정' })
      ).rejects.toThrow('Failed to update post: update failed');
    });
  });

  // ─── deletePost ─────────────────────────────────────────────

  describe('deletePost', () => {
    it('성공: delete + eq 호출', async () => {
      const chain = createChainMock(null, null);
      mockFrom.mockReturnValue(chain);

      await service.deletePost(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('posts');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.deletePost(TENANT_ID, 'p1')).rejects.toThrow(
        'Failed to delete post: delete failed'
      );
    });
  });

  // ─── getComments ────────────────────────────────────────────

  describe('getComments', () => {
    it('성공: from(comments).select 호출 후 created_at ascending 정렬', async () => {
      const comments = [
        { id: 'cm1', post_id: 'p1', content: '댓글1', created_at: '2026-03-06T09:00:00' },
        { id: 'cm2', post_id: 'p1', content: '댓글2', created_at: '2026-03-06T10:00:00' },
      ];
      const chain = createChainMock(comments);
      mockFrom.mockReturnValue(chain);

      const result = await service.getComments(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('comments');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('post_id', 'p1');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
      expect(result).toEqual(comments);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'fetch comments failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getComments(TENANT_ID, 'p1')).rejects.toThrow(
        'Failed to fetch comments: fetch comments failed'
      );
    });
  });

  // ─── createComment ──────────────────────────────────────────

  describe('createComment', () => {
    it('성공: tenant_id 포함 insert', async () => {
      const created = { id: 'cm-new', post_id: 'p1', content: '새 댓글' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await service.createComment(TENANT_ID, {
        post_id: 'p1',
        content: '새 댓글',
      });

      expect(mockFrom).toHaveBeenCalledWith('comments');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          post_id: 'p1',
          content: '새 댓글',
        })
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'comment insert failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.createComment(TENANT_ID, { post_id: 'p1', content: '댓글' })
      ).rejects.toThrow('Failed to create comment: comment insert failed');
    });
  });

  // ─── deleteComment ──────────────────────────────────────────

  describe('deleteComment', () => {
    it('성공: delete + eq 호출', async () => {
      const chain = createChainMock(null, null);
      mockFrom.mockReturnValue(chain);

      await service.deleteComment(TENANT_ID, 'cm1');

      expect(mockFrom).toHaveBeenCalledWith('comments');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'cm1');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'comment delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.deleteComment(TENANT_ID, 'cm1')).rejects.toThrow(
        'Failed to delete comment: comment delete failed'
      );
    });
  });
});
