/**
 * BulkMessagePage - 태그 기반 회원 필터링 + 수동 메시지 발송 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [불변 규칙] 업종 중립 용어 사용 (useIndustryTerms)
 * [불변 규칙] CSS 변수 사용 (design-system 토큰)
 *
 * 핵심 기능:
 * - 태그 버튼 클릭 시 조건에 맞는 회원 자동 필터링
 * - 2-컬럼 레이아웃: 좌측 태그, 우측 필터링 결과 + 발송
 * - 템플릿 선택 + 수동 발송
 * - 태그 관리 (생성/수정/삭제)
 * - 알림톡 우선, SMS 폴백
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ErrorBoundary,
  useModal,
  Modal,
  Card,
  Button,
  Spinner,
  Select,
  EmptyState,
  Input,
  Textarea,
} from '@ui-core/react';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { useApplyFilterTag, useFilterTags } from '@hooks/use-filter-tags';
import { useNotificationTemplates, useCreateNotificationTemplate } from '@hooks/use-notification-templates';
import { createExecutionAuditRecord } from '@hooks/use-student/src/execution-audit-utils';
import { FilterTagList, FilteredStudentTable, FilterTagManageModal, AIMessageSuggestion, AIFilterRecommendation, MessageStats } from '../components/messaging';
import { Settings, Send, Users, Plus } from 'lucide-react';
import type { FilterTag } from '@hooks/use-ai-message';

export function BulkMessagePage() {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();
  const terms = useIndustryTerms();

  // 상태 관리
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<null>(null);
  const [customMessageTitle, setCustomMessageTitle] = useState<string>('');
  const [customMessageContent, setCustomMessageContent] = useState<string>('');
  // 템플릿 생성 모달 상태
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [newTemplateContent, setNewTemplateContent] = useState<string>('');

  // 필터 태그 목록 조회 (선택된 태그 정보 표시용)
  const { data: filterTags } = useFilterTags();

  // 선택된 태그 정보
  const selectedTag = useMemo(() => {
    if (!selectedTagId || !filterTags) return null;
    return filterTags.find((tag) => tag.id === selectedTagId) || null;
  }, [selectedTagId, filterTags]);

  // 필터 태그 적용하여 회원 필터링
  const {
    data: filteredStudents,
    isLoading: isFilteringStudents,
    error: filterError,
  } = useApplyFilterTag(selectedTagId);

  // 템플릿 목록 조회
  const { data: templates, isLoading: isLoadingTemplates } = useNotificationTemplates();

  // 템플릿 생성 Mutation
  const createTemplateMutation = useCreateNotificationTemplate();

  // 템플릿 옵션 생성
  const templateOptions = useMemo(() => {
    if (!templates) return [{ value: '', label: '템플릿 선택...' }];
    return [
      { value: '', label: '템플릿 선택...' },
      ...templates.map((t) => ({
        value: t.id,
        label: t.name,
      })),
    ];
  }, [templates]);

  // 메시지 발송 Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      if (!tenantId) throw new Error('tenantId is required');
      if (!selectedTemplateId) throw new Error('템플릿을 선택해주세요.');
      if (studentIds.length === 0) throw new Error('발송 대상을 선택해주세요.');

      const startTime = Date.now();

      // message_outbox에 발송 요청 등록 (Outbox 패턴)
      const response = await apiClient.post('message_outbox', {
        tenant_id: tenantId,
        intent_key: 'message.manual.tag_filtered',
        student_ids: studentIds,
        channel: 'alimtalk', // 알림톡 우선 (폴백은 발송 핸들러에서 처리)
        template_id: selectedTemplateId,
        status: 'pending',
        idempotency_key: `bulk-${selectedTagId}-${Date.now()}`,
        metadata: {
          filter_tag_id: selectedTagId,
          requested_at: new Date().toISOString(),
          requested_by: session?.user?.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록
      if (session?.user?.id && tenantId) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'messaging.send-bulk-filtered',
            status: 'success',
            summary: `태그 기반 일괄 메시지 발송 요청 (${studentIds.length}명)`,
            details: {
              student_count: studentIds.length,
              filter_tag_id: selectedTagId,
              template_id: selectedTemplateId,
            },
            reference: {
              entity_type: 'message_outbox',
              entity_id: String((response.data as { id: string })?.id || ''),
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['message-outbox', tenantId] });
      showAlert(
        `${filteredStudents?.length || 0}명에게 메시지 발송을 예약했습니다.`,
        terms.MESSAGES.SUCCESS
      );
      // 선택 초기화
      setSelectedTagId(null);
      setSelectedTemplateId('');
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });

  // 태그 클릭 핸들러
  const handleTagClick = useCallback((tagId: string) => {
    setSelectedTagId((prev) => (prev === tagId ? null : tagId));
  }, []);

  // 메시지 발송 핸들러
  const handleSendMessage = useCallback(
    (studentIds: string[]) => {
      if (!selectedTemplateId) {
        showAlert('메시지 템플릿을 선택해주세요.', '알림');
        return;
      }

      const confirmMessage = `${studentIds.length}명에게 메시지를 발송하시겠습니까?\n(알림톡 우선, 실패 시 SMS 자동 전환)`;
      if (window.confirm(confirmMessage)) {
        sendMessageMutation.mutate(studentIds);
      }
    },
    [selectedTemplateId, showAlert, sendMessageMutation]
  );

  // 태그 관리 모달 열기
  const handleOpenManageModal = useCallback(() => {
    setEditingTag(null);
    setIsManageModalOpen(true);
  }, []);

  // AI 메시지 제안 적용 핸들러
  const handleApplyAISuggestion = useCallback((title: string, content: string) => {
    setCustomMessageTitle(title);
    setCustomMessageContent(content);
    // 템플릿 선택 초기화 (커스텀 메시지 우선)
    setSelectedTemplateId('');
  }, []);

  // AI 필터 추천 적용 핸들러
  const handleApplyFilterRecommendation = useCallback((tagIds: string[]) => {
    if (tagIds.length > 0) {
      // 첫 번째 추천 태그 선택
      setSelectedTagId(tagIds[0]);
    }
  }, []);

  // 템플릿 생성 핸들러
  const handleCreateTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      showAlert('템플릿 이름을 입력해주세요.', '알림');
      return;
    }
    if (!newTemplateContent.trim()) {
      showAlert('템플릿 내용을 입력해주세요.', '알림');
      return;
    }

    try {
      await createTemplateMutation.mutateAsync({
        name: newTemplateName.trim(),
        content: newTemplateContent.trim(),
        channel: 'kakao', // 알림톡 기본
      });
      showAlert('템플릿이 생성되었습니다.', terms.MESSAGES.SUCCESS);
      setIsCreateTemplateModalOpen(false);
      setNewTemplateName('');
      setNewTemplateContent('');
    } catch (error) {
      showAlert(
        `템플릿 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        terms.MESSAGES.ERROR
      );
    }
  }, [newTemplateName, newTemplateContent, createTemplateMutation, showAlert, terms]);

  // AI 생성 메시지를 템플릿으로 저장하는 핸들러
  const handleSaveAIMessageAsTemplate = useCallback(() => {
    if (customMessageContent) {
      setNewTemplateName(customMessageTitle || 'AI 생성 템플릿');
      setNewTemplateContent(customMessageContent);
      setIsCreateTemplateModalOpen(true);
    }
  }, [customMessageTitle, customMessageContent]);

  // 필터 태그를 AI 훅 형식으로 변환
  const aiFilterTags = useMemo<FilterTag[]>(() => {
    if (!selectedTag) return [];
    return [
      {
        id: selectedTag.id,
        name: selectedTag.display_label,
        type: 'custom' as const,
      },
    ];
  }, [selectedTag]);

  return (
    <ErrorBoundary>
      {/* 2-컬럼 레이아웃: 좌측 태그, 우측 필터링 결과 */}
      {/* 부모 Container의 padding을 무효화하고 전체 너비 사용 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: 0,
          alignItems: 'start',
          marginLeft: 'calc(-1 * var(--spacing-lg))',
          marginRight: 'calc(-1 * var(--spacing-lg))',
        }}
      >
          {/* 좌측: 태그 필터 */}
          <div
            style={{
              padding: 'var(--spacing-lg)',
              borderRight: 'var(--border-width-thin) solid var(--color-border)',
              minHeight: '100vh',
            }}
          >
            {/* 인기태그 섹션 */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                <h3
                  style={{
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                  }}
                >
                  인기태그
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenManageModal}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
                >
                  <Settings size={16} />
                </Button>
              </div>
              <FilterTagList
                onTagClick={handleTagClick}
                selectedTagId={selectedTagId}
                showCounts={true}
                categoryFilter="popular"
              />
            </div>

            {/* 전체 태그 섹션 */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h3
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                전체 태그
              </h3>
              <FilterTagList
                onTagClick={handleTagClick}
                selectedTagId={selectedTagId}
                showCounts={false}
              />
            </div>

            {/* 발송 통계 섹션 */}
            <MessageStats />
          </div>

          {/* 우측: AI 필터 추천 + 필터링 결과 + 발송 */}
          <div style={{ padding: 'var(--spacing-lg)' }}>
            {/* AI 필터 추천 섹션 */}
            {session?.access_token && (
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <AIFilterRecommendation
                  tenantId={tenantId || ''}
                  accessToken={session.access_token}
                  onApplyRecommendation={handleApplyFilterRecommendation}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              {!selectedTagId ? (
                // 태그 미선택 시 안내
                <Card padding="lg">
                  <EmptyState
                    icon={Users}
                    message={`좌측에서 태그를 선택하면 조건에 맞는 ${terms.PERSON_LABEL_PRIMARY} 목록이 표시됩니다.`}
                  />
                </Card>
              ) : isFilteringStudents ? (
                // 필터링 중 로딩
                <Card padding="lg">
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--spacing-xl)', height: '200px' }}>
                    <Spinner size="lg" />
                  </div>
                </Card>
              ) : filterError ? (
                // 필터링 오류
                <Card padding="lg">
                  <div
                    style={{
                      padding: 'var(--spacing-lg)',
                      textAlign: 'center',
                      color: 'var(--color-danger)',
                    }}
                  >
                    필터링 중 오류가 발생했습니다: {filterError instanceof Error ? filterError.message : String(filterError)}
                  </div>
                </Card>
              ) : (
                // 필터링 결과 표시
                <>
                  {/* 선택된 태그 표시 */}
                  {selectedTag && (
                    <Card padding="md">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <span
                          style={{
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            backgroundColor: selectedTag.color,
                            color: 'var(--color-white)',
                            borderRadius: 'var(--border-radius-sm)',
                            fontSize: 'var(--font-size-base)',
                            fontWeight: 'var(--font-weight-semibold)',
                          }}
                        >
                          {selectedTag.display_label}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                          필터링 결과
                        </span>
                      </div>
                    </Card>
                  )}

                  {/* 필터링된 회원 목록 */}
                  <Card padding="lg">
                    <FilteredStudentTable
                      students={filteredStudents || []}
                      isLoading={false}
                      onSendMessage={handleSendMessage}
                      isSending={sendMessageMutation.isPending}
                    />
                  </Card>

                  {/* AI 메시지 제안 섹션 (필터링 결과가 있을 때만 표시) */}
                  {filteredStudents && filteredStudents.length > 0 && session?.access_token && (
                    <div>
                      <AIMessageSuggestion
                        tenantId={tenantId || ''}
                        accessToken={session.access_token}
                        filterTags={aiFilterTags}
                        targetCount={filteredStudents.length}
                        onApplySuggestion={handleApplyAISuggestion}
                      />
                    </div>
                  )}

                  {/* 템플릿 선택 섹션 (필터링 결과가 있을 때만 표시) */}
                  {filteredStudents && filteredStudents.length > 0 && (
                    <Card padding="lg" style={{ backgroundColor: 'var(--color-gray-50)' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 'var(--spacing-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                          <Send size={16} style={{ color: 'var(--color-primary)' }} />
                          <h4
                            style={{
                              fontSize: 'var(--font-size-base)',
                              fontWeight: 'var(--font-weight-semibold)',
                              margin: 0,
                            }}
                          >
                            메시지 템플릿
                          </h4>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsCreateTemplateModalOpen(true)}
                          style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
                        >
                          <Plus size={14} />
                          새 템플릿
                        </Button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {isLoadingTemplates ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <Spinner size="sm" />
                            <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                              템플릿 로딩 중...
                            </span>
                          </div>
                        ) : (
                          <Select
                            value={selectedTemplateId}
                            onChange={(value) => setSelectedTemplateId(Array.isArray(value) ? value[0] || '' : value)}
                            options={templateOptions}
                          />
                        )}

                        {selectedTemplateId && (
                          <div
                            style={{
                              padding: 'var(--spacing-sm)',
                              backgroundColor: 'var(--color-white)',
                              borderRadius: 'var(--border-radius-sm)',
                              border: 'var(--border-width-thin) solid var(--color-border)',
                            }}
                          >
                            <p
                              style={{
                                fontSize: 'var(--font-size-base)',
                                color: 'var(--color-text-primary)',
                                whiteSpace: 'pre-wrap',
                                margin: 0,
                              }}
                            >
                              {templates?.find((t) => t.id === selectedTemplateId)?.content || ''}
                            </p>
                          </div>
                        )}

                        {/* AI 생성 커스텀 메시지 미리보기 */}
                        {customMessageContent && !selectedTemplateId && (
                          <div
                            style={{
                              padding: 'var(--spacing-sm)',
                              backgroundColor: 'var(--color-blue-50)',
                              borderRadius: 'var(--border-radius-sm)',
                              border: 'var(--border-width-thin) solid var(--color-blue-200)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 'var(--spacing-xs)',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 'var(--font-size-base)',
                                  fontWeight: 'var(--font-weight-semibold)',
                                  color: 'var(--color-blue-700)',
                                }}
                              >
                                AI 생성 메시지
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveAIMessageAsTemplate}
                                style={{ color: 'var(--color-blue-700)' }}
                              >
                                템플릿으로 저장
                              </Button>
                            </div>
                            <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                              <span
                                style={{
                                  fontSize: 'var(--font-size-base)',
                                  fontWeight: 'var(--font-weight-medium)',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                제목: {customMessageTitle}
                              </span>
                            </div>
                            <p
                              style={{
                                fontSize: 'var(--font-size-base)',
                                color: 'var(--color-text-primary)',
                                whiteSpace: 'pre-wrap',
                                margin: 0,
                              }}
                            >
                              {customMessageContent}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      {/* 태그 관리 모달 */}
      <FilterTagManageModal
        isOpen={isManageModalOpen}
        onClose={() => {
          setIsManageModalOpen(false);
          setEditingTag(null);
        }}
        editingTag={editingTag}
      />

      {/* 템플릿 생성 모달 */}
      <Modal
        isOpen={isCreateTemplateModalOpen}
        onClose={() => {
          setIsCreateTemplateModalOpen(false);
          setNewTemplateName('');
          setNewTemplateContent('');
        }}
        title="새 메시지 템플릿 만들기"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              템플릿 이름
            </label>
            <Input
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="예: 수업 안내 메시지"
              fullWidth
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              메시지 내용
            </label>
            <Textarea
              value={newTemplateContent}
              onChange={(e) => setNewTemplateContent(e.target.value)}
              placeholder="메시지 내용을 입력하세요..."
              rows={6}
              fullWidth
            />
            <p
              style={{
                marginTop: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              변수 사용 가능: {'{{student_name}}'}, {'{{class_name}}'}, {'{{date}}'} 등
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateTemplateModalOpen(false);
                setNewTemplateName('');
                setNewTemplateContent('');
              }}
            >
              취소
            </Button>
            <Button
              variant="solid"
              onClick={handleCreateTemplate}
              disabled={createTemplateMutation.isPending}
            >
              {createTemplateMutation.isPending ? '생성 중...' : '템플릿 생성'}
            </Button>
          </div>
        </div>
      </Modal>
    </ErrorBoundary>
  );
}

export default BulkMessagePage;
