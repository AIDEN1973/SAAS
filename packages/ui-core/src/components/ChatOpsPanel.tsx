// LAYER: UI_CORE_COMPONENT
/**
 * ChatOpsPanel Component
 *
 * AI 대화형 기능 제어 시스템의 챗봇 UI 패널
 * [SSOT 준수] 챗봇.md 문서 기준 엄격히 준수
 * [불변 규칙] 실행 결과는 ChatOps UI에 직접 표시하지 않으며, Activity 시스템에 기록됩니다 (챗봇.md 45줄, 액티비티.md 11.3)
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다
 * [불변 규칙] 버블 대화 방식으로 메시지를 표시합니다 (챗봇.md 7.1)
 * [업종 중립] 모든 업종(Academy/Salon/Nail 등)에서 공통으로 사용 가능합니다 (AI_자동화_기능_정리.md 145-158줄 참조)
 * [업종 중립] 업종별 차이는 prop을 통한 확장 포인트(`onViewTaskCard` 등)로 처리됩니다
 *
 * 참고 문서:
 * - SSOT: docu/챗봇.md (AI 대화형 기능 제어 시스템 기술문서)
 * - SSOT: docu/액티비티.md (Execution Audit 시스템)
 * - SSOT: docu/AI_자동화_기능_정리.md (Automation & AI Industry-Neutral Rule)
 *
 * 주요 요구사항:
 * - 챗봇.md 45줄: 실행 결과는 ChatOps UI에 직접 표시하지 않으며, Activity 시스템에 기록됩니다
 * - 챗봇.md 7.1: executed_success/executed_failed는 UI 파생 상태로만 사용
 * - 액티비티.md 11.3: AI가 실행 요청을 제출하면 AI 탭에는 "요청 접수됨(run_id/request_id)"까지만 표시
 */

import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { toKST } from '@lib/date-utils';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { Badge } from './Badge';
import { Spinner } from './Spinner';

/**
 * 메시지 타입 (챗봇.md 7.1 참조)
 * ⚠️ 중요: 아래 message type은 UI 표시용 이벤트 타입이며 TaskCard.status와 무관하다.
 */
export type ChatOpsMessageType =
  | 'user_message'
  | 'assistant_message'
  | 'plan_preview'
  | 'disambiguation'
  | 'task_created'
  | 'approval_requested'
  | 'executed_success'
  | 'executed_failed';

/**
 * ChatOps 메시지 인터페이스
 */
export interface ChatOpsMessage {
  id: string;
  type: ChatOpsMessageType;
  content: string | React.ReactNode;
  timestamp: Date;
  metadata?: {
    task_id?: string;
    request_id?: string;
    run_id?: string;
    plan?: unknown;
    candidates?: Array<{ id: string; label: string; preview: string }>;
    selected_candidate_id?: string;
    token_id?: string; // 디스앰비규에이션 토큰 ID (챗봇.md 7.2.1 참조)
    is_downgraded_from_l2b?: boolean; // L2-B 강등 여부 (챗봇.md 7.1.1 참조)
    intent_key?: string;
    automation_level?: 'L0' | 'L1' | 'L2';
    params?: Record<string, unknown>;
    l0_result?: unknown; // L0 Intent 실행 결과
  };
}

export interface ChatOpsPanelProps {
  messages: ChatOpsMessage[];
  isLoading?: boolean;
  onSendMessage: (message: string) => void | Promise<void>;
  onSelectCandidate?: (candidateId: string, tokenId?: string) => void;
  onApprovePlan?: (taskId: string) => void;
  onRequestApproval?: (taskId: string) => void;
  onViewActivity?: (runId?: string, requestId?: string) => void;
  onViewTaskCard?: (taskId: string) => void; // 업종 중립: TaskCard 라우팅 (업종별로 다른 경로 처리)
  className?: string;
}

/**
 * ChatOpsPanel 컴포넌트
 *
 * 우측 AI 대화창 UI 패널
 * 버블 대화 방식으로 메시지를 표시합니다.
 */
