/**
 * Class Service Extended Tests
 *
 * Coverage target: 71% -> 80%+
 * Additional coverage for:
 * - getClass: null return case
 * - getTeacher: delegation and null case
 * - createTeacher: delegation
 * - updateTeacher: delegation
 * - deleteTeacher: delegation
 * - getClassTeachers: delegation
 * - getClassStatistics: error propagation
 * - getClasses: error case
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetClasses,
  mockGetClass,
  mockCreateClass,
  mockUpdateClass,
  mockDeleteClass,
  mockGetClassStatistics,
  mockGetTeachers,
  mockGetTeacher,
  mockCreateTeacher,
  mockUpdateTeacher,
  mockDeleteTeacher,
  mockAssignTeacher,
  mockUnassignTeacher,
  mockGetClassTeachers,
} = vi.hoisted(() => ({
  mockGetClasses: vi.fn(),
  mockGetClass: vi.fn(),
  mockCreateClass: vi.fn(),
  mockUpdateClass: vi.fn(),
  mockDeleteClass: vi.fn(),
  mockGetClassStatistics: vi.fn(),
  mockGetTeachers: vi.fn(),
  mockGetTeacher: vi.fn(),
  mockCreateTeacher: vi.fn(),
  mockUpdateTeacher: vi.fn(),
  mockDeleteTeacher: vi.fn(),
  mockAssignTeacher: vi.fn(),
  mockUnassignTeacher: vi.fn(),
  mockGetClassTeachers: vi.fn(),
}));

vi.mock('@industry/academy/service', () => ({
  academyService: {
    getClasses: mockGetClasses,
    getClass: mockGetClass,
    createClass: mockCreateClass,
    updateClass: mockUpdateClass,
    deleteClass: mockDeleteClass,
    getClassStatistics: mockGetClassStatistics,
    getTeachers: mockGetTeachers,
    getTeacher: mockGetTeacher,
    createTeacher: mockCreateTeacher,
    updateTeacher: mockUpdateTeacher,
    deleteTeacher: mockDeleteTeacher,
    assignTeacher: mockAssignTeacher,
    unassignTeacher: mockUnassignTeacher,
    getClassTeachers: mockGetClassTeachers,
  },
}));

import { ClassService } from '../service';

const TENANT_ID = 'test-tenant-id';

describe('ClassService Extended', () => {
  let service: ClassService;

  beforeEach(() => {
    service = new ClassService();
    vi.clearAllMocks();
  });

  // ========== getClass ==========

  describe('getClass - extended', () => {
    it('returns null when class not found', async () => {
      mockGetClass.mockResolvedValueOnce(null);

      const result = await service.getClass(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
      expect(mockGetClass).toHaveBeenCalledWith(TENANT_ID, 'nonexistent');
    });
  });

  // ========== getTeacher ==========

  describe('getTeacher', () => {
    it('returns teacher on success', async () => {
      const teacher = { id: 't1', name: 'Teacher Kim', status: 'active' };
      mockGetTeacher.mockResolvedValueOnce(teacher);

      const result = await service.getTeacher(TENANT_ID, 't1');

      expect(mockGetTeacher).toHaveBeenCalledWith(TENANT_ID, 't1');
      expect(result).toEqual(teacher);
    });

    it('returns null when teacher not found', async () => {
      mockGetTeacher.mockResolvedValueOnce(null);

      const result = await service.getTeacher(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ========== createTeacher ==========

  describe('createTeacher', () => {
    it('delegates to academyService.createTeacher', async () => {
      const input = { name: 'New Teacher', phone: '010-1234-5678', subject: 'Math' };
      const created = { id: 't-new', ...input, tenant_id: TENANT_ID };
      mockCreateTeacher.mockResolvedValueOnce(created);

      const result = await service.createTeacher(TENANT_ID, input as never);

      expect(mockCreateTeacher).toHaveBeenCalledWith(TENANT_ID, input);
      expect(result.name).toBe('New Teacher');
    });
  });

  // ========== updateTeacher ==========

  describe('updateTeacher', () => {
    it('delegates to academyService.updateTeacher', async () => {
      const input = { name: 'Updated Teacher' };
      const updated = { id: 't1', ...input, tenant_id: TENANT_ID };
      mockUpdateTeacher.mockResolvedValueOnce(updated);

      const result = await service.updateTeacher(TENANT_ID, 't1', input as never);

      expect(mockUpdateTeacher).toHaveBeenCalledWith(TENANT_ID, 't1', input);
      expect(result.name).toBe('Updated Teacher');
    });
  });

  // ========== deleteTeacher ==========

  describe('deleteTeacher', () => {
    it('delegates to academyService.deleteTeacher', async () => {
      mockDeleteTeacher.mockResolvedValueOnce(undefined);

      await service.deleteTeacher(TENANT_ID, 't1');

      expect(mockDeleteTeacher).toHaveBeenCalledWith(TENANT_ID, 't1');
    });
  });

  // ========== getClassTeachers ==========

  describe('getClassTeachers', () => {
    it('delegates to academyService.getClassTeachers', async () => {
      const classTeachers = [
        { id: 'ct1', class_id: 'c1', teacher_id: 't1', tenant_id: TENANT_ID },
        { id: 'ct2', class_id: 'c1', teacher_id: 't2', tenant_id: TENANT_ID },
      ];
      mockGetClassTeachers.mockResolvedValueOnce(classTeachers);

      const result = await service.getClassTeachers(TENANT_ID, 'c1');

      expect(mockGetClassTeachers).toHaveBeenCalledWith(TENANT_ID, 'c1');
      expect(result).toHaveLength(2);
    });
  });

  // ========== getTeachers with filter ==========

  describe('getTeachers - extended', () => {
    it('applies filter', async () => {
      const filter = { status: 'active' };
      mockGetTeachers.mockResolvedValueOnce([{ id: 't1', name: 'Teacher', status: 'active' }]);

      const result = await service.getTeachers(TENANT_ID, filter as never);

      expect(mockGetTeachers).toHaveBeenCalledWith(TENANT_ID, filter);
      expect(result).toHaveLength(1);
    });
  });

  // ========== getClassStatistics error ==========

  describe('getClassStatistics - extended', () => {
    it('propagates error from academyService', async () => {
      mockGetClassStatistics.mockRejectedValueOnce(new Error('Stats query failed'));
      mockGetClass.mockResolvedValueOnce({ id: 'c1', current_count: 0 });

      await expect(service.getClassStatistics(TENANT_ID, 'c1'))
        .rejects.toThrow('Stats query failed');
    });

    it('uses current_count from class data', async () => {
      mockGetClassStatistics.mockResolvedValueOnce({ attendance_rate: 0.92 });
      mockGetClass.mockResolvedValueOnce({ id: 'c1', current_count: 20, name: 'Test' });

      const result = await service.getClassStatistics(TENANT_ID, 'c1');

      expect(result.totalStudents).toBe(20);
      expect(result.activeStudents).toBe(20);
      expect(result.attendanceRate).toBe(0.92);
    });

    it('handles class without current_count (defaults to 0)', async () => {
      mockGetClassStatistics.mockResolvedValueOnce({ attendance_rate: 0.5 });
      mockGetClass.mockResolvedValueOnce({ id: 'c1', name: 'Test' }); // no current_count

      const result = await service.getClassStatistics(TENANT_ID, 'c1');

      expect(result.totalStudents).toBe(0);
      expect(result.activeStudents).toBe(0);
    });
  });

  // ========== getClasses error ==========

  describe('getClasses - error', () => {
    it('propagates error from academyService', async () => {
      mockGetClasses.mockRejectedValueOnce(new Error('Query failed'));

      await expect(service.getClasses(TENANT_ID))
        .rejects.toThrow('Query failed');
    });
  });
});
