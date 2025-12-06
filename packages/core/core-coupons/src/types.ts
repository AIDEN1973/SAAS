/**
 * Core Coupons Types
 * 
 * 쿠폰/할인 관리
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export type DiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  valid_from: string;  // date
  valid_until: string;  // date
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export interface CouponUsage {
  id: string;
  tenant_id: string;
  coupon_id: string;
  person_id?: string;
  invoice_id?: string;
  used_at: string;
}

export interface CreateCouponInput {
  code: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  is_active?: boolean;
}

export interface UpdateCouponInput {
  name?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  valid_from?: string;
  valid_until?: string;
  usage_limit?: number;
  is_active?: boolean;
}

export interface CouponFilter {
  is_active?: boolean;
  code?: string;
}

