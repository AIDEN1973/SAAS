/**
 * SMS 발송 훅 - 알리고(Aligo) API 연동
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원
 *
 * ## 사용 예시
 *
 * ```tsx
 * import { useSms } from '@samdle/use-sms';
 *
 * function SendSmsButton() {
 *   const { sendSms, sendMassSms, getRemain, isLoading, error } = useSms();
 *
 *   const handleSend = async () => {
 *     const result = await sendSms({
 *       receiver: '01011112222',
 *       msg: '안녕하세요. 테스트 메시지입니다.',
 *     });
 *
 *     if (result.success) {
 *       console.log(`${result.successCount}건 발송 완료`);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleSend} disabled={isLoading}>
 *       SMS 발송
 *     </button>
 *   );
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import type {
  SmsSendRequest,
  SmsSendMassRequest,
  SmsListRequest,
  SmsListItem,
  SmsDetailItem,
  SmsRemainInfo,
  SmsSendResult,
  SmsApiResponse,
} from './types';

const SMS_FUNCTION_NAME = 'sms-send-aligo';

/**
 * SMS 바이트 수 계산 (EUC-KR 기준)
 *
 * 한글: 2바이트, 영문/숫자/특수문자: 1바이트
 */
export function calculateSmsBytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x3131 && code <= 0x318e) ||
      (code >= 0x1100 && code <= 0x11ff)
    ) {
      bytes += 2;
    } else if (code <= 0x7f) {
      bytes += 1;
    } else {
      bytes += 2;
    }
  }
  return bytes;
}

/**
 * SMS/LMS 타입 자동 판별
 */
export function getRecommendedSmsType(msg: string): 'SMS' | 'LMS' {
  const bytes = calculateSmsBytes(msg);
  return bytes > 90 ? 'LMS' : 'SMS';
}

/**
 * 전화번호 정규화 (하이픈 제거)
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 전화번호 포맷팅 (010-1234-5678 형식)
 */
export function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return phone;
}

/**
 * SMS 발송 훅
 */
export function useSms() {
  const supabase = useSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Edge Function 호출 헬퍼
   */
  const callSmsFunction = useCallback(
    async <T>(action: string, params: Record<string, unknown>): Promise<SmsApiResponse<T>> => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fnError } = await supabase.functions.invoke(SMS_FUNCTION_NAME, {
          body: { action, ...params },
        });

        if (fnError) {
          const errorMessage = fnError.message || 'SMS API 호출에 실패했습니다.';
          setError(errorMessage);
          return { success: false, test_mode: true, error: errorMessage };
        }

        return data as SmsApiResponse<T>;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMessage);
        return { success: false, test_mode: true, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  /**
   * SMS 단건/동일 내용 다건 발송
   */
  const sendSms = useCallback(
    async (request: SmsSendRequest): Promise<SmsSendResult> => {
      const response = await callSmsFunction<{
        result_code: number;
        message: string;
        msg_id?: number;
        success_cnt?: number;
        error_cnt?: number;
        msg_type?: string;
      }>('send', request);

      if (!response.success) {
        return {
          success: false,
          successCount: 0,
          errorCount: 1,
          errorMessage: response.error,
          testMode: response.test_mode,
        };
      }

      const data = response.data!;
      return {
        success: true,
        msgId: data.msg_id,
        successCount: data.success_cnt ?? 0,
        errorCount: data.error_cnt ?? 0,
        messageType: data.msg_type === '1' ? 'SMS' : data.msg_type === '2' ? 'LMS' : 'MMS',
        testMode: response.test_mode,
      };
    },
    [callSmsFunction]
  );

  /**
   * SMS 대량 발송 (개별 내용)
   */
  const sendMassSms = useCallback(
    async (request: SmsSendMassRequest): Promise<SmsSendResult> => {
      const response = await callSmsFunction<{
        result_code: number;
        message: string;
        msg_id?: number;
        success_cnt?: number;
        error_cnt?: number;
        msg_type?: string;
      }>('send_mass', request);

      if (!response.success) {
        return {
          success: false,
          successCount: 0,
          errorCount: request.messages.length,
          errorMessage: response.error,
          testMode: response.test_mode,
        };
      }

      const data = response.data!;
      return {
        success: true,
        msgId: data.msg_id,
        successCount: data.success_cnt ?? 0,
        errorCount: data.error_cnt ?? 0,
        messageType: data.msg_type === '1' ? 'SMS' : data.msg_type === '2' ? 'LMS' : 'MMS',
        testMode: response.test_mode,
      };
    },
    [callSmsFunction]
  );

  /**
   * 전송 내역 조회
   */
  const getHistory = useCallback(
    async (request?: SmsListRequest): Promise<{ list: SmsListItem[]; hasNext: boolean }> => {
      const response = await callSmsFunction<{
        result_code: number;
        message: string;
        list?: SmsListItem[];
        next_yn?: string;
      }>('list', request ?? {});

      if (!response.success || !response.data) {
        return { list: [], hasNext: false };
      }

      return {
        list: response.data.list ?? [],
        hasNext: response.data.next_yn === 'Y',
      };
    },
    [callSmsFunction]
  );

  /**
   * 전송 결과 상세 조회
   */
  const getDetail = useCallback(
    async (mid: number, page?: number, pageSize?: number): Promise<{ list: SmsDetailItem[]; hasNext: boolean }> => {
      const response = await callSmsFunction<{
        result_code: number;
        message: string;
        list?: SmsDetailItem[];
        next_yn?: string;
      }>('sms_list', { mid, page, page_size: pageSize });

      if (!response.success || !response.data) {
        return { list: [], hasNext: false };
      }

      return {
        list: response.data.list ?? [],
        hasNext: response.data.next_yn === 'Y',
      };
    },
    [callSmsFunction]
  );

  /**
   * 발송 가능 건수 조회
   */
  const getRemain = useCallback(async (): Promise<SmsRemainInfo | null> => {
    const response = await callSmsFunction<{
      result_code: number;
      message: string;
      SMS_CNT?: number;
      LMS_CNT?: number;
      MMS_CNT?: number;
    }>('remain', {});

    if (!response.success || !response.data) {
      return null;
    }

    return {
      SMS_CNT: response.data.SMS_CNT,
      LMS_CNT: response.data.LMS_CNT,
      MMS_CNT: response.data.MMS_CNT,
    };
  }, [callSmsFunction]);

  /**
   * 예약 문자 취소
   */
  const cancelScheduled = useCallback(
    async (mid: number): Promise<{ success: boolean; cancelDate?: string; error?: string }> => {
      const response = await callSmsFunction<{
        result_code: number;
        message: string;
        cancel_date?: string;
      }>('cancel', { mid });

      if (!response.success) {
        return { success: false, error: response.error };
      }

      return {
        success: true,
        cancelDate: response.data?.cancel_date,
      };
    },
    [callSmsFunction]
  );

  return {
    // 발송 함수
    sendSms,
    sendMassSms,
    // 조회 함수
    getHistory,
    getDetail,
    getRemain,
    // 취소 함수
    cancelScheduled,
    // 상태
    isLoading,
    error,
    // 유틸리티
    calculateSmsBytes,
    getRecommendedSmsType,
    normalizePhoneNumber,
    formatPhoneNumber,
  };
}

export default useSms;
