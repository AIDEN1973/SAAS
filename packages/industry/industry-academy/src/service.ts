/**
 * Industry Academy Service (Facade)
 *
 * 학원 업종 전용 비즈니스 로직 - 도메인별 모듈로 위임하는 Facade 패턴
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용합니다.
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 * [불변 규칙] persons 테이블은 core-party 패키지에서 관리되므로 academy_students와 조인하여 사용합니다.
 *
 * 도메인 분리:
 *   - StudentDomain: 학생 CRUD, 학부모, 상담기록, 태그
 *   - ClassDomain: 수업 CRUD, 통계, 반-강사 배정
 *   - TeacherDomain: 강사 CRUD
 *   - EnrollmentDomain: 학생-수업 배정
 *   - AttendanceDomain: 출석 관리
 */

import { createServerClient } from '@lib/supabase-client/server';
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
  TeacherFilter,
  ClassTeacher,
  AssignTeacherInput,
} from './types';
import type { Tag } from '@core/tags';
import {
  StudentDomain,
  ClassDomain,
  TeacherDomain,
  EnrollmentDomain,
  AttendanceDomain,
} from './domains';

export class AcademyService {
  private supabase = createServerClient();

  // Domain instances
  private studentDomain: StudentDomain;
  private classDomain: ClassDomain;
  private teacherDomain: TeacherDomain;
  private enrollmentDomain: EnrollmentDomain;
  private attendanceDomain: AttendanceDomain;

  constructor() {
    this.studentDomain = new StudentDomain(this.supabase);
    this.classDomain = new ClassDomain(this.supabase);
    this.teacherDomain = new TeacherDomain(this.supabase);
    this.enrollmentDomain = new EnrollmentDomain(this.supabase, this.classDomain);
    this.attendanceDomain = new AttendanceDomain(this.supabase, this.studentDomain);
  }

  // ==================== 학생(Student) 관리 ====================

  getStudents = (
    tenantId: string,
    filter?: StudentFilter
  ): Promise<Student[]> =>
    this.studentDomain.getStudents(tenantId, filter);

  getStudent = (
    tenantId: string,
    studentId: string
  ): Promise<Student | null> =>
    this.studentDomain.getStudent(tenantId, studentId);

  createStudent = (
    tenantId: string,
    industryType: string,
    input: CreateStudentInput,
    userId?: string
  ): Promise<Student> =>
    this.studentDomain.createStudent(tenantId, industryType, input, userId);

  bulkCreateStudents = (
    tenantId: string,
    industryType: string,
    students: CreateStudentInput[],
    userId?: string
  ): Promise<Student[]> =>
    this.studentDomain.bulkCreateStudents(tenantId, industryType, students, userId);

  updateStudent = (
    tenantId: string,
    studentId: string,
    input: UpdateStudentInput,
    userId?: string
  ): Promise<Student> =>
    this.studentDomain.updateStudent(tenantId, studentId, input, userId);

  deleteStudent = (
    tenantId: string,
    studentId: string,
    _userId?: string
  ): Promise<void> =>
    this.studentDomain.deleteStudent(tenantId, studentId, _userId);

  getGuardians = (
    tenantId: string,
    studentId: string
  ): Promise<Guardian[]> =>
    this.studentDomain.getGuardians(tenantId, studentId);

  createGuardians = (
    tenantId: string,
    studentId: string,
    guardians: Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>[]
  ): Promise<Guardian[]> =>
    this.studentDomain.createGuardians(tenantId, studentId, guardians);

  getTags = (tenantId: string): Promise<Tag[]> =>
    this.studentDomain.getTags(tenantId);

  getStudentTags = (
    tenantId: string,
    studentId: string
  ): Promise<Tag[]> =>
    this.studentDomain.getStudentTags(tenantId, studentId);

  getConsultations = (
    tenantId: string,
    studentId: string
  ): Promise<StudentConsultation[]> =>
    this.studentDomain.getConsultations(tenantId, studentId);

