/**
 * 메시지/공지 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 자동 알림(등원/하원, 청구 생성, 미납 알림), 수동 메시지, 단체문자, 템플릿 관리, 예약 발송, 발송 내역 조회
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, Modal, Container, Card, Button, Badge } from '@ui-core/react';
import { SchemaForm, SchemaTable } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { Notification, NotificationChannel, NotificationStatus } from '@core/notification';
import { notificationFormSchema } from '../schemas/notification.schema';
import { notificationTemplateFormSchema } from '../schemas/notification-template.schema';
import { bulkNotificationFormSchema } from '../schemas/bulk-notification.schema';
import { notificationTableSchema } from '../schemas/notification.table.schema';
import { autoNotificationSettingsFormSchema } from '../schemas/auto-notification-settings.schema';

export function NotificationsPage() {
  const { showAlert, showConfirm } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  const [filter, setFilter] = useState<{ channel?: NotificationChannel; status?: NotificationStatus }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showAutoNotificationSettings, setShowAutoNotificationSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'send' | 'templates' | 'bulk' | 'auto-settings'>('history');

  // 스키마 조회 (Registry에서 가져오거나 fallback 사용)
  const { data: schema } = useSchema('notification', notificationFormSchema, 'form');
  const { data: templateSchema } = useSchema('notification_template', notificationTemplateFormSchema, 'form');
  const { data: bulkSchema } = useSchema('bulk_notification', bulkNotificationFormSchema, 'form');
  const { data: notificationTableSchemaData } = useSchema('notification_table', notificationTableSchema, 'table');
  const { data: autoNotificationSettingsSchema } = useSchema('auto_notification_settings', autoNotificationSettingsFormSchema, 'form');

  // 알림 목록 조회
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', tenantId, filter],
    queryFn: async () => {
      const filters: Record<string, any> = {};
      if (filter.channel) filters.channel = filter.channel;
      if (filter.status) filters.status = filter.status;

      const response = await apiClient.get<Notification>('notifications', {
        filters,
        orderBy: { column: 'created_at', ascending: false },
        limit: 100,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId,
  });

  // 템플릿 목록 조회
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['notification-templates', tenantId],
    queryFn: async () => {
      // TODO: notification_templates 테이블이 생성되면 실제 조회로 변경
      // 현재는 플레이스홀더
      return [];
    },
    enabled: !!tenantId && activeTab === 'templates',
  });

  // 템플릿 생성
  const createTemplate = useMutation({
    mutationFn: async (data: any) => {
      // TODO: notification_templates 테이블이 생성되면 실제 생성으로 변경
      return { id: 'temp-' + Date.now(), ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates', tenantId] });
      setShowTemplateForm(false);
      showAlert('성공', '템플릿이 생성되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 자동 알림 설정 저장
  const saveAutoNotificationSettings = useMutation({
    mutationFn: async (data: any) => {
      // TODO: 실제 자동 알림 설정 API 엔드포인트 구현 필요
      // 현재는 플레이스홀더
      const response = await apiClient.post<any>('notification-settings/auto', data);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || {};
    },
    onSuccess: () => {
      setShowAutoNotificationSettings(false);
      showAlert('성공', '자동 알림 설정이 저장되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 단체문자/예약 발송
  const sendBulkNotification = useMutation({
    mutationFn: async (data: any) => {
      const recipients = data.recipients.split('\n').filter((r: string) => r.trim());

      // 각 수신자에게 알림 생성
      const promises = recipients.map((recipient: string) =>
        apiClient.post<Notification>('notifications', {
          channel: data.channel,
          recipient: recipient.trim(),
          content: data.content,
          status: data.scheduled_at ? 'pending' : 'pending',
        })
      );

      const results = await Promise.all(promises);
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] });
      setShowBulkForm(false);
      showAlert('성공', '메시지가 발송되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 알림 생성
  const createNotification = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post<Notification>('notifications', {
        channel: data.channel,
        recipient: data.recipient,
        template_id: data.template_id,
        content: data.content,
        status: 'pending',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] });
      setShowCreateForm(false);
      showAlert('성공', '알림이 생성되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  const channelLabels: Record<NotificationChannel, string> = {
    sms: 'SMS',
    kakao: '카카오 알림톡',
    email: '이메일',
    push: '푸시 알림',
  };

  const statusColors: Record<NotificationStatus, string> = {
    pending: 'warning',
    sent: 'info',
    failed: 'error',
    delivered: 'success',
  };

  const statusLabels: Record<NotificationStatus, string> = {
    pending: '대기중',
    sent: '발송완료',
    failed: '실패',
    delivered: '전달완료',
  };

  const handleCreateNotification = async (data: any) => {
    try {
      await createNotification.mutateAsync(data);
      // 성공 시 모달 닫기는 onSuccess에서 처리됨
    } catch (error) {
      // 에러는 onError에서 처리됨
    }
  };

  const handleCreateTemplate = async (data: any) => {
    try {
      await createTemplate.mutateAsync(data);
    } catch (error) {
      // 에러는 onError에서 처리됨
    }
  };

  const handleSendBulkNotification = async (data: any) => {
    try {
      await sendBulkNotification.mutateAsync(data);
    } catch (error) {
      // 에러는 onError에서 처리됨
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            메시지/공지
          </h1>

          {/* 탭 선택 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              <Button
                variant={activeTab === 'history' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('history')}
              >
                발송 내역
              </Button>
              <Button
                variant={activeTab === 'send' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('send')}
              >
                메시지 발송
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
          {/* 필터 및 액션 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant={!filter.channel ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setFilter({ ...filter, channel: undefined })}
              >
                전체 채널
              </Button>
              {(['sms', 'kakao', 'email', 'push'] as NotificationChannel[]).map((channel) => (
                <Button
                  key={channel}
                  variant={filter.channel === channel ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => setFilter({ ...filter, channel })}
                >
                  {channelLabels[channel]}
                </Button>
              ))}
              <div style={{ marginLeft: 'auto' }}>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                >
                  새 메시지 발송
                </Button>
              </div>
            </div>
          </Card>

          {/* 알림 목록 - SchemaTable 사용 */}
          {notificationTableSchemaData ? (
            <SchemaTable
              key={`notification-table-${filter.channel || 'all'}-${filter.status || 'all'}`}
              schema={notificationTableSchemaData}
              apiCall={async (endpoint: string, method: string) => {
                const filters: Record<string, any> = {};
                if (filter.channel) filters.channel = filter.channel;
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
            <Card padding="md" variant="default">
              <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                로딩 중...
              </div>
            </Card>
          )}

          {/* 메시지 발송 폼 (모달) */}
          {schema && (
            <Modal
              isOpen={showCreateForm}
              onClose={() => setShowCreateForm(false)}
              title="새 메시지 발송"
              size="md"
            >
              <SchemaForm
                schema={schema}
                onSubmit={handleCreateNotification}
                defaultValues={{}}
                actionContext={{
                  apiCall: async (endpoint: string, method: string, body?: any) => {
                    if (method === 'POST') {
                      const response = await apiClient.post(endpoint, body);
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

          {/* 메시지 발송 탭 */}
          {activeTab === 'send' && (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                <Button
                  variant="solid"
                  onClick={() => setShowCreateForm(true)}
                >
                  새 메시지 발송
                </Button>
              </div>
              {schema && (
                <Modal
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title="새 메시지 발송"
                  size="md"
                >
                  <SchemaForm
                    schema={schema}
                    onSubmit={handleCreateNotification}
                    defaultValues={{}}
                    actionContext={{
                      apiCall: async (endpoint: string, method: string, body?: any) => {
                        if (method === 'POST') {
                          const response = await apiClient.post(endpoint, body);
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
            </Card>
          )}

          {/* 템플릿 관리 탭 - [요구사항] 템플릿 관리 */}
          {activeTab === 'templates' && (
            <Card padding="lg" variant="default">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h2>템플릿 관리</h2>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => setShowTemplateForm(true)}
                >
                  새 템플릿 생성
                </Button>
              </div>

              {templatesLoading ? (
                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                  로딩 중...
                </div>
              ) : templates && templates.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {templates.map((template: any) => (
                    <Card
                      key={template.id}
                      padding="md"
                      variant="default"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                            <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                              {template.name}
                            </h4>
                            <Badge variant="outline">
                              {channelLabels[template.channel as NotificationChannel]}
                            </Badge>
                          </div>
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            {template.content}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                          <Button variant="outline" size="sm">수정</Button>
                          <Button variant="outline" size="sm">삭제</Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  등록된 템플릿이 없습니다.
                </div>
              )}

              {/* 템플릿 생성 모달 */}
              {templateSchema && (
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
                      apiCall: async (endpoint: string, method: string, body?: any) => {
                        if (method === 'POST') {
                          const response = await apiClient.post(endpoint, body);
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
            </Card>
          )}

          {/* 단체문자/예약 탭 - [요구사항] 단체문자, 예약 발송 */}
          {activeTab === 'bulk' && (
            <Card padding="lg" variant="default">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h2>단체문자/예약 발송</h2>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => setShowBulkForm(true)}
                >
                  새 발송
                </Button>
              </div>

              {bulkSchema && (
                <SchemaForm
                  schema={bulkSchema}
                  onSubmit={handleSendBulkNotification}
                  defaultValues={{
                    recipients: '',
                    content: '',
                  }}
                  actionContext={{
                    apiCall: async (endpoint: string, method: string, body?: any) => {
                      if (method === 'POST') {
                        const response = await apiClient.post(endpoint, body);
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

              {/* 단체문자 발송 모달 */}
              {bulkSchema && (
                <Modal
                  isOpen={showBulkForm}
                  onClose={() => setShowBulkForm(false)}
                  title="단체문자/예약 발송"
                  size="lg"
                >
                  <SchemaForm
                    schema={bulkSchema}
                    onSubmit={handleSendBulkNotification}
                    defaultValues={{
                      recipients: '',
                      content: '',
                    }}
                    actionContext={{
                      apiCall: async (endpoint: string, method: string, body?: any) => {
                        if (method === 'POST') {
                          const response = await apiClient.post(endpoint, body);
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
            </Card>
          )}

          {/* 자동 알림 설정 탭 - [요구사항] 자동 알림 설정 (등원/하원, 청구 생성, 미납 알림) */}
          {activeTab === 'auto-settings' && (
            <Card padding="lg" variant="default">
              <h2 style={{ marginBottom: 'var(--spacing-md)' }}>자동 알림 설정</h2>
              {autoNotificationSettingsSchema ? (
                <SchemaForm
                  schema={autoNotificationSettingsSchema}
                  onSubmit={async (data: any) => {
                    await saveAutoNotificationSettings.mutateAsync(data);
                  }}
                  defaultValues={{
                    check_in_notification: false,
                    check_out_notification: false,
                    invoice_created_notification: false,
                    overdue_notification: false,
                    notification_channel: 'sms',
                  }}
                  actionContext={{
                    apiCall: async (endpoint: string, method: string, body?: any) => {
                      if (method === 'POST') {
                        const response = await apiClient.post(endpoint, body);
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
              ) : (
                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  로딩 중...
                </div>
              )}
            </Card>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

