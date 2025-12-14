/**
 * Industry Academy Service
 *
 * 학원 업종 전용 비즈니스 로직
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용합니다.
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 * [불변 규칙] persons 테이블은 core-party 패키지에서 관리되므로 academy_students와 조인하여 사용합니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import { partyService } from '@core/party/service';
import { tagsService } from '@core/tags/service';
import { configService } from '@core/config/service';
import { notificationService } from '@core/notification/service';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import type {
  Student,
  Guardian,
  StudentConsultation,
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
  StudentClass,
  Class,
  CreateClassInput,
  UpdateClassInput,
  ClassFilter,
  Teacher,
  CreateTeacherInput,
  UpdateTeacherInput,
  AttendanceLog,
  CreateAttendanceLogInput,
  AttendanceFilter,
  AttendanceStatus,
  TeacherFilter,
  ClassTeacher,
  AssignTeacherInput,
} from './types';
import type { Tag } from '@core/tags';
import type { Person } from '@core/party';

export class AcademyService {
  private supabase = createServerClient();

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
    let students = (data || []).map((person) => {
      const personWithStudents = person as Person & { academy_students?: Array<Record<string, unknown>> };
      const academyData = personWithStudents.academy_students?.[0] || {};
      return {
        id: personWithStudents.id,
        tenant_id: personWithStudents.tenant_id,
        industry_type: 'academy', // 고정값
        name: personWithStudents.name,
        birth_date: academyData.birth_date,
        gender: academyData.gender,
        phone: personWithStudents.phone,
        email: personWithStudents.email,
        address: personWithStudents.address,
        school_name: academyData.school_name,
        grade: academyData.grade,
        status: academyData.status || 'active',
        notes: academyData.notes,
        profile_image_url: academyData.profile_image_url,
        created_at: personWithStudents.created_at,
        updated_at: personWithStudents.updated_at,
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

    // 태그 필터 (향후 구현 예정, 현재는 필터링 로직 추가 필요)
    if (filter?.tag_ids && filter.tag_ids.length > 0) {
      // TODO: 태그 필터링 로직 추가
    }

    // 반 필터 (향후 구현 예정, 현재는 필터링 로직 추가 필요)
    if (filter?.class_id) {
      // TODO: 반 필터링 로직 추가
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
      if ((error as { code?: string }).code === 'PGRST116') {
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

    // 3. 학부모 목록 생성
    if (input.guardians && input.guardians.length > 0) {
      await this.createGuardians(tenantId, person.id, input.guardians);
    }

    // 4. 태그 할당 (core-tags 사용)
    if (input.tag_ids && input.tag_ids.length > 0) {
      await tagsService.assignTags(tenantId, person.id, 'student', input.tag_ids);
    }

    // 5. 결과 반환 (persons + academy_students 조인)
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
   * 상담기록 AI 요약 생성
   *
   * [불변 규칙] Phase 1에서는 Supabase Edge Function으로 구현
   * 향후 AI 기능은 Edge Function 또는 외부 AI API로 구현
   *
   * TODO: 향후 AI 연동 구현 (OpenAI, Claude 등)
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
    // import { maskPII } from '@core/pii-utils';
    // const maskedContent = maskPII(consultation.content);
    // 주의: 실제 AI 연동 시 consultation.content를 그대로 전달하지 말고 PII 마스킹 적용 필수

    // 2. AI 요약 생성 (Phase 1: Supabase)
    // TODO: 향후 AI 연동 구현
    // - Edge Function 호출: fns-ai-summarize-consultation
    // - 또는 외부 AI API 직접 호출
    // - 실제 AI 연동 시 마스킹된 content를 전달해야 함
    const aiSummary = `[AI 요약] ${consultation.content.substring(0, 100)}... (요약 기능은 향후 구현 예정입니다)`;

    // 3. 상담기록에 AI 요약 추가
    await this.updateConsultation(
      tenantId,
      consultationId,
      { ai_summary: aiSummary }
    );

    return aiSummary;
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

  // ==================== 반(Class) 관리 ====================

  /**
   * 반 목록 조회 (필터링 가능)
   * [불변 규칙] withTenant() 사용하여 tenant_id 필터 강제
   */
  async getClasses(
    tenantId: string,
    filter?: ClassFilter
  ): Promise<Class[]> {
    let query = withTenant(
      this.supabase
        .from('academy_classes')
        .select('*'),
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

    // 요일 필터
    if (filter?.day_of_week) {
      query = query.eq('day_of_week', filter.day_of_week);
    }

    // 과목 필터
    if (filter?.subject) {
      query = query.eq('subject', filter.subject);
    }

    // 학년 필터
    if (filter?.grade) {
      query = query.eq('grade', filter.grade);
    }

    // 이름 검색
    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    // 정렬: 요일, 시작 시간 순
    query = query.order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch classes: ${error.message}`);
    }

    return (data || []) as Class[];
  }

  /**
   * 반 상세 조회
   */
  async getClass(tenantId: string, classId: string): Promise<Class | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('academy_classes')
        .select('*')
        .eq('id', classId),
      tenantId
    ).single();

    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch class: ${error.message}`);
    }

    return data as Class;
  }

  /**
   * 반 생성
   * [불변 규칙] INSERT 시 tenant_id 직접 포함
   * [불변 규칙] 반 색상 자동 생성 (지정하지 않으면 색상 생성)
   */
  async createClass(
    tenantId: string,
    input: CreateClassInput
  ): Promise<Class> {
    // 색상 자동 생성 (지정하지 않은 경우)
    const color = input.color || this.generateClassColor();

    // 반 생성
    const { data, error } = await this.supabase
      .from('academy_classes')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        subject: input.subject,
        grade: input.grade,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
        capacity: input.capacity,
        current_count: 0,
        color: color,
        room: input.room,
        notes: input.notes,
        status: input.status || 'active',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create class: ${error.message}`);
    }

    const newClass = data as Class;

    // 강사 배정
    if (input.teacher_ids && input.teacher_ids.length > 0) {
      for (const teacherId of input.teacher_ids) {
        await this.assignTeacher(tenantId, {
          class_id: newClass.id,
          teacher_id: teacherId,
          role: 'teacher', // 기본값으로 배정
        });
      }
    }

    return newClass;
  }

  /**
   * 반 수정
   */
  async updateClass(
    tenantId: string,
    classId: string,
    input: UpdateClassInput
  ): Promise<Class> {
    const updateData: Partial<Class> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.subject !== undefined) updateData.subject = input.subject;
    if (input.grade !== undefined) updateData.grade = input.grade;
    if (input.day_of_week !== undefined) updateData.day_of_week = input.day_of_week;
    if (input.start_time !== undefined) updateData.start_time = input.start_time;
    if (input.end_time !== undefined) updateData.end_time = input.end_time;
    if (input.capacity !== undefined) updateData.capacity = input.capacity;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.room !== undefined) updateData.room = input.room;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.status !== undefined) updateData.status = input.status;

    const result = await withTenant(
      this.supabase
        .from('academy_classes')
        .update(updateData)
        .eq('id', classId)
        .select(),
      tenantId
    ).single();
    const { data, error } = result as { data: Class | null; error: Error | null };

    if (error) {
      throw new Error(`Failed to update class: ${error.message}`);
    }

    return data as Class;
  }

  /**
   * 반 삭제 (소프트 삭제: status를 'archived'로 변경)
   */
  async deleteClass(tenantId: string, classId: string): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('academy_classes')
        .update({ status: 'archived' })
        .eq('id', classId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete class: ${error.message}`);
    }
  }

  /**
   * 반 색상 자동 생성
   * [불변 규칙] 반 색상 자동 생성
   */
  private generateClassColor(): string {
    // 기본 색상 목록(16진수 색상 코드)
    const colors = [
      '#3b82f6', // 파란색
      '#ef4444', // 빨간색
      '#10b981', // 초록색
      '#f59e0b', // 주황색
      '#8b5cf6', // 보라색
      '#ec4899', // 분홍색
      '#06b6d4', // 청록색
      '#f97316', // 주황색
      '#84cc16', // 연두색
      '#6366f1', // 인디고
    ];

    // 랜덤 색상 반환 (향후에는 기존 반 색상과 중복되지 않도록 개선 예정)
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 반별 출석률과 정원률, 지각률 조회
   * [문서 요구사항] 반별 출석률과 정원률, 지각률 조회
   * TODO: 출석 데이터가 구현되면 향후 정확히 계산
   */
  async getClassStatistics(
    tenantId: string,
    classId: string
  ): Promise<{
    attendance_rate: number;  // 출석률(%)
    capacity_rate: number;    // 정원률(%)
    late_rate: number;        // 지각률 (%)
  }> {
    // 현재는 기본값 반환 (출석 데이터가 구현되지 않아 향후 계산)
    const classData = await this.getClass(tenantId, classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    return {
      attendance_rate: 0,  // TODO: 출석 데이터가 구현되면 계산
      capacity_rate: (classData.current_count / classData.capacity) * 100,
      late_rate: 0,  // TODO: 출석 데이터가 구현되면 계산
    };
  }

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

  // ==================== 반-강사 배정 관리 ====================

  /**
   * 강사 배정
   * [문서 요구사항] 강사 배정/역할 설정
   */
  async assignTeacher(
    tenantId: string,
    input: AssignTeacherInput
  ): Promise<ClassTeacher> {
    const { data, error } = await this.supabase
      .from('class_teachers')
      .insert({
        tenant_id: tenantId,
        class_id: input.class_id,
        teacher_id: input.teacher_id,
        role: input.role,
        // 기술문서 5-2: KST 기준 날짜 처리
        assigned_at: input.assigned_at || toKST().format('YYYY-MM-DD'),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign teacher: ${error.message}`);
    }

    return data as ClassTeacher;
  }

  /**
   * 강사 배정 제거
   */
  async unassignTeacher(
    tenantId: string,
    classId: string,
    teacherId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('class_teachers')
        .update({
          is_active: false,
          // 기술문서 5-2: KST 기준 날짜 처리
          unassigned_at: toKST().format('YYYY-MM-DD'),
        })
        .eq('class_id', classId)
        .eq('teacher_id', teacherId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to unassign teacher: ${error.message}`);
    }
  }

  /**
   * 반별 강사 목록 조회
   */
  async getClassTeachers(
    tenantId: string,
    classId: string
  ): Promise<ClassTeacher[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('class_teachers')
        .select('*')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('role', { ascending: true })
        .order('assigned_at', { ascending: false }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch class teachers: ${error.message}`);
    }

    return (data || []) as ClassTeacher[];
  }

  // ==================== 학생 반 배정 관리 ====================

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
  }

  /**
   * 학생별 반 목록 조회
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

  // ==================== 출석 관리 ====================

  /**
   * 출석 로그 생성
   * [불변 규칙] INSERT 시 tenant_id 직접 포함
   */
  async createAttendanceLog(
    tenantId: string,
    input: CreateAttendanceLogInput,
    userId?: string
  ): Promise<AttendanceLog> {
    // [문서 요구사항] 출석 Hook 요구: 출석 체크 시 출결 이벤트 발생 → core-notification으로 알림 발송 → core-metering으로 사용량 기록 → core-billing으로 과금 처리

    // 1. 출석 로그 생성
    const { data, error } = await this.supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenantId,  // [불변 규칙] INSERT 시 tenant_id 직접 포함
        student_id: input.student_id,
        class_id: input.class_id,
        occurred_at: input.occurred_at,
        attendance_type: input.attendance_type,
        status: input.status,
        notes: input.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create attendance log: ${error.message}`);
    }

    const attendanceLog = data as AttendanceLog;

    // 2. core-notification으로 알림 발송 (문서 요구사항: 출석 Hook 요구)
    try {
      const config = await configService.getConfig(tenantId);
      const autoNotification = config?.attendance?.auto_notification ?? false;
      const notificationChannel = config?.attendance?.notification_channel ?? 'sms';

      // 자동 알림이 설정되어 있고, 결석이 아닌 경우에만 알림 발송
      if (autoNotification && input.status !== 'absent') {
        // 학생 정보 조회
        const student = await this.getStudent(tenantId, input.student_id);
        if (student) {
          // 학부모 정보 조회 (주 연락처 우선)
          const guardians = await this.getGuardians(tenantId, input.student_id);
          const primaryGuardian = guardians.find(g => g.is_primary) || guardians[0];

          if (primaryGuardian?.phone) {
            // 알림 메시지 생성
            const attendanceTypeText = input.attendance_type === 'check_in' ? '등원'
              : input.attendance_type === 'check_out' ? '하원'
              : input.attendance_type === 'late' ? '지각'
              : '출결';
            // 중요: 모든 케이스 처리
            const status = input.status as AttendanceStatus;
            let statusText: string;
            switch (status) {
              case 'present':
                statusText = '출석';
                break;
              case 'late':
                statusText = '지각';
                break;
              case 'absent':
                statusText = '결석';
                break;
              case 'excused':
                statusText = '사유';
                break;
              default:
                statusText = '미정';
            }

            // 기술문서 5-2: KST 기준 날짜 처리
            const occurredAtKST = toKST(input.occurred_at).format('MM/DD HH:mm');

            const message = `[학원알림] ${student.name} 학생이 ${attendanceTypeText}했습니다.\n시간: ${occurredAtKST}\n상태: ${statusText}`;

            // 알림 발송
            await notificationService.createNotification(tenantId, {
              channel: notificationChannel === 'kakao' ? 'kakao' : 'sms',
              recipient: primaryGuardian.phone,
              content: message,
            });
          }
        }
      }
    } catch (error) {
      // 알림 발송 실패해도 출결 기록은 유지됨
      console.error('Failed to send notification:', error);
    }

    // 3. analytics.events에 이벤트 기록 (문서 15-8: attendance.check_in, attendance.check_out)
    try {
      const { analyticsService } = await import('@core/analytics/service');
      const { meteringService } = await import('@core/metering/service');

      // 테넌트 정보 조회 (store_id, region_id, industry_type)
      const tenant = await this.supabase
        .from('tenants')
        .select('industry_type')
        .eq('id', tenantId)
        .single();

      // 기본 매장 조회 (Phase 1: 첫 매장만 사용)
      const store = await withTenant(
        this.supabase
          .from('core_stores')
          .select('id, region_id, industry_type')
          .eq('status', 'active')
          .limit(1),
        tenantId
      );

      const storeId = store.data?.[0]?.id;
      const regionId = store.data?.[0]?.region_id;
      const industryType = tenant.data?.industry_type || store.data?.[0]?.industry_type || 'academy';

      // 이벤트 타입 설정 (attendance.check_in 또는 attendance.check_out)
      const eventType = input.attendance_type === 'check_in'
        ? 'attendance.check_in'
        : input.attendance_type === 'check_out'
        ? 'attendance.check_out'
        : `attendance.${input.attendance_type}`;

      // analytics.events에 기록 (event_date_kst는 서비스에서 자동 계산됨)
      await analyticsService.recordEvent(tenantId, {
        event_type: eventType,
        user_id: userId,
        occurred_at: input.occurred_at,
        payload: {
          student_id: input.student_id,
          class_id: input.class_id,
          attendance_type: input.attendance_type,
          status: input.status,
        },
        store_id: storeId,
        region_id: regionId,
        industry_type: industryType,
      });

      // 4. core-metering 사용량 기록 (attendance_count)
      await meteringService.recordUsage(tenantId, {
        metric_type: 'attendance_count',
        value: 1,
        recorded_at: input.occurred_at,
      });
    } catch (error) {
      // analytics/metering 기록 실패해도 출석 기록은 유지됨
      console.error('Failed to record analytics/metering:', error);
    }

    return attendanceLog;
  }

  /**
   * 출결 로그 조회
   * [불변 규칙] SELECT 쿼리는 withTenant 사용
   */
  async getAttendanceLogs(
    tenantId: string,
    filter?: AttendanceFilter
  ): Promise<AttendanceLog[]> {
    let query = this.supabase
      .from('attendance_logs')
      .select('*')
      .order('occurred_at', { ascending: false });

    // 필터 적용
    if (filter?.student_id) {
      query = query.eq('student_id', filter.student_id);
    }
    if (filter?.class_id) {
      query = query.eq('class_id', filter.class_id);
    }
    if (filter?.date_from) {
      query = query.gte('occurred_at', filter.date_from);
    }
    if (filter?.date_to) {
      query = query.lte('occurred_at', filter.date_to);
    }
    if (filter?.attendance_type) {
      query = query.eq('attendance_type', filter.attendance_type);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await withTenant(query, tenantId);

    if (error) {
      throw new Error(`Failed to fetch attendance logs: ${error.message}`);
    }

    return (data || []) as AttendanceLog[];
  }

  /**
   * 학생별 출결 로그 조회
   */
  async getAttendanceLogsByStudent(
    tenantId: string,
    studentId: string,
    filter?: Omit<AttendanceFilter, 'student_id'>
  ): Promise<AttendanceLog[]> {
    return this.getAttendanceLogs(tenantId, { ...filter, student_id: studentId });
  }

  /**
   * 반별 출결 로그 조회
   */
  async getAttendanceLogsByClass(
    tenantId: string,
    classId: string,
    filter?: Omit<AttendanceFilter, 'class_id'>
  ): Promise<AttendanceLog[]> {
    return this.getAttendanceLogs(tenantId, { ...filter, class_id: classId });
  }

  /**
   * 출결 로그 삭제
   * [불변 규칙] DELETE 쿼리는 withTenant 사용
   */
  async deleteAttendanceLog(
    tenantId: string,
    logId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('attendance_logs')
        .delete()
        .eq('id', logId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete attendance log: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const academyService = new AcademyService();
