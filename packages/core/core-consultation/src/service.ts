/**
 * Core Consultation Service
 * 
 * 상담/기록 관리 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Consultation,
  CreateConsultationInput,
  UpdateConsultationInput,
  ConsultationFilter,
} from './types';

export class ConsultationService {
  private supabase = createServerClient();

  /**
   * 상담 목록 조회
   */
  async getConsultations(
    tenantId: string,
    filter?: ConsultationFilter
  ): Promise<Consultation[]> {
    let query = withTenant(
      this.supabase.from('consultations').select('*'),
      tenantId
    );

    if (filter?.person_id) {
      query = query.eq('person_id', filter.person_id);
    }

    if (filter?.consultation_type) {
      query = query.eq('consultation_type', filter.consultation_type);
    }

    if (filter?.date_from) {
      query = query.gte('consultation_date', filter.date_from);
    }

    if (filter?.date_to) {
      query = query.lte('consultation_date', filter.date_to);
    }

    query = query.order('consultation_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch consultations: ${error.message}`);
    }

    return (data || []) as Consultation[];
  }

  /**
   * 상담 상세 조회
   */
  async getConsultation(
    tenantId: string,
    consultationId: string
  ): Promise<Consultation | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('consultations')
        .select('*')
        .eq('id', consultationId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch consultation: ${error.message}`);
    }

    return data as Consultation;
  }

  /**
   * 상담 생성
   */
  async createConsultation(
    tenantId: string,
    input: CreateConsultationInput
  ): Promise<Consultation> {
    const { data, error } = await this.supabase
      .from('consultations')
      .insert({
        tenant_id: tenantId,
        person_id: input.person_id,
        consultation_type: input.consultation_type,
        title: input.title,
        content: input.content,
        consultation_date: input.consultation_date,
        created_by: null, // TODO: auth.uid()에서 가져오기
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create consultation: ${error.message}`);
    }

    return data as Consultation;
  }

  /**
   * 상담 수정
   */
  async updateConsultation(
    tenantId: string,
    consultationId: string,
    input: UpdateConsultationInput
  ): Promise<Consultation> {
    const { data, error } = await withTenant(
      this.supabase
        .from('consultations')
        .update(input)
        .eq('id', consultationId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update consultation: ${error.message}`);
    }

    return data as Consultation;
  }

  /**
   * 상담 삭제
   */
  async deleteConsultation(
    tenantId: string,
    consultationId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('consultations')
        .delete()
        .eq('id', consultationId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete consultation: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const consultationService = new ConsultationService();

