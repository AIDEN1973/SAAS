/**
 * Class Service
 * 
 * [ë¶ˆë? ê·œì¹™] Service Layer??Industry Layerë¥??¬ìš©?˜ì—¬ ?…ì¢…ë³?ë¹„ì¦ˆ?ˆìŠ¤ ë¡œì§???¸ì¶œ?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] Service Layer??Core Layerë¥?ì§ì ‘ ?¬ìš©?˜ì? ?Šê³ , Industry Layerë¥??µí•´ ?‘ê·¼?œë‹¤.
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
 * Class Service (Industry Layer ?˜í¼)
 * 
 * Service Layer??Industry Layer??academyServiceë¥??˜í•‘?˜ì—¬ ?œê³µ?©ë‹ˆ??
 */
export class ClassService {
  // ==================== ë°?Class) ê´€ë¦?====================

  /**
   * ë°?ëª©ë¡ ì¡°íšŒ (?„í„°ë§?ì§€??
   */
  async getClasses(
    tenantId: string,
    filter?: ClassFilter
  ): Promise<Class[]> {
    return academyService.getClasses(tenantId, filter);
  }

  /**
   * ë°??ì„¸ ì¡°íšŒ
   */
  async getClass(tenantId: string, classId: string): Promise<Class | null> {
    return academyService.getClass(tenantId, classId);
  }

  /**
   * ë°??ì„±
   */
  async createClass(
    tenantId: string,
    input: CreateClassInput
  ): Promise<Class> {
    return academyService.createClass(tenantId, input);
  }

  /**
   * ë°??˜ì •
   */
  async updateClass(
    tenantId: string,
    classId: string,
    input: UpdateClassInput
  ): Promise<Class> {
    return academyService.updateClass(tenantId, classId, input);
  }

  /**
   * ë°??? œ
   */
  async deleteClass(tenantId: string, classId: string): Promise<void> {
    return academyService.deleteClass(tenantId, classId);
  }

  /**
   * ë°˜ë³„ ?µê³„ ì¡°íšŒ
   */
  async getClassStatistics(
    tenantId: string,
    classId: string
  ): Promise<{
    attendance_rate: number;
    capacity_rate: number;
    late_rate: number;
  }> {
    return academyService.getClassStatistics(tenantId, classId);
  }

  // ==================== ê°•ì‚¬(Teacher) ê´€ë¦?====================

  /**
   * ê°•ì‚¬ ëª©ë¡ ì¡°íšŒ (?„í„°ë§?ì§€??
   */
  async getTeachers(
    tenantId: string,
    filter?: TeacherFilter
  ): Promise<Teacher[]> {
    return academyService.getTeachers(tenantId, filter);
  }

  /**
   * ê°•ì‚¬ ?ì„¸ ì¡°íšŒ
   */
  async getTeacher(tenantId: string, teacherId: string): Promise<Teacher | null> {
    return academyService.getTeacher(tenantId, teacherId);
  }

  /**
   * ê°•ì‚¬ ?ì„±
   */
  async createTeacher(
    tenantId: string,
    input: CreateTeacherInput
  ): Promise<Teacher> {
    return academyService.createTeacher(tenantId, input);
  }

  /**
   * ê°•ì‚¬ ?˜ì •
   */
  async updateTeacher(
    tenantId: string,
    teacherId: string,
    input: UpdateTeacherInput
  ): Promise<Teacher> {
    return academyService.updateTeacher(tenantId, teacherId, input);
  }

  /**
   * ê°•ì‚¬ ?? œ
   */
  async deleteTeacher(tenantId: string, teacherId: string): Promise<void> {
    return academyService.deleteTeacher(tenantId, teacherId);
  }

  // ==================== ë°?ê°•ì‚¬ ?°ê²° ê´€ë¦?====================

  /**
   * ê°•ì‚¬ ë°°ì •
   */
  async assignTeacher(
    tenantId: string,
    input: AssignTeacherInput
  ): Promise<ClassTeacher> {
    return academyService.assignTeacher(tenantId, input);
  }

  /**
   * ê°•ì‚¬ ë°°ì • ?´ì œ
   */
  async unassignTeacher(
    tenantId: string,
    classId: string,
    teacherId: string
  ): Promise<void> {
    return academyService.unassignTeacher(tenantId, classId, teacherId);
  }

  /**
   * ë°˜ë³„ ê°•ì‚¬ ëª©ë¡ ì¡°íšŒ
   */
  async getClassTeachers(
    tenantId: string,
    classId: string
  ): Promise<ClassTeacher[]> {
    return academyService.getClassTeachers(tenantId, classId);
  }
}

/**
 * Default Service Instance
 */
export const classService = new ClassService();

