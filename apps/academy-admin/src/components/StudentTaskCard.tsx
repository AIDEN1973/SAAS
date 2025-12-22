/**
 * 학생 업무 카드 컴포넌트
 *
 * 아키텍처 문서 3.1.2 섹션 참조
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Modal } from '@ui-core/react';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';
import { useRequestApprovalStudentTaskCard, useApproveAndExecuteStudentTaskCard } from '@hooks/use-student';
import { useUserRole } from '@hooks/use-auth';

interface StudentTaskCardProps {
  card: StudentTaskCardType;
  onAction?: (card: StudentTaskCardType) => void;
}

// SVG strokeWidth는 CSS 변수로 대체 (하드코딩 금지 규칙 준수)
const SVG_STROKE_WIDTH = 2; // --stroke-width-icon-bold와 동일한 값

const taskTypeIcons: Record<StudentTaskCardType['task_type'], React.ReactNode> = {
  ai_suggested: (
    <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={SVG_STROKE_WIDTH} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  risk: (
    <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={SVG_STROKE_WIDTH} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  absence: (
    <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={SVG_STROKE_WIDTH} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  counseling: (
    <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={SVG_STROKE_WIDTH} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  new_signup: (
    <svg style={{ width: 'var(--font-size-xl)', height: 'var(--font-size-xl)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={SVG_STROKE_WIDTH} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
};

const taskTypeColors: Record<StudentTaskCardType['task_type'], { bg: string; text: string; border: string }> = {
  ai_suggested: { bg: 'var(--color-purple-50)', text: 'var(--color-purple-700)', border: 'var(--color-purple-200)' },
  risk: { bg: 'var(--color-red-50)', text: 'var(--color-red-700)', border: 'var(--color-red-200)' },
  absence: { bg: 'var(--color-orange-50)', text: 'var(--color-orange-700)', border: 'var(--color-orange-200)' },
  counseling: { bg: 'var(--color-blue-50)', text: 'var(--color-blue-700)', border: 'var(--color-blue-200)' },
  new_signup: { bg: 'var(--color-green-50)', text: 'var(--color-green-700)', border: 'var(--color-green-200)' },
};

const taskTypeLabels: Record<StudentTaskCardType['task_type'], string> = {
  ai_suggested: 'AI 업무 카드',
  risk: '이탈 위험',
  absence: '결석',
  counseling: '상담 필요',
  new_signup: '신규 등록',
};

const getPriorityBadgeColor = (priority: number): string => {
  if (priority >= 70) return 'var(--color-red-600)';
  if (priority >= 40) return 'var(--color-orange-600)';
  return 'var(--color-blue-600)';
};

export function StudentTaskCard({ card, onAction }: StudentTaskCardProps) {
  const navigate = useNavigate();
  const typeConfig = taskTypeColors[card.task_type];
  const icon = taskTypeIcons[card.task_type];
  const label = taskTypeLabels[card.task_type];
  const { data: userRole } = useUserRole();
  const requestApproval = useRequestApprovalStudentTaskCard();
  const approveAndExecute = useApproveAndExecuteStudentTaskCard();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // StudentTaskCard (task_type: 'ai_suggested')이고 pending 상태인 경우 승인/거부 버튼 표시
  const isAISuggestedPending = card.task_type === 'ai_suggested' && card.status === 'pending';
  const isTeacher = userRole === 'teacher';
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  const handleAction = () => {
    if (onAction) {
      // onAction이 제공되면 사용 (정본: 컴포넌트 레벨에서 navigate 호출)
      const actionUrl = onAction(card);
      if (typeof actionUrl === 'string' && actionUrl) {
        navigate(actionUrl);
      }
    } else if (card.action_url) {
      // onAction이 없으면 직접 action_url 사용 (하위 호환)
      navigate(card.action_url);
    }
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지
    setIsProcessing(true);
    try {
      if (isTeacher) {
        // Teacher: 승인 요청만
        await requestApproval.mutateAsync(card.id);
      } else if (isAdmin) {
        // Admin/Owner: 승인 및 실행
        await approveAndExecute.mutateAsync(card.id);
      }
    } catch (error) {
      console.error('Failed to approve task card:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지
    // TODO: 거부 기능 구현 (Edge Function 또는 직접 업데이트)
    console.log('Reject task card:', card.id);
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지
    setIsPreviewOpen(true);
  };

  // 미리보기 데이터 추출 (프론트 자동화 문서 14.3 섹션 참조)
  const previewData = React.useMemo(() => {
    if (!card.suggested_action) return null;

    const action = card.suggested_action as any;
    const estimatedCost = typeof card.metadata?.estimated_cost === 'number'
      ? card.metadata.estimated_cost
      : 0;

    if (action.type === 'send_message') {
      return {
        type: 'send_message',
        recipients: action.payload?.recipient_ids || [],
        message: action.payload?.message || '',
        templateId: action.payload?.template_id || '',
        estimatedCost,
        impact: {
          recipientCount: action.payload?.recipient_ids?.length || 0,
          estimatedDeliveryTime: '즉시',
        },
      };
    } else if (action.type === 'run_analysis') {
      const impact = card.metadata?.impact as { scope?: string } | undefined;
      return {
        type: 'run_analysis',
        analysisType: action.analysis_type || '',
        targetId: action.class_id || action.student_id || '',
        estimatedCost,
        impact: {
          scope: impact?.scope || '일부',
        },
      };
    }
    return null;
  }, [card.suggested_action, card.metadata]);

  // 기술문서 5-2: KST 변환 필수 (toLocaleDateString 직접 사용 금지)
  const formatDate = (dateString: string) => {
    return toKST(dateString).format('MM월 DD일 HH:mm');
  };

  return (
    <Card
      variant="default"
      padding="md"
      style={{
        backgroundColor: typeConfig.bg,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={handleAction}
      disableHoverEffect={true} // 롤오버 효과 완전 제거
    >
      {/* 헤더: 아이콘 + 타입 배지 + 우선순위 배지 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-md)',
        gap: 'var(--spacing-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <div style={{
            color: typeConfig.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {icon}
          </div>
          <span style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            color: typeConfig.text,
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: typeConfig.border,
            whiteSpace: 'nowrap',
          }}>
            {label}
          </span>
        </div>
        <span style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-white)',
          backgroundColor: getPriorityBadgeColor(card.priority),
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          borderRadius: 'var(--border-radius-sm)',
          whiteSpace: 'nowrap',
        }}>
          우선순위 {card.priority}
        </span>
      </div>

      {/* 제목 (최대 2줄) */}
      <h3 style={{
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text)',
        marginBottom: 'var(--spacing-sm)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        lineHeight: 'var(--line-height)',
      }}>
        {card.title}
      </h3>

      {/* 설명 (최대 3줄) */}
      <p style={{
        fontSize: 'var(--font-size-base)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--spacing-md)',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        lineHeight: 'var(--line-height)',
      }}>
        {card.description}
      </p>

      {/* 메타 정보: 학생 이름, 생성 시간 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-md)',
        fontSize: 'var(--font-size-base)',
        color: 'var(--color-text-secondary)',
        gap: 'var(--spacing-sm)',
      }}>
        {card.student_name && (
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            학생: {card.student_name}
          </span>
        )}
        <span style={{
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {formatDate(card.created_at)}
        </span>
      </div>

      {/* 액션 버튼 영역 - 하단 고정 */}
      <div style={{ marginTop: 'auto', paddingTop: 'var(--spacing-sm)' }}>
      {isAISuggestedPending && (isTeacher || isAdmin) ? (
        // StudentTaskCard (task_type: 'ai_suggested')이고 pending 상태: 승인/거부 버튼 표시
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          flexWrap: 'wrap',
        }}>
          {previewData && (
            <Button
              variant="outline"
              color="info"
              fullWidth
              onClick={handlePreview}
              disabled={isProcessing}
              style={{
                fontSize: 'var(--font-size-base)',
              }}
            >
              미리보기
            </Button>
          )}
          <Button
            variant="solid"
            color="primary"
            fullWidth
            onClick={handleApprove}
            disabled={isProcessing}
            style={{
              fontSize: 'var(--font-size-base)',
            }}
          >
            {isTeacher ? '승인 요청' : '승인 및 실행'}
          </Button>
          <Button
            variant="outline"
            color="secondary"
            fullWidth
            onClick={handleReject}
            disabled={isProcessing}
            style={{
              fontSize: 'var(--font-size-base)',
            }}
          >
            거부
          </Button>
        </div>
      ) : (
        // 일반 카드: 처리하기 버튼 + 나중에 버튼
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          alignItems: 'stretch',
        }}>
          <Button
            variant="solid"
            color="primary"
            fullWidth
            onClick={handleAction}
            style={{
              fontSize: 'var(--font-size-base)',
            }}
          >
            처리하기
          </Button>
          <Button
            variant="outline"
            color="secondary"
            onClick={(e) => {
              e.stopPropagation();
              // 나중에 버튼: 카드를 숨기지 않고 그대로 유지
              // 사용자가 나중에 처리할 수 있도록 선택권 제공
            }}
            style={{
              minWidth: 'auto',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              fontSize: 'var(--font-size-base)',
              whiteSpace: 'nowrap',
            }}
          >
            나중에
          </Button>
        </div>
      )}
      </div>

      {/* 미리보기 모달 (프론트 자동화 문서 14.3 섹션 참조) */}
      {previewData && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="실행 전 미리보기"
          size="lg"
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            {previewData.type === 'send_message' && (
              <>
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                    발송 대상
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    {previewData.recipients.length}명의 학부모
                  </p>
                </div>
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                    메시지 본문
                  </h4>
                  <div style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-gray-50)',
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: 'var(--font-size-base)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 'var(--line-height)',
                  }}>
                    {previewData.message || '(메시지 내용 없음)'}
                  </div>
                </div>
                {previewData.estimatedCost > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                      예상 비용
                    </h4>
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                      약 {previewData.estimatedCost.toLocaleString()}원
                    </p>
                  </div>
                )}
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                    영향 범위
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    발송 대상: {previewData.impact.recipientCount}명<br />
                    예상 도달 시간: {previewData.impact.estimatedDeliveryTime}
                  </p>
                </div>
              </>
            )}
            {previewData.type === 'run_analysis' && (
              <>
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                    분석 유형
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    {previewData.analysisType}
                  </p>
                </div>
                {previewData.estimatedCost > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                      예상 비용
                    </h4>
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                      약 {previewData.estimatedCost.toLocaleString()}원
                    </p>
                  </div>
                )}
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                    영향 범위
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    범위: {previewData.impact.scope}
                  </p>
                </div>
              </>
            )}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md)',
            borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
          }}>
            <Button
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
            >
              닫기
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={(e) => {
                setIsPreviewOpen(false);
                handleApprove(e as any);
              }}
              disabled={isProcessing}
            >
              {isTeacher ? '승인 요청' : '승인 및 실행'}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

