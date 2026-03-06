/**
 * ClassDomain Extended Unit Tests
 *
 * Covers uncovered branches/methods:
 * - getClasses: status single string, day_of_week, subject, grade filters
 * - getClass: success, not-found (PGRST116), other error
 * - createClass: with color, without teacher_ids, insert error
 * - updateClass: success, error, partial updates
 * - deleteClass: success, error
 * - getClassStatistics: capacity=0 edge case
 * - unassignTeacher: success, error
 * - getClassTeachers: success, error, empty
 * - assignTeacher: with custom assigned_at, error
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

describe('ClassDomain (extended)', () => {
  let domain: ClassDomain;
  const mockSupabase = { from: mockFrom } as never;

  beforeEach(() => {
    domain = new ClassDomain(mockSupabase);
    vi.clearAllMocks();
  });

  // ==================== getClasses - extended filters ====================

  describe('getClasses (extended filters)', () => {
    it('status filter with single string: .eq() call', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getClasses(TENANT_ID, { status: 'active' });

      expect(chain.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('day_of_week filter: .eq() call', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getClasses(TENANT_ID, { day_of_week: 'monday' });

      expect(chain.eq).toHaveBeenCalledWith('day_of_week', 'monday');
    });

    it('subject filter: .eq() call', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getClasses(TENANT_ID, { subject: 'math' });

      expect(chain.eq).toHaveBeenCalledWith('subject', 'math');
    });

    it('grade filter: .eq() call', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getClasses(TENANT_ID, { grade: '3' });

      expect(chain.eq).toHaveBeenCalledWith('grade', '3');
    });

    it('no filter: no filter methods called beyond select and order', async () => {
      const chain = createChainMock([
        { id: 'c1', name: 'Math', status: 'active' },
      ]);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getClasses(TENANT_ID);

      expect(result).toHaveLength(1);
      expect(chain.order).toHaveBeenCalledWith('day_of_week', { ascending: true });
    });

    it('returns empty array when data is null', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getClasses(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('combines multiple filters', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getClasses(TENANT_ID, {
        status: 'active',
        day_of_week: 'tuesday',
        subject: 'english',
        grade: '5',
        search: 'advanced',
      });

      expect(chain.eq).toHaveBeenCalledWith('status', 'active');
      expect(chain.eq).toHaveBeenCalledWith('day_of_week', 'tuesday');
      expect(chain.eq).toHaveBeenCalledWith('subject', 'english');
      expect(chain.eq).toHaveBeenCalledWith('grade', '5');
      expect(chain.ilike).toHaveBeenCalledWith('name', '%advanced%');
    });
  });

  // ==================== getClass ====================

  describe('getClass', () => {
    it('returns class data on success', async () => {
      const classData = { id: 'c1', name: 'Math', capacity: 20, current_count: 10 };
      const chain = createChainMock(classData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getClass(TENANT_ID, 'c1');

      expect(result).toEqual(classData);
      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
    });

    it('returns null when class not found (PGRST116)', async () => {
      const chain = createChainMock(null, { code: 'PGRST116', message: 'not found' });
      mockFrom.mockReturnValue(chain);

      const result = await domain.getClass(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });

    it('throws on non-PGRST116 error', async () => {
      const chain = createChainMock(null, { code: 'OTHER', message: 'DB error' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getClass(TENANT_ID, 'c1'))
        .rejects.toThrow('Failed to fetch class: DB error');
    });
  });

  // ==================== createClass - extended ====================

  describe('createClass (extended)', () => {
    it('uses provided color instead of auto-generating', async () => {
      const created = { id: 'c-new', name: 'Art', color: '#FF0000' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      await domain.createClass(TENANT_ID, { name: 'Art', color: '#FF0000' });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ color: '#FF0000' })
      );
    });

    it('sets status to "active" when not provided', async () => {
      const created = { id: 'c-new', name: 'Science' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      await domain.createClass(TENANT_ID, { name: 'Science' });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });

    it('uses custom status when provided', async () => {
      const created = { id: 'c-new', name: 'Science' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      await domain.createClass(TENANT_ID, { name: 'Science', status: 'inactive' });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'inactive' })
      );
    });

    it('skips teacher assignment when no teacher_ids', async () => {
      const created = { id: 'c-new', name: 'History' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const result = await domain.createClass(TENANT_ID, { name: 'History' });

      // Only one from() call for insert, no assignTeacher
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(result).toEqual(created);
    });

    it('skips teacher assignment when teacher_ids is empty array', async () => {
      const created = { id: 'c-new', name: 'History' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      await domain.createClass(TENANT_ID, { name: 'History', teacher_ids: [] });

      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('throws when insert fails', async () => {
      const chain = createChainMock(null, { message: 'Insert class failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.createClass(TENANT_ID, { name: 'Bad Class' })
      ).rejects.toThrow('Failed to create class: Insert class failed');
    });

    it('includes all optional fields in insert', async () => {
      const created = { id: 'c-new', name: 'Full Class' };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      await domain.createClass(TENANT_ID, {
        name: 'Full Class',
        subject: 'Math',
        grade: '3',
        day_of_week: 'monday',
        start_time: '14:00',
        end_time: '15:00',
        capacity: 25,
        notes: 'Test notes',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Full Class',
          subject: 'Math',
          grade: '3',
          day_of_week: 'monday',
          start_time: '14:00',
          end_time: '15:00',
          capacity: 25,
          notes: 'Test notes',
        })
      );
    });
  });

  // ==================== updateClass ====================

  describe('updateClass', () => {
    it('updates all provided fields', async () => {
      const updated = { id: 'c1', name: 'Updated Math' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      const result = await domain.updateClass(TENANT_ID, 'c1', {
        name: 'Updated Math',
        subject: 'Advanced Math',
        grade: '6',
        day_of_week: 'friday',
        start_time: '16:00',
        end_time: '17:00',
        capacity: 30,
        color: '#00FF00',
        notes: 'Updated notes',
        status: 'inactive',
      });

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Math',
          subject: 'Advanced Math',
          grade: '6',
          day_of_week: 'friday',
          start_time: '16:00',
          end_time: '17:00',
          capacity: 30,
          color: '#00FF00',
          notes: 'Updated notes',
          status: 'inactive',
        })
      );
      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
      expect(result).toBeDefined();
    });

    it('updates partial fields (only name)', async () => {
      const updated = { id: 'c1', name: 'New Name' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      await domain.updateClass(TENANT_ID, 'c1', { name: 'New Name' });

      expect(chain.update).toHaveBeenCalledWith({ name: 'New Name' });
    });

    it('throws when update fails', async () => {
      const chain = createChainMock(null, { message: 'Update failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.updateClass(TENANT_ID, 'c1', { name: 'Fail' })
      ).rejects.toThrow('Failed to update class: Update failed');
    });

    it('includes room field when provided', async () => {
      const updated = { id: 'c1' };
      const chain = createChainMock(updated);
      mockFrom.mockReturnValue(chain);

      await domain.updateClass(TENANT_ID, 'c1', { room: 'A-101' });

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ room: 'A-101' })
      );
    });
  });

  // ==================== deleteClass ====================

  describe('deleteClass', () => {
    it('soft deletes by setting status to archived', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await domain.deleteClass(TENANT_ID, 'c1');

      expect(mockFrom).toHaveBeenCalledWith('academy_classes');
      expect(chain.update).toHaveBeenCalledWith({ status: 'archived' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
    });

    it('throws when delete fails', async () => {
      const chain = createChainMock(null, { message: 'Delete failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.deleteClass(TENANT_ID, 'c1'))
        .rejects.toThrow('Failed to delete class: Delete failed');
    });
  });

  // ==================== getClassStatistics - extended ====================

  describe('getClassStatistics (extended)', () => {
    it('returns 0 capacity_rate when capacity is 0', async () => {
      const classData = { id: 'c1', name: 'Empty', current_count: 0, capacity: 0 };
      const chain = createChainMock(classData);
      mockFrom.mockReturnValue(chain);

      const stats = await domain.getClassStatistics(TENANT_ID, 'c1');

      expect(stats.capacity_rate).toBe(0);
      expect(stats.attendance_rate).toBe(0);
      expect(stats.late_rate).toBe(0);
    });

    it('returns 100% capacity_rate when class is full', async () => {
      const classData = { id: 'c1', name: 'Full', current_count: 20, capacity: 20 };
      const chain = createChainMock(classData);
      mockFrom.mockReturnValue(chain);

      const stats = await domain.getClassStatistics(TENANT_ID, 'c1');

      expect(stats.capacity_rate).toBe(100);
    });

    it('returns over 100% capacity_rate when over capacity', async () => {
      const classData = { id: 'c1', name: 'Over', current_count: 25, capacity: 20 };
      const chain = createChainMock(classData);
      mockFrom.mockReturnValue(chain);

      const stats = await domain.getClassStatistics(TENANT_ID, 'c1');

      expect(stats.capacity_rate).toBe(125); // 25/20*100
    });
  });

  // ==================== unassignTeacher ====================

  describe('unassignTeacher', () => {
    it('sets is_active=false and unassigned_at', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await domain.unassignTeacher(TENANT_ID, 'c1', 't1');

      expect(mockFrom).toHaveBeenCalledWith('class_teachers');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          unassigned_at: '2026-03-05',
        })
      );
      expect(chain.eq).toHaveBeenCalledWith('class_id', 'c1');
      expect(chain.eq).toHaveBeenCalledWith('teacher_id', 't1');
    });

    it('throws when unassign fails', async () => {
      const chain = createChainMock(null, { message: 'Unassign failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.unassignTeacher(TENANT_ID, 'c1', 't1'))
        .rejects.toThrow('Failed to unassign teacher: Unassign failed');
    });
  });

  // ==================== getClassTeachers ====================

  describe('getClassTeachers', () => {
    it('returns active teachers for a class', async () => {
      const teachers = [
        { id: 'ct1', class_id: 'c1', teacher_id: 't1', role: 'teacher', is_active: true },
        { id: 'ct2', class_id: 'c1', teacher_id: 't2', role: 'assistant', is_active: true },
      ];
      const chain = createChainMock(teachers);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getClassTeachers(TENANT_ID, 'c1');

      expect(mockFrom).toHaveBeenCalledWith('class_teachers');
      expect(chain.eq).toHaveBeenCalledWith('class_id', 'c1');
      expect(chain.eq).toHaveBeenCalledWith('is_active', true);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no teachers assigned', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getClassTeachers(TENANT_ID, 'c1');

      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getClassTeachers(TENANT_ID, 'c1');

      expect(result).toEqual([]);
    });

    it('throws when query fails', async () => {
      const chain = createChainMock(null, { message: 'Teachers query failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getClassTeachers(TENANT_ID, 'c1'))
        .rejects.toThrow('Failed to fetch class teachers: Teachers query failed');
    });
  });

  // ==================== assignTeacher - extended ====================

  describe('assignTeacher (extended)', () => {
    it('uses custom assigned_at when provided', async () => {
      const assigned = { class_id: 'c1', teacher_id: 't1', role: 'teacher', is_active: true };
      const chain = createChainMock(assigned);
      mockFrom.mockReturnValue(chain);

      await domain.assignTeacher(TENANT_ID, {
        class_id: 'c1',
        teacher_id: 't1',
        role: 'teacher',
        assigned_at: '2025-09-01',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ assigned_at: '2025-09-01' })
      );
    });

    it('throws when assignTeacher insert fails', async () => {
      const chain = createChainMock(null, { message: 'Assign failed' });
      mockFrom.mockReturnValue(chain);

      await expect(
        domain.assignTeacher(TENANT_ID, {
          class_id: 'c1',
          teacher_id: 't1',
          role: 'teacher',
        })
      ).rejects.toThrow('Failed to assign teacher: Assign failed');
    });

    it('defaults assigned_at to KST date when not provided', async () => {
      const chain = createChainMock({ class_id: 'c1', teacher_id: 't1' });
      mockFrom.mockReturnValue(chain);

      await domain.assignTeacher(TENANT_ID, {
        class_id: 'c1',
        teacher_id: 't1',
        role: 'assistant',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ assigned_at: '2026-03-05' })
      );
    });
  });
});
