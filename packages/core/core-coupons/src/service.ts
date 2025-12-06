/**
 * Core Coupons Service
 * 
 * 쿠폰/할인 관리 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Coupon,
  CouponUsage,
  CreateCouponInput,
  UpdateCouponInput,
  CouponFilter,
} from './types';

export class CouponsService {
  private supabase = createServerClient();

  /**
   * 쿠폰 목록 조회
   */
  async getCoupons(
    tenantId: string,
    filter?: CouponFilter
  ): Promise<Coupon[]> {
    let query = withTenant(
      this.supabase.from('coupons').select('*'),
      tenantId
    );

    if (filter?.is_active !== undefined) {
      query = query.eq('is_active', filter.is_active);
    }

    if (filter?.code) {
      query = query.eq('code', filter.code);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch coupons: ${error.message}`);
    }

    return (data || []) as Coupon[];
  }

  /**
   * 쿠폰 상세 조회
   */
  async getCoupon(tenantId: string, couponId: string): Promise<Coupon | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('coupons')
        .select('*')
        .eq('id', couponId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch coupon: ${error.message}`);
    }

    return data as Coupon;
  }

  /**
   * 쿠폰 코드로 조회
   */
  async getCouponByCode(
    tenantId: string,
    code: string
  ): Promise<Coupon | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('coupons')
        .select('*')
        .eq('code', code),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch coupon: ${error.message}`);
    }

    return data as Coupon;
  }

  /**
   * 쿠폰 생성
   */
  async createCoupon(
    tenantId: string,
    input: CreateCouponInput
  ): Promise<Coupon> {
    const { data, error } = await this.supabase
      .from('coupons')
      .insert({
        tenant_id: tenantId,
        code: input.code,
        name: input.name,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        min_purchase_amount: input.min_purchase_amount,
        max_discount_amount: input.max_discount_amount,
        valid_from: input.valid_from,
        valid_until: input.valid_until,
        usage_limit: input.usage_limit,
        usage_count: 0,
        is_active: input.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create coupon: ${error.message}`);
    }

    return data as Coupon;
  }

  /**
   * 쿠폰 수정
   */
  async updateCoupon(
    tenantId: string,
    couponId: string,
    input: UpdateCouponInput
  ): Promise<Coupon> {
    const { data, error } = await withTenant(
      this.supabase
        .from('coupons')
        .update(input)
        .eq('id', couponId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update coupon: ${error.message}`);
    }

    return data as Coupon;
  }

  /**
   * 쿠폰 삭제
   */
  async deleteCoupon(tenantId: string, couponId: string): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('coupons')
        .delete()
        .eq('id', couponId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete coupon: ${error.message}`);
    }
  }

  /**
   * 쿠폰 사용
   */
  async useCoupon(
    tenantId: string,
    couponId: string,
    personId?: string,
    invoiceId?: string
  ): Promise<CouponUsage> {
    // 쿠폰 유효성 검증
    const coupon = await this.getCoupon(tenantId, couponId);
    if (!coupon) {
      throw new Error('Coupon not found');
    }

    if (!coupon.is_active) {
      throw new Error('Coupon is not active');
    }

    const now = new Date().toISOString().split('T')[0];
    if (coupon.valid_from > now || coupon.valid_until < now) {
      throw new Error('Coupon is not valid for current date');
    }

    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      throw new Error('Coupon usage limit exceeded');
    }

    // 사용 기록 생성
    const { data: usage, error: usageError } = await this.supabase
      .from('coupon_usages')
      .insert({
        tenant_id: tenantId,
        coupon_id: couponId,
        person_id: personId,
        invoice_id: invoiceId,
      })
      .select()
      .single();

    if (usageError) {
      throw new Error(`Failed to record coupon usage: ${usageError.message}`);
    }

    // 사용 횟수 증가
    await withTenant(
      this.supabase
        .from('coupons')
        .update({ usage_count: coupon.usage_count + 1 })
        .eq('id', couponId),
      tenantId
    );

    return usage as CouponUsage;
  }

  /**
   * 쿠폰 사용 내역 조회
   */
  async getCouponUsages(
    tenantId: string,
    couponId?: string
  ): Promise<CouponUsage[]> {
    let query = withTenant(
      this.supabase.from('coupon_usages').select('*'),
      tenantId
    );

    if (couponId) {
      query = query.eq('coupon_id', couponId);
    }

    query = query.order('used_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch coupon usages: ${error.message}`);
    }

    return (data || []) as CouponUsage[];
  }
}

/**
 * Default Service Instance
 */
export const couponsService = new CouponsService();

