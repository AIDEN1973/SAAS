/**
 * 메시지/공지 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 자동 알림(등원/하원, 청구 생성, 미납 알림), 수동 메시지, 단체문자, 템플릿 관리, 예약 발송, 발송 내역 조회
 */

import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOptimizedQuery } from '@hooks/use-optimized-query';
import { ErrorBoundary, useModal, Modal, Container, Card, Button, Badge, useResponsiveMode, Drawer, PageHeader, useIconSize, useIconStrokeWidth, isMobile, isTablet } from '@ui-core/react';
import { SchemaForm, SchemaTable } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { createExecutionAuditRecord } from '@hooks/use-student/src/execution-audit-utils';
import type { Notification, NotificationStatus } from '@core/notification';
import { notificationFormSchema } from '../schemas/notification.schema';
import { notificationTemplateFormSchema } from '../schemas/notification-template.schema';
import { bulkNotificationFormSchema } from '../schemas/bulk-notification.schema';
import { notificationTableSchema } from '../schemas/notification.table.schema';
import { createAutoNotificationSettingsFormSchema } from '../schemas/auto-notification-settings.schema';
import { useStudentTaskCards } from '@hooks/use-student';
import { useUpdateConfig } from '@hooks/use-config';
import { fetchNotificationTemplates } from '@hooks/use-notification-templates';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { Sparkles } from 'lucide-react';
// logWarn import 제거됨 - 채널 선택 기능 제거로 미사용

