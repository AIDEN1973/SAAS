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
    original_message?: string; // 원본 사용자 메시지 (필터링용)
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
  onReset?: () => void; // 대화 초기화 콜백
  className?: string;
}

/**
 * ChatOpsPanel 컴포넌트
 *
 * 우측 AI 대화창 UI 패널
 * 버블 대화 방식으로 메시지를 표시합니다.
 */
/**
 * 원본 메시지에서 요청한 필드 추출 (범용)
 */
/**
 * 필드 표시 보조 함수 (SSOT 경계 준수)
 *
 * ⚠️ 중요: 이 함수는 "판정"이 아니라 "표시 보조"만 수행합니다.
 * - 서버에서 필터링 정보를 보내주지 않는 경우, UI 표시를 위한 보조 함수로만 사용됩니다.
 * - 실제 의도 판단은 서버(Edge Function)에서 수행되어야 합니다.
 * - SSOT 원칙: 프론트는 판정 주체가 아닙니다.
 *
 * @param originalMessage 원본 사용자 메시지
 * @returns 표시할 필드 추정 (보조 정보, 판정 아님)
 */
function extractRequestedFields(originalMessage: string): { requestedFields: Set<string>; showAll: boolean } {
  const messageLower = originalMessage.toLowerCase();
  const requestedFields = new Set<string>();

  // ⚠️ 표시 보조용 키워드 매핑 (판정 로직 아님)
  // 실제 의도 판단은 서버에서 수행되어야 하며, 이 함수는 UI 표시를 위한 보조 정보만 제공합니다.
  const fieldKeywords: Record<string, string[]> = {
    name: ['이름', '성명'],
    phone: ['전화번호', '전화', '연락처', '번호', '핸드폰', '폰번호'],
    email: ['이메일', '메일'],
    date: ['날짜', '일자'],
    time: ['시간', '시각'],
    status: [
      // 기본 상태
      '상태', '출석', '결석', '지각', '재학', '휴원', '퇴원',
      // 출석 관련 동의어
      '나온', '안온', '불참', '참석',
      // 미납/연체 관련 동의어
      '미납', '연체', '미결제', '납부 안한', '결제 안한', '돈 안낸',
      '미납자', '연체자', '미결제자', '납부 안한 사람', '결제 안한 사람',
    ],
    amount: [
      // 기본 금액
      '금액', '요금', '비용', '가격',
      // 동의어
      '돈', '수강료', '학비', '납부액', '결제액',
      // 미납 관련
      '미납액', '연체액', '미결제액', '미납 금액', '연체 금액',
    ],
    month: ['월', '기간'],
    class_name: ['반', '클래스'],
    grade: ['학년', '학급'],
    guardian: ['보호자'],
    total_count: ['개수', '건수', '명수'],
  };

  // 키워드 매칭 (표시 보조용)
  for (const [field, keywords] of Object.entries(fieldKeywords)) {
    if (keywords.some(keyword => messageLower.includes(keyword))) {
      requestedFields.add(field);
      // 보호자 키워드는 guardian_name과 guardian_contact도 추가
      if (field === 'guardian') {
        requestedFields.add('guardian_name');
        requestedFields.add('guardian_contact');
      }
    }
  }

  // 전체 표시 여부 (표시 보조용)
  const showAll = messageLower.includes('전체') ||
                  messageLower.includes('모두') ||
                  messageLower.includes('상세') ||
                  messageLower.includes('프로필') ||
                  messageLower.includes('정보') ||
                  requestedFields.size === 0;

  return { requestedFields, showAll };
}

/**
 * 필드명을 한글로 변환
 */
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: '이름',
    phone: '전화번호',
    email: '이메일',
    date: '날짜',
    time: '시간',
    status: '상태',
    amount: '금액',
    month: '월',
    class_name: '반',
    grade: '학년',
    guardian_name: '보호자 이름',
    guardian_contact: '보호자 연락처',
    total_count: '총 개수',
    student_name: '학생 이름',
    late_time: '지각 시간',
    student_id: '학생 ID',
  };
  return labels[field] || field;
}

/**
 * 값 포맷팅
 */
function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'number') {
    if (field.includes('amount') || field.includes('금액')) {
      return `${value.toLocaleString()}원`;
    }
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? '예' : '아니오';
  }

  return String(value);
}

