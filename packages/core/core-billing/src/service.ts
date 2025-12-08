/**
 * Core Billing Service
 *
 * 과금 서비스(invoices / invoice_items)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Invoice,
  InvoiceItem,
  CreateInvoiceInput,
  CreateInvoiceItemInput,
  UpdateInvoiceInput,
  InvoiceFilter,
} from './types';

export class BillingService {
  private supabase = createServerClient();

  /**
   * 인보이스 목록 조회
   */
  async getInvoices(
    tenantId: string,
    filter?: InvoiceFilter
  ): Promise<Invoice[]> {
    let query = withTenant(
      this.supabase.from('invoices').select('*'),
      tenantId
    );

    if (filter?.payer_id) {
      query = query.eq('payer_id', filter.payer_id);
    }

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    if (filter?.due_date_from) {
      query = query.gte('due_date', filter.due_date_from);
    }

    if (filter?.due_date_to) {
      query = query.lte('due_date', filter.due_date_to);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    return (data || []) as Invoice[];
  }

  /**
   * 인보이스 상세 조회
   */
  async getInvoice(tenantId: string, invoiceId: string): Promise<Invoice | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch invoice: ${error.message}`);
    }

    return data as Invoice;
  }

  /**
   * 인보이스 생성
   */
  async createInvoice(
    tenantId: string,
    input: CreateInvoiceInput
  ): Promise<Invoice> {
    // 인보이스 생성
    const { data: invoice, error: invoiceError } = await this.supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        payer_id: input.payer_id,
        amount: input.amount,
        due_date: input.due_date,
        status: 'draft',
        industry_type: input.industry_type,
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    // 인보이스 아이템 생성
    if (input.items && input.items.length > 0) {
      const items = input.items.map((item) => ({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        item_type: item.item_type,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
        description: item.description,
      }));

      const { error: itemsError } = await this.supabase
        .from('invoice_items')
        .insert(items);

      if (itemsError) {
        throw new Error(`Failed to create invoice items: ${itemsError.message}`);
      }
    }

    return invoice as Invoice;
  }

  /**
   * 인보이스 수정
   */
  async updateInvoice(
    tenantId: string,
    invoiceId: string,
    input: UpdateInvoiceInput
  ): Promise<Invoice> {
    const { data, error } = await withTenant(
      this.supabase
        .from('invoices')
        .update(input)
        .eq('id', invoiceId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update invoice: ${error.message}`);
    }

    return data as Invoice;
  }

  /**
   * 인보이스 아이템 목록 조회
   */
  async getInvoiceItems(
    tenantId: string,
    invoiceId: string
  ): Promise<InvoiceItem[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch invoice items: ${error.message}`);
    }

    return (data || []) as InvoiceItem[];
  }

  /**
   * 인보이스 아이템 추가
   */
  async addInvoiceItem(
    tenantId: string,
    invoiceId: string,
    input: CreateInvoiceItemInput
  ): Promise<InvoiceItem> {
    const { data, error } = await this.supabase
      .from('invoice_items')
      .insert({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        item_type: input.item_type,
        category: input.category,
        quantity: input.quantity,
        unit_price: input.unit_price,
        description: input.description,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add invoice item: ${error.message}`);
    }

    return data as InvoiceItem;
  }
}

/**
 * Default Service Instance
 */
export const billingService = new BillingService();
