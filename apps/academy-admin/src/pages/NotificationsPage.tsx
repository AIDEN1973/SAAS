/**
 * 메시지/공지 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 자동 알림(등원/하원, 청구 생성, 미납 알림), 수동 메시지, 단체문자, 템플릿 관리, 예약 발송, 발송 내역 조회
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, Modal, Container, Card, Button, Badge, useResponsiveMode, Drawer } from '@ui-core/react';
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
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const navigate = useNavigate();

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
      if (!tenantId) return [];

      try {
        const response = await apiClient.get<any>('notification_templates', {
          filters: {},
          orderBy: { column: 'created_at', ascending: false },
        });

        if (response.error) {
          // 테이블이 아직 생성되지 않았을 수 있으므로 빈 배열 반환
          if (response.error.message?.includes('does not exist') || response.error.message?.includes('relation')) {
            return [];
          }
          throw new Error(response.error.message);
        }

        return response.data || [];
      } catch (error) {
        // 테이블이 없으면 빈 배열 반환
      return [];
      }
    },
    enabled: false, // 템플릿 관리는 별도 페이지로 분리 (한 페이지에 하나의 기능 원칙)
  });

  // 템플릿 생성
  const createTemplate = useMutation({
    mutationFn: async (data: any) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      try {
        const response = await apiClient.post<any>('notification_templates', {
          name: data.name,
          channel: data.channel,
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
      queryClient.invalidateQueries({ queryKey: ['notification-templates', tenantId] });
      setShowTemplateForm(false);
      showAlert('성공', '템플릿이 생성되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 자동 알림 설정 저장 (tenant_settings에 저장)
  const saveAutoNotificationSettings = useMutation({
    mutationFn: async (data: any) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // tenant_settings의 notification 섹션 업데이트
      // [불변 규칙] Zero-Trust: tenant_id는 apiClient가 자동으로 주입하므로 filters에서 제거
      const settingsResponse = await apiClient.get<any>('tenant_settings', {
        limit: 1,
      });

      let settingsId: string | null = null;
      let currentSettings: any = {};

      if (!settingsResponse.error && settingsResponse.data && settingsResponse.data.length > 0) {
        settingsId = settingsResponse.data[0].id;
        currentSettings = settingsResponse.data[0].settings || {};
      }

      const updatedSettings = {
        ...currentSettings,
        notification: {
          auto_notification: {
            check_in: data.check_in_notification || false,
            check_out: data.check_out_notification || false,
            invoice_created: data.invoice_created_notification || false,
            overdue: data.overdue_notification || false,
            channel: data.notification_channel || 'sms',
          },
        },
      };

      if (settingsId) {
        const updateResponse = await apiClient.patch('tenant_settings', settingsId, {
          settings: updatedSettings,
        });

        if (updateResponse.error) {
          throw new Error(updateResponse.error.message);
      }

        return updateResponse.data;
      } else {
        // [불변 규칙] Zero-Trust: tenant_id는 RLS 정책에 의해 자동으로 설정되므로 제거
        const createResponse = await apiClient.post<any>('tenant_settings', {
          settings: updatedSettings,
        });

        if (createResponse.error) {
          throw new Error(createResponse.error.message);
        }

        return createResponse.data;
      }
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

          {/* 탭 선택 (한 페이지에 하나의 기능 원칙: 최대 1~2탭) */}
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
            </div>
          </Card>

          {/* 빠른 링크 (한 페이지에 하나의 기능 원칙 준수: 나머지는 별도 페이지) */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginRight: 'var(--spacing-sm)' }}>
                추가 기능:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/notifications/templates')}
              >
                템플릿 관리
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/notifications/bulk')}
              >
                단체문자/예약
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/notifications/auto-settings')}
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

          {/* 메시지 발송 폼 - 반응형: 모바일/태블릿은 Drawer, 데스크톱은 Modal */}
          {schema && (
            <>
              {isMobile || isTablet ? (
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title="새 메시지 발송"
                  position={isMobile ? 'bottom' : 'right'}
                  width={isTablet ? '500px' : '100%'}
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
                </Drawer>
              ) : (
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
                <>
                  {isMobile || isTablet ? (
                    <Drawer
                      isOpen={showCreateForm}
                      onClose={() => setShowCreateForm(false)}
                      title="새 메시지 발송"
                      position={isMobile ? 'bottom' : 'right'}
                      width={isTablet ? '500px' : '100%'}
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
                    </Drawer>
                  ) : (
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
            </Card>
          )}


          {/* 단체문자/예약과 자동 알림 설정은 별도 페이지로 분리 (한 페이지에 하나의 기능 원칙) */}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

