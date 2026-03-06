import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateActivityInput, ActivityFilter } from '../types';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Chain mock helper
// ---------------------------------------------------------------------------
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'range', 'ilike', 'or', 'not',
    'contains', 'filter', 'textSearch', 'maybeSingle',
    'csv', 'match', 'like', 'upsert',
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_ID = 'test-tenant-id';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
import { ActivityService } from '../service';

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ActivityService();
  });

  // =========================================================================
  // createActivity
  // =========================================================================
  describe('createActivity', () => {
    const input: CreateActivityInput = {
      activity_type: 'person.created',
      entity_type: 'person',
      entity_id: 'entity-1',
      user_id: 'user-1',
      description: 'New person registered',
      metadata: { source: 'admin' },
    };

    it('should insert activity with tenant_id and return created record', async () => {
      const created = {
        id: 'activity-1',
        tenant_id: TENANT_ID,
        ...input,
        created_at: '2026-03-06T00:00:00Z',
      };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await service.createActivity(TENANT_ID, input);

      // Verify from('activities') was called
      expect(mockFrom).toHaveBeenCalledWith('activities');

      // Verify insert includes tenant_id in the row object
      expect(chain.insert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        activity_type: input.activity_type,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        user_id: input.user_id,
        description: input.description,
        metadata: input.metadata,
      });

      // Verify select + single chain
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();

      // Verify returned data
      expect(result).toEqual(created);
    });

    it('should throw an error when insert fails', async () => {
      const chain = createChainMock(null, { message: 'insert error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.createActivity(TENANT_ID, input)).rejects.toThrow(
        'Failed to create activity: insert error'
      );
    });
  });

  // =========================================================================
  // getActivities
  // =========================================================================
  describe('getActivities', () => {
    const sampleActivities = [
      {
        id: 'activity-1',
        tenant_id: TENANT_ID,
        activity_type: 'person.created',
        entity_type: 'person',
        entity_id: 'entity-1',
        user_id: 'user-1',
        description: 'Created person',
        created_at: '2026-03-06T00:00:00Z',
      },
      {
        id: 'activity-2',
        tenant_id: TENANT_ID,
        activity_type: 'attendance.checked',
        entity_type: 'attendance',
        entity_id: 'entity-2',
        user_id: 'user-2',
        description: 'Checked attendance',
        created_at: '2026-03-05T00:00:00Z',
      },
    ];

    it('should return activities without filters', async () => {
      const chain = createChainMock(sampleActivities);
      mockFrom.mockReturnValue(chain);

      const result = await service.getActivities(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('activities');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });

      // No filter methods should be called
      expect(chain.eq).not.toHaveBeenCalled();
      expect(chain.gte).not.toHaveBeenCalled();
      expect(chain.lte).not.toHaveBeenCalled();

      expect(result).toEqual(sampleActivities);
    });

    it('should filter by activity_type', async () => {
      const chain = createChainMock([sampleActivities[0]]);
      mockFrom.mockReturnValue(chain);

      const filter: ActivityFilter = { activity_type: 'person.created' };
      const result = await service.getActivities(TENANT_ID, filter);

      expect(chain.eq).toHaveBeenCalledWith('activity_type', 'person.created');
      expect(result).toEqual([sampleActivities[0]]);
    });

    it('should filter by entity_type', async () => {
      const chain = createChainMock([sampleActivities[1]]);
      mockFrom.mockReturnValue(chain);

      const filter: ActivityFilter = { entity_type: 'attendance' };
      const result = await service.getActivities(TENANT_ID, filter);

      expect(chain.eq).toHaveBeenCalledWith('entity_type', 'attendance');
      expect(result).toEqual([sampleActivities[1]]);
    });

    it('should filter by date range (date_from and date_to)', async () => {
      const chain = createChainMock(sampleActivities);
      mockFrom.mockReturnValue(chain);

      const filter: ActivityFilter = {
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      };
      const result = await service.getActivities(TENANT_ID, filter);

      expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-03-01');
      expect(chain.lte).toHaveBeenCalledWith('created_at', '2026-03-31');
      expect(result).toEqual(sampleActivities);
    });

    it('should return empty array when no activities found', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await service.getActivities(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('should throw an error when query fails', async () => {
      const chain = createChainMock(null, { message: 'query error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getActivities(TENANT_ID)).rejects.toThrow(
        'Failed to fetch activities: query error'
      );
    });
  });
});
