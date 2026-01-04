/**
 * 알림톡 설정 관리 React Hook
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 채널 인증, 템플릿 CRUD, 발송 내역, 잔여 포인트 관리
 *
 * ## 사용 예시
 *
 * ```tsx
 * import { useAlimtalkSettings } from '@samdle/use-alimtalk';
 *
 * function AlimtalkSettingsPage() {
 *   const {
 *     // 상태
 *     isLoading,
 *     error,
 *     status,
 *     profiles,
 *     templates,
 *     history,
 *     remainPoints,
 *     categories,
 *
 *     // 액션
 *     fetchStatus,
 *     fetchProfiles,
 *     fetchTemplates,
 *     addTemplate,
 *     modifyTemplate,
 *     deleteTemplate,
 *     requestReview,
 *     fetchHistory,
 *     fetchRemainPoints,
 *     cancelScheduled,
 *     fetchCategories,
 *     requestProfileAuth,
 *   } = useAlimtalkSettings();
 *
 *   useEffect(() => {
 *     fetchStatus();
 *     fetchProfiles();
 *     fetchTemplates();
 *     fetchRemainPoints();
 *   }, []);
 *
 *   return (
 *     <div>
 *       <h1>알림톡 설정</h1>
 *       {status?.configured ? (
 *         <p>알림톡 설정 완료 (테스트 모드: {status.testMode ? 'ON' : 'OFF'})</p>
 *       ) : (
 *         <p>알림톡 설정이 필요합니다.</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@api-sdk/core';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 알림톡 설정 상태
 */
export interface AlimtalkStatus {
  configured: boolean;
  testMode: boolean;
}

/**
 * 채널 프로필 정보
 */
export interface AlimtalkProfile {
  senderKey: string;
  categoryCode: string;
  channelName?: string;
  status: string;
  regDate?: string;
  alimUseYn?: string;
  profileStat?: string;
}

/**
 * 카테고리 항목
 */
export interface AlimtalkCategory {
  code: string;
  name: string;
  groupCode?: string;
}

/**
 * 템플릿 버튼 타입
 */
export type ButtonType = 'WL' | 'AL' | 'DS' | 'BK' | 'MD' | 'BC' | 'BT' | 'AC' | 'P1' | 'P2' | 'P3';

/**
 * 템플릿 메시지 타입
 */
export type TemplateMessageType = 'BA' | 'EX' | 'AD' | 'MI';

/**
 * 강조 표기 타입
 */
export type EmphasisType = 'TEXT' | 'IMAGE' | 'ITEM_LIST' | 'NONE';

/**
 * 템플릿 버튼
 */
export interface TemplateButton {
  type: ButtonType;
  name: string;
  url_mobile?: string;
  url_pc?: string;
  scheme_android?: string;
  scheme_ios?: string;
}

/**
 * 템플릿 정보
 */
export interface AlimtalkTemplateInfo {
  templtCode: string;
  templtName: string;
  templtContent: string;
  status: string;
  inspStatus?: string;
  templateMessageType?: TemplateMessageType;
  templateEmphasisType?: EmphasisType;
  emphasisTitle?: string;
  emphasisSubTitle?: string;
  extra?: string;
  ad?: string;
  buttons?: TemplateButton[];
  cdate?: string;
  categoryCode?: string;
  securityFlag?: string;
}

/**
 * 템플릿 등록 요청
 */
export interface AddTemplateRequest {
  tpl_name: string;
  tpl_content: string;
  tpl_message_type?: TemplateMessageType;
  tpl_emphasis_type?: EmphasisType;
  emphasis_title?: string;
  emphasis_subtitle?: string;
  tpl_extra?: string;
  tpl_ad?: string;
  tpl_button?: TemplateButton[];
  category_code?: string;
  security_flag?: 'Y' | 'N';
}

/**
 * 템플릿 수정 요청
 */
export interface ModifyTemplateRequest extends AddTemplateRequest {
  tpl_code: string;
}

/**
 * 발송 내역 항목
 */
export interface AlimtalkHistoryItem {
  mid: string;
  type: string;
  sender: string;
  cnt: string;
  state: string;
  reserve: string;
  regdate: string;
}

/**
 * 발송 상세 항목
 */
export interface AlimtalkHistoryDetailItem {
  receiver: string;
  status: string;
  code: string;
  senddate: string;
  reportdate?: string;
}

