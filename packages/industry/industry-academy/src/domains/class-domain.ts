/**
 * Class Domain - 수업(반) 관리
 *
 * 수업 CRUD, 통계, 색상 생성 + 반-강사 배정 관리
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용합니다.
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { withTenant } from '@lib/supabase-client/db';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import type {
  Class,
  CreateClassInput,
  UpdateClassInput,
  ClassFilter,
  ClassTeacher,
  AssignTeacherInput,
} from '../types';

export class ClassDomain {
  constructor(protected supabase: SupabaseClient) {}

  // ==================== 수업(Class) 관리 ====================

  /**
   * 수업 목록 조회 (필터링 가능)
   * [불변 규칙] withTenant() 사용하여 tenant_id 필터 강제
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

    // 상태 필터
    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        query = query.in('status', filter.status);
      } else {
        query = query.eq('status', filter.status);
      }
    }

    // 요일 필터
    if (filter?.day_of_week) {
      query = query.eq('day_of_week', filter.day_of_week);
    }

    // 과목 필터
    if (filter?.subject) {
      query = query.eq('subject', filter.subject);
    }

    // 학년 필터
    if (filter?.grade) {
      query = query.eq('grade', filter.grade);
    }

    // 이름 검색
    if (filter?.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    // 정렬: 요일, 시작 시간 순
    query = query.order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch classes: ${error.message}`);
    }

    return (data || []) as Class[];
  }

  /**
   * 반 상세 조회
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
      if ((error as { code?: string }).code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch class: ${error.message}`);
    }

    return data as Class;
  }

  /**
   * 수업 생성
   * [불변 규칙] INSERT 시 tenant_id 직접 포함
   * [불변 규칙] 수업 색상 자동 생성 (지정하지 않으면 색상 생성)
   */
  async createClass(
    tenantId: string,
    input: CreateClassInput
  ): Promise<Class> {
    // 색상 자동 생성 (지정하지 않은 경우)
    const color = input.color || this.generateClassColor();

    // 수업 생성
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

    // 강사 배정
    if (input.teacher_ids && input.teacher_ids.length > 0) {
      for (const teacherId of input.teacher_ids) {
        await this.assignTeacher(tenantId, {
          class_id: newClass.id,
          teacher_id: teacherId,
          role: 'teacher', // 기본값으로 배정
        });
      }
    }

    return newClass;
  }

  /**
   * 반 수정
   */
  async updateClass(
    tenantId: string,
    classId: string,
    input: UpdateClassInput
  ): Promise<Class> {
    const updateData: Partial<Class> = {};

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

    const result = await withTenant(
      this.supabase
        .from('academy_classes')
        .update(updateData)
        .eq('id', classId)
        .select(),
      tenantId
    ).single();
    const { data, error } = result as { data: Class | null; error: Error | null };

    if (error) {
      throw new Error(`Failed to update class: ${error.message}`);
    }

    return data as Class;
  }

  /**
   * 반 삭제 (소프트 삭제: status를 'archived'로 변경)
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
   * 수업 색상 자동 생성
   * [불변 규칙] 수업 색상 자동 생성
   * [P1 수정] Math.random() 사용 금지: 첫 번째 색상을 기본값으로 사용
   * 향후에는 기존 수업 색상과 중복되지 않도록 개선 예정
   */
  private generateClassColor(): string {
    // 기본 색상 목록(16진수 색상 코드)
    const colors = [
      '#3b82f6', // 파란색
      '#ef4444', // 빨간색
      '#10b981', // 초록색
      '#f59e0b', // 주황색
      '#8b5cf6', // 보라색
      '#ec4899', // 분홍색
      '#06b6d4', // 청록색
      '#f97316', // 주황색
      '#84cc16', // 연두색
      '#6366f1', // 인디고
    ];

    // 첫 번째 색상을 기본값으로 사용 (Math.random() 사용 금지)
    // 향후에는 기존 수업 색상과 중복되지 않도록 개선 예정
    return colors[0];
  }

  /**
   * 수업별 출석률과 정원률, 지각률 조회
   * [문서 요구사항] 수업별 출석률과 정원률, 지각률 조회
   * TODO: 출석 데이터가 구현되면 향후 정확히 계산
   */
  async getClassStatistics(
    tenantId: string,
    classId: string
  ): Promise<{
    attendance_rate: number;  // 출석률(%)
    capacity_rate: number;    // 정원률(%)
    late_rate: number;        // 지각률 (%)
  }> {
    // 현재는 기본값 반환 (출석 데이터가 구현되지 않아 향후 계산)
    const classData = await this.getClass(tenantId, classId);
    if (!classData) {
      throw new Error('Class not found');
    }

    return {
      attendance_rate: 0,  // [Phase 4 잔여] attendance_logs 기반 계산 필요
      capacity_rate: classData.capacity > 0
        ? (classData.current_count / classData.capacity) * 100
        : 0,
      late_rate: 0,  // [Phase 4 잔여] attendance_logs 기반 계산 필요
    };
  }

  // ==================== 반-강사 배정 관리 ====================

  /**
   * 강사 배정
   * [문서 요구사항] 강사 배정/역할 설정
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
        // 기술문서 5-2: KST 기준 날짜 처리
        assigned_at: input.assigned_at || toKST().format('YYYY-MM-DD'),
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
   * 강사 배정 제거
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
          // 기술문서 5-2: KST 기준 날짜 처리
          unassigned_at: toKST().format('YYYY-MM-DD'),
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
   * 수업별 강사 목록 조회
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
}
