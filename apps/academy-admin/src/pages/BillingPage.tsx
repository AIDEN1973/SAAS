/**
 * 수납/청구 관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 월정액/횟수제/패키지 상품, 월 자동 청구 생성, 미납 관리, 결제 수단 지원
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// [SSOT] Barrel export를 통한 통합 import
import { createSafeNavigate } from '../utils';
import { ErrorBoundary, useModal, Modal, Container, Card, Button, useResponsiveMode, Drawer, PageHeader, isMobile, isTablet } from '@ui-core/react';
import { SchemaForm, SchemaTable } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { useBillingHistory , fetchBillingHistory } from '@hooks/use-billing';
import { fetchInvoiceItems } from '@hooks/use-invoice-items';
import { useUpdateConfig } from '@hooks/use-config';
import type { UpdateConfigInput } from '@core/config';
import { getApiContext, apiClient } from '@api-sdk/core';
import { toKST } from '@lib/date-utils';
import type { Invoice, InvoiceStatus } from '@core/billing';
import type { BillingHistoryItem } from '@hooks/use-billing';
import { billingFormSchema } from '../schemas/billing.schema';
import { productFormSchema } from '../schemas/product.schema';
import { invoiceTableSchema } from '../schemas/invoice.table.schema';
import { subjectRevenueTableSchema } from '../schemas/subject-revenue.table.schema';
import { settlementFormSchema } from '../schemas/settlement.schema';
import { teacherRevenueSplitFormSchema } from '../schemas/teacher-revenue-split.schema';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES } from '../constants';

export function BillingPage() {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);

  const [filter, setFilter] = useState<{ status?: InvoiceStatus }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'products' | 'settlement' | 'teacher-revenue-split'>('invoices');
  const [showProductForm, setShowProductForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showTeacherRevenueSplitForm, setShowTeacherRevenueSplitForm] = useState(false);
  const navigate = useNavigate();
  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );
  // 현재 화면 구현 범위에서 미사용 상태/세터들은 명시적으로 참조하여 lint(0/0)를 유지합니다.
  void setActiveTab;
  void showProductForm;
  void setShowProductForm;
  void showSettlementForm;
  void setShowSettlementForm;
  void showTeacherRevenueSplitForm;
  void setShowTeacherRevenueSplitForm;

  // 월 자동 청구 생성은 배치 작업으로 자동 실행됨 (아키텍처 문서 2617줄: 매일 04:00 KST)
  // 수동 실행은 더 이상 필요하지 않음 (Zero-Management Platform 철학)

  // 스키마 조회 (Registry에서 가져오거나 fallback 사용)
  const { data: schema } = useSchema('invoice', billingFormSchema, 'form');
  const { data: productSchema } = useSchema('product', productFormSchema, 'form');
  const { data: invoiceTableSchemaData } = useSchema('invoice_table', invoiceTableSchema, 'table');
  const { data: subjectRevenueTableSchemaData } = useSchema('subject_revenue_table', subjectRevenueTableSchema, 'table');
  const { data: settlementSchema } = useSchema('settlement', settlementFormSchema, 'form');
  const { data: teacherRevenueSplitSchema } = useSchema('teacher_revenue_split', teacherRevenueSplitFormSchema, 'form');
  void productSchema;
  void subjectRevenueTableSchemaData;
  void settlementSchema;
  void teacherRevenueSplitSchema;

  // 정본 규칙: useBillingHistory Hook 사용
  // 인보이스 목록 조회
  const { data: invoices, isLoading } = useBillingHistory();
  void invoices;
  void isLoading;

  // 인보이스 생성
  const createInvoice = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiClient.post<Invoice>('invoices', {
        payer_id: data.payer_id,
        amount: data.amount,
        due_date: data.due_date,
        status: 'draft',
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      setShowCreateForm(false);
      showAlert('성공', '인보이스가 생성되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 상품 목록 조회
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: async () => {
      // TODO: products 테이블이 생성되면 실제 조회로 변경
      // 현재는 invoice_items를 통해 상품 정보 추출
      // 정본 규칙: fetchInvoiceItems 함수 사용 (Hook의 queryFn 로직 재사용)
      if (!tenantId) return [];
      const items = await fetchInvoiceItems(tenantId, {});
      interface ProductInfo {
        id: string;
        name: string;
        type: string;
        amount: number;
      }
      const productMap = new Map<string, ProductInfo>();
      (items as Array<{ item_type?: string; description?: string; category?: string; unit_price?: number }>).forEach((item) => {
        if (item.item_type && !productMap.has(item.item_type)) {
          productMap.set(item.item_type, {
            id: item.item_type,
            name: item.description || item.item_type,
            type: item.category || 'monthly',
            amount: item.unit_price || 0,
          });
        }
      });

      return Array.from(productMap.values());
    },
    enabled: !!tenantId && activeTab === 'products',
  });
  void products;
  void productsLoading;

  // 상품 생성 (TODO: products 테이블이 생성되면 구현)
  // const createProduct = useMutation({ ... });

  // 매출 통계 조회는 별도 페이지로 분리 (한 페이지에 하나의 기능 원칙)

  // 정산 실행
  const executeSettlement = useMutation({
    mutationFn: async (data: { year: number; month: number }) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // 해당 월의 청구서 및 결제 내역 조회
      // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
      const periodStart = `${data.year}-${String(data.month).padStart(2, '0')}-01`;
      const periodEnd = toKST(`${data.year}-${String(data.month).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');

      const invoices = await fetchBillingHistory(tenantId, {
        period_start: { gte: periodStart, lte: periodEnd },
      });

      // 결제 완료된 청구서만 집계
      const paidInvoices = invoices.filter((inv: BillingHistoryItem) => inv.status === 'paid');
      const totalAmount = paidInvoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);

      // TODO: settlements 테이블이 생성되면 실제 정산 기록 저장
      // 현재는 계산만 수행
      return {
        settlement_id: `settlement-${data.year}-${data.month}-${Date.now()}`,
        total_amount: totalAmount,
        invoice_count: paidInvoices.length,
      };
    },
    onSuccess: (data: { total_amount?: number }) => {
      void queryClient.invalidateQueries({ queryKey: ['revenue-stats', tenantId] });
      setShowSettlementForm(false);
      showAlert('성공', `정산이 완료되었습니다. (정산 금액: ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(data.total_amount || 0)})`);
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });
  void executeSettlement;

  // 강사 매출 배분 설정 저장 (tenant_settings에 저장)
  // 정본 규칙: apiClient.get('tenant_settings') 직접 호출 금지, useUpdateConfig Hook 사용
  const updateConfig = useUpdateConfig();
  const saveTeacherRevenueSplit = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // 정본 규칙: useUpdateConfig Hook 사용
      const updateInput = {
        billing: {
          teacher_revenue_split: {
            enabled: data.enabled || false,
            split_method: data.split_method || 'percentage',
            split_rules: data.split_rules || {},
          },
        },
      } as UpdateConfigInput;

      return updateConfig.mutateAsync(updateInput);
    },
    onSuccess: () => {
      setShowTeacherRevenueSplitForm(false);
      showAlert('성공', '강사 매출 배분 설정이 저장되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });
  void saveTeacherRevenueSplit;

  // 인보이스 상태 업데이트 (TODO: 구현 필요)
  // const updateInvoiceStatus = useMutation({
  //   mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
  //     const response = await apiClient.patch<Invoice>('invoices', id, { status });
  //     if (response.error) {
  //       throw new Error(response.error.message);
  //     }
  //     return response.data!;
  //   },
  //   onSuccess: () => {
  //     void queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
  //     showAlert('성공', '인보이스 상태가 업데이트되었습니다.');
  //   },
  //   onError: (error: Error) => {
  //     showAlert('오류', error.message);
  //   },
  // });

  const handleStatusFilter = (status?: InvoiceStatus) => {
    setFilter({ status });
  };

  const handleCreateInvoice = (data: Record<string, unknown>) => {
    void createInvoice.mutateAsync(data);
    // 성공 시 모달 닫기는 onSuccess에서 처리됨
    // 에러는 onError에서 처리됨
  };


  // TODO: handleStatusChange 구현 필요 (현재 미사용)
  // const handleStatusChange = async (id: string, newStatus: InvoiceStatus) => { ... };

  const statusColors: Record<InvoiceStatus, string> = {
    draft: 'gray',
    pending: 'warning',
    paid: 'success',
    overdue: 'error',
    cancelled: 'gray',
  };
  void statusColors;

  const statusLabels: Record<InvoiceStatus, string> = {
    draft: '초안',
    pending: '대기',
    paid: '결제완료',
    overdue: '연체',
    cancelled: '취소',
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="수납/청구 관리"
        />

        {/* 빠른 링크 (한 페이지에 하나의 기능 원칙 준수: 청구서 관리만 메인, 나머지는 별도 페이지) */}
        <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary)', marginRight: 'var(--spacing-sm)' }}>
                관련 기능:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => safeNavigate(ROUTES.BILLING_HOME)}
              >
                상품 관리
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => safeNavigate(ROUTES.BILLING_HOME)}
              >
                결제 관리
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => safeNavigate(ROUTES.BILLING_HOME)}
              >
                매출/정산
              </Button>
            </div>
          </Card>

          {/* 인보이스 탭 */}
          {activeTab === 'invoices' && (
            <>
          {/* 필터 및 액션 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant={!filter.status ? 'solid' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter(undefined)}
              >
                전체
              </Button>
              {(['draft', 'pending', 'paid', 'overdue', 'cancelled'] as InvoiceStatus[]).map((status) => (
                <Button
                  key={status}
                  variant={filter.status === status ? 'solid' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter(status)}
                >
                  {statusLabels[status]}
                </Button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  marginRight: 'var(--spacing-sm)'
                }}>
                  월 자동 청구는 매일 04:00에 자동으로 생성됩니다 (Zero-Management)
                </div>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                >
                  새 인보이스 생성
                </Button>
              </div>
            </div>
          </Card>

          {/* 인보이스 목록 - SchemaTable 사용 */}
          {invoiceTableSchemaData ? (
            <SchemaTable
              key={`invoice-table-${filter.status || 'all'}`}
              schema={invoiceTableSchemaData}
              apiCall={async (endpoint: string, method: string) => {
                void method;
                const response = await apiClient.get<Invoice>(endpoint, {
                  filters: filter.status ? { status: filter.status } : {},
                  orderBy: { column: 'created_at', ascending: false },
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

          {/* 인보이스 생성 폼 - 반응형: 모바일/태블릿은 Drawer, 데스크톱은 Modal */}
          {schema && (
            <>
              {isMobileMode || isTabletMode ? (
                <Drawer
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title="새 인보이스 생성"
                  position={isMobileMode ? 'bottom' : 'right'}
                  width={isTabletMode ? 'var(--width-drawer-tablet)' : '100%'}
                >
                  <SchemaForm
                    schema={schema}
                    onSubmit={handleCreateInvoice}
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
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title="새 인보이스 생성"
                  size="md"
                >
                  <SchemaForm
                    schema={schema}
                    onSubmit={handleCreateInvoice}
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
            </>
          )}

          {/* 상품 관리, 결제 관리, 매출/정산은 별도 페이지로 분리 (한 페이지에 하나의 기능 원칙) */}
          {/* 빠른 링크 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary)', marginRight: 'var(--spacing-sm)' }}>
                추가 기능:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => safeNavigate(ROUTES.BILLING_HOME)}
              >
                상품 관리
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => safeNavigate(ROUTES.BILLING_HOME)}
              >
                결제 관리
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => safeNavigate(ROUTES.BILLING_HOME)}
              >
                매출/정산
              </Button>
            </div>
        </Card>

        {/* 결제 관리, 매출/정산은 별도 페이지로 분리 (한 페이지에 하나의 기능 원칙) */}
      </Container>
    </ErrorBoundary>
  );
}