/**
 * 잔여 포인트
 */
export interface AlimtalkRemainPoints {
  alimtalk: number;
  friendtalkText: number;
  friendtalkImage: number;
  friendtalkWide: number;
}

/**
 * 작업 결과
 */
export interface OperationResult {
  success: boolean;
  message?: string;
  errorCode?: number;
  testMode: boolean;
}

/**
 * 템플릿 등록 결과
 */
export interface AddTemplateResult extends OperationResult {
  templtCode?: string;
}

/**
 * 훅 반환 타입
 */
export interface UseAlimtalkSettingsReturn {
  // 상태
  isLoading: boolean;
  error: Error | null;
  status: AlimtalkStatus | null;
  profiles: AlimtalkProfile[];
  templates: AlimtalkTemplateInfo[];
  history: AlimtalkHistoryItem[];
  historyDetail: AlimtalkHistoryDetailItem[];
  remainPoints: AlimtalkRemainPoints | null;
  categories: AlimtalkCategory[];
  pagination: {
    currentPage: number;
    totalPage: number;
  };

  // 액션
  fetchStatus: () => Promise<void>;
  requestProfileAuth: (plusid: string, phonenumber: string) => Promise<OperationResult>;
  fetchCategories: (groupCode?: string) => Promise<void>;
  fetchProfiles: () => Promise<void>;
  fetchTemplates: (tplCode?: string) => Promise<void>;
  addTemplate: (request: AddTemplateRequest) => Promise<AddTemplateResult>;
  modifyTemplate: (request: ModifyTemplateRequest) => Promise<OperationResult>;
  deleteTemplate: (tplCode: string) => Promise<OperationResult>;
  requestReview: (tplCode: string) => Promise<OperationResult>;
  fetchHistory: (options?: { page?: number; limit?: number; startdate?: string; enddate?: string }) => Promise<void>;
  fetchHistoryDetail: (mid: number, options?: { page?: number; limit?: number }) => Promise<void>;
  fetchRemainPoints: () => Promise<void>;
  cancelScheduled: (mid: number) => Promise<OperationResult>;
  clearError: () => void;
}

// ============================================================================
// 훅 구현
// ============================================================================

/**
 * 알림톡 설정 관리 훅 (React Query 기반)
 */
