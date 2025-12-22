/**
 * StudentTaskCard (task_type: 'ai_suggested') Card 컴포넌트 (레거시)
 *
 * ⚠️ 레거시 (v2.x): 이 컴포넌트는 더 이상 사용하지 않습니다.
 * ⚠️ v3.3 정본 규칙: StudentTaskCard (task_type: 'ai_suggested')로 통합되었습니다.
 *
 * 정본: StudentTaskCard를 사용하세요 (프론트 자동화 문서 2.2 섹션 참조)
 *
 * Zero-Management Platform: StudentTaskCard (task_type: 'ai_suggested') (Level 2) 승인 메커니즘
 * 아키텍처 문서 1.7, Zero-Management 프론트엔드 기능 설계 문서 참조
 *
 * 마이그레이션 가이드:
 * - AISuggestionCard → StudentTaskCard 사용
 * - useAISuggestion() → useStudentTaskCards() 사용
 * - ai_suggestions 테이블 → task_cards 테이블 사용 (StudentTaskCard는 학생용 별칭)
 *
 * @deprecated v3.3에서 삭제됨. StudentTaskCard 컴포넌트를 사용하세요.
 */

import React, { useState } from 'react';
import { Card, Button, Badge } from '@ui-core/react';
import type { AISuggestion } from '@hooks/use-ai-suggestion';

interface AISuggestionCardProps {
  suggestion: AISuggestion;
  onApprove: (id: string) => void; // 정본: 승인만, 실행은 Edge Function
  onReject: (id: string, feedback?: string) => void;
  onPreview?: (id: string) => void;
  // onExecute 제거: 정본 규칙에 따라 프론트엔드는 실행하지 않음
}

export function AISuggestionCard({
  suggestion,
  onApprove,
  onReject,
  onPreview,
}: AISuggestionCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 정본 규칙: 승인만 처리, 실행은 Edge Function에서 Role 검증 후 처리
  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(suggestion.id);
      // 정본: 승인만 처리, 실행은 Edge Function이 자동으로 처리
    } catch (error) {
      console.error('Failed to approve suggestion:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(suggestion.id);
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getSuggestionTypeLabel = (type: AISuggestion['suggestion_type']) => {
    const labels: Record<AISuggestion['suggestion_type'], string> = {
      message_draft: '메시지 초안',
      consultation_recommendation: '상담 추천',
      analysis_request: '분석 요청',
      attendance_followup: '출결 후속 조치',
    };
    return labels[type] || type;
  };

  const getPriorityVariant = (priority: number): 'solid' | 'outline' | 'soft' => {
    if (priority >= 8) return 'solid';
    if (priority >= 6) return 'outline';
    return 'soft';
  };

  const getPriorityColor = (priority: number): 'error' | 'warning' | 'info' => {
    if (priority >= 8) return 'error';
    if (priority >= 6) return 'warning';
    return 'info';
  };

  return (
    <Card
      padding="md"
      variant="elevated"
      style={{
        borderLeft: `4px solid var(--color-${getPriorityVariant(suggestion.priority)})`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            <Badge variant={getPriorityVariant(suggestion.priority)} color={getPriorityColor(suggestion.priority)}>
              {suggestion.priority >= 8 ? '긴급' : '추천'}
            </Badge>
            <Badge variant="outline" size="sm">
              {getSuggestionTypeLabel(suggestion.suggestion_type)}
            </Badge>
            <h3
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                flex: 1,
              }}
            >
              {suggestion.title}
            </h3>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
            {suggestion.summary}
          </p>

          {/* 제안 근거 */}
          {suggestion.context_data?.reason && (
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              💡 {suggestion.context_data.reason}
            </p>
          )}

          {/* 메시지 초안 미리보기 */}
          {suggestion.suggestion_type === 'message_draft' &&
            suggestion.suggested_action.type === 'send_message' && (
              <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={isProcessing}
                >
                  {showPreview ? '초안 숨기기' : '초안 보기'}
                </Button>

                {showPreview && (
                  <Card
                    padding="sm"
                    variant="default"
                    style={{
                      marginTop: 'var(--spacing-sm)',
                      backgroundColor: 'var(--color-background-secondary)',
                    }}
                  >
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-sm)' }}>
                      {typeof suggestion.suggested_action.payload.message === 'string'
                        ? suggestion.suggested_action.payload.message
                        : JSON.stringify(suggestion.suggested_action.payload.message, null, 2)}
                    </p>
                  </Card>
                )}
              </div>
            )}

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
            <Button
              variant="solid"
              size="sm"
              onClick={handleApprove}
              disabled={isProcessing}
            >
              {isProcessing ? '처리 중...' : '승인'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={isProcessing}
            >
              거부
            </Button>
            {onPreview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPreview(suggestion.id)}
                disabled={isProcessing}
              >
                상세 보기
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

