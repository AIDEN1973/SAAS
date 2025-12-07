/**
 * Core Party Service
 * 
 * ?Œì›/ê³ ê° ê³µí†µ ëª¨ë¸ ?œë¹„??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ì¿¼ë¦¬??withTenant()ë¥??¬ìš©?˜ì—¬ tenant_id ?„í„°ë¥?ê°•ì œ?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] INSERT ?œì—??row object ?ˆì— tenant_id ?„ë“œë¥?ì§ì ‘ ?¬í•¨?œë‹¤.
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
   * ?Œì› ëª©ë¡ ì¡°íšŒ (?„í„°ë§?ì§€??
   */
  async getPersons(
    tenantId: string,
    filter?: PersonFilter
  ): Promise<Person[]> {
    let query = withTenant(
      this.supabase.from('persons').select('*'),
      tenantId
    );

    // person_type ?„í„°
    if (filter?.person_type) {
      if (Array.isArray(filter.person_type)) {
        query = query.in('person_type', filter.person_type);
      } else {
        query = query.eq('person_type', filter.person_type);
      }
    }

    // ?´ë¦„ ê²€??
    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    // ?•ë ¬: ìµœì‹ ??
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch persons: ${error.message}`);
    }

    return (data || []) as Person[];
  }

  /**
   * ?Œì› ?ì„¸ ì¡°íšŒ
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
   * ?Œì› ?ì„±
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
   * ?Œì› ?˜ì •
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
   * ?Œì› ?? œ
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

