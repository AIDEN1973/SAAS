/**
 * Student Service
 * 
 * [ë¶ˆë? ê·œì¹™] Service Layer??Industry Layerë¥??¬ìš©?˜ì—¬ ?…ì¢…ë³?ë¹„ì¦ˆ?ˆìŠ¤ ë¡œì§???¸ì¶œ?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] Service Layer??Core Layerë¥?ì§ì ‘ ?¬ìš©?˜ì? ?Šê³ , Industry Layerë¥??µí•´ ?‘ê·¼?œë‹¤.
 */

import { academyService } from '@industry/academy/service';
import type {
  Student,
  Guardian,
  StudentConsultation,
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
} from '@industry/academy/types';
import type { Tag } from '@core/tags';

/**
 * Student Service (Industry Layer ?˜í¼)
 * 
 * Service Layer??Industry Layer??academyServiceë¥??˜í•‘?˜ì—¬ ?œê³µ?©ë‹ˆ??
 * ?¥í›„ ?¤ë¥¸ ?…ì¢…(ì²´ìœ¡ê´€ ????ì¶”ê??˜ë©´ industry-gym??gymServiceë¥??¬ìš©?˜ëŠ” ë³„ë„ Serviceë¥??ì„±?©ë‹ˆ??
 */
export class StudentService {

  /**
   * ?™ìƒ ëª©ë¡ ì¡°íšŒ (?„í„°ë§?ì§€??
   */
  async getStudents(
    tenantId: string,
    filter?: StudentFilter
  ): Promise<Student[]> {
    return academyService.getStudents(tenantId, filter);
  }

  /**
   * ?™ìƒ ?ì„¸ ì¡°íšŒ
   */
  async getStudent(tenantId: string, studentId: string): Promise<Student | null> {
    return academyService.getStudent(tenantId, studentId);
  }

  /**
   * ?™ìƒ ?ì„±
   */
  async createStudent(
    tenantId: string,
    industryType: string,
    input: CreateStudentInput,
    userId?: string
  ): Promise<Student> {
    return academyService.createStudent(tenantId, industryType, input, userId);
  }

  /**
   * ?™ìƒ ?˜ì •
   */
  async updateStudent(
    tenantId: string,
    studentId: string,
    input: UpdateStudentInput,
    userId?: string
  ): Promise<Student> {
    return academyService.updateStudent(tenantId, studentId, input, userId);
  }

  /**
   * ?™ìƒ ?? œ (Soft delete: statusë¥?'withdrawn'?¼ë¡œ ë³€ê²?
   */
  async deleteStudent(
    tenantId: string,
    studentId: string,
    userId?: string
  ): Promise<void> {
    return academyService.deleteStudent(tenantId, studentId, userId);
  }

  /**
   * ?™ë?ëª?ëª©ë¡ ì¡°íšŒ
   */
  async getGuardians(tenantId: string, studentId: string): Promise<Guardian[]> {
    return academyService.getGuardians(tenantId, studentId);
  }

  /**
   * ?™ë?ëª??ì„±
   */
  async createGuardians(
    tenantId: string,
    studentId: string,
    guardians: Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>[]
  ): Promise<Guardian[]> {
    return academyService.createGuardians(tenantId, studentId, guardians);
  }

  /**
   * ?™ìƒ ?œê·¸ ëª©ë¡ ì¡°íšŒ (core-tags ?œìš©)
   */
  async getTags(tenantId: string): Promise<Tag[]> {
    return academyService.getTags(tenantId);
  }

  /**
   * ?™ìƒ???œê·¸ ì¡°íšŒ (core-tags ?œìš©)
   */
  async getStudentTags(tenantId: string, studentId: string): Promise<Tag[]> {
    return academyService.getStudentTags(tenantId, studentId);
  }

  /**
   * ?ë‹´?¼ì? ëª©ë¡ ì¡°íšŒ
   */
  async getConsultations(
    tenantId: string,
    studentId: string
  ): Promise<StudentConsultation[]> {
    return academyService.getConsultations(tenantId, studentId);
  }

  /**
   * ?ë‹´?¼ì? ?ì„±
   */
  async createConsultation(
    tenantId: string,
    studentId: string,
    consultation: Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>,
    userId: string
  ): Promise<StudentConsultation> {
    return academyService.createConsultation(tenantId, studentId, consultation, userId);
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
    return academyService.updateConsultation(tenantId, consultationId, consultation, userId);
  }

  /**
   * ?ë‹´?¼ì? ?? œ
   */
  async deleteConsultation(
    tenantId: string,
    consultationId: string
  ): Promise<void> {
    return academyService.deleteConsultation(tenantId, consultationId);
  }

  /**
   * ?™ë?ëª??˜ì •
   */
  async updateGuardian(
    tenantId: string,
    guardianId: string,
    guardian: Partial<Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>>
  ): Promise<Guardian> {
    return academyService.updateGuardian(tenantId, guardianId, guardian);
  }

  /**
   * ?™ë?ëª??? œ
   */
  async deleteGuardian(
    tenantId: string,
    guardianId: string
  ): Promise<void> {
    return academyService.deleteGuardian(tenantId, guardianId);
  }

  /**
   * ?™ìƒ ?œê·¸ ?…ë°?´íŠ¸
   */
  async updateStudentTags(
    tenantId: string,
    studentId: string,
    tagIds: string[]
  ): Promise<void> {
    return academyService.updateStudentTags(tenantId, studentId, tagIds);
  }

  /**
   * ?™ìƒ ë°?ë°°ì •
   */
  async enrollStudentToClass(
    tenantId: string,
    studentId: string,
    classId: string,
    enrolledAt?: string
  ) {
    return academyService.enrollStudentToClass(tenantId, studentId, classId, enrolledAt);
  }

  /**
   * ?™ìƒ ë°??´ì œ
   */
  async unenrollStudentFromClass(
    tenantId: string,
    studentId: string,
    classId: string,
    leftAt?: string
  ): Promise<void> {
    return academyService.unenrollStudentFromClass(tenantId, studentId, classId, leftAt);
  }

  /**
   * ?™ìƒ??ë°?ëª©ë¡ ì¡°íšŒ
   */
  async getStudentClasses(tenantId: string, studentId: string) {
    return academyService.getStudentClasses(tenantId, studentId);
  }

  /**
   * ?ë‹´?¼ì? AI ?”ì•½ ?ì„±
   */
  async generateConsultationAISummary(
    tenantId: string,
    consultationId: string
  ): Promise<string> {
    return academyService.generateConsultationAISummary(tenantId, consultationId);
  }

  /**
   * ?™ìƒ ?¼ê´„ ?±ë¡ (?‘ì?)
   * [?”êµ¬?¬í•­] ?™ìƒ ?¼ê´„ ?±ë¡(?‘ì?)
   */
  async bulkCreateStudents(
    tenantId: string,
    industryType: string,
    students: CreateStudentInput[],
    userId?: string
  ): Promise<Student[]> {
    return academyService.bulkCreateStudents(tenantId, industryType, students, userId);
  }
}

/**
 * Default Service Instance
 */
export const studentService = new StudentService();