export const ChatOpsPanel: React.FC<ChatOpsPanelProps> = ({
  messages,
  isLoading = false,
  onSendMessage,
  onSelectCandidate,
  onApprovePlan,
  onRequestApproval,
  onViewActivity,
  onViewTaskCard,
  className,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 메시지가 추가될 때마다 스크롤을 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      const result = onSendMessage(inputValue.trim());
      // Promise인 경우 await 처리 (타입 일관성)
      if (result instanceof Promise) {
        await result;
      }
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSubmit(e);
    }
  };

  const renderMessage = (message: ChatOpsMessage) => {
    const isUser = message.type === 'user_message';
    const isAssistant = message.type === 'assistant_message';
    const isPlanPreview = message.type === 'plan_preview';
    const isDisambiguation = message.type === 'disambiguation';
    const isTaskCreated = message.type === 'task_created';
    const isApprovalRequested = message.type === 'approval_requested';
    const isExecutedSuccess = message.type === 'executed_success';
    const isExecutedFailed = message.type === 'executed_failed';

    // 버블 스타일 (사용자/어시스턴트 구분)
    const bubbleStyle: React.CSSProperties = {
      // HARD-CODE-EXCEPTION: maxWidth는 상대값(퍼센트)이므로 CSS 변수로 대체하기 어려움 (CSS 속성 값)
      maxWidth: '80%',
      padding: 'var(--spacing-md)',
      borderRadius: 'var(--border-radius-lg)',
      marginBottom: 'var(--spacing-sm)',
      wordWrap: 'break-word',
      ...(isUser
        ? {
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-white)',
            marginLeft: 'auto',
            borderBottomRightRadius: 'var(--border-radius-sm)',
          }
        : {
            backgroundColor: 'var(--color-gray-100)',
            color: 'var(--color-text)',
            marginRight: 'auto',
            borderBottomLeftRadius: 'var(--border-radius-sm)',
          }),
    };

    return (
      <div
        key={message.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        {/* 메시지 버블 */}
        <div style={bubbleStyle}>
          {/* 메시지 타입별 렌더링 */}
          {isPlanPreview && message.metadata?.plan !== undefined && (
            <Card
              padding="md"
              variant="default"
              style={{
                marginBottom: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-white)',
                border: 'var(--border-width-thin) solid var(--color-gray-200)',
              }}
            >
              <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                <Badge variant="outline" color="info">
                  실행 계획
                </Badge>
              </div>
              <div style={{ color: 'var(--color-text)' }}>
                {typeof message.content === 'string' ? (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                    {message.content}
                  </pre>
                ) : (
                  message.content
                )}
              </div>
              {message.metadata.task_id && (
                <div style={{ marginTop: 'var(--spacing-sm)', display: 'flex', gap: 'var(--spacing-xs)' }}>
                  {onRequestApproval && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRequestApproval(message.metadata!.task_id!)}
                    >
                      승인 요청
                    </Button>
                  )}
                  {onApprovePlan && (
                    <Button
                      variant="solid"
                      size="sm"
                      onClick={() => onApprovePlan(message.metadata!.task_id!)}
                    >
                      승인 및 실행
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}

          {isDisambiguation && message.metadata?.candidates && (
            <Card
              padding="md"
              variant="default"
              style={{
                backgroundColor: 'var(--color-white)',
                border: 'var(--border-width-thin) solid var(--color-gray-200)',
              }}
            >
              <div style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--color-text)' }}>
                여러 후보가 있습니다. 선택해주세요:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {message.metadata.candidates.map((candidate) => (
                  <Button
                    key={candidate.id}
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectCandidate?.(candidate.id, message.metadata?.token_id)}
                    style={{
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                        {candidate.label}
                      </div>
                      {candidate.preview && (
                        <div
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text-secondary)',
                            marginTop: 'var(--spacing-xs)',
                          }}
                        >
                          {candidate.preview}
                        </div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {isTaskCreated && (
            <div>
              <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                <Badge variant="outline" color="success">
                  업무 생성됨
                </Badge>
              </div>
              <div style={{ color: 'var(--color-text)' }}>
                {typeof message.content === 'string' ? message.content : message.content}
              </div>
              {/* L2-B 강등 표준 문구 (챗봇.md 7.1.1 참조) */}
              {message.metadata?.is_downgraded_from_l2b && (
                <div
                  style={{
                    marginTop: 'var(--spacing-sm)',
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-warning-50)',
                    border: 'var(--border-width-thin) solid var(--color-warning-200)',
                    borderRadius: 'var(--border-radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text)',
                  }}
                >
                  <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                    이 작업은 데이터 변경 작업입니다. 현재 SSOT 정책상 자동 실행이 비활성화되어 업무 카드만 생성했습니다.
                  </div>
                  <div>
                    자동 실행을 원하면 Domain Action Catalog 등록이 필요합니다.
                  </div>
                </div>
              )}
              {message.metadata?.task_id && (
                <div style={{ marginTop: 'var(--spacing-sm)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // TaskCard로 이동 (사용자 클릭 트리거만 허용, 챗봇.md 0.1 불변 규칙)
                      // 업종 중립: onViewTaskCard prop을 통해 업종별 라우팅 처리
                      const taskId = message.metadata?.task_id;
                      if (taskId) {
                        if (onViewTaskCard) {
                          onViewTaskCard(taskId);
                        } else {
                          // 하위 호환성: onViewTaskCard가 없으면 기본 동작 (학원 전용)
                          // ⚠️ 경고: 이 경로는 업종별로 다를 수 있으므로 onViewTaskCard prop 사용 권장
                          // P0: 네비게이션 보안 - window.location.href 직접 사용 시 엄격한 경로 검증 수행
                          // UI Core Component는 업종 중립이므로 엄격한 검증 수행
                          const targetPath = `/students/tasks?task_id=${taskId}`;
                          // 엄격한 경로 검증: 내부 경로만 허용 (오픈 리다이렉트 방지)
                          // [P0 수정] isSafeInternalPath와 동일한 검증 로직 적용
                          let decoded = targetPath;
                          let prevDecoded = '';
                          // HARD-CODE-EXCEPTION: 무한 루프 방지를 위한 최대 반복 횟수 (브라우저 버그 회피용 상수)
                          for (let i = 0; i < 10 && decoded !== prevDecoded; i++) {
                            prevDecoded = decoded;
                            try {
                              decoded = decodeURIComponent(decoded);
                            } catch {
                              decoded = prevDecoded;
                              break;
                            }
                          }
                          const normalized = decoded.trim().replace(/[\x00-\x1F\x7F]/g, '');
                          const lowerNormalized = normalized.toLowerCase();
                          const isSafe = normalized.startsWith('/') &&
                            !normalized.startsWith('//') &&
                            !normalized.includes('://') &&
                            !lowerNormalized.includes('javascript:') &&
                            !lowerNormalized.includes('data:') &&
                            !lowerNormalized.includes('vbscript:') &&
                            !lowerNormalized.includes('file:') &&
                            !lowerNormalized.includes('about:') &&
                            !normalized.includes('\\') &&
                            !normalized.includes('..');
                          if (isSafe) {
                            window.location.href = targetPath;
                          }
                          // 외부 URL 또는 잘못된 형식은 무시 (Fail Closed)
                        }
                      }
                    }}
                  >
                    카드로 이동
                  </Button>
                </div>
              )}
            </div>
          )}

          {isApprovalRequested && (
            <div>
              <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                <Badge variant="outline" color="info">
                  승인 요청됨
                </Badge>
              </div>
              <div style={{ color: 'var(--color-text)' }}>
                {typeof message.content === 'string' ? message.content : message.content}
              </div>
              {message.metadata?.request_id && onViewActivity && (
                <div style={{ marginTop: 'var(--spacing-sm)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewActivity(message.metadata?.run_id, message.metadata?.request_id)}
                  >
                    Execution Audit에서 보기
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ⚠️ 중요: executed_success/executed_failed는 UI 파생 상태로만 사용하며,
              실제 실행 결과는 Activity 시스템에 기록됩니다 (챗봇.md 7.1, 액티비티.md 11.3 참조)
              - 챗봇.md 7.1: executed_success/executed_failed는 UI 파생 상태로만 사용
              - 챗봇.md 45줄: 실행 결과는 ChatOps UI에 직접 표시하지 않으며, Activity 시스템에 기록됩니다
              - 액티비티.md 11.3: AI가 실행 요청을 제출하면 AI 탭에는 "요청 접수됨(run_id/request_id)"까지만 표시 */}
          {(isExecutedSuccess || isExecutedFailed) && (
            <div>
              <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                <Badge variant="outline" color={isExecutedSuccess ? 'success' : 'error'}>
                  요청 접수됨
                </Badge>
              </div>
              <div style={{ color: 'var(--color-text)' }}>
                {typeof message.content === 'string' ? message.content : message.content}
              </div>
              {/* ⚠️ 중요: 실행 결과는 ChatOps UI에 직접 표시하지 않으며, Activity 시스템에 기록됩니다
                  사용자는 Activity 영역에서 실행 결과를 확인합니다 (액티비티.md 11.3 참조) */}
              {message.metadata?.run_id && onViewActivity && (
                <div style={{ marginTop: 'var(--spacing-sm)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewActivity(message.metadata?.run_id, message.metadata?.request_id)}
                  >
                    Execution Audit에서 보기
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 일반 메시지 (user_message, assistant_message) */}
          {!isPlanPreview && !isDisambiguation && !isTaskCreated && !isApprovalRequested && !isExecutedSuccess && !isExecutedFailed && (
            <div style={{ color: isUser ? 'var(--color-white)' : 'var(--color-text)' }}>
              {typeof message.content === 'string' ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
              ) : (
                message.content
              )}
              {/* L0 Intent 결과를 구조화된 형태로 표시 */}
              {!isUser && message.metadata?.l0_result !== undefined && message.metadata?.automation_level === 'L0' && (() => {
                const l0Result = message.metadata.l0_result as any;
                const intentKey = message.metadata?.intent_key;

                // student.query.profile: 학생 프로필 정보를 사용자 친화적인 형식으로 표시
                if (intentKey === 'student.query.profile' && l0Result?.student) {
                  const student = l0Result.student;
                  return (
                    <Card
                      padding="md"
                      variant="default"
                      style={{
                        marginTop: 'var(--spacing-sm)',
                        backgroundColor: 'var(--color-white)',
                        border: 'var(--border-width-thin) solid var(--color-gray-200)',
                      }}
                    >
                      <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                        <Badge variant="outline" color="info">
                          조회 결과
                        </Badge>
                      </div>
                      <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                          <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                            {student.name || '이름 없음'}
                          </div>
                          {student.grade && (
                            <div style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--spacing-xs)' }}>
                              {student.grade}
                            </div>
                          )}
                          {student.class_name && (
                            <div style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--spacing-xs)' }}>
                              반: {student.class_name}
                            </div>
                          )}
                          {student.status && (
                            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                              <Badge variant="outline" color={student.status === 'active' ? 'success' : 'gray'}>
                                {student.status === 'active' ? '재학' : student.status}
                              </Badge>
                            </div>
                          )}
                        </div>
                        {(student.guardian_name || student.guardian_contact) && (
                          <div style={{
                            paddingTop: 'var(--spacing-sm)',
                            borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
                            marginTop: 'var(--spacing-sm)',
                          }}>
                            <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)' }}>
                              보호자 정보
                            </div>
                            {student.guardian_name && (
                              <div style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--spacing-xs)' }}>
                                {student.guardian_name}
                              </div>
                            )}
                            {student.guardian_contact && (
                              <div style={{ color: 'var(--color-gray-600)' }}>
                                {student.guardian_contact}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                }

                // 기타 Intent: JSON 형식으로 표시 (fallback)
                return (
                  <Card
                    padding="md"
                    variant="default"
                    style={{
                      marginTop: 'var(--spacing-sm)',
                      backgroundColor: 'var(--color-white)',
                      border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    }}
                  >
                    <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                      <Badge variant="outline" color="info">
                        조회 결과
                      </Badge>
                    </div>
                    <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                      {/* HARD-CODE-EXCEPTION: 스크롤 가능한 영역의 최대 높이 제한 (레이아웃용 특수 값) */}
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, maxHeight: '400px', overflow: 'auto' }}>
                        {JSON.stringify(l0Result, null, 2) as string}
                      </pre>
                    </div>
                  </Card>
                );
              })()}
            </div>
          )}

          {/* 타임스탬프 */}
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              color: isUser ? 'var(--color-white)' : 'var(--color-text-tertiary)',
              // HARD-CODE-EXCEPTION: opacity 1은 전체 불투명을 의미하는 특수 값, 0.7은 타임스탬프 가독성을 위한 레이아웃용 특수 값
              opacity: isUser ? 0.7 : 1,
              marginTop: 'var(--spacing-xs)',
              textAlign: isUser ? 'right' : 'left',
            }}
          >
            {toKST(message.timestamp).format('HH:mm')}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {/* 메시지 영역 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="ui-core-hiddenScrollbar"
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                AI 챗봇에 오신 것을 환영합니다
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
                자연어로 조회, 업무 생성, 승인 요청을 할 수 있습니다
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            {isLoading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  marginBottom: 'var(--spacing-md)',
                }}
              >
                <Spinner size="sm" />
                <span style={{ color: 'var(--color-text-secondary)' }}>처리 중...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 입력 영역 */}
      <div
        style={{
          borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-white)',
        }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              disabled={isLoading}
              style={{ flex: 1 }}
            />
            <Button
              type="submit"
              variant="solid"
              disabled={!inputValue.trim() || isLoading}
            >
              전송
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
