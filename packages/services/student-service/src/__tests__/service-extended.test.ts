/**
 * Student Service Extended Tests
 *
 * Coverage target: 52% -> 80%+
 * Additional coverage for:
 * - updateGuardian: delegation
 * - deleteGuardian: delegation
 * - getConsultations: delegation
 * - createConsultation: delegation
 * - updateConsultation: delegation
 * - deleteConsultation: delegation
 * - getConsultationsPaged: delegation
 * - getStudentClasses: delegation
 * - getAllStudentClasses: delegation
 * - getStudentClassesPaged: delegation
 * - updateStudentClassEnrolledAt: delegation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockUpdateGuardian,
  mockDeleteGuardian,
  mockGetConsultations,
  mockCreateConsultation,
  mockUpdateConsultation,
  mockDeleteConsultation,
  mockGetConsultationsPaged,
  mockGetStudentClasses,
  mockGetAllStudentClasses,
  mockGetStudentClassesPaged,
  mockUpdateStudentClassEnrolledAt,
} = vi.hoisted(() => ({
  mockUpdateGuardian: vi.fn(),
  mockDeleteGuardian: vi.fn(),
  mockGetConsultations: vi.fn(),
  mockCreateConsultation: vi.fn(),
  mockUpdateConsultation: vi.fn(),
  mockDeleteConsultation: vi.fn(),
  mockGetConsultationsPaged: vi.fn(),
  mockGetStudentClasses: vi.fn(),
  mockGetAllStudentClasses: vi.fn(),
  mockGetStudentClassesPaged: vi.fn(),
  mockUpdateStudentClassEnrolledAt: vi.fn(),
}));

vi.mock('@industry/academy/service', () => ({
  academyService: {
    getStudents: vi.fn(),
    getStudent: vi.fn(),
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
    deleteStudent: vi.fn(),
    getGuardians: vi.fn(),
    createGuardians: vi.fn(),
    bulkCreateStudents: vi.fn(),
    getStudentsPaged: vi.fn(),
    restoreDeletedStudent: vi.fn(),
    getTags: vi.fn(),
    updateStudentTags: vi.fn(),
    updateGuardian: mockUpdateGuardian,
    deleteGuardian: mockDeleteGuardian,
    getConsultations: mockGetConsultations,
    createConsultation: mockCreateConsultation,
    updateConsultation: mockUpdateConsultation,
    deleteConsultation: mockDeleteConsultation,
    getConsultationsPaged: mockGetConsultationsPaged,
    getStudentClasses: mockGetStudentClasses,
    getAllStudentClasses: mockGetAllStudentClasses,
    getStudentClassesPaged: mockGetStudentClassesPaged,
    updateStudentClassEnrolledAt: mockUpdateStudentClassEnrolledAt,
  },
}));

import { StudentService } from '../service';

const TENANT_ID = 'test-tenant-id';

describe('StudentService Extended', () => {
  let service: StudentService;

  beforeEach(() => {
    service = new StudentService();
    vi.clearAllMocks();
  });

  // ========== updateGuardian ==========

  describe('updateGuardian', () => {
    it('delegates to academyService.updateGuardian', async () => {
      const updated = { id: 'g1', name: 'Updated Parent', phone: '010-1111-1111' };
      mockUpdateGuardian.mockResolvedValueOnce(updated);

      const result = await service.updateGuardian(TENANT_ID, 'g1', { name: 'Updated Parent' });

      expect(mockUpdateGuardian).toHaveBeenCalledWith(TENANT_ID, 'g1', { name: 'Updated Parent' });
      expect(result).toEqual(updated);
    });
  });

  // ========== deleteGuardian ==========

  describe('deleteGuardian', () => {
    it('delegates to academyService.deleteGuardian', async () => {
      mockDeleteGuardian.mockResolvedValueOnce(undefined);

      await service.deleteGuardian(TENANT_ID, 'g1');

      expect(mockDeleteGuardian).toHaveBeenCalledWith(TENANT_ID, 'g1');
    });
  });

  // ========== getConsultations ==========

  describe('getConsultations', () => {
    it('delegates to academyService.getConsultations', async () => {
      const consultations = [
        { id: 'con-1', student_id: 's1', content: 'Good progress' },
      ];
      mockGetConsultations.mockResolvedValueOnce(consultations);

      const result = await service.getConsultations(TENANT_ID, 's1');

      expect(mockGetConsultations).toHaveBeenCalledWith(TENANT_ID, 's1');
      expect(result).toEqual(consultations);
    });
  });

  // ========== createConsultation ==========

  describe('createConsultation', () => {
    it('delegates to academyService.createConsultation', async () => {
      const consultation = { content: 'Initial consultation', consultation_type: 'phone' };
      const created = { id: 'con-new', ...consultation, student_id: 's1', tenant_id: TENANT_ID };
      mockCreateConsultation.mockResolvedValueOnce(created);

      const result = await service.createConsultation(TENANT_ID, 's1', consultation as never, 'user-1');

      expect(mockCreateConsultation).toHaveBeenCalledWith(TENANT_ID, 's1', consultation, 'user-1');
      expect(result.id).toBe('con-new');
    });
  });

  // ========== updateConsultation ==========

  describe('updateConsultation', () => {
    it('delegates to academyService.updateConsultation', async () => {
      const updateData = { content: 'Updated content' };
      const updated = { id: 'con-1', ...updateData };
      mockUpdateConsultation.mockResolvedValueOnce(updated);

      const result = await service.updateConsultation(TENANT_ID, 'con-1', updateData, 'user-1');

      expect(mockUpdateConsultation).toHaveBeenCalledWith(TENANT_ID, 'con-1', updateData, 'user-1');
      expect(result.content).toBe('Updated content');
    });

    it('works without userId', async () => {
      const updateData = { content: 'Updated' };
      mockUpdateConsultation.mockResolvedValueOnce({ id: 'con-1', ...updateData });

      await service.updateConsultation(TENANT_ID, 'con-1', updateData);

      expect(mockUpdateConsultation).toHaveBeenCalledWith(TENANT_ID, 'con-1', updateData, undefined);
    });
  });

  // ========== deleteConsultation ==========

  describe('deleteConsultation', () => {
    it('delegates to academyService.deleteConsultation', async () => {
      mockDeleteConsultation.mockResolvedValueOnce(undefined);

      await service.deleteConsultation(TENANT_ID, 'con-1');

      expect(mockDeleteConsultation).toHaveBeenCalledWith(TENANT_ID, 'con-1');
    });
  });

  // ========== getConsultationsPaged ==========

  describe('getConsultationsPaged', () => {
    it('delegates with all options', async () => {
      const pagedResult = { consultations: [{ id: 'con-1' }], totalCount: 1 };
      mockGetConsultationsPaged.mockResolvedValueOnce(pagedResult);

      const options = {
        page: 1,
        pageSize: 10,
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        consultationType: 'phone',
      };

      const result = await service.getConsultationsPaged(TENANT_ID, options);

      expect(mockGetConsultationsPaged).toHaveBeenCalledWith(TENANT_ID, options);
      expect(result.totalCount).toBe(1);
    });
  });

  // ========== getStudentClasses ==========

  describe('getStudentClasses', () => {
    it('delegates to academyService.getStudentClasses', async () => {
      const studentClasses = [
        { id: 'sc-1', student_id: 's1', class_id: 'c1', class: { name: 'Math' } },
      ];
      mockGetStudentClasses.mockResolvedValueOnce(studentClasses);

      const result = await service.getStudentClasses(TENANT_ID, 's1');

      expect(mockGetStudentClasses).toHaveBeenCalledWith(TENANT_ID, 's1');
      expect(result).toEqual(studentClasses);
    });
  });

  // ========== getAllStudentClasses ==========

  describe('getAllStudentClasses', () => {
    it('delegates without options', async () => {
      const allClasses = [{ id: 'sc-1' }, { id: 'sc-2' }];
      mockGetAllStudentClasses.mockResolvedValueOnce(allClasses);

      const result = await service.getAllStudentClasses(TENANT_ID);

      expect(mockGetAllStudentClasses).toHaveBeenCalledWith(TENANT_ID, undefined);
      expect(result).toHaveLength(2);
    });

    it('delegates with activeOnly option', async () => {
      const activeClasses = [{ id: 'sc-1' }];
      mockGetAllStudentClasses.mockResolvedValueOnce(activeClasses);

      const result = await service.getAllStudentClasses(TENANT_ID, { activeOnly: true });

      expect(mockGetAllStudentClasses).toHaveBeenCalledWith(TENANT_ID, { activeOnly: true });
      expect(result).toHaveLength(1);
    });
  });

  // ========== getStudentClassesPaged ==========

  describe('getStudentClassesPaged', () => {
    it('delegates with all options', async () => {
      const pagedResult = { studentClasses: [{ id: 'sc-1' }], totalCount: 1 };
      mockGetStudentClassesPaged.mockResolvedValueOnce(pagedResult);

      const options = {
        page: 1,
        pageSize: 10,
        classId: 'c1',
        activeOnly: true,
      };

      const result = await service.getStudentClassesPaged(TENANT_ID, options);

      expect(mockGetStudentClassesPaged).toHaveBeenCalledWith(TENANT_ID, options);
      expect(result.totalCount).toBe(1);
    });
  });

  // ========== updateStudentClassEnrolledAt ==========

  describe('updateStudentClassEnrolledAt', () => {
    it('delegates to academyService.updateStudentClassEnrolledAt', async () => {
      const updated = { id: 'sc-1', enrolled_at: '2026-03-01' };
      mockUpdateStudentClassEnrolledAt.mockResolvedValueOnce(updated);

      const result = await service.updateStudentClassEnrolledAt(TENANT_ID, 'sc-1', '2026-03-01');

      expect(mockUpdateStudentClassEnrolledAt).toHaveBeenCalledWith(
        TENANT_ID,
        'sc-1',
        '2026-03-01',
      );
      expect(result.enrolled_at).toBe('2026-03-01');
    });
  });
});
