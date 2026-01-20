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

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, Modal, Container, Card, Button, useResponsiveMode, Drawer, PageHeader, isMobile, isTablet, SubSidebar, Badge, EmptyState, NotificationCardLayout } from '@ui-core/react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { SchemaForm, SchemaTable } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { useBillingHistory , fetchBillingHistory } from '@hooks/use-billing';
import { fetchInvoiceItems } from '@hooks/use-invoice-items';
import { useUpdateConfig, useConfig } from '@hooks/use-config';
import type { UpdateConfigInput } from '@core/config';
import { getApiContext, apiClient } from '@api-sdk/core';
import { toKST } from '@lib/date-utils';
import type { Invoice, InvoiceStatus } from '@core/billing';
import type { BillingHistoryItem } from '@hooks/use-billing';
import { billingFormSchema } from '../schemas/billing.schema';
import { invoiceTableSchema } from '../schemas/invoice.table.schema';
import { INVOICE_STATUS_LABELS } from '../utils/billingUtils';
// [SSOT] Barrel export를 통한 통합 import
import { BILLING_SUB_MENU_ITEMS, DEFAULT_BILLING_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { BillingSubMenuId } from '../constants';
import { CardGridLayout } from '../components/CardGridLayout';
import { Receipt, CreditCard, DollarSign, Package, CheckCircle, Clock, AlertCircle, Plus } from 'lucide-react';

export function BillingPage() {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const terms = useIndustryTerms();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);

  // 서브 메뉴 상태 (URL에서 직접 읽음 - StudentsHomePage 패턴)
  const validIds = BILLING_SUB_MENU_ITEMS.map(item => item.id) as readonly BillingSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_BILLING_SUB_MENU);

  const handleSubMenuChange = useCallback((id: BillingSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_BILLING_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  const [filter, setFilter] = useState<{ status?: InvoiceStatus }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showTeacherRevenueSplitForm, setShowTeacherRevenueSplitForm] = useState(false);
  void showProductForm;
  void setShowProductForm;
  void showSettlementForm;
  void setShowSettlementForm;
  void showTeacherRevenueSplitForm;
  void setShowTeacherRevenueSplitForm;

  // 월 자동 청구 생성은 배치 작업으로 자동 실행됨 (아키텍처 문서 2617줄: 매일 04:00 KST)
  // 수동 실행은 더 이상 필요하지 않음 (Zero-Management Platform 철학)

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: schemaData } = useSchema('invoice', billingFormSchema, 'form');
  const { data: invoiceTableSchemaData } = useSchema('invoice_table', invoiceTableSchema, 'table');

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const schema = schemaData || billingFormSchema;
  const effectiveInvoiceTableSchema = invoiceTableSchemaData || invoiceTableSchema;

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
      // [캐시 동기화] useBillingHistory의 queryKey와 일치시킴
      void queryClient.invalidateQueries({ queryKey: ['billing-history', tenantId] });
      // 상품/결제 내역도 무효화
      void queryClient.invalidateQueries({ queryKey: ['products', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['payment-history', tenantId] });
      setShowCreateForm(false);
      showAlert(`${terms.INVOICE_LABEL}가 생성되었습니다.`, terms.MESSAGES.SUCCESS);
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });

  // 상품 목록 조회
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: async () => {
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
    enabled: !!tenantId && selectedSubMenu === 'products',
  });

  // 결제 내역 조회
  const { data: paymentHistory, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payment-history', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      // 결제 완료된 인보이스 조회
      const invoices = await fetchBillingHistory(tenantId, {
        status: 'paid',
      });
      return invoices;
    },
    enabled: !!tenantId && selectedSubMenu === 'payments',
  });

  // 수납 설정 조회
  const { data: config } = useConfig();

  // 결제 통계 계산
  const paymentStats = useMemo(() => {
    if (!invoices) return null;

    const total = invoices.length;
    const paid = invoices.filter((inv: BillingHistoryItem) => inv.status === 'paid').length;
    const pending = invoices.filter((inv: BillingHistoryItem) => inv.status === 'pending').length;
    const overdue = invoices.filter((inv: BillingHistoryItem) => inv.status === 'overdue').length;
    const totalAmount = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
    const paidAmount = invoices
      .filter((inv: BillingHistoryItem) => inv.status === 'paid')
      .reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);

    return {
      total,
      paid,
      pending,
      overdue,
      totalAmount,
      paidAmount,
      collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
    };
  }, [invoices]);

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

      // P2 TODO: settlements 테이블 생성 후 실제 정산 기록 저장
      // 장기 계획: 월별 정산 내역 히스토리 관리
      // 우선순위: 중간 (현재는 계산만 수행)
      return {
        settlement_id: `settlement-${data.year}-${data.month}-${Date.now()}`,
        total_amount: totalAmount,
        invoice_count: paidInvoices.length,
      };
    },
    onSuccess: (data: { total_amount?: number }) => {
      // [캐시 동기화] 정산 후 모든 관련 캐시 무효화
      void queryClient.invalidateQueries({ queryKey: ['revenue-stats', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['billing-history', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['payment-history', tenantId] });
      setShowSettlementForm(false);
      showAlert(`정산이 완료되었습니다. (정산 금액: ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(data.total_amount || 0)})`, terms.MESSAGES.SUCCESS);
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });
  void executeSettlement;

  // 스태프 매출 배분 설정 저장 (tenant_settings에 저장)
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
      showAlert(`${terms.STAFF_REVENUE_DISTRIBUTION} 설정이 저장되었습니다.`, terms.MESSAGES.SUCCESS);
    },
    onError: (error: Error) => {
      showAlert(error.message, terms.MESSAGES.ERROR);
    },
  });
  void saveTeacherRevenueSplit;

  // P1 TODO: 인보이스 상태 업데이트 기능 구현
  // 우선순위: 높음 (관리자가 수동으로 상태 변경 필요)
  // 예: draft → pending, pending → paid, paid → cancelled
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

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', height: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!isMobileMode && (
          <SubSidebar
            title={`${terms.BILLING_LABEL} 관리`}
            items={BILLING_SUB_MENU_ITEMS}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            testId="billing-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding="lg" style={{ flex: 1 }}>
          <PageHeader
            title={BILLING_SUB_MENU_ITEMS.find(item => item.id === selectedSubMenu)?.label || `${terms.BILLING_LABEL} 관리`}
          />

          {/* 인보이스 탭 */}
          {selectedSubMenu === 'invoices' && (
            <>
          {/* 필터 및 액션 */}
          <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
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
                  {INVOICE_STATUS_LABELS[status]}
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
                  새 {terms.INVOICE_LABEL} 생성
                </Button>
              </div>
            </div>
          </Card>

          {/* 인보이스 목록 - SchemaTable 사용 */}
          {invoiceTableSchemaData ? (
            <SchemaTable
              key={`invoice-table-${filter.status || 'all'}`}
              schema={effectiveInvoiceTableSchema}
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
            <Card padding="lg">
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
                  title={`새 ${terms.INVOICE_LABEL} 생성`}
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
                        showAlert(message, variant === 'success' ? terms.MESSAGES.SUCCESS : variant === 'error' ? terms.MESSAGES.ERROR : terms.MESSAGES.ALERT);
                      },
                    }}
                  />
                </Drawer>
              ) : (
                <Modal
                  isOpen={showCreateForm}
                  onClose={() => setShowCreateForm(false)}
                  title={`새 ${terms.INVOICE_LABEL} 생성`}
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
                        showAlert(message, variant === 'success' ? terms.MESSAGES.SUCCESS : variant === 'error' ? terms.MESSAGES.ERROR : terms.MESSAGES.ALERT);
                      },
                    }}
                  />
                </Modal>
              )}
            </>
          )}
            </>
          )}

          {/* 결제 내역 탭 */}
          {selectedSubMenu === 'payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
              {/* 결제 통계 요약 */}
              <CardGridLayout
                cards={[
                  <NotificationCardLayout
                    key="total"
                    icon={<Receipt />}
                    title={`전체 ${terms.INVOICE_LABEL}`}
                    value={paymentStats?.total || 0}
                    unit="건"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-primary-50)"
                  />,
                  <NotificationCardLayout
                    key="paid"
                    icon={<CheckCircle />}
                    title="결제 완료"
                    value={paymentStats?.paid || 0}
                    unit="건"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-success-50)"
                  />,
                  <NotificationCardLayout
                    key="pending"
                    icon={<Clock />}
                    title="대기"
                    value={paymentStats?.pending || 0}
                    unit="건"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-warning-50)"
                  />,
                  <NotificationCardLayout
                    key="overdue"
                    icon={<AlertCircle />}
                    title="미납"
                    value={paymentStats?.overdue || 0}
                    unit="건"
                    layoutMode="stats"
                    iconBackgroundColor="var(--color-error-50)"
                  />,
                ]}
                desktopColumns={4}
                tabletColumns={2}
                mobileColumns={2}
              />

              {/* 수납률 카드 */}
              <Card padding="lg">
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                }}>
                  수납 현황
                </h3>
                <div style={{ display: 'flex', gap: 'var(--spacing-xl)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                      총 청구 금액
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                      {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(paymentStats?.totalAmount || 0)}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                      수납 금액
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                      {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(paymentStats?.paidAmount || 0)}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                      수납률
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                      {paymentStats?.collectionRate || 0}%
                    </div>
                  </div>
                </div>
              </Card>

              {/* 최근 결제 내역 */}
              <Card padding="lg">
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                }}>
                  최근 결제 내역
                </h3>
                {paymentsLoading ? (
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                    {terms.MESSAGES.LOADING}
                  </div>
                ) : paymentHistory && paymentHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {paymentHistory.slice(0, 10).map((payment: BillingHistoryItem) => (
                      <div
                        key={payment.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--spacing-md)',
                          backgroundColor: 'var(--color-bg-secondary)',
                          borderRadius: 'var(--border-radius-md)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-2xs)' }}>
                            {payment.payer_name || '미지정'}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            {payment.paid_at ? toKST(payment.paid_at).format('YYYY-MM-DD HH:mm') : '-'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-success)' }}>
                            {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(payment.amount_paid || 0)}
                          </div>
                          <Badge variant="soft" color="success">결제 완료</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={CreditCard} message="결제 내역이 없습니다." />
                )}
              </Card>
            </div>
          )}

          {/* 상품 관리 탭 */}
          {selectedSubMenu === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
              <Card padding="lg">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                  <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                  }}>
                    상품 목록
                  </h3>
                  <Button
                    variant="solid"
                    size="sm"
                    onClick={() => setShowProductForm(true)}
                  >
                    <Plus size={16} style={{ marginRight: 'var(--spacing-xs)' }} />
                    상품 추가
                  </Button>
                </div>
                {productsLoading ? (
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                    {terms.MESSAGES.LOADING}
                  </div>
                ) : products && products.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 'var(--spacing-md)',
                  }}>
                    {products.map((product: { id: string; name: string; type: string; amount: number }) => (
                      <Card key={product.id} padding="md">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                              <Package size={18} style={{ color: 'var(--color-primary)' }} />
                              <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{product.name}</span>
                            </div>
                            <Badge variant="soft" color={product.type === 'monthly' ? 'blue' : product.type === 'count' ? 'green' : 'gray'}>
                              {product.type === 'monthly' ? '월정액' : product.type === 'count' ? '횟수제' : '패키지'}
                            </Badge>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>
                              {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(product.amount)}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Package} message="등록된 상품이 없습니다." />
                )}
              </Card>

              {/* 상품 유형 안내 */}
              <Card padding="lg">
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                }}>
                  상품 유형 안내
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
                  <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-blue-50)', borderRadius: 'var(--border-radius-md)' }}>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-blue-700)', marginBottom: 'var(--spacing-xs)' }}>
                      월정액
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-blue-600)' }}>
                      매월 정기적으로 청구되는 상품입니다.
                    </div>
                  </div>
                  <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-green-50)', borderRadius: 'var(--border-radius-md)' }}>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-green-700)', marginBottom: 'var(--spacing-xs)' }}>
                      횟수제
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-green-600)' }}>
                      수업 횟수에 따라 청구되는 상품입니다.
                    </div>
                  </div>
                  <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-purple-50)', borderRadius: 'var(--border-radius-md)' }}>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-purple-700)', marginBottom: 'var(--spacing-xs)' }}>
                      패키지
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-purple-600)' }}>
                      여러 수업/서비스를 묶은 상품입니다.
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 수납 설정 탭 */}
          {selectedSubMenu === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
              {/* 자동 청구 설정 */}
              <Card padding="lg">
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                }}>
                  <Clock size={20} />
                  자동 청구 설정
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>월 자동 청구</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        매월 1일에 자동으로 청구서가 생성됩니다.
                      </div>
                    </div>
                    <Badge variant="soft" color="success">활성</Badge>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>청구 생성 시간</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        매일 04:00 KST에 자동 실행됩니다.
                      </div>
                    </div>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>04:00</div>
                  </div>
                </div>
              </Card>

              {/* 미납 관리 설정 */}
              <Card padding="lg">
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                }}>
                  <AlertCircle size={20} />
                  미납 관리 설정
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>미납 자동 알림</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        납부 기한 초과 시 자동으로 알림을 발송합니다.
                      </div>
                    </div>
                    <Badge variant="soft" color={(config?.notification?.auto_notification?.overdue) ? 'success' : 'gray'}>
                      {(config?.notification?.auto_notification?.overdue) ? '활성' : '비활성'}
                    </Badge>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>미납 기준</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        납부 기한 경과 후 미납으로 처리됩니다.
                      </div>
                    </div>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>납부 기한 초과</div>
                  </div>
                </div>
              </Card>

              {/* 강사 매출 배분 설정 */}
              <Card padding="lg">
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--spacing-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                }}>
                  <DollarSign size={20} />
                  {terms.STAFF_REVENUE_DISTRIBUTION} 설정
                </h3>
                <div style={{
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{terms.STAFF_REVENUE_DISTRIBUTION}</div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {terms.PERSON_LABEL_SECONDARY}별 매출 배분을 설정합니다.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTeacherRevenueSplitForm(true)}
                    >
                      설정
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </Container>
      </div>
    </ErrorBoundary>
  );
}

