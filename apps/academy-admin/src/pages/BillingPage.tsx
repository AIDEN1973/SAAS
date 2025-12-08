/**
 * 수납/청구 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 월정액/횟수제/패키지 상품, 월 자동 청구 생성, 미납 관리, 결제 수단 지원
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, Modal, Container, Card, Button, Badge } from '@ui-core/react';
import { SchemaForm, SchemaTable } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils';
import type { Invoice, InvoiceStatus } from '@core/billing';
import { billingFormSchema } from '../schemas/billing.schema';
import { productFormSchema } from '../schemas/product.schema';
import { invoiceTableSchema } from '../schemas/invoice.table.schema';
import { subjectRevenueTableSchema } from '../schemas/subject-revenue.table.schema';
import { settlementFormSchema } from '../schemas/settlement.schema';
import { teacherRevenueSplitFormSchema } from '../schemas/teacher-revenue-split.schema';

export function BillingPage() {
  const { showAlert, showConfirm } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  const [filter, setFilter] = useState<{ status?: InvoiceStatus }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showTeacherRevenueSplitForm, setShowTeacherRevenueSplitForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'products' | 'payments' | 'reports'>('invoices');

  // 월 자동 청구 생성
  const generateMonthlyInvoices = useMutation({
    mutationFn: async () => {
      // TODO: 실제 월 자동 청구 생성 API 엔드포인트 구현 필요
      // 현재는 플레이스홀더
      const response = await apiClient.post<any>('invoices/generate-monthly', {
        month: toKST().format('YYYY-MM'), // YYYY-MM 형식 (KST)
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || { generated_count: 0 };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showAlert('성공', `월 자동 청구가 생성되었습니다. (${data.generated_count || 0}개)`);
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 스키마 조회 (Registry에서 가져오거나 fallback 사용)
  const { data: schema } = useSchema('invoice', billingFormSchema, 'form');
  const { data: productSchema } = useSchema('product', productFormSchema, 'form');
  const { data: invoiceTableSchemaData } = useSchema('invoice_table', invoiceTableSchema, 'table');
  const { data: subjectRevenueTableSchemaData } = useSchema('subject_revenue_table', subjectRevenueTableSchema, 'table');
  const { data: settlementSchema } = useSchema('settlement', settlementFormSchema, 'form');
  const { data: teacherRevenueSplitSchema } = useSchema('teacher_revenue_split', teacherRevenueSplitFormSchema, 'form');

  // 인보이스 목록 조회
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', tenantId, filter],
    queryFn: async () => {
      const response = await apiClient.get<Invoice>('invoices', {
        filters: filter.status ? { status: filter.status } : {},
        orderBy: { column: 'created_at', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId,
  });

  // 인보이스 생성
  const createInvoice = useMutation({
    mutationFn: async (data: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
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
      const response = await apiClient.get<any>('invoice_items', {
        orderBy: { column: 'created_at', ascending: false },
        limit: 100,
      });

      if (response.error) {
        // products 테이블이 없을 수 있으므로 빈 배열 반환
        return [];
      }

      // invoice_items에서 상품 정보 추출 (임시)
      const items = response.data || [];
      const productMap = new Map<string, any>();
      items.forEach((item: any) => {
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

  // 상품 생성
  const createProduct = useMutation({
    mutationFn: async (data: any) => {
      // TODO: products 테이블이 생성되면 실제 생성으로 변경
      // 현재는 플레이스홀더
      return { id: 'temp-' + Date.now(), ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', tenantId] });
      setShowProductForm(false);
      showAlert('성공', '상품이 생성되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 매출 통계 조회
  const { data: revenueStats } = useQuery({
    queryKey: ['revenue-stats', tenantId],
    queryFn: async () => {
      // 인보이스에서 매출 통계 계산
      const invoiceResponse = await apiClient.get<Invoice>('invoices', {
        filters: { status: 'paid' },
        orderBy: { column: 'created_at', ascending: false },
      });

      if (invoiceResponse.error) {
        return { monthlyRevenue: 0, subjectRevenue: [], totalRevenue: 0 };
      }

      const invoices = invoiceResponse.data || [];
      const nowKST = toKST();
      const currentMonth = nowKST.month(); // 0-based (0-11)
      const currentYear = nowKST.year();

      // 월 매출 계산
      const monthlyRevenue = invoices
        .filter((inv) => {
          const invDate = toKST(inv.created_at);
          return invDate.month() === currentMonth && invDate.year() === currentYear;
        })
        .reduce((sum, inv) => sum + inv.amount, 0);

      // 전체 매출
      const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);

      // 과목별 매출 집계 (invoice_items 기반)
      const invoiceIds = invoices.map((inv) => inv.id);
      const subjectRevenueMap = new Map<string, { total_amount: number; item_count: number }>();

      if (invoiceIds.length > 0) {
        // 각 인보이스의 아이템 조회
        for (const invoiceId of invoiceIds) {
          const itemsResponse = await apiClient.get<any>('invoice_items', {
            filters: { invoice_id: invoiceId },
          });

          if (!itemsResponse.error && itemsResponse.data) {
            itemsResponse.data.forEach((item: any) => {
              const category = item.category || '기타';
              const amount = (item.quantity || 1) * (item.unit_price || 0);

              if (subjectRevenueMap.has(category)) {
                const existing = subjectRevenueMap.get(category)!;
                existing.total_amount += amount;
                existing.item_count += 1;
              } else {
                subjectRevenueMap.set(category, {
                  total_amount: amount,
                  item_count: 1,
                });
              }
            });
          }
        }
      }

      const subjectRevenue = Array.from(subjectRevenueMap.entries()).map(([category, data]) => ({
        category,
        total_amount: data.total_amount,
        item_count: data.item_count,
      }));

      return {
        monthlyRevenue,
        totalRevenue,
        subjectRevenue,
      };
    },
    enabled: !!tenantId && activeTab === 'reports',
  });

  // 정산 실행
  const executeSettlement = useMutation({
    mutationFn: async (data: { year: number; month: number }) => {
      // TODO: 실제 정산 API 엔드포인트 구현 필요
      // 현재는 플레이스홀더
      const response = await apiClient.post<any>('settlements/execute', {
        year: data.year,
        month: data.month,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || { settlement_id: '', total_amount: 0 };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['revenue-stats', tenantId] });
      setShowSettlementForm(false);
      showAlert('성공', `정산이 완료되었습니다. (정산 금액: ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(data.total_amount || 0)})`);
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 강사 매출 배분 설정 저장
  const saveTeacherRevenueSplit = useMutation({
    mutationFn: async (data: any) => {
      // TODO: 실제 강사 매출 배분 설정 API 엔드포인트 구현 필요
      // 현재는 플레이스홀더
      const response = await apiClient.post<any>('teacher-revenue-split/settings', data);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || {};
    },
    onSuccess: () => {
      setShowTeacherRevenueSplitForm(false);
      showAlert('성공', '강사 매출 배분 설정이 저장되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  // 인보이스 상태 업데이트
  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const response = await apiClient.patch<Invoice>('invoices', id, { status });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showAlert('성공', '인보이스 상태가 업데이트되었습니다.');
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  const handleStatusFilter = (status?: InvoiceStatus) => {
    setFilter({ status });
  };

  const handleCreateInvoice = async (data: any) => {
    try {
      await createInvoice.mutateAsync(data);
      // 성공 시 모달 닫기는 onSuccess에서 처리됨
    } catch (error) {
      // 에러는 onError에서 처리됨
    }
  };

  const handleCreateProduct = async (data: any) => {
    try {
      await createProduct.mutateAsync(data);
    } catch (error) {
      // 에러는 onError에서 처리됨
    }
  };

  const handleStatusChange = async (id: string, newStatus: InvoiceStatus) => {
    const confirmed = await showConfirm(
      '상태 변경',
      `인보이스 상태를 "${newStatus}"로 변경하시겠습니까?`
    );
    if (confirmed) {
      updateInvoiceStatus.mutate({ id, status: newStatus });
    }
  };

  const statusColors: Record<InvoiceStatus, string> = {
    draft: 'gray',
    pending: 'warning',
    paid: 'success',
    overdue: 'error',
    cancelled: 'gray',
  };

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
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            수납/청구 관리
          </h1>

          {/* 탭 선택 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              <Button
                variant={activeTab === 'invoices' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('invoices')}
              >
                인보이스
              </Button>
              <Button
                variant={activeTab === 'products' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('products')}
              >
                상품 관리
              </Button>
              <Button
                variant={activeTab === 'payments' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('payments')}
              >
                결제 관리
              </Button>
              <Button
                variant={activeTab === 'reports' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('reports')}
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
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateMonthlyInvoices.mutate()}
                  disabled={generateMonthlyInvoices.isPending}
                >
                  {generateMonthlyInvoices.isPending ? '생성 중...' : '월 자동 청구 생성'}
                </Button>
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

          {/* 인보이스 생성 폼 (모달) */}
          {schema && (
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

          {/* 상품 관리 탭 - [요구사항] 월정액/횟수제/패키지 상품 */}
          {activeTab === 'products' && (
            <Card padding="lg" variant="default">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h2>상품 관리</h2>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => setShowProductForm(true)}
                >
                  새 상품 생성
                </Button>
              </div>

              {productsLoading ? (
                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                  로딩 중...
                </div>
              ) : products && products.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {products.map((product: any) => (
                    <Card
                      key={product.id}
                      padding="md"
                      variant="default"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                            <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                              {product.name}
                            </h4>
                            <Badge variant="outline">
                              {product.type === 'monthly' ? '월정액' :
                               product.type === 'session' ? '횟수제' :
                               product.type === 'package' ? '패키지' : product.type}
                            </Badge>
                          </div>
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(product.amount)}
                          </div>
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
                  등록된 상품이 없습니다.
                </div>
              )}

              {/* 상품 생성 모달 */}
              {productSchema && (
                <Modal
                  isOpen={showProductForm}
                  onClose={() => setShowProductForm(false)}
                  title="새 상품 생성"
                  size="md"
                >
                  <SchemaForm
                    schema={productSchema}
                    onSubmit={handleCreateProduct}
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

          {/* 결제 관리 탭 - [요구사항] 결제 수단 (계좌이체/카드/간편결제) */}
          {activeTab === 'payments' && (
            <Card padding="lg" variant="default">
              <h2 style={{ marginBottom: 'var(--spacing-md)' }}>결제 수단 설정</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {/* 계좌이체(알림뱅킹) */}
                <Card padding="md" variant="outlined">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                        계좌이체 (알림뱅킹)
                      </h4>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        계좌이체 결제를 위한 알림뱅킹 연동 설정
                      </p>
                    </div>
                    <Button variant="outline" size="sm">설정</Button>
                  </div>
                </Card>

                {/* 카드 결제 */}
                <Card padding="md" variant="outlined">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                        카드 결제
                      </h4>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        신용카드/체크카드 결제 연동
                      </p>
                    </div>
                    <Button variant="outline" size="sm">설정</Button>
                  </div>
                </Card>

                {/* 간편결제 - 카카오 */}
                <Card padding="md" variant="outlined">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                        카카오페이
                      </h4>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        카카오페이 간편결제 연동
                      </p>
                    </div>
                    <Button variant="outline" size="sm">설정</Button>
                  </div>
                </Card>

                {/* 간편결제 - 네이버 */}
                <Card padding="md" variant="outlined">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                        네이버페이
                      </h4>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        네이버페이 간편결제 연동
                      </p>
                    </div>
                    <Button variant="outline" size="sm">설정</Button>
                  </div>
                </Card>
              </div>
            </Card>
          )}

          {/* 매출/정산 탭 - [요구사항] 정산 기능, 월 매출, 과목별 매출 */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {/* 월 매출 통계 */}
              <Card padding="lg" variant="default">
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>월 매출 통계</h2>
                {revenueStats ? (
                  <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                        이번 달 매출
                      </div>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                        {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(revenueStats.monthlyRevenue)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                        전체 매출
                      </div>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                        {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(revenueStats.totalRevenue)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    매출 데이터를 불러오는 중...
                  </div>
                )}
              </Card>

              {/* 과목별 매출 */}
              <Card padding="lg" variant="default">
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>과목별 매출</h2>
                {revenueStats && revenueStats.subjectRevenue && revenueStats.subjectRevenue.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left' }}>과목</th>
                          <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>총 매출</th>
                          <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>건수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueStats.subjectRevenue.map((item: any, index: number) => (
                          <tr key={index} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: 'var(--spacing-sm)' }}>{item.category}</td>
                            <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>
                              {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(item.total_amount)}
                            </td>
                            <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>{item.item_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    과목별 매출 데이터가 없습니다.
                  </div>
                )}
              </Card>

              {/* 강사 매출 배분 (옵션) */}
              <Card padding="lg" variant="default">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                  <h2>강사 매출 배분</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTeacherRevenueSplitForm(true)}
                  >
                    설정
                  </Button>
                </div>
                <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    강사별 매출 배분 기능을 설정할 수 있습니다.
                  </p>
                </div>
              </Card>

              {/* 정산 기능 */}
              <Card padding="lg" variant="default">
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>정산</h2>
                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                  <Button
                    variant="solid"
                    size="md"
                    onClick={() => setShowSettlementForm(true)}
                    disabled={executeSettlement.isPending}
                  >
                    {executeSettlement.isPending ? '정산 중...' : '정산 실행'}
                  </Button>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
                    월별 정산을 실행하여 정산 내역을 확인할 수 있습니다.
                  </p>
                </div>
              </Card>

              {/* 정산 실행 모달 */}
              {settlementSchema && (
                <Modal
                  isOpen={showSettlementForm}
                  onClose={() => setShowSettlementForm(false)}
                  title="정산 실행"
                  size="md"
                >
                  <SchemaForm
                    schema={settlementSchema}
                    onSubmit={async (data: any) => {
                      await executeSettlement.mutateAsync({
                        year: parseInt(data.year),
                        month: parseInt(data.month),
                      });
                    }}
                    defaultValues={{
                      year: toKST().year(),
                      month: toKST().month() + 1,
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

              {/* 강사 매출 배분 설정 모달 */}
              {teacherRevenueSplitSchema && (
                <Modal
                  isOpen={showTeacherRevenueSplitForm}
                  onClose={() => setShowTeacherRevenueSplitForm(false)}
                  title="강사 매출 배분 설정"
                  size="md"
                >
                  <SchemaForm
                    schema={teacherRevenueSplitSchema}
                    onSubmit={async (data: any) => {
                      await saveTeacherRevenueSplit.mutateAsync(data);
                    }}
                    defaultValues={{
                      enabled: false,
                      split_method: 'equal',
                      split_percentage: 50,
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
            </div>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

