/**
 * Student Service
 * 
 * [불변 규칙] Service Layer는 Industry Layer를 사용하여 업종별 비즈니스 로직을 호출한다.
 * [불변 규칙] Service Layer는 Core Layer를 직접 사용하지 않고, Industry Layer를 통해 접근한다.
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
 * Student Service (Industry Layer 래퍼)
 * 
 * Service Layer는 Industry Layer의 academyService를 래핑하여 제공합니다.
 * 향후 다른 업종(체육관 등)이 추가되면 industry-gym의 gymService를 사용하는 별도 Service를 생성합니다.
 */
export class StudentService {

  /**
   * 학생 목록 조회 (필터링 지원)
   */
  async getStudents(
    tenantId: string,
    filter?: StudentFilter
  ): Promise<Student[]> {
    return academyService.getStudents(tenantId, filter);
  }

  /**
   * 학생 상세 조회
   */
  async getStudent(tenantId: string, studentId: string): Promise<Student | null> {
    return academyService.getStudent(tenantId, studentId);
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
    return academyService.createStudent(tenantId, industryType, input, userId);
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
    return academyService.updateStudent(tenantId, studentId, input, userId);
  }

  /**
   * 학생 삭제 (Soft delete: status를 'withdrawn'으로 변경)
   */
  async deleteStudent(
    tenantId: string,
    studentId: string,
    userId?: string
  ): Promise<void> {
    return academyService.deleteStudent(tenantId, studentId, userId);
  }

  /**
   * 학부모 목록 조회
   */
  async getGuardians(tenantId: string, studentId: string): Promise<Guardian[]> {
    return academyService.getGuardians(tenantId, studentId);
  }

  /**
   * 학부모 생성
   */
  async createGuardians(
    tenantId: string,
    studentId: string,
    guardians: Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>[]
  ): Promise<Guardian[]> {
    return academyService.createGuardians(tenantId, studentId, guardians);
  }

  /**
   * 학생 태그 목록 조회 (core-tags 활용)
   */
  async getTags(tenantId: string): Promise<Tag[]> {
    return academyService.getTags(tenantId);
  }

  /**
   * 학생의 태그 조회 (core-tags 활용)
   */
  async getStudentTags(tenantId: string, studentId: string): Promise<Tag[]> {
    return academyService.getStudentTags(tenantId, studentId);
  }

  /**
   * 상담일지 목록 조회
   */
  async getConsultations(
    tenantId: string,
    studentId: string
  ): Promise<StudentConsultation[]> {
    return academyService.getConsultations(tenantId, studentId);
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
    return academyService.createConsultation(tenantId, studentId, consultation, userId);
  }

  /**
   * 상담일지 수정
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
   * 상담일지 삭제
   */
  async deleteConsultation(
    tenantId: string,
    consultationId: string
  ): Promise<void> {
    return academyService.deleteConsultation(tenantId, consultationId);
  }

  /**
   * 학부모 수정
   */
  async updateGuardian(
    tenantId: string,
    guardianId: string,
    guardian: Partial<Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>>
  ): Promise<Guardian> {
    return academyService.updateGuardian(tenantId, guardianId, guardian);
  }

  /**
   * 학부모 삭제
   */
  async deleteGuardian(
    tenantId: string,
    guardianId: string
  ): Promise<void> {
    return academyService.deleteGuardian(tenantId, guardianId);
  }

  /**
   * 학생 태그 업데이트
   */
  async updateStudentTags(
    tenantId: string,
    studentId: string,
    tagIds: string[]
  ): Promise<void> {
    return academyService.updateStudentTags(tenantId, studentId, tagIds);
  }

  /**
   * 학생 반 배정
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
   * 학생 반 해제
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
   * 학생의 반 목록 조회
   */
  async getStudentClasses(tenantId: string, studentId: string) {
    return academyService.getStudentClasses(tenantId, studentId);
  }

  /**
   * 상담일지 AI 요약 생성
   */
  async generateConsultationAISummary(
    tenantId: string,
    consultationId: string
  ): Promise<string> {
    return academyService.generateConsultationAISummary(tenantId, consultationId);
  }

  /**
   * 학생 일괄 등록 (엑셀)
   * [요구사항] 학생 일괄 등록(엑셀)
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