  createConsultation = (
    tenantId: string,
    studentId: string,
    consultation: Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>,
    userId: string
  ): Promise<StudentConsultation> =>
    this.studentDomain.createConsultation(tenantId, studentId, consultation, userId);

  updateConsultation = (
    tenantId: string,
    consultationId: string,
    consultation: Partial<Omit<StudentConsultation, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at' | 'created_by'>>,
    userId?: string
  ): Promise<StudentConsultation> =>
    this.studentDomain.updateConsultation(tenantId, consultationId, consultation, userId);

  deleteConsultation = (
    tenantId: string,
    consultationId: string
  ): Promise<void> =>
    this.studentDomain.deleteConsultation(tenantId, consultationId);

  generateConsultationAISummary = (
    tenantId: string,
    consultationId: string
  ): Promise<string> =>
    this.studentDomain.generateConsultationAISummary(tenantId, consultationId);

  updateGuardian = (
    tenantId: string,
    guardianId: string,
    guardian: Partial<Omit<Guardian, 'id' | 'tenant_id' | 'student_id' | 'created_at' | 'updated_at'>>
  ): Promise<Guardian> =>
    this.studentDomain.updateGuardian(tenantId, guardianId, guardian);

  deleteGuardian = (
    tenantId: string,
    guardianId: string
  ): Promise<void> =>
    this.studentDomain.deleteGuardian(tenantId, guardianId);

  updateStudentTags = (
    tenantId: string,
    studentId: string,
    tagIds: string[]
  ): Promise<void> =>
    this.studentDomain.updateStudentTags(tenantId, studentId, tagIds);

  getStudentsPaged = (
    tenantId: string,
    filter?: StudentFilter,
    page = 1,
    pageSize = 20
  ): Promise<{ students: Student[]; totalCount: number }> =>
    this.studentDomain.getStudentsPaged(tenantId, filter, page, pageSize);

  restoreDeletedStudent = (
    tenantId: string,
    personId: string
  ): Promise<Student> =>
    this.studentDomain.restoreDeletedStudent(tenantId, personId);

