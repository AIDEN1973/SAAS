/**
 * Teacher Domain - 강사 관리
 *
 * 강사 CRUD 비즈니스 로직
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용합니다.
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { withTenant } from '@lib/supabase-client/db';
import { partyService } from '@core/party/service';
import type {
  Teacher,
  CreateTeacherInput,
  UpdateTeacherInput,
  TeacherFilter,
} from '../types';
import type { Person } from '@core/party';

export class TeacherDomain {
  constructor(protected supabase: SupabaseClient) {}

  // ==================== 강사(Teacher) 관리 ====================

  /**
   * 강사 목록 조회 (필터링 가능)
   * [불변 규칙] persons + academy_teachers 조인하여 조회
   */
  async getTeachers(
    tenantId: string,
    filter?: TeacherFilter
  ): Promise<Teacher[]> {
    let query = withTenant(
      this.supabase
        .from('persons')
        .select(`
          *,
          academy_teachers (
            employee_id,
            specialization,
            hire_date,
            status,
            profile_image_url,
            bio,
            notes,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `)
        .eq('person_type', 'teacher'),
      tenantId
    );

    // 상태 필터
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        // academy_teachers.status 필터링은 조인 후 처리 필요
        // 현재는 미구현
      } else {
        // 강사 상태 필터링하여 해당 상태 강사만 조회 필요
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
      throw new Error(`Failed to fetch teachers: ${error.message}`);
    }

    // 데이터 변환: persons + academy_teachers → Teacher
    let teachers = (data || []).map((person) => {
      const personWithTeachers = person as Person & { academy_teachers?: Array<Record<string, unknown>> };
      const teacherData = personWithTeachers.academy_teachers?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        address: person.address,
        employee_id: teacherData.employee_id,
        specialization: teacherData.specialization,
        hire_date: teacherData.hire_date,
        status: teacherData.status || 'active',
        profile_image_url: teacherData.profile_image_url,
        bio: teacherData.bio,
        notes: teacherData.notes,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: teacherData.created_by,
        updated_by: teacherData.updated_by,
      } as Teacher;
    });

    // 상태 필터 (클라이언트 측 필터링, useStudents와 동일한 패턴)
    if (filter?.status) {
      const statusArray = Array.isArray(filter.status) ? filter.status : [filter.status];
      teachers = teachers.filter((t) => statusArray.includes(t.status));
    }

    // 이름 검색 (이미 쿼리 레벨에서 처리되지만, 추가 검증)
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      teachers = teachers.filter((t) =>
        t.name?.toLowerCase().includes(searchLower)
      );
    }

    // 전문 분야 필터
    if (filter?.specialization) {
      teachers = teachers.filter((t) =>
        t.specialization?.toLowerCase().includes(filter.specialization!.toLowerCase())
      );
    }

    return teachers;
  }

  /**
   * 강사 상세 조회
   */
  async getTeacher(
    tenantId: string,
    teacherId: string
  ): Promise<Teacher | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('persons')
        .select(`
          *,
          academy_teachers (
            employee_id,
            specialization,
            hire_date,
            status,
            profile_image_url,
            bio,
            notes,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `)
        .eq('id', teacherId)
        .eq('person_type', 'teacher'),
      tenantId
    ).single();

    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch teacher: ${error.message}`);
    }

    const teacherData = data.academy_teachers?.[0] || {};
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      employee_id: teacherData.employee_id,
      specialization: teacherData.specialization,
      hire_date: teacherData.hire_date,
      status: teacherData.status || 'active',
      profile_image_url: teacherData.profile_image_url,
      bio: teacherData.bio,
      notes: teacherData.notes,
      created_at: data.created_at,
      updated_at: data.updated_at,
      created_by: teacherData.created_by,
      updated_by: teacherData.updated_by,
    } as Teacher;
  }

  /**
   * 강사 생성
   * [불변 규칙] persons 테이블에 먼저 생성 후 academy_teachers 테이블에 장기 정보 추가
   */
  async createTeacher(
    tenantId: string,
    input: CreateTeacherInput
  ): Promise<Teacher> {
    // 1. persons 테이블에 생성
    const person = await partyService.createPerson(tenantId, {
      email: input.email,
      phone: input.phone,
      address: input.address,
      person_type: 'teacher',
      name: input.name,
    });

    // 2. academy_teachers 테이블에 장기 정보 추가
    // [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
    const { data, error } = await this.supabase
      .from('academy_teachers')
      .insert({
        person_id: person.id,
        tenant_id: tenantId,
        hire_date: input.hire_date,
        status: input.status || 'active',
        profile_image_url: input.profile_image_url,
        bio: input.bio,
        notes: input.notes,
      })
      .select()
      .single();

    if (error) {
      // 롤백: persons 삭제
      // [불변 규칙] DELETE 쿼리는 반드시 withTenant()를 사용해야 함
      await withTenant(
        this.supabase.from('persons').delete().eq('id', person.id),
        tenantId
      );
      throw new Error(`Failed to create teacher: ${error.message}`);
    }

    return {
      id: person.id,
      tenant_id: person.tenant_id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      address: person.address,
      employee_id: data.employee_id,
      specialization: data.specialization,
      hire_date: data.hire_date,
      status: data.status || 'active',
      profile_image_url: data.profile_image_url,
      bio: data.bio,
      notes: data.notes,
      created_at: person.created_at,
      updated_at: person.updated_at,
      created_by: data.created_by,
      updated_by: data.updated_by,
    } as Teacher;
  }

  /**
   * 강사 수정
   */
  async updateTeacher(
    tenantId: string,
    teacherId: string,
    input: UpdateTeacherInput
  ): Promise<Teacher> {
    const personUpdate: Partial<Person> = {};
    if (input.email !== undefined) personUpdate.email = input.email;
    if (input.phone !== undefined) personUpdate.phone = input.phone;
    if (input.address !== undefined) personUpdate.address = input.address;

    if (Object.keys(personUpdate).length > 0) {
      const { error: personError } = await withTenant(
        this.supabase
          .from('persons')
          .update(personUpdate)
          .eq('id', teacherId),
        tenantId
      );

      if (personError) {
        throw new Error(`Failed to update teacher person: ${personError.message}`);
      }
    }

    // 2. academy_teachers 테이블 업데이트
    const teacherUpdate: Partial<Teacher> = {};
    if (input.employee_id !== undefined) teacherUpdate.employee_id = input.employee_id;
    if (input.specialization !== undefined) teacherUpdate.specialization = input.specialization;
    if (input.hire_date !== undefined) teacherUpdate.hire_date = input.hire_date;
    if (input.status !== undefined) teacherUpdate.status = input.status;
    if (input.profile_image_url !== undefined) teacherUpdate.profile_image_url = input.profile_image_url;
    if (input.bio !== undefined) teacherUpdate.bio = input.bio;
    if (input.notes !== undefined) teacherUpdate.notes = input.notes;

    if (Object.keys(teacherUpdate).length > 0) {
      const { error: teacherError } = await withTenant(
        this.supabase
          .from('academy_teachers')
          .update(teacherUpdate)
          .eq('person_id', teacherId),
        tenantId
      );

      if (teacherError) {
        throw new Error(`Failed to update teacher: ${teacherError.message}`);
      }
    }

    // 3. 업데이트된 데이터를 조회하여 반환
    const teacher = await this.getTeacher(tenantId, teacherId);
    if (!teacher) {
      throw new Error('Teacher not found');
    }
    return teacher;
  }

  /**
   * 강사 삭제 (소프트 삭제: status를 'resigned'로 변경)
   */
  async deleteTeacher(tenantId: string, teacherId: string): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('academy_teachers')
        .update({ status: 'resigned' })
        .eq('person_id', teacherId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete teacher: ${error.message}`);
    }
  }
}
