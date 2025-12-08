/**
 * Core Party Service
 *
 * 회원/고객 공통 모델 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object에 tenant_id 필드를 직접 포함합니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Person,
  CreatePersonInput,
  UpdatePersonInput,
  PersonFilter,
} from './types';

export class PartyService {
  private supabase = createServerClient();

  /**
   * 회원 목록 조회 (필터링 지원)
   */
  async getPersons(
    tenantId: string,
    filter?: PersonFilter
  ): Promise<Person[]> {
    let query = withTenant(
      this.supabase.from('persons').select('*'),
      tenantId
    );

    // person_type 필터
    if (filter?.person_type) {
      if (Array.isArray(filter.person_type)) {
        query = query.in('person_type', filter.person_type);
      } else {
        query = query.eq('person_type', filter.person_type);
      }
    }

    // 이름 검색
    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    // 정렬: 최신순
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch persons: ${error.message}`);
    }

    return (data || []) as Person[];
  }

  /**
   * 회원 상세 조회
   */
  async getPerson(tenantId: string, personId: string): Promise<Person | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('persons')
        .select('*')
        .eq('id', personId),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch person: ${error.message}`);
    }

    return data as Person;
  }

  /**
   * 회원 생성
   */
  async createPerson(
    tenantId: string,
    input: CreatePersonInput
  ): Promise<Person> {
    const { data, error } = await this.supabase
      .from('persons')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        person_type: input.person_type,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create person: ${error.message}`);
    }

    return data as Person;
  }

  /**
   * 회원 수정
   */
  async updatePerson(
    tenantId: string,
    personId: string,
    input: UpdatePersonInput
  ): Promise<Person> {
    const { data, error } = await withTenant(
      this.supabase
        .from('persons')
        .update(input)
        .eq('id', personId)
        .select(),
      tenantId
    ).single();

    if (error) {
      throw new Error(`Failed to update person: ${error.message}`);
    }

    return data as Person;
  }

  /**
   * 회원 삭제
   */
  async deletePerson(tenantId: string, personId: string): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('persons')
        .delete()
        .eq('id', personId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete person: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const partyService = new PartyService();
