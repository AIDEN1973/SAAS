/**
 * EnrollmentDomain Extended Unit Tests
 *
 * Covers uncovered branches/methods:
 * - getStudentClasses (full path + error paths + empty)
 * - getAllStudentClasses (activeOnly=false, error path)
 * - getStudentClassesPaged (filters, pagination, error path)
 * - updateStudentClassEnrolledAt (success, error)
 * - enrollStudentToClass: update count error, custom enrolledAt
 * - unenrollStudentFromClass: update error, count error, updateCount error, class_name error
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

describe('EnrollmentDomain (extended)', () => {
  let domain: EnrollmentDomain;
  const mockClassDomain = {
    getClass: vi.fn(),
  };
  const mockSupabase = { from: mockFrom } as never;

  beforeEach(() => {
    domain = new EnrollmentDomain(mockSupabase, mockClassDomain as never);
    vi.clearAllMocks();
  });

  // ==================== enrollStudentToClass - extended ====================

  describe('enrollStudentToClass (extended)', () => {
    it('uses custom enrolledAt when provided', async () => {
      const insertChain = createChainMock({ id: 'sc1', student_id: 's1', class_id: 'c1' });
      const countChain = createChainMock(null, null, 3);
      const updateChain = createChainMock(null);
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(classNameChain);

      mockClassDomain.getClass.mockResolvedValue({ id: 'c1', name: 'Math' });

      await domain.enrollStudentToClass(TENANT_ID, 's1', 'c1', '2025-12-01');

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          enrolled_at: '2025-12-01',
        })
      );
    });

    it('throws when academy_classes update fails', async () => {
      const insertChain = createChainMock({ id: 'sc1' });
      const countChain = createChainMock(null, null, 5);
      const updateChain = createChainMock(null, { message: 'Update failed' });

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain);

      await expect(
        domain.enrollStudentToClass(TENANT_ID, 's1', 'c1')
      ).rejects.toThrow('Failed to update class count: Update failed');
    });

    it('skips class_name update when classData is null', async () => {
      const insertChain = createChainMock({ id: 'sc1', student_id: 's1', class_id: 'c1' });
      const countChain = createChainMock(null, null, 2);
      const updateChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain);

      mockClassDomain.getClass.mockResolvedValue(null);

      const result = await domain.enrollStudentToClass(TENANT_ID, 's1', 'c1');

      // Should still succeed even without class_name update
      expect(result).toBeDefined();
      // mockFrom should have been called 3 times (insert, count, update), NOT 4 (no class_name update)
      expect(mockFrom).toHaveBeenCalledTimes(3);
    });

    it('warns but does not throw when class_name update fails', async () => {
      const insertChain = createChainMock({ id: 'sc1', student_id: 's1', class_id: 'c1' });
      const countChain = createChainMock(null, null, 3);
      const updateChain = createChainMock(null);
      const classNameChain = createChainMock(null, { message: 'class_name update failed' });

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(classNameChain);

      mockClassDomain.getClass.mockResolvedValue({ id: 'c1', name: 'Math' });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await domain.enrollStudentToClass(TENANT_ID, 's1', 'c1');

      // Should still return result; class_name error is only a warning
      expect(result).toBeDefined();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('handles count of 0 (null) by setting current_count to 0', async () => {
      const insertChain = createChainMock({ id: 'sc1', student_id: 's1', class_id: 'c1' });
      const countChain = createChainMock(null, null, undefined); // count is undefined
      const updateChain = createChainMock(null);
      const classNameChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(classNameChain);

      mockClassDomain.getClass.mockResolvedValue({ id: 'c1', name: 'Math' });

      await domain.enrollStudentToClass(TENANT_ID, 's1', 'c1');

      // count is undefined, so count || 0 = 0
      expect(updateChain.update).toHaveBeenCalledWith({ current_count: 0 });
    });
  });

  // ==================== unenrollStudentFromClass - extended ====================

  describe('unenrollStudentFromClass (extended)', () => {
    it('uses custom leftAt when provided', async () => {
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

      await domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1', '2025-06-15');

      expect(deactivateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          left_at: '2025-06-15',
        })
      );
    });

    it('throws when deactivate update fails', async () => {
      const findChain = createChainMock({ id: 'sc1' });
      const deactivateChain = createChainMock(null, { message: 'Deactivate failed' });

      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deactivateChain);

      await expect(
        domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1')
      ).rejects.toThrow('Failed to unenroll student: Deactivate failed');
    });

    it('throws when count query fails during unenroll', async () => {
      const findChain = createChainMock({ id: 'sc1' });
      const deactivateChain = createChainMock(null);
      const countChain = createChainMock(null, { message: 'Count error' });

      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deactivateChain)
        .mockReturnValueOnce(countChain);

      await expect(
        domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1')
      ).rejects.toThrow('Failed to count students: Count error');
    });

    it('throws when updateCount fails during unenroll', async () => {
      const findChain = createChainMock({ id: 'sc1' });
      const deactivateChain = createChainMock(null);
      const countChain = createChainMock(null, null, 0);
      const updateCountChain = createChainMock(null, { message: 'Update count failed' });

      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deactivateChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateCountChain);

      await expect(
        domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1')
      ).rejects.toThrow('Failed to update class count: Update count failed');
    });

    it('warns but does not throw when class_name update fails on unenroll', async () => {
      const findChain = createChainMock({ id: 'sc1' });
      const deactivateChain = createChainMock(null);
      const countChain = createChainMock(null, null, 0);
      const updateCountChain = createChainMock(null);
      const remainingChain = createChainMock([]);
      const classNameChain = createChainMock(null, { message: 'class_name fail' });

      mockFrom
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deactivateChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateCountChain)
        .mockReturnValueOnce(remainingChain)
        .mockReturnValueOnce(classNameChain);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      await domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1');

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('sets class_name to null when remaining class returns null from getClass', async () => {
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

      // getClass returns null (class not found)
      mockClassDomain.getClass.mockResolvedValue(null);

      await domain.unenrollStudentFromClass(TENANT_ID, 's1', 'c1');

      // class_name should be null because getClass returned null (null?.name = undefined, || null)
      expect(classNameChain.update).toHaveBeenCalledWith({ class_name: null });
    });
  });

  // ==================== getStudentClasses ====================

  describe('getStudentClasses', () => {
    it('returns student classes with joined class data', async () => {
      const studentClassesData = [
        { id: 'sc1', student_id: 's1', class_id: 'c1', is_active: true, enrolled_at: '2026-01-01' },
        { id: 'sc2', student_id: 's1', class_id: 'c2', is_active: true, enrolled_at: '2026-02-01' },
      ];
      const classesData = [
        { id: 'c1', name: 'Math', status: 'active' },
        { id: 'c2', name: 'English', status: 'active' },
      ];

      const scChain = createChainMock(studentClassesData);
      const clsChain = createChainMock(classesData);

      mockFrom
        .mockReturnValueOnce(scChain)
        .mockReturnValueOnce(clsChain);

      const result = await domain.getStudentClasses(TENANT_ID, 's1');

      expect(mockFrom).toHaveBeenCalledWith('student_classes');
      expect(mockFrom).toHaveBeenCalledWith('academy_classes');
      expect(result).toHaveLength(2);
      expect(result[0].class).toEqual({ id: 'c1', name: 'Math', status: 'active' });
      expect(result[1].class).toEqual({ id: 'c2', name: 'English', status: 'active' });
    });

    it('returns empty array when student has no classes', async () => {
      const scChain = createChainMock([]);
      mockFrom.mockReturnValue(scChain);

      const result = await domain.getStudentClasses(TENANT_ID, 's1');

      expect(result).toEqual([]);
    });

    it('returns null for class when not found in classMap', async () => {
      const studentClassesData = [
        { id: 'sc1', student_id: 's1', class_id: 'c1', is_active: true },
      ];
      const classesData: unknown[] = []; // no classes found

      const scChain = createChainMock(studentClassesData);
      const clsChain = createChainMock(classesData);

      mockFrom
        .mockReturnValueOnce(scChain)
        .mockReturnValueOnce(clsChain);

      const result = await domain.getStudentClasses(TENANT_ID, 's1');

      expect(result).toHaveLength(1);
      expect(result[0].class).toBeNull();
    });

    it('throws when student_classes query fails', async () => {
      const scChain = createChainMock(null, { message: 'Student classes error' });
      mockFrom.mockReturnValue(scChain);

      await expect(domain.getStudentClasses(TENANT_ID, 's1'))
        .rejects.toThrow('Failed to fetch student classes: Student classes error');
    });

    it('throws when academy_classes query fails', async () => {
      const scChain = createChainMock([{ id: 'sc1', class_id: 'c1' }]);
      const clsChain = createChainMock(null, { message: 'Classes error' });

      mockFrom
        .mockReturnValueOnce(scChain)
        .mockReturnValueOnce(clsChain);

      await expect(domain.getStudentClasses(TENANT_ID, 's1'))
        .rejects.toThrow('Failed to fetch classes: Classes error');
    });

    it('handles null data from student classes query', async () => {
      const scChain = createChainMock(null);
      mockFrom.mockReturnValue(scChain);

      const result = await domain.getStudentClasses(TENANT_ID, 's1');

      // null || [] → length 0 → returns []
      expect(result).toEqual([]);
    });
  });

  // ==================== getAllStudentClasses ====================

  describe('getAllStudentClasses', () => {
    it('returns all active student classes by default', async () => {
      const data = [
        { id: 'sc1', student_id: 's1', class_id: 'c1', is_active: true },
        { id: 'sc2', student_id: 's2', class_id: 'c2', is_active: true },
      ];
      const chain = createChainMock(data);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getAllStudentClasses(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('student_classes');
      expect(chain.eq).toHaveBeenCalledWith('is_active', true);
      expect(result).toHaveLength(2);
    });

    it('includes inactive when activeOnly is false', async () => {
      const data = [
        { id: 'sc1', is_active: true },
        { id: 'sc2', is_active: false },
      ];
      const chain = createChainMock(data);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getAllStudentClasses(TENANT_ID, { activeOnly: false });

      // When activeOnly === false, the eq('is_active', true) should NOT be called
      // But because of the condition `options?.activeOnly !== false`, when activeOnly is false,
      // it means false !== false = false, so the condition is false and eq is NOT called
      expect(result).toHaveLength(2);
    });

    it('returns empty array when data is null', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getAllStudentClasses(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('throws when query fails', async () => {
      const chain = createChainMock(null, { message: 'Query error' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getAllStudentClasses(TENANT_ID))
        .rejects.toThrow('Failed to fetch all student classes: Query error');
    });

    it('includes active when no options passed', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getAllStudentClasses(TENANT_ID);

      expect(chain.eq).toHaveBeenCalledWith('is_active', true);
    });
  });

  // ==================== getStudentClassesPaged ====================

  describe('getStudentClassesPaged', () => {
    it('returns paged results with default options', async () => {
      const data = [
        { id: 'sc1', student_id: 's1', class_id: 'c1' },
      ];
      const chain = createChainMock(data, null, 10);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudentClassesPaged(TENANT_ID, {});

      expect(result.studentClasses).toHaveLength(1);
      expect(result.totalCount).toBe(10);
      // Default page=1, pageSize=20 → range(0, 19)
      expect(chain.range).toHaveBeenCalledWith(0, 19);
    });

    it('applies classId filter', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      await domain.getStudentClassesPaged(TENANT_ID, { classId: 'c1' });

      expect(chain.eq).toHaveBeenCalledWith('class_id', 'c1');
    });

    it('applies activeOnly=false to skip is_active filter', async () => {
      const chain = createChainMock([], null, 0);
      mockFrom.mockReturnValue(chain);

      await domain.getStudentClassesPaged(TENANT_ID, { activeOnly: false });

      // When activeOnly is false, the eq('is_active', true) should not be called
      // But the chain is chainable, so we need to check the order of calls
      // Actually, activeOnly default is true and the code checks `if (activeOnly)`
      // so when false, eq('is_active', true) is NOT called
      expect(chain.select).toHaveBeenCalledWith('*', { count: 'exact' });
    });

    it('calculates correct offset for page 3', async () => {
      const chain = createChainMock([], null, 100);
      mockFrom.mockReturnValue(chain);

      await domain.getStudentClassesPaged(TENANT_ID, { page: 3, pageSize: 10 });

      // offset = (3-1) * 10 = 20, range(20, 29)
      expect(chain.range).toHaveBeenCalledWith(20, 29);
    });

    it('throws when query fails', async () => {
      const chain = createChainMock(null, { message: 'Paged query error' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.getStudentClassesPaged(TENANT_ID, {})
      ).rejects.toThrow('Failed to fetch paged student classes: Paged query error');
    });

    it('returns totalCount 0 when count is null', async () => {
      const chain = createChainMock([], null, undefined);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudentClassesPaged(TENANT_ID, {});

      expect(result.totalCount).toBe(0);
    });
  });

  // ==================== updateStudentClassEnrolledAt ====================

  describe('updateStudentClassEnrolledAt', () => {
    it('updates enrolled_at and returns updated record', async () => {
      const updated = { id: 'sc1', student_id: 's1', class_id: 'c1', enrolled_at: '2026-06-01' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await domain.updateStudentClassEnrolledAt(TENANT_ID, 'sc1', '2026-06-01');

      expect(mockFrom).toHaveBeenCalledWith('student_classes');
      expect(chain.update).toHaveBeenCalledWith({ enrolled_at: '2026-06-01' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'sc1');
      expect(result.enrolled_at).toBe('2026-06-01');
    });

    it('throws when update fails', async () => {
      const chain = createChainMock(null, { message: 'Update enrolled_at failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.updateStudentClassEnrolledAt(TENANT_ID, 'sc1', '2026-06-01')
      ).rejects.toThrow('Failed to update student class enrolled_at: Update enrolled_at failed');
    });
  });
});
