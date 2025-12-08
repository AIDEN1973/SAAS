/**
 * Industry Academy Service
 * 
 * ?숈썝 ?낆쥌 ?꾩슜 鍮꾩쫰?덉뒪 濡쒖쭅
 * [遺덈? 洹쒖튃] Industry Layer??Core Layer瑜?import?????덉쓬
 * [遺덈? 洹쒖튃] 紐⑤뱺 荑쇰━??withTenant()瑜??ъ슜?섏뿬 tenant_id ?꾪꽣瑜?媛뺤젣?쒕떎.
 * [遺덈? 洹쒖튃] INSERT ?쒖뿉??row object ?덉뿉 tenant_id ?꾨뱶瑜?吏곸젒 ?ы븿?쒕떎.
 * [遺덈? 洹쒖튃] persons ?뚯씠釉붿? core-party 紐⑤뱢?먯꽌 愿由щ릺硫? academy_students???대? ?뺤옣?섏뿬 ?ъ슜?⑸땲??
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import { partyService } from '@core/party/service';
import { tagsService } from '@core/tags/service';
import { configService } from '@core/config/service';
import { notificationService } from '@core/notification/service';
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
   * ?숈깮 紐⑸줉 議고쉶 (?꾪꽣留?吏??
   * [遺덈? 洹쒖튃] persons + academy_students 議곗씤?섏뿬 議고쉶
   * [遺덈? 洹쒖튃] 湲곗닠臾몄꽌 ?뺤콉: "Core Party ?뚯씠釉?+ ?낆쥌蹂??뺤옣 ?뚯씠釉? ?⑦꽩 ?ъ슜
   */
  async getStudents(
    tenantId: string,
    filter?: StudentFilter
  ): Promise<Student[]> {
    // persons? academy_students瑜?議곗씤?섏뿬 議고쉶
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

    // ?곗씠??蹂?? persons + academy_students ??Student
    let students = (data || []).map((person: any) => {
      const academyData = person.academy_students?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: 'academy', // 怨좎젙媛?        name: person.name,
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

    // ?곹깭 ?꾪꽣
    if (filter?.status) {
      const statusArray = Array.isArray(filter.status) ? filter.status : [filter.status];
      students = students.filter((s) => statusArray.includes(s.status));
    }

    // ?숇뀈 ?꾪꽣
    if (filter?.grade) {
      students = students.filter((s) => s.grade === filter.grade);
    }

    // ?쒓렇 ?꾪꽣 (?대씪?댁뼵??痢≪뿉??泥섎━ ?먮뒗 ?쒕툕荑쇰━)
    if (filter?.tag_ids && filter.tag_ids.length > 0) {
      // TODO: ?쒓렇 ?꾪꽣留?濡쒖쭅 異붽?
    }

    // 諛??꾪꽣 (?대씪?댁뼵??痢≪뿉??泥섎━ ?먮뒗 ?쒕툕荑쇰━)
    if (filter?.class_id) {
      // TODO: 諛??꾪꽣留?濡쒖쭅 異붽?
    }

    return students;
  }

  /**
   * ?숈깮 ?곸꽭 議고쉶
   * [遺덈? 洹쒖튃] persons + academy_students 議곗씤?섏뿬 議고쉶
   * [遺덈? 洹쒖튃] 湲곗닠臾몄꽌 ?뺤콉: "Core Party ?뚯씠釉?+ ?낆쥌蹂??뺤옣 ?뚯씠釉? ?⑦꽩 ?ъ슜
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

    // ?곗씠??蹂?? persons + academy_students ??Student
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
   * ?숈깮 ?앹꽦
   * [遺덈? 洹쒖튃] persons ?뚯씠釉붿뿉 癒쇱? ?앹꽦 ??academy_students ?뚯씠釉붿뿉 ?뺤옣 ?뺣낫 ???   */
  async createStudent(
    tenantId: string,
    industryType: string,
    input: CreateStudentInput,
    userId?: string
  ): Promise<Student> {
    // 1. persons ?뚯씠釉붿뿉 ?앹꽦 (core-party ?ъ슜)
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
        class_name: undefined, // TODO: class_name 泥섎━
        status: input.status || 'active',
        notes: input.notes,
        profile_image_url: input.profile_image_url,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (academyError) {
      // 濡ㅻ갚: persons ??젣
      await partyService.deletePerson(tenantId, person.id);
      throw new Error(`Failed to create academy student: ${academyError.message}`);
    }

    // 3. ?숇?紐??뺣낫 ?앹꽦
    if (input.guardians && input.guardians.length > 0) {
      await this.createGuardians(tenantId, person.id, input.guardians);
    }

    // 5. ?쒓렇 ?곌껐 (core-tags ?쒖슜)
    if (input.tag_ids && input.tag_ids.length > 0) {
      await tagsService.assignTags(tenantId, person.id, 'student', input.tag_ids);
    }

    // 5. 寃곌낵 諛섑솚 (persons + academy_students 議고빀)
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
   * ?숈깮 ?쇨큵 ?깅줉 (?묒?)
   * [?붽뎄?ы빆] ?숈깮 ?쇨큵 ?깅줉(?묒?)
   * 
   * @param tenantId - ?뚮꼳??ID
   * @param industryType - ?낆쥌 ???   * @param students - ?숈깮 ?곗씠??諛곗뿴
   * @param userId - ?앹꽦??ID
   * @returns ?앹꽦???숈깮 紐⑸줉
   */
  async bulkCreateStudents(
    tenantId: string,
    industryType: string,
    students: CreateStudentInput[],
    userId?: string
  ): Promise<Student[]> {
    const results: Student[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    // ?쒖감?곸쑝濡??앹꽦 (?몃옖??뀡? PostgreSQL ?덈꺼?먯꽌 泥섎━)
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
      // ?쇰? ?ㅽ뙣??寃쎌슦 寃쎄퀬? ?④퍡 ?깃났??寃곌낵 諛섑솚
      console.warn('?쇰? ?숈깮 ?깅줉 ?ㅽ뙣:', errors);
    }

    return results;
  }

  /**
   * ?숈깮 ?섏젙
   * [遺덈? 洹쒖튃] persons? academy_students瑜?媛곴컖 ?낅뜲?댄듃
   */
  async updateStudent(
    tenantId: string,
    studentId: string,
    input: UpdateStudentInput,
    userId?: string
  ): Promise<Student> {
    // 1. persons ?뚯씠釉??낅뜲?댄듃 (怨듯넻 ?꾨뱶)
    const personUpdate: any = {};
    if (input.name !== undefined) personUpdate.name = input.name;
    if (input.email !== undefined) personUpdate.email = input.email;
    if (input.phone !== undefined) personUpdate.phone = input.phone;
    if (input.address !== undefined) personUpdate.address = input.address;

    if (Object.keys(personUpdate).length > 0) {
      await partyService.updatePerson(tenantId, studentId, personUpdate);
    }

    // 2. academy_students ?뚯씠釉??낅뜲?댄듃 (?낆쥌 ?뱁솕 ?꾨뱶)
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

    // 3. ?낅뜲?댄듃???곗씠??議고쉶?섏뿬 諛섑솚
    const updated = await this.getStudent(tenantId, studentId);
    if (!updated) {
      throw new Error(`Student not found: ${studentId}`);
    }
    return updated;
  }

  /**
   * ?숈깮 ??젣 (Soft delete: status瑜?'withdrawn'?쇰줈 蹂寃?
   */
  async deleteStudent(
    tenantId: string,
    studentId: string,
    userId?: string
  ): Promise<void> {
    // Soft delete: status瑜?'withdrawn'?쇰줈 蹂寃?    await this.updateStudent(tenantId, studentId, { status: 'withdrawn' }, userId);
  }

  /**
   * ?숇?紐?紐⑸줉 議고쉶
   * [遺덈? 洹쒖튃] student_id??person_id瑜?李몄“ (persons.id)
   */
  async getGuardians(tenantId: string, studentId: string): Promise<Guardian[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('guardians')
        .select('*')
        .eq('student_id', studentId)  // student_id??person_id瑜?李몄“
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
   * ?숇?紐??앹꽦
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
   * ?숈깮 ?쒓렇 紐⑸줉 議고쉶 (core-tags ?쒖슜)
   */
  async getTags(tenantId: string): Promise<Tag[]> {
    return tagsService.getTags(tenantId, { entity_type: 'student' });
  }

  /**
   * ?숈깮???쒓렇 議고쉶 (core-tags ?쒖슜)
   */
  async getStudentTags(tenantId: string, studentId: string): Promise<Tag[]> {
    return tagsService.getEntityTags(tenantId, studentId, 'student');
  }

  /**
   * ?곷떞?쇱? 紐⑸줉 議고쉶
   * [遺덈? 洹쒖튃] student_id??person_id瑜?李몄“ (persons.id)
   */
  async getConsultations(
    tenantId: string,
    studentId: string
  ): Promise<StudentConsultation[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('student_consultations')
        .select('*')
        .eq('student_id', studentId)  // student_id??person_id瑜?李몄“
        .order('consultation_date', { ascending: false }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch consultations: ${error.message}`);
    }

    return (data || []) as StudentConsultation[];
  }

  /**
   * ?곷떞?쇱? ?앹꽦
   * [遺덈? 洹쒖튃] student_id??person_id瑜?李몄“ (persons.id)
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
        student_id: studentId,  // student_id??person_id瑜?李몄“
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
   * ?곷떞?쇱? ?섏젙
   */
  async updateConsultation(
    tenantId: string,
    consultationId: string,
    consultation: Partial<Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at' | 'created_by'>>,
    userId?: string
  ): Promise<StudentConsultation> {
    const { data, error } = await withTenant(
      this.supabase
        .from('student_consultations')
        .update({
          ...consultation,
          updated_at: new Date().toISOString(),
        })
        .eq('id', consultationId)
        .select()
        .single() as any,
      tenantId
    );

    if (error) {
      throw new Error(`Failed to update consultation: ${error.message}`);
    }

    return data as StudentConsultation;
  }

  /**
   * ?곷떞?쇱? ??젣
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
   * ?곷떞?쇱? AI ?붿빟 ?앹꽦
   * 
   * [遺덈? 洹쒖튃] Phase 1?먯꽌???뚮젅?댁뒪??붾줈 援ы쁽
   * ?ㅼ젣 AI ?곕룞? Edge Function ?먮뒗 ?몃? AI ?쒕퉬?ㅻ? ?듯빐 援ы쁽
   * 
   * TODO: ?ㅼ젣 AI ?쒕퉬???곕룞 (OpenAI, Claude ??
   */
  async generateConsultationAISummary(
    tenantId: string,
    consultationId: string
  ): Promise<string> {
    // 1. ?곷떞?쇱? 議고쉶
    const consultation = await this.getConsultation(tenantId, consultationId);
    if (!consultation) {
      throw new Error('?곷떞?쇱?瑜?李얠쓣 ???놁뒿?덈떎.');
    }

    // 2. AI ?붿빟 ?앹꽦 (Phase 1: ?뚮젅?댁뒪???
    // TODO: ?ㅼ젣 AI ?쒕퉬???곕룞
    // - Edge Function ?몄텧: fns-ai-summarize-consultation
    // - ?먮뒗 ?몃? AI API 吏곸젒 ?몄텧
    const aiSummary = `[AI ?붿빟] ${consultation.content.substring(0, 100)}... (?붿빟 湲곕뒫? 怨??쒓났???덉젙?낅땲??)`;

    // 3. 상담기록에 AI 요약 추가
    await this.updateConsultation(
      tenantId,
      consultationId,
      { ai_summary: aiSummary }
    );

    return aiSummary;
  }

  /**
   * ?곷떞?쇱? ?④굔 議고쉶 (?대???
   */
  private async getConsultation(
    tenantId: string,
    consultationId: string
  ): Promise<StudentConsultation | null> {
    const { data, error } = await withTenant(
      this.supabase
        .from('student_consultations')
        .select('*')
        .eq('id', consultationId)
        .single() as any,
      tenantId
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch consultation: ${error.message}`);
    }

    return data as StudentConsultation;
  }

  /**
   * ?숇?紐??섏젙
   */
  async updateGuardian(
    tenantId: string,
    guardianId: string,
    guardian: Partial<Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>>
  ): Promise<Guardian> {
    const { data, error } = await withTenant(
      this.supabase
        .from('guardians')
        .update(guardian)
        .eq('id', guardianId)
        .select()
        .single() as any,
      tenantId
    );

    if (error) {
      throw new Error(`Failed to update guardian: ${error.message}`);
    }

    return data as Guardian;
  }

  /**
   * ?숇?紐???젣
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
   * ?숈깮 ?쒓렇 ?낅뜲?댄듃 (湲곗〈 ?쒓렇 ?쒓굅 ?????쒓렇 ?좊떦)
   */
  async updateStudentTags(
    tenantId: string,
    studentId: string,
    tagIds: string[]
  ): Promise<void> {
    // 湲곗〈 ?쒓렇 ?좊떦 ?쒓굅
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

    // ???쒓렇 ?좊떦
    if (tagIds.length > 0) {
      await tagsService.assignTags(tenantId, studentId, 'student', tagIds);
    }
  }

  // ==================== 諛?Class) 愿由?====================

  /**
   * 諛?紐⑸줉 議고쉶 (?꾪꽣留?吏??
   * [遺덈? 洹쒖튃] withTenant() ?ъ슜?섏뿬 tenant_id ?꾪꽣 媛뺤젣
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

    // ?곹깭 ?꾪꽣
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }

    // ?붿씪 ?꾪꽣
    if (filter?.day_of_week) {
      query = query.eq('day_of_week', filter.day_of_week);
    }

    // 怨쇰ぉ ?꾪꽣
    if (filter?.subject) {
      query = query.eq('subject', filter.subject);
    }

    // ?숇뀈 ?꾪꽣
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
   * 諛??곸꽭 議고쉶
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
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch class: ${error.message}`);
    }

    return data as Class;
  }

  /**
   * 諛??앹꽦
   * [遺덈? 洹쒖튃] INSERT ??tenant_id 吏곸젒 ?ы븿
   * [遺덈? 洹쒖튃] 諛??먮룞 ?됱긽 ?쒓퉭 (吏?뺥븯吏 ?딆쑝硫??먮룞 ?앹꽦)
   */
  async createClass(
    tenantId: string,
    input: CreateClassInput
  ): Promise<Class> {
    // ?됱긽 ?먮룞 ?앹꽦 (吏?뺥븯吏 ?딆? 寃쎌슦)
    const color = input.color || this.generateClassColor();

    // 諛??앹꽦
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

    // 媛뺤궗 諛곗젙
    if (input.teacher_ids && input.teacher_ids.length > 0) {
      for (const teacherId of input.teacher_ids) {
        await this.assignTeacher(tenantId, {
          class_id: newClass.id,
          teacher_id: teacherId,
          role: 'teacher', // 湲곕낯媛? ?댁엫
        });
      }
    }

    return newClass;
  }

  /**
   * 諛??섏젙
   */
  async updateClass(
    tenantId: string,
    classId: string,
    input: UpdateClassInput
  ): Promise<Class> {
    const updateData: any = {};

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

    const { data, error } = await withTenant(
      this.supabase
        .from('academy_classes')
        .update(updateData)
        .eq('id', classId)
        .select()
        .single() as any,
      tenantId
    );

    if (error) {
      throw new Error(`Failed to update class: ${error.message}`);
    }

    return data as Class;
  }

  /**
   * 諛???젣 (?뚰봽????젣: status瑜?'archived'濡?蹂寃?
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
   * 諛??먮룞 ?됱긽 ?앹꽦
   * [遺덈? 洹쒖튃] 諛??먮룞 ?됱긽 ?쒓퉭
   */
  private generateClassColor(): string {
    // 湲곕낯 ?됱긽 ?붾젅??(16吏꾩닔 ?됱긽 肄붾뱶)
    const colors = [
      '#3b82f6', // ?뚮???      '#ef4444', // 鍮④컙??      '#10b981', // 珥덈줉??      '#f59e0b', // 二쇳솴??      '#8b5cf6', // 蹂대씪??      '#ec4899', // 遺꾪솉??      '#06b6d4', // 泥?줉??      '#f97316', // 二쇳솴??      '#84cc16', // ?곕몢??      '#6366f1', // ?⑥깋
    ];

    // ?쒕뜡 ?됱긽 諛섑솚 (?ㅼ젣濡쒕뒗 湲곗〈 諛??됱긽怨?以묐났?섏? ?딅룄濡?媛쒖꽑 媛??
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 諛섎퀎 異쒓껐瑜??뺤썝瑜?吏媛곷쪧 議고쉶
   * [?붽뎄?ы빆] 諛섎퀎 異쒓껐瑜??뺤썝瑜?吏媛곷쪧 ?쒖떆
   * TODO: 異쒓껐 ?곗씠?곌? 援ы쁽?섎㈃ ?ㅼ젣 ?듦퀎 怨꾩궛
   */
  async getClassStatistics(
    tenantId: string,
    classId: string
  ): Promise<{
    attendance_rate: number;  // 異쒓껐瑜?(%)
    capacity_rate: number;    // ?뺤썝瑜?(%)
    late_rate: number;        // 吏媛곷쪧 (%)
  }> {
    // ?꾩옱??湲곕낯媛?諛섑솚 (異쒓껐 ?곗씠??援ы쁽 ???ㅼ젣 怨꾩궛)
    const classData = await this.getClass(tenantId, classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    return {
      attendance_rate: 0,  // TODO: 異쒓껐 ?곗씠??湲곕컲 怨꾩궛
      capacity_rate: (classData.current_count / classData.capacity) * 100,
      late_rate: 0,  // TODO: 異쒓껐 ?곗씠??湲곕컲 怨꾩궛
    };
  }

  // ==================== 媛뺤궗(Teacher) 愿由?====================

  /**
   * 媛뺤궗 紐⑸줉 議고쉶 (?꾪꽣留?吏??
   * [遺덈? 洹쒖튃] persons + academy_teachers 議곗씤?섏뿬 議고쉶
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

    // ?곹깭 ?꾪꽣
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        // academy_teachers.status ?꾪꽣留곸? 議곗씤 ??泥섎━ ?꾩슂
        // ?꾩옱??媛꾨떒??援ы쁽
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

    // ?곗씠??蹂?? persons + academy_teachers ??Teacher
    return (data || []).map((person: any) => {
      const teacherData = person.academy_teachers?.[0] || {};
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
      if (error.code === 'PGRST116') {
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
    const { data, error } = await this.supabase
      .from('academy_teachers')
      .insert({
        person_id: person.id,
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
  /**
   * 강사 수정
   */
  async updateTeacher(
    tenantId: string,
    teacherId: string,
    input: UpdateTeacherInput
  ): Promise<Teacher> {
    const personUpdate: any = {};
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

    // 2. academy_teachers ?뚯씠釉??낅뜲?댄듃
    const teacherUpdate: any = {};
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

    // 3. ?낅뜲?댄듃???곗씠??議고쉶?섏뿬 諛섑솚
    const teacher = await this.getTeacher(tenantId, teacherId);
    if (!teacher) {
      throw new Error('Teacher not found');
    }
    return teacher;
  }

  /**
   * 媛뺤궗 ??젣 (?뚰봽????젣: status瑜?'resigned'濡?蹂寃?
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

  // ==================== 諛?媛뺤궗 ?곌껐 愿由?====================

  /**
   * 媛뺤궗 諛곗젙
   * [?붽뎄?ы빆] 媛뺤궗 諛곗젙/遺?댁엫 ?ㅼ젙
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
        assigned_at: input.assigned_at || new Date().toISOString().split('T')[0],
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
   * 媛뺤궗 諛곗젙 ?댁젣
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
          unassigned_at: new Date().toISOString().split('T')[0],
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
   * 諛섎퀎 媛뺤궗 紐⑸줉 議고쉶
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

  // ==================== ?숈깮 諛?諛곗젙 愿由?====================

  /**
   * ?숈깮 諛?諛곗젙
   * [遺덈? 洹쒖튃] student_classes INSERT + academy_classes.current_count ?낅뜲?댄듃
   * [遺덈? 洹쒖튃] INSERT ??tenant_id 吏곸젒 ?ы븿
   */
  async enrollStudentToClass(
    tenantId: string,
    studentId: string,
    classId: string,
    enrolledAt?: string
  ): Promise<StudentClass> {
    // 1. student_classes??諛곗젙
    const { data: studentClass, error: insertError } = await this.supabase
      .from('student_classes')
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        class_id: classId,
        enrolled_at: enrolledAt || new Date().toISOString().split('T')[0],
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to enroll student to class: ${insertError.message}`);
    }

    // 2. academy_classes.current_count ?낅뜲?댄듃
    // ?꾩옱 ?쒖꽦 ?숈깮 ??怨꾩궛
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

    // current_count ?낅뜲?댄듃
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
   * ?숈깮 諛??댁젣
   * [遺덈? 洹쒖튃] student_classes UPDATE + academy_classes.current_count ?낅뜲?댄듃
   */
  async unenrollStudentFromClass(
    tenantId: string,
    studentId: string,
    classId: string,
    leftAt?: string
  ): Promise<void> {
    // 1. student_classes?먯꽌 ?댁젣
    const { data: assignment, error: findError } = await withTenant(
      this.supabase
        .from('student_classes')
        .select('id')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('is_active', true)
        .limit(1)
        .single() as any,
      tenantId
    );

    if (findError || !assignment) {
      throw new Error('Student class assignment not found');
    }

    const { error: updateError } = await withTenant(
      this.supabase
        .from('student_classes')
        .update({
          is_active: false,
          left_at: leftAt || new Date().toISOString().split('T')[0],
        })
        .eq('id', assignment.id),
      tenantId
    );

    if (updateError) {
      throw new Error(`Failed to unenroll student: ${updateError.message}`);
    }

    // 2. academy_classes.current_count ?낅뜲?댄듃
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
   * ?숈깮??諛?紐⑸줉 議고쉶
   * [遺덈? 洹쒖튃] student_classes + academy_classes 議곗씤?섏뿬 議고쉶
   */
  async getStudentClasses(
    tenantId: string,
    studentId: string
  ): Promise<Array<StudentClass & { class: Class | null }>> {
    // 1. student_classes 議고쉶
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

    // 2. class_id 諛곗뿴 異붿텧
    const classIds = studentClasses.map((sc) => sc.class_id);

    // 3. academy_classes 議고쉶
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

    // 4. class_id濡?留??앹꽦
    const classMap = new Map((classes || []).map((c) => [c.id, c as Class]));

    // 5. 議고빀?섏뿬 諛섑솚
    return studentClasses.map((sc) => ({
      ...sc,
      class: classMap.get(sc.class_id) || null,
    })) as Array<StudentClass & { class: Class | null }>;
  }

  // ==================== 異쒓껐 愿由?====================

  /**
   * 異쒓껐 濡쒓렇 ?앹꽦
   * [遺덈? 洹쒖튃] INSERT ??tenant_id 吏곸젒 ?ы븿
   */
  async createAttendanceLog(
    tenantId: string,
    input: CreateAttendanceLogInput,
    userId?: string
  ): Promise<AttendanceLog> {
    // [臾몄꽌 ?붽뎄?ы빆] 異쒓껐 Hook ?먮쫫: 異쒖꽍 泥댄겕 ??異쒓껐 ?대깽??諛쒖깮 ??core-notification ???숇?紐??뚮┝ ??core-metering ???ъ슜??湲곕줉 ??core-billing ???붾쭚 ?먮룞泥?뎄
    
    // 1. 異쒓껐 濡쒓렇 ?앹꽦
    const { data, error } = await this.supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenantId,  // [遺덈? 洹쒖튃] INSERT ??tenant_id 吏곸젒 ?ы븿
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

    // 2. core-notification ???숇?紐??뚮┝ (臾몄꽌 ?붽뎄?ы빆: 異쒓껐 Hook ?먮쫫)
    try {
      const config = await configService.getConfig(tenantId);
      const autoNotification = config?.attendance?.auto_notification ?? false;
      const notificationChannel = config?.attendance?.notification_channel ?? 'sms';

      // ?먮룞 ?뚮┝???쒖꽦?붾릺???덇퀬, 寃곗꽍???꾨땶 寃쎌슦?먮쭔 ?뚮┝ 諛쒖넚
      if (autoNotification && input.status !== 'absent') {
        // ?숈깮 ?뺣낫 議고쉶
        const student = await this.getStudent(tenantId, input.student_id);
        if (student) {
          // ?숇?紐??뺣낫 議고쉶 (二?蹂댄샇???곗꽑)
          const guardians = await this.getGuardians(tenantId, input.student_id);
          const primaryGuardian = guardians.find(g => g.is_primary) || guardians[0];

          if (primaryGuardian?.phone) {
            // ?뚮┝ 硫붿떆吏 ?앹꽦
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

            // [문서 요구사항] KST 기준 날짜 처리
            // [문서 요구사항] KST 기준 날짜 처리
            const occurredAtKST = new Date(input.occurred_at).toLocaleString('ko-KR', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });

            const message = `[학원알림] ${student.name} 학생이 ${attendanceTypeText}했습니다.\n시간: ${occurredAtKST}\n상태: ${statusText}`;

            // ?뚮┝ 諛쒖넚
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

    // 3. analytics.events???대깽??湲곕줉 (臾몄꽌 15-8: attendance.check_in, attendance.check_out)
    try {
      const { analyticsService } = await import('@core/analytics/service');
      const { meteringService } = await import('@core/metering/service');
      
      // ?뚮꼳???뺣낫 議고쉶 (store_id, region_id, industry_type)
      const tenant = await this.supabase
        .from('tenants')
        .select('industry_type')
        .eq('id', tenantId)
        .single();
      
      // 湲곕낯 留ㅼ옣 議고쉶 (Phase 1: ?⑥씪 留ㅼ옣 媛??
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

      // ?대깽?????寃곗젙 (attendance.check_in ?먮뒗 attendance.check_out)
      const eventType = input.attendance_type === 'check_in' 
        ? 'attendance.check_in' 
        : input.attendance_type === 'check_out'
        ? 'attendance.check_out'
        : `attendance.${input.attendance_type}`;

      // analytics.events??湲곕줉 (event_date_kst???쒕퉬???대??먯꽌 ?먮룞 怨꾩궛??
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

      // 4. core-metering ?ъ슜??湲곕줉 (attendance_count)
      await meteringService.recordUsage(tenantId, {
        metric_type: 'attendance_count',
        value: 1,
        recorded_at: input.occurred_at,
      });
    } catch (error) {
      // analytics/metering 湲곕줉 ?ㅽ뙣?대룄 異쒓껐 湲곕줉? ??λ맖
      console.error('Failed to record analytics/metering:', error);
    }

    return attendanceLog;
  }

  /**
   * 異쒓껐 濡쒓렇 議고쉶
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
   * ?숈깮蹂?異쒓껐 濡쒓렇 議고쉶
   */
  async getAttendanceLogsByStudent(
    tenantId: string,
    studentId: string,
    filter?: Omit<AttendanceFilter, 'student_id'>
  ): Promise<AttendanceLog[]> {
    return this.getAttendanceLogs(tenantId, { ...filter, student_id: studentId });
  }

  /**
   * 諛섎퀎 異쒓껐 濡쒓렇 議고쉶
   */
  async getAttendanceLogsByClass(
    tenantId: string,
    classId: string,
    filter?: Omit<AttendanceFilter, 'class_id'>
  ): Promise<AttendanceLog[]> {
    return this.getAttendanceLogs(tenantId, { ...filter, class_id: classId });
  }

  /**
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





