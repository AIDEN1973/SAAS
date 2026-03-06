/**
 * NotificationService Unit Tests
 *
 * 알림 생성(pending), 필터 조회, 상태 업데이트(sent_at 자동 설정)
 * [불변 규칙] withTenant() 필수, RLS tenant_id 격리
 * [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS 폴백
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/* Hoisted mocks                                                       */
/* ------------------------------------------------------------------ */
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

/* ------------------------------------------------------------------ */
/* Chain helper                                                        */
/* ------------------------------------------------------------------ */
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'range', 'ilike', 'or', 'not',
    'contains', 'filter', 'textSearch', 'maybeSingle', 'csv',
    'match', 'like',
  ];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => ({ data: resolvedData, error: resolvedError }));
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({ data: resolvedData, error: resolvedError });
    },
  });
  return chain;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
const TENANT_ID = 'test-tenant-id';
const NOTIFICATION_ID = 'notif-001';

/* ------------------------------------------------------------------ */
/* SUT                                                                 */
/* ------------------------------------------------------------------ */
import { NotificationService } from '../service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
  });

  /* ================================================================ */
  /* createNotification                                                */
  /* ================================================================ */
  describe('createNotification', () => {
    it('should create notification with pending status', async () => {
      const createdNotification = {
        id: NOTIFICATION_ID,
        tenant_id: TENANT_ID,
        recipient: '010-1234-5678',
        content: 'Test notification message',
        status: 'pending',
        created_at: '2026-03-06T00:00:00Z',
      };
      const chain = createChainMock(createdNotification);
      mockFrom.mockReturnValue(chain);

      const result = await service.createNotification(TENANT_ID, {
        recipient: '010-1234-5678',
        content: 'Test notification message',
      });

      expect(mockFrom).toHaveBeenCalledWith('notifications');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          recipient: '010-1234-5678',
          content: 'Test notification message',
          status: 'pending',
        })
      );
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(result.status).toBe('pending');
      expect(result.id).toBe(NOTIFICATION_ID);
    });

    it('should include template_id when provided', async () => {
      const createdNotification = {
        id: NOTIFICATION_ID,
        tenant_id: TENANT_ID,
        recipient: '010-9999-0000',
        template_id: 'tpl-checkin',
        content: 'Check-in notification',
        status: 'pending',
        created_at: '2026-03-06T00:00:00Z',
      };
      const chain = createChainMock(createdNotification);
      mockFrom.mockReturnValue(chain);

      const result = await service.createNotification(TENANT_ID, {
        recipient: '010-9999-0000',
        template_id: 'tpl-checkin',
        content: 'Check-in notification',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          template_id: 'tpl-checkin',
        })
      );
      expect(result.template_id).toBe('tpl-checkin');
    });

    it('should throw on insert error', async () => {
      const chain = createChainMock(null, { message: 'duplicate key' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.createNotification(TENANT_ID, {
          recipient: '010-1234-5678',
          content: 'Test',
        })
      ).rejects.toThrow('Failed to create notification: duplicate key');
    });
  });

  /* ================================================================ */
  /* getNotifications                                                   */
  /* ================================================================ */
  describe('getNotifications', () => {
    const mockNotifications = [
      {
        id: 'notif-001',
        tenant_id: TENANT_ID,
        recipient: '010-1111-2222',
        content: 'Message 1',
        status: 'sent',
        created_at: '2026-03-06T10:00:00Z',
      },
      {
        id: 'notif-002',
        tenant_id: TENANT_ID,
        recipient: '010-3333-4444',
        content: 'Message 2',
        status: 'pending',
        created_at: '2026-03-06T09:00:00Z',
      },
    ];

    it('should return all notifications without filter', async () => {
      const chain = createChainMock(mockNotifications);
      mockFrom.mockReturnValue(chain);

      const result = await service.getNotifications(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('notifications');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(mockNotifications);
      expect(result).toHaveLength(2);
    });

    it('should filter by channel', async () => {
      const chain = createChainMock([mockNotifications[0]]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getNotifications(TENANT_ID, {
        channel: 'kakao_at',
      } as { channel: string });

      expect(chain.eq).toHaveBeenCalledWith('channel', 'kakao_at');
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const chain = createChainMock([mockNotifications[1]]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getNotifications(TENANT_ID, {
        status: 'pending',
      });

      expect(chain.eq).toHaveBeenCalledWith('status', 'pending');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should filter by date range (date_from and date_to)', async () => {
      const chain = createChainMock(mockNotifications);
      mockFrom.mockReturnValue(chain);

      const result = await service.getNotifications(TENANT_ID, {
        date_from: '2026-03-06T00:00:00Z',
        date_to: '2026-03-06T23:59:59Z',
      });

      expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-03-06T00:00:00Z');
      expect(chain.lte).toHaveBeenCalledWith('created_at', '2026-03-06T23:59:59Z');
      expect(result).toEqual(mockNotifications);
    });

    it('should return empty array when data is null', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      const result = await service.getNotifications(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('should throw on query error', async () => {
      const chain = createChainMock(null, { message: 'connection refused' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getNotifications(TENANT_ID)).rejects.toThrow(
        'Failed to fetch notifications: connection refused'
      );
    });
  });

  /* ================================================================ */
  /* updateNotificationStatus                                          */
  /* ================================================================ */
  describe('updateNotificationStatus', () => {
    it('should set sent_at when status is "sent"', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.updateNotificationStatus(TENANT_ID, NOTIFICATION_ID, 'sent');

      expect(mockFrom).toHaveBeenCalledWith('notifications');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          sent_at: expect.any(String),
        })
      );
      expect(chain.eq).toHaveBeenCalledWith('id', NOTIFICATION_ID);
    });

    it('should set sent_at when status is "delivered"', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.updateNotificationStatus(TENANT_ID, NOTIFICATION_ID, 'delivered');

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          sent_at: expect.any(String),
        })
      );
    });

    it('should include error_message when status is "failed"', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.updateNotificationStatus(
        TENANT_ID,
        NOTIFICATION_ID,
        'failed',
        'Recipient unreachable'
      );

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Recipient unreachable',
        })
      );
      // 'failed' should NOT set sent_at
      const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateArg.sent_at).toBeUndefined();
    });

    it('should not set sent_at for "pending" status', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await service.updateNotificationStatus(TENANT_ID, NOTIFICATION_ID, 'pending');

      const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateArg.status).toBe('pending');
      expect(updateArg.sent_at).toBeUndefined();
    });

    it('should throw on update error', async () => {
      const chain = createChainMock(null, { message: 'row not found' });
      mockFrom.mockReturnValue(chain);

      await expect(
        service.updateNotificationStatus(TENANT_ID, NOTIFICATION_ID, 'sent')
      ).rejects.toThrow('Failed to update notification status: row not found');
    });
  });
});
