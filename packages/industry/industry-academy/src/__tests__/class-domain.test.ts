/**
 * ClassDomain Unit Tests
 *
 * 수업(반) CRUD, 통계, 강사 배정 검증
 * [SECURITY] assignTeacher INSERT에 tenant_id 포함 여부 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChainMock, TENANT_ID } from './test-helpers';

const mockFrom = vi.fn();

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

vi.mock('@lib/date-utils', () => ({
  toKST: () => ({
    format: () => '2026-03-05',
  }),
}));

import { ClassDomain } from '../domains/class-domain';

describe('ClassDomain', () => {
  let domain: ClassDomain;
  const mockSupabase = { from: mockFrom } as never;

  beforeEach(() => {
    domain = new ClassDomain(mockSupabase);
    vi.clearAllMocks();
  });

  describe('getClasses', () => {
    it('전체 조회: from(academy_classes).select 호출', async () => {
      const classes = [
        { id: 'c1', name: '수학반', current_count: 10, capacity: 20, status: 'active' },
      ];
      const chain = createChainMock(classes);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getClasses(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('academy_classes');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(result).toEqual(classes);
    });

    it('status 필터 (배열): .in() 호출', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getClasses(TENANT_ID, { status: ['active', 'archived'] });

      expect(chain.in).toHaveBeenCalledWith('status', ['active', 'archived']);
    });

    it('search 필터: .ilike() 호출', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getClasses(TENANT_ID, { search: '수학' });

      expect(chain.ilike).toHaveBeenCalledWith('name', '%수학%');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'DB connection failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getClasses(TENANT_ID)).rejects.toThrow('Failed to fetch classes: DB connection failed');
    });
  });

  describe('createClass', () => {
    it('색상 미지정 시 자동 생성: insert에 color 포함', async () => {
      const created = { id: 'c-new', name: '영어반', current_count: 0, capacity: 15, color: '#3b82f6' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      await domain.createClass(TENANT_ID, { name: '영어반', capacity: 15 });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          name: '영어반',
          color: '#3b82f6', // 자동 생성된 기본 색상
          current_count: 0,
        })
      );
    });

    it('teacher_ids 시 assignTeacher 호출', async () => {
      const created = { id: 'c-new', name: '영어반' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      // assignTeacher를 spy
      const assignSpy = vi.spyOn(domain, 'assignTeacher').mockResolvedValue({} as never);

      await domain.createClass(TENANT_ID, {
        name: '영어반',
        capacity: 15,
        teacher_ids: ['t1', 't2'],
      });

      expect(assignSpy).toHaveBeenCalledTimes(2);
      expect(assignSpy).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        class_id: 'c-new',
        teacher_id: 't1',
      }));
      expect(assignSpy).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        class_id: 'c-new',
        teacher_id: 't2',
      }));

      assignSpy.mockRestore();
    });
  });

  describe('assignTeacher', () => {
    it('INSERT 성공: insert 데이터 확인', async () => {
      const assigned = { class_id: 'c1', teacher_id: 't1', role: 'teacher', is_active: true };
      const chain = createChainMock(assigned);
      mockFrom.mockReturnValue(chain);

      const result = await domain.assignTeacher(TENANT_ID, {
        class_id: 'c1',
        teacher_id: 't1',
        role: 'teacher',
      });

      expect(mockFrom).toHaveBeenCalledWith('class_teachers');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          class_id: 'c1',
          teacher_id: 't1',
          role: 'teacher',
          is_active: true,
        })
      );
      expect(result).toBeDefined();
    });

    it('[SECURITY] INSERT에 tenant_id 포함', async () => {
      const chain = createChainMock({ class_id: 'c1', teacher_id: 't1' });
      mockFrom.mockReturnValue(chain);

      await domain.assignTeacher(TENANT_ID, {
        class_id: 'c1',
        teacher_id: 't1',
        role: 'teacher',
      });

      // INSERT 데이터에 tenant_id가 포함되어야 함
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: TENANT_ID })
      );
    });
  });

  describe('getClassStatistics', () => {
    it('capacity_rate 계산: current_count / capacity * 100', async () => {
      // getClass 내부에서 from().select().eq().single() 호출
      const classData = { id: 'c1', name: '수학반', current_count: 15, capacity: 20 };
      const chain = createChainMock(classData);
      mockFrom.mockReturnValue(chain);

      const stats = await domain.getClassStatistics(TENANT_ID, 'c1');

      expect(stats.capacity_rate).toBe(75); // 15/20*100
    });

    it('class not found 시 Error throw', async () => {
      // getClass가 null 반환하도록 설정 (PGRST116 에러 코드)
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getClassStatistics(TENANT_ID, 'nonexistent')).rejects.toThrow('Class not found');
    });
  });
});
