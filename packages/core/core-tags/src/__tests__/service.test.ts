/**
 * TagsService Unit Tests
 *
 * Tests for core tags CRUD operations and entity tag assignments.
 * Validates withTenant() usage for SELECT/UPDATE/DELETE queries
 * and tenant_id inclusion in INSERT row objects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---
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

// --- Chain mock helper ---
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is',
    'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range', 'ilike', 'or',
    'not', 'contains', 'filter', 'textSearch', 'maybeSingle', 'csv',
    'match', 'like', 'upsert',
  ];
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

// --- Import service under test ---
import { TagsService } from '../service';

const TENANT_ID = 'test-tenant-id';

describe('TagsService', () => {
  let service: TagsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TagsService();
  });

  // -------------------------------------------------------
  // getTags
  // -------------------------------------------------------
  describe('getTags', () => {
    it('should return tags list on success', async () => {
      const mockTags = [
        { id: 'tag-1', tenant_id: TENANT_ID, name: 'VIP', color: '#ff0000', created_at: '2026-01-01' },
        { id: 'tag-2', tenant_id: TENANT_ID, name: 'New', color: '#00ff00', created_at: '2026-01-02' },
      ];
      const chain = createChainMock(mockTags);
      mockFrom.mockReturnValue(chain);

      const result = await service.getTags(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('tags');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual(mockTags);
    });

    it('should filter by entity_type when provided', async () => {
      const mockTags = [
        { id: 'tag-1', tenant_id: TENANT_ID, name: 'Beginner', color: '#3b82f6', entity_type: 'learner', created_at: '2026-01-01' },
      ];
      const chain = createChainMock(mockTags);
      mockFrom.mockReturnValue(chain);

      const result = await service.getTags(TENANT_ID, { entity_type: 'learner' });

      expect(chain.eq).toHaveBeenCalledWith('entity_type', 'learner');
      expect(result).toEqual(mockTags);
    });

    it('should return empty array when no tags exist', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await service.getTags(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('should throw on query error', async () => {
      const chain = createChainMock(null, { message: 'connection refused' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getTags(TENANT_ID)).rejects.toThrow(
        'Failed to fetch tags: connection refused'
      );
    });
  });

  // -------------------------------------------------------
  // createTag
  // -------------------------------------------------------
  describe('createTag', () => {
    it('should create a tag with default color', async () => {
      const createdTag = {
        id: 'tag-new',
        tenant_id: TENANT_ID,
        name: 'Important',
        color: '#3b82f6',
        description: undefined,
        entity_type: undefined,
        created_at: '2026-03-06',
      };
      const chain = createChainMock(createdTag);
      mockFrom.mockReturnValue(chain);

      const result = await service.createTag(TENANT_ID, { name: 'Important' });

      expect(mockFrom).toHaveBeenCalledWith('tags');
      expect(chain.insert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        name: 'Important',
        color: '#3b82f6',
        description: undefined,
        entity_type: undefined,
      });
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(createdTag);
    });

    it('should create a tag with custom color', async () => {
      const createdTag = {
        id: 'tag-custom',
        tenant_id: TENANT_ID,
        name: 'Urgent',
        color: '#ef4444',
        description: 'High priority',
        entity_type: 'learner',
        created_at: '2026-03-06',
      };
      const chain = createChainMock(createdTag);
      mockFrom.mockReturnValue(chain);

      const result = await service.createTag(TENANT_ID, {
        name: 'Urgent',
        color: '#ef4444',
        description: 'High priority',
        entity_type: 'learner',
      });

      expect(chain.insert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        name: 'Urgent',
        color: '#ef4444',
        description: 'High priority',
        entity_type: 'learner',
      });
      expect(result).toEqual(createdTag);
    });

    it('should throw on insert error', async () => {
      const chain = createChainMock(null, { message: 'duplicate key' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.createTag(TENANT_ID, { name: 'Duplicate' })
      ).rejects.toThrow('Failed to create tag: duplicate key');
    });
  });

  // -------------------------------------------------------
  // assignTag
  // -------------------------------------------------------
  describe('assignTag', () => {
    it('should assign a tag to an entity', async () => {
      const assignment = {
        id: 'assignment-1',
        tenant_id: TENANT_ID,
        entity_id: 'entity-123',
        entity_type: 'learner',
        tag_id: 'tag-1',
        created_at: '2026-03-06',
      };
      const chain = createChainMock(assignment);
      mockFrom.mockReturnValue(chain);

      const result = await service.assignTag(TENANT_ID, 'entity-123', 'learner', 'tag-1');

      expect(mockFrom).toHaveBeenCalledWith('tag_assignments');
      expect(chain.insert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        entity_id: 'entity-123',
        entity_type: 'learner',
        tag_id: 'tag-1',
      });
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(assignment);
    });

    it('should throw on assignment error', async () => {
      const chain = createChainMock(null, { message: 'foreign key violation' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.assignTag(TENANT_ID, 'entity-123', 'learner', 'tag-bad')
      ).rejects.toThrow('Failed to assign tag: foreign key violation');
    });
  });

  // -------------------------------------------------------
  // assignTags
  // -------------------------------------------------------
  describe('assignTags', () => {
    it('should upsert multiple tag assignments', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.assignTags(TENANT_ID, 'entity-123', 'learner', ['tag-1', 'tag-2', 'tag-3']);

      expect(mockFrom).toHaveBeenCalledWith('tag_assignments');
      expect(chain.upsert).toHaveBeenCalledWith(
        [
          { tenant_id: TENANT_ID, entity_id: 'entity-123', entity_type: 'learner', tag_id: 'tag-1' },
          { tenant_id: TENANT_ID, entity_id: 'entity-123', entity_type: 'learner', tag_id: 'tag-2' },
          { tenant_id: TENANT_ID, entity_id: 'entity-123', entity_type: 'learner', tag_id: 'tag-3' },
        ],
        { onConflict: 'entity_id,entity_type,tag_id' }
      );
    });

    it('should throw on upsert error', async () => {
      const chain = createChainMock(null, { message: 'constraint violation' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.assignTags(TENANT_ID, 'entity-123', 'learner', ['tag-1'])
      ).rejects.toThrow('Failed to assign tags: constraint violation');
    });
  });

  // -------------------------------------------------------
  // getEntityTags
  // -------------------------------------------------------
  describe('getEntityTags', () => {
    it('should return joined tag data for an entity', async () => {
      const joinedData = [
        { tag_id: 'tag-1', tags: { id: 'tag-1', name: 'VIP', color: '#ff0000', description: 'VIP members' } },
        { tag_id: 'tag-2', tags: { id: 'tag-2', name: 'New', color: '#00ff00', description: null } },
      ];
      const chain = createChainMock(joinedData);
      mockFrom.mockReturnValue(chain);

      const result = await service.getEntityTags(TENANT_ID, 'entity-123', 'learner');

      expect(mockFrom).toHaveBeenCalledWith('tag_assignments');
      expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('tag_id'));
      expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('tags'));
      expect(chain.eq).toHaveBeenCalledWith('entity_id', 'entity-123');
      expect(chain.eq).toHaveBeenCalledWith('entity_type', 'learner');
      expect(result).toEqual([
        { id: 'tag-1', name: 'VIP', color: '#ff0000', description: 'VIP members' },
        { id: 'tag-2', name: 'New', color: '#00ff00', description: null },
      ]);
    });

    it('should return empty array when entity has no tags', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await service.getEntityTags(TENANT_ID, 'entity-999', 'learner');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------
  // removeTag
  // -------------------------------------------------------
  describe('removeTag', () => {
    it('should delete a tag assignment', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.removeTag(TENANT_ID, 'entity-123', 'learner', 'tag-1');

      expect(mockFrom).toHaveBeenCalledWith('tag_assignments');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('entity_id', 'entity-123');
      expect(chain.eq).toHaveBeenCalledWith('entity_type', 'learner');
      expect(chain.eq).toHaveBeenCalledWith('tag_id', 'tag-1');
    });

    it('should throw on delete error', async () => {
      const chain = createChainMock(null, { message: 'permission denied' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.removeTag(TENANT_ID, 'entity-123', 'learner', 'tag-1')
      ).rejects.toThrow('Failed to remove tag: permission denied');
    });
  });
});
