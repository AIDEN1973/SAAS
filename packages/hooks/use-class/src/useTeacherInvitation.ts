/**
 * useTeacherInvitation Hook
 *
 * 강사 초대 링크 관리 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [업종중립] 강사/트레이너 초대 기능
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import type {
  TeacherPosition,
  TeacherInvitation,
  CreateTeacherInvitationInput,
  ValidateTeacherInvitationResult,
  SelfRegisterTeacherInput,
} from '@services/class-service';

/**
 * 초대 링크 생성 Hook
 * [권한] admin, owner, sub_admin만 사용 가능
 */
export function useCreateTeacherInvitation() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: CreateTeacherInvitationInput) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // DB RPC 함수 호출
      const response = await apiClient.callRPC<{
        success: boolean;
        invitation_id?: string;
        token?: string;
        expires_at?: string;
        error?: string;
      }>('create_teacher_invitation', {
        p_tenant_id: tenantId,
        p_position: input.position,
        p_created_by: session?.user?.id,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || '초대 링크 생성에 실패했습니다.');
      }

      // 초대 URL 생성 (public-gateway 도메인 사용)
      // [불변 규칙] 환경변수로 public-gateway URL 설정, 없으면 현재 origin의 포트만 변경
      const publicGatewayUrl = import.meta.env.VITE_PUBLIC_GATEWAY_URL ||
        window.location.origin.replace(/:3000\/?$/, ':3003');
      const inviteUrl = `${publicGatewayUrl}/teacher-register?token=${response.data.token}`;

      return {
        invitation_id: response.data.invitation_id,
        token: response.data.token,
        expires_at: response.data.expires_at,
        invite_url: inviteUrl,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-invitations', tenantId] });
    },
  });
}

/**
 * 초대 토큰 검증 Hook
 * [공개] 인증 없이 사용 가능
 */
export function useValidateTeacherInvitation(token: string | null) {
  return useQuery<ValidateTeacherInvitationResult>({
    queryKey: ['teacher-invitation', token],
    queryFn: async () => {
      if (!token) {
        return { is_valid: false, error: '토큰이 없습니다.' };
      }

      // DB RPC 함수 호출
      const response = await apiClient.callRPC<{
        valid: boolean;
        invitation_id?: string;
        tenant_id?: string;
        tenant_name?: string;
        position?: TeacherPosition;
        expires_at?: string;
        error?: string;
      }>('validate_teacher_invitation', {
        p_token: token,
      });

      if (response.error) {
        return { is_valid: false, error: response.error.message };
      }

      if (!response.data?.valid) {
        return { is_valid: false, error: response.data?.error || '유효하지 않은 초대 링크입니다.' };
      }

      return {
        id: response.data.invitation_id,
        tenant_id: response.data.tenant_id,
        tenant_name: response.data.tenant_name,
        position: response.data.position,
        expires_at: response.data.expires_at,
        is_valid: true,
      };
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });
}

/**
 * 강사 자체 등록 Hook
 * [공개] 초대 토큰으로 인증
 * [변경] teachers 테이블에 직접 삽입하지 않고, teacher_registration_requests에 저장
 *       관리자 승인 시 실제 teachers + auth.users 생성
 */
export function useSelfRegisterTeacher() {
  return useMutation({
    mutationFn: async (input: SelfRegisterTeacherInput) => {
      // submit_teacher_registration RPC 호출
      // - 중복 체크 (login_id, phone)
      // - teacher_registration_requests 테이블에 대기 상태로 저장
      // - 초대 링크 사용 처리
      const response = await apiClient.callRPC<{
        success: boolean;
        request_id?: string;
        message?: string;
        error?: string;
      }>('submit_teacher_registration', {
        p_token: input.token,
        p_name: input.name,
        p_phone: input.phone,
        p_email: input.email || null,
        p_login_id: input.login_id,
        p_password: input.password,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || '등록 신청에 실패했습니다.');
      }

      return {
        success: true,
        request_id: response.data.request_id,
        message: response.data.message,
      };
    },
  });
}

/**
 * 초대 목록 조회 Hook
 * [권한] admin, owner, sub_admin만 사용 가능
 */
export function useTeacherInvitations() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<TeacherInvitation[]>({
    queryKey: ['teacher-invitations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const response = await apiClient.get<TeacherInvitation>('teacher_invitations', {
        filters: { tenant_id: tenantId },
        orderBy: { column: 'created_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId,
  });
}

/**
 * 가입 신청 승인 Hook
 * [권한] admin, owner, sub_admin만 사용 가능
 * 승인 시 persons + academy_teachers + auth.users 계정 생성
 */
export function useApproveTeacherRegistration() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: { request_id: string }) => {
      // Edge Function 호출
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-teacher-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            request_id: input.request_id,
            approved_by: session?.user?.id,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '승인에 실패했습니다.');
      }

      return result.data;
    },
    onSuccess: () => {
      // [최적화] teachers와 teachers-with-stats 쿼리 모두 invalidate
      void queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['teachers-with-stats', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['teacher-registration-requests', tenantId] });
    },
  });
}

/**
 * 가입 신청 거절 Hook
 * [권한] admin, owner, sub_admin만 사용 가능
 */
export function useRejectTeacherRegistration() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: { request_id: string; reason?: string }) => {
      const response = await apiClient.callRPC<{
        success: boolean;
        message?: string;
        error?: string;
      }>('reject_teacher_registration', {
        p_request_id: input.request_id,
        p_rejected_by: session?.user?.id,
        p_reason: input.reason || null,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || '거절에 실패했습니다.');
      }

      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-registration-requests', tenantId] });
    },
  });
}

/**
 * 대기 중인 가입 신청 목록 조회 Hook
 * [권한] admin, owner, sub_admin만 사용 가능
 */
export function usePendingTeacherRegistrations() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    login_id: string;
    position: TeacherPosition;
    created_at: string;
  }[]>({
    queryKey: ['teacher-registration-requests', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const response = await apiClient.callRPC<{
        id: string;
        name: string;
        phone: string;
        email: string | null;
        login_id: string;
        teacher_position: TeacherPosition;  // RPC에서 position은 예약어라 teacher_position으로 반환
        created_at: string;
      }[]>('get_pending_teacher_registrations', {
        p_tenant_id: tenantId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // teacher_position → position으로 매핑
      return (response.data || []).map(item => ({
        ...item,
        position: item.teacher_position,
      }));
    },
    enabled: !!tenantId,
  });
}

/**
 * [Deprecated] useApproveTeacher
 * 기존 코드 호환성을 위해 유지, useApproveTeacherRegistration 사용 권장
 */
export function useApproveTeacher() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (input: { teacher_id: string; password: string }) => {
      console.warn('[Deprecated] useApproveTeacher는 더 이상 사용되지 않습니다. useApproveTeacherRegistration을 사용하세요.');
      throw new Error('이 기능은 더 이상 사용되지 않습니다. 가입 신청 승인 기능을 사용해주세요.');
    },
    onSuccess: () => {
      // [최적화] teachers와 teachers-with-stats 쿼리 모두 invalidate
      void queryClient.invalidateQueries({ queryKey: ['teachers', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['teachers-with-stats', tenantId] });
    },
  });
}

/**
 * 직급 레이블 매핑
 * [업종중립] 강사/트레이너 직급 표시
 */
export const POSITION_LABELS: Record<TeacherPosition, string> = {
  vice_principal: '부원장',
  manager: '실장',
  teacher: '선생님',
  assistant: '조교',
  other: '기타',
};
