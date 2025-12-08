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
}
