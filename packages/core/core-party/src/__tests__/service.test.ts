/**
 * PartyService Unit Tests
 *
 * Core Party CRUD, filtering, error handling
 * [withTenant] SELECT/UPDATE/DELETE uses withTenant(), INSERT uses tenant_id in row
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted for mock variables
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

import { PartyService } from '../service';

const TENANT_ID = 'test-tenant-id';

/**
 * Supabase chain mock factory
 * - Chainable methods return the chain itself
 * - `.single()` returns { data, error } synchronously
 * - Thenable: `await chain` resolves to { data, error }
 */
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'is',
    'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'range',
    'ilike', 'or', 'not', 'contains', 'filter', 'textSearch',
    'maybeSingle', 'csv', 'match', 'like', 'upsert',
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

describe('PartyService', () => {
  let service: PartyService;

  beforeEach(() => {
    service = new PartyService();
    vi.clearAllMocks();
  });

  // ─── getPersons ──────────────────────────────────────────────

  describe('getPersons', () => {
    it('persons 목록 조회 성공', async () => {
      const persons = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'Alice', person_type: 'learner', created_at: '2026-01-01', updated_at: '2026-01-01' },
        { id: 'p2', tenant_id: TENANT_ID, name: 'Bob', person_type: 'instructor', created_at: '2026-01-02', updated_at: '2026-01-02' },
      ];
      const chain = createChainMock(persons);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPersons(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(persons);
    });

    it('person_type 단일 문자열 필터', async () => {
      const persons = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'Alice', person_type: 'learner' },
      ];
      const chain = createChainMock(persons);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPersons(TENANT_ID, { person_type: 'learner' });

      expect(chain.eq).toHaveBeenCalledWith('person_type', 'learner');
      expect(chain.in).not.toHaveBeenCalled();
      expect(result).toEqual(persons);
    });

    it('person_type 배열 필터 (in 연산)', async () => {
      const persons = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'Alice', person_type: 'learner' },
        { id: 'p2', tenant_id: TENANT_ID, name: 'Bob', person_type: 'instructor' },
      ];
      const chain = createChainMock(persons);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPersons(TENANT_ID, {
        person_type: ['learner', 'instructor'],
      });

      expect(chain.in).toHaveBeenCalledWith('person_type', ['learner', 'instructor']);
      expect(chain.eq).not.toHaveBeenCalled();
      expect(result).toEqual(persons);
    });

    it('search 필터 (ilike)', async () => {
      const persons = [
        { id: 'p1', tenant_id: TENANT_ID, name: 'Alice', person_type: 'learner' },
      ];
      const chain = createChainMock(persons);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPersons(TENANT_ID, { search: 'Ali' });

      expect(chain.ilike).toHaveBeenCalledWith('name', '%Ali%');
      expect(result).toEqual(persons);
    });

    it('빈 결과 시 빈 배열 반환 (data = null)', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPersons(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'Connection timeout' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getPersons(TENANT_ID)).rejects.toThrow(
        'Failed to fetch persons: Connection timeout'
      );
    });
  });

  // ─── getPerson ───────────────────────────────────────────────

  describe('getPerson', () => {
    it('person 상세 조회 성공', async () => {
      const person = {
        id: 'p1',
        tenant_id: TENANT_ID,
        name: 'Alice',
        email: 'alice@test.com',
        phone: '010-1234-5678',
        person_type: 'learner',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      const chain = createChainMock(person);
      mockFrom.mockReturnValue(chain);

      const result = await service.getPerson(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(person);
    });

    it('PGRST116 에러 시 null 반환 (not found)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'No rows found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getPerson(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('PGRST116 외 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { code: 'PGRST301', message: 'Connection refused' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getPerson(TENANT_ID, 'p1')).rejects.toThrow(
        'Failed to fetch person: Connection refused'
      );
    });
  });

  // ─── createPerson ────────────────────────────────────────────

  describe('createPerson', () => {
    it('person 생성 성공 (INSERT row에 tenant_id 포함)', async () => {
      const created = {
        id: 'p-new',
        tenant_id: TENANT_ID,
        name: 'Charlie',
        email: 'charlie@test.com',
        phone: '010-9999-0000',
        address: 'Seoul',
        person_type: 'learner',
        created_at: '2026-03-06',
        updated_at: '2026-03-06',
      };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await service.createPerson(TENANT_ID, {
        name: 'Charlie',
        email: 'charlie@test.com',
        phone: '010-9999-0000',
        address: 'Seoul',
        person_type: 'learner',
      });

      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(chain.insert).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        name: 'Charlie',
        email: 'charlie@test.com',
        phone: '010-9999-0000',
        address: 'Seoul',
        person_type: 'learner',
      });
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'Duplicate key violation' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.createPerson(TENANT_ID, {
          name: 'Charlie',
          person_type: 'learner',
        })
      ).rejects.toThrow('Failed to create person: Duplicate key violation');
    });
  });

  // ─── updatePerson ────────────────────────────────────────────

  describe('updatePerson', () => {
    it('person 수정 성공', async () => {
      const updated = {
        id: 'p1',
        tenant_id: TENANT_ID,
        name: 'Alice Updated',
        email: 'alice-new@test.com',
        person_type: 'learner',
        created_at: '2026-01-01',
        updated_at: '2026-03-06',
      };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updatePerson(TENANT_ID, 'p1', {
        name: 'Alice Updated',
        email: 'alice-new@test.com',
      });

      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(chain.update).toHaveBeenCalledWith({
        name: 'Alice Updated',
        email: 'alice-new@test.com',
      });
      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'Row not found' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updatePerson(TENANT_ID, 'p1', { name: 'Updated' })
      ).rejects.toThrow('Failed to update person: Row not found');
    });
  });

  // ─── deletePerson ────────────────────────────────────────────

  describe('deletePerson', () => {
    it('person 삭제 성공', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.deletePerson(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'Foreign key constraint' });
      mockFrom.mockReturnValue(chain);

      await expect(service.deletePerson(TENANT_ID, 'p1')).rejects.toThrow(
        'Failed to delete person: Foreign key constraint'
      );
    });
  });
});
