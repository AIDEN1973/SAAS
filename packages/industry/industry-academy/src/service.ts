/**
 * Industry Academy Service
 * 
 * ?™ì› ?…ì¢… ?„ìš© ë¹„ì¦ˆ?ˆìŠ¤ ë¡œì§
 * [ë¶ˆë? ê·œì¹™] Industry Layer??Core Layerë¥?import?????ˆìŒ
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ì¿¼ë¦¬??withTenant()ë¥??¬ìš©?˜ì—¬ tenant_id ?„í„°ë¥?ê°•ì œ?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] INSERT ?œì—??row object ?ˆì— tenant_id ?„ë“œë¥?ì§ì ‘ ?¬í•¨?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] persons ?Œì´ë¸”ì? core-party ëª¨ë“ˆ?ì„œ ê´€ë¦¬ë˜ë©? academy_students???´ë? ?•ì¥?˜ì—¬ ?¬ìš©?©ë‹ˆ??
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
   * ?™ìƒ ëª©ë¡ ì¡°íšŒ (?„í„°ë§?ì§€??
   * [ë¶ˆë? ê·œì¹™] persons + academy_students ì¡°ì¸?˜ì—¬ ì¡°íšŒ
   * [ë¶ˆë? ê·œì¹™] ê¸°ìˆ ë¬¸ì„œ ?•ì±…: "Core Party ?Œì´ë¸?+ ?…ì¢…ë³??•ì¥ ?Œì´ë¸? ?¨í„´ ?¬ìš©
   */
  async getStudents(
    tenantId: string,
    filter?: StudentFilter
  ): Promise<Student[]> {
    // persons?€ academy_studentsë¥?ì¡°ì¸?˜ì—¬ ì¡°íšŒ
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

    // ?´ë¦„ ê²€??    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    // ?•ë ¬: ìµœì‹ ??    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch students: ${error.message}`);
    }

    // ?°ì´??ë³€?? persons + academy_students ??Student
    let students = (data || []).map((person: any) => {
      const academyData = person.academy_students?.[0] || {};
      return {
        id: person.id,
        tenant_id: person.tenant_id,
        industry_type: 'academy', // ê³ ì •ê°?        name: person.name,
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

    // ?íƒœ ?„í„°
    if (filter?.status) {
      const statusArray = Array.isArray(filter.status) ? filter.status : [filter.status];
      students = students.filter((s) => statusArray.includes(s.status));
    }

    // ?™ë…„ ?„í„°
    if (filter?.grade) {
      students = students.filter((s) => s.grade === filter.grade);
    }

    // ?œê·¸ ?„í„° (?´ë¼?´ì–¸??ì¸¡ì—??ì²˜ë¦¬ ?ëŠ” ?œë¸Œì¿¼ë¦¬)
    if (filter?.tag_ids && filter.tag_ids.length > 0) {
      // TODO: ?œê·¸ ?„í„°ë§?ë¡œì§ ì¶”ê?
    }

    // ë°??„í„° (?´ë¼?´ì–¸??ì¸¡ì—??ì²˜ë¦¬ ?ëŠ” ?œë¸Œì¿¼ë¦¬)
    if (filter?.class_id) {
      // TODO: ë°??„í„°ë§?ë¡œì§ ì¶”ê?
    }

    return students;
  }

  /**
   * ?™ìƒ ?ì„¸ ì¡°íšŒ
   * [ë¶ˆë? ê·œì¹™] persons + academy_students ì¡°ì¸?˜ì—¬ ì¡°íšŒ
   * [ë¶ˆë? ê·œì¹™] ê¸°ìˆ ë¬¸ì„œ ?•ì±…: "Core Party ?Œì´ë¸?+ ?…ì¢…ë³??•ì¥ ?Œì´ë¸? ?¨í„´ ?¬ìš©
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

    // ?°ì´??ë³€?? persons + academy_students ??Student
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
   * ?™ìƒ ?ì„±
   * [ë¶ˆë? ê·œì¹™] persons ?Œì´ë¸”ì— ë¨¼ì? ?ì„± ??academy_students ?Œì´ë¸”ì— ?•ì¥ ?•ë³´ ?€??   */
  async createStudent(
    tenantId: string,
    industryType: string,
    input: CreateStudentInput,
    userId?: string
  ): Promise<Student> {
    // 1. persons ?Œì´ë¸”ì— ?ì„± (core-party ?¬ìš©)
    const person = await partyService.createPerson(tenantId, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      person_type: 'student',
    });

    // 2. academy_students ?Œì´ë¸”ì— ?•ì¥ ?•ë³´ ?€??    const { data: academyData, error: academyError } = await this.supabase
      .from('academy_students')
      .insert({
        person_id: person.id,
        tenant_id: tenantId,
        birth_date: input.birth_date,
        gender: input.gender,
        school_name: input.school_name,
        grade: input.grade,
        class_name: undefined, // TODO: class_name ì²˜ë¦¬
        status: input.status || 'active',
        notes: input.notes,
        profile_image_url: input.profile_image_url,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (academyError) {
      // ë¡¤ë°±: persons ?? œ
      await partyService.deletePerson(tenantId, person.id);
      throw new Error(`Failed to create academy student: ${academyError.message}`);
    }

    // 3. ?™ë?ëª??•ë³´ ?ì„±
    if (input.guardians && input.guardians.length > 0) {
      await this.createGuardians(tenantId, person.id, input.guardians);
    }

    // 5. ?œê·¸ ?°ê²° (core-tags ?œìš©)
    if (input.tag_ids && input.tag_ids.length > 0) {
      await tagsService.assignTags(tenantId, person.id, 'student', input.tag_ids);
    }

    // 5. ê²°ê³¼ ë°˜í™˜ (persons + academy_students ì¡°í•©)
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
   * ?™ìƒ ?¼ê´„ ?±ë¡ (?‘ì?)
   * [?”êµ¬?¬í•­] ?™ìƒ ?¼ê´„ ?±ë¡(?‘ì?)
   * 
   * @param tenantId - ?Œë„Œ??ID
   * @param industryType - ?…ì¢… ?€??   * @param students - ?™ìƒ ?°ì´??ë°°ì—´
   * @param userId - ?ì„±??ID
   * @returns ?ì„±???™ìƒ ëª©ë¡
   */
  async bulkCreateStudents(
    tenantId: string,
    industryType: string,
    students: CreateStudentInput[],
    userId?: string
  ): Promise<Student[]> {
    const results: Student[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    // ?œì°¨?ìœ¼ë¡??ì„± (?¸ëœ??…˜?€ PostgreSQL ?ˆë²¨?ì„œ ì²˜ë¦¬)
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
      // ?¼ë? ?¤íŒ¨??ê²½ìš° ê²½ê³ ?€ ?¨ê»˜ ?±ê³µ??ê²°ê³¼ ë°˜í™˜
      console.warn('?¼ë? ?™ìƒ ?±ë¡ ?¤íŒ¨:', errors);
    }

    return results;
  }

  /**
   * ?™ìƒ ?˜ì •
   * [ë¶ˆë? ê·œì¹™] persons?€ academy_studentsë¥?ê°ê° ?…ë°?´íŠ¸
   */
  async updateStudent(
    tenantId: string,
    studentId: string,
    input: UpdateStudentInput,
    userId?: string
  ): Promise<Student> {
    // 1. persons ?Œì´ë¸??…ë°?´íŠ¸ (ê³µí†µ ?„ë“œ)
    const personUpdate: any = {};
    if (input.name !== undefined) personUpdate.name = input.name;
    if (input.email !== undefined) personUpdate.email = input.email;
    if (input.phone !== undefined) personUpdate.phone = input.phone;
    if (input.address !== undefined) personUpdate.address = input.address;

    if (Object.keys(personUpdate).length > 0) {
      await partyService.updatePerson(tenantId, studentId, personUpdate);
    }

    // 2. academy_students ?Œì´ë¸??…ë°?´íŠ¸ (?…ì¢… ?¹í™” ?„ë“œ)
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

    // 3. ?…ë°?´íŠ¸???°ì´??ì¡°íšŒ?˜ì—¬ ë°˜í™˜
    const updated = await this.getStudent(tenantId, studentId);
    if (!updated) {
      throw new Error(`Student not found: ${studentId}`);
    }
    return updated;
  }

  /**
   * ?™ìƒ ?? œ (Soft delete: statusë¥?'withdrawn'?¼ë¡œ ë³€ê²?
   */
  async deleteStudent(
    tenantId: string,
    studentId: string,
    userId?: string
  ): Promise<void> {
    // Soft delete: statusë¥?'withdrawn'?¼ë¡œ ë³€ê²?    await this.updateStudent(tenantId, studentId, { status: 'withdrawn' }, userId);
  }

  /**
   * ?™ë?ëª?ëª©ë¡ ì¡°íšŒ
   * [ë¶ˆë? ê·œì¹™] student_id??person_idë¥?ì°¸ì¡° (persons.id)
   */
  async getGuardians(tenantId: string, studentId: string): Promise<Guardian[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('guardians')
        .select('*')
        .eq('student_id', studentId)  // student_id??person_idë¥?ì°¸ì¡°
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
   * ?™ë?ëª??ì„±
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
   * ?™ìƒ ?œê·¸ ëª©ë¡ ì¡°íšŒ (core-tags ?œìš©)
   */
  async getTags(tenantId: string): Promise<Tag[]> {
    return tagsService.getTags(tenantId, { entity_type: 'student' });
  }

  /**
   * ?™ìƒ???œê·¸ ì¡°íšŒ (core-tags ?œìš©)
   */
  async getStudentTags(tenantId: string, studentId: string): Promise<Tag[]> {
    return tagsService.getEntityTags(tenantId, studentId, 'student');
  }

  /**
   * ?ë‹´?¼ì? ëª©ë¡ ì¡°íšŒ
   * [ë¶ˆë? ê·œì¹™] student_id??person_idë¥?ì°¸ì¡° (persons.id)
   */
  async getConsultations(
    tenantId: string,
    studentId: string
  ): Promise<StudentConsultation[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('student_consultations')
        .select('*')
        .eq('student_id', studentId)  // student_id??person_idë¥?ì°¸ì¡°
        .order('consultation_date', { ascending: false }),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch consultations: ${error.message}`);
    }

    return (data || []) as StudentConsultation[];
  }

  /**
   * ?ë‹´?¼ì? ?ì„±
   * [ë¶ˆë? ê·œì¹™] student_id??person_idë¥?ì°¸ì¡° (persons.id)
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
        student_id: studentId,  // student_id??person_idë¥?ì°¸ì¡°
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
   * ?ë‹´?¼ì? ?˜ì •
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
   * ?ë‹´?¼ì? ?? œ
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
   * ?ë‹´?¼ì? AI ?”ì•½ ?ì„±
   * 
   * [ë¶ˆë? ê·œì¹™] Phase 1?ì„œ???Œë ˆ?´ìŠ¤?€?”ë¡œ êµ¬í˜„
   * ?¤ì œ AI ?°ë™?€ Edge Function ?ëŠ” ?¸ë? AI ?œë¹„?¤ë? ?µí•´ êµ¬í˜„
   * 
   * TODO: ?¤ì œ AI ?œë¹„???°ë™ (OpenAI, Claude ??
   */
  async generateConsultationAISummary(
    tenantId: string,
    consultationId: string
  ): Promise<string> {
    // 1. ?ë‹´?¼ì? ì¡°íšŒ
    const consultation = await this.getConsultation(tenantId, consultationId);
    if (!consultation) {
      throw new Error('?ë‹´?¼ì?ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.');
    }

    // 2. AI ?”ì•½ ?ì„± (Phase 1: ?Œë ˆ?´ìŠ¤?€??
    // TODO: ?¤ì œ AI ?œë¹„???°ë™
    // - Edge Function ?¸ì¶œ: fns-ai-summarize-consultation
    // - ?ëŠ” ?¸ë? AI API ì§ì ‘ ?¸ì¶œ
    const aiSummary = `[AI ?”ì•½] ${consultation.content.substring(0, 100)}... (?”ì•½ ê¸°ëŠ¥?€ ê³??œê³µ???ˆì •?…ë‹ˆ??)`;

    // 3. ?ë‹´?¼ì???AI ?”ì•½ ?€??    await this.updateConsultation(
      tenantId,
      consultationId,
      { ai_summary: aiSummary }
    );

    return aiSummary;
  }

  /**
   * ?ë‹´?¼ì? ?¨ê±´ ì¡°íšŒ (?´ë???
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
   * ?™ë?ëª??˜ì •
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
   * ?™ë?ëª??? œ
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
   * ?™ìƒ ?œê·¸ ?…ë°?´íŠ¸ (ê¸°ì¡´ ?œê·¸ ?œê±° ?????œê·¸ ? ë‹¹)
   */
  async updateStudentTags(
    tenantId: string,
    studentId: string,
    tagIds: string[]
  ): Promise<void> {
    // ê¸°ì¡´ ?œê·¸ ? ë‹¹ ?œê±°
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

    // ???œê·¸ ? ë‹¹
    if (tagIds.length > 0) {
      await tagsService.assignTags(tenantId, studentId, 'student', tagIds);
    }
  }

  // ==================== ë°?Class) ê´€ë¦?====================

  /**
   * ë°?ëª©ë¡ ì¡°íšŒ (?„í„°ë§?ì§€??
   * [ë¶ˆë? ê·œì¹™] withTenant() ?¬ìš©?˜ì—¬ tenant_id ?„í„° ê°•ì œ
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

    // ?íƒœ ?„í„°
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }

    // ?”ì¼ ?„í„°
    if (filter?.day_of_week) {
      query = query.eq('day_of_week', filter.day_of_week);
    }

    // ê³¼ëª© ?„í„°
    if (filter?.subject) {
      query = query.eq('subject', filter.subject);
    }

    // ?™ë…„ ?„í„°
    if (filter?.grade) {
      query = query.eq('grade', filter.grade);
    }

    // ?´ë¦„ ê²€??    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    // ?•ë ¬: ?”ì¼, ?œì‘ ?œê°„ ??    query = query.order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch classes: ${error.message}`);
    }

    return (data || []) as Class[];
  }

  /**
   * ë°??ì„¸ ì¡°íšŒ
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
   * ë°??ì„±
   * [ë¶ˆë? ê·œì¹™] INSERT ??tenant_id ì§ì ‘ ?¬í•¨
   * [ë¶ˆë? ê·œì¹™] ë°??ë™ ?‰ìƒ ?œê¹… (ì§€?•í•˜ì§€ ?Šìœ¼ë©??ë™ ?ì„±)
   */
  async createClass(
    tenantId: string,
    input: CreateClassInput
  ): Promise<Class> {
    // ?‰ìƒ ?ë™ ?ì„± (ì§€?•í•˜ì§€ ?Šì? ê²½ìš°)
    const color = input.color || this.generateClassColor();

    // ë°??ì„±
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

    // ê°•ì‚¬ ë°°ì •
    if (input.teacher_ids && input.teacher_ids.length > 0) {
      for (const teacherId of input.teacher_ids) {
        await this.assignTeacher(tenantId, {
          class_id: newClass.id,
          teacher_id: teacherId,
          role: 'teacher', // ê¸°ë³¸ê°? ?´ì„
        });
      }
    }

    return newClass;
  }

  /**
   * ë°??˜ì •
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
   * ë°??? œ (?Œí”„???? œ: statusë¥?'archived'ë¡?ë³€ê²?
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
   * ë°??ë™ ?‰ìƒ ?ì„±
   * [ë¶ˆë? ê·œì¹™] ë°??ë™ ?‰ìƒ ?œê¹…
   */
  private generateClassColor(): string {
    // ê¸°ë³¸ ?‰ìƒ ?”ë ˆ??(16ì§„ìˆ˜ ?‰ìƒ ì½”ë“œ)
    const colors = [
      '#3b82f6', // ?Œë???      '#ef4444', // ë¹¨ê°„??      '#10b981', // ì´ˆë¡??      '#f59e0b', // ì£¼í™©??      '#8b5cf6', // ë³´ë¼??      '#ec4899', // ë¶„í™??      '#06b6d4', // ì²?¡??      '#f97316', // ì£¼í™©??      '#84cc16', // ?°ë‘??      '#6366f1', // ?¨ìƒ‰
    ];

    // ?œë¤ ?‰ìƒ ë°˜í™˜ (?¤ì œë¡œëŠ” ê¸°ì¡´ ë°??‰ìƒê³?ì¤‘ë³µ?˜ì? ?Šë„ë¡?ê°œì„  ê°€??
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * ë°˜ë³„ ì¶œê²°ë¥??•ì›ë¥?ì§€ê°ë¥  ì¡°íšŒ
   * [?”êµ¬?¬í•­] ë°˜ë³„ ì¶œê²°ë¥??•ì›ë¥?ì§€ê°ë¥  ?œì‹œ
   * TODO: ì¶œê²° ?°ì´?°ê? êµ¬í˜„?˜ë©´ ?¤ì œ ?µê³„ ê³„ì‚°
   */
  async getClassStatistics(
    tenantId: string,
    classId: string
  ): Promise<{
    attendance_rate: number;  // ì¶œê²°ë¥?(%)
    capacity_rate: number;    // ?•ì›ë¥?(%)
    late_rate: number;        // ì§€ê°ë¥  (%)
  }> {
    // ?„ì¬??ê¸°ë³¸ê°?ë°˜í™˜ (ì¶œê²° ?°ì´??êµ¬í˜„ ???¤ì œ ê³„ì‚°)
    const classData = await this.getClass(tenantId, classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    return {
      attendance_rate: 0,  // TODO: ì¶œê²° ?°ì´??ê¸°ë°˜ ê³„ì‚°
      capacity_rate: (classData.current_count / classData.capacity) * 100,
      late_rate: 0,  // TODO: ì¶œê²° ?°ì´??ê¸°ë°˜ ê³„ì‚°
    };
  }

  // ==================== ê°•ì‚¬(Teacher) ê´€ë¦?====================

  /**
   * ê°•ì‚¬ ëª©ë¡ ì¡°íšŒ (?„í„°ë§?ì§€??
   * [ë¶ˆë? ê·œì¹™] persons + academy_teachers ì¡°ì¸?˜ì—¬ ì¡°íšŒ
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

    // ?íƒœ ?„í„°
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        // academy_teachers.status ?„í„°ë§ì? ì¡°ì¸ ??ì²˜ë¦¬ ?„ìš”
        // ?„ì¬??ê°„ë‹¨??êµ¬í˜„
      } else {
        // ì¡°ì¸ ???„í„°ë§ì? ë³µì¡?˜ë?ë¡? ?¼ë‹¨ ?„ì²´ ì¡°íšŒ ???„í„°ë§?      }
    }

    // ?´ë¦„ ê²€??    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    // ?•ë ¬: ìµœì‹ ??    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch teachers: ${error.message}`);
    }

    // ?°ì´??ë³€?? persons + academy_teachers ??Teacher
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
   * ê°•ì‚¬ ?ì„¸ ì¡°íšŒ
   */
  async getTeacher(tenantId: string, teacherId: string): Promise<Teacher | null> {
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
   * ê°•ì‚¬ ?ì„±
   * [ë¶ˆë? ê·œì¹™] persons ?Œì´ë¸”ì— ë¨¼ì? ?ì„± ??academy_teachers ?Œì´ë¸”ì— ?•ì¥ ?•ë³´ ?€??   */
  async createTeacher(
    tenantId: string,
    input: CreateTeacherInput
  ): Promise<Teacher> {
    // 1. persons ?Œì´ë¸”ì— ?ì„±
    const person = await partyService.createPerson(tenantId, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      person_type: 'teacher',
    });

    // 2. academy_teachers ?Œì´ë¸”ì— ?•ì¥ ?•ë³´ ?€??    const { data, error } = await this.supabase
      .from('academy_teachers')
      .insert({
        person_id: person.id,
        tenant_id: tenantId,
        employee_id: input.employee_id,
        specialization: input.specialization,
        hire_date: input.hire_date,
        status: input.status || 'active',
        profile_image_url: input.profile_image_url,
        bio: input.bio,
        notes: input.notes,
      })
      .select()
      .single();

    if (error) {
      // ë¡¤ë°±: persons ?? œ
      // [ë¶ˆë? ê·œì¹™] DELETE ì¿¼ë¦¬??ë°˜ë“œ??withTenant()ë¥??¬ìš©?´ì•¼ ??      await withTenant(
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
   * ê°•ì‚¬ ?˜ì •
   */
  async updateTeacher(
    tenantId: string,
    teacherId: string,
    input: UpdateTeacherInput
  ): Promise<Teacher> {
    // 1. persons ?Œì´ë¸??…ë°?´íŠ¸
    const personUpdate: any = {};
    if (input.name !== undefined) personUpdate.name = input.name;
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

    // 2. academy_teachers ?Œì´ë¸??…ë°?´íŠ¸
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

    // 3. ?…ë°?´íŠ¸???°ì´??ì¡°íšŒ?˜ì—¬ ë°˜í™˜
    return await this.getTeacher(tenantId, teacherId) as Teacher;
  }

  /**
   * ê°•ì‚¬ ?? œ (?Œí”„???? œ: statusë¥?'resigned'ë¡?ë³€ê²?
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

  // ==================== ë°?ê°•ì‚¬ ?°ê²° ê´€ë¦?====================

  /**
   * ê°•ì‚¬ ë°°ì •
   * [?”êµ¬?¬í•­] ê°•ì‚¬ ë°°ì •/ë¶€?´ì„ ?¤ì •
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
   * ê°•ì‚¬ ë°°ì • ?´ì œ
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
   * ë°˜ë³„ ê°•ì‚¬ ëª©ë¡ ì¡°íšŒ
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

  // ==================== ?™ìƒ ë°?ë°°ì • ê´€ë¦?====================

  /**
   * ?™ìƒ ë°?ë°°ì •
   * [ë¶ˆë? ê·œì¹™] student_classes INSERT + academy_classes.current_count ?…ë°?´íŠ¸
   * [ë¶ˆë? ê·œì¹™] INSERT ??tenant_id ì§ì ‘ ?¬í•¨
   */
  async enrollStudentToClass(
    tenantId: string,
    studentId: string,
    classId: string,
    enrolledAt?: string
  ): Promise<StudentClass> {
    // 1. student_classes??ë°°ì •
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

    // 2. academy_classes.current_count ?…ë°?´íŠ¸
    // ?„ì¬ ?œì„± ?™ìƒ ??ê³„ì‚°
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

    // current_count ?…ë°?´íŠ¸
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
   * ?™ìƒ ë°??´ì œ
   * [ë¶ˆë? ê·œì¹™] student_classes UPDATE + academy_classes.current_count ?…ë°?´íŠ¸
   */
  async unenrollStudentFromClass(
    tenantId: string,
    studentId: string,
    classId: string,
    leftAt?: string
  ): Promise<void> {
    // 1. student_classes?ì„œ ?´ì œ
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

    // 2. academy_classes.current_count ?…ë°?´íŠ¸
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
   * ?™ìƒ??ë°?ëª©ë¡ ì¡°íšŒ
   * [ë¶ˆë? ê·œì¹™] student_classes + academy_classes ì¡°ì¸?˜ì—¬ ì¡°íšŒ
   */
  async getStudentClasses(
    tenantId: string,
    studentId: string
  ): Promise<Array<StudentClass & { class: Class | null }>> {
    // 1. student_classes ì¡°íšŒ
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

    // 2. class_id ë°°ì—´ ì¶”ì¶œ
    const classIds = studentClasses.map((sc) => sc.class_id);

    // 3. academy_classes ì¡°íšŒ
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

    // 4. class_idë¡?ë§??ì„±
    const classMap = new Map((classes || []).map((c) => [c.id, c as Class]));

    // 5. ì¡°í•©?˜ì—¬ ë°˜í™˜
    return studentClasses.map((sc) => ({
      ...sc,
      class: classMap.get(sc.class_id) || null,
    })) as Array<StudentClass & { class: Class | null }>;
  }

  // ==================== ì¶œê²° ê´€ë¦?====================

  /**
   * ì¶œê²° ë¡œê·¸ ?ì„±
   * [ë¶ˆë? ê·œì¹™] INSERT ??tenant_id ì§ì ‘ ?¬í•¨
   */
  async createAttendanceLog(
    tenantId: string,
    input: CreateAttendanceLogInput,
    userId?: string
  ): Promise<AttendanceLog> {
    // [ë¬¸ì„œ ?”êµ¬?¬í•­] ì¶œê²° Hook ?ë¦„: ì¶œì„ ì²´í¬ ??ì¶œê²° ?´ë²¤??ë°œìƒ ??core-notification ???™ë?ëª??Œë¦¼ ??core-metering ???¬ìš©??ê¸°ë¡ ??core-billing ???”ë§ ?ë™ì²?µ¬
    
    // 1. ì¶œê²° ë¡œê·¸ ?ì„±
    const { data, error } = await this.supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenantId,  // [ë¶ˆë? ê·œì¹™] INSERT ??tenant_id ì§ì ‘ ?¬í•¨
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

    // 2. core-notification ???™ë?ëª??Œë¦¼ (ë¬¸ì„œ ?”êµ¬?¬í•­: ì¶œê²° Hook ?ë¦„)
    try {
      const config = await configService.getConfig(tenantId);
      const autoNotification = config?.attendance?.auto_notification ?? false;
      const notificationChannel = config?.attendance?.notification_channel ?? 'sms';

      // ?ë™ ?Œë¦¼???œì„±?”ë˜???ˆê³ , ê²°ì„???„ë‹Œ ê²½ìš°?ë§Œ ?Œë¦¼ ë°œì†¡
      if (autoNotification && input.status !== 'absent') {
        // ?™ìƒ ?•ë³´ ì¡°íšŒ
        const student = await this.getStudent(tenantId, input.student_id);
        if (student) {
          // ?™ë?ëª??•ë³´ ì¡°íšŒ (ì£?ë³´í˜¸???°ì„ )
          const guardians = await this.getGuardians(tenantId, input.student_id);
          const primaryGuardian = guardians.find(g => g.is_primary) || guardians[0];

          if (primaryGuardian?.phone) {
            // ?Œë¦¼ ë©”ì‹œì§€ ?ì„±
            const attendanceTypeText = input.attendance_type === 'check_in' ? '?±ì›' 
              : input.attendance_type === 'check_out' ? '?˜ì›'
              : input.attendance_type === 'late' ? 'ì§€ê°?
              : 'ì¶œê²°';
            
            // ?€???¨ì–¸: if ì¡°ê±´?ì„œ 'absent'ê°€ ?œì™¸?˜ì—ˆì§€ë§? switch?ì„œ??ëª¨ë“  ì¼€?´ìŠ¤ë¥?ì²˜ë¦¬?´ì•¼ ??            const status = input.status as AttendanceStatus;
            let statusText: string;
            switch (status) {
              case 'present':
                statusText = 'ì¶œì„';
                break;
              case 'late':
                statusText = 'ì§€ê°?;
                break;
              case 'absent':
                statusText = 'ê²°ì„';
                break;
              case 'excused':
                statusText = '?¬ìœ ';
                break;
              default:
                statusText = 'ë¯¸ì •';
            }

            // [ë¬¸ì„œ ?”êµ¬?¬í•­] KST ê¸°ì? ? ì§œ ì²˜ë¦¬
            const occurredAtKST = new Date(input.occurred_at).toLocaleString('ko-KR', {
              timeZone: 'Asia/Seoul',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });

            const message = `[?”ì–´?? ${student.name} ?™ìƒ??${attendanceTypeText}?ˆìŠµ?ˆë‹¤.\n?œê°„: ${occurredAtKST}\n?íƒœ: ${statusText}`;

            // ?Œë¦¼ ë°œì†¡
            await notificationService.createNotification(tenantId, {
              channel: notificationChannel === 'kakao' ? 'kakao' : 'sms',
              recipient: primaryGuardian.phone,
              content: message,
            });
          }
        }
      }
    } catch (error) {
      // ?Œë¦¼ ë°œì†¡ ?¤íŒ¨?´ë„ ì¶œê²° ê¸°ë¡?€ ?€?¥ë¨
      console.error('Failed to send notification:', error);
    }

    // 3. analytics.events???´ë²¤??ê¸°ë¡ (ë¬¸ì„œ 15-8: attendance.check_in, attendance.check_out)
    try {
      const { analyticsService } = await import('@core/analytics/service');
      const { meteringService } = await import('@core/metering/service');
      
      // ?Œë„Œ???•ë³´ ì¡°íšŒ (store_id, region_id, industry_type)
      const tenant = await this.supabase
        .from('tenants')
        .select('industry_type')
        .eq('id', tenantId)
        .single();
      
      // ê¸°ë³¸ ë§¤ì¥ ì¡°íšŒ (Phase 1: ?¨ì¼ ë§¤ì¥ ê°€??
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

      // ?´ë²¤???€??ê²°ì • (attendance.check_in ?ëŠ” attendance.check_out)
      const eventType = input.attendance_type === 'check_in' 
        ? 'attendance.check_in' 
        : input.attendance_type === 'check_out'
        ? 'attendance.check_out'
        : `attendance.${input.attendance_type}`;

      // analytics.events??ê¸°ë¡ (event_date_kst???œë¹„???´ë??ì„œ ?ë™ ê³„ì‚°??
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

      // 4. core-metering ?¬ìš©??ê¸°ë¡ (attendance_count)
      await meteringService.recordUsage(tenantId, {
        metric_type: 'attendance_count',
        value: 1,
        recorded_at: input.occurred_at,
      });
    } catch (error) {
      // analytics/metering ê¸°ë¡ ?¤íŒ¨?´ë„ ì¶œê²° ê¸°ë¡?€ ?€?¥ë¨
      console.error('Failed to record analytics/metering:', error);
    }

    return attendanceLog;
  }

  /**
   * ì¶œê²° ë¡œê·¸ ì¡°íšŒ
   * [ë¶ˆë? ê·œì¹™] SELECT ??withTenant ?¬ìš©
   */
  async getAttendanceLogs(
    tenantId: string,
    filter?: AttendanceFilter
  ): Promise<AttendanceLog[]> {
    let query = this.supabase
      .from('attendance_logs')
      .select('*')
      .order('occurred_at', { ascending: false });

    // ?„í„° ?ìš©
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
   * ?™ìƒë³?ì¶œê²° ë¡œê·¸ ì¡°íšŒ
   */
  async getAttendanceLogsByStudent(
    tenantId: string,
    studentId: string,
    filter?: Omit<AttendanceFilter, 'student_id'>
  ): Promise<AttendanceLog[]> {
    return this.getAttendanceLogs(tenantId, { ...filter, student_id: studentId });
  }

  /**
   * ë°˜ë³„ ì¶œê²° ë¡œê·¸ ì¡°íšŒ
   */
  async getAttendanceLogsByClass(
    tenantId: string,
    classId: string,
    filter?: Omit<AttendanceFilter, 'class_id'>
  ): Promise<AttendanceLog[]> {
    return this.getAttendanceLogs(tenantId, { ...filter, class_id: classId });
  }

  /**
   * ì¶œê²° ë¡œê·¸ ?? œ
   * [ë¶ˆë? ê·œì¹™] DELETE ??withTenant ?¬ìš©
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

