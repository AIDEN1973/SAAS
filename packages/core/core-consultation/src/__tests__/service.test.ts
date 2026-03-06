/**
 * ConsultationService Unit Tests
 *
 * 상담 CRUD 검증
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

import { ConsultationService } from '../service';

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

describe('ConsultationService', () => {
  let service: ConsultationService;

  beforeEach(() => {
    service = new ConsultationService();
    vi.clearAllMocks();
  });

  // ─── getConsultations ───────────────────────────────────────

  describe('getConsultations', () => {
    it('성공: from(consultations).select 호출 후 consultation_date descending 정렬', async () => {
      const consultations = [
        { id: 'c1', title: '상담1', consultation_date: '2026-03-06' },
        { id: 'c2', title: '상담2', consultation_date: '2026-03-05' },
      ];
      const chain = createChainMock(consultations);
      mockFrom.mockReturnValue(chain);

      const result = await service.getConsultations(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('consultations');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('consultation_date', { ascending: false });
      expect(result).toEqual(consultations);
    });

    it('person_id 필터 적용', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getConsultations(TENANT_ID, { person_id: 'person-1' });

      expect(chain.eq).toHaveBeenCalledWith('person_id', 'person-1');
    });

    it('날짜 범위 필터: date_from, date_to', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getConsultations(TENANT_ID, {
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      });

      expect(chain.gte).toHaveBeenCalledWith('consultation_date', '2026-03-01');
      expect(chain.lte).toHaveBeenCalledWith('consultation_date', '2026-03-31');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'DB connection failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getConsultations(TENANT_ID)).rejects.toThrow(
        'Failed to fetch consultations: DB connection failed'
      );
    });
  });

  // ─── getConsultation ────────────────────────────────────────

  describe('getConsultation', () => {
    it('성공: 단건 조회 반환', async () => {
      const consultation = { id: 'c1', title: '상담1', person_id: 'p1' };
      const chain = createChainMock(consultation);
      mockFrom.mockReturnValue(chain);

      const result = await service.getConsultation(TENANT_ID, 'c1');

      expect(mockFrom).toHaveBeenCalledWith('consultations');
      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(consultation);
    });

    it('PGRST116 에러 시 null 반환', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await service.getConsultation(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'unexpected error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getConsultation(TENANT_ID, 'c1')).rejects.toThrow(
        'Failed to fetch consultation: unexpected error'
      );
    });
  });

  // ─── createConsultation ─────────────────────────────────────

  describe('createConsultation', () => {
    it('성공: tenant_id 포함 insert', async () => {
      const created = { id: 'c-new', title: '새 상담', person_id: 'p1' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await service.createConsultation(TENANT_ID, {
        person_id: 'p1',
        consultation_type: 'phone',
        title: '새 상담',
        content: '상담 내용',
        consultation_date: '2026-03-06',
      });

      expect(mockFrom).toHaveBeenCalledWith('consultations');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          person_id: 'p1',
          consultation_type: 'phone',
          title: '새 상담',
          content: '상담 내용',
          consultation_date: '2026-03-06',
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
        service.createConsultation(TENANT_ID, {
          person_id: 'p1',
          consultation_type: 'phone',
          title: '새 상담',
          content: '내용',
          consultation_date: '2026-03-06',
        })
      ).rejects.toThrow('Failed to create consultation: insert failed');
    });
  });

  // ─── updateConsultation ─────────────────────────────────────

  describe('updateConsultation', () => {
    it('성공: update + eq + select + single 호출', async () => {
      const updated = { id: 'c1', title: '수정된 상담' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await service.updateConsultation(TENANT_ID, 'c1', { title: '수정된 상담' });

      expect(mockFrom).toHaveBeenCalledWith('consultations');
      expect(chain.update).toHaveBeenCalledWith({ title: '수정된 상담' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updateConsultation(TENANT_ID, 'c1', { title: '수정' })
      ).rejects.toThrow('Failed to update consultation: update failed');
    });
  });

  // ─── deleteConsultation ─────────────────────────────────────

  describe('deleteConsultation', () => {
    it('성공: delete + eq 호출', async () => {
      const chain = createChainMock(null, null);
      mockFrom.mockReturnValue(chain);

      await service.deleteConsultation(TENANT_ID, 'c1');

      expect(mockFrom).toHaveBeenCalledWith('consultations');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(service.deleteConsultation(TENANT_ID, 'c1')).rejects.toThrow(
        'Failed to delete consultation: delete failed'
      );
    });
  });
});
