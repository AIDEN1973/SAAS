/**
 * 알림톡 발송 React Hook
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 알림톡 기본, SMS 폴백 지원
 *
 * ## 사용 예시
 *
 * ```tsx
 * import { useAlimtalk } from '@samdle/use-alimtalk';
 *
 * function NotificationPanel() {
 *   const {
 *     sendAlimtalk,
 *     fetchTemplates,
 *     templates,
 *     isLoading,
 *     error,
 *   } = useAlimtalk();
 *
 *   useEffect(() => {
 *     fetchTemplates();
 *   }, []);
 *
 *   const handleSend = async () => {
 *     const result = await sendAlimtalk({
 *       templateCode: 'WELCOME_MSG',
 *       recipients: [
 *         { phone: '01012345678', name: '홍길동', variables: { 고객명: '홍길동' } },
 *       ],
 *       useFallback: true,
 *     });
 *
 *     if (result.success) {
 *       console.log('발송 성공:', result.usedChannel);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <select>
 *         {templates.map(t => (
 *           <option key={t.code} value={t.code}>{t.name}</option>
 *         ))}
 *       </select>
 *       <button onClick={handleSend} disabled={isLoading}>
 *         {isLoading ? '발송 중...' : '알림톡 발송'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@api-sdk/core';
import type {
  UseAlimtalkReturn,
  AlimtalkTemplate,
  RemainPoints,
  SendAlimtalkRequest,
  SendResult,
  SendHistory,
} from './types';

/**
 * 알림톡 발송 훅
 * [불변 규칙] apiClient.invokeFunction을 통해 JWT 토큰이 자동으로 포함됩니다
 */
export function useAlimtalk(): UseAlimtalkReturn {

  // 상태
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [templates, setTemplates] = useState<AlimtalkTemplate[]>([]);
  const [remainPoints, setRemainPoints] = useState<RemainPoints | null>(null);

  /**
   * 알림톡 발송
   */
  const sendAlimtalk = useCallback(
    async (request: SendAlimtalkRequest): Promise<SendResult> => {
      setIsLoading(true);
      setError(null);

      try {
        // Edge Function 호출 (apiClient 사용)
        const response = await apiClient.invokeFunction<{
          success: boolean;
          used_channel?: string;
          used_fallback?: boolean;
          success_count?: number;
          error_count?: number;
          mid?: string;
          error_message?: string;
          test_mode?: boolean;
        }>('alimtalk-send', {
          template_code: request.templateCode,
          recipients: request.recipients.map((r) => ({
            receiver: r.phone,
            recvname: r.name,
            variables: r.variables,
          })),
          use_fallback: request.useFallback ?? true,
          fallback_message: request.fallbackMessage,
          scheduled_at: request.scheduledAt,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || '알림톡 발송에 실패했습니다.');
        }

        const data = response.data;
        return {
          success: data.success,
          usedChannel: (data.used_channel || 'alimtalk') as 'alimtalk' | 'sms' | 'none',
          usedFallback: data.used_fallback || false,
          successCount: data.success_count || 0,
          errorCount: data.error_count || 0,
          messageId: data.mid,
          errorMessage: data.error_message,
          testMode: data.test_mode || false,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('알 수 없는 오류');
        setError(error);
        return {
          success: false,
          usedChannel: 'none',
          usedFallback: false,
          successCount: 0,
          errorCount: request.recipients.length,
          errorMessage: error.message,
          testMode: true,
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * 템플릿 목록 조회
   */
  const fetchTemplates = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.invokeFunction<{
        list?: Array<{
          templtCode: string;
          templtName: string;
          templtContent: string;
          status: string;
          templateMessageType?: string;
          templateEmphasisType?: string;
          buttons?: Array<{
            type: string;
            name: string;
            url_mobile?: string;
            url_pc?: string;
          }>;
        }>;
      }>('alimtalk-templates', { action: 'list' });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || '템플릿 조회에 실패했습니다.');
      }

      const templateList: AlimtalkTemplate[] = (response.data.list || []).map((t) => ({
        code: t.templtCode,
        name: t.templtName,
        content: t.templtContent,
        status: t.status,
        messageType: t.templateMessageType,
        emphasisType: t.templateEmphasisType,
        buttons: t.buttons?.map((b) => ({
          type: b.type,
          name: b.name,
          urlMobile: b.url_mobile,
          urlPc: b.url_pc,
        })),
      }));

      setTemplates(templateList);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('알 수 없는 오류');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 발송 내역 조회
   */
  const fetchHistory = useCallback(
    async (options?: { page?: number; limit?: number }): Promise<SendHistory[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.invokeFunction<{
          list?: Array<{
            mid: string;
            type: string;
            sender: string;
            cnt: string;
            state: string;
            reserve: string;
            regdate: string;
          }>;
        }>('alimtalk-history', {
          page: options?.page ?? 1,
          limit: options?.limit ?? 30,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || '발송 내역 조회에 실패했습니다.');
        }

        return (response.data.list || []).map((h) => ({
          mid: h.mid,
          type: h.type,
          sender: h.sender,
          count: parseInt(h.cnt, 10) || 0,
          status: h.state,
          reserveDate: h.reserve,
          createdAt: h.regdate,
        }));
      } catch (err) {
        const error = err instanceof Error ? err : new Error('알 수 없는 오류');
        setError(error);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * 잔여 포인트 조회
   */
  const fetchRemainPoints = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.invokeFunction<{
        AT_CNT?: number;
        FT_CNT?: number;
        FI_CNT?: number;
        FW_CNT?: number;
      }>('alimtalk-remain', {});

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || '잔여 포인트 조회에 실패했습니다.');
      }

      setRemainPoints({
        alimtalk: response.data.AT_CNT || 0,
        friendtalkText: response.data.FT_CNT || 0,
        friendtalkImage: response.data.FI_CNT || 0,
        friendtalkWide: response.data.FW_CNT || 0,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('알 수 없는 오류');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 예약 발송 취소
   */
  const cancelScheduled = useCallback(
    async (mid: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.invokeFunction<{ success?: boolean }>(
          'alimtalk-cancel',
          { mid: parseInt(mid, 10) }
        );

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || '예약 취소에 실패했습니다.');
        }

        return response.data.success || false;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('알 수 없는 오류');
        setError(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    // 상태
    isLoading,
    error,
    templates,
    remainPoints,

    // 액션
    sendAlimtalk,
    fetchTemplates,
    fetchHistory,
    fetchRemainPoints,
    cancelScheduled,
  };
}
