/**
 * Attendance Domain - 출석 관리
 *
 * 출석 로그 CRUD, 알림, 분석 이벤트 기록
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용합니다.
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { withTenant } from '@lib/supabase-client/db';
import { configService } from '@core/config/service';
import { notificationService } from '@core/notification/service';
import { toKST } from '@lib/date-utils'; // 기술문서 5-2: KST 변환 필수
import type {
  AttendanceLog,
  CreateAttendanceLogInput,
  AttendanceFilter,
  AttendanceStatus,
} from '../types';
import type { StudentDomain } from './student-domain';

export class AttendanceDomain {
  constructor(
    protected supabase: SupabaseClient,
    private studentDomain: StudentDomain
  ) {}

  // ==================== 출석 관리 ====================

  /**
   * 출석 로그 생성
   * [불변 규칙] INSERT 시 tenant_id 직접 포함
   */
  async createAttendanceLog(
    tenantId: string,
    input: CreateAttendanceLogInput,
    userId?: string
  ): Promise<AttendanceLog> {
    // [문서 요구사항] 출석 Hook 요구: 출석 체크 시 출결 이벤트 발생 → core-notification으로 알림 발송 → core-metering으로 사용량 기록 → core-billing으로 과금 처리

    // 1. 출석 로그 생성
    const { data, error } = await this.supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenantId,  // [불변 규칙] INSERT 시 tenant_id 직접 포함
        student_id: input.student_id,
        class_id: input.class_id,
        occurred_at: input.occurred_at,
        attendance_type: input.attendance_type,
        status: input.status,
        notes: input.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create attendance log: ${error.message}`);
    }

    const attendanceLog = data as AttendanceLog;

    // 2. core-notification으로 알림 발송 (문서 요구사항: 출석 Hook 요구)
    try {
      const config = await configService.getConfig(tenantId);
      const autoNotification = config?.attendance?.auto_notification ?? false;
      // SSOT-3: 'kakao' 저장 금지, 'kakao_at'로 정규화
      let notificationChannel = config?.attendance?.notification_channel ?? 'sms';
      if ((notificationChannel as string) === 'kakao') {
        console.warn(`[Academy Service] Legacy channel 'kakao' detected, normalizing to 'kakao_at'`);
        notificationChannel = 'kakao_at';
      }

      // 자동 알림이 설정되어 있고, 결석이 아닌 경우에만 알림 발송
      if (autoNotification && input.status !== 'absent') {
        // 학생 정보 조회
        const student = await this.studentDomain.getStudent(tenantId, input.student_id);
        if (student) {
          // 학부모 정보 조회 (주 연락처 우선)
          const guardians = await this.studentDomain.getGuardians(tenantId, input.student_id);
          const primaryGuardian = guardians.find(g => g.is_primary) || guardians[0];

          if (primaryGuardian?.phone) {
            // 알림 메시지 생성
            const attendanceTypeText = input.attendance_type === 'check_in' ? '등원'
              : input.attendance_type === 'check_out' ? '하원'
              : input.attendance_type === 'late' ? '지각'
              : '출결';
            // 중요: 모든 케이스 처리
            const status = input.status as AttendanceStatus;
            let statusText: string;
            switch (status) {
              case 'present':
                statusText = '출석';
                break;
              case 'late':
                statusText = '지각';
                break;
              case 'absent':
                statusText = '결석';
                break;
              case 'excused':
                statusText = '사유';
                break;
              default:
                statusText = '미정';
            }

            // 기술문서 5-2: KST 기준 날짜 처리
            const occurredAtKST = toKST(input.occurred_at).format('MM/DD HH:mm');

            const message = `[학원알림] ${student.name} 학생이 ${attendanceTypeText}했습니다.\n시간: ${occurredAtKST}\n상태: ${statusText}`;

            // 알림 발송
            await notificationService.createNotification(tenantId, {
              channel: notificationChannel === 'kakao_at' ? 'kakao_at' : 'sms',  // SSOT-3: 'kakao' 저장 금지, 'kakao_at'만 사용
              recipient: primaryGuardian.phone,
              content: message,
            });
          }
        }
      }
    } catch (error) {
      // 알림 발송 실패해도 출결 기록은 유지됨
      console.error('Failed to send notification:', error);
    }

    // 3. analytics.events에 이벤트 기록 (문서 15-8: attendance.check_in, attendance.check_out)
    try {
      const { analyticsService } = await import('@core/analytics/service');
      const { meteringService } = await import('@core/metering/service');

      // 테넌트 정보 조회 (store_id, region_id, industry_type)
      const tenant = await this.supabase
        .from('tenants')
        .select('industry_type')
        .eq('id', tenantId)
        .single();

      // 기본 매장 조회 (Phase 1: 첫 매장만 사용)
      const store = await withTenant(
        this.supabase
          .from('core_stores')
          .select('id, region_id, industry_type')
          .eq('status', 'active')
          .limit(1),
        tenantId
      );

      const storeId = store.data?.[0]?.id;
      const regionId = store.data?.[0]?.region_id;
      const industryType = tenant.data?.industry_type || store.data?.[0]?.industry_type || 'academy';

      // 이벤트 타입 설정 (attendance.check_in 또는 attendance.check_out)
      // ⚠️ 참고: analytics.events.event_type은 자동화 카탈로그의 event_type과 다른 도메인 값입니다.
      // analytics.events.event_type은 시스템 이벤트 타입(예: 'attendance.check_in', 'attendance.check_out')이며,
      // 자동화 카탈로그의 event_type은 자동화 시나리오 키(예: 'overdue_outstanding_over_limit', 'payment_due_reminder')입니다.
      const eventType = input.attendance_type === 'check_in'
        ? 'attendance.check_in'
        : input.attendance_type === 'check_out'
        ? 'attendance.check_out'
        : `attendance.${input.attendance_type}`;

      // analytics.events에 기록 (event_date_kst는 서비스에서 자동 계산됨)
      await analyticsService.recordEvent(tenantId, {
        event_type: eventType,
        user_id: userId,
        occurred_at: input.occurred_at,
        payload: {
          student_id: input.student_id,
          class_id: input.class_id,
          attendance_type: input.attendance_type,
          status: input.status,
        },
        store_id: storeId,
        region_id: regionId,
        industry_type: industryType,
      });

      // 4. core-metering 사용량 기록 (attendance_count)
      await meteringService.recordUsage(tenantId, {
        metric_type: 'attendance_count',
        value: 1,
        recorded_at: input.occurred_at,
      });
    } catch (error) {
      // analytics/metering 기록 실패해도 출석 기록은 유지됨
      console.error('Failed to record analytics/metering:', error);
    }

    return attendanceLog;
  }

  /**
   * 출결 로그 조회
   * [불변 규칙] SELECT 쿼리는 withTenant 사용
   */
  async getAttendanceLogs(
    tenantId: string,
    filter?: AttendanceFilter
  ): Promise<AttendanceLog[]> {
    let query = this.supabase
      .from('attendance_logs')
      .select('*')
      .order('occurred_at', { ascending: false });

    // 필터 적용
    if (filter?.student_id) {
      query = query.eq('student_id', filter.student_id);
    }
    if (filter?.class_id) {
      query = query.eq('class_id', filter.class_id);
    }
    if (filter?.date_from) {
      query = query.gte('occurred_at', filter.date_from);
    }
    if (filter?.date_to) {
      query = query.lte('occurred_at', filter.date_to);
    }
    if (filter?.attendance_type) {
      query = query.eq('attendance_type', filter.attendance_type);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await withTenant(query, tenantId);

    if (error) {
      throw new Error(`Failed to fetch attendance logs: ${error.message}`);
    }

    return (data || []) as AttendanceLog[];
  }

  /**
   * 학생별 출결 로그 조회
   */
  async getAttendanceLogsByStudent(
    tenantId: string,
    studentId: string,
    filter?: Omit<AttendanceFilter, 'student_id'>
  ): Promise<AttendanceLog[]> {
    return this.getAttendanceLogs(tenantId, { ...filter, student_id: studentId });
  }

  /**
   * 수업별 출결 로그 조회
   */
  async getAttendanceLogsByClass(
    tenantId: string,
    classId: string,
    filter?: Omit<AttendanceFilter, 'class_id'>
  ): Promise<AttendanceLog[]> {
    return this.getAttendanceLogs(tenantId, { ...filter, class_id: classId });
  }

  /**
   * 출결 로그 삭제
   * [불변 규칙] DELETE 쿼리는 withTenant 사용
   */
  async deleteAttendanceLog(
    tenantId: string,
    logId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('attendance_logs')
        .delete()
        .eq('id', logId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to delete attendance log: ${error.message}`);
    }
  }
}
