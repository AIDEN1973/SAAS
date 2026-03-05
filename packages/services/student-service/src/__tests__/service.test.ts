/**
 * Student Service Unit Tests
 *
 * Service Layer는 Industry Layer(academyService)의 래퍼이므로
 * 올바른 위임(delegation)을 검증합니다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetStudents,
  mockGetStudent,
  mockCreateStudent,
  mockUpdateStudent,
  mockDeleteStudent,
  mockGetGuardians,
  mockCreateGuardians,
  mockBulkCreateStudents,
  mockGetStudentsPaged,
  mockRestoreDeletedStudent,
  mockGetTags,
  mockUpdateStudentTags,
} = vi.hoisted(() => ({
  mockGetStudents: vi.fn(),
  mockGetStudent: vi.fn(),
  mockCreateStudent: vi.fn(),
  mockUpdateStudent: vi.fn(),
  mockDeleteStudent: vi.fn(),
  mockGetGuardians: vi.fn(),
  mockCreateGuardians: vi.fn(),
  mockBulkCreateStudents: vi.fn(),
  mockGetStudentsPaged: vi.fn(),
  mockRestoreDeletedStudent: vi.fn(),
  mockGetTags: vi.fn(),
  mockUpdateStudentTags: vi.fn(),
}));

vi.mock('@industry/academy/service', () => ({
  academyService: {
    getStudents: mockGetStudents,
    getStudent: mockGetStudent,
    createStudent: mockCreateStudent,
    updateStudent: mockUpdateStudent,
    deleteStudent: mockDeleteStudent,
    getGuardians: mockGetGuardians,
    createGuardians: mockCreateGuardians,
    bulkCreateStudents: mockBulkCreateStudents,
    getStudentsPaged: mockGetStudentsPaged,
    restoreDeletedStudent: mockRestoreDeletedStudent,
    getTags: mockGetTags,
    updateStudentTags: mockUpdateStudentTags,
  },
}));

import { StudentService } from '../service';

const TENANT_ID = 'test-tenant-id';

const mockStudentData = [
  { id: 's1', name: '학생1', status: 'active', tenant_id: TENANT_ID },
  { id: 's2', name: '학생2', status: 'active', tenant_id: TENANT_ID },
];

describe('StudentService', () => {
  let service: StudentService;

  beforeEach(() => {
    service = new StudentService();
    vi.clearAllMocks();
  });

  describe('getStudents', () => {
    it('필터 없이 전체 조회', async () => {
      mockGetStudents.mockResolvedValueOnce(mockStudentData);

      const result = await service.getStudents(TENANT_ID);

      expect(mockGetStudents).toHaveBeenCalledWith(TENANT_ID, undefined);
      expect(result).toEqual(mockStudentData);
    });

    it('status 필터 적용', async () => {
      const filter = { status: 'active' as const };
      mockGetStudents.mockResolvedValueOnce([mockStudentData[0]]);

      const result = await service.getStudents(TENANT_ID, filter);

      expect(mockGetStudents).toHaveBeenCalledWith(TENANT_ID, filter);
      expect(result).toHaveLength(1);
    });

    it('search 키워드 필터 적용', async () => {
      const filter = { search: '학생1' };
      mockGetStudents.mockResolvedValueOnce([mockStudentData[0]]);

      const result = await service.getStudents(TENANT_ID, filter);

      expect(mockGetStudents).toHaveBeenCalledWith(TENANT_ID, filter);
      expect(result[0].name).toBe('학생1');
    });
  });

  describe('getStudent', () => {
    it('존재하는 학생 조회', async () => {
      mockGetStudent.mockResolvedValueOnce(mockStudentData[0]);

      const result = await service.getStudent(TENANT_ID, 's1');

      expect(mockGetStudent).toHaveBeenCalledWith(TENANT_ID, 's1');
      expect(result).toEqual(mockStudentData[0]);
    });

    it('존재하지 않는 학생 → null 반환', async () => {
      mockGetStudent.mockResolvedValueOnce(null);

      const result = await service.getStudent(TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createStudent', () => {
    it('정상 생성', async () => {
      const input = { name: '새학생', phone: '010-1234-5678' };
      const created = { id: 's3', ...input, status: 'active', tenant_id: TENANT_ID };
      mockCreateStudent.mockResolvedValueOnce(created);

      const result = await service.createStudent(TENANT_ID, 'academy', input);

      expect(mockCreateStudent).toHaveBeenCalledWith(TENANT_ID, 'academy', input, undefined);
      expect(result.name).toBe('새학생');
    });

    it('필수 필드 누락 시 에러', async () => {
      mockCreateStudent.mockRejectedValueOnce(new Error('Name is required'));

      await expect(service.createStudent(TENANT_ID, 'academy', {} as never))
        .rejects.toThrow('Name is required');
    });
  });

  describe('updateStudent', () => {
    it('정상 수정', async () => {
      const input = { name: '수정된학생' };
      const updated = { ...mockStudentData[0], ...input };
      mockUpdateStudent.mockResolvedValueOnce(updated);

      const result = await service.updateStudent(TENANT_ID, 's1', input);

      expect(mockUpdateStudent).toHaveBeenCalledWith(TENANT_ID, 's1', input, undefined);
      expect(result.name).toBe('수정된학생');
    });
  });

  describe('deleteStudent', () => {
    it('soft delete 동작 확인', async () => {
      mockDeleteStudent.mockResolvedValueOnce(undefined);

      await service.deleteStudent(TENANT_ID, 's1');

      expect(mockDeleteStudent).toHaveBeenCalledWith(TENANT_ID, 's1', undefined);
    });
  });

  describe('getGuardians', () => {
    it('학생별 보호자 목록 조회', async () => {
      const guardians = [{ id: 'g1', name: '학부모1', phone: '010-0000-0000' }];
      mockGetGuardians.mockResolvedValueOnce(guardians);

      const result = await service.getGuardians(TENANT_ID, 's1');

      expect(mockGetGuardians).toHaveBeenCalledWith(TENANT_ID, 's1');
      expect(result).toEqual(guardians);
    });
  });

  describe('createGuardians', () => {
    it('보호자 생성', async () => {
      const guardianInput = [{ name: '학부모1', phone: '010-0000-0000', relationship: 'parent' }];
      const created = [{ id: 'g1', ...guardianInput[0], tenant_id: TENANT_ID }];
      mockCreateGuardians.mockResolvedValueOnce(created);

      const result = await service.createGuardians(TENANT_ID, 's1', guardianInput);

      expect(mockCreateGuardians).toHaveBeenCalledWith(TENANT_ID, 's1', guardianInput);
      expect(result).toHaveLength(1);
    });
  });

  describe('bulkCreateStudents', () => {
    it('벌크 생성', async () => {
      const inputs = [
        { name: '학생A', phone: '010-1111-1111' },
        { name: '학생B', phone: '010-2222-2222' },
      ];
      mockBulkCreateStudents.mockResolvedValueOnce(
        inputs.map((i, idx) => ({ id: `bulk-${idx}`, ...i, status: 'active' }))
      );

      const result = await service.bulkCreateStudents(TENANT_ID, 'academy', inputs);

      expect(mockBulkCreateStudents).toHaveBeenCalledWith(TENANT_ID, 'academy', inputs, undefined);
      expect(result).toHaveLength(2);
    });
  });

  describe('getStudentsPaged', () => {
    it('페이지네이션 조회', async () => {
      const pagedResult = { students: mockStudentData, totalCount: 2 };
      mockGetStudentsPaged.mockResolvedValueOnce(pagedResult);

      const result = await service.getStudentsPaged(TENANT_ID, undefined, 1, 10);

      expect(mockGetStudentsPaged).toHaveBeenCalledWith(TENANT_ID, undefined, 1, 10);
      expect(result.totalCount).toBe(2);
    });
  });

  describe('restoreDeletedStudent', () => {
    it('소프트 삭제된 학생 복원', async () => {
      const restored = { ...mockStudentData[0], status: 'active' };
      mockRestoreDeletedStudent.mockResolvedValueOnce(restored);

      const result = await service.restoreDeletedStudent(TENANT_ID, 's1');

      expect(mockRestoreDeletedStudent).toHaveBeenCalledWith(TENANT_ID, 's1');
      expect(result.status).toBe('active');
    });
  });

  describe('getTags', () => {
    it('태그 목록 조회', async () => {
      const tags = [{ id: 't1', name: '초등학생', color: '#FF0000' }];
      mockGetTags.mockResolvedValueOnce(tags);

      const result = await service.getTags(TENANT_ID);

      expect(mockGetTags).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toEqual(tags);
    });
  });

  describe('updateStudentTags', () => {
    it('태그 할당/해제', async () => {
      mockUpdateStudentTags.mockResolvedValueOnce(undefined);

      await service.updateStudentTags(TENANT_ID, 's1', ['t1', 't2']);

      expect(mockUpdateStudentTags).toHaveBeenCalledWith(TENANT_ID, 's1', ['t1', 't2']);
    });
  });
});
