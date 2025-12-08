/**
 * Class Service
 *
 * [불변 규칙] Service Layer는 Industry Layer를 사용하여 업종별 비즈니스 로직을 호출합니다.
 * [불변 규칙] Service Layer는 Core Layer를 직접 사용하지 않고, Industry Layer를 통해 접근합니다.
 */

import { academyService } from '@industry/academy/service';
import type {
  Class,
  CreateClassInput,
  UpdateClassInput,
  ClassFilter,
  Teacher,
  CreateTeacherInput,
  UpdateTeacherInput,
  TeacherFilter,
  ClassTeacher,
  AssignTeacherInput,
} from '@industry/academy/types';

/**
 * Class Service (Industry Layer 래퍼)
 *
 * Service Layer는 Industry Layer의 academyService를 매핑하여 제공합니다.
 */
export class ClassService {
  // ==================== 반(Class) 관리 ====================

  /**
   * 반 목록 조회 (필터링/페이징)
   */
  async getClasses(
    tenantId: string,
    filter?: ClassFilter
  ): Promise<Class[]> {
    return academyService.getClasses(tenantId, filter);
  }

  /**
   * 반 상세 조회
   */
  async getClass(tenantId: string, classId: string): Promise<Class | null> {
    return academyService.getClass(tenantId, classId);
  }

  /**
   * 반 생성
   */
  async createClass(
    tenantId: string,
    input: CreateClassInput
  ): Promise<Class> {
    return academyService.createClass(tenantId, input);
  }

  /**
   * 반 수정
   */
  async updateClass(
    tenantId: string,
    classId: string,
    input: UpdateClassInput
  ): Promise<Class> {
    return academyService.updateClass(tenantId, classId, input);
  }

  /**
   * 반 삭제
   */
  async deleteClass(tenantId: string, classId: string): Promise<void> {
    return academyService.deleteClass(tenantId, classId);
  }

  /**
   * 반별 통계 조회
   */
  async getClassStatistics(
    tenantId: string,
    classId: string
  ): Promise<{
    totalStudents: number;
    activeStudents: number;
    attendanceRate: number;
  }> {
    const stats = await academyService.getClassStatistics(tenantId, classId);
    // academyService는 다른 형식을 반환하므로 변환 필요
    return {
      totalStudents: 0, // TODO: 실제 학생 수 계산
      activeStudents: 0, // TODO: 실제 활성 학생 수 계산
      attendanceRate: stats.attendance_rate,
    };
  }

  // ==================== 강사(Teacher) 관리 ====================

  /**
   * 강사 목록 조회 (필터링/페이징)
   */
  async getTeachers(
    tenantId: string,
    filter?: TeacherFilter
  ): Promise<Teacher[]> {
    return academyService.getTeachers(tenantId, filter);
  }

  /**
   * 강사 상세 조회
   */
  async getTeacher(tenantId: string, teacherId: string): Promise<Teacher | null> {
    return academyService.getTeacher(tenantId, teacherId);
  }

  /**
   * 강사 생성
   */
  async createTeacher(
    tenantId: string,
    input: CreateTeacherInput
  ): Promise<Teacher> {
    return academyService.createTeacher(tenantId, input);
  }

  /**
   * 강사 수정
   */
  async updateTeacher(
    tenantId: string,
    teacherId: string,
    input: UpdateTeacherInput
  ): Promise<Teacher> {
    return academyService.updateTeacher(tenantId, teacherId, input);
  }

  /**
   * 강사 삭제
   */
  async deleteTeacher(tenantId: string, teacherId: string): Promise<void> {
    return academyService.deleteTeacher(tenantId, teacherId);
  }

  // ==================== 반-강사 연결 ====================

  /**
   * 반에 강사 할당
   */
  async assignTeacher(
    tenantId: string,
    input: AssignTeacherInput
  ): Promise<ClassTeacher> {
    return academyService.assignTeacher(tenantId, input);
  }

  /**
   * 반에서 강사 제거
   */
  async unassignTeacher(
    tenantId: string,
    classId: string,
    teacherId: string
  ): Promise<void> {
    return academyService.unassignTeacher(tenantId, classId, teacherId);
  }

  /**
   * 반별 강사 목록 조회
   */
  async getClassTeachers(
    tenantId: string,
    classId: string
  ): Promise<ClassTeacher[]> {
    return academyService.getClassTeachers(tenantId, classId);
  }
}

export const classService = new ClassService();
