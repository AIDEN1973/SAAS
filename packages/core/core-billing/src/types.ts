/**
 * Core Billing Types
 * 
 * 과금 (invoices / invoice_items 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존?? ?음
 */

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  tenant_id: string;
  payer_id?: string;  // person_id
  amount: number;
  due_date: string;  // date
  status: InvoiceStatus;
  industry_type?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  tenant_id: string;
  invoice_id: string;
  item_type: string;
  category?: string;
  quantity: number;
  unit_price: number;
  description?: string;
  created_at: string;
}

export interface CreateInvoiceInput {
  payer_id?: string;
  amount: number;
  due_date: string;
  industry_type?: string;
  items?: CreateInvoiceItemInput[];
}

export interface CreateInvoiceItemInput {
  item_type: string;
  category?: string;
  quantity: number;
  unit_price: number;
  description?: string;
}

export interface UpdateInvoiceInput {
  payer_id?: string;
  amount?: number;
  due_date?: string;
  status?: InvoiceStatus;
}

export interface InvoiceFilter {
  payer_id?: string;
  status?: InvoiceStatus;
  due_date_from?: string;
  due_date_to?: string;
}

