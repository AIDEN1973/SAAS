/**
 * Enrollment Domain - 학생 수업 배정 관리
 *
 * 학생-수업 배정(등록/해제), 수업 목록 조회
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용합니다.
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { withTenant } from '@lib/supabase-client/db';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import type {
  StudentClass,
  Class,
} from '../types';
import type { ClassDomain } from './class-domain';

export class EnrollmentDomain {
  constructor(
    protected supabase: SupabaseClient,
    private classDomain: ClassDomain
  ) {}

  // ==================== 학생 수업 배정 관리 ====================

  /**
   * 학생 반 배정
   * [불변 규칙] student_classes INSERT + academy_classes.current_count 업데이트
   * [불변 규칙] INSERT 시 tenant_id 직접 포함
   */
  async enrollStudentToClass(
    tenantId: string,
    studentId: string,
    classId: string,
    enrolledAt?: string
  ): Promise<StudentClass> {
    // 1. student_classes에 배정
    const { data: studentClass, error: insertError } = await this.supabase
      .from('student_classes')
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        class_id: classId,
        // 기술문서 5-2: KST 기준 날짜 처리
        enrolled_at: enrolledAt || toKST().format('YYYY-MM-DD'),
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to enroll student to class: ${insertError.message}`);
    }

    // 2. academy_classes.current_count 업데이트
    // 현재 등록 학생 수 계산
    const { count, error: countError } = await withTenant(
      this.supabase
        .from('student_classes')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('is_active', true),
      tenantId
    );

    if (countError) {
      throw new Error(`Failed to count students: ${countError.message}`);
    }

    // current_count 업데이트
    const { error: updateError } = await withTenant(
      this.supabase
        .from('academy_classes')
        .update({ current_count: count || 0 })
        .eq('id', classId),
      tenantId
    );

    if (updateError) {
      throw new Error(`Failed to update class count: ${updateError.message}`);
    }

    // 3. academy_students.class_name 업데이트 (대표반 이름 설정)
    const classData = await this.classDomain.getClass(tenantId, classId);
    if (classData) {
      const { error: classNameError } = await this.supabase
        .from('academy_students')
        .update({ class_name: classData.name })
        .eq('person_id', studentId)
        .eq('tenant_id', tenantId);
      if (classNameError) {
        console.warn('[AcademyService] class_name 업데이트 실패 (enroll):', classNameError);
      }
    }

    return studentClass as StudentClass;
  }

  /**
   * 학생 반 제거
   * [불변 규칙] student_classes UPDATE + academy_classes.current_count 업데이트
   */
  async unenrollStudentFromClass(
    tenantId: string,
    studentId: string,
    classId: string,
    leftAt?: string
  ): Promise<void> {
    // 1. student_classes에서 제거
    const result = await withTenant(
      this.supabase
        .from('student_classes')
        .select('id')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('is_active', true)
        .limit(1),
      tenantId
    ).single();
    const { data: assignment, error: findError } = result as { data: StudentClass | null; error: Error | null };

    if (findError || !assignment) {
      throw new Error('Student class assignment not found');
    }

    const { error: updateError } = await withTenant(
      this.supabase
        .from('student_classes')
        .update({
          is_active: false,
          // 기술문서 5-2: KST 기준 날짜 처리
          left_at: leftAt || toKST().format('YYYY-MM-DD'),
        })
        .eq('id', assignment.id),
      tenantId
    );

    if (updateError) {
      throw new Error(`Failed to unenroll student: ${updateError.message}`);
    }

    // 2. academy_classes.current_count 업데이트
    const { count, error: countError } = await withTenant(
      this.supabase
        .from('student_classes')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('is_active', true),
      tenantId
    );

    if (countError) {
      throw new Error(`Failed to count students: ${countError.message}`);
    }

    const { error: updateCountError } = await withTenant(
      this.supabase
        .from('academy_classes')
        .update({ current_count: Math.max((count || 0), 0) })
        .eq('id', classId),
      tenantId
    );

    if (updateCountError) {
      throw new Error(`Failed to update class count: ${updateCountError.message}`);
    }

    // 3. academy_students.class_name 업데이트 (남은 활성 반 중 첫 번째로 변경)
    const { data: remainingClasses } = await withTenant(
      this.supabase
        .from('student_classes')
        .select('class_id')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('enrolled_at', { ascending: true })
        .limit(1),
      tenantId
    );

    let newClassName: string | null = null;
    if (remainingClasses && remainingClasses.length > 0) {
      const remainingClass = await this.classDomain.getClass(tenantId, remainingClasses[0].class_id);
      newClassName = remainingClass?.name || null;
    }

    const { error: classNameError } = await this.supabase
      .from('academy_students')
      .update({ class_name: newClassName })
      .eq('person_id', studentId)
      .eq('tenant_id', tenantId);
    if (classNameError) {
      console.warn('[AcademyService] class_name 업데이트 실패 (unenroll):', classNameError);
    }
  }

  /**
   * 학생별 수업 목록 조회
   * [불변 규칙] student_classes + academy_classes 조인하여 조회
   */
  async getStudentClasses(
    tenantId: string,
    studentId: string
  ): Promise<Array<StudentClass & { class: Class | null }>> {
    // 1. student_classes 조회
    const { data: studentClasses, error: studentClassesError } = await withTenant(
      this.supabase
        .from('student_classes')
        .select('*')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('enrolled_at', { ascending: false }),
      tenantId
    );

    if (studentClassesError) {
      throw new Error(`Failed to fetch student classes: ${studentClassesError.message}`);
    }

    if (!studentClasses || studentClasses.length === 0) {
      return [];
    }

    // 2. class_id 배열 추출
    const classIds = studentClasses.map((sc) => sc.class_id);

    // 3. academy_classes 조회
    const { data: classes, error: classesError } = await withTenant(
      this.supabase
        .from('academy_classes')
        .select('*')
        .in('id', classIds),
      tenantId
    );

    if (classesError) {
      throw new Error(`Failed to fetch classes: ${classesError.message}`);
    }

    // 4. class_id로 매핑
    const classMap = new Map((classes || []).map((c) => [c.id, c as Class]));

    // 5. 조인하여 반환
    return studentClasses.map((sc) => ({
      ...sc,
      class: classMap.get(sc.class_id) || null,
    })) as Array<StudentClass & { class: Class | null }>;
  }

  /**
   * 전체 학생-수업 배정 목록 조회
   * [SSOT] hooks의 useAllStudentClasses와 대응
   */
  async getAllStudentClasses(
    tenantId: string,
    options?: { activeOnly?: boolean }
  ): Promise<StudentClass[]> {
    let query = withTenant(
      this.supabase
        .from('student_classes')
        .select('*')
        .order('enrolled_at', { ascending: false }),
      tenantId
    );

    if (options?.activeOnly !== false) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch all student classes: ${error.message}`);
    }

    return (data || []) as StudentClass[];
  }

  /**
   * 학생-수업 배정 페이지네이션 조회
   * [SSOT] hooks의 useStudentClassesPaged와 대응
   */
  async getStudentClassesPaged(
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      classId?: string;
      activeOnly?: boolean;
    }
  ): Promise<{ studentClasses: StudentClass[]; totalCount: number }> {
    const { page = 1, pageSize = 20, classId, activeOnly = true } = options;

    let query = withTenant(
      this.supabase
        .from('student_classes')
        .select('*', { count: 'exact' })
        .order('enrolled_at', { ascending: false }),
      tenantId
    );

    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    if (classId) {
      query = query.eq('class_id', classId);
    }

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch paged student classes: ${error.message}`);
    }

    return {
      studentClasses: (data || []) as StudentClass[],
      totalCount: count || 0,
    };
  }

  /**
   * 학생-수업 등록일 수정
   * [SSOT] hooks의 useUpdateStudentClassEnrolledAt와 대응
   */
  async updateStudentClassEnrolledAt(
    tenantId: string,
    studentClassId: string,
    enrolledAt: string
  ): Promise<StudentClass> {
    const result = await withTenant(
      this.supabase
        .from('student_classes')
        .update({ enrolled_at: enrolledAt })
        .eq('id', studentClassId)
        .select(),
      tenantId
    ).single();
    const { data, error } = result as { data: StudentClass | null; error: Error | null };

    if (error) {
      throw new Error(`Failed to update student class enrolled_at: ${error.message}`);
    }

    return data as StudentClass;
  }
}
