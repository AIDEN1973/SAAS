/**
 * Core Payment Service
 * 
 * 결제 ?�비??(공통 ?�키�?비즈?�스 규칙)
 * [불�? 규칙] Core Layer??Industry 모듈???�존?��? ?�음
 * 
 * ?�️ 주의: ?�제 결제 API ?�동?� /packages/payments/* Provider 모듈?�서 구현?�니??
 * ???�비?�는 결제 ?�메??공통 ?�키마�? 비즈?�스 규칙???�공?�니??
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
   * 결제 ?�성
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
   * 결제 ?�세 조회
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
   * 결제 ?�태 ?�데?�트 (?�훅?�서 ?�출)
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

