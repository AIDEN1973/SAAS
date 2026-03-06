/**
 * useAlimtalk & useAlimtalkSettings Hook Unit Tests
 *
 * Test targets:
 * - useAlimtalk: stateful hook for sending alimtalk, fetching templates/history/points, canceling
 * - useAlimtalkSettings: React Query-based hook for alimtalk configuration management
 *
 * [불변 규칙] apiClient.invokeFunction 호출 패턴 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';

// ===== Mocks =====

const mockInvokeFunction = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
    invokeFunction: (...args: unknown[]) => mockInvokeFunction(...args),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

// Import AFTER mocks
import { useAlimtalk } from '../useAlimtalk';
import { useAlimtalkSettings } from '../useAlimtalkSettings';
import type {
  SendAlimtalkRequest,
  SendResult,
  AlimtalkTemplate,
} from '../types';

// ===== Test Wrapper =====

function createWrapper(queryClient?: QueryClient) {
  const qc =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  return {
    queryClient: qc,
    wrapper: ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children),
  };
}

// ===== Mock Data =====

const mockSendRequest: SendAlimtalkRequest = {
  templateCode: 'WELCOME_MSG',
  recipients: [
    { phone: '01012345678', name: 'Test User', variables: { name: 'Test User' } },
  ],
  useFallback: true,
  fallbackMessage: 'Fallback SMS message',
};

const mockTemplateListRaw = [
  {
    templtCode: 'WELCOME_MSG',
    templtName: 'Welcome Message',
    templtContent: 'Hello #{name}!',
    status: 'A',
    templateMessageType: 'BA',
    templateEmphasisType: 'NONE',
    buttons: [
      { type: 'WL', name: 'Visit', url_mobile: 'https://m.example.com', url_pc: 'https://example.com' },
    ],
  },
  {
    templtCode: 'REMIND_MSG',
    templtName: 'Reminder',
    templtContent: 'Reminder for #{event}',
    status: 'R',
  },
];

const mockHistoryListRaw = [
  {
    mid: '12345',
    type: 'AT',
    sender: 'TestSender',
    cnt: '5',
    state: '2',
    reserve: '',
    regdate: '2026-03-06 10:00:00',
  },
  {
    mid: '12346',
    type: 'FT',
    sender: 'TestSender',
    cnt: '3',
    state: '1',
    reserve: '2026-03-07 09:00:00',
    regdate: '2026-03-06 11:00:00',
  },
];

// ============================================================================
// useAlimtalk Tests
// ============================================================================

describe('useAlimtalk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useAlimtalk());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.templates).toEqual([]);
      expect(result.current.remainPoints).toBeNull();
    });

    it('returns all expected action functions', () => {
      const { result } = renderHook(() => useAlimtalk());

      expect(typeof result.current.sendAlimtalk).toBe('function');
      expect(typeof result.current.fetchTemplates).toBe('function');
      expect(typeof result.current.fetchHistory).toBe('function');
      expect(typeof result.current.fetchRemainPoints).toBe('function');
      expect(typeof result.current.cancelScheduled).toBe('function');
    });
  });

  describe('sendAlimtalk', () => {
    it('sends alimtalk successfully and returns result', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: {
          success: true,
          used_channel: 'alimtalk',
          used_fallback: false,
          success_count: 1,
          error_count: 0,
          mid: 'msg-001',
          test_mode: false,
        },
      });

      const { result } = renderHook(() => useAlimtalk());

      let sendResult: SendResult | undefined;
      await act(async () => {
        sendResult = await result.current.sendAlimtalk(mockSendRequest);
      });

      expect(sendResult).toBeDefined();
      expect(sendResult!.success).toBe(true);
      expect(sendResult!.usedChannel).toBe('alimtalk');
      expect(sendResult!.usedFallback).toBe(false);
      expect(sendResult!.successCount).toBe(1);
      expect(sendResult!.errorCount).toBe(0);
      expect(sendResult!.messageId).toBe('msg-001');
      expect(sendResult!.testMode).toBe(false);
    });

    it('calls invokeFunction with correct parameters', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: {
          success: true,
          used_channel: 'alimtalk',
          success_count: 1,
          error_count: 0,
        },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.sendAlimtalk(mockSendRequest);
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('alimtalk-send', {
        template_code: 'WELCOME_MSG',
        recipients: [
          {
            receiver: '01012345678',
            recvname: 'Test User',
            variables: { name: 'Test User' },
          },
        ],
        use_fallback: true,
        fallback_message: 'Fallback SMS message',
        scheduled_at: undefined,
      });
    });

    it('defaults useFallback to true when not specified', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { success: true, used_channel: 'alimtalk', success_count: 1, error_count: 0 },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.sendAlimtalk({
          templateCode: 'TEST',
          recipients: [{ phone: '01011112222' }],
        });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith(
        'alimtalk-send',
        expect.objectContaining({ use_fallback: true })
      );
    });

    it('handles SMS fallback result', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: {
          success: true,
          used_channel: 'sms',
          used_fallback: true,
          success_count: 1,
          error_count: 0,
        },
      });

      const { result } = renderHook(() => useAlimtalk());

      let sendResult: SendResult | undefined;
      await act(async () => {
        sendResult = await result.current.sendAlimtalk(mockSendRequest);
      });

      expect(sendResult!.usedChannel).toBe('sms');
      expect(sendResult!.usedFallback).toBe(true);
    });

    it('handles API error response (response.success=false)', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: false,
        data: null,
        error: { message: 'Rate limit exceeded' },
      });

      const { result } = renderHook(() => useAlimtalk());

      let sendResult: SendResult | undefined;
      await act(async () => {
        sendResult = await result.current.sendAlimtalk(mockSendRequest);
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.usedChannel).toBe('none');
      expect(sendResult!.errorCount).toBe(1);
      expect(sendResult!.errorMessage).toBe('Rate limit exceeded');
      expect(result.current.error).toBeTruthy();
      expect(result.current.error!.message).toBe('Rate limit exceeded');
    });

    it('handles network/thrown error', async () => {
      mockInvokeFunction.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useAlimtalk());

      let sendResult: SendResult | undefined;
      await act(async () => {
        sendResult = await result.current.sendAlimtalk(mockSendRequest);
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.usedChannel).toBe('none');
      expect(sendResult!.errorMessage).toBe('Network failure');
      expect(result.current.error!.message).toBe('Network failure');
    });

    it('handles non-Error thrown value', async () => {
      mockInvokeFunction.mockRejectedValue('unknown error string');

      const { result } = renderHook(() => useAlimtalk());

      let sendResult: SendResult | undefined;
      await act(async () => {
        sendResult = await result.current.sendAlimtalk(mockSendRequest);
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.errorMessage).toContain('알 수 없는 오류');
    });

    it('sets isLoading during send and resets after', async () => {
      let resolvePromise: ((value: unknown) => void) | undefined;
      mockInvokeFunction.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result } = renderHook(() => useAlimtalk());

      expect(result.current.isLoading).toBe(false);

      let promise: Promise<SendResult>;
      act(() => {
        promise = result.current.sendAlimtalk(mockSendRequest);
      });

      // isLoading should be true during send
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolvePromise!({
          success: true,
          data: { success: true, used_channel: 'alimtalk', success_count: 1, error_count: 0 },
        });
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('includes scheduledAt when provided', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { success: true, used_channel: 'alimtalk', success_count: 1, error_count: 0 },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.sendAlimtalk({
          ...mockSendRequest,
          scheduledAt: '2026-03-07T10:00:00+09:00',
        });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith(
        'alimtalk-send',
        expect.objectContaining({ scheduled_at: '2026-03-07T10:00:00+09:00' })
      );
    });
  });

  describe('fetchTemplates', () => {
    it('fetches templates successfully and sets state', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { list: mockTemplateListRaw },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchTemplates();
      });

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.templates[0]).toEqual({
        code: 'WELCOME_MSG',
        name: 'Welcome Message',
        content: 'Hello #{name}!',
        status: 'A',
        messageType: 'BA',
        emphasisType: 'NONE',
        buttons: [
          { type: 'WL', name: 'Visit', urlMobile: 'https://m.example.com', urlPc: 'https://example.com' },
        ],
      });
      expect(result.current.templates[1]).toEqual({
        code: 'REMIND_MSG',
        name: 'Reminder',
        content: 'Reminder for #{event}',
        status: 'R',
        messageType: undefined,
        emphasisType: undefined,
        buttons: undefined,
      });
    });

    it('calls invokeFunction with correct parameters', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { list: [] },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchTemplates();
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('alimtalk-templates', { action: 'list' });
    });

    it('handles empty template list', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { list: [] },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchTemplates();
      });

      expect(result.current.templates).toEqual([]);
    });

    it('handles missing list property in response', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: {},
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchTemplates();
      });

      expect(result.current.templates).toEqual([]);
    });

    it('handles fetch error and sets error state', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: false,
        data: null,
        error: { message: 'Template service unavailable' },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchTemplates();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error!.message).toBe('Template service unavailable');
    });
  });

  describe('fetchHistory', () => {
    it('fetches history successfully and returns mapped data', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { list: mockHistoryListRaw },
      });

      const { result } = renderHook(() => useAlimtalk());

      let history: Awaited<ReturnType<typeof result.current.fetchHistory>>;
      await act(async () => {
        history = await result.current.fetchHistory();
      });

      expect(history!).toHaveLength(2);
      expect(history![0]).toEqual({
        mid: '12345',
        type: 'AT',
        sender: 'TestSender',
        count: 5,
        status: '2',
        reserveDate: '',
        createdAt: '2026-03-06 10:00:00',
      });
    });

    it('passes page and limit options', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { list: [] },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchHistory({ page: 2, limit: 10 });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('alimtalk-history', {
        page: 2,
        limit: 10,
      });
    });

    it('defaults page=1, limit=30 when options not provided', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { list: [] },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchHistory();
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('alimtalk-history', {
        page: 1,
        limit: 30,
      });
    });

    it('returns empty array on error', async () => {
      mockInvokeFunction.mockRejectedValue(new Error('History fetch failed'));

      const { result } = renderHook(() => useAlimtalk());

      let history: Awaited<ReturnType<typeof result.current.fetchHistory>>;
      await act(async () => {
        history = await result.current.fetchHistory();
      });

      expect(history!).toEqual([]);
      expect(result.current.error!.message).toBe('History fetch failed');
    });

    it('handles non-numeric cnt gracefully', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: {
          list: [
            { mid: '1', type: 'AT', sender: 'S', cnt: 'invalid', state: '1', reserve: '', regdate: '' },
          ],
        },
      });

      const { result } = renderHook(() => useAlimtalk());

      let history: Awaited<ReturnType<typeof result.current.fetchHistory>>;
      await act(async () => {
        history = await result.current.fetchHistory();
      });

      expect(history![0].count).toBe(0); // parseInt('invalid', 10) returns NaN, || 0
    });
  });

  describe('fetchRemainPoints', () => {
    it('fetches remain points and sets state', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: {
          AT_CNT: 100,
          FT_CNT: 50,
          FI_CNT: 30,
          FW_CNT: 20,
        },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchRemainPoints();
      });

      expect(result.current.remainPoints).toEqual({
        alimtalk: 100,
        friendtalkText: 50,
        friendtalkImage: 30,
        friendtalkWide: 20,
      });
    });

    it('defaults to 0 when point counts are missing', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: {},
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchRemainPoints();
      });

      expect(result.current.remainPoints).toEqual({
        alimtalk: 0,
        friendtalkText: 0,
        friendtalkImage: 0,
        friendtalkWide: 0,
      });
    });

    it('handles error during fetch', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: false,
        data: null,
        error: { message: 'Quota service down' },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.fetchRemainPoints();
      });

      expect(result.current.error!.message).toBe('Quota service down');
      expect(result.current.remainPoints).toBeNull();
    });
  });

  describe('cancelScheduled', () => {
    it('cancels scheduled message successfully', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { success: true },
      });

      const { result } = renderHook(() => useAlimtalk());

      let cancelled: boolean | undefined;
      await act(async () => {
        cancelled = await result.current.cancelScheduled('12345');
      });

      expect(cancelled).toBe(true);
      expect(mockInvokeFunction).toHaveBeenCalledWith('alimtalk-cancel', { mid: 12345 });
    });

    it('returns false when cancellation fails', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: false,
        data: null,
        error: { message: 'Cannot cancel - already sent' },
      });

      const { result } = renderHook(() => useAlimtalk());

      let cancelled: boolean | undefined;
      await act(async () => {
        cancelled = await result.current.cancelScheduled('99999');
      });

      expect(cancelled).toBe(false);
      expect(result.current.error!.message).toBe('Cannot cancel - already sent');
    });

    it('converts string mid to integer', async () => {
      mockInvokeFunction.mockResolvedValue({
        success: true,
        data: { success: true },
      });

      const { result } = renderHook(() => useAlimtalk());

      await act(async () => {
        await result.current.cancelScheduled('67890');
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('alimtalk-cancel', { mid: 67890 });
    });
  });
});

// ============================================================================
// useAlimtalkSettings Tests
// ============================================================================

describe('useAlimtalkSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: mock the invokeFunction to return different data based on function arguments.
   * useAlimtalkSettings calls invokeFunction('alimtalk-settings', { action, params })
   * The hook makes multiple auto-fetching queries on mount, so we need to handle them.
   */
  function setupDefaultMocks() {
    mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
      if (fnName !== 'alimtalk-settings') {
        return Promise.resolve({ success: false, error: { message: 'Unknown function' } });
      }
      const action = body?.action as string;
      switch (action) {
        case 'getStatus':
          return Promise.resolve({
            success: true,
            data: { configured: true, testMode: false },
          });
        case 'getProfiles':
          return Promise.resolve({
            success: true,
            data: {
              profiles: [
                {
                  senderKey: 'sk-123',
                  categoryCode: 'CAT001',
                  channelName: 'TestChannel',
                  status: 'A',
                  alimUseYn: 'Y',
                },
              ],
            },
          });
        case 'getTemplates':
          return Promise.resolve({
            success: true,
            data: {
              templates: [
                {
                  templtCode: 'TPL001',
                  templtName: 'Template 1',
                  templtContent: 'Hello!',
                  status: 'A',
                },
              ],
            },
          });
        case 'getRemain':
          return Promise.resolve({
            success: true,
            data: {
              alimtalk: 500,
              friendtalkText: 200,
              friendtalkImage: 100,
              friendtalkWide: 50,
            },
          });
        default:
          return Promise.resolve({ success: true, data: {} });
      }
    });
  }

  describe('initial queries (auto-fetch)', () => {
    it('fetches status, profiles, templates, and remain points on mount', async () => {
      setupDefaultMocks();
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.status).toEqual({ configured: true, testMode: false });
      expect(result.current.profiles).toHaveLength(1);
      expect(result.current.profiles[0].senderKey).toBe('sk-123');
      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates[0].templtCode).toBe('TPL001');
      expect(result.current.remainPoints).toEqual({
        alimtalk: 500,
        friendtalkText: 200,
        friendtalkImage: 100,
        friendtalkWide: 50,
      });
    });

    it('returns empty arrays when data has no items', async () => {
      mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
        const action = body?.action as string;
        if (action === 'getStatus') {
          return Promise.resolve({ success: true, data: { configured: false, testMode: true } });
        }
        if (action === 'getProfiles') {
          return Promise.resolve({ success: true, data: {} });
        }
        if (action === 'getTemplates') {
          return Promise.resolve({ success: true, data: {} });
        }
        if (action === 'getRemain') {
          return Promise.resolve({ success: true, data: {} });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.profiles).toEqual([]);
      expect(result.current.templates).toEqual([]);
      expect(result.current.remainPoints).toEqual({
        alimtalk: 0,
        friendtalkText: 0,
        friendtalkImage: 0,
        friendtalkWide: 0,
      });
    });
  });

  describe('fetchStatus (refetch/invalidation)', () => {
    it('invalidates status query on call', async () => {
      setupDefaultMocks();
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.fetchStatus();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['alimtalk-settings', 'status'],
      });

      invalidateSpy.mockRestore();
    });
  });

  describe('addTemplate mutation', () => {
    it('adds template and invalidates template cache', async () => {
      setupDefaultMocks();
      const { queryClient, wrapper } = createWrapper();

      // Override for addTemplate action
      mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
        const action = body?.action as string;
        if (action === 'addTemplate') {
          return Promise.resolve({
            success: true,
            data: {
              success: true,
              templtCode: 'TPL_NEW',
              testMode: false,
            },
          });
        }
        // Default mocks for auto-queries
        if (action === 'getStatus') return Promise.resolve({ success: true, data: { configured: true, testMode: false } });
        if (action === 'getProfiles') return Promise.resolve({ success: true, data: { profiles: [] } });
        if (action === 'getTemplates') return Promise.resolve({ success: true, data: { templates: [] } });
        if (action === 'getRemain') return Promise.resolve({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let addResult: Awaited<ReturnType<typeof result.current.addTemplate>>;
      await act(async () => {
        addResult = await result.current.addTemplate({
          tpl_name: 'New Template',
          tpl_content: 'Hello #{name}!',
          tpl_message_type: 'BA',
        });
      });

      expect(addResult!.success).toBe(true);
      expect(addResult!.templtCode).toBe('TPL_NEW');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['alimtalk-settings', 'templates'],
      });

      invalidateSpy.mockRestore();
    });
  });

  describe('modifyTemplate mutation', () => {
    it('modifies template and invalidates template cache', async () => {
      setupDefaultMocks();
      const { queryClient, wrapper } = createWrapper();

      mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
        const action = body?.action as string;
        if (action === 'modifyTemplate') {
          return Promise.resolve({
            success: true,
            data: { success: true, testMode: false },
          });
        }
        if (action === 'getStatus') return Promise.resolve({ success: true, data: { configured: true, testMode: false } });
        if (action === 'getProfiles') return Promise.resolve({ success: true, data: { profiles: [] } });
        if (action === 'getTemplates') return Promise.resolve({ success: true, data: { templates: [] } });
        if (action === 'getRemain') return Promise.resolve({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.modifyTemplate({
          tpl_code: 'TPL001',
          tpl_name: 'Updated Template',
          tpl_content: 'Updated content',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['alimtalk-settings', 'templates'],
      });

      invalidateSpy.mockRestore();
    });
  });

  describe('deleteTemplate mutation', () => {
    it('deletes template and invalidates template cache', async () => {
      setupDefaultMocks();
      const { queryClient, wrapper } = createWrapper();

      mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
        const action = body?.action as string;
        if (action === 'deleteTemplate') {
          return Promise.resolve({
            success: true,
            data: { success: true, testMode: false },
          });
        }
        if (action === 'getStatus') return Promise.resolve({ success: true, data: { configured: true, testMode: false } });
        if (action === 'getProfiles') return Promise.resolve({ success: true, data: { profiles: [] } });
        if (action === 'getTemplates') return Promise.resolve({ success: true, data: { templates: [] } });
        if (action === 'getRemain') return Promise.resolve({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteTemplate('TPL001');
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['alimtalk-settings', 'templates'],
      });

      invalidateSpy.mockRestore();
    });
  });

  describe('requestProfileAuth', () => {
    it('sends profile auth request and invalidates profiles on success', async () => {
      setupDefaultMocks();
      const { queryClient, wrapper } = createWrapper();

      mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
        const action = body?.action as string;
        if (action === 'requestProfileAuth') {
          return Promise.resolve({
            success: true,
            data: { success: true, testMode: false },
          });
        }
        if (action === 'getStatus') return Promise.resolve({ success: true, data: { configured: true, testMode: false } });
        if (action === 'getProfiles') return Promise.resolve({ success: true, data: { profiles: [] } });
        if (action === 'getTemplates') return Promise.resolve({ success: true, data: { templates: [] } });
        if (action === 'getRemain') return Promise.resolve({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let authResult: Awaited<ReturnType<typeof result.current.requestProfileAuth>>;
      await act(async () => {
        authResult = await result.current.requestProfileAuth('@testchannel', '01012345678');
      });

      expect(authResult!.success).toBe(true);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['alimtalk-settings', 'profiles'],
      });

      invalidateSpy.mockRestore();
    });

    it('returns error result on failure', async () => {
      setupDefaultMocks();
      const { wrapper } = createWrapper();

      mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
        const action = body?.action as string;
        if (action === 'requestProfileAuth') {
          return Promise.reject(new Error('Auth request failed'));
        }
        if (action === 'getStatus') return Promise.resolve({ success: true, data: { configured: true, testMode: false } });
        if (action === 'getProfiles') return Promise.resolve({ success: true, data: { profiles: [] } });
        if (action === 'getTemplates') return Promise.resolve({ success: true, data: { templates: [] } });
        if (action === 'getRemain') return Promise.resolve({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
      });

      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let authResult: Awaited<ReturnType<typeof result.current.requestProfileAuth>>;
      await act(async () => {
        authResult = await result.current.requestProfileAuth('@bad', '010');
      });

      expect(authResult!.success).toBe(false);
      expect(authResult!.message).toBe('Auth request failed');
    });
  });

  describe('requestReview', () => {
    it('requests review and invalidates templates on success', async () => {
      setupDefaultMocks();
      const { queryClient, wrapper } = createWrapper();

      mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
        const action = body?.action as string;
        if (action === 'requestReview') {
          return Promise.resolve({
            success: true,
            data: { success: true, testMode: false },
          });
        }
        if (action === 'getStatus') return Promise.resolve({ success: true, data: { configured: true, testMode: false } });
        if (action === 'getProfiles') return Promise.resolve({ success: true, data: { profiles: [] } });
        if (action === 'getTemplates') return Promise.resolve({ success: true, data: { templates: [] } });
        if (action === 'getRemain') return Promise.resolve({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let reviewResult: Awaited<ReturnType<typeof result.current.requestReview>>;
      await act(async () => {
        reviewResult = await result.current.requestReview('TPL001');
      });

      expect(reviewResult!.success).toBe(true);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['alimtalk-settings', 'templates'],
      });

      invalidateSpy.mockRestore();
    });

    it('returns error result on failure', async () => {
      setupDefaultMocks();
      const { wrapper } = createWrapper();

      mockInvokeFunction.mockImplementation((fnName: string, body?: Record<string, unknown>) => {
        const action = body?.action as string;
        if (action === 'requestReview') {
          return Promise.reject(new Error('Review service unavailable'));
        }
        if (action === 'getStatus') return Promise.resolve({ success: true, data: { configured: true, testMode: false } });
        if (action === 'getProfiles') return Promise.resolve({ success: true, data: { profiles: [] } });
        if (action === 'getTemplates') return Promise.resolve({ success: true, data: { templates: [] } });
        if (action === 'getRemain') return Promise.resolve({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
      });

      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let reviewResult: Awaited<ReturnType<typeof result.current.requestReview>>;
      await act(async () => {
        reviewResult = await result.current.requestReview('TPL_BAD');
      });

      expect(reviewResult!.success).toBe(false);
      expect(reviewResult!.message).toBe('Review service unavailable');
    });
  });

  describe('stub methods', () => {
    it('cancelScheduled returns success stub', async () => {
      setupDefaultMocks();
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let cancelResult: Awaited<ReturnType<typeof result.current.cancelScheduled>>;
      await act(async () => {
        cancelResult = await result.current.cancelScheduled(12345);
      });

      expect(cancelResult!.success).toBe(true);
    });

    it('returns empty history, historyDetail, categories, and default pagination', async () => {
      setupDefaultMocks();
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.history).toEqual([]);
      expect(result.current.historyDetail).toEqual([]);
      expect(result.current.categories).toEqual([]);
      expect(result.current.pagination).toEqual({ currentPage: 1, totalPage: 1 });
    });

    it('clearError is a no-op function', async () => {
      setupDefaultMocks();
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should not throw
      expect(() => result.current.clearError()).not.toThrow();
    });

    it('error is always null (React Query handles errors)', async () => {
      setupDefaultMocks();
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useAlimtalkSettings(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeNull();
    });
  });
});
