import { useMutation } from '@tanstack/react-query';
import { envClient } from '@env-registry/client';

export interface FilterTagRecommendation {
  tag_ids: string[];
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  suggested_query: string;
}

export interface RecommendFilterRequest {
  tenantId: string;
  naturalLanguageQuery: string;
}

/**
 * 자연어 필터 추천 API 호출
 */
async function recommendFilterTags(
  request: RecommendFilterRequest,
  accessToken: string
): Promise<FilterTagRecommendation> {
  const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/recommend-filter-tags`;

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'AI 필터 추천에 실패했습니다.');
  }

  return response.json();
}

/**
 * 자연어 필터 추천 훅
 *
 * @example
 * ```tsx
 * const { mutate: recommendTags, isPending } = useRecommendFilterTags(accessToken);
 *
 * recommendTags({
 *   tenantId: 'tenant-uuid',
 *   naturalLanguageQuery: '중학생 중에서 수학 성적이 낮은 학생'
 * }, {
 *   onSuccess: (data) => {
 *     console.log('추천된 태그 IDs:', data.tag_ids);
 *     console.log('추천 이유:', data.reasoning);
 *   }
 * });
 * ```
 */
export function useRecommendFilterTags(accessToken: string) {
  return useMutation({
    mutationFn: (request: RecommendFilterRequest) =>
      recommendFilterTags(request, accessToken),
    retry: 1,
  });
}
