/**
 * SchemaRegistryService Unit Tests
 *
 * Tests for schema registration, retrieval (with priority resolution),
 * activation, deprecation, and tenant version pinning operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- vi.hoisted mocks (hoisted above imports) ---
const { mockFrom, mockAuth } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockAuth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
    }),
  },
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({ from: mockFrom, auth: mockAuth }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

// Mock schema-engine: provide SchemaRegistryClient stub and types
vi.mock('@schema-engine', () => ({
  SchemaRegistryClient: class {
    resolveSchema(_entity: string, entries: Array<{ schema_json: unknown }>) {
      return entries.length > 0 ? entries[0].schema_json : null;
    }
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createChainMock(
  resolvedData: unknown = [],
  resolvedError: unknown = null
) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'range', 'ilike', 'or', 'not',
    'contains', 'filter', 'textSearch', 'maybeSingle', 'csv',
    'match', 'like',
  ];

  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }

  chain.single = vi.fn(() => ({
    data: resolvedData,
    error: resolvedError,
  }));

  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({ data: resolvedData, error: resolvedError });
    },
  });

  return chain;
}

const TENANT_ID = 'test-tenant-id';

// ─── Tests ─────────────────────────────────────────────────────────────────

import { SchemaRegistryService } from '../service';

describe('SchemaRegistryService', () => {
  let service: SchemaRegistryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SchemaRegistryService();
  });

  // ── registerSchema ──────────────────────────────────────────────────────

  describe('registerSchema', () => {
    it('should register a schema with default draft status and convert minSupportedClient to snake_case', async () => {
      const mockEntry = {
        id: 'schema-1',
        entity: 'student',
        industry_type: 'academy',
        version: '1.0.0',
        min_supported_client: '1.0.0',
        schema_json: { entity: 'student', type: 'form', sections: [] },
        status: 'draft',
        activated_at: null,
      };

      const chain = createChainMock(mockEntry);
      mockFrom.mockReturnValue(chain);

      const result = await service.registerSchema({
        entity: 'student',
        industry_type: 'academy',
        version: '1.0.0',
        minSupportedClient: '1.0.0',
        schema_json: { entity: 'student', type: 'form', sections: [] } as never,
      });

      expect(mockFrom).toHaveBeenCalledWith('meta.schema_registry');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'student',
          industry_type: 'academy',
          version: '1.0.0',
          min_supported_client: '1.0.0', // camelCase → snake_case
          status: 'draft', // default status
        })
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: 'schema-1',
        entity: 'student',
        version: '1.0.0',
        status: 'draft',
      }));
    });

    it('should throw an error when minSupportedClient is empty', async () => {
      await expect(
        service.registerSchema({
          entity: 'student',
          version: '1.0.0',
          minSupportedClient: '',
          schema_json: { entity: 'student', type: 'form', sections: [] } as never,
        })
      ).rejects.toThrow('minSupportedClient is required and cannot be empty');
    });

    it('should throw on supabase error', async () => {
      const chain = createChainMock(null, { message: 'duplicate key' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.registerSchema({
          entity: 'student',
          version: '1.0.0',
          minSupportedClient: '1.0.0',
          schema_json: { entity: 'student', type: 'form', sections: [] } as never,
        })
      ).rejects.toThrow('Failed to register schema: duplicate key');
    });
  });

  // ── getSchema ───────────────────────────────────────────────────────────

  describe('getSchema', () => {
    it('should return schema using pinned version when tenant has a pin', async () => {
      const pinnedEntry = {
        id: 'schema-pinned',
        entity: 'student',
        industry_type: null,
        version: '1.0.0',
        min_supported_client: '1.0.0',
        schema_json: { entity: 'student', type: 'form', sections: [{ id: 'pinned' }] },
        status: 'active',
        activated_at: '2026-01-01T00:00:00Z',
      };

      // First call: getPinnedVersion (meta.tenant_schema_pins)
      const pinChain = createChainMock({ pinned_version: '1.0.0' });
      // Second call: getActiveSchemas (meta.schema_registry)
      const activeChain = createChainMock([pinnedEntry]);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return pinChain;
        return activeChain;
      });

      const result = await service.getSchema('student', {
        tenantId: TENANT_ID,
        clientVersion: '1.0.0',
      });

      // First call should be for pinned version
      expect(mockFrom).toHaveBeenCalledWith('meta.tenant_schema_pins');
      // Second call should be for active schemas
      expect(mockFrom).toHaveBeenCalledWith('meta.schema_registry');
      expect(result).not.toBeNull();
    });

    it('should fallback to active schemas when no pinned version exists', async () => {
      const activeEntry = {
        id: 'schema-active',
        entity: 'student',
        industry_type: null,
        version: '2.0.0',
        min_supported_client: '1.0.0',
        schema_json: { entity: 'student', type: 'form', sections: [{ id: 'active' }] },
        status: 'active',
        activated_at: '2026-01-15T00:00:00Z',
      };

      // getPinnedVersion returns PGRST116 (not found)
      const pinChain = createChainMock(null, { code: 'PGRST116' });
      // getActiveSchemas returns active entries
      const activeChain = createChainMock([activeEntry]);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return pinChain;
        return activeChain;
      });

      const result = await service.getSchema('student', {
        tenantId: TENANT_ID,
        clientVersion: '1.0.0',
      });

      expect(result).not.toBeNull();
    });

    it('should return null when no schema is found', async () => {
      // getPinnedVersion returns PGRST116 (not found)
      const pinChain = createChainMock(null, { code: 'PGRST116' });
      // getActiveSchemas returns empty array
      const activeChain = createChainMock([]);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return pinChain;
        return activeChain;
      });

      const result = await service.getSchema('student', {
        tenantId: TENANT_ID,
        clientVersion: '1.0.0',
      });

      expect(result).toBeNull();
    });

    it('should throw on active schemas fetch error', async () => {
      // getPinnedVersion returns null (no pin, PGRST116)
      const pinChain = createChainMock(null, { code: 'PGRST116' });
      // getActiveSchemas fails
      const activeChain = createChainMock(null, { message: 'connection refused' });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return pinChain;
        return activeChain;
      });

      await expect(
        service.getSchema('student', {
          tenantId: TENANT_ID,
          clientVersion: '1.0.0',
        })
      ).rejects.toThrow('Failed to fetch active schemas: connection refused');
    });
  });

  // ── activateSchema ──────────────────────────────────────────────────────

  describe('activateSchema', () => {
    it('should deprecate existing active schemas and activate the target version', async () => {
      const activatedEntry = {
        id: 'schema-1',
        entity: 'student',
        industry_type: null,
        version: '2.0.0',
        min_supported_client: '1.5.0',
        schema_json: { entity: 'student', type: 'form', sections: [] },
        status: 'active',
        activated_at: '2026-03-06T00:00:00Z',
      };

      // First call: deprecate existing active schemas (resolves with no error via then)
      const deprecateChain = createChainMock(null, null);
      // Second call: activate target schema
      const activateChain = createChainMock(activatedEntry);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return deprecateChain;
        return activateChain;
      });

      const result = await service.activateSchema({
        entity: 'student',
        version: '2.0.0',
      });

      expect(mockFrom).toHaveBeenCalledTimes(2);
      // First call: deprecate existing
      expect(deprecateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'deprecated' })
      );
      // Second call: activate target
      expect(activateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
      expect(result).toEqual(expect.objectContaining({
        id: 'schema-1',
        status: 'active',
        version: '2.0.0',
      }));
    });

    it('should throw when deprecation step fails', async () => {
      const deprecateChain = createChainMock(null, { message: 'timeout' });
      mockFrom.mockReturnValue(deprecateChain);

      await expect(
        service.activateSchema({ entity: 'student', version: '2.0.0' })
      ).rejects.toThrow('Failed to deprecate existing active schema: timeout');
    });

    it('should throw when activation step fails', async () => {
      // First call: deprecate succeeds
      const deprecateChain = createChainMock(null, null);
      // Second call: activate fails
      const activateChain = createChainMock(null, { message: 'not found' });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return deprecateChain;
        return activateChain;
      });

      await expect(
        service.activateSchema({ entity: 'student', version: '2.0.0' })
      ).rejects.toThrow('Failed to activate schema: not found');
    });
  });

  // ── deprecateSchema ─────────────────────────────────────────────────────

  describe('deprecateSchema', () => {
    it('should deprecate the specified schema version', async () => {
      const deprecatedEntry = {
        id: 'schema-1',
        entity: 'student',
        industry_type: null,
        version: '1.0.0',
        min_supported_client: '1.0.0',
        schema_json: { entity: 'student', type: 'form', sections: [] },
        status: 'deprecated',
        activated_at: null,
      };

      const chain = createChainMock(deprecatedEntry);
      mockFrom.mockReturnValue(chain);

      const result = await service.deprecateSchema({
        entity: 'student',
        version: '1.0.0',
      });

      expect(mockFrom).toHaveBeenCalledWith('meta.schema_registry');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'deprecated' })
      );
      expect(chain.eq).toHaveBeenCalledWith('entity', 'student');
      expect(chain.eq).toHaveBeenCalledWith('version', '1.0.0');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: 'schema-1',
        status: 'deprecated',
      }));
    });

    it('should throw on supabase error', async () => {
      const chain = createChainMock(null, { message: 'row not found' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.deprecateSchema({ entity: 'student', version: '1.0.0' })
      ).rejects.toThrow('Failed to deprecate schema: row not found');
    });
  });

  // ── getPinnedVersion ────────────────────────────────────────────────────

  describe('getPinnedVersion', () => {
    it('should return the pinned version for the tenant', async () => {
      const chain = createChainMock({ pinned_version: '1.5.0' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getPinnedVersion(TENANT_ID, 'student', null);

      expect(mockFrom).toHaveBeenCalledWith('meta.tenant_schema_pins');
      expect(chain.select).toHaveBeenCalledWith('pinned_version');
      expect(chain.eq).toHaveBeenCalledWith('entity', 'student');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual({ pinned_version: '1.5.0' });
    });

    it('should return null when no pinned version exists (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getPinnedVersion(TENANT_ID, 'student', null);

      expect(result).toBeNull();
    });

    it('should throw on non-PGRST116 error', async () => {
      const chain = createChainMock(null, {
        code: 'OTHER',
        message: 'unexpected error',
      });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.getPinnedVersion(TENANT_ID, 'student', null)
      ).rejects.toThrow('Failed to fetch pinned version: unexpected error');
    });
  });

  // ── pinSchemaVersion ────────────────────────────────────────────────────

  describe('pinSchemaVersion', () => {
    it('should upsert the pinned version for a tenant', async () => {
      const chain = createChainMock({ pinned_version: '2.0.0' });
      mockFrom.mockReturnValue(chain);

      await service.pinSchemaVersion({
        tenant_id: TENANT_ID,
        entity: 'student',
        industry_type: 'academy',
        pinned_version: '2.0.0',
        reason: 'Testing pinning',
      });

      expect(mockFrom).toHaveBeenCalledWith('meta.tenant_schema_pins');
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          entity: 'student',
          industry_type: 'academy',
          pinned_version: '2.0.0',
          reason: 'Testing pinning',
        })
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
    });

    it('should throw on supabase error', async () => {
      const chain = createChainMock(null, { message: 'constraint violation' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.pinSchemaVersion({
          tenant_id: TENANT_ID,
          entity: 'student',
          pinned_version: '2.0.0',
        })
      ).rejects.toThrow('Failed to pin schema version: constraint violation');
    });
  });

  // ── unpinSchemaVersion ──────────────────────────────────────────────────

  describe('unpinSchemaVersion', () => {
    it('should delete the pinned version for a tenant', async () => {
      const chain = createChainMock(null, null);
      mockFrom.mockReturnValue(chain);

      await service.unpinSchemaVersion(TENANT_ID, 'student', 'academy');

      expect(mockFrom).toHaveBeenCalledWith('meta.tenant_schema_pins');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('entity', 'student');
    });

    it('should throw on supabase error', async () => {
      const chain = createChainMock(null, { message: 'permission denied' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.unpinSchemaVersion(TENANT_ID, 'student', null)
      ).rejects.toThrow('Failed to unpin schema version: permission denied');
    });
  });
});
