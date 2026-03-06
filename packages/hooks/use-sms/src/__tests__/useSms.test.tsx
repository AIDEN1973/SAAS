/**
 * useSms Hook & Utility Functions Unit Tests
 *
 * Test targets:
 * - useSms: stateful hook for sending SMS, mass SMS, history, detail, remain, cancel
 * - calculateSmsBytes: EUC-KR byte calculation
 * - getRecommendedSmsType: SMS/LMS auto-detection
 * - normalizePhoneNumber: strip non-numeric chars
 * - formatPhoneNumber: format to 010-1234-5678 style
 *
 * [불변 규칙] useSupabaseClient -> supabase.functions.invoke 호출 패턴 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ===== Mocks =====

const mockInvoke = vi.fn();

vi.mock('@supabase/auth-helpers-react', () => ({
  useSupabaseClient: vi.fn(() => ({
    functions: {
      invoke: mockInvoke,
    },
  })),
}));

// Import AFTER mocks
import {
  useSms,
  calculateSmsBytes,
  getRecommendedSmsType,
  normalizePhoneNumber,
  formatPhoneNumber,
} from '../useSms';

import type {
  SmsSendRequest,
  SmsSendMassRequest,
  SmsListRequest,
} from '../types';

// ============================================================================
// Utility Function Tests (pure functions, no hooks)
// ============================================================================

describe('calculateSmsBytes', () => {
  it('counts ASCII characters as 1 byte each', () => {
    expect(calculateSmsBytes('Hello')).toBe(5);
    expect(calculateSmsBytes('abc123')).toBe(6);
  });

  it('counts Korean characters as 2 bytes each', () => {
    expect(calculateSmsBytes('안녕')).toBe(4);
    expect(calculateSmsBytes('가나다')).toBe(6);
  });

  it('counts mixed Korean and ASCII correctly', () => {
    // "Hello" = 5 bytes, "안녕" = 4 bytes
    expect(calculateSmsBytes('Hello안녕')).toBe(9);
  });

  it('returns 0 for empty string', () => {
    expect(calculateSmsBytes('')).toBe(0);
  });

  it('counts special characters as 1 byte', () => {
    expect(calculateSmsBytes('!@#$%')).toBe(5);
  });

  it('counts Korean jamo (consonants/vowels) as 2 bytes', () => {
    // Korean jamo range: 0x3131 ~ 0x318E
    expect(calculateSmsBytes('ㄱㄴㄷ')).toBe(6);
    expect(calculateSmsBytes('ㅏㅓㅗ')).toBe(6);
  });

  it('counts non-ASCII non-Korean characters as 2 bytes', () => {
    // CJK characters, etc.
    expect(calculateSmsBytes('\u4e2d')).toBe(2); // Chinese char
  });
});

describe('getRecommendedSmsType', () => {
  it('returns SMS for messages 90 bytes or fewer', () => {
    // 90 ASCII chars = 90 bytes
    const shortMsg = 'a'.repeat(90);
    expect(getRecommendedSmsType(shortMsg)).toBe('SMS');
  });

  it('returns LMS for messages over 90 bytes', () => {
    // 91 ASCII chars = 91 bytes
    const longMsg = 'a'.repeat(91);
    expect(getRecommendedSmsType(longMsg)).toBe('LMS');
  });

  it('returns SMS for short Korean message', () => {
    // 45 Korean chars = 90 bytes
    const msg = '가'.repeat(45);
    expect(getRecommendedSmsType(msg)).toBe('SMS');
  });

  it('returns LMS for long Korean message', () => {
    // 46 Korean chars = 92 bytes
    const msg = '가'.repeat(46);
    expect(getRecommendedSmsType(msg)).toBe('LMS');
  });

  it('returns SMS for empty string', () => {
    expect(getRecommendedSmsType('')).toBe('SMS');
  });
});

describe('normalizePhoneNumber', () => {
  it('removes hyphens from phone number', () => {
    expect(normalizePhoneNumber('010-1234-5678')).toBe('01012345678');
  });

  it('removes spaces and other non-numeric characters', () => {
    expect(normalizePhoneNumber('010 1234 5678')).toBe('01012345678');
    expect(normalizePhoneNumber('+82-10-1234-5678')).toBe('821012345678');
  });

  it('returns same string if already normalized', () => {
    expect(normalizePhoneNumber('01012345678')).toBe('01012345678');
  });

  it('handles empty string', () => {
    expect(normalizePhoneNumber('')).toBe('');
  });

  it('removes parentheses and dots', () => {
    expect(normalizePhoneNumber('(010)1234.5678')).toBe('01012345678');
  });
});

describe('formatPhoneNumber', () => {
  it('formats 11-digit number as 010-1234-5678', () => {
    expect(formatPhoneNumber('01012345678')).toBe('010-1234-5678');
  });

  it('formats 10-digit number as 010-123-4567', () => {
    expect(formatPhoneNumber('0101234567')).toBe('010-123-4567');
  });

  it('returns original string for other lengths', () => {
    expect(formatPhoneNumber('123')).toBe('123');
    expect(formatPhoneNumber('012345678901234')).toBe('012345678901234');
  });

  it('handles already-formatted input by normalizing first', () => {
    expect(formatPhoneNumber('010-1234-5678')).toBe('010-1234-5678');
  });

  it('handles empty string', () => {
    expect(formatPhoneNumber('')).toBe('');
  });
});

// ============================================================================
// useSms Hook Tests
// ============================================================================

describe('useSms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useSms());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('returns all expected action functions', () => {
      const { result } = renderHook(() => useSms());

      expect(typeof result.current.sendSms).toBe('function');
      expect(typeof result.current.sendMassSms).toBe('function');
      expect(typeof result.current.getHistory).toBe('function');
      expect(typeof result.current.getDetail).toBe('function');
      expect(typeof result.current.getRemain).toBe('function');
      expect(typeof result.current.cancelScheduled).toBe('function');
    });

    it('returns utility functions', () => {
      const { result } = renderHook(() => useSms());

      expect(typeof result.current.calculateSmsBytes).toBe('function');
      expect(typeof result.current.getRecommendedSmsType).toBe('function');
      expect(typeof result.current.normalizePhoneNumber).toBe('function');
      expect(typeof result.current.formatPhoneNumber).toBe('function');
    });
  });

  describe('sendSms', () => {
    it('sends SMS successfully and returns result', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: {
            result_code: 1,
            message: 'success',
            msg_id: 12345,
            success_cnt: 1,
            error_cnt: 0,
            msg_type: '1',
          },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      const request: SmsSendRequest = {
        receiver: '01012345678',
        msg: 'Test message',
      };

      let sendResult: Awaited<ReturnType<typeof result.current.sendSms>>;
      await act(async () => {
        sendResult = await result.current.sendSms(request);
      });

      expect(sendResult!.success).toBe(true);
      expect(sendResult!.msgId).toBe(12345);
      expect(sendResult!.successCount).toBe(1);
      expect(sendResult!.errorCount).toBe(0);
      expect(sendResult!.messageType).toBe('SMS');
      expect(sendResult!.testMode).toBe(false);
    });

    it('calls supabase.functions.invoke with correct parameters', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', success_cnt: 1, error_cnt: 0, msg_type: '1' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      const request: SmsSendRequest = {
        receiver: '01012345678',
        msg: 'Hello!',
        msg_type: 'SMS',
      };

      await act(async () => {
        await result.current.sendSms(request);
      });

      expect(mockInvoke).toHaveBeenCalledWith('sms-send-aligo', {
        body: {
          action: 'send',
          receiver: '01012345678',
          msg: 'Hello!',
          msg_type: 'SMS',
        },
      });
    });

    it('detects LMS message type from response', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', success_cnt: 1, error_cnt: 0, msg_type: '2' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let sendResult: Awaited<ReturnType<typeof result.current.sendSms>>;
      await act(async () => {
        sendResult = await result.current.sendSms({ receiver: '01011112222', msg: 'Long message' });
      });

      expect(sendResult!.messageType).toBe('LMS');
    });

    it('detects MMS message type from response', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', success_cnt: 1, error_cnt: 0, msg_type: '3' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let sendResult: Awaited<ReturnType<typeof result.current.sendSms>>;
      await act(async () => {
        sendResult = await result.current.sendSms({ receiver: '01011112222', msg: 'MMS test' });
      });

      expect(sendResult!.messageType).toBe('MMS');
    });

    it('handles Edge Function error response', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge Function timeout' },
      });

      const { result } = renderHook(() => useSms());

      let sendResult: Awaited<ReturnType<typeof result.current.sendSms>>;
      await act(async () => {
        sendResult = await result.current.sendSms({ receiver: '01011112222', msg: 'test' });
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.successCount).toBe(0);
      expect(sendResult!.errorCount).toBe(1);
      expect(sendResult!.errorMessage).toBe('Edge Function timeout');
      expect(sendResult!.testMode).toBe(true);
      expect(result.current.error).toBe('Edge Function timeout');
    });

    it('handles API returning success:false', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: false,
          test_mode: true,
          error: 'Invalid receiver number',
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let sendResult: Awaited<ReturnType<typeof result.current.sendSms>>;
      await act(async () => {
        sendResult = await result.current.sendSms({ receiver: 'invalid', msg: 'test' });
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.errorMessage).toBe('Invalid receiver number');
    });

    it('handles thrown error during invoke', async () => {
      mockInvoke.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useSms());

      let sendResult: Awaited<ReturnType<typeof result.current.sendSms>>;
      await act(async () => {
        sendResult = await result.current.sendSms({ receiver: '01011112222', msg: 'test' });
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.errorMessage).toBe('Network failure');
      expect(result.current.error).toBe('Network failure');
    });

    it('handles non-Error thrown value', async () => {
      mockInvoke.mockRejectedValue('raw string error');

      const { result } = renderHook(() => useSms());

      let sendResult: Awaited<ReturnType<typeof result.current.sendSms>>;
      await act(async () => {
        sendResult = await result.current.sendSms({ receiver: '01011112222', msg: 'test' });
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.errorMessage).toContain('알 수 없는 오류');
    });

    it('sets isLoading during send and clears after', async () => {
      let resolvePromise: ((value: unknown) => void) | undefined;
      mockInvoke.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result } = renderHook(() => useSms());

      expect(result.current.isLoading).toBe(false);

      let promise: ReturnType<typeof result.current.sendSms>;
      act(() => {
        promise = result.current.sendSms({ receiver: '01011112222', msg: 'test' });
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolvePromise!({
          data: {
            success: true,
            test_mode: false,
            data: { result_code: 1, message: 'ok', success_cnt: 1, error_cnt: 0, msg_type: '1' },
          },
          error: null,
        });
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('handles zero success_cnt and error_cnt via nullish coalescing', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', msg_id: 1 },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let sendResult: Awaited<ReturnType<typeof result.current.sendSms>>;
      await act(async () => {
        sendResult = await result.current.sendSms({ receiver: '01011112222', msg: 'test' });
      });

      expect(sendResult!.successCount).toBe(0);
      expect(sendResult!.errorCount).toBe(0);
    });
  });

  describe('sendMassSms', () => {
    it('sends mass SMS successfully', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: {
            result_code: 1,
            message: 'success',
            msg_id: 99999,
            success_cnt: 3,
            error_cnt: 0,
            msg_type: '1',
          },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      const request: SmsSendMassRequest = {
        messages: [
          { receiver: '01011111111', msg: 'Message 1' },
          { receiver: '01022222222', msg: 'Message 2' },
          { receiver: '01033333333', msg: 'Message 3' },
        ],
        msg_type: 'SMS',
      };

      let sendResult: Awaited<ReturnType<typeof result.current.sendMassSms>>;
      await act(async () => {
        sendResult = await result.current.sendMassSms(request);
      });

      expect(sendResult!.success).toBe(true);
      expect(sendResult!.msgId).toBe(99999);
      expect(sendResult!.successCount).toBe(3);
      expect(sendResult!.errorCount).toBe(0);
    });

    it('calls invoke with send_mass action', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', success_cnt: 2, error_cnt: 0, msg_type: '1' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      const request: SmsSendMassRequest = {
        messages: [
          { receiver: '01011111111', msg: 'Msg A' },
          { receiver: '01022222222', msg: 'Msg B' },
        ],
        msg_type: 'LMS',
        title: 'Bulk Title',
      };

      await act(async () => {
        await result.current.sendMassSms(request);
      });

      expect(mockInvoke).toHaveBeenCalledWith('sms-send-aligo', {
        body: {
          action: 'send_mass',
          messages: request.messages,
          msg_type: 'LMS',
          title: 'Bulk Title',
        },
      });
    });

    it('returns error count matching message count on failure', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: false,
          test_mode: true,
          error: 'Quota exceeded',
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      const request: SmsSendMassRequest = {
        messages: [
          { receiver: '01011111111', msg: 'Msg 1' },
          { receiver: '01022222222', msg: 'Msg 2' },
        ],
        msg_type: 'SMS',
      };

      let sendResult: Awaited<ReturnType<typeof result.current.sendMassSms>>;
      await act(async () => {
        sendResult = await result.current.sendMassSms(request);
      });

      expect(sendResult!.success).toBe(false);
      expect(sendResult!.errorCount).toBe(2); // matches messages.length
    });
  });

  describe('getHistory', () => {
    it('fetches history successfully', async () => {
      const mockList = [
        {
          mid: '100',
          type: 'SMS',
          sender: '01012345678',
          sms_count: '5',
          reserve_state: '0',
          msg: 'Test',
          fail_count: '0',
          reg_date: '2026-03-06',
          reserve: '',
        },
      ];

      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', list: mockList, next_yn: 'N' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let historyResult: Awaited<ReturnType<typeof result.current.getHistory>>;
      await act(async () => {
        historyResult = await result.current.getHistory();
      });

      expect(historyResult!.list).toHaveLength(1);
      expect(historyResult!.list[0].mid).toBe('100');
      expect(historyResult!.hasNext).toBe(false);
    });

    it('sends request parameters correctly', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', list: [], next_yn: 'N' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      const request: SmsListRequest = {
        page: 2,
        page_size: 20,
        start_date: '20260301',
      };

      await act(async () => {
        await result.current.getHistory(request);
      });

      expect(mockInvoke).toHaveBeenCalledWith('sms-send-aligo', {
        body: {
          action: 'list',
          page: 2,
          page_size: 20,
          start_date: '20260301',
        },
      });
    });

    it('returns hasNext=true when next_yn is Y', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', list: [], next_yn: 'Y' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let historyResult: Awaited<ReturnType<typeof result.current.getHistory>>;
      await act(async () => {
        historyResult = await result.current.getHistory();
      });

      expect(historyResult!.hasNext).toBe(true);
    });

    it('returns empty list on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Fetch failed' },
      });

      const { result } = renderHook(() => useSms());

      let historyResult: Awaited<ReturnType<typeof result.current.getHistory>>;
      await act(async () => {
        historyResult = await result.current.getHistory();
      });

      expect(historyResult!.list).toEqual([]);
      expect(historyResult!.hasNext).toBe(false);
    });

    it('uses empty object when no request provided', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', list: [], next_yn: 'N' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      await act(async () => {
        await result.current.getHistory();
      });

      expect(mockInvoke).toHaveBeenCalledWith('sms-send-aligo', {
        body: { action: 'list' },
      });
    });
  });

  describe('getDetail', () => {
    it('fetches detail successfully', async () => {
      const mockDetailList = [
        {
          mdid: 'D001',
          type: 'SMS',
          sender: '01012345678',
          receiver: '01098765432',
          sms_state: '2',
          reg_date: '2026-03-06 10:00:00',
          send_date: '2026-03-06 10:01:00',
          reserve_date: '',
        },
      ];

      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', list: mockDetailList, next_yn: 'N' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let detailResult: Awaited<ReturnType<typeof result.current.getDetail>>;
      await act(async () => {
        detailResult = await result.current.getDetail(100);
      });

      expect(detailResult!.list).toHaveLength(1);
      expect(detailResult!.list[0].mdid).toBe('D001');
      expect(detailResult!.hasNext).toBe(false);
    });

    it('passes mid, page, and pageSize parameters', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', list: [], next_yn: 'N' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      await act(async () => {
        await result.current.getDetail(200, 3, 50);
      });

      expect(mockInvoke).toHaveBeenCalledWith('sms-send-aligo', {
        body: {
          action: 'sms_list',
          mid: 200,
          page: 3,
          page_size: 50,
        },
      });
    });

    it('returns empty list on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Detail fetch failed' },
      });

      const { result } = renderHook(() => useSms());

      let detailResult: Awaited<ReturnType<typeof result.current.getDetail>>;
      await act(async () => {
        detailResult = await result.current.getDetail(999);
      });

      expect(detailResult!.list).toEqual([]);
      expect(detailResult!.hasNext).toBe(false);
    });
  });

  describe('getRemain', () => {
    it('fetches remain info successfully', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: {
            result_code: 1,
            message: 'ok',
            SMS_CNT: 1000,
            LMS_CNT: 500,
            MMS_CNT: 200,
          },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let remainResult: Awaited<ReturnType<typeof result.current.getRemain>>;
      await act(async () => {
        remainResult = await result.current.getRemain();
      });

      expect(remainResult).toEqual({
        SMS_CNT: 1000,
        LMS_CNT: 500,
        MMS_CNT: 200,
      });
    });

    it('calls invoke with remain action and empty params', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', SMS_CNT: 0, LMS_CNT: 0, MMS_CNT: 0 },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      await act(async () => {
        await result.current.getRemain();
      });

      expect(mockInvoke).toHaveBeenCalledWith('sms-send-aligo', {
        body: { action: 'remain' },
      });
    });

    it('returns null on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Remain fetch failed' },
      });

      const { result } = renderHook(() => useSms());

      let remainResult: Awaited<ReturnType<typeof result.current.getRemain>>;
      await act(async () => {
        remainResult = await result.current.getRemain();
      });

      expect(remainResult!).toBeNull();
    });
  });

  describe('cancelScheduled', () => {
    it('cancels scheduled message successfully', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: {
            result_code: 1,
            message: 'ok',
            cancel_date: '2026-03-06 10:30:00',
          },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      let cancelResult: Awaited<ReturnType<typeof result.current.cancelScheduled>>;
      await act(async () => {
        cancelResult = await result.current.cancelScheduled(12345);
      });

      expect(cancelResult!.success).toBe(true);
      expect(cancelResult!.cancelDate).toBe('2026-03-06 10:30:00');
    });

    it('calls invoke with cancel action and mid', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok' },
        },
        error: null,
      });

      const { result } = renderHook(() => useSms());

      await act(async () => {
        await result.current.cancelScheduled(54321);
      });

      expect(mockInvoke).toHaveBeenCalledWith('sms-send-aligo', {
        body: {
          action: 'cancel',
          mid: 54321,
        },
      });
    });

    it('returns failure on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Cannot cancel - already processed' },
      });

      const { result } = renderHook(() => useSms());

      let cancelResult: Awaited<ReturnType<typeof result.current.cancelScheduled>>;
      await act(async () => {
        cancelResult = await result.current.cancelScheduled(99999);
      });

      expect(cancelResult!.success).toBe(false);
      expect(cancelResult!.error).toBe('Cannot cancel - already processed');
    });
  });

  describe('error state management', () => {
    it('clears error on new request', async () => {
      // First call fails
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'First failure' },
      });

      const { result } = renderHook(() => useSms());

      await act(async () => {
        await result.current.sendSms({ receiver: '01011112222', msg: 'test' });
      });

      expect(result.current.error).toBe('First failure');

      // Second call succeeds
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          test_mode: false,
          data: { result_code: 1, message: 'ok', success_cnt: 1, error_cnt: 0, msg_type: '1' },
        },
        error: null,
      });

      await act(async () => {
        await result.current.sendSms({ receiver: '01011112222', msg: 'test 2' });
      });

      expect(result.current.error).toBeNull();
    });
  });
});