  getConsultationsPaged = (
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      dateFrom?: string;
      dateTo?: string;
      consultationType?: string;
    }
  ): Promise<{ consultations: StudentConsultation[]; totalCount: number }> =>
    this.studentDomain.getConsultationsPaged(tenantId, options);

  // ==================== 수업(Class) 관리 ====================

  getClasses = (
    tenantId: string,
    filter?: ClassFilter
  ): Promise<Class[]> =>
    this.classDomain.getClasses(tenantId, filter);

  getClass = (
    tenantId: string,
    classId: string
  ): Promise<Class | null> =>
    this.classDomain.getClass(tenantId, classId);

  createClass = (
    tenantId: string,
    input: CreateClassInput
  ): Promise<Class> =>
    this.classDomain.createClass(tenantId, input);

  updateClass = (
    tenantId: string,
    classId: string,
    input: UpdateClassInput
  ): Promise<Class> =>
    this.classDomain.updateClass(tenantId, classId, input);

  deleteClass = (
    tenantId: string,
    classId: string
  ): Promise<void> =>
    this.classDomain.deleteClass(tenantId, classId);

  getClassStatistics = (
    tenantId: string,
    classId: string
  ): Promise<{
    attendance_rate: number;
    capacity_rate: number;
    late_rate: number;
  }> =>
    this.classDomain.getClassStatistics(tenantId, classId);

  // ==================== 강사(Teacher) 관리 ====================

  getTeachers = (
    tenantId: string,
    filter?: TeacherFilter
  ): Promise<Teacher[]> =>
    this.teacherDomain.getTeachers(tenantId, filter);

  getTeacher = (
    tenantId: string,
    teacherId: string
  ): Promise<Teacher | null> =>
    this.teacherDomain.getTeacher(tenantId, teacherId);

  createTeacher = (
    tenantId: string,
    input: CreateTeacherInput
  ): Promise<Teacher> =>
    this.teacherDomain.createTeacher(tenantId, input);

  updateTeacher = (
    tenantId: string,
    teacherId: string,
    input: UpdateTeacherInput
  ): Promise<Teacher> =>
    this.teacherDomain.updateTeacher(tenantId, teacherId, input);

  deleteTeacher = (
    tenantId: string,
    teacherId: string
  ): Promise<void> =>
    this.teacherDomain.deleteTeacher(tenantId, teacherId);

  // ==================== 반-강사 배정 관리 ====================

  assignTeacher = (
    tenantId: string,
    input: AssignTeacherInput
  ): Promise<ClassTeacher> =>
    this.classDomain.assignTeacher(tenantId, input);

  unassignTeacher = (
    tenantId: string,
    classId: string,
    teacherId: string
  ): Promise<void> =>
    this.classDomain.unassignTeacher(tenantId, classId, teacherId);

  getClassTeachers = (
    tenantId: string,
    classId: string
  ): Promise<ClassTeacher[]> =>
    this.classDomain.getClassTeachers(tenantId, classId);

  // ==================== 학생 수업 배정 관리 ====================

  enrollStudentToClass = (
    tenantId: string,
    studentId: string,
    classId: string,
    enrolledAt?: string
  ): Promise<StudentClass> =>
    this.enrollmentDomain.enrollStudentToClass(tenantId, studentId, classId, enrolledAt);

  unenrollStudentFromClass = (
    tenantId: string,
    studentId: string,
    classId: string,
    leftAt?: string
  ): Promise<void> =>
    this.enrollmentDomain.unenrollStudentFromClass(tenantId, studentId, classId, leftAt);

  getStudentClasses = (
    tenantId: string,
    studentId: string
  ): Promise<Array<StudentClass & { class: Class | null }>> =>
    this.enrollmentDomain.getStudentClasses(tenantId, studentId);

  getAllStudentClasses = (
    tenantId: string,
    options?: { activeOnly?: boolean }
  ): Promise<StudentClass[]> =>
    this.enrollmentDomain.getAllStudentClasses(tenantId, options);

  getStudentClassesPaged = (
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      classId?: string;
      activeOnly?: boolean;
    }
  ): Promise<{ studentClasses: StudentClass[]; totalCount: number }> =>
    this.enrollmentDomain.getStudentClassesPaged(tenantId, options);

  updateStudentClassEnrolledAt = (
    tenantId: string,
    studentClassId: string,
    enrolledAt: string
  ): Promise<StudentClass> =>
    this.enrollmentDomain.updateStudentClassEnrolledAt(tenantId, studentClassId, enrolledAt);

  // ==================== 출석 관리 ====================

  createAttendanceLog = (
    tenantId: string,
    input: CreateAttendanceLogInput,
    userId?: string
  ): Promise<AttendanceLog> =>
    this.attendanceDomain.createAttendanceLog(tenantId, input, userId);

  getAttendanceLogs = (
    tenantId: string,
    filter?: AttendanceFilter
  ): Promise<AttendanceLog[]> =>
    this.attendanceDomain.getAttendanceLogs(tenantId, filter);

  getAttendanceLogsByStudent = (
    tenantId: string,
    studentId: string,
    filter?: Omit<AttendanceFilter, 'student_id'>
  ): Promise<AttendanceLog[]> =>
    this.attendanceDomain.getAttendanceLogsByStudent(tenantId, studentId, filter);

  getAttendanceLogsByClass = (
    tenantId: string,
    classId: string,
    filter?: Omit<AttendanceFilter, 'class_id'>
  ): Promise<AttendanceLog[]> =>
    this.attendanceDomain.getAttendanceLogsByClass(tenantId, classId, filter);

  deleteAttendanceLog = (
    tenantId: string,
    logId: string
  ): Promise<void> =>
    this.attendanceDomain.deleteAttendanceLog(tenantId, logId);
}

/**
 * Default Service Instance
 */
export const academyService = new AcademyService();