export const ChatOpsPanel: React.FC<ChatOpsPanelProps> = ({
  messages,
  isLoading = false,
  onSendMessage,
  onSelectCandidate,
  onApprovePlan,
  onRequestApproval,
  onViewActivity,
  onViewTaskCard,
  onReset,
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
                  const originalMessage = (message.metadata?.original_message as string) || '';

                  // 원본 메시지에서 요청한 정보 추출
                  const messageLower = originalMessage.toLowerCase();
                  const requestedFields = new Set<string>();

                  // 전화번호 관련 키워드 (구체적인 키워드 우선)
                  if (messageLower.includes('전화번호') || messageLower.includes('전화') || messageLower.includes('연락처') ||
                      (messageLower.includes('번호') && (messageLower.includes('전화') || messageLower.includes('핸드폰') || messageLower.includes('폰')))) {
                    requestedFields.add('phone');
                    requestedFields.add('guardian_contact');
                  }

                  // 이름 관련 키워드
                  if (messageLower.includes('이름')) {
                    requestedFields.add('name');
                  }

                  // 반 관련 키워드
                  if (messageLower.includes('반') || messageLower.includes('클래스')) {
                    requestedFields.add('class_name');
                  }

                  // 상태 관련 키워드
                  if (messageLower.includes('상태') || messageLower.includes('재학') || messageLower.includes('휴원') || messageLower.includes('퇴원')) {
                    requestedFields.add('status');
                  }

                  // 학년 관련 키워드
                  if (messageLower.includes('학년') || messageLower.includes('학급')) {
                    requestedFields.add('grade');
                  }

                  // 보호자 관련 키워드
                  if (messageLower.includes('보호자')) {
                    requestedFields.add('guardian_name');
                    requestedFields.add('guardian_contact');
                  }

                  // 프로필/정보 관련 키워드가 있으면 전체 표시
                  const showAll = messageLower.includes('프로필') || messageLower.includes('정보') || messageLower.includes('상세') || requestedFields.size === 0;

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
                        {/* 이름은 항상 표시 (요청한 정보 식별용) */}
                        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                          <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                            {student.name || '이름 없음'}
                          </div>
                            {(showAll || requestedFields.has('grade')) && student.grade && (
                            <div style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--spacing-xs)' }}>
                              {student.grade}
                            </div>
                          )}
                            {(showAll || requestedFields.has('class_name')) && student.class_name && (
                            <div style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--spacing-xs)' }}>
                              반: {student.class_name}
                            </div>
                          )}
                            {(showAll || requestedFields.has('status')) && student.status && (
                            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                              <Badge variant="outline" color={student.status === 'active' ? 'success' : 'gray'}>
                                {student.status === 'active' ? '재학' : student.status}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* 전화번호 요청한 경우 표시 */}
                        {(showAll || requestedFields.has('phone')) && (student.phone || student.guardian_contact) && (
                          <div style={{
                            color: 'var(--color-text)',
                            fontSize: requestedFields.has('phone') && !showAll ? 'var(--font-size-base)' : 'var(--font-size-sm)',
                            marginTop: requestedFields.has('phone') && !showAll ? 0 : 'var(--spacing-xs)',
                            marginBottom: requestedFields.has('phone') && !showAll ? 0 : 'var(--spacing-xs)',
                          }}>
                            {requestedFields.has('phone') && !showAll ? (
                              // 전화번호만 요청한 경우 간단히 표시
                              <div>{student.phone || student.guardian_contact || '전화번호 없음'}</div>
                            ) : (
                              // 전체 프로필인 경우 라벨과 함께 표시
                              <div>
                                <span style={{ fontWeight: 'var(--font-weight-medium)', marginRight: 'var(--spacing-xs)' }}>
                                  전화번호:
                                </span>
                                <span>{student.phone || student.guardian_contact || '전화번호 없음'}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 보호자 정보 (전체 프로필이거나 보호자 정보를 요청한 경우) */}
                        {(showAll || requestedFields.has('guardian_name') || requestedFields.has('guardian_contact')) && (student.guardian_name || student.guardian_contact) && (
                          <div style={{
                            paddingTop: 'var(--spacing-sm)',
                            borderTop: 'var(--border-width-thin) solid var(--color-gray-200)',
                            marginTop: 'var(--spacing-sm)',
                          }}>
                            {(showAll || requestedFields.has('guardian_name')) && (
                              <>
                            <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)' }}>
                              보호자 정보
                            </div>
                            {student.guardian_name && (
                              <div style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--spacing-xs)' }}>
                                {student.guardian_name}
                              </div>
                            )}
                              </>
                            )}
                            {(showAll || requestedFields.has('guardian_contact')) && student.guardian_contact && (
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

                // attendance.query.by_student: 출결 기록 조회
                if (intentKey === 'attendance.query.by_student' && l0Result?.records) {
                  const records = l0Result.records as Array<{ date: string; status: string; time: string }>;
                  const originalMessage = (message.metadata?.original_message as string) || '';
                  const messageLower = originalMessage.toLowerCase();

                  // 날짜/시간 관련 키워드 (명시적 요청만 감지)
                  const showDate = messageLower.includes('날짜') || messageLower.includes('일자');
                  const showTime = messageLower.includes('시간') || messageLower.includes('시각');
                  const showStatus = messageLower.includes('상태') || messageLower.includes('출석') || messageLower.includes('결석') || messageLower.includes('지각');
                  // 전체 표시: 명시적 요청이 있거나, 아무 필드도 요청하지 않은 경우
                  const showAll = messageLower.includes('전체') || messageLower.includes('모두') || messageLower.includes('상세') || (!showDate && !showTime && !showStatus);

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
                          조회 결과 ({records.length}건)
                        </Badge>
                      </div>
                      <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                        {records.slice(0, 10).map((record, idx) => (
                          <div key={idx} style={{ marginBottom: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)', borderBottom: idx < records.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                            {(showAll || showDate) && <span style={{ marginRight: 'var(--spacing-sm)' }}>{record.date}</span>}
                            {(showAll || showTime) && <span style={{ marginRight: 'var(--spacing-sm)', color: 'var(--color-gray-600)' }}>{record.time}</span>}
                            {(showAll || showStatus) && (
                              <Badge variant="outline" color={record.status === 'present' ? 'success' : record.status === 'absent' ? 'error' : 'warning'}>
                                {record.status === 'present' ? '출석' : record.status === 'absent' ? '결석' : record.status === 'late' ? '지각' : record.status}
                              </Badge>
                            )}
                          </div>
                        ))}
                        {records.length > 10 && (
                          <div style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
                            외 {records.length - 10}건...
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                }

                // attendance.query.late: 지각 학생 조회
                if (intentKey === 'attendance.query.late' && l0Result?.students) {
                  const students = l0Result.students as Array<{ id: string; name: string; class_name: string; late_time: string }>;
                  const originalMessage = (message.metadata?.original_message as string) || '';
                  const messageLower = originalMessage.toLowerCase();

                  // 명시적 필드 요청만 감지 (기본값 제거)
                  const showName = messageLower.includes('이름') || messageLower.includes('학생');
                  const showClass = messageLower.includes('반') || messageLower.includes('클래스');
                  const showTime = messageLower.includes('시간') || messageLower.includes('시각');
                  // 전체 표시: 명시적 요청이 있거나, 아무 필드도 요청하지 않은 경우
                  const showAll = messageLower.includes('전체') || messageLower.includes('모두') || messageLower.includes('상세') || (!showName && !showClass && !showTime);

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
                          조회 결과 ({students.length}명)
                        </Badge>
                      </div>
                      <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                        {students.slice(0, 10).map((student, idx) => (
                          <div key={student.id} style={{ marginBottom: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)', borderBottom: idx < students.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                            {/* 이름은 항상 표시 (식별용) */}
                            <span style={{ fontWeight: 'var(--font-weight-medium)', marginRight: 'var(--spacing-sm)' }}>{student.name}</span>
                            {(showAll || showClass) && student.class_name && <span style={{ color: 'var(--color-gray-600)', marginRight: 'var(--spacing-sm)' }}>{student.class_name}</span>}
                            {(showAll || showTime) && student.late_time && <span style={{ color: 'var(--color-gray-600)' }}>{student.late_time}</span>}
                          </div>
                        ))}
                        {students.length > 10 && (
                          <div style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
                            외 {students.length - 10}명...
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                }

                // billing.query.by_student: 청구 내역 조회
                if (intentKey === 'billing.query.by_student' && l0Result?.invoices) {
                  const invoices = l0Result.invoices as Array<{ id: string; month: string; amount: number; status: string }>;
                  const originalMessage = (message.metadata?.original_message as string) || '';
                  const messageLower = originalMessage.toLowerCase();

                  // 명시적 필드 요청만 감지
                  const showMonth = messageLower.includes('월') || messageLower.includes('기간');
                  const showAmount = messageLower.includes('금액') || messageLower.includes('요금') || messageLower.includes('비용') || messageLower.includes('돈');
                  const showStatus = messageLower.includes('상태') || messageLower.includes('미납') || messageLower.includes('납부') || messageLower.includes('결제');
                  // 전체 표시: 명시적 요청이 있거나, 아무 필드도 요청하지 않은 경우
                  const showAll = messageLower.includes('전체') || messageLower.includes('모두') || messageLower.includes('상세') || (!showMonth && !showAmount && !showStatus);

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
                          조회 결과 ({invoices.length}건)
                        </Badge>
                      </div>
                      <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                        {invoices.slice(0, 10).map((invoice, idx) => (
                          <div key={invoice.id} style={{ marginBottom: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)', borderBottom: idx < invoices.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                            {(showAll || showMonth) && <span style={{ marginRight: 'var(--spacing-sm)' }}>{invoice.month}</span>}
                            {(showAll || showAmount) && <span style={{ marginRight: 'var(--spacing-sm)', fontWeight: 'var(--font-weight-medium)' }}>{invoice.amount.toLocaleString()}원</span>}
                            {(showAll || showStatus) && (
                              <Badge variant="outline" color={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'error' : 'warning'}>
                                {invoice.status === 'paid' ? '납부' : invoice.status === 'overdue' ? '미납' : invoice.status === 'unissued' ? '미발행' : invoice.status}
                              </Badge>
                            )}
                          </div>
                        ))}
                        {invoices.length > 10 && (
                          <div style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
                            외 {invoices.length - 10}건...
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                }

                // class.query.roster: 반 명단 조회
                if (intentKey === 'class.query.roster' && l0Result?.students) {
                  const students = l0Result.students as Array<{ id: string; name: string; status: string }>;
                  const originalMessage = (message.metadata?.original_message as string) || '';
                  const messageLower = originalMessage.toLowerCase();

                  // 명시적 필드 요청만 감지
                  const showName = messageLower.includes('이름') || messageLower.includes('학생');
                  const showStatus = messageLower.includes('상태') || messageLower.includes('재학') || messageLower.includes('휴원') || messageLower.includes('퇴원');
                  // 전체 표시: 명시적 요청이 있거나, 아무 필드도 요청하지 않은 경우
                  const showAll = messageLower.includes('전체') || messageLower.includes('모두') || messageLower.includes('명단') || messageLower.includes('상세') || (!showName && !showStatus);

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
                          조회 결과 ({students.length}명)
                        </Badge>
                      </div>
                      <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                        {students.slice(0, 20).map((student, idx) => (
                          <div key={student.id} style={{ marginBottom: 'var(--spacing-xs)', paddingBottom: 'var(--spacing-xs)', borderBottom: idx < students.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                            {(showAll || showName) && <span style={{ marginRight: 'var(--spacing-sm)' }}>{student.name}</span>}
                            {(showAll || showStatus) && (
                              <Badge variant="outline" color={student.status === 'active' ? 'success' : 'gray'}>
                                {student.status === 'active' ? '재학' : student.status}
                              </Badge>
                            )}
                          </div>
                        ))}
                        {students.length > 20 && (
                          <div style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
                            외 {students.length - 20}명...
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                }

                // student.query.search: 학생 검색
                if (intentKey === 'student.query.search' && l0Result?.students) {
                  const students = l0Result.students as Array<{ id: string; name: string; [key: string]: unknown }>;
                  const originalMessage = (message.metadata?.original_message as string) || '';
                  const messageLower = originalMessage.toLowerCase();

                  // 검색 결과는 이름만 표시하는 것이 일반적
                  const showAll = messageLower.includes('전체') || messageLower.includes('모두') || messageLower.includes('상세');

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
                          검색 결과 ({students.length}명)
                        </Badge>
                      </div>
                      <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                        {students.slice(0, 20).map((student) => (
                          <div key={student.id} style={{ marginBottom: 'var(--spacing-xs)' }}>
                            {student.name || '이름 없음'}
                          </div>
                        ))}
                        {students.length > 20 && (
                          <div style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
                            외 {students.length - 20}명...
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                }

                // 범용 필터링 적용: 모든 Intent에 대해 원본 메시지 기반 필터링
                const originalMessage = (message.metadata?.original_message as string) || '';
                const { requestedFields, showAll } = extractRequestedFields(originalMessage);

                // 범용 렌더링 함수: 객체나 배열을 필터링하여 표시
                const renderFilteredResult = (data: any, title: string = '조회 결과'): React.ReactNode => {
                  // 배열인 경우 (students, records, invoices 등)
                  if (Array.isArray(data)) {
                    if (data.length === 0) {
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
                          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            조회 결과가 없습니다.
                          </div>
                        </Card>
                      );
                    }

                    // 첫 번째 항목의 필드 확인
                    const firstItem = data[0];
                    if (!firstItem) {
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
                          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            조회 결과가 없습니다.
                          </div>
                        </Card>
                      );
                    }

                    const fields = Object.keys(firstItem);

                    // 필드명 매핑 (필터링에 사용)
                    const fieldKeywordsMap: Record<string, string[]> = {
                      name: ['이름', '성명'],
                      phone: ['전화번호', '전화', '연락처'],
                      email: ['이메일', '메일'],
                      date: ['날짜', '일자'],
                      time: ['시간', '시각'],
                      status: ['상태'],
                      amount: ['금액', '요금', '비용'],
                      month: ['월', '기간'],
                      class_name: ['반', '클래스'],
                      grade: ['학년'],
                      guardian_name: ['보호자'],
                      guardian_contact: ['보호자', '전화번호'],
                    };

                    // 필터링된 필드만 추출
                    let visibleFields = showAll
                      ? fields
                      : fields.filter(field => {
                          const fieldLower = field.toLowerCase();
                          return requestedFields.has(field) ||
                                 requestedFields.has(fieldLower) ||
                                 fieldKeywordsMap[field]?.some(keyword => originalMessage.toLowerCase().includes(keyword));
                        });

                    // 필터링 결과가 비어있으면 전체 표시
                    if (visibleFields.length === 0 && !showAll) {
                      visibleFields = fields;
                    }

                    // 식별 필드(name, id 등)는 항상 표시 (요청한 필드가 있을 때만)
                    if (!showAll && visibleFields.length > 0) {
                      const identifierFields = ['name', 'id', 'student_id', 'person_id', 'class_id'];
                      identifierFields.forEach(idField => {
                        if (fields.includes(idField) && !visibleFields.includes(idField)) {
                          visibleFields.unshift(idField); // 맨 앞에 추가
                        }
                      });
                    }

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
                            {title} ({data.length}건)
                          </Badge>
                        </div>
                        <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                          {data.slice(0, 20).map((item: any, idx: number) => (
                            <div
                              key={item.id || idx}
                              style={{
                                marginBottom: 'var(--spacing-xs)',
                                paddingBottom: 'var(--spacing-xs)',
                                borderBottom: idx < Math.min(data.length, 20) - 1 ? '1px solid var(--color-gray-200)' : 'none'
                              }}
                            >
                              {visibleFields.map((field) => {
                                const value = item[field];
                                if (value === null || value === undefined || value === '') return null;

                                return (
                                  <span key={field} style={{ marginRight: 'var(--spacing-sm)' }}>
                                    {field === 'status' ? (
                                      <Badge variant="outline" color={
                                        value === 'active' || value === 'present' || value === 'paid' ? 'success' :
                                        value === 'absent' || value === 'overdue' ? 'error' : 'warning'
                                      }>
                                        {value === 'active' ? '재학' :
                                         value === 'present' ? '출석' :
                                         value === 'absent' ? '결석' :
                                         value === 'paid' ? '납부' :
                                         value === 'overdue' ? '미납' : value}
                                      </Badge>
                                    ) : field === 'amount' ? (
                                      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                                        {typeof value === 'number' ? `${value.toLocaleString()}원` : value}
                                      </span>
                                    ) : field === 'name' || field.includes('name') ? (
                                      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{value}</span>
                                    ) : (
                                      <span style={{ color: 'var(--color-gray-600)' }}>{value}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          ))}
                          {data.length > 20 && (
                            <div style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
                              외 {data.length - 20}건...
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  }

                  // 객체인 경우 (student, invoice 등 단일 객체)
                  if (typeof data === 'object' && data !== null) {
                    const fields = Object.keys(data);

                    // 필드명 매핑 (필터링에 사용)
                    const fieldKeywordsMap: Record<string, string[]> = {
                      name: ['이름', '성명'],
                      phone: ['전화번호', '전화', '연락처'],
                      email: ['이메일', '메일'],
                      date: ['날짜', '일자'],
                      time: ['시간', '시각'],
                      status: ['상태'],
                      amount: ['금액', '요금', '비용'],
                      month: ['월', '기간'],
                      class_name: ['반', '클래스'],
                      grade: ['학년'],
                      guardian_name: ['보호자'],
                      guardian_contact: ['보호자', '전화번호'],
                    };

                    let visibleFields = showAll
                      ? fields
                      : fields.filter(field => {
                          const fieldLower = field.toLowerCase();
                          return requestedFields.has(field) ||
                                 requestedFields.has(fieldLower) ||
                                 fieldKeywordsMap[field]?.some(keyword => originalMessage.toLowerCase().includes(keyword));
                        });

                    // 필터링 결과가 비어있으면 전체 표시
                    if (visibleFields.length === 0 && !showAll) {
                      visibleFields = fields;
                    }

                    // 식별 필드(name, id 등)는 항상 표시 (요청한 필드가 있을 때만)
                    if (!showAll && visibleFields.length > 0) {
                      const identifierFields = ['name', 'id', 'student_id', 'person_id', 'class_id'];
                      identifierFields.forEach(idField => {
                        if (fields.includes(idField) && !visibleFields.includes(idField)) {
                          visibleFields.unshift(idField); // 맨 앞에 추가
                        }
                      });
                    }

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
                            {title}
                          </Badge>
                        </div>
                        <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                          {visibleFields.map((field) => {
                            const value = data[field];
                            if (value === null || value === undefined || value === '') return null;

                            return (
                              <div key={field} style={{ marginBottom: 'var(--spacing-xs)' }}>
                                <span style={{ fontWeight: 'var(--font-weight-medium)', marginRight: 'var(--spacing-xs)' }}>
                                  {getFieldLabel(field)}:
                                </span>
                                {field === 'status' ? (
                                  <Badge variant="outline" color={
                                    value === 'active' || value === 'present' || value === 'paid' ? 'success' :
                                    value === 'absent' || value === 'overdue' ? 'error' : 'warning'
                                  }>
                                    {value === 'active' ? '재학' :
                                     value === 'present' ? '출석' :
                                     value === 'absent' ? '결석' :
                                     value === 'paid' ? '납부' :
                                     value === 'overdue' ? '미납' : value}
                                  </Badge>
                                ) : (
                                  <span>{formatValue(field, value)}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  }

                  // 기타: JSON 형식으로 표시
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
                          {title}
                        </Badge>
                      </div>
                      <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, maxHeight: '400px', overflow: 'auto' }}>
                          {JSON.stringify(data, null, 2) as string}
                        </pre>
                      </div>
                    </Card>
                  );
                };

                // 특수 Intent는 기존 로직 유지, 나머지는 범용 함수 사용
                // 이미 처리된 Intent는 제외하고 범용 함수 적용
                const specialIntents = [
                  'student.query.profile',
                  'attendance.query.by_student',
                  'attendance.query.late',
                  'billing.query.by_student',
                  'class.query.roster',
                  'student.query.search',
                ];

                if (!specialIntents.includes(intentKey || '')) {
                  // 범용 필터링 적용
                  if (l0Result) {
                    // students, records, invoices 등 배열 필드 찾기
                    if (l0Result.students) {
                      return renderFilteredResult(l0Result.students, '조회 결과');
                    }
                    if (l0Result.records) {
                      return renderFilteredResult(l0Result.records, '조회 결과');
                    }
                    if (l0Result.invoices) {
                      return renderFilteredResult(l0Result.invoices, '조회 결과');
                    }
                    if (l0Result.classes) {
                      return renderFilteredResult(l0Result.classes, '조회 결과');
                    }
                    // 단일 객체인 경우
                    if (l0Result.student) {
                      return renderFilteredResult(l0Result.student, '조회 결과');
                    }
                    if (l0Result.invoice) {
                      return renderFilteredResult(l0Result.invoice, '조회 결과');
                    }
                    // 기타: 전체 결과 필터링
                    return renderFilteredResult(l0Result, '조회 결과');
                  }
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
      {/* 헤더 영역 (초기화 버튼) */}
      {messages.length > 0 && onReset && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
            backgroundColor: 'var(--color-white)',
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isLoading}
          >
            초기화
          </Button>
        </div>
      )}

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
