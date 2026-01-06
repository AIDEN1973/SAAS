/**
 * useBilling Hook 유닛 테스트
 *
 * [테스트 원칙]
 * - 업종중립: 테스트는 모든 업종에서 동작해야 함
 * - SSOT: 공통 테스트 유틸리티 사용
 * - API 모킹을 통한 독립적인 테스트
 */

// vitest globals를 사용하므로 describe, it, expect, vi, beforeEach, afterEach는 import하지 않음
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useBillingHistory,
  useInvoice,
  useProcessPayment,
  fetchBillingHistory,
  type BillingHistoryItem,
  type PaymentInput,
} from './useBilling';

// Mock 함수들을 vi.hoisted로 생성
const {
  mockApiGet,
  mockApiPost,
  mockGetApiContext,
  mockUseSession,
  mockCreateExecutionAuditRecord,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockGetApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
  mockUseSession: vi.fn(() => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
    },
  })),
  mockCreateExecutionAuditRecord: vi.fn().mockResolvedValue(undefined),
}));

// API SDK 모킹
vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: mockApiGet,
    post: mockApiPost,
  },
  getApiContext: mockGetApiContext,
}));

// Auth Hook 모킹
vi.mock('@hooks/use-auth', () => ({
  useSession: mockUseSession,
}));

// Execution Audit Utils 모킹
vi.mock('@hooks/use-student/src/execution-audit-utils', () => ({
  createExecutionAuditRecord: mockCreateExecutionAuditRecord,
}));

// 테스트 헬퍼: QueryClient 래퍼
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock 데이터
const mockInvoices: BillingHistoryItem[] = [
  {
    id: 'invoice-1',
    student_id: 'student-1',
    student_name: '학생 1',
    title: '2024년 1월 수업료',
    amount: 300000,
    amount_paid: 300000,
    amount_due: 0,
    status: 'paid',
    period_start: '2024-01-01',
    period_end: '2024-01-31',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
  },
  {
    id: 'invoice-2',
    student_id: 'student-1',
    student_name: '학생 1',
    title: '2024년 2월 수업료',
    amount: 300000,
    amount_paid: 0,
    amount_due: 300000,
    status: 'pending',
    period_start: '2024-02-01',
    period_end: '2024-02-29',
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },
];

describe('useBilling Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  describe('fetchBillingHistory', () => {
    it('결제 내역을 조회해야 함', async () => {
      mockApiGet.mockResolvedValue({
        data: mockInvoices,
        error: null,
      });

      const result = await fetchBillingHistory('test-tenant-id');

      expect(mockApiGet).toHaveBeenCalledWith('invoices', {
        filters: {},
        orderBy: { column: 'created_at', ascending: false },
        limit: 100,
      });

      expect(result).toEqual(mockInvoices);
    });

    it('필터를 적용하여 조회해야 함', async () => {
      mockApiGet.mockResolvedValue({
        data: [mockInvoices[0]],
        error: null,
      });

      const filter = {
        student_id: 'student-1',
        status: 'paid' as const,
      };

      const result = await fetchBillingHistory('test-tenant-id', filter);

      expect(mockApiGet).toHaveBeenCalledWith('invoices', {
        filters: {
          student_id: 'student-1',
          status: 'paid',
        },
        orderBy: { column: 'created_at', ascending: false },
        limit: 100,
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('paid');
    });

    it('API 에러 발생 시 에러를 던져야 함', async () => {
      mockApiGet.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(fetchBillingHistory('test-tenant-id')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('useBillingHistory', () => {
    it('결제 내역을 조회해야 함', async () => {
      mockApiGet.mockResolvedValue({
        data: mockInvoices,
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useBillingHistory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockInvoices);
    });

    it('필터를 적용한 조회가 가능해야 함', async () => {
      mockApiGet.mockResolvedValue({
        data: [mockInvoices[1]],
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useBillingHistory({ status: 'pending' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].status).toBe('pending');
    });

    it('tenantId가 없으면 쿼리를 실행하지 않아야 함', async () => {
      mockGetApiContext.mockReturnValue({ tenantId: null });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useBillingHistory(), { wrapper });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(mockApiGet).not.toHaveBeenCalled();
      expect(result.current.isPending).toBe(true); // enabled가 false이면 pending 상태 유지
    });
  });

  describe('useInvoice', () => {
    it('특정 청구서를 조회해야 함', async () => {
      mockApiGet.mockResolvedValue({
        data: [mockInvoices[0]],
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiGet).toHaveBeenCalledWith('invoices/invoice-1');
      expect(result.current.data).toEqual([mockInvoices[0]]);
    });

    it('invoiceId가 없으면 빈 배열을 반환해야 함', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useInvoice(), { wrapper });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(result.current.isPending).toBe(true); // enabled가 false이면 pending 상태 유지
    });
  });

  describe('useProcessPayment', () => {
    it('결제를 성공적으로 처리해야 함', async () => {
      const mockPaymentResult = {
        success: true,
        paymentId: 'payment-123',
        receiptUrl: 'https://example.com/receipt/123',
      };

      mockApiPost.mockResolvedValue({
        data: mockPaymentResult,
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProcessPayment(), { wrapper });

      const paymentInput: PaymentInput = {
        invoiceId: 'invoice-1',
        paymentMethod: 'card',
        amount: 300000,
        cardInfo: {
          number: '1234-5678-9012-3456',
          expiry: '12/25',
          cvc: '123',
          password: '12',
        },
      };

      await result.current.mutateAsync(paymentInput);

      expect(mockApiPost).toHaveBeenCalledWith(
        'functions/v1/fns-payment-process',
        paymentInput
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockPaymentResult);
    });

    it('결제 실패 시 에러를 처리해야 함', async () => {
      mockApiPost.mockResolvedValue({
        data: {
          success: false,
          error: '카드 승인 실패',
        },
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProcessPayment(), { wrapper });

      const paymentInput: PaymentInput = {
        invoiceId: 'invoice-1',
        paymentMethod: 'card',
        amount: 300000,
      };

      await result.current.mutateAsync(paymentInput);

      await waitFor(() => {
        expect(result.current.data?.success).toBe(false);
      });

      expect(result.current.data?.error).toBe('카드 승인 실패');
    });

    it('Execution Audit 기록을 생성해야 함', async () => {
      mockApiPost.mockResolvedValue({
        data: { success: true, paymentId: 'payment-123' },
        error: null,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProcessPayment(), { wrapper });

      const paymentInput: PaymentInput = {
        invoiceId: 'invoice-1',
        paymentMethod: 'simple',
        amount: 300000,
      };

      await result.current.mutateAsync(paymentInput);

      // createExecutionAuditRecord는 2개의 파라미터를 받음: (auditRecord, userId)
      expect(mockCreateExecutionAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'payment.process',
          status: 'success',
          details: expect.objectContaining({
            invoice_id: 'invoice-1',
            payment_method: 'simple',
            amount: 300000,
          }),
        }),
        'test-user-id'
      );
    });
  });

  describe('업종중립 테스트', () => {
    it('다양한 업종에서 동일하게 작동해야 함', async () => {
      const industries = ['academy', 'gym', 'music', 'art', 'dance'] as const;

      for (const industry of industries) {
        mockGetApiContext.mockReturnValue({
          tenantId: `${industry}-tenant-id`,
          industryType: industry,
        });

        mockApiGet.mockResolvedValue({
          data: mockInvoices,
          error: null,
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useBillingHistory(), { wrapper });

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockInvoices);
      }
    });
  });
});
