/**
 * Student Service
 *
 * [불변 규칙] Service Layer는 Industry Layer를 사용하여 업종별 비즈니스 로직을 호출합니다.
 * [불변 규칙] Service Layer는 Core Layer를 직접 사용하지 않고, Industry Layer를 통해 접근합니다.
 */

import { academyService } from '@industry/academy/service';
import type {
  Student,
  Guardian,
  StudentConsultation,
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
  StudentClass,
} from '@industry/academy/types';
import type { Tag } from '@core/tags';

/**
 * Student Service (Industry Layer 래퍼)
 *
 * Service Layer는 Industry Layer의 academyService를 매핑하여 제공합니다.
 * 향후 다른 업종(체육관 등)을 추가하면 industry-gym의 gymService를 사용하는 별도 Service를 생성합니다.
 */
export class StudentService {

  /**
   * 학생 목록 조회 (필터링/페이징)
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
   * 학생 태그 목록 조회 (core-tags 사용)
   */
  async getTags(tenantId: string): Promise<Tag[]> {
    return academyService.getTags(tenantId);
  }

  // ==================== 추가 래퍼 메서드 ====================

  /**
   * 학생 목록 페이지네이션 조회
   */
  async getStudentsPaged(
    tenantId: string,
    filter?: StudentFilter,
    page?: number,
    pageSize?: number
  ): Promise<{ students: Student[]; totalCount: number }> {
    return academyService.getStudentsPaged(tenantId, filter, page, pageSize);
  }

  /**
   * 학생 일괄 생성 (벌크)
   */
  async bulkCreateStudents(
    tenantId: string,
    industryType: string,
    students: CreateStudentInput[],
    userId?: string
  ): Promise<Student[]> {
    return academyService.bulkCreateStudents(tenantId, industryType, students, userId);
  }

  /**
   * 소프트 삭제된 학생 복원
   */
  async restoreDeletedStudent(
    tenantId: string,
    personId: string
  ): Promise<Student> {
    return academyService.restoreDeletedStudent(tenantId, personId);
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
   * 상담기록 목록 조회
   */
  async getConsultations(
    tenantId: string,
    studentId: string
  ): Promise<StudentConsultation[]> {
    return academyService.getConsultations(tenantId, studentId);
  }

  /**
   * 상담기록 생성
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
   * 상담기록 수정
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
   * 상담기록 삭제
   */
  async deleteConsultation(
    tenantId: string,
    consultationId: string
  ): Promise<void> {
    return academyService.deleteConsultation(tenantId, consultationId);
  }

  /**
   * 상담기록 페이지네이션 조회
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
    return academyService.getConsultationsPaged(tenantId, options);
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
   * 학생별 수업 목록 조회
   */
  async getStudentClasses(
    tenantId: string,
    studentId: string
  ): Promise<Array<StudentClass & { class: unknown }>> {
    return academyService.getStudentClasses(tenantId, studentId);
  }

  /**
   * 전체 학생-수업 배정 목록 조회
   */
  async getAllStudentClasses(
    tenantId: string,
    options?: { activeOnly?: boolean }
  ): Promise<StudentClass[]> {
    return academyService.getAllStudentClasses(tenantId, options);
  }

  /**
   * 학생-수업 배정 페이지네이션 조회
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
    return academyService.getStudentClassesPaged(tenantId, options);
  }

  /**
   * 학생-수업 등록일 수정
   */
  async updateStudentClassEnrolledAt(
    tenantId: string,
    studentClassId: string,
    enrolledAt: string
  ): Promise<StudentClass> {
    return academyService.updateStudentClassEnrolledAt(tenantId, studentClassId, enrolledAt);
  }
}
