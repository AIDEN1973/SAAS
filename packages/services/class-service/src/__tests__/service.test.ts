/**
 * Class Service Unit Tests
 *
 * Service Layer의 수업/강사 관리 위임(delegation) 검증
 * Phase 0-3에서 수정된 getClassStatistics도 검증합니다.
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

const mockClassData = [
  { id: 'c1', name: '수학반', current_count: 15, max_capacity: 20, tenant_id: TENANT_ID },
  { id: 'c2', name: '영어반', current_count: 8, max_capacity: 15, tenant_id: TENANT_ID },
];

describe('ClassService', () => {
  let service: ClassService;

  beforeEach(() => {
    service = new ClassService();
    vi.clearAllMocks();
  });

  // ==================== 수업 관리 ====================

  describe('getClasses', () => {
    it('전체 조회', async () => {
      mockGetClasses.mockResolvedValueOnce(mockClassData);

      const result = await service.getClasses(TENANT_ID);

      expect(mockGetClasses).toHaveBeenCalledWith(TENANT_ID, undefined);
      expect(result).toEqual(mockClassData);
    });

    it('필터 적용', async () => {
      const filter = { status: 'active' };
      mockGetClasses.mockResolvedValueOnce([mockClassData[0]]);

      const result = await service.getClasses(TENANT_ID, filter);

      expect(mockGetClasses).toHaveBeenCalledWith(TENANT_ID, filter);
      expect(result).toHaveLength(1);
    });
  });

  describe('getClass', () => {
    it('상세 조회', async () => {
      mockGetClass.mockResolvedValueOnce(mockClassData[0]);

      const result = await service.getClass(TENANT_ID, 'c1');

      expect(mockGetClass).toHaveBeenCalledWith(TENANT_ID, 'c1');
      expect(result?.name).toBe('수학반');
    });
  });

  describe('createClass', () => {
    it('정상 생성', async () => {
      const input = { name: '과학반', max_capacity: 20 };
      const created = { id: 'c3', ...input, current_count: 0, tenant_id: TENANT_ID };
      mockCreateClass.mockResolvedValueOnce(created);

      const result = await service.createClass(TENANT_ID, input);

      expect(mockCreateClass).toHaveBeenCalledWith(TENANT_ID, input);
      expect(result.name).toBe('과학반');
    });
  });

  describe('updateClass', () => {
    it('수정', async () => {
      const input = { name: '수학심화반' };
      const updated = { ...mockClassData[0], ...input };
      mockUpdateClass.mockResolvedValueOnce(updated);

      const result = await service.updateClass(TENANT_ID, 'c1', input);

      expect(mockUpdateClass).toHaveBeenCalledWith(TENANT_ID, 'c1', input);
      expect(result.name).toBe('수학심화반');
    });
  });

  describe('deleteClass', () => {
    it('삭제', async () => {
      mockDeleteClass.mockResolvedValueOnce(undefined);

      await service.deleteClass(TENANT_ID, 'c1');

      expect(mockDeleteClass).toHaveBeenCalledWith(TENANT_ID, 'c1');
    });
  });

  // ==================== Phase 0-3 수정사항 검증 ====================

  describe('getClassStatistics', () => {
    it('current_count 기반 학생 수 반환 (Phase 0-3 수정사항)', async () => {
      mockGetClassStatistics.mockResolvedValueOnce({ attendance_rate: 0.85 });
      mockGetClass.mockResolvedValueOnce({ ...mockClassData[0], current_count: 15 });

      const result = await service.getClassStatistics(TENANT_ID, 'c1');

      expect(mockGetClassStatistics).toHaveBeenCalledWith(TENANT_ID, 'c1');
      expect(mockGetClass).toHaveBeenCalledWith(TENANT_ID, 'c1');
      expect(result.totalStudents).toBe(15);
      expect(result.activeStudents).toBe(15);
      expect(result.attendanceRate).toBe(0.85);
    });

    it('getClass가 null 반환 시 학생 수 0', async () => {
      mockGetClassStatistics.mockResolvedValueOnce({ attendance_rate: 0 });
      mockGetClass.mockResolvedValueOnce(null);

      const result = await service.getClassStatistics(TENANT_ID, 'nonexistent');

      expect(result.totalStudents).toBe(0);
      expect(result.activeStudents).toBe(0);
    });
  });

  // ==================== 강사 관리 ====================

  describe('getTeachers', () => {
    it('강사 목록 조회', async () => {
      const teachers = [{ id: 't1', name: '강사1' }];
      mockGetTeachers.mockResolvedValueOnce(teachers);

      const result = await service.getTeachers(TENANT_ID);

      expect(mockGetTeachers).toHaveBeenCalledWith(TENANT_ID, undefined);
      expect(result).toEqual(teachers);
    });
  });

  describe('assignTeacher', () => {
    it('수업에 강사 할당', async () => {
      const input = { class_id: 'c1', teacher_id: 't1' };
      const assigned = { id: 'ct1', ...input, tenant_id: TENANT_ID };
      mockAssignTeacher.mockResolvedValueOnce(assigned);

      const result = await service.assignTeacher(TENANT_ID, input);

      expect(mockAssignTeacher).toHaveBeenCalledWith(TENANT_ID, input);
      expect(result.class_id).toBe('c1');
    });
  });

  describe('unassignTeacher', () => {
    it('수업에서 강사 제거', async () => {
      mockUnassignTeacher.mockResolvedValueOnce(undefined);

      await service.unassignTeacher(TENANT_ID, 'c1', 't1');

      expect(mockUnassignTeacher).toHaveBeenCalledWith(TENANT_ID, 'c1', 't1');
    });
  });
});
