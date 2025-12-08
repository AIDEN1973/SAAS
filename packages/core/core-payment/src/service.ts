/**
 * Core Payment Service
 *
 * 결제 서비스(공통 스키마/비즈니스 규칙)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 주의: 실제 결제 API 연동은 /packages/payments/* Provider 모듈에서 구현합니다.
 * 이 서비스는 결제 메타데이터의 공통 스키마와 비즈니스 규칙만 제공합니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Payment,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilter,
} from './types';

export class PaymentService {
  private supabase = createServerClient();

  /**
   * 결제 생성
   */
  async createPayment(
    tenantId: string,
    input: CreatePaymentInput
  ): Promise<Payment> {
    const { data, error } = await this.supabase
      .from('payments')
      .insert({
        tenant_id: tenantId,
        invoice_id: input.invoice_id,
        provider: input.provider,
        amount: input.amount,
        status: 'pending',
        metadata: input.metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return data as Payment;
  }

  /**
   * 결제 목록 조회
   */
  async getPayments(
    tenantId: string,
    filter?: PaymentFilter
  ): Promise<Payment[]> {
    let query = withTenant(
      this.supabase.from('payments').select('*'),
      tenantId
    );

    if (filter?.invoice_id) {
      query = query.eq('invoice_id', filter.invoice_id);
    }

    if (filter?.provider) {
      query = query.eq('provider', filter.provider);
    }

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }

    return (data || []) as Payment[];
  }

  /**
   * 결제 상세 조회
   */
  async getPayment(tenantId: string, paymentId: string): Promise<Payment | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }

    return data as Payment;
  }

  /**
   * 결제 상태 업데이트 (웹훅에서 호출)
   */
  async updatePayment(
    tenantId: string,
    paymentId: string,
    input: UpdatePaymentInput
  ): Promise<Payment> {
    const { data, error } = await withTenant(
      this.supabase
        .from('payments')
        .update(input)
        .eq('id', paymentId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update payment: ${error.message}`);
    }

    return data as Payment;
  }
}

/**
 * Default Service Instance
 */
export const paymentService = new PaymentService();
