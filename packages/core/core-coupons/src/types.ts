/**
 * Core Coupons Types
 * 
 * ì¿ í°/? ì¸ ê´€ë¦?
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
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

