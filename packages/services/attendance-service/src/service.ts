/**
 * Attendance Service
 * 
 * 출결 관�??�비???�이??
 * [불�? 규칙] Service Layer??Industry Layer�??�핑?�여 비즈?�스 로직 ?�공
 * [불�? 규칙] ?�라?�언?�는 Service Layer�??�해?�만 ?�이???�근
 */

import { academyService } from '@industry/academy/service';
import type {
  AttendanceLog,
  CreateAttendanceLogInput,
  AttendanceFilter,
} from '@industry/academy';

export class AttendanceService {
  /**
   * 출결 로그 ?�성
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
   * ?�생�?출결 로그 조회
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
   * 출결 로그 ??��
   */
  async deleteAttendanceLog(
    tenantId: string,
    logId: string
  ): Promise<void> {
    return academyService.deleteAttendanceLog(tenantId, logId);
  }
}

export const attendanceService = new AttendanceService();

