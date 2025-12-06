/**
 * Industry Academy Service
 * 
 * 학원 업종 전용 비즈니스 로직
 * [불변 규칙] Industry Layer는 Core Layer를 import할 수 있음
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제한다.
 * [불변 규칙] INSERT 시에는 row object 안에 tenant_id 필드를 직접 포함한다.
 * [불변 규칙] persons 테이블은 core-party 모듈에서 관리되며, academy_students는 이를 확장하여 사용합니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import { partyService } from '@core/party/service';
import { tagsService } from '@core/tags/service';
import type {
  Student,
  Guardian,
  StudentConsultation,
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
} from './types';
import type { Tag } from '@core/tags';
import type { Person } from '@core/party';

export class AcademyService {
  private supabase = createServerClient();

  /**
   * 학생 목록 조회 (필터링 지원)
   * [불변 규칙] persons + academy_students 조인하여 조회
   * [불변 규칙] 기술문서 정책: "Core Party 테이블 + 업종별 확장 테이블" 패턴 사용
   */
  async getStudents(
    tenantId: string,
    filter?: StudentFilter
  ): Promise<Student[]> {
    // persons와 academy_students를 조인하여 조회
    let query = withTenant(
      this.supabase
        .from('persons')
        .select(`
          *,
          academy_students (
            birth_date,
            gender,
            school_name,
            grade,
            class_name,
            status,
            notes,
            profile_image_url,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `)
        .eq('person_type', 'student'),
      tenantId
    );

    // 이름 검색
    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    // 정렬: 최신순
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch students: ${error.message}`);
    }

    // 데이터 변환: persons + academy_students → Student
    let students = (data || []).map((person: any) => {
      const academyData = person.academy_students?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: 'academy', // 고정값
        name: person.name,
        birth_date: academyData.birth_date,
        gender: academyData.gender,
        phone: person.phone,
        email: person.email,
        address: person.address,
        school_name: academyData.school_name,
        grade: academyData.grade,
        status: academyData.status || 'active',
        notes: academyData.notes,
        profile_image_url: academyData.profile_image_url,
        created_at: person.created_at,
        updated_at: person.updated_at,
        created_by: academyData.created_by,
        updated_by: academyData.updated_by,
      } as Student;
    });

    // 상태 필터
    if (filter?.status) {
      const statusArray = Array.isArray(filter.status) ? filter.status : [filter.status];
      students = students.filter((s) => statusArray.includes(s.status));
    }

    // 학년 필터
    if (filter?.grade) {
      students = students.filter((s) => s.grade === filter.grade);
    }

    // 태그 필터 (클라이언트 측에서 처리 또는 서브쿼리)
    if (filter?.tag_ids && filter.tag_ids.length > 0) {
      // TODO: 태그 필터링 로직 추가
    }

    // 반 필터 (클라이언트 측에서 처리 또는 서브쿼리)
    if (filter?.class_id) {
      // TODO: 반 필터링 로직 추가
    }

    return students;
  }

  /**
   * 학생 상세 조회
   * [불변 규칙] persons + academy_students 조인하여 조회
   * [불변 규칙] 기술문서 정책: "Core Party 테이블 + 업종별 확장 테이블" 패턴 사용
   */
  async getStudent(tenantId: string, studentId: string): Promise<Student | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('persons')
        .select(`
          *,
          academy_students (
            birth_date,
            gender,
            school_name,
            grade,
            class_name,
            status,
            notes,
            profile_image_url,
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `)
        .eq('id', studentId)
        .eq('person_type', 'student'),
      tenantId
    ).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch student: ${error.message}`);
    }

    // 데이터 변환: persons + academy_students → Student
    const academyData = data.academy_students?.[0] || {};
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      industry_type: 'academy',
      name: data.name,
      birth_date: academyData.birth_date,
      gender: academyData.gender,
      phone: data.phone,
      email: data.email,
      address: data.address,
      school_name: academyData.school_name,
      grade: academyData.grade,
      status: academyData.status || 'active',
      notes: academyData.notes,
      profile_image_url: academyData.profile_image_url,
      created_at: data.created_at,
      updated_at: data.updated_at,
      created_by: academyData.created_by,
      updated_by: academyData.updated_by,
    } as Student;
  }

  /**
   * 학생 생성
   * [불변 규칙] persons 테이블에 먼저 생성 후 academy_students 테이블에 확장 정보 저장
   */
  async createStudent(
    tenantId: string,
    industryType: string,
    input: CreateStudentInput,
    userId?: string
  ): Promise<Student> {
    // 1. persons 테이블에 생성 (core-party 사용)
    const person = await partyService.createPerson(tenantId, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      person_type: 'student',
    });

    // 2. academy_students 테이블에 확장 정보 저장
    const { data: academyData, error: academyError } = await this.supabase
      .from('academy_students')
      .insert({
        person_id: person.id,
        tenant_id: tenantId,
        birth_date: input.birth_date,
        gender: input.gender,
        school_name: input.school_name,
        grade: input.grade,
        class_name: undefined, // TODO: class_name 처리
        status: input.status || 'active',
        notes: input.notes,
        profile_image_url: input.profile_image_url,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (academyError) {
      // 롤백: persons 삭제
      await partyService.deletePerson(tenantId, person.id);
      throw new Error(`Failed to create academy student: ${academyError.message}`);
    }

    // 3. 학부모 정보 생성
    if (input.guardians && input.guardians.length > 0) {
      await this.createGuardians(tenantId, person.id, input.guardians);
    }

    // 5. 태그 연결 (core-tags 활용)
    if (input.tag_ids && input.tag_ids.length > 0) {
      await tagsService.assignTags(tenantId, person.id, 'student', input.tag_ids);
    }

    // 5. 결과 반환 (persons + academy_students 조합)
    return {
      id: person.id,
      tenant_id: person.tenant_id,
      industry_type: industryType,
      name: person.name,
      birth_date: academyData.birth_date,
      gender: academyData.gender,
      phone: person.phone,
      email: person.email,
      address: person.address,
      school_name: academyData.school_name,
      grade: academyData.grade,
      status: academyData.status,
      notes: academyData.notes,
      profile_image_url: academyData.profile_image_url,
      created_at: person.created_at,
      updated_at: person.updated_at,
      created_by: academyData.created_by,
      updated_by: academyData.updated_by,
    } as Student;
  }

  /**
   * 학생 수정
   * [불변 규칙] persons와 academy_students를 각각 업데이트
   */
  async updateStudent(
    tenantId: string,
    studentId: string,
    input: UpdateStudentInput,
    userId?: string
  ): Promise<Student> {
    // 1. persons 테이블 업데이트 (공통 필드)
    const personUpdate: any = {};
    if (input.name !== undefined) personUpdate.name = input.name;
    if (input.email !== undefined) personUpdate.email = input.email;
    if (input.phone !== undefined) personUpdate.phone = input.phone;
    if (input.address !== undefined) personUpdate.address = input.address;

    if (Object.keys(personUpdate).length > 0) {
      await partyService.updatePerson(tenantId, studentId, personUpdate);
    }

    // 2. academy_students 테이블 업데이트 (업종 특화 필드)
    const academyUpdate: any = {};
    if (input.birth_date !== undefined) academyUpdate.birth_date = input.birth_date;
    if (input.gender !== undefined) academyUpdate.gender = input.gender;
    if (input.school_name !== undefined) academyUpdate.school_name = input.school_name;
    if (input.grade !== undefined) academyUpdate.grade = input.grade;
    if (input.status !== undefined) academyUpdate.status = input.status;
    if (input.notes !== undefined) academyUpdate.notes = input.notes;
    if (input.profile_image_url !== undefined) academyUpdate.profile_image_url = input.profile_image_url;
    if (userId !== undefined) academyUpdate.updated_by = userId;

    if (Object.keys(academyUpdate).length > 0) {
      const { error: academyError } = await withTenant(
        this.supabase
          .from('academy_students')
          .update(academyUpdate)
          .eq('person_id', studentId),
        tenantId
      );

      if (academyError) {
        throw new Error(`Failed to update academy student: ${academyError.message}`);
      }
    }

    // 3. 업데이트된 데이터 조회하여 반환
    const updated = await this.getStudent(tenantId, studentId);
    if (!updated) {
      throw new Error(`Student not found: ${studentId}`);
    }
    return updated;
  }

  /**
   * 학생 삭제 (Soft delete: status를 'withdrawn'으로 변경)
   */
  async deleteStudent(
    tenantId: string,
    studentId: string,
    userId?: string
  ): Promise<void> {
    // Soft delete: status를 'withdrawn'으로 변경
    await this.updateStudent(tenantId, studentId, { status: 'withdrawn' }, userId);
  }

  /**
   * 학부모 목록 조회
   * [불변 규칙] student_id는 person_id를 참조 (persons.id)
   */
  async getGuardians(tenantId: string, studentId: string): Promise<Guardian[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('guardians')
        .select('*')
        .eq('student_id', studentId)  // student_id는 person_id를 참조
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch guardians: ${error.message}`);
    }

    return (data || []) as Guardian[];
  }

  /**
   * 학부모 생성
   */
  async createGuardians(
    tenantId: string,
    studentId: string,
    guardians: Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>[]
  ): Promise<Guardian[]> {
    const guardiansToInsert = guardians.map((guardian) => ({
      tenant_id: tenantId,
      student_id: studentId,
      ...guardian,
    }));

    const { data, error } = await this.supabase
      .from('guardians')
      .insert(guardiansToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to create guardians: ${error.message}`);
    }

    return (data || []) as Guardian[];
  }

  /**
   * 학생 태그 목록 조회 (core-tags 활용)
   */
  async getTags(tenantId: string): Promise<Tag[]> {
    return tagsService.getTags(tenantId, { entity_type: 'student' });
  }

  /**
   * 학생의 태그 조회 (core-tags 활용)
   */
  async getStudentTags(tenantId: string, studentId: string): Promise<Tag[]> {
    return tagsService.getEntityTags(tenantId, studentId, 'student');
  }

  /**
   * 상담일지 목록 조회
   * [불변 규칙] student_id는 person_id를 참조 (persons.id)
   */
  async getConsultations(
    tenantId: string,
    studentId: string
  ): Promise<StudentConsultation[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('student_consultations')
        .select('*')
        .eq('student_id', studentId)  // student_id는 person_id를 참조
        .order('consultation_date', { ascending: false }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch consultations: ${error.message}`);
    }

    return (data || []) as StudentConsultation[];
  }

  /**
   * 상담일지 생성
   * [불변 규칙] student_id는 person_id를 참조 (persons.id)
   */
  async createConsultation(
    tenantId: string,
    studentId: string,
    consultation: Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>,
    userId: string
  ): Promise<StudentConsultation> {
    const { data, error } = await this.supabase
      .from('student_consultations')
      .insert({
        tenant_id: tenantId,
        student_id: studentId,  // student_id는 person_id를 참조
        consultation_date: consultation.consultation_date,
        consultation_type: consultation.consultation_type,
        content: consultation.content,
        ai_summary: consultation.ai_summary,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create consultation: ${error.message}`);
    }

    return data as StudentConsultation;
  }
}

/**
 * Default Service Instance
 */
export const academyService = new AcademyService();

