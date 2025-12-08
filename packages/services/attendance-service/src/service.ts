/**
 * Attendance Service
 *
 * 출결 관리 서비스 레이어
 * [불변 규칙] Service Layer는 Industry Layer를 매핑하여 비즈니스 로직 제공
 * [불변 규칙] 클라이언트는 Service Layer를 통해만 데이터에 접근
 */

import { academyService } from '@industry/academy/service';
import type {
  AttendanceLog,
  CreateAttendanceLogInput,
  AttendanceFilter,
} from '@industry/academy';

export class AttendanceService {
  /**
   * 출결 로그 생성
   */
  async createAttendanceLog(
    tenantId: string,
    input: CreateAttendanceLogInput,
    userId?: string
  ): Promise<AttendanceLog> {
    return academyService.createAttendanceLog(tenantId, input, userId);
  }

  /**
   * 출결 로그 조회
   */
  async getAttendanceLogs(
    tenantId: string,
    filter?: AttendanceFilter
  ): Promise<AttendanceLog[]> {
    return academyService.getAttendanceLogs(tenantId, filter);
  }

  /**
   * 학생별 출결 로그 조회
   */
  async getAttendanceLogsByStudent(
    tenantId: string,
    studentId: string,
    filter?: Omit<AttendanceFilter, 'student_id'>
  ): Promise<AttendanceLog[]> {
    return academyService.getAttendanceLogsByStudent(tenantId, studentId, filter);
  }

  /**
   * 반별 출결 로그 조회
   */
  async getAttendanceLogsByClass(
    tenantId: string,
    classId: string,
    filter?: Omit<AttendanceFilter, 'class_id'>
  ): Promise<AttendanceLog[]> {
    return academyService.getAttendanceLogsByClass(tenantId, classId, filter);
  }

  /**
   * 출결 로그 삭제
   */
  async deleteAttendanceLog(
    tenantId: string,
    logId: string
  ): Promise<void> {
    return academyService.deleteAttendanceLog(tenantId, logId);
  }
}

export const attendanceService = new AttendanceService();