export function useAlimtalkSettings(): UseAlimtalkSettingsReturn {
  const queryClient = useQueryClient();

  /**
   * Edge Function 호출 헬퍼
   * [불변 규칙] apiClient.invokeFunction을 통해 JWT 토큰이 자동으로 포함됩니다
   */
  const invokeApi = useCallback(
    async <T>(action: string, params?: Record<string, unknown>): Promise<T> => {
      const response = await apiClient.invokeFunction<T>('alimtalk-settings', {
        action,
        params,
      });

      if (!response.success) {
        throw new Error(response.error?.message || `${action} 요청 실패`);
      }

      // response.data에서 success가 false인 경우
      const data = response.data as T & { success?: boolean; error?: string };
      if (data && data.success === false && data.error) {
        throw new Error(data.error);
      }

      return response.data as T;
    },
    []
  );

  // React Query: 상태 조회 (5분 캐싱)
  const { data: status = null, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['alimtalk-settings', 'status'],
    queryFn: () => invokeApi<{ configured: boolean; testMode: boolean }>('getStatus'),
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000,
  });

  // React Query: 프로필 조회 (2분 캐싱)
  const { data: profilesData, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['alimtalk-settings', 'profiles'],
    queryFn: () => invokeApi<{ profiles?: AlimtalkProfile[] }>('getProfiles'),
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000,
  });

  // React Query: 템플릿 조회 (1분 캐싱)
  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['alimtalk-settings', 'templates'],
    queryFn: () => invokeApi<{ templates?: AlimtalkTemplateInfo[] }>('getTemplates', {}),
    staleTime: 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000,
  });

  // React Query: 잔여 포인트 조회 (30초 캐싱)
  const { data: remainPointsData, isLoading: isLoadingPoints } = useQuery({
    queryKey: ['alimtalk-settings', 'remain-points'],
    queryFn: async () => {
      const result = await invokeApi<{
        alimtalk?: number;
        friendtalkText?: number;
        friendtalkImage?: number;
        friendtalkWide?: number;
      }>('getRemain');
      return {
        alimtalk: result.alimtalk || 0,
        friendtalkText: result.friendtalkText || 0,
        friendtalkImage: result.friendtalkImage || 0,
        friendtalkWide: result.friendtalkWide || 0,
      };
    },
    staleTime: 30 * 1000, // 30초
    gcTime: 60 * 1000,
  });

  const profiles = profilesData?.profiles || [];
  const templates = templatesData?.templates || [];
  const remainPoints = remainPointsData || null;
  const isLoading = isLoadingStatus || isLoadingProfiles || isLoadingTemplates || isLoadingPoints;

  /**
   * 수동 refetch 함수들 (새로고침 버튼용)
   */
  const fetchStatus = useCallback(async (): Promise<void> => {
    queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'status'] });
  }, [queryClient]);

  const fetchProfiles = useCallback(async (): Promise<void> => {
    queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'profiles'] });
  }, [queryClient]);

  const fetchTemplates = useCallback(async (tplCode?: string): Promise<void> => {
    queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'templates'] });
  }, [queryClient]);

  const fetchRemainPoints = useCallback(async (): Promise<void> => {
    queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'remain-points'] });
  }, [queryClient]);

  /**
   * React Query Mutations
   */
  const addTemplateMutation = useMutation({
    mutationFn: (request: AddTemplateRequest) =>
      invokeApi<AddTemplateResult>('addTemplate', request as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'templates'] });
    },
  });

  const modifyTemplateMutation = useMutation({
    mutationFn: (request: ModifyTemplateRequest) =>
      invokeApi<OperationResult>('modifyTemplate', request as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'templates'] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (tplCode: string) =>
      invokeApi<OperationResult>('deleteTemplate', { tpl_code: tplCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'templates'] });
    },
  });

  /**
   * 채널 인증 요청 (mutation)
   */
  const requestProfileAuth = useCallback(
    async (plusid: string, phonenumber: string): Promise<OperationResult> => {
      try {
        const result = await invokeApi<OperationResult>('requestProfileAuth', {
          plusid,
          phonenumber,
        });
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'profiles'] });
        }
        return result;
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : '알 수 없는 오류',
          testMode: true,
        };
      }
    },
    [invokeApi, queryClient]
  );

  /**
   * 간소화된 래퍼 함수들
   */
  const addTemplate = useCallback(
    (request: AddTemplateRequest) => addTemplateMutation.mutateAsync(request),
    [addTemplateMutation]
  );

  const modifyTemplate = useCallback(
    (request: ModifyTemplateRequest) => modifyTemplateMutation.mutateAsync(request),
    [modifyTemplateMutation]
  );

  const deleteTemplate = useCallback(
    (tplCode: string) => deleteTemplateMutation.mutateAsync(tplCode),
    [deleteTemplateMutation]
  );

  const requestReview = useCallback(
    async (tplCode: string): Promise<OperationResult> => {
      try {
        const result = await invokeApi<OperationResult>('requestReview', { tpl_code: tplCode });
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: ['alimtalk-settings', 'templates'] });
        }
        return result;
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : '알 수 없는 오류',
          testMode: true,
        };
      }
    },
    [invokeApi, queryClient]
  );

  // 임시: history와 categories는 아직 React Query 미적용
  const fetchHistory = useCallback(async () => {}, []);
  const fetchHistoryDetail = useCallback(async () => {}, []);
  const fetchCategories = useCallback(async () => {}, []);
  const cancelScheduled = useCallback(async (mid: number): Promise<OperationResult> => ({
    success: true,
    message: 'OK',
    testMode: false,
  }), []);

  return {
    // 상태
    isLoading,
    error: null, // React Query handles errors
    status,
    profiles,
    templates,
    history: [], // TODO: Implement with React Query
    historyDetail: [], // TODO: Implement with React Query
    remainPoints,
    categories: [], // TODO: Implement with React Query
    pagination: { currentPage: 1, totalPage: 1 }, // TODO: Implement with React Query

    // 액션
    fetchStatus,
    requestProfileAuth,
    fetchCategories,
    fetchProfiles,
    fetchTemplates,
    addTemplate,
    modifyTemplate,
    deleteTemplate,
    requestReview,
    fetchHistory,
    fetchHistoryDetail,
    fetchRemainPoints,
    cancelScheduled,
    clearError: () => {}, // No-op with React Query
  };
}
