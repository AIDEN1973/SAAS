import React, { useState } from 'react';
import { Button, Card, Spinner, Badge, useModal } from '@ui-core/react';
import { useGenerateMessage, type FilterTag, type MessageContext } from '@hooks/use-ai-message';

export interface AIMessageSuggestionProps {
  tenantId: string;
  accessToken: string;
  filterTags: FilterTag[];
  targetCount: number; // 대상 인원 수 (업종 중립)
  onApplySuggestion: (title: string, content: string) => void;
}

/**
 * AI 메시지 생성 제안 컴포넌트
 *
 * - GPT-4o-mini를 사용하여 필터 태그 기반 맞춤형 메시지 생성
 * - 목적과 톤을 선택할 수 있는 UI 제공
 * - 생성된 메시지를 바로 적용 가능
 */
export function AIMessageSuggestion({
  tenantId,
  accessToken,
  filterTags,
  targetCount,
  onApplySuggestion,
}: AIMessageSuggestionProps) {
  const { showAlert } = useModal();
  const [purpose, setPurpose] = useState<string>('공지사항');
  const [tone, setTone] = useState<'formal' | 'friendly' | 'urgent'>('friendly');
  const [suggestion, setSuggestion] = useState<{
    title: string;
    content: string;
    reasoning: string;
  } | null>(null);

  const { mutate: generateMessage, isPending } = useGenerateMessage(accessToken);

  const handleGenerate = () => {
    const messageContext: MessageContext = {
      purpose,
      tone,
    };

    generateMessage(
      {
        tenantId,
        filterTags,
        targetCount,
        messageContext,
      },
      {
        onSuccess: (data) => {
          setSuggestion(data);
        },
        onError: (error) => {
          console.error('AI 메시지 생성 실패:', error);
          showAlert('AI 메시지 생성에 실패했습니다. 다시 시도해주세요.', '오류');
        },
      }
    );
  };

  const handleApply = () => {
    if (suggestion) {
      onApplySuggestion(suggestion.title, suggestion.content);
      setSuggestion(null); // 적용 후 제안 초기화
    }
  };

  return (
    <Card
      padding="lg"
      style={{
        backgroundColor: 'var(--color-blue-50)',
        borderColor: 'var(--color-blue-200)',
        borderWidth: 'var(--border-width-thin)',
        borderStyle: 'solid',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            AI 메시지 생성
          </span>
          <Badge variant="soft" color="blue">GPT-4o-mini</Badge>
        </div>
      </div>

      {/* 설정 영역 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            메시지 목적
          </label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            style={{
              width: 'var(--width-full)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: 'var(--border-width-thin) solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)',
              fontSize: 'var(--font-size-base)',
            }}
            disabled={isPending}
          >
            <option value="공지사항">공지사항</option>
            <option value="알림">알림</option>
            <option value="이벤트">이벤트</option>
            <option value="수업 안내">수업 안내</option>
            <option value="결제 안내">결제 안내</option>
          </select>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            메시지 톤
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as 'formal' | 'friendly' | 'urgent')}
            style={{
              width: 'var(--width-full)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: 'var(--border-width-thin) solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)',
              fontSize: 'var(--font-size-base)',
            }}
            disabled={isPending}
          >
            <option value="friendly">친근함</option>
            <option value="formal">공식적</option>
            <option value="urgent">긴급</option>
          </select>
        </div>
      </div>

      {/* 필터 태그 표시 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
          }}
        >
          적용된 필터:
        </span>
        {filterTags.map((tag) => (
          <Badge key={tag.id} variant="outline" color="gray">
            {tag.name}
          </Badge>
        ))}
        <Badge variant="solid" color="blue">{targetCount}명</Badge>
      </div>

      {/* 생성 버튼 */}
      <Button onClick={handleGenerate} disabled={isPending || filterTags.length === 0} fullWidth>
        {isPending ? (
          <>
            <Spinner size="sm" />
            <span style={{ marginLeft: 'var(--spacing-sm)' }}>AI 메시지 생성 중...</span>
          </>
        ) : (
          'AI 메시지 생성'
        )}
      </Button>

      {/* 생성된 메시지 표시 */}
      {suggestion && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
            paddingTop: 'var(--spacing-md)',
            borderTop: 'var(--border-width-thin) solid var(--color-blue-200)',
            marginTop: 'var(--spacing-md)',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              제목
            </label>
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-white)',
                border: 'var(--border-width-thin) solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
              }}
            >
              {suggestion.title}
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              내용
            </label>
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-white)',
                border: 'var(--border-width-thin) solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {suggestion.content}
            </div>
            {(suggestion.content.includes('{{') || suggestion.content.includes('}}')) && (
              <p
                style={{
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--color-blue-600)',
                  marginTop: 'var(--spacing-xs)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--spacing-xs)',
                }}
              >
                <span>
                  {'{{'}{'}}'}변수는 발송 시 실제 값으로 자동 치환됩니다. (예: {'{{'} 회원이름 {'}}'} → 홍길동)
                </span>
              </p>
            )}
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              추천 이유
            </label>
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-yellow-50)',
                border: 'var(--border-width-thin) solid var(--color-yellow-200)',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)',
              }}
            >
              {suggestion.reasoning}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Button variant="solid" color="primary" onClick={handleApply} fullWidth>
              메시지 적용
            </Button>
            <Button variant="outline" onClick={() => setSuggestion(null)} fullWidth>
              다시 생성
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
