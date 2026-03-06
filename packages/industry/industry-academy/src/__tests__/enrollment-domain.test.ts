/**
 * EnrollmentDomain Unit Tests
 *
 * 학생 수업 배정/해제, current_count 업데이트, class_name 갱신 검증
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

import { EnrollmentDomain } from '../domains/enrollment-domain';

describe('EnrollmentDomain', () => {
  let domain: EnrollmentDomain;
  const mockClassDomain = {
    getClass: vi.fn(),
  };
  const mockSupabase = { from: mockFrom } as never;

  beforeEach(() => {
    domain = new EnrollmentDomain(mockSupabase, mockClassDomain as never);
    vi.clearAllMocks();
  });

  describe('enrollStudentToClass', () => {
    it('INSERT + current_count + class_name 업데이트 (3쿼리 순서)', async () => {
      // 1. student_classes INSERT
      const insertChain = createChainMock({ id: 'sc1', student_id: 's1', class_id: 'c1' });
      // 2. count 쿼리 (count: exact)
      const countChain = createChainMock(null, null, 5);
      // 3. academy_classes UPDATE (current_count)
      const updateChain = createChainMock(null);
      // 4. academy_students UPDATE (class_name)
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(insertChain)    // student_classes INSERT
        .mockReturnValueOnce(countChain)     // count query
        .mockReturnValueOnce(updateChain)    // academy_classes UPDATE
        .mockReturnValueOnce(classNameChain); // academy_students UPDATE

      mockClassDomain.getClass.mockResolvedValue({ id: 'c1', name: '수학반' });

      const result = await domain.enrollStudentToClass(TENANT_ID, 's1', 'c1');

      expect(mockFrom).toHaveBeenCalledWith('student_classes');
      expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: TENANT_ID,
        student_id: 's1',
        class_id: 'c1',
        is_active: true,
      }));
      expect(result).toBeDefined();
    });

    it('INSERT 실패 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'Duplicate entry' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.enrollStudentToClass(TENANT_ID, 's1', 'c1')
      ).rejects.toThrow('Failed to enroll student to class: Duplicate entry');
    });

    it('count 쿼리 실패 시 Error throw', async () => {
      const insertChain = createChainMock({ id: 'sc1' });
      const countChain = createChainMock(null, { message: 'Count failed' });

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain);

      await expect(
        domain.enrollStudentToClass(TENANT_ID, 's1', 'c1')
      ).rejects.toThrow('Failed to count students: Count failed');
    });

    it('class_name 업데이트 확인', async () => {
      const insertChain = createChainMock({ id: 'sc1', student_id: 's1', class_id: 'c1' });
      const countChain = createChainMock(null, null, 3);
      const updateChain = createChainMock(null);
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(classNameChain);

      mockClassDomain.getClass.mockResolvedValue({ id: 'c1', name: '영어반' });

      await domain.enrollStudentToClass(TENANT_ID, 's1', 'c1');

      // academy_students.class_name이 '영어반'으로 업데이트
      expect(classNameChain.update).toHaveBeenCalledWith({ class_name: '영어반' });
    });
  });

  describe('unenrollStudentFromClass', () => {
    it('is_active=false + current_count 업데이트', async () => {
      // 1. 배정 찾기
      const findChain = createChainMock({ id: 'sc1', student_id: 's1', class_id: 'c1' });
      // 2. is_active=false 업데이트
      const deactivateChain = createChainMock(null);
      // 3. count 쿼리
      const countChain = createChainMock(null, null, 2);
      // 4. academy_classes UPDATE
      const updateCountChain = createChainMock(null);
      // 5. 남은 반 조회
      const remainingChain = createChainMock([]);
      // 6. academy_students UPDATE (class_name)
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deactivateChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateCountChain)
        .mockReturnValueOnce(remainingChain)
        .mockReturnValueOnce(classNameChain);

      await domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1');

      expect(deactivateChain.update).toHaveBeenCalledWith(expect.objectContaining({
        is_active: false,
      }));
    });

    it('assignment not found 시 Error throw', async () => {
      const findChain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(findChain);

      await expect(
        domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1')
      ).rejects.toThrow('Student class assignment not found');
    });

    it('남은 반 이름으로 class_name 대체', async () => {
      const findChain = createChainMock({ id: 'sc1' });
      const deactivateChain = createChainMock(null);
      const countChain = createChainMock(null, null, 1);
      const updateCountChain = createChainMock(null);
      const remainingChain = createChainMock([{ class_id: 'c2' }]);
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deactivateChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateCountChain)
        .mockReturnValueOnce(remainingChain)
        .mockReturnValueOnce(classNameChain);

      mockClassDomain.getClass.mockResolvedValue({ id: 'c2', name: '영어반' });

      await domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1');

      expect(classNameChain.update).toHaveBeenCalledWith({ class_name: '영어반' });
    });

    it('활성 반 없으면 class_name=null', async () => {
      const findChain = createChainMock({ id: 'sc1' });
      const deactivateChain = createChainMock(null);
      const countChain = createChainMock(null, null, 0);
      const updateCountChain = createChainMock(null);
      const remainingChain = createChainMock([]);
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deactivateChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateCountChain)
        .mockReturnValueOnce(remainingChain)
        .mockReturnValueOnce(classNameChain);

      await domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1');

      expect(classNameChain.update).toHaveBeenCalledWith({ class_name: null });
    });
  });
});
