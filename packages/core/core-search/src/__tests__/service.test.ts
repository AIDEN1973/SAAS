/**
 * Core Search Service Tests
 *
 * SearchService 단위 테스트
 * - search: 통합 검색 (RPC global_search 호출)
 * - searchByEntityType: 특정 엔티티 타입 검색 (단일 엔티티 타입, 기본 limit)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

const TENANT_ID = 'test-tenant-id';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SearchService', () => {
  let service: InstanceType<typeof import('../service').SearchService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../service');
    service = new mod.SearchService();
  });

  // =========================================================================
  // search
  // =========================================================================
  describe('search', () => {
    it('should call global_search RPC and return mapped results', async () => {
      const rpcResults = [
        {
          id: 'r-1',
          entity_type: 'student',
          title: 'John Doe',
          subtitle: 'Class A',
          relevance: 0.95,
          created_at: '2026-03-05T10:00:00Z',
        },
        {
          id: 'r-2',
          entity_type: 'teacher',
          title: 'Jane Smith',
          subtitle: 'Math',
          relevance: 0.8,
          created_at: '2026-03-04T09:00:00Z',
        },
      ];
      mockRpc.mockResolvedValue({ data: rpcResults, error: null });

      const result = await service.search(TENANT_ID, {
        query: 'John',
        entity_types: ['student', 'teacher'],
        limit: 10,
      });

      expect(mockRpc).toHaveBeenCalledWith('global_search', {
        p_tenant_id: TENANT_ID,
        p_query: 'John',
        p_entity_types: ['student', 'teacher'],
        p_limit: 10,
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'r-1',
        entity_type: 'student',
        title: 'John Doe',
        subtitle: 'Class A',
        relevance: 0.95,
        created_at: '2026-03-05T10:00:00Z',
      });
    });

    it('should return empty array for empty query', async () => {
      const result = await service.search(TENANT_ID, { query: '' });

      expect(mockRpc).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only query', async () => {
      const result = await service.search(TENANT_ID, { query: '   ' });

      expect(mockRpc).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should use default entity types and limit when not provided', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await service.search(TENANT_ID, { query: 'test' });

      expect(mockRpc).toHaveBeenCalledWith('global_search', {
        p_tenant_id: TENANT_ID,
        p_query: 'test',
        p_entity_types: ['student', 'teacher', 'class', 'guardian', 'consultation', 'announcement', 'tag'],
        p_limit: 20,
      });
    });

    it('should return empty array on RPC error instead of throwing', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc error' } });

      const result = await service.search(TENANT_ID, { query: 'test' });

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // searchByEntityType
  // =========================================================================
  describe('searchByEntityType', () => {
    it('should search with a single entity type', async () => {
      const rpcResults = [
        {
          id: 's-1',
          entity_type: 'student',
          title: 'Alice',
          subtitle: 'Class B',
          relevance: 0.9,
          created_at: '2026-03-05T10:00:00Z',
        },
      ];
      mockRpc.mockResolvedValue({ data: rpcResults, error: null });

      const result = await service.searchByEntityType(TENANT_ID, 'student', 'Alice');

      expect(mockRpc).toHaveBeenCalledWith('global_search', {
        p_tenant_id: TENANT_ID,
        p_query: 'Alice',
        p_entity_types: ['student'],
        p_limit: 10,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Alice');
    });

    it('should return empty array for empty query', async () => {
      const result = await service.searchByEntityType(TENANT_ID, 'teacher', '');

      expect(mockRpc).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should use default limit of 10', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await service.searchByEntityType(TENANT_ID, 'class', 'math');

      expect(mockRpc).toHaveBeenCalledWith('global_search', expect.objectContaining({
        p_limit: 10,
      }));
    });

    it('should allow custom limit override', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await service.searchByEntityType(TENANT_ID, 'class', 'math', 50);

      expect(mockRpc).toHaveBeenCalledWith('global_search', expect.objectContaining({
        p_limit: 50,
      }));
    });
  });
});
