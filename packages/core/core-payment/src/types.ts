/**
 * Core Payment Types
 * 
 * 결제/알림뱅킹 Provider (공통 스키마/비즈니스 규칙)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * 
 * ⚠️ 주의: 실제 결제 API 연동 코드는 /packages/payments/* Provider 모듈에서 구현합니다.
 */

export type PaymentProvider = 'alimbank' | 'toss' | 'kg' | 'nice';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export interface Payment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  provider: PaymentProvider;
  amount: number;
  status: PaymentStatus;
  paid_at?: string;
  transaction_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentInput {
  invoice_id: string;
  provider: PaymentProvider;
  amount: number;
  metadata?: Record<string, any>;
}

export interface UpdatePaymentInput {
  status?: PaymentStatus;
  paid_at?: string;
  transaction_id?: string;
  metadata?: Record<string, any>;
}

export interface PaymentFilter {
  invoice_id?: string;
  provider?: PaymentProvider;
  status?: PaymentStatus;
}

