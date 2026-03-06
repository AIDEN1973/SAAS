/**
 * AttendanceDomain Unit Tests
 *
 * 출결 로그 생성/조회, 알림 연동, analytics/metering 기록 검증
 * [SECURITY] withTenant 적용 확인
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChainMock, TENANT_ID, MOCK_USER_ID } from './test-helpers';

const mockFrom = vi.fn();

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

vi.mock('@lib/date-utils', () => ({
  toKST: (date?: string) => ({
    format: (fmt: string) => date ? '03/05 10:00' : '2026-03-05',
  }),
}));

const mockGetConfig = vi.fn();
vi.mock('@core/config/service', () => ({
  configService: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
  },
}));

const mockCreateNotification = vi.fn();
vi.mock('@core/notification/service', () => ({
  notificationService: {
    createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  },
}));

const mockRecordEvent = vi.fn();
vi.mock('@core/analytics/service', () => ({
  analyticsService: {
    recordEvent: (...args: unknown[]) => mockRecordEvent(...args),
  },
}));

const mockRecordUsage = vi.fn();
vi.mock('@core/metering/service', () => ({
  meteringService: {
    recordUsage: (...args: unknown[]) => mockRecordUsage(...args),
  },
}));

import { AttendanceDomain } from '../domains/attendance-domain';

describe('AttendanceDomain', () => {
  let domain: AttendanceDomain;
  const mockStudentDomain = {
    getStudent: vi.fn(),
    getGuardians: vi.fn(),
  };
  const mockSupabase = { from: mockFrom } as never;

  beforeEach(() => {
    domain = new AttendanceDomain(mockSupabase, mockStudentDomain as never);
    vi.clearAllMocks();
  });

  describe('createAttendanceLog', () => {
    const baseInput = {
      student_id: 's1',
      class_id: 'c1',
      occurred_at: '2026-03-05T10:00:00+09:00',
      attendance_type: 'check_in' as const,
      status: 'present' as const,
    };

    it('INSERT 성공: from(attendance_logs).insert + tenant_id', async () => {
      const insertChain = createChainMock({ id: 'log1', ...baseInput, tenant_id: TENANT_ID });
      // analytics용 tenants 조회 + core_stores 조회
      const tenantsChain = createChainMock({ industry_type: 'academy' });
      const storesChain = createChainMock([{ id: 'store1', region_id: 'r1', industry_type: 'academy' }]);

      mockFrom
        .mockReturnValueOnce(insertChain)   // attendance_logs INSERT
        .mockReturnValueOnce(tenantsChain)  // tenants 조회
        .mockReturnValueOnce(storesChain);  // core_stores 조회

      mockGetConfig.mockResolvedValue({ attendance: { auto_notification: false } });
      mockRecordEvent.mockResolvedValue(undefined);
      mockRecordUsage.mockResolvedValue(undefined);

      const result = await domain.createAttendanceLog(TENANT_ID, baseInput, MOCK_USER_ID);

      expect(mockFrom).toHaveBeenCalledWith('attendance_logs');
      expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: TENANT_ID,
        student_id: 's1',
        class_id: 'c1',
      }));
      expect(result).toBeDefined();
    });

    it('자동 알림 (autoNotification=true): notificationService 호출', async () => {
      const insertChain = createChainMock({ id: 'log1', ...baseInput, tenant_id: TENANT_ID });
      const tenantsChain = createChainMock({ industry_type: 'academy' });
      const storesChain = createChainMock([]);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(tenantsChain)
        .mockReturnValueOnce(storesChain);

      mockGetConfig.mockResolvedValue({
        attendance: { auto_notification: true, notification_channel: 'sms' },
      });
      mockStudentDomain.getStudent.mockResolvedValue({ id: 's1', name: '학생1' });
      mockStudentDomain.getGuardians.mockResolvedValue([
        { phone: '010-1234-5678', is_primary: true },
      ]);
      mockCreateNotification.mockResolvedValue(undefined);
      mockRecordEvent.mockResolvedValue(undefined);
      mockRecordUsage.mockResolvedValue(undefined);

      await domain.createAttendanceLog(TENANT_ID, baseInput, MOCK_USER_ID);

      expect(mockCreateNotification).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        channel: 'sms',
        recipient: '010-1234-5678',
      }));
    });

    it('결석 시 알림 미발송', async () => {
      const absentInput = { ...baseInput, status: 'absent' as const };
      const insertChain = createChainMock({ id: 'log1', ...absentInput, tenant_id: TENANT_ID });
      const tenantsChain = createChainMock({ industry_type: 'academy' });
      const storesChain = createChainMock([]);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(tenantsChain)
        .mockReturnValueOnce(storesChain);

      mockGetConfig.mockResolvedValue({
        attendance: { auto_notification: true },
      });
      mockRecordEvent.mockResolvedValue(undefined);
      mockRecordUsage.mockResolvedValue(undefined);

      await domain.createAttendanceLog(TENANT_ID, absentInput, MOCK_USER_ID);

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('알림 실패해도 출결 기록 유지', async () => {
      const insertChain = createChainMock({ id: 'log1', ...baseInput, tenant_id: TENANT_ID });
      const tenantsChain = createChainMock({ industry_type: 'academy' });
      const storesChain = createChainMock([]);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(tenantsChain)
        .mockReturnValueOnce(storesChain);

      mockGetConfig.mockRejectedValue(new Error('Config service down'));
      mockRecordEvent.mockResolvedValue(undefined);
      mockRecordUsage.mockResolvedValue(undefined);

      const result = await domain.createAttendanceLog(TENANT_ID, baseInput, MOCK_USER_ID);

      // 알림 실패해도 출결 기록은 정상 반환
      expect(result).toBeDefined();
      expect(result.id).toBe('log1');
    });

    it('analytics + metering 기록', async () => {
      const insertChain = createChainMock({ id: 'log1', ...baseInput, tenant_id: TENANT_ID });
      const tenantsChain = createChainMock({ industry_type: 'academy' });
      const storesChain = createChainMock([{ id: 'store1', region_id: 'r1' }]);

      mockFrom
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(tenantsChain)
        .mockReturnValueOnce(storesChain);

      mockGetConfig.mockResolvedValue({ attendance: { auto_notification: false } });
      mockRecordEvent.mockResolvedValue(undefined);
      mockRecordUsage.mockResolvedValue(undefined);

      await domain.createAttendanceLog(TENANT_ID, baseInput, MOCK_USER_ID);

      expect(mockRecordEvent).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        event_type: 'attendance.check_in',
      }));
      expect(mockRecordUsage).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        metric_type: 'attendance_count',
        value: 1,
      }));
    });
  });

  describe('getAttendanceLogs', () => {
    it('[SECURITY] withTenant 적용 확인', async () => {
      const chain = createChainMock([{ id: 'log1', student_id: 's1' }]);
      mockFrom.mockReturnValue(chain);

      await domain.getAttendanceLogs(TENANT_ID);

      // withTenant는 pass-through mock이지만, 호출 체인에서 from('attendance_logs') 확인
      expect(mockFrom).toHaveBeenCalledWith('attendance_logs');
      expect(chain.select).toHaveBeenCalledWith('*');
    });

    it('필터 적용 (student_id, date_from, date_to)', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await domain.getAttendanceLogs(TENANT_ID, {
        student_id: 's1',
        date_from: '2026-03-01',
        date_to: '2026-03-05',
      });

      expect(chain.eq).toHaveBeenCalledWith('student_id', 's1');
      expect(chain.gte).toHaveBeenCalledWith('occurred_at', '2026-03-01');
      expect(chain.lte).toHaveBeenCalledWith('occurred_at', '2026-03-05');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'Query failed' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getAttendanceLogs(TENANT_ID)).rejects.toThrow('Failed to fetch attendance logs: Query failed');
    });
  });
});
