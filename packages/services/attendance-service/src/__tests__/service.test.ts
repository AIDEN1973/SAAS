/**
 * Attendance Service Unit Tests
 *
 * Service Layer의 출결 관리 위임(delegation) 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCreateAttendanceLog,
  mockGetAttendanceLogs,
  mockGetAttendanceLogsByStudent,
  mockGetAttendanceLogsByClass,
  mockDeleteAttendanceLog,
} = vi.hoisted(() => ({
  mockCreateAttendanceLog: vi.fn(),
  mockGetAttendanceLogs: vi.fn(),
  mockGetAttendanceLogsByStudent: vi.fn(),
  mockGetAttendanceLogsByClass: vi.fn(),
  mockDeleteAttendanceLog: vi.fn(),
}));

vi.mock('@industry/academy/service', () => ({
  academyService: {
    createAttendanceLog: mockCreateAttendanceLog,
    getAttendanceLogs: mockGetAttendanceLogs,
    getAttendanceLogsByStudent: mockGetAttendanceLogsByStudent,
    getAttendanceLogsByClass: mockGetAttendanceLogsByClass,
    deleteAttendanceLog: mockDeleteAttendanceLog,
  },
}));

import { AttendanceService } from '../service';

const TENANT_ID = 'test-tenant-id';

const mockLogs = [
  {
    id: 'log1',
    student_id: 's1',
    class_id: 'c1',
    status: 'checked_in',
    checked_in_at: '2026-03-05T09:00:00+09:00',
    tenant_id: TENANT_ID,
  },
  {
    id: 'log2',
    student_id: 's2',
    class_id: 'c1',
    status: 'checked_out',
    checked_in_at: '2026-03-05T09:00:00+09:00',
    checked_out_at: '2026-03-05T18:00:00+09:00',
    tenant_id: TENANT_ID,
  },
];

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService();
    vi.clearAllMocks();
  });

  describe('getAttendanceLogs', () => {
    it('날짜별 조회', async () => {
      const filter = { date: '2026-03-05' };
      mockGetAttendanceLogs.mockResolvedValueOnce(mockLogs);

      const result = await service.getAttendanceLogs(TENANT_ID, filter);

      expect(mockGetAttendanceLogs).toHaveBeenCalledWith(TENANT_ID, filter);
      expect(result).toHaveLength(2);
    });

    it('필터 없이 전체 조회', async () => {
      mockGetAttendanceLogs.mockResolvedValueOnce(mockLogs);

      const result = await service.getAttendanceLogs(TENANT_ID);

      expect(mockGetAttendanceLogs).toHaveBeenCalledWith(TENANT_ID, undefined);
      expect(result).toEqual(mockLogs);
    });
  });

  describe('getAttendanceLogsByStudent', () => {
    it('학생별 조회', async () => {
      mockGetAttendanceLogsByStudent.mockResolvedValueOnce([mockLogs[0]]);

      const result = await service.getAttendanceLogsByStudent(TENANT_ID, 's1');

      expect(mockGetAttendanceLogsByStudent).toHaveBeenCalledWith(TENANT_ID, 's1', undefined);
      expect(result).toHaveLength(1);
      expect(result[0].student_id).toBe('s1');
    });
  });

  describe('getAttendanceLogsByClass', () => {
    it('수업별 조회', async () => {
      mockGetAttendanceLogsByClass.mockResolvedValueOnce(mockLogs);

      const result = await service.getAttendanceLogsByClass(TENANT_ID, 'c1');

      expect(mockGetAttendanceLogsByClass).toHaveBeenCalledWith(TENANT_ID, 'c1', undefined);
      expect(result).toHaveLength(2);
    });
  });

  describe('createAttendanceLog', () => {
    it('등원 기록 생성', async () => {
      const input = {
        student_id: 's1',
        class_id: 'c1',
        status: 'checked_in' as const,
        checked_in_at: '2026-03-05T09:00:00+09:00',
      };
      const created = { id: 'log3', ...input, tenant_id: TENANT_ID };
      mockCreateAttendanceLog.mockResolvedValueOnce(created);

      const result = await service.createAttendanceLog(TENANT_ID, input);

      expect(mockCreateAttendanceLog).toHaveBeenCalledWith(TENANT_ID, input, undefined);
      expect(result.status).toBe('checked_in');
    });

    it('하원 기록 생성', async () => {
      const input = {
        student_id: 's1',
        class_id: 'c1',
        status: 'checked_out' as const,
        checked_in_at: '2026-03-05T09:00:00+09:00',
        checked_out_at: '2026-03-05T18:00:00+09:00',
      };
      const created = { id: 'log4', ...input, tenant_id: TENANT_ID };
      mockCreateAttendanceLog.mockResolvedValueOnce(created);

      const result = await service.createAttendanceLog(TENANT_ID, input);

      expect(result.status).toBe('checked_out');
      expect(result.checked_out_at).toBeDefined();
    });

    it('중복 등원 방지 (에러 전파)', async () => {
      const input = {
        student_id: 's1',
        class_id: 'c1',
        status: 'checked_in' as const,
        checked_in_at: '2026-03-05T09:00:00+09:00',
      };
      mockCreateAttendanceLog.mockRejectedValueOnce(
        new Error('Duplicate attendance log')
      );

      await expect(service.createAttendanceLog(TENANT_ID, input))
        .rejects.toThrow('Duplicate attendance log');
    });
  });

  describe('deleteAttendanceLog', () => {
    it('출결 로그 삭제', async () => {
      mockDeleteAttendanceLog.mockResolvedValueOnce(undefined);

      await service.deleteAttendanceLog(TENANT_ID, 'log1');

      expect(mockDeleteAttendanceLog).toHaveBeenCalledWith(TENANT_ID, 'log1');
    });
  });
});
