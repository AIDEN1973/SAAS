/**
 * 학생 업무 카드 컴포넌트
 *
 * [불변 규칙] 업종중립: Industry Registry를 통해 용어 접근
 * 아키텍처 문서 3.1.2 섹션 참조
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationCardLayout, Button, Modal } from '@ui-core/react';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';
import { useRequestApprovalStudentTaskCard, useApproveAndExecuteStudentTaskCard, useSnoozeStudentTaskCard, useDeleteStudentTaskCard } from '@hooks/use-student';
import { useUserRole } from '@hooks/use-auth';
import type { SuggestedActionChatOpsPlanV1 } from '@chatops-intents/types';
// [SSOT] Barrel export를 통한 통합 import
import { EMPTY_CARD_ID_PREFIX, DEFAULT_VALUES, TEXT_LINE_LIMITS, DATE_FORMATS, CARD_LABELS } from '../constants';
import { isSafeInternalPath } from '../utils/navigation-utils';

interface StudentTaskCardProps {
  card: StudentTaskCardType;
  onAction?: (card: StudentTaskCardType) => void;
}

// 아이콘 경로 정의 (하드코딩 제거)
const iconPaths: Record<StudentTaskCardType['task_type'], string> = {
  ai_suggested: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  risk: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  absence: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  counseling: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  new_signup: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
};

// 아이콘 생성 함수 (CSS 변수 사용)
// 크기는 NotificationCardLayout에서 제어하므로 여기서는 설정하지 않음
const createTaskTypeIcon = (path: string, strokeWidth: number): React.ReactNode => (
  <svg style={{ width: '100%', height: '100%' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={path} />
  </svg>
);

// 아이콘 배경색은 모두 동일하게 (심플한 디자인)

export function StudentTaskCard({ card, onAction }: StudentTaskCardProps) {
  const navigate = useNavigate();

  // 빈 카드 여부 확인 (ID가 empty-로 시작하는 경우)
  const isEmpty = card.id.startsWith(EMPTY_CARD_ID_PREFIX);

  // CSS 변수에서 strokeWidth 읽기 (하드코딩 제거)
  const strokeWidth = useMemo(() => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--stroke-width-icon-bold')
        .trim();
      return value ? Number(value) : DEFAULT_VALUES.STROKE_WIDTH_FALLBACK;
    }
    return DEFAULT_VALUES.STROKE_WIDTH_FALLBACK;
  }, []);

  const iconPath = iconPaths[card.task_type];

  const { data: userRole } = useUserRole();
  const requestApproval = useRequestApprovalStudentTaskCard();
  const approveAndExecute = useApproveAndExecuteStudentTaskCard();
  const snoozeCard = useSnoozeStudentTaskCard();
  const deleteCard = useDeleteStudentTaskCard();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isRemindModalOpen, setIsRemindModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRemindTime, setSelectedRemindTime] = useState<string>('');
  const [selectedRemindOptionId, setSelectedRemindOptionId] = useState<string>('');

  const isTeacher = userRole === 'teacher';
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  const handleAction = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (onAction) {
      // onAction이 제공되면 사용 (정본: 컴포넌트 레벨에서 navigate 호출)
      // [P0-2 수정] SSOT: onAction에서 반환된 actionUrl도 검증 (이중 방어)
      const actionUrl = onAction(card);
      if (typeof actionUrl === 'string' && actionUrl && isSafeInternalPath(actionUrl)) {
        navigate(actionUrl);
      }
      // 외부 URL 또는 잘못된 형식은 무시 (Fail Closed)
    } else if (card.action_url) {
      // onAction이 없으면 직접 action_url 사용 (하위 호환)
      // [P0-2 수정] SSOT: 서버에서 온 action_url 검증 (오픈 리다이렉트 방지)
      if (isSafeInternalPath(card.action_url)) {
        navigate(card.action_url);
      }
      // 외부 URL 또는 잘못된 형식은 무시 (Fail Closed)
    }
  };

  const handleApprove = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // 카드 클릭 이벤트 방지
    }

    console.error('[StudentTaskCard] ========================================');
    console.error('[StudentTaskCard] handleApprove 호출:', {
      card_id: card.id,
      is_teacher: isTeacher,
      is_admin: isAdmin,
      task_type: card.task_type,
      intent_key: (card.suggested_action as SuggestedActionChatOpsPlanV1 | undefined)?.intent_key,
    });
    console.error('[StudentTaskCard] ========================================');

    setIsProcessing(true);
    try {
      if (isTeacher) {
        // Teacher: 승인 요청만
        console.error('[StudentTaskCard] Teacher: requestApproval 호출');
        await requestApproval.mutateAsync(card.id);
      } else if (isAdmin) {
        // Admin/Owner: 승인 및 실행
        console.error('[StudentTaskCard] Admin: approveAndExecute 호출');
        await approveAndExecute.mutateAsync(card.id);
      } else {
        console.error('[StudentTaskCard] 권한 없음:', {
          user_role: userRole,
        });
      }
    } catch (error) {
      console.error('[StudentTaskCard] 승인 실패:', error);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleConfirmSnooze = async () => {
    if (!selectedRemindTime) return;

    setIsProcessing(true);
    try {
      await snoozeCard.mutateAsync({
        taskId: card.id,
        remindAt: selectedRemindTime,
      });
      setIsRemindModalOpen(false);
      setSelectedRemindTime('');
      setSelectedRemindOptionId('');
    } catch (error) {
      console.error('Failed to snooze task card:', error);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      await deleteCard.mutateAsync(card.id);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete task card:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 미리보기 데이터 추출 (프론트 자동화 문서 14.3 섹션 참조)
  type PreviewData =
    | {
        type: 'send_message';
        recipients: string[];
        message: string;
        templateId: string;
        estimatedCost: number;
        impact: {
          recipientCount: number;
          estimatedDeliveryTime: string;
        };
      }
    | {
        type: 'run_analysis';
        analysisType: string;
        targetId: string;
        estimatedCost: number;
        impact: {
          scope: string;
        };
      }
    | null;

  const previewData = useMemo<PreviewData>(() => {
    if (!card.suggested_action) return null;

    const action = card.suggested_action as { type: string; payload?: Record<string, unknown>; analysis_type?: string; class_id?: string; student_id?: string };
    const estimatedCost = typeof card.metadata?.estimated_cost === 'number'
      ? card.metadata.estimated_cost
      : DEFAULT_VALUES.ZERO;

    if (action.type === 'send_message') {
      const recipientIds = Array.isArray(action.payload?.recipient_ids) ? action.payload.recipient_ids : [];
      return {
        type: 'send_message',
        recipients: recipientIds as string[],
        message: typeof action.payload?.message === 'string' ? action.payload.message : '',
        templateId: typeof action.payload?.template_id === 'string' ? action.payload.template_id : '',
        estimatedCost,
        impact: {
          recipientCount: recipientIds.length || DEFAULT_VALUES.ZERO,
          estimatedDeliveryTime: CARD_LABELS.IMMEDIATE_DELIVERY,
        },
      };
    } else if (action.type === 'run_analysis') {
      const impact = card.metadata?.impact as { scope?: string } | undefined;
      return {
        type: 'run_analysis',
        analysisType: typeof action.analysis_type === 'string' ? action.analysis_type : '',
        targetId: (typeof action.class_id === 'string' ? action.class_id : '') || (typeof action.student_id === 'string' ? action.student_id : ''),
        estimatedCost,
        impact: {
          scope: impact?.scope || CARD_LABELS.SCOPE_PARTIAL,
        },
      };
    }
    return null;
  }, [card.suggested_action, card.metadata]);

  // 기술문서 5-2: KST 변환 필수 (toLocaleDateString 직접 사용 금지)
  const formatDate = (dateString: string) => {
    return toKST(dateString).format(DATE_FORMATS.SHORT_WITH_TIME);
  };

  // 아이콘 (원형 배경은 NotificationCardLayout에서 처리)
  const taskIcon = createTaskTypeIcon(iconPath, strokeWidth);

  // 메타 정보
  const metaContent = (
    <span style={{
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {formatDate(card.created_at)}
    </span>
  );

  return (
    <>
    <NotificationCardLayout
      isEmpty={isEmpty}
      onClick={isEmpty || isRemindModalOpen || isPreviewOpen || isDeleteModalOpen ? undefined : handleAction}
      icon={taskIcon}
      title={card.title}
      description={card.description}
      meta={metaContent}
      maxTitleLines={TEXT_LINE_LIMITS.TITLE}
      maxDescriptionLines={TEXT_LINE_LIMITS.DESCRIPTION}
      titleFontWeight="var(--font-weight-bold)"
    />

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
                    {(previewData.type === 'send_message' ? previewData.recipients.length : 0)}명의 학부모
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
                {previewData.estimatedCost > DEFAULT_VALUES.ZERO && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                      예상 비용
                    </h4>
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                      약 {(() => {
                        // [P1 수정] toLocaleString() 대신 Intl.NumberFormat 사용
                        const formatter = new Intl.NumberFormat('ko-KR');
                        return formatter.format(previewData.estimatedCost);
                      })()}원
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
                {previewData.estimatedCost > DEFAULT_VALUES.ZERO && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                      예상 비용
                    </h4>
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                      약 {(() => {
                        // [P1 수정] toLocaleString() 대신 Intl.NumberFormat 사용
                        const formatter = new Intl.NumberFormat('ko-KR');
                        return formatter.format(previewData.estimatedCost);
                      })()}원
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
                e.stopPropagation();
                setIsPreviewOpen(false);
                void handleApprove(e);
              }}
              disabled={isProcessing}
            >
              {isTeacher ? '승인 요청' : '승인 및 실행'}
            </Button>
          </div>
        </Modal>
      )}

      {/* 리마인드 모달 */}
      <Modal
        isOpen={isRemindModalOpen}
        onClose={() => {
          setIsRemindModalOpen(false);
          setSelectedRemindTime('');
          setSelectedRemindOptionId('');
        }}
        title="나중에 알림"
        size="md"
      >
        <div style={{ padding: 'var(--spacing-md)' }}>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--spacing-md)',
          }}>
            언제 다시 알림을 받으시겠습니까?
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
          }}>
            {useMemo(() => {
              const now = toKST();
              return [
                { id: '1hour', label: '1시간 후', getValue: () => now.add(1, 'hour').toISOString() },
                { id: '3hours', label: '3시간 후', getValue: () => now.add(3, 'hours').toISOString() },
                { id: '6hours', label: '6시간 후', getValue: () => now.add(6, 'hours').toISOString() },
                { id: 'tomorrow9am', label: '내일 오전 9시', getValue: () => now.add(1, 'day').hour(9).minute(0).second(0).toISOString() },
                { id: '3days', label: '3일 후', getValue: () => now.add(3, 'days').startOf('day').toISOString() },
                { id: '1week', label: '1주일 후', getValue: () => now.add(1, 'week').startOf('day').toISOString() },
              ];
            }, []).map((option) => {
              const isSelected = selectedRemindOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // 카드 클릭 이벤트 방지
                    const value = option.getValue();
                    setSelectedRemindTime(value);
                    setSelectedRemindOptionId(option.id);
                  }}
                  style={{
                    padding: 'var(--spacing-md)',
                    border: `var(--border-width-thin) solid ${isSelected ? 'var(--color-primary)' : 'var(--color-gray-300)'}`,
                    borderRadius: 'var(--border-radius-md)',
                    backgroundColor: isSelected ? 'var(--color-primary-50)' : 'var(--color-white)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                    fontSize: 'var(--font-size-base)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'var(--transition-all)',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
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
            onClick={() => {
              setIsRemindModalOpen(false);
              setSelectedRemindTime('');
              setSelectedRemindOptionId('');
            }}
            disabled={isProcessing}
          >
            취소
          </Button>
          <Button
            variant="solid"
            color="primary"
            onClick={handleConfirmSnooze}
            disabled={!selectedRemindTime || isProcessing}
          >
            확인
          </Button>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="카드 삭제"
        size="md"
      >
        <div style={{ padding: 'var(--spacing-md)' }}>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text)',
            marginBottom: 'var(--spacing-md)',
          }}>
            정말 이 카드를 삭제하시겠습니까?
          </p>
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}>
            삭제된 카드는 복구할 수 없습니다.
          </p>
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
            onClick={() => setIsDeleteModalOpen(false)}
            disabled={isProcessing}
          >
            취소
          </Button>
          <Button
            variant="solid"
            color="error"
            onClick={handleConfirmDelete}
            disabled={isProcessing}
          >
            삭제
          </Button>
        </div>
      </Modal>
    </>
  );
}

