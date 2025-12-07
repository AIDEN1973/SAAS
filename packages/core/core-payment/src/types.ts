/**
 * Core Payment Types
 * 
 * 결제/?�림뱅킹 Provider (공통 ?�키�?비즈?�스 규칙)
 * [불�? 규칙] Core Layer??Industry 모듈???�존?��? ?�음
 * 
 * ?�️ 주의: ?�제 결제 API ?�동 코드??/packages/payments/* Provider 모듈?�서 구현?�니??
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

