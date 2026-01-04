// LAYER: UI_COMPONENT
/**
 * MessageSendTab Component
 *
 * 메시지 발송 탭
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast, useIconSize, useIconStrokeWidth, Card } from '@ui-core/react';
import { MessageSquare } from 'lucide-react';
import { SchemaFormWithMethods } from '@schema-engine';
import type { UseFormReturn } from 'react-hook-form';
import { LayerSectionHeader } from '../components/LayerSectionHeader';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { createExecutionAuditRecord } from '@hooks/use-student/src/execution-audit-utils';
import { useSchema } from '@hooks/use-schema';
import { useCompleteStudentTaskCard, useStudentTaskCards, useGuardians } from '@hooks/use-student';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { logError } from '../../../utils';
import type { Student, Guardian } from '@services/student-service';
import type { NotificationChannel } from '@core/notification';
import { notificationFormSchema } from '../../../schemas/notification.schema';

// 레이어 섹션 본문 카드 스타일
const layerSectionCardStyle: React.CSSProperties = {};

// [P2 수정] MESSAGE_CONSTANTS를 컴포넌트 외부로 이동하여 매 렌더마다 재생성 방지
const MESSAGE_CONSTANTS = {
  TAB_TITLE: '', // Will be replaced by terms.MESSAGE_LABEL
  STUDENT_DEFAULT: '', // Will be replaced by terms.PERSON_LABEL_PRIMARY
  PHONE_NOT_AVAILABLE: '전화번호 없음',
  LOADING_GUARDIANS: '보호자 정보를 불러오는 중...',
  TARGET_STUDENT_LABEL: '학생',
  NO_GUARDIANS_MESSAGE: '', // Will be replaced by terms.GUARDIAN_LABEL
  NO_STUDENT_PHONE_MESSAGE: '', // Will be replaced by terms.PERSON_LABEL_PRIMARY
  NO_RECIPIENTS_SELECTED: '발송 대상을 선택해주세요.',
  SEND_SUCCESS_TITLE: '성공',
  SEND_SUCCESS_MESSAGE: '메시지가 발송되었습니다.',
  ERROR_TITLE: '오류',
  ERROR_STUDENT_NOT_FOUND: '', // Will be replaced by terms.PERSON_LABEL_PRIMARY
  ERROR_GUARDIAN_NOT_FOUND: '', // Will be replaced by terms.GUARDIAN_LABEL
  ERROR_PHONE_NOT_FOUND: '', // Will be replaced by terms.GUARDIAN_LABEL
  ERROR_CONTENT_REQUIRED: '메시지 내용을 입력해주세요.',
  ERROR_SEND_PARTIAL_FAILED: '일부 메시지 발송에 실패했습니다:',
  ERROR_UNKNOWN: '알 수 없는 오류',
  PARTIAL_SUCCESS_MESSAGE: '명에게 발송 성공,',
  PARTIAL_FAILURE_MESSAGE: '명에게 발송 실패:',
  ALERT_TITLE: '알림',
  COUNT_SUFFIX: '명',
  COUNT_ZERO: '0명',
} as const;

// 메시지 발송 탭 컴포넌트
export interface MessageSendTabProps {
  studentId: string | null;
  student: Student | null | undefined;
  isEditable: boolean;
}

export function MessageSendTab({
  studentId,
  student,
  isEditable,
}: {
  studentId: string | null;
  student: Student | null | undefined;
  isEditable: boolean;
}) {
  const { toast } = useToast();
  const terms = useIndustryTerms();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const [searchParams] = useSearchParams();
  const { data: session } = useSession();
  // [P1-4 확인] useCompleteStudentTaskCard(true)는 프로덕션 기능: 메시지 발송 완료 시 task card 즉시 삭제
  // deleteImmediately=true는 실제 작업 완료 시 카드를 삭제하는 정상 기능 (테스트 코드 아님)
  const completeTaskCard = useCompleteStudentTaskCard(true);
  const { data: studentTaskCards } = useStudentTaskCards();

  // [불변 규칙] 기존 스키마 재사용
  const { data: schema } = useSchema('notification', notificationFormSchema, 'form');

  const formRef = useRef<UseFormReturn<Record<string, unknown>> | null>(null);
  const [selectedChannel] = useState<NotificationChannel>('sms');
  // 수신자 선택 상태 (학생, 보호자 각각 선택 가능)
  const [selectedStudent, setSelectedStudent] = useState(false); // 기본값: 선택 안 함
  const [selectedGuardians, setSelectedGuardians] = useState<Set<string>>(new Set()); // 선택된 보호자 ID 집합
  // 기본 선택 초기화 여부 (한 번만 실행)
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  // defaultValues 메모이제이션 (selectedChannel 변경 시 자동 업데이트)
  const formDefaultValues = useMemo(() => ({
    channel: selectedChannel,
  }), [selectedChannel]);

  // 채널 변경 시 content 필드 초기화
  useEffect(() => {
    if (formRef.current) {
      formRef.current.setValue('channel', selectedChannel);
    }
  }, [selectedChannel]);

  // 보호자 목록 조회
  // 정본 규칙: useGuardians Hook 사용
  const { data: guardians, isLoading: guardiansLoading } = useGuardians(studentId);

  // 보호자 관계별 그룹화 및 관계명 매핑
  const getRelationshipLabel = (relationship: string): string => {
    switch (relationship) {
      case 'parent':
        return '부';
      case 'guardian':
        return '모';
      case 'other':
        return '기타';
      default:
        return '기타';
    }
  };

  // 보호자를 관계별로 그룹화 (부, 모, 기타)
  const guardiansByRelationship = useMemo(() => {
    if (!guardians) return { parent: [], guardian: [], other: [] };

    const parent: Guardian[] = [];
    const guardian: Guardian[] = [];
    const other: Guardian[] = [];

    guardians.forEach((g) => {
      if (g.relationship === 'parent') {
        parent.push(g);
      } else if (g.relationship === 'guardian') {
        guardian.push(g);
      } else {
        other.push(g);
      }
    });

    return { parent, guardian, other };
  }, [guardians]);

  // 전화번호가 있는 보호자만 필터링 (향후 사용 예정)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const guardiansWithPhone = useMemo(() => {
    if (!guardians) return [];
    return guardians.filter((g) => {
      const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
      return phone.trim().length > 0;
    });
  }, [guardians]);

  // 기본 선택 초기화: 모 -> 부 -> 기타 -> 학생 순서로 자동 체크
  useEffect(() => {
    if (hasInitializedSelection || guardiansLoading) return;

    const newSelectedGuardians = new Set<string>();
    let found = false;

    // 1순위: 모 (guardian)
    if (guardiansByRelationship.guardian.length > 0) {
      const guardianWithPhone = guardiansByRelationship.guardian.find((g) => {
        const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
        return phone.trim().length > 0;
      });
      if (guardianWithPhone) {
        newSelectedGuardians.add(guardianWithPhone.id);
        found = true;
      }
    }

    // 2순위: 부 (parent)
    if (!found && guardiansByRelationship.parent.length > 0) {
      const parentWithPhone = guardiansByRelationship.parent.find((g) => {
        const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
        return phone.trim().length > 0;
      });
      if (parentWithPhone) {
        newSelectedGuardians.add(parentWithPhone.id);
        found = true;
      }
    }

    // 3순위: 기타 (other)
    if (!found && guardiansByRelationship.other.length > 0) {
      const otherWithPhone = guardiansByRelationship.other.find((g) => {
        const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
        return phone.trim().length > 0;
      });
      if (otherWithPhone) {
        newSelectedGuardians.add(otherWithPhone.id);
        found = true;
      }
    }

    // 4순위: 학생
    if (!found && student?.phone) {
      const phone = typeof student.phone === 'string' ? student.phone : String(student.phone || '');
      if (phone.trim().length > 0) {
        setSelectedStudent(true);
        found = true;
      }
    }

    if (found) {
      setSelectedGuardians(newSelectedGuardians);
      setHasInitializedSelection(true);
    }
  }, [guardiansByRelationship, guardiansLoading, hasInitializedSelection, student]);

  // 선택된 발송 대상 목록 (채널 셀렉터 아래 표시용, 향후 사용 예정)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectedRecipients = useMemo(() => {
    const recipients: Array<{ label: string; phone: string }> = [];

    // 학생 선택 시
    if (selectedStudent && student?.phone) {
      const phone = typeof student.phone === 'string' ? student.phone : String(student.phone);
      if (phone.trim().length > 0) {
        recipients.push({ label: MESSAGE_CONSTANTS.TARGET_STUDENT_LABEL, phone: phone.trim() });
      }
    }

    // 선택된 보호자
    if (guardians && selectedGuardians.size > 0) {
      guardians.forEach((guardian) => {
        if (selectedGuardians.has(guardian.id)) {
          const phone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone || '');
          if (phone.trim().length > 0) {
            recipients.push({
              label: getRelationshipLabel(guardian.relationship),
              phone: phone.trim()
            });
          }
        }
      });
    }

    return recipients;
  }, [selectedStudent, selectedGuardians, student, guardians]);

  // 메시지 발송 (기존 notificationFormSchema 재사용)
  // [불변 규칙] api-sdk를 통해서만 API 요청
  // [불변 규칙] 기존 SchemaForm의 onSubmit을 확장하여 선택된 수신자에게 발송
  const handleSendMessage = async (data: Record<string, unknown>) => {
    try {
      if (!tenantId || !studentId || !student) {
        throw new Error(`${terms.PERSON_LABEL_PRIMARY} 정보가 없습니다.`);
      }

      const content = String(data.content || '').trim();
      if (!content) {
        throw new Error(MESSAGE_CONSTANTS.ERROR_CONTENT_REQUIRED);
      }

      // 템플릿 변수 치환 (예: {{student_name}} -> 실제 학생 이름)
      const finalContent = content.replace(/\{\{student_name\}\}/g, student.name || terms.PERSON_LABEL_PRIMARY);

      // 수신자 전화번호 수집 (학생 + 선택된 보호자)
      const recipientPhones: string[] = [];

      // 학생 선택 시
      if (selectedStudent) {
        if (student.phone) {
          const phone = typeof student.phone === 'string' ? student.phone : String(student.phone);
          const trimmedPhone = phone.trim();
          if (trimmedPhone.length > 0) {
            recipientPhones.push(trimmedPhone);
          } else {
            throw new Error(`${terms.PERSON_LABEL_PRIMARY} 전화번호가 없습니다.`);
          }
        } else {
          throw new Error(`${terms.PERSON_LABEL_PRIMARY} 전화번호가 없습니다.`);
        }
      }

      // 선택된 보호자 전화번호 수집
      if (selectedGuardians.size > 0 && guardians && guardians.length > 0) {
        const guardianPhones = guardians
          .filter((g) => selectedGuardians.has(g.id))
          .map((g) => {
            const phone = typeof g.phone === 'string' ? g.phone : String(g.phone || '');
            return phone.trim();
          })
          .filter((phone) => phone.length > 0);
        recipientPhones.push(...guardianPhones);
      }

      if (recipientPhones.length === 0) {
        throw new Error(MESSAGE_CONSTANTS.NO_RECIPIENTS_SELECTED);
      }

      // 각 수신자에게 메시지 발송
      // [불변 규칙] 아키텍처 문서 3.5.4: 채널 우선순위는 Edge Function에서 처리
      const startTime = Date.now();
      const promises = recipientPhones.map((phone) =>
        apiClient.post<{ id: string }>('notifications', {
          channel: data.channel,
          recipient: phone,
          content: finalContent,
        status: 'pending',
        })
      );

      const results = await Promise.all(promises);

      // 에러 확인 및 부분 실패 처리
      const errors = results.filter((r) => r.error);
      const successCount = results.length - errors.length;

      if (errors.length > 0) {
        // 일부 실패한 경우
        if (successCount > 0) {
          // 부분 성공: 성공한 건수와 실패한 건수를 모두 표시
          const errorMessage = `${successCount}${MESSAGE_CONSTANTS.PARTIAL_SUCCESS_MESSAGE} ${errors.length}${MESSAGE_CONSTANTS.PARTIAL_FAILURE_MESSAGE} ${errors[0].error?.message || MESSAGE_CONSTANTS.ERROR_UNKNOWN}`;
          toast(errorMessage, 'error', MESSAGE_CONSTANTS.ERROR_TITLE);
          // 부분 성공이어도 쿼리 무효화 (성공한 알림은 조회 가능하도록)
          void queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] });
          // 폼은 초기화하지 않음 (사용자가 재시도할 수 있도록)
          return;
        } else {
          // 전체 실패
          throw new Error(`${MESSAGE_CONSTANTS.ERROR_SEND_PARTIAL_FAILED} ${errors[0].error?.message || MESSAGE_CONSTANTS.ERROR_UNKNOWN}`);
        }
      }

      // 전체 성공
      void queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] });

      // Execution Audit 기록 생성 (액티비티.md 3.2, 3.3, 12 참조)
      if (session?.user?.id && tenantId) {
        const durationMs = Date.now() - startTime;
        const executionErrors = results.filter((r) => r.error);
        const successCount = results.length - executionErrors.length;
        const status: 'success' | 'partial' = executionErrors.length > 0 ? 'partial' : 'success';

        await createExecutionAuditRecord(
          {
            operation_type: 'messaging.send-sms',
            status: status,
            summary: `${student?.name || '학생'}에게 메시지 발송 요청 완료 (${successCount}건)`,
            details: {
              student_id: studentId,
              recipient_count: successCount,
              channel: data.channel as string,
            },
            reference: {
              entity_type: 'student',
              entity_id: studentId || '',
            },
            duration_ms: durationMs,
            ...(executionErrors.length > 0 && {
              error_code: 'PARTIAL_FAILURE',
              error_summary: `${executionErrors.length}건 발송 실패`,
            }),
          },
          session.user.id
        );
      }

      // 알림 발송 성공 시 관련 StudentTaskCard 완료 처리
      // URL에서 cardId를 추출하거나, student_id로 new_signup 타입 카드를 찾아 완료 처리
      const cardId = searchParams.get('cardId');
      if (cardId) {
        // URL에 cardId가 있으면 해당 카드 완료 처리
        try {
          await completeTaskCard.mutateAsync(cardId);
        } catch (error) {
          // 카드 완료 처리 실패는 무시 (알림 발송은 성공했으므로)
          logError('StudentsPage:CompleteTaskCard', error);
        }
      } else if (studentId && studentTaskCards) {
        // cardId가 없으면 student_id로 new_signup 타입 카드 찾기
        const newSignupCard = studentTaskCards.find(
          (card) => card.student_id === studentId && card.task_type === 'new_signup' && card.status !== 'executed'
        );
        if (newSignupCard) {
          try {
            await completeTaskCard.mutateAsync(newSignupCard.id);
          } catch (error) {
            // 카드 완료 처리 실패는 무시 (알림 발송은 성공했으므로)
            logError('StudentsPage:CompleteTaskCard:NewSignup', error);
          }
        }
      }

      toast(MESSAGE_CONSTANTS.SEND_SUCCESS_MESSAGE, 'success', MESSAGE_CONSTANTS.SEND_SUCCESS_TITLE);

      // 폼 초기화
      if (formRef.current) {
        formRef.current.reset();
        formRef.current.setValue('channel', selectedChannel);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : MESSAGE_CONSTANTS.ERROR_UNKNOWN;
      toast(errorMessage, 'error', MESSAGE_CONSTANTS.ERROR_TITLE);
      throw error; // SchemaForm의 에러 처리도 위해 다시 throw
    }
  };

  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  // [P0-3 확인] useIconSize는 인자를 받을 수 있음 (cssVarName?: string, fallback?: number)
  // 타입 안전: useIconSize('--size-icon-md')는 유효한 시그니처
  const buttonIconSize = useIconSize('--size-icon-md');

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <MessageSquare size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            {terms.MESSAGE_LABEL} 발송
          </span>
        }
      />
        <Card padding="md" variant="default" style={layerSectionCardStyle}>
        {/* 발송 대상 선택 */}
        <div style={{ paddingTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>

          {/* 학생, 부, 모, 기타를 같은 행에 한줄로 출력 - 모두 항상 표시 */}
          {guardiansLoading ? (
            <div style={{ padding: 'var(--spacing-sm)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
              {MESSAGE_CONSTANTS.LOADING_GUARDIANS}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
              {/* 학생 - 항상 표시 */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  cursor: student?.phone ? 'pointer' : 'not-allowed',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--border-radius-full)',
                  backgroundColor: selectedStudent ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                  border: selectedStudent ? 'var(--border-width-thin) solid var(--color-primary)' : 'var(--border-width-thin) solid var(--color-gray-200)',
                  // HARD-CODE-EXCEPTION: opacity 1은 전체 불투명을 의미하는 특수 값, 0.5는 비활성화 상태를 위한 레이아웃용 특수 값
                  opacity: student?.phone ? 1 : 0.5,
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.checked)}
                  disabled={!student?.phone}
                  style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: student?.phone ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                />
                <span style={{ fontSize: 'var(--font-size-base)', color: selectedStudent ? 'var(--color-primary)' : (student?.phone ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                  {terms.PERSON_LABEL_PRIMARY}
            </span>
              </label>

              {/* 부 (parent) - 항상 표시 (보호자가 없어도) */}
              {guardiansByRelationship.parent.length > 0 ? (
                guardiansByRelationship.parent.map((guardian) => {
                  const isSelected = selectedGuardians.has(guardian.id);
                  const phone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone || '');
                  const hasPhone = phone.trim().length > 0;
                  return (
                    <label
                      key={guardian.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        cursor: hasPhone ? 'pointer' : 'not-allowed',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: isSelected ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                        border: isSelected ? 'var(--border-width-thin) solid var(--color-primary)' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        opacity: hasPhone ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (!hasPhone) return;
                          const newSet = new Set(selectedGuardians);
                          if (e.target.checked) {
                            newSet.add(guardian.id);
                          } else {
                            newSet.delete(guardian.id);
                          }
                          setSelectedGuardians(newSet);
                        }}
                        disabled={!hasPhone}
                        style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: hasPhone ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 'var(--font-size-base)', color: isSelected ? 'var(--color-primary)' : (hasPhone ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                        {getRelationshipLabel(guardian.relationship)}
                      </span>
                    </label>
                  );
                })
              ) : (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    cursor: 'not-allowed',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-full)',
                    backgroundColor: 'var(--color-gray-50)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    opacity: 'var(--opacity-disabled)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: 'not-allowed', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    부
                  </span>
                </label>
              )}

              {/* 모 (guardian) - 항상 표시 (보호자가 없어도) */}
              {guardiansByRelationship.guardian.length > 0 ? (
                guardiansByRelationship.guardian.map((guardian) => {
                  const isSelected = selectedGuardians.has(guardian.id);
                  const phone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone || '');
                  const hasPhone = phone.trim().length > 0;
                  return (
                    <label
                      key={guardian.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        cursor: hasPhone ? 'pointer' : 'not-allowed',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: isSelected ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                        border: isSelected ? 'var(--border-width-thin) solid var(--color-primary)' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        opacity: hasPhone ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (!hasPhone) return;
                          const newSet = new Set(selectedGuardians);
                          if (e.target.checked) {
                            newSet.add(guardian.id);
                          } else {
                            newSet.delete(guardian.id);
                          }
                          setSelectedGuardians(newSet);
                        }}
                        disabled={!hasPhone}
                        style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: hasPhone ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 'var(--font-size-base)', color: isSelected ? 'var(--color-primary)' : (hasPhone ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                        {getRelationshipLabel(guardian.relationship)}
            </span>
                    </label>
                  );
                })
              ) : (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    cursor: 'not-allowed',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-full)',
                    backgroundColor: 'var(--color-gray-50)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    opacity: 'var(--opacity-disabled)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: 'not-allowed', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    모
                  </span>
                </label>
              )}

              {/* 기타 (other) - 항상 표시 (보호자가 없어도) */}
              {guardiansByRelationship.other.length > 0 ? (
                guardiansByRelationship.other.map((guardian) => {
                  const isSelected = selectedGuardians.has(guardian.id);
                  const phone = typeof guardian.phone === 'string' ? guardian.phone : String(guardian.phone || '');
                  const hasPhone = phone.trim().length > 0;
                  return (
                    <label
                      key={guardian.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        cursor: hasPhone ? 'pointer' : 'not-allowed',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--border-radius-full)',
                        backgroundColor: isSelected ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                        border: isSelected ? 'var(--border-width-thin) solid var(--color-primary)' : 'var(--border-width-thin) solid var(--color-gray-200)',
                        opacity: hasPhone ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (!hasPhone) return;
                          const newSet = new Set(selectedGuardians);
                          if (e.target.checked) {
                            newSet.add(guardian.id);
                          } else {
                            newSet.delete(guardian.id);
                          }
                          setSelectedGuardians(newSet);
                        }}
                        disabled={!hasPhone}
                        style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: hasPhone ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 'var(--font-size-base)', color: isSelected ? 'var(--color-primary)' : (hasPhone ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                        {getRelationshipLabel(guardian.relationship)}
                      </span>
                    </label>
                  );
                })
              ) : (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    cursor: 'not-allowed',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-full)',
                    backgroundColor: 'var(--color-gray-50)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    opacity: 'var(--opacity-disabled)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    style={{ width: 'var(--spacing-md)', height: 'var(--spacing-md)', cursor: 'not-allowed', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                    기타
                  </span>
                </label>
              )}

              {/* 보호자가 없는 경우 */}
              {guardians && guardians.length === 0 && (
                <div style={{ padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-warning-50)', borderRadius: 'var(--border-radius-sm)' }}>
                  <p style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-base)', textAlign: 'center', margin: 0 }}>
                    {terms.GUARDIAN_LABEL} 정보가 없습니다. {terms.GUARDIAN_LABEL}을(를) 먼저 등록해주세요.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

        {/* [불변 규칙] 기존 notificationFormSchema와 SchemaForm 재사용 */}
        {/* 학생 또는 보호자가 선택되었을 때만 폼 표시 */}
        {isEditable && schema && (selectedStudent || selectedGuardians.size > 0) && (
          <>
            {/* [불변 규칙] 기존 notificationFormSchema와 SchemaFormWithMethods 재사용 */}
            {/* 하나의 카드 레이아웃으로 통합: channel, content, 발송 버튼 */}
            {/* 근본 원인 해결: 외부 Card와 SchemaFormWithMethods 내부 Card가 중첩되어 이중 패딩 발생 */}
            {/* 해결책: SchemaFormWithMethods 내부 Card의 padding을 var(--spacing-none)으로 오버라이드하여 외부 Card의 padding에만 의존 */}
            {/* 이렇게 하면 다른 탭들(TagsTab, AttendanceTab)과 동일한 패딩 구조 유지 */}
            <SchemaFormWithMethods
                    formRef={formRef}
                    schema={{
                      ...schema,
                      form: {
                        ...schema.form,
                        // recipient 필드는 제거 (보호자 목록을 자동으로 사용)
                        // channel과 content 필드만 남김 (순서: channel, content)
                        fields: schema.form.fields
                          .filter((field) => field.name !== 'recipient')
                          .sort((a, b) => {
                            // channel 필드를 먼저, content 필드를 나중에
                            if (a.name === 'channel') return -1;
                            if (b.name === 'channel') return 1;
                            return 0;
                          })
                          .map((field) => {
                            // content 필드에 rows 속성 추가 (5행)
                            if (field.name === 'content' && field.kind === 'textarea') {
                              return {
                                ...field,
                                ui: {
                                  ...field.ui,
                                  rows: 5,
                                },
                              };
                            }
                            return field;
                          }),
                        // 발송 버튼 아이콘을 MessageSquare로 변경 (메시지 발송 타이틀과 동일, 크기 14픽셀)
                        // [불변 규칙] 하드코딩 금지: CSS 변수 사용 (--size-icon-md = 14px)
                        // [참고] FormSchema 타입에 icon이 없지만, SchemaForm.tsx에서 (formConfig.submit as any).icon으로 사용하므로 타입 단언 필요
                        submit: {
                          ...schema.form.submit,
                          icon: <MessageSquare size={buttonIconSize} />,
                        } as Record<string, unknown>,
                      },
                    }}
                    onSubmit={handleSendMessage}
                    defaultValues={formDefaultValues}
                    disableCardPadding={false}
                    cardTitle={undefined}
                    cardStyle={{
                      border: 'none',
                      boxShadow: 'none',
                      // [불변 규칙] 하드코딩 금지: CSS 변수 사용 (docu/스키마엔진.txt: "하드코딩된 px 값을 금지합니다")
                      borderRadius: 'var(--spacing-none)',
                      // [불변 규칙] 내부 Card의 padding을 var(--spacing-none)으로 오버라이드하여 외부 Card의 padding에 의존
                      paddingTop: 'var(--spacing-none)',
                      paddingRight: 'var(--spacing-none)',
                      paddingLeft: 'var(--spacing-none)',
                      paddingBottom: 'var(--spacing-none)',
                    }}
                    actionContext={{
                      apiCall: async (endpoint: string, method: string, body?: unknown) => {
                        if (method === 'POST') {
                          const response = await apiClient.post(endpoint, body as Record<string, unknown>);
                          if (response.error) {
                            throw new Error(response.error.message);
                          }
                          return response.data;
                        }
                        const response = await apiClient.get(endpoint);
                        if (response.error) {
                          throw new Error(response.error.message);
                        }
                        return response.data;
                      },
                      showToast: (message: string, variant?: string) => {
                        toast(message, variant === 'success' ? 'success' : variant === 'error' ? 'error' : 'info');
                      },
                    }}
                  />
                </>
              )}
    </div>
  );
}
