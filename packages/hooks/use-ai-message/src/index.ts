import { useMutation } from '@tanstack/react-query';
import { envClient } from '@env-registry/client';

export interface FilterTag {
  id: string;
  name: string;
  type: 'grade' | 'course' | 'status' | 'custom';
}

export interface MessageContext {
  purpose?: string; // "공지사항", "알림", "이벤트" 등
  tone?: 'formal' | 'friendly' | 'urgent';
}

export interface GenerateMessageRequest {
  tenantId: string;
  filterTags: FilterTag[];
  targetCount: number; // 대상 인원 수 (업종 중립)
  messageContext?: MessageContext;
}

export interface MessageSuggestion {
  title: string;
  content: string;
  reasoning: string;
}

/**
 * AI 메시지 생성 API 호출
 */
async function generateFilterMessage(
  request: GenerateMessageRequest,
  accessToken: string
): Promise<MessageSuggestion> {
  const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-filter-message`;

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
    throw new Error(errorData.error || 'AI 메시지 생성에 실패했습니다.');
  }

  return response.json();
}

/**
 * AI 메시지 생성 훅
 *
 * @example
 * ```tsx
 * const { mutate: generateMessage, isPending } = useGenerateMessage(accessToken);
 *
 * generateMessage({
 *   tenantId: 'tenant-uuid',
 *   filterTags: [{ id: 'tag-1', name: '중등 1학년', type: 'grade' }],
 *   targetCount: 25,
 *   messageContext: { purpose: '공지사항', tone: 'friendly' }
 * }, {
 *   onSuccess: (data) => {
 *     console.log('생성된 메시지:', data.title, data.content);
 *   }
 * });
 * ```
 */
export function useGenerateMessage(accessToken: string) {
  return useMutation({
    mutationFn: (request: GenerateMessageRequest) =>
      generateFilterMessage(request, accessToken),
    retry: 1,
  });
}
