/**
 * useCurrentTeacherPosition Hook
 *
 * 현재 로그인한 사용자의 강사 직급(position)을 조회하는 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import type { TeacherPosition } from '@services/class-service';

interface AcademyTeacher {
  id: string;
  tenant_id: string;
  person_id: string;
  position: TeacherPosition;
  status: string;
  user_id: string | null;
}

/**
 * 현재 로그인한 사용자의 강사 직급 조회 Hook
 *
 * @returns 강사 직급 (teacher, assistant, vice_principal, manager) 또는 null (강사가 아닌 경우)
 */
export function useCurrentTeacherPosition() {
  const { data: session } = useSession();
  const context = getApiContext();
  const tenantId = context?.tenantId;

  return useQuery<TeacherPosition | null>({
    queryKey: ['current-teacher-position', session?.user?.id, tenantId],
    queryFn: async (): Promise<TeacherPosition | null> => {
      if (!session?.user?.id || !tenantId) {
        return null;
      }

      const response = await apiClient.get<AcademyTeacher>('academy_teachers', {
        filters: {
          user_id: session.user.id,
          status: 'active',
        },
        limit: 1,
      });

      if (response.error) {
        console.error('[useCurrentTeacherPosition] Error fetching teacher position:', response.error);
        return null;
      }

      const teacher = response.data?.[0];
      return teacher?.position || null;
    },
    enabled: !!session?.user?.id && !!tenantId,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 30 * 60 * 1000,   // 30분
  });
}
