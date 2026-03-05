/**
 * Student Domain - 학생 관리
 *
 * 학생 CRUD, 학부모, 상담기록, 태그 관련 비즈니스 로직
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용합니다.
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 * [불변 규칙] persons 테이블은 core-party 패키지에서 관리되므로 academy_students와 조인하여 사용합니다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
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
} from '../types';
import type { Tag } from '@core/tags';
import type { Person } from '@core/party';
import { extractAcademyData, mapPersonToStudent } from '../student-transforms';

export class StudentDomain {
  constructor(protected supabase: SupabaseClient) {}

  /**
   * 학생 목록 조회 (필터링 가능)
   * [불변 규칙] persons + academy_students 조인하여 조회
   * [불변 규칙] 원칙 문서 참고: "Core Party 테이블 + 업종별 확장 테이블 조인 사용
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
            attendance_number,
            father_phone,
            mother_phone,
            status,
            notes,
            profile_image_url,
            deleted_at,
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
    // [소프트 삭제] deleted_at이 NULL인 학생만 포함
    // [SSOT] extractAcademyData + mapPersonToStudent 공유 함수 사용
    let students = (data || [])
      .filter((person) => {
        const personWithStudents = person as Person & { academy_students?: unknown };
        const academyData = extractAcademyData(personWithStudents.academy_students);
        // academy_students가 없거나 deleted_at이 설정된 경우 제외
        return academyData && !academyData.deleted_at;
      })
      .map((person) => {
        const personWithStudents = person as Person & { academy_students?: unknown };
        const academyData = extractAcademyData(personWithStudents.academy_students);
        return mapPersonToStudent(personWithStudents, academyData) as Student;
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

    // 태그 필터 - 선택된 태그 중 "하나라도" 가진 학생(OR)
    if (filter?.tag_ids && filter.tag_ids.length > 0) {
      const { data: assignments, error: tagError } = await withTenant(
        this.supabase
          .from('tag_assignments')
          .select('entity_id')
          .eq('entity_type', 'student')
          .in('tag_id', filter.tag_ids),
        tenantId
      );

      if (tagError) {
        throw new Error(`Failed to fetch student tags: ${tagError.message}`);
      }

      const studentIdsWithTags = new Set((assignments || []).map((a) => (a as { entity_id: string }).entity_id));
      students = students.filter((s) => studentIdsWithTags.has(s.id));
    }

    // 반 필터: student_classes 테이블에서 해당 class_id에 활성 배정된 학생 ID 조회
    if (filter?.class_id) {
      const { data: classAssignments, error: classError } = await withTenant(
        this.supabase
          .from('student_classes')
          .select('student_id')
          .eq('class_id', filter.class_id)
          .eq('is_active', true),
        tenantId
      );

      if (classError) {
        throw new Error(`Failed to fetch class assignments: ${classError.message}`);
      }

      const studentIdsInClass = new Set((classAssignments || []).map((a) => (a as { student_id: string }).student_id));
      students = students.filter((s) => studentIdsInClass.has(s.id));
    }

    return students;
  }

  /**
   * 학생 상세 조회
   * [불변 규칙] persons + academy_students 조인하여 조회
   * [불변 규칙] 원칙 문서 참고: "Core Party 테이블 + 학원 전용 확장 테이블 조인 사용
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
            attendance_number,
            father_phone,
            mother_phone,
            status,
            notes,
            profile_image_url,
            deleted_at,
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
      if ((error as { code?: string }).code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch student: ${error.message}`);
    }

    // 데이터 변환: persons + academy_students → Student
    // [소프트 삭제] deleted_at이 설정된 경우 null 반환
    // [SSOT] extractAcademyData + mapPersonToStudent 공유 함수 사용
    const academyData = extractAcademyData(data.academy_students);
    if (!academyData || academyData.deleted_at) {
      return null;
    }

    return mapPersonToStudent(data as Person, academyData) as Student;
  }

  /**
   * 학생 생성
   * [불변 규칙] persons 테이블에 먼저 생성 후 academy_students 테이블에 장기 정보 추가
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

    // 2. academy_students 테이블에 장기 정보 추가
    const { data: academyData, error: academyError } = await this.supabase
      .from('academy_students')
      .insert({
        person_id: person.id,
        tenant_id: tenantId,
        birth_date: input.birth_date,
        gender: input.gender,
        school_name: input.school_name,
        grade: input.grade,
        class_name: input.class_name || null, // 반 배정 시 enrollStudentToClass에서 자동 업데이트됨
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

    // 3. 학부모 목록 생성
    if (input.guardians && input.guardians.length > 0) {
      await this.createGuardians(tenantId, person.id, input.guardians);
    }

    // 4. 태그 할당 (core-tags 사용)
    if (input.tag_ids && input.tag_ids.length > 0) {
      await tagsService.assignTags(tenantId, person.id, 'student', input.tag_ids);
    }

    // 5. 결과 반환 (persons + academy_students 조인)
    return mapPersonToStudent(
      person,
      academyData as Record<string, unknown> | undefined
    ) as Student;
  }

  /**
   * 학생 일괄 생성 (벌크)
   * [문서 요구사항] 학생 일괄 생성(벌크)
   *
   * @param tenantId - 테넌트 ID
   * @param industryType - 업종 타입
   * @param students - 학생 데이터 배열
   * @param userId - 생성자 ID
   * @returns 생성된 학생 목록
   */
  async bulkCreateStudents(
    tenantId: string,
    industryType: string,
    students: CreateStudentInput[],
    userId?: string
  ): Promise<Student[]> {
    const results: Student[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    // 순차적으로 생성 (트랜잭션은 PostgreSQL 트랜잭션으로 처리)
    for (let i = 0; i < students.length; i++) {
      try {
        const student = await this.createStudent(tenantId, industryType, students[i], userId);
        results.push(student);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (errors.length > 0) {
      // 일부 실패한 경우 부분적으로 생성된 결과 반환
      console.warn('일부 학생 일괄 생성 실패:', errors);
    }

    return results;
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
    const personUpdate: Partial<Person> = {};
    if (input.name !== undefined) personUpdate.name = input.name;
    if (input.email !== undefined) personUpdate.email = input.email;
    if (input.phone !== undefined) personUpdate.phone = input.phone;
    if (input.address !== undefined) personUpdate.address = input.address;

    if (Object.keys(personUpdate).length > 0) {
      await partyService.updatePerson(tenantId, studentId, personUpdate);
    }

    // 2. academy_students 테이블 업데이트 (학원 전용 필드)
    const academyUpdate: Partial<Student> = {};
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

    // 3. 업데이트된 데이터를 조회하여 반환
    const updated = await this.getStudent(tenantId, studentId);
    if (!updated) {
      throw new Error(`Student not found: ${studentId}`);
    }
    return updated;
  }

  /**
   * 학생 삭제 (Soft delete: deleted_at + status='withdrawn' 동시 설정)
   * [정합성] hooks layer와 동일하게 soft_delete_student RPC 호출
   */
  async deleteStudent(
    tenantId: string,
    studentId: string,
    _userId?: string
  ): Promise<void> {
    // soft_delete_student RPC: deleted_at=now(), status='withdrawn', updated_at=now()
    const { error } = await this.supabase.rpc('soft_delete_student', {
      p_person_id: studentId,
    });

    if (error) {
      throw new Error(`Failed to delete student: ${error.message}`);
    }
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
   * 학생 태그 목록 조회 (core-tags 사용)
   */
  async getTags(tenantId: string): Promise<Tag[]> {
    return tagsService.getTags(tenantId, { entity_type: 'student' });
  }

  /**
   * 학생별 태그 조회 (core-tags 사용)
   */
  async getStudentTags(tenantId: string, studentId: string): Promise<Tag[]> {
    return tagsService.getEntityTags(tenantId, studentId, 'student');
  }

  /**
   * 상담기록 목록 조회
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
   * 상담기록 생성
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

  /**
   * 상담기록 수정
   */
  async updateConsultation(
    tenantId: string,
    consultationId: string,
    consultation: Partial<Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at' | 'created_by'>>,
    userId?: string
  ): Promise<StudentConsultation> {
    const result = await withTenant(
      this.supabase
        .from('student_consultations')
        .update({
          ...consultation,
          // 기술문서 19-1-1: 타임스탬프는 UTC로 저장 (DB 저장 규칙)
          updated_at: new Date().toISOString(),
        })
        .eq('id', consultationId)
        .select(),
      tenantId
    ).single();
    const { data, error } = result as { data: StudentConsultation | null; error: Error | null };

    if (error) {
      throw new Error(`Failed to update consultation: ${error.message}`);
    }

    return data as StudentConsultation;
  }

  /**
   * 상담기록 삭제
   */
  async deleteConsultation(
    tenantId: string,
    consultationId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('student_consultations')
        .delete()
        .eq('id', consultationId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete consultation: ${error.message}`);
    }
  }

  /**
   * 서버가 상담기록 AI 요약 생성
   *
   * [불변 규칙] Phase 1에서는 Supabase Edge Function으로 구현
   * 향후 AI 기능은 Edge Function 또는 외부 AI API로 구현
   *
   * [Phase 4 잔여] AI 연동은 core 레이어의 AI Engine에서 구현 필요
   */
  async generateConsultationAISummary(
    tenantId: string,
    consultationId: string
  ): Promise<string> {
    // 1. 상담기록 조회
    const consultation = await this.getConsultation(tenantId, consultationId);
    if (!consultation) {
      throw new Error('상담기록을 찾을 수 없습니다.');
    }

    // 2. PII 마스킹 적용 (아키텍처 문서 3.1.5, 898-950줄: 상담일지 요약 시 개인정보 마스킹 규칙)
    // TODO: 실제 AI 서비스 연동 시 PII 마스킹된 content를 전달해야 함
    // 2. Edge Function 호출로 AI 요약 생성
    const { data, error: fnError } = await this.supabase.functions.invoke(
      'consultation-ai-summary',
      {
        body: { consultation_id: consultationId },
      }
    );

    if (fnError) {
      throw new Error(`AI 요약 생성 실패: ${fnError.message}`);
    }

    const aiSummary = data?.ai_summary;
    if (!aiSummary) {
      throw new Error('AI 요약 데이터가 없습니다.');
    }

    return aiSummary as string;
  }

  /**
   * 상담기록 단건 조회 (내부용)
   */
  private async getConsultation(
    tenantId: string,
    consultationId: string
  ): Promise<StudentConsultation | null> {
    const result = await withTenant(
      this.supabase
        .from('student_consultations')
        .select('*')
        .eq('id', consultationId),
      tenantId
    ).single();
    const { data, error } = result as { data: StudentConsultation | null; error: Error | null };

    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch consultation: ${error.message}`);
    }

    return data as StudentConsultation;
  }

  /**
   * 학부모 수정
   */
  async updateGuardian(
    tenantId: string,
    guardianId: string,
    guardian: Partial<Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>>
  ): Promise<Guardian> {
    const result = await withTenant(
      this.supabase
        .from('guardians')
        .update(guardian)
        .eq('id', guardianId)
        .select(),
      tenantId
    ).single();
    const { data, error } = result as { data: Guardian | null; error: Error | null };

    if (error) {
      throw new Error(`Failed to update guardian: ${error.message}`);
    }

    return data as Guardian;
  }

  /**
   * 학부모 삭제
   */
  async deleteGuardian(
    tenantId: string,
    guardianId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('guardians')
        .delete()
        .eq('id', guardianId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete guardian: ${error.message}`);
    }
  }

  /**
   * 학생 태그 업데이트 (기존 태그 제거 후 새 태그 할당)
   */
  async updateStudentTags(
    tenantId: string,
    studentId: string,
    tagIds: string[]
  ): Promise<void> {
    // 기존 태그 할당 제거
    const { error: deleteError } = await withTenant(
      this.supabase
        .from('tag_assignments')
        .delete()
        .eq('entity_id', studentId)
        .eq('entity_type', 'student'),
      tenantId
    );

    if (deleteError) {
      throw new Error(`Failed to remove existing tags: ${deleteError.message}`);
    }

    // 새 태그 할당
    if (tagIds.length > 0) {
      await tagsService.assignTags(tenantId, studentId, 'student', tagIds);
    }
  }

  /**
   * 학생 목록 페이지네이션 조회
   * [SSOT] hooks의 useStudentsPaged와 동일한 로직을 서버에서 실행
   */
  async getStudentsPaged(
    tenantId: string,
    filter?: StudentFilter,
    page = 1,
    pageSize = 20
  ): Promise<{ students: Student[]; totalCount: number }> {
    // 1. 전체 필터링된 학생 목록 조회
    const allStudents = await this.getStudents(tenantId, filter);

    // 2. 페이지네이션 적용
    const totalCount = allStudents.length;
    const offset = (page - 1) * pageSize;
    const students = allStudents.slice(offset, offset + pageSize);

    return { students, totalCount };
  }

  /**
   * 소프트 삭제된 학생 복원
   * [SSOT] hooks의 useCreateStudent 내부 복원 로직과 대응
   * academy_students.deleted_at → NULL, status → 'active'로 복원
   */
  async restoreDeletedStudent(
    tenantId: string,
    personId: string
  ): Promise<Student> {
    const { error } = await withTenant(
      this.supabase
        .from('academy_students')
        .update({
          deleted_at: null,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('person_id', personId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to restore deleted student: ${error.message}`);
    }

    const restored = await this.getStudent(tenantId, personId);
    if (!restored) {
      throw new Error(`Restored student not found: ${personId}`);
    }
    return restored;
  }

  /**
   * 상담기록 페이지네이션 조회
   * [SSOT] hooks의 useConsultationsPaged와 대응
   */
  async getConsultationsPaged(
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      dateFrom?: string;
      dateTo?: string;
      consultationType?: string;
    }
  ): Promise<{ consultations: StudentConsultation[]; totalCount: number }> {
    const { page = 1, pageSize = 20, dateFrom, dateTo, consultationType } = options;

    let query = withTenant(
      this.supabase
        .from('student_consultations')
        .select('*', { count: 'exact' })
        .order('consultation_date', { ascending: false }),
      tenantId
    );

    if (consultationType && consultationType !== 'all') {
      query = query.eq('consultation_type', consultationType);
    }
    if (dateFrom) {
      query = query.gte('consultation_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('consultation_date', dateTo);
    }

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch paged consultations: ${error.message}`);
    }

    return {
      consultations: (data || []) as StudentConsultation[],
      totalCount: count || 0,
    };
  }
}