export function NotificationsPage() {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();
  const terms = useIndustryTerms();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  const iconSize = useIconSize('--size-icon-base', 20);
  const iconStrokeWidth = useIconStrokeWidth('--stroke-width-icon', 1.5);

  const [filter, _setFilter] = useState<{ status?: NotificationStatus }>({});
  // 채널 선택 제거됨 - filter는 상태 필터링에 사용, setFilter는 향후 필터 UI 구현 시 사용 예정
  void _setFilter;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'send' | 'templates' | 'bulk' | 'auto-settings'>('history');
  const [aiDraftValues, setAiDraftValues] = useState<Record<string, unknown> | null>(null);

  // AI 메시지 초안 제안 조회 (StudentTaskCard에서 task_type: 'ai_suggested', suggested_action.type: 'send_message' 필터링)
  // 아키텍처 문서 3.5.1: AI 자동 초안 제안 모델
  // 프론트 자동화 문서 2.2: StudentTaskCard (task_type: 'ai_suggested') 사용
  const { data: studentTaskCards } = useStudentTaskCards();
  const messageDraftSuggestions = useMemo(() => {
    if (!studentTaskCards || !Array.isArray(studentTaskCards)) return [];
    return studentTaskCards.filter(
      (card) =>
        card.task_type === 'ai_suggested' &&
        (card.status === 'pending' || !card.status) && // status가 없으면 pending으로 간주
        card.suggested_action?.type === 'send_message' &&
        card.suggested_action?.payload?.message // 메시지 내용이 있는 경우만
    );
  }, [studentTaskCards]);

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: schemaData } = useSchema('notification', notificationFormSchema, 'form');
  const { data: templateSchemaData } = useSchema('notification_template', notificationTemplateFormSchema, 'form');
  const { data: bulkSchemaData } = useSchema('bulk_notification', bulkNotificationFormSchema, 'form');
  const { data: notificationTableSchemaData } = useSchema('notification_table', notificationTableSchema, 'table');
  const { data: autoNotificationSettingsSchemaData } = useSchema('auto_notification_settings', createAutoNotificationSettingsFormSchema(terms), 'form');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const schema = schemaData || notificationFormSchema;
  const templateSchema = templateSchemaData || notificationTemplateFormSchema;
  const bulkSchema = bulkSchemaData || bulkNotificationFormSchema;
  const effectiveTableSchema = notificationTableSchemaData || notificationTableSchema;
  const autoNotificationSettingsSchema = autoNotificationSettingsSchemaData || createAutoNotificationSettingsFormSchema(terms);

  // 템플릿 목록 조회
  const { data: templates, isLoading: templatesLoading } = useOptimizedQuery(
    ['notification-templates', tenantId],
    async () => {
      if (!tenantId) return [];

      // 정본 규칙: fetchNotificationTemplates 함수 사용 (Hook의 queryFn 로직 재사용)
      return fetchNotificationTemplates(tenantId, {});
    },
    { enabled: !!tenantId && activeTab === 'templates' } // 템플릿 탭 활성화 시에만 조회
  );

  // 템플릿 생성
  const createTemplate = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      try {
        // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
        const response = await apiClient.post<{ id: string; name: string; channel: string; content: string }>('notification_templates', {
          name: data.name,
          channel: 'kakao_at', // 알림톡 기본
          content: data.content,
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        return response.data!;
      } catch (error) {
        if (error instanceof Error && (error.message.includes('does not exist') || error.message.includes('relation'))) {
          throw new Error('notification_templates 테이블이 아직 생성되지 않았습니다. 마이그레이션을 실행해주세요.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-templates', tenantId] });
      setShowTemplateForm(false);
      showAlert('템플릿이 생성되었습니다.', terms.MESSAGES.SUCCESS);
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });

  // 자동 알림 설정 저장 (tenant_settings에 저장)
  // SSOT-1: tenant_settings는 KV 구조이며, config는 컬럼이 아니라 key='config' row의 value(JSONB)입니다.
  // 정본 규칙: apiClient.get('tenant_settings') 직접 호출 금지, useUpdateConfig Hook 사용
  const updateConfig = useUpdateConfig();
  const saveAutoNotificationSettings = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
      // 정본 규칙: useUpdateConfig Hook 사용
      const updateInput = {
        notification: {
          auto_notification: {
            check_in: data.check_in_notification || false,
            check_out: data.check_out_notification || false,
            invoice_created: data.invoice_created_notification || false,
            overdue: data.overdue_notification || false,
          },
        },
      };

      return updateConfig.mutateAsync(updateInput);
    },
    onSuccess: () => {
      // setShowAutoNotificationSettings(false); // (미사용) 자동 알림 설정 Drawer/Modal 도입 시 사용
      showAlert('자동 알림 설정이 저장되었습니다.', terms.MESSAGES.SUCCESS);
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });

  // 단체문자/예약 발송
  const sendBulkNotification = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const startTime = Date.now();
      const recipients = String(data.recipients ?? '').split('\n').filter((r: string) => r.trim());

      // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
      // 각 수신자에게 알림 생성
      const promises = recipients.map((recipient: string) =>
        apiClient.post<Notification>('notifications', {
          recipient: recipient.trim(),
          content: data.content,
          status: 'pending',
          scheduled_at: data.scheduled_at || undefined, // 예약 발송 시간 (있으면 전달)
        })
      );

      const results = await Promise.all(promises);

      // Execution Audit 기록 생성 (액티비티.md 3.2, 3.3, 12 참조)
      if (session?.user?.id && tenantId) {
        const durationMs = Date.now() - startTime;
        const errors = results.filter((r) => r.error);
        const successCount = results.length - errors.length;
        const status: 'success' | 'partial' = errors.length > 0 ? 'partial' : 'success';

        await createExecutionAuditRecord(
          {
            operation_type: 'messaging.send-bulk',
            status: status,
            summary: `일괄 메시지 발송 요청 완료 (${successCount}/${results.length}건 성공)`,
            details: {
              recipient_count: successCount,
              total_count: results.length,
            },
            reference: {
              entity_type: 'notification',
              entity_id: tenantId || '',
            },
            duration_ms: durationMs,
            ...(errors.length > 0 && {
              error_code: 'PARTIAL_FAILURE',
              error_summary: `${errors.length}건 발송 실패`,
            }),
          },
          session.user.id
        );
      }

      return results;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] });
      // setShowBulkForm(false); // (미사용) 단체 발송 Drawer/Modal 도입 시 사용
      showAlert(`${terms.MESSAGE_LABEL}가 발송되었습니다.`, terms.MESSAGES.SUCCESS);
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });

  // 알림 생성
  const createNotification = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
      const startTime = Date.now();
      const response = await apiClient.post<Notification>('notifications', {
        recipient: data.recipient,
        template_id: data.template_id,
        content: data.content,
        status: 'pending',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.2, 3.3, 12 참조)
      if (session?.user?.id && tenantId && response.data) {
        const durationMs = Date.now() - startTime;
        await createExecutionAuditRecord(
          {
            operation_type: 'messaging.send',
            status: 'success',
            summary: '메시지 발송 요청 완료',
            details: {
              notification_id: response.data.id,
            },
            reference: {
              entity_type: 'notification',
              entity_id: response.data.id,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return response.data!;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] });
      setShowCreateForm(false);
      showAlert(`${terms.MESSAGE_LABEL}이 생성되었습니다.`, terms.MESSAGES.SUCCESS);
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });

  // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
  // 발송 내역에서 채널을 표시할 때 사용
  const channelLabels: Record<string, string> = {
    sms: 'SMS',
    kakao_at: '알림톡',
    alimtalk: '알림톡',
  };

  // statusColors/statusLabels는 SchemaTable 스키마 기반 렌더링으로 대체됨 (미사용)

  const handleCreateNotification = (data: Record<string, unknown>) => {
    void createNotification.mutateAsync(data);
    // 성공 시 모달 닫기는 onSuccess에서 처리됨
    setAiDraftValues(null); // AI 초안 값 초기화
    // 에러는 onError에서 처리됨
  };

  // AI 초안 적용 핸들러
  // 아키텍처 문서 3.5.1: AI 자동 초안 제안 모델
  // StudentTaskCard의 suggested_action.payload에서 message만 추출하여 폼에 적용
  // recipient는 guardian_id 배열이므로 사용자가 직접 입력하도록 함
  // [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
  const handleApplyAIDraft = (suggestion: (typeof messageDraftSuggestions)[number]) => {
    const payload = suggestion.suggested_action?.payload;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const draftValues: Record<string, unknown> = {
        content: String(payload.message || ''),
        recipient: '', // recipient_ids는 guardian ID 배열이므로 사용자가 직접 입력하도록 함
      };
      setAiDraftValues(draftValues);
      setShowCreateForm(true);
    } else {
      showAlert('AI 초안에 메시지 내용이 없습니다.', '알림');
    }
  };

  const handleCreateTemplate = async (data: Record<string, unknown>) => {
    try {
      await createTemplate.mutateAsync(data);
    } catch (error) {
      // 에러는 onError에서 처리됨
    }
  };

  const handleSendBulkNotification = async (data: Record<string, unknown>) => {
    try {
      await sendBulkNotification.mutateAsync(data);
    } catch (error) {
      // 에러는 onError에서 처리됨
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title={terms.MESSAGE_LABEL}
        />

        {/* 탭 선택 */}
        <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              <Button
                variant={activeTab === 'history' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('history')}
              >
                {terms.MESSAGE_LABEL} 내역
              </Button>
              <Button
                variant={activeTab === 'send' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('send')}
              >
                {terms.MESSAGE_LABEL} 발송
              </Button>
              <Button
                variant={activeTab === 'templates' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('templates')}
              >
                템플릿 관리
              </Button>
              <Button
                variant={activeTab === 'bulk' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('bulk')}
              >
                단체문자/예약
              </Button>
              <Button
                variant={activeTab === 'auto-settings' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('auto-settings')}
              >
                자동 알림 설정
              </Button>
            </div>
          </Card>

          {/* 발송 내역 탭 */}
          {activeTab === 'history' && (
            <>
          {/* 액션 버튼 */}
          <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Button
                variant="solid"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                새 {terms.MESSAGE_LABEL} 발송
              </Button>
            </div>
          </Card>

          {/* 알림 목록 - SchemaTable 사용 */}
          {notificationTableSchemaData ? (
            <SchemaTable
              key={`notification-table-${filter.status || 'all'}`}
              schema={effectiveTableSchema}
              apiCall={async (endpoint: string, method: string) => {
                void method;
                const filters: Record<string, unknown> = {};
                if (filter.status) filters.status = filter.status;

                const response = await apiClient.get<Notification>(endpoint, {
                  filters,
                  orderBy: { column: 'created_at', ascending: false },
                  limit: 100,
                });
                if (response.error) {
                  throw new Error(response.error.message);
                }
                return response.data || [];
              }}
            />
          ) : (
            <Card padding="lg">
              <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                {terms.MESSAGES.LOADING}
              </div>
            </Card>
          )}

          {/* 메시지 발송 폼 - 반응형: 모바일/태블릿은 Drawer, 데스크톱은 Modal */}
          {schema && (
            <>
              {isMobileMode || isTabletMode ? (
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => {
                    setShowCreateForm(false);
                    setAiDraftValues(null);
                  }}
                  title={`새 ${terms.MESSAGE_LABEL} 발송`}
                  position={isMobileMode ? 'bottom' : 'right'}
                  width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
                >
                  <SchemaForm
                    schema={schema}
                    onSubmit={handleCreateNotification}
                    defaultValues={aiDraftValues || {}}
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
                        showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                      },
                    }}
                  />
                </Drawer>
              ) : (
                <Modal
                  isOpen={showCreateForm}
                  onClose={() => {
                    setShowCreateForm(false);
                    setAiDraftValues(null);
                  }}
                  title={`새 ${terms.MESSAGE_LABEL} 발송`}
                  size="md"
                >
                  <SchemaForm
                    schema={schema}
                    onSubmit={handleCreateNotification}
                    defaultValues={aiDraftValues || {}}
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
                        showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                      },
                    }}
                  />
                </Modal>
              )}
            </>
          )}
            </>
          )}

          {/* 메시지 발송 탭 */}
          {activeTab === 'send' && (
            <>
              {/* AI 초안 제안 배너 (아키텍처 문서 3.5.1: AI 자동 초안 제안 모델) */}
              {messageDraftSuggestions.length > 0 && (
                <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)', borderLeft: 'var(--border-width-thick) solid var(--color-info)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
                    <Sparkles size={iconSize} strokeWidth={iconStrokeWidth} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 'var(--spacing-xs)' }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                        AI {terms.MESSAGE_LABEL} 초안 제안
                      </h4>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
                        AI가 상황을 감지하여 {terms.MESSAGE_LABEL} 초안을 준비했습니다. 초안을 적용하여 발송하시겠습니까?
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                        {messageDraftSuggestions.slice(0, 3).map((suggestion) => (
                          <Card
                            key={suggestion.id}
                            padding="sm"
                            tabIndex={0}
                            aria-label={`${suggestion.title} - ${suggestion.description} 초안 적용`}
                            style={{
                              cursor: 'pointer',
                              transition: 'var(--transition-all)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleApplyAIDraft(suggestion);
                              }
                            }}
                            onClick={() => handleApplyAIDraft(suggestion)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                                  {suggestion.title}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                                  {suggestion.description}
                                </div>
                                {suggestion.source && (
                                  <Badge variant="soft" color="info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                    {suggestion.source === 'attendance' ? terms.ATTENDANCE_LABEL :
                                     suggestion.source === 'weather' ? '날씨' :
                                     suggestion.source === 'billing' ? '청구' :
                                     suggestion.source === 'behavior' ? '행동' :
                                     suggestion.source === 'proactive_analysis' ? 'AI 분석' :
                                     'AI 업무 카드'}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplyAIDraft(suggestion);
                                }}
                              >
                                적용
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <Card padding="lg">
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  <Button
                    variant="solid"
                    onClick={() => {
                      setAiDraftValues(null);
                      setShowCreateForm(true);
                    }}
                  >
                    새 {terms.MESSAGE_LABEL} 발송
                  </Button>
                </div>
              {schema && (
                <>
              {isMobileMode || isTabletMode ? (
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => {
                    setShowCreateForm(false);
                    setAiDraftValues(null);
                  }}
                  title={`새 ${terms.MESSAGE_LABEL} 발송`}
                  position={isMobileMode ? 'bottom' : 'right'}
                  width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
                >
                  <SchemaForm
                    schema={schema}
                    onSubmit={handleCreateNotification}
                    defaultValues={aiDraftValues || {}}
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
                            showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                          },
                        }}
                      />
                    </Drawer>
                  ) : (
                    <Modal
                      isOpen={showCreateForm}
                      onClose={() => setShowCreateForm(false)}
                      title={`새 ${terms.MESSAGE_LABEL} 발송`}
                      size="md"
                    >
                      <SchemaForm
                        schema={schema}
                        onSubmit={handleCreateNotification}
                        defaultValues={aiDraftValues || {}}
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
                            showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                          },
                        }}
                      />
                    </Modal>
                  )}
                </>
              )}
            </Card>
            </>
          )}

          {/* 템플릿 관리 탭 */}
          {activeTab === 'templates' && (
            <Card padding="lg">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>템플릿 관리</h3>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => setShowTemplateForm(true)}
                >
                  새 템플릿 생성
                </Button>
              </div>
              {templatesLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                  {terms.MESSAGES.LOADING}
                </div>
              ) : templates && templates.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(var(--width-card-min), 1fr))`, gap: 'var(--spacing-md)' }}>
                  {(templates as unknown as Array<{ id: string; name: string; channel: string; content: string; created_at: string }>).map((template) => (
                    <Card key={template.id} padding="md">
                      <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                        {template.name}
                      </h4>
                      <Badge color="blue" style={{ marginBottom: 'var(--spacing-xs)' }}>
                        {channelLabels[template.channel] || template.channel}
                      </Badge>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
                        {template.content}
                      </p>
                    </Card>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                  등록된 템플릿이 {terms.MESSAGES.NO_DATA}
                </div>
              )}
              {templateSchema && (
                <>
                  {isMobileMode || isTabletMode ? (
                    <Drawer
                      isOpen={showTemplateForm}
                      onClose={() => setShowTemplateForm(false)}
                      title="새 템플릿 생성"
                      position={isMobileMode ? 'bottom' : 'right'}
                      width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
                    >
                      <SchemaForm
                        schema={templateSchema}
                        onSubmit={handleCreateTemplate}
                        defaultValues={{}}
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
                            showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                          },
                        }}
                      />
                    </Drawer>
                  ) : (
                    <Modal
                      isOpen={showTemplateForm}
                      onClose={() => setShowTemplateForm(false)}
                      title="새 템플릿 생성"
                      size="md"
                    >
                      <SchemaForm
                        schema={templateSchema}
                        onSubmit={handleCreateTemplate}
                        defaultValues={{}}
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
                            showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                          },
                        }}
                      />
                    </Modal>
                  )}
                </>
              )}
            </Card>
          )}

          {/* 단체문자/예약 탭 */}
          {activeTab === 'bulk' && (
            <Card padding="lg">
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                단체문자/예약 발송
              </h3>
              {bulkSchema && (
                <SchemaForm
                  schema={bulkSchema}
                  onSubmit={handleSendBulkNotification}
                  defaultValues={{}}
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
                      showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                    },
                  }}
                />
              )}
            </Card>
          )}

          {/* 자동 알림 설정 탭 */}
          {activeTab === 'auto-settings' && (
            <Card padding="lg">
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                자동 알림 설정
              </h3>
              {autoNotificationSettingsSchema && (
                <SchemaForm
                  schema={autoNotificationSettingsSchema}
                  onSubmit={async (data: Record<string, unknown>) => {
                    try {
                      await saveAutoNotificationSettings.mutateAsync(data);
                    } catch (error) {
                      // 에러는 onError에서 처리됨
                    }
                  }}
                  defaultValues={{}}
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
                      showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
                    },
                  }}
                />
              )}
            </Card>
        )}
      </Container>
    </ErrorBoundary>
  );
}
