/**
 * Student Service
 * 
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제한다.
 * [불변 규칙] INSERT 시에는 row object 안에 tenant_id 필드를 직접 포함한다.
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import { tagsService } from '@core/tags';
import type {
  Student,
  Guardian,
  StudentConsultation,
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
} from './types';
import type { Tag } from '@core/tags';

export class StudentService {
  private supabase = createServerClient();

  /**
   * 학생 목록 조회 (필터링 지원)
   */
  async getStudents(
    tenantId: string,
    filter?: StudentFilter
  ): Promise<Student[]> {
    let query = withTenant(
      this.supabase.from('students').select('*'),
      tenantId
    );

    // 상태 필터
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }

    // 학년 필터
    if (filter?.grade) {
      query = query.eq('grade', filter.grade);
    }

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

    // 태그 필터 (클라이언트 측에서 처리 또는 서브쿼리)
    if (filter?.tag_ids && filter.tag_ids.length > 0) {
      // TODO: 태그 필터링 로직 추가
    }

    // 반 필터 (클라이언트 측에서 처리 또는 서브쿼리)
    if (filter?.class_id) {
      // TODO: 반 필터링 로직 추가
    }

    return (data || []) as Student[];
  }

  /**
   * 학생 상세 조회
   */
  async getStudent(tenantId: string, studentId: string): Promise<Student | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single(),
      tenantId
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch student: ${error.message}`);
    }

    return data as Student;
  }

  /**
   * 학생 생성
   */
  async createStudent(
    tenantId: string,
    industryType: string,
    input: CreateStudentInput,
    userId?: string
  ): Promise<Student> {
    // 학생 생성
    const { data: student, error: studentError } = await this.supabase
      .from('students')
      .insert({
        tenant_id: tenantId,
        industry_type: industryType,
        name: input.name,
        birth_date: input.birth_date,
        gender: input.gender,
        phone: input.phone,
        email: input.email,
        address: input.address,
        school_name: input.school_name,
        grade: input.grade,
        status: input.status || 'active',
        notes: input.notes,
        profile_image_url: input.profile_image_url,
        created_by: userId,
      })
      .select()
      .single();

    if (studentError) {
      throw new Error(`Failed to create student: ${studentError.message}`);
    }

    // 학부모 정보 생성
    if (input.guardians && input.guardians.length > 0) {
      await this.createGuardians(tenantId, student.id, input.guardians);
    }

    // 태그 연결 (core-tags 활용)
    if (input.tag_ids && input.tag_ids.length > 0) {
      await tagsService.assignTags(tenantId, student.id, 'student', input.tag_ids);
    }

    return student as Student;
  }

  /**
   * 학생 수정
   */
  async updateStudent(
    tenantId: string,
    studentId: string,
    input: UpdateStudentInput,
    userId?: string
  ): Promise<Student> {
    const { data, error } = await withTenant(
      this.supabase
        .from('students')
        .update({
          ...input,
          updated_by: userId,
        })
        .eq('id', studentId)
        .select()
        .single(),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to update student: ${error.message}`);
    }

    return data as Student;
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
   */
  async getGuardians(tenantId: string, studentId: string): Promise<Guardian[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('guardians')
        .select('*')
        .eq('student_id', studentId)
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
   */
  async getConsultations(
    tenantId: string,
    studentId: string
  ): Promise<StudentConsultation[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('student_consultations')
        .select('*')
        .eq('student_id', studentId)
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
        student_id: studentId,
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
export const studentService = new StudentService();

