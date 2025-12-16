/**
 * 출결 관리 페이지
 *
 * [요구사항]
 * - PC/태블릿/모바일 출결
 * - QR 출결(선택)
 * - 출결 알림 발송(카카오톡/SMS)
 * - 지각 기준, 결석 처리 규칙 설정
 * - 시간대별 출결 기록
 * - 자동 출결 메시지
 * - 출석부 출력
 * - 출결 히스토리 조회
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input, Badge, Switch, Select, useModal, Checkbox, Tabs, BottomActionBar, Grid, PageHeader } from '@ui-core/react';
import type { TabItem } from '@ui-core/react';
import { SchemaForm, SchemaFilter } from '@schema-engine';
import { useAttendanceLogs, useCreateAttendanceLog, useDeleteAttendanceLog } from '@hooks/use-attendance';
import { useStudents } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { useConfig, useUpdateConfig } from '@hooks/use-config';
import type { AttendanceFilter, AttendanceType, AttendanceStatus, AttendanceLog } from '@services/attendance-service';
import type { Student, StudentClass } from '@services/student-service';
import { useResponsiveMode } from '@ui-core/react';
import type { ColorToken } from '@design-system/core';
import type { Class, DayOfWeek } from '@services/class-service';
import { toKST } from '@lib/date-utils';
import { createAttendanceFormSchema } from '../schemas/attendance.schema';
import { createAttendanceFilterSchema, createAttendanceHeaderFilterSchema } from '../schemas/attendance.filter.schema';
// 출결 설정은 환경설정 > 출결 설정으로 이동 (아키텍처 문서 3.3.7)
// import { attendanceSettingsFormSchema } from '../schemas/attendance-settings.schema';
import { apiClient } from '@api-sdk/core';
import { useSchema } from '@hooks/use-schema';
import { useUserRole } from '@hooks/use-auth';

// 학생 출결 상태 인터페이스
interface StudentAttendanceState {
  student_id: string;
  check_in: boolean;
  check_out: boolean;
  status: AttendanceStatus;
  ai_predicted?: boolean; // AI 예측값 여부
  user_modified?: boolean; // 사용자가 수정했는지 여부 (사용자 입력 시 AI 데이터 override)
}

export function AttendancePage() {
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md'; // 아키텍처 문서 3.3.9: 태블릿 모드 감지 (768px ~ 1024px)
  const isDesktop = mode === 'lg' || mode === 'xl'; // 아키텍처 문서 3.3.9: 데스크톱 모드 (> 1024px)
  const { data: userRole } = useUserRole();

  // 역할별 권한 체크 (아키텍처 문서 2.3, 498-507줄)
  // Assistant: 출결 입력만 가능, 수정 권한 없음
  // Teacher: 출결 입력 및 수정 모두 가능
  const canModifyAttendance = userRole !== 'assistant';

  // 화면 모드: 'today' (오늘 출결하기) 또는 'qr' (QR 출결 실행)
  // 아키텍처 문서 3.3.1: 출결 메인 화면은 "오늘 출결하기"와 "QR 출결 실행(학생용)" 두 개만 있어야 함
  const [viewMode, setViewMode] = useState<'today' | 'qr'>('today');

  // 오늘 출결하기 관련 상태
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(toKST().format('YYYY-MM-DD'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [studentAttendanceStates, setStudentAttendanceStates] = useState<Record<string, StudentAttendanceState>>({});
  const [isSaving, setIsSaving] = useState(false);

  // 필터 상태 (출결 기록 조회는 Advanced 메뉴로 이동 - 아키텍처 문서에 명시되지 않음)
  const [filter, setFilter] = useState<AttendanceFilter>({
    date_from: toKST().format('YYYY-MM-DD'),
    date_to: toKST().format('YYYY-MM-DD'),
  });

  // QR 출결 상태
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // 통계/히트맵 기능은 통계 또는 AI 인사이트 메뉴로 이동 (아키텍처 문서 3.3.8)
  // const [showStatistics, setShowStatistics] = useState(false);

  // 출결 설정은 환경설정 > 출결 설정으로 이동 (아키텍처 문서 1716줄)
  // const [showSettings, setShowSettings] = useState(false);
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();

  // 전역 모달 훅 사용
  const { showAlert, showConfirm } = useModal();

  // 설정 값 (서버에서 가져온 값 또는 기본값) - 로컬 state로 관리
  const [attendanceConfig, setAttendanceConfig] = useState({
    late_after: 10,
    absent_after: 60,
    auto_notification: true,
    notification_channel: 'sms' as 'sms' | 'kakao',
  });

  // 서버 설정 로드
  useEffect(() => {
    if (config?.attendance) {
      setAttendanceConfig({
        late_after: config.attendance.late_after ?? 10,
        absent_after: config.attendance.absent_after ?? 60,
        auto_notification: config.attendance.auto_notification ?? true,
        notification_channel: (config.attendance.notification_channel ?? 'sms') as 'sms' | 'kakao',
      });
    }
  }, [config]);

  // 출결 기록 상태
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 데이터 조회
  const { data: attendanceLogsData, isLoading: isLoadingLogs, error: errorLogs } = useAttendanceLogs(filter);
  const attendanceLogs = attendanceLogsData || [];
  const { data: students, isLoading: isLoadingStudents, error: errorStudents } = useStudents();
  const { data: classes, isLoading: isLoadingClasses, error: errorClasses } = useClasses();

  // 오늘 수업 필터링 (Today-First Principle)
  // 기술문서 5-2: KST 기준 날짜 처리
  const todayClassesFilter = useMemo(() => {
    // 오늘 요일 계산 (월요일=1, 일요일=0) - KST 기준
    const todayKST = toKST();
    const dayOfWeek = todayKST.day(); // 0(일) ~ 6(토)
    const dayOfWeekMap: Record<number, DayOfWeek> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    const todayDayOfWeek = dayOfWeekMap[dayOfWeek];
    return { day_of_week: todayDayOfWeek, status: 'active' as const };
  }, []);

  // 오늘 수업 반 목록
  const { data: todayClasses } = useClasses(todayClassesFilter);

  // 오늘 수업 반의 학생 ID 목록 조회
  const { data: todayClassStudentIds } = useQuery({
    queryKey: ['today-class-student-ids', todayClasses?.map(c => c.id)],
    queryFn: async () => {
      if (!todayClasses || todayClasses.length === 0) return new Set<string>();

      const classIds = todayClasses.map(c => c.id);
      const studentIdsSet = new Set<string>();

      // 각 반에 대해 student_classes 조회
      for (const classId of classIds) {
        const response = await apiClient.get<StudentClass>('student_classes', {
          filters: { class_id: classId, is_active: true },
        });

        if (!response.error && response.data) {
          response.data.forEach((sc: { student_id: string; class_id?: string }) => {
            studentIdsSet.add(sc.student_id);
          });
        }
      }

      return studentIdsSet;
    },
    enabled: !!todayClasses && todayClasses.length > 0,
  });

  // 오늘 수업 학생 목록 (오늘 수업이 있는 반에 속한 학생만)
  const todayStudents = useMemo(() => {
    if (!students || !todayClassStudentIds) return [];

    return students.filter(s => todayClassStudentIds.has(s.id));
  }, [students, todayClassStudentIds]);

  // 선택된 반의 학생 ID 목록 조회
  const { data: selectedClassStudentIds } = useQuery({
    queryKey: ['selected-class-student-ids', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return null;

      const response = await apiClient.get<StudentClass>('student_classes', {
        filters: { class_id: selectedClassId, is_active: true },
      });

      if (response.error || !response.data) return new Set<string>();

      return new Set<string>(response.data.map((sc: { student_id: string }) => sc.student_id));
    },
    enabled: !!selectedClassId,
  });

  // 선택된 반의 학생 목록
  const filteredStudents = useMemo(() => {
    if (!todayStudents) return [];

    let filtered = todayStudents;

    // 반 필터
    if (selectedClassId && selectedClassStudentIds) {
      filtered = filtered.filter(s => selectedClassStudentIds.has(s.id));
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name?.toLowerCase().includes(query) ||
        s.phone?.includes(query)
      );
    }

    return filtered;
  }, [todayStudents, selectedClassId, selectedClassStudentIds, searchQuery]);

  // AI 출석 예측 조회 (초기 상태에만 적용)
  const { data: aiPredictions, isLoading: isLoadingPredictions } = useQuery({
    queryKey: ['ai-attendance-predictions', selectedDate, selectedClassId, filteredStudents.map(s => s.id)],
    queryFn: async () => {
      if (!filteredStudents || filteredStudents.length === 0) return {};

      try {
        // AI 출석 예측 (아키텍처 문서 3.3.2: AI가 출석을 "예측"하여 기본값 설정)
        // 현재는 과거 출결 패턴 기반 간단한 예측 구현
        // 향후 Edge Function으로 AI 예측 API 호출로 확장 예정
        const predictions: Record<string, { check_in: boolean; check_out: boolean; status: AttendanceStatus }> = {};

        // 각 학생의 과거 출결 패턴 조회
        // 기술문서 5-2: KST 기준 날짜 처리
        const dateFrom = toKST(selectedDate).subtract(30, 'day').format('YYYY-MM-DD');

        for (const student of filteredStudents) {
          try {
            // 학생의 과거 출결 데이터 조회
            const pastLogsResponse = await apiClient.get<AttendanceLog[]>('attendance_logs', {
              filters: {
                student_id: student.id,
                occurred_at: { gte: dateFrom, lte: selectedDate },
                attendance_type: 'check_in',
              },
              limit: 30,
            });

            const pastLogs = pastLogsResponse.data || [];

            if (pastLogs.length > 0) {
              // 출석률 계산
              const presentCount = (pastLogs as unknown as AttendanceLog[]).filter((log: AttendanceLog) => log.status === 'present').length;
              const attendanceRate = presentCount / pastLogs.length;

              // 출석률이 70% 이상이면 출석 예측
              if (attendanceRate >= 0.7) {
                predictions[student.id] = {
                  check_in: true,
                  check_out: false,
                  status: attendanceRate >= 0.9 ? 'present' : 'late',
                };
              }
            }
          } catch (error) {
            // AI 예측 실패 시 해당 학생은 예측값 없음으로 처리 (아키텍처 문서 3.3.2: fallback_on_prediction_failure)
          }
        }

        return predictions;
      } catch (error) {
        // AI 예측 실패 시 빈 객체 반환 (모든 학생 미체크 상태) - 아키텍처 문서 3.3.2: fallback_on_prediction_failure
        return {};
      }
    },
    enabled: filteredStudents.length > 0 && viewMode === 'today',
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  // 전체 로딩 상태 (아키텍처 문서 3.3.3: loading 상태)
  // isLoadingPredictions 정의 이후에 계산해야 함
  const isLoading = isLoadingLogs || isLoadingStudents || isLoadingClasses || isLoadingPredictions;

  // 전체 에러 상태 (아키텍처 문서 3.3.3: error 상태)
  const error = errorLogs || errorStudents || errorClasses;

  // AI 예측값을 초기 상태에 적용 (한 번만 실행)
  useEffect(() => {
    if (!aiPredictions || Object.keys(studentAttendanceStates).length > 0) {
      // 이미 사용자가 수정한 경우 AI 예측값 적용하지 않음
      return;
    }

    if (isLoadingPredictions) return;

    // AI 예측값을 초기 상태로 설정
    const newStates: Record<string, StudentAttendanceState> = {};

    filteredStudents.forEach(student => {
      const prediction = aiPredictions[student.id];
      if (prediction) {
        newStates[student.id] = {
          student_id: student.id,
          check_in: prediction.check_in,
          check_out: prediction.check_out,
          status: prediction.status,
          ai_predicted: true,
          user_modified: false,
        };
      } else {
        // AI 예측이 없는 경우 미체크 상태
        newStates[student.id] = {
          student_id: student.id,
          check_in: false,
          check_out: false,
          status: 'present',
          ai_predicted: false,
          user_modified: false,
        };
      }
    });

    setStudentAttendanceStates(newStates);
  }, [aiPredictions, isLoadingPredictions, filteredStudents]);

  // 선택된 반/날짜 변경 시 상태 초기화
  useEffect(() => {
    setStudentAttendanceStates({});
  }, [selectedClassId, selectedDate]);

  // 출결 필터 스키마 생성 (동적 옵션)
  const attendanceFilterSchema = useMemo(
    () => createAttendanceFilterSchema(students, classes),
    [students, classes]
  );

  // 출결 화면 헤더 필터 스키마 생성 (반 선택, 날짜 선택, 검색)
  const attendanceHeaderFilterSchema = useMemo(
    () => createAttendanceHeaderFilterSchema(todayClasses),
    [todayClasses]
  );

  // Schema Registry 연동 (아키텍처 문서 S3 참조)
  const { data: attendanceHeaderFilterSchemaData } = useSchema(
    'attendance_header_filter',
    attendanceHeaderFilterSchema,
    'filter'
  );

  // Fallback: Registry에서 조회 실패 시 로컬 스키마 사용
  const effectiveHeaderFilterSchema = attendanceHeaderFilterSchemaData || attendanceHeaderFilterSchema;

  // 필터 변경 핸들러
  const handleFilterChange = React.useCallback((filters: Record<string, unknown>) => {
    setFilter({
      date_from: filters.date_from ? String(filters.date_from) : toKST().format('YYYY-MM-DD'),
      date_to: filters.date_to ? String(filters.date_to) : toKST().format('YYYY-MM-DD'),
      student_id: filters.student_id ? String(filters.student_id) : undefined,
      class_id: filters.class_id ? String(filters.class_id) : undefined,
      attendance_type: filters.attendance_type as AttendanceType | undefined,
      status: filters.status as AttendanceStatus | undefined,
    });
  }, []);

  // 출결 생성/삭제
  const createAttendance = useCreateAttendanceLog();
  const deleteAttendance = useDeleteAttendanceLog();


  // 지각/결석 자동 판정 함수
  const determineAttendanceStatus = (
    occurredAt: string | Date,
    classInfo: { start_time: string; day_of_week: string } | undefined,
    lateAfter: number,
    absentAfter: number
  ): { status: AttendanceStatus; attendance_type: AttendanceType } => {
    if (!classInfo) {
      // 반 정보가 없으면 수동 입력값 사용
      return { status: 'present', attendance_type: 'check_in' };
    }

    // 반의 요일 확인
    const dayMap: Record<string, number> = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0,
    };
    const classDayOfWeek = dayMap[classInfo.day_of_week.toLowerCase()];
    const occurredAtKSTForDay = typeof occurredAt === 'string' ? toKST(occurredAt) : toKST(occurredAt.toISOString());
    const occurredDayOfWeek = occurredAtKSTForDay.day();

    // 요일이 맞지 않으면 수동 입력값 사용
    if (classDayOfWeek !== occurredDayOfWeek) {
      return { status: 'present', attendance_type: 'check_in' };
    }

    // 반 시작 시간 파싱
    const [startHour, startMinute] = classInfo.start_time.split(':').map(Number);
    const occurredAtKST = typeof occurredAt === 'string' ? toKST(occurredAt) : toKST(occurredAt.toISOString());
    const classStartTime = occurredAtKST.hour(startHour).minute(startMinute).second(0).millisecond(0);

    // 시간 차이 계산 (분)
    const diffMinutes = occurredAtKST.diff(classStartTime, 'minute');

    // 자동 판정
    if (diffMinutes <= 0) {
      return { status: 'present', attendance_type: 'check_in' };
    } else if (diffMinutes <= lateAfter) {
      return { status: 'late', attendance_type: 'late' };
    } else if (diffMinutes <= absentAfter) {
      return { status: 'late', attendance_type: 'late' };
    } else {
      return { status: 'absent', attendance_type: 'absent' };
    }
  };

  // QR 스캐너 video 요소 연결
  useEffect(() => {
    if (videoRef && stream) {
      videoRef.srcObject = stream;
      videoRef.play().catch(() => {
        // 비디오 재생 실패 시 무시 (카메라 권한 문제 등)
      });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoRef, stream]);

  // 출결 설정은 환경설정 > 출결 설정으로 이동 (아키텍처 문서 3.3.7, 1716줄)
  // handleSaveSettings 함수 제거됨

  // 출결 기록 생성
  const handleCreateAttendance = async (data: Record<string, unknown>) => {
    if (!data.student_id) {
      showAlert('학생을 선택해주세요.', '입력 오류', 'warning');
      return;
    }

    try {
      const occurredAtKST = toKST(data.occurred_at as string | number | Date);
      const classInfo = data.class_id
        ? classes?.find(c => c.id === data.class_id)
        : undefined;

      // 자동 판정 (반 정보가 있고 등원인 경우)
      let finalStatus = data.status;
      let finalType = data.attendance_type;

      if (data.attendance_type === 'check_in' && classInfo) {
        const autoDetermined = determineAttendanceStatus(
          occurredAtKST.toISOString(),
          classInfo,
          attendanceConfig.late_after,
          attendanceConfig.absent_after
        );
        finalStatus = autoDetermined.status;
        finalType = autoDetermined.attendance_type;
      }

      await createAttendance.mutateAsync({
        student_id: String(data.student_id ?? ''),
        class_id: data.class_id ? String(data.class_id) : undefined,
        occurred_at: occurredAtKST.toISOString(),
        attendance_type: finalType as AttendanceType,
        status: finalStatus as AttendanceStatus,
        notes: data.notes ? String(data.notes) : undefined,
      });

      // [문서 요구사항] 알림 발송은 서버에서 자동 처리됨 (core-notification → 학부모 알림)
      // 클라이언트에서는 알림 발송 로직을 제거하고, 서버에서 설정에 따라 자동 발송

      setShowCreateForm(false);
    } catch (error) {
      showAlert(
        `출결 기록 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '오류',
        'error'
      );
    }
  };

  // 출결 스키마 생성 (동적 옵션)
  const attendanceSchema = useMemo(
    () => createAttendanceFormSchema(students, classes),
    [students, classes]
  );

  // QR 스캐너 시작
  const handleStartQRScanner = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // 후면 카메라 우선
      });
      setStream(mediaStream);
      setShowQRScanner(true);
      setQrScanning(true);
    } catch (error) {
      showAlert('카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해주세요.', '권한 필요', 'warning');
    }
  };

  // QR 스캐너 종료
  const handleStopQRScanner = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowQRScanner(false);
    setQrScanning(false);
    if (videoRef) {
      videoRef.srcObject = null;
    }
    // QR 스캔 완료 후 QR 탭에 머물러 있음 (아키텍처 문서 3.3.5: QR 출결 실행은 별도 화면)
  };

  // QR 코드 스캔 처리 (간단한 텍스트 입력으로 대체)
  const handleQRScan = async (qrData: string) => {
    try {
      // QR 코드 형식: student_id 또는 JSON {student_id, class_id}
      let studentId: string;
      let classId: string | undefined;

      try {
        const parsed = JSON.parse(qrData);
        studentId = parsed.student_id;
        classId = parsed.class_id;
      } catch {
        // JSON이 아니면 student_id로 간주
        studentId = qrData;
      }

      const student = students?.find((s) => s.id === studentId);
      if (!student) {
        showAlert('등록되지 않은 학생입니다.', '알림', 'warning');
        return;
      }

      // 출결 기록 생성 (QR 스캔 시 즉시 기록)
      const nowKST = toKST();
      await handleCreateAttendance({
        student_id: studentId,
        class_id: classId,
        occurred_at: nowKST.format('YYYY-MM-DDTHH:mm'),
        attendance_type: 'check_in',
        status: 'present',
      });

      handleStopQRScanner();
      showAlert(`${student.name}님의 등원이 기록되었습니다.`, '출결 기록 완료', 'success');
    } catch (error) {
      showAlert('QR 코드를 인식할 수 없습니다.', 'QR 스캔 오류', 'error');
    }
  };

  // 통계/히트맵/패턴 분석 기능은 통계 또는 AI 인사이트 메뉴로 이동 (아키텍처 문서 3.3.8)
  // calculateStatistics, analyzeDayPattern, analyzeTimePattern, calculateClassHeatmap, detectAbnormalAttendance 함수 제거됨

  // 출석부 출력
  const handlePrintAttendance = () => {
    try {
      // 출결 기록 확인
      if (!attendanceLogs) {
        showAlert('출결 기록을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', '알림', 'info');
        return;
      }

      if (attendanceLogs.length === 0) {
        showAlert('출력할 출결 기록이 없습니다.\n\n먼저 "출결 기록" 버튼을 클릭하여 출결 기록을 추가해주세요.', '알림', 'info');
        return;
      }

      // 학생 정보 확인
      if (!students) {
        showAlert('학생 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.', '알림', 'info');
        return;
      }

      if (students.length === 0) {
        showAlert('학생 정보가 없습니다.\n\n먼저 학생을 등록해주세요.', '알림', 'info');
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showAlert('팝업이 차단되어 있습니다. 브라우저 설정에서 팝업을 허용해주세요.', '팝업 차단', 'warning');
        return;
      }

      const dateStr = filter.date_from === filter.date_to
        ? filter.date_from
        : `${filter.date_from} ~ ${filter.date_to}`;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>출석부 - ${dateStr}</title>
            <style>
              body { font-family: 'Malgun Gothic', sans-serif; padding: var(--spacing-xl); }
              h1 { text-align: center; margin-bottom: var(--spacing-2xl); }
              table { width: 100%; border-collapse: collapse; margin-top: var(--spacing-xl); }
              th, td { border: var(--border-width-thin) solid var(--color-border); padding: var(--spacing-xs); text-align: left; }
              th { background-color: var(--color-gray-50); font-weight: var(--font-weight-semibold); }
              @media print { @page { margin: var(--print-page-margin); } }
            </style>
          </head>
          <body>
            <h1>출석부</h1>
            <p><strong>기간:</strong> ${dateStr}</p>
            <table>
              <thead>
                <tr>
                  <th>날짜/시간</th>
                  <th>학생명</th>
                  <th>반</th>
                  <th>타입</th>
                  <th>상태</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                ${attendanceLogs.map(log => {
                  const student = students?.find((s) => s.id === log.student_id);
                  const classInfo = classes?.find((c) => c.id === log.class_id);
                  const occurredDateKST = toKST(log.occurred_at);
                  const dateStr = occurredDateKST.format('YYYY-MM-DD');
                  const timeStr = occurredDateKST.format('HH:mm');
                  const typeStr = log.attendance_type === 'check_in' ? '등원' : log.attendance_type === 'check_out' ? '하원' : log.attendance_type === 'late' ? '지각' : '결석';
                  const statusStr = log.status === 'present' ? '출석' : log.status === 'late' ? '지각' : log.status === 'absent' ? '결석' : '사유';

                  return `
                    <tr>
                      <td>${dateStr} ${timeStr}</td>
                      <td>${student?.name || '알 수 없음'}</td>
                      <td>${classInfo?.name || '-'}</td>
                      <td>${typeStr}</td>
                      <td>${statusStr}</td>
                      <td>${(log.notes || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();

      // 인쇄 대화상자 열기 (약간의 지연 후)
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (printError) {
          showAlert('인쇄 대화상자를 열 수 없습니다. 새 창에서 직접 인쇄해주세요.', '인쇄 오류', 'warning');
        }
      }, 100);
    } catch (error) {
      showAlert(
        `출석부 출력 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '오류',
        'error'
      );
    }
  };

  // 출결 기록 삭제 (아키텍처 문서 2.3: Assistant는 수정 권한 없음)
  const handleDeleteAttendance = async (logId: string) => {
    // 역할별 권한 체크
    if (!canModifyAttendance) {
      showAlert('출결 수정 권한이 없습니다. Teacher 또는 Admin에게 요청해주세요.', '권한 없음', 'warning');
      return;
    }

    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '삭제 확인');
    if (!confirmed) {
      return;
    }

    try {
      await deleteAttendance.mutateAsync(logId);
    } catch (error) {
      showAlert(
        `출결 기록 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '오류',
        'error'
      );
    }
  };

  // 출결 상태 뱃지 색상
  const getStatusBadgeColor = (status: AttendanceStatus): ColorToken => {
    switch (status) {
      case 'present':
        return 'success';
      case 'late':
        return 'warning';
      case 'absent':
        return 'error';
      case 'excused':
        return 'info';
      default:
        return 'secondary';
    }
  };

  // 출결 타입 뱃지 색상
  const getTypeBadgeColor = (type: AttendanceType): ColorToken => {
    switch (type) {
      case 'check_in':
        return 'success';
      case 'check_out':
        return 'info';
      case 'late':
        return 'warning';
      case 'absent':
        return 'error';
      default:
        return 'secondary';
    }
  };

  // 출결 저장 핸들러
  const handleSaveAttendance = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const attendanceRecords = Object.values(studentAttendanceStates)
        .filter(state => state.check_in || state.check_out)
        .map(state => ({
          student_id: state.student_id,
          class_id: selectedClassId || undefined,
          occurred_at: toKST(selectedDate).format('YYYY-MM-DDTHH:mm'),
          attendance_type: (state.check_in ? 'check_in' : 'check_out') as AttendanceType,
          status: state.status,
        }));

      // 출결 기록 생성 (아키텍처 문서 3.3.3: 출결 저장)
      for (const record of attendanceRecords) {
        await createAttendance.mutateAsync(record);
      }

      // Success 상태 (아키텍처 문서 3.3.3: success 상태 - 2초 후 자동 닫기)
      showAlert('출결 정보가 저장되었습니다.', '성공', 'success');
      setStudentAttendanceStates({});

      // 2초 후 자동으로 데이터 새로고침 (아키텍처 문서 3.3.3: auto_close_duration: 2000)
      setTimeout(() => {
        // 출결 상태 초기화 및 화면 유지 (아키텍처 문서 3.3.3: on_auto_close: 'refresh_data')
        // 이미 setStudentAttendanceStates({})로 초기화했으므로 추가 작업 불필요
      }, 2000);
    } catch (error) {
      showAlert('출결 저장에 실패했습니다.', '오류', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [studentAttendanceStates, selectedClassId, selectedDate, isSaving, createAttendance, showAlert]);

  // 일괄 등원/하원 핸들러
  const handleBulkCheckIn = useCallback(() => {
    const newStates = { ...studentAttendanceStates };
    filteredStudents.forEach(student => {
      if (!newStates[student.id]) {
        newStates[student.id] = {
          student_id: student.id,
          check_in: true,
          check_out: false,
          status: 'present',
          ai_predicted: false,
          user_modified: true,
        };
      } else {
        newStates[student.id] = {
          ...newStates[student.id],
          check_in: true,
          user_modified: true,
        };
      }
    });
    setStudentAttendanceStates(newStates);
  }, [filteredStudents, studentAttendanceStates]);

  const handleBulkCheckOut = useCallback(() => {
    const newStates = { ...studentAttendanceStates };
    filteredStudents.forEach(student => {
      if (!newStates[student.id]) {
        newStates[student.id] = {
          student_id: student.id,
          check_in: false,
          check_out: true,
          status: 'present',
          ai_predicted: false,
          user_modified: true,
        };
      } else {
        newStates[student.id] = {
          ...newStates[student.id],
          check_out: true,
          user_modified: true,
        };
      }
    });
    setStudentAttendanceStates(newStates);
  }, [filteredStudents, studentAttendanceStates]);

  // 출결 요약 통계
  const attendanceSummary = useMemo(() => {
    const states = Object.values(studentAttendanceStates);
    const total = filteredStudents.length;
    const present = states.filter(s => s.check_in && s.status === 'present').length;
    const late = states.filter(s => s.check_in && s.status === 'late').length;
    const absent = states.filter(s => s.status === 'absent').length;
    return { total, present, late, absent };
  }, [studentAttendanceStates, filteredStudents]);

  // 탭 아이템 (아키텍처 문서 3.3.1: "오늘 출결하기"와 "QR 출결 실행" 두 개만)
  // QR 출결은 설정 활성화 시에만 표시 (아키텍처 문서 1700-1701줄)
  const qrEnabled = config?.attendance?.qr_enabled ?? false;
  const tabItems: TabItem[] = [
    { key: 'today', label: '오늘 출결하기', content: null },
    ...(qrEnabled ? [{ key: 'qr', label: 'QR 출결 실행', content: null }] : []),
  ];

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        {/* 아키텍처 문서 3.3.9: 태블릿 모드 제목 최소 24px */}
        <PageHeader
          title="출결 관리"
          style={{
            ...(isTablet && {
              fontSize: 'max(var(--font-size-2xl), var(--tablet-font-size-title-min))',
            }),
          }}
        />

        {/* 탭 메뉴 */}
        <Tabs
          items={tabItems}
          activeKey={viewMode}
          onChange={(key) => setViewMode(key as 'today' | 'qr')}
          style={{ marginBottom: 'var(--spacing-md)' }}
        />

          {/* 오늘 출결하기 화면 */}
          {viewMode === 'today' && (
            <>
              {/* AttendanceHeader: 반 선택, 날짜 선택, 검색 (아키텍처 문서 3.3.3) - SchemaFilter 사용 */}
              <div style={{ pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
                <SchemaFilter
                  schema={effectiveHeaderFilterSchema}
                  onFilterChange={(filters: Record<string, unknown>) => {
                    setSelectedClassId(filters.class_id ? String(filters.class_id) : null);
                    setSelectedDate(filters.date ? String(filters.date) : toKST().format('YYYY-MM-DD'));
                    setSearchQuery(filters.search ? String(filters.search) : '');
                  }}
                  defaultValues={{
                    class_id: selectedClassId || '',
                    date: selectedDate,
                    search: searchQuery,
                  }}
                />
              </div>

              {/* AttendanceStudentList: 학생 리스트 + 체크박스 UI (아키텍처 문서 3.3.3: Header 다음에 StudentList) */}
              {/* 모바일: Bottom Action Bar를 위한 하단 패딩 추가 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
                paddingBottom: isMobile ? 'var(--spacing-bottom-action-bar)' : '0', // Bottom Action Bar 높이만큼 패딩
              }}>
                {/* 로딩 상태 (아키텍처 문서 3.3.3: loading 상태) */}
                {isLoading && (
                  <Card padding="md" variant="default">
                    <div style={{
                      textAlign: 'center',
                      padding: 'var(--spacing-xl)',
                      pointerEvents: 'none',
                      opacity: 'var(--opacity-secondary)'
                    }}>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--spacing-md)'
                      }}>
                        출결 정보를 불러오는 중...
                      </div>
                      {/* 스켈레톤 UI (아키텍처 문서 3.3.3: show_skeleton: true) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {[1, 2, 3].map(i => (
                          <div
                            key={i}
                            style={{
                              height: 'var(--spacing-bottom-action-bar)',
                              backgroundColor: 'var(--color-gray-100)',
                              borderRadius: 'var(--border-radius-md)',
                              opacity: 'var(--opacity-secondary)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </Card>
                )}

                {/* 에러 상태 (아키텍처 문서 3.3.3: error 상태) */}
                {!isLoading && error && (
                  <Card padding="md" variant="outlined">
                    <div style={{
                      textAlign: 'center',
                      padding: 'var(--spacing-lg)',
                      color: 'var(--color-error)'
                    }}>
                      <div style={{
                        fontWeight: 'var(--font-weight-semibold)',
                        marginBottom: 'var(--spacing-md)'
                      }}>
                        출결 정보를 불러올 수 없습니다.
                      </div>
                      <div style={{
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--spacing-md)'
                      }}>
                        {error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // 데이터 재조회를 위해 쿼리 무효화 및 재시도
                          window.location.reload();
                        }}
                      >
                        다시 시도
                      </Button>
                    </div>
                  </Card>
                )}

                {/* 정상 상태: 학생 리스트 */}
                {!isLoading && !error && filteredStudents.length === 0 && (
                  <Card padding="md" variant="outlined">
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      오늘 수업 학생이 없습니다.
                    </div>
                  </Card>
                )}
                {!isLoading && !error && filteredStudents.length > 0 && (
                  // 아키텍처 문서 3.3.9: 태블릿 모드에서는 학생 리스트를 2열 그리드로 표시
                  isTablet ? (
                    <Grid
                      columns={{
                        md: 2, // 태블릿: 2열 그리드 (아키텍처 문서 419줄)
                      }}
                      gap="md"
                    >
                      {filteredStudents.map(student => {
                    const state = studentAttendanceStates[student.id] || {
                      student_id: student.id,
                      check_in: false,
                      check_out: false,
                      status: 'present' as AttendanceStatus,
                      ai_predicted: false,
                      user_modified: false,
                    };

                    // 학생 정보 확장 (아키텍처 문서 3.3.3: 학년/반, 사진 표시)
                    const studentWithExtras = student as Student & { primary_class_name?: string };
                    const studentGrade = student.grade ? `${student.grade}학년` : '';
                    const studentClass = studentWithExtras.primary_class_name || '';
                    const gradeClassInfo = [studentGrade, studentClass].filter(Boolean).join(' ');

                    return (
                      <Card key={student.id} padding="md" variant="default">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                          {/* StudentInfo: 이름, 학년/반, 사진 (아키텍처 문서 3.3.3) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: 'var(--width-student-info-min)' }}>
                            {/* 사진 (선택) */}
                            {student.profile_image_url && (
                              <img
                                src={student.profile_image_url}
                                alt={student.name}
                                style={{
                                  width: 'var(--spacing-xl)',
                                  height: 'var(--spacing-xl)',
                                  borderRadius: 'var(--border-radius-full)',
                                  objectFit: 'cover',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              {/* 아키텍처 문서 3.3.9: 태블릿 모드 기본 텍스트 최소 16px */}
                              <div style={{
                                fontSize: isTablet ? 'max(var(--font-size-lg), var(--tablet-font-size-text-min))' : 'var(--font-size-lg)',
                                fontWeight: 'var(--font-weight-semibold)',
                                marginBottom: 'var(--spacing-xs)'
                              }}>
                                {student.name}
                              </div>
                              {gradeClassInfo && (
                                <div style={{
                                  fontSize: isTablet ? 'max(var(--font-size-sm), var(--tablet-font-size-text-min))' : 'var(--font-size-sm)',
                                  color: 'var(--color-text-secondary)',
                                  marginBottom: 'var(--spacing-xs)'
                                }}>
                                  {gradeClassInfo}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AttendanceStatus: 등원 체크박스, 하원 체크박스, 지각/결석 배지, AI 예측 표시 (아키텍처 문서 3.3.3) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                              <Checkbox
                                checked={state.check_in}
                                onChange={(e) => {
                                  setStudentAttendanceStates(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...state,
                                      check_in: e.target.checked,
                                      user_modified: true, // 사용자 입력 시 AI 데이터 override
                                      ai_predicted: false, // 사용자 수정 시 AI 예측 플래그 제거
                                    },
                                  }));
                                }}
                              />
                              <span>등원</span>
                              {state.ai_predicted && !state.user_modified && (
                                <Badge variant="soft" color="info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                  AI 예측
                                </Badge>
                              )}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                              <Checkbox
                                checked={state.check_out}
                                onChange={(e) => {
                                  setStudentAttendanceStates(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...state,
                                      check_out: e.target.checked,
                                      user_modified: true, // 사용자 입력 시 AI 데이터 override
                                      ai_predicted: false, // 사용자 수정 시 AI 예측 플래그 제거
                                    },
                                  }));
                                }}
                              />
                              <span>하원</span>
                            </label>
                            {/* 지각/결석 배지 (아키텍처 문서 3.3.3) */}
                            {state.status === 'late' && (
                              <Badge variant="solid" color="warning">지각</Badge>
                            )}
                            {state.status === 'absent' && (
                              <Badge variant="solid" color="error">결석</Badge>
                            )}
                            {state.status === 'excused' && (
                              <Badge variant="solid" color="info">사유</Badge>
                            )}
                            {/* 상태 변경 Select (배지와 함께 사용) */}
                            <Select
                              value={state.status}
                              onChange={(value) => {
                                setStudentAttendanceStates(prev => ({
                                  ...prev,
                                  [student.id]: {
                                    ...state,
                                    status: (Array.isArray(value) ? value[0] : value) as AttendanceStatus,
                                    user_modified: true, // 사용자 입력 시 AI 데이터 override
                                    ai_predicted: false, // 사용자 수정 시 AI 예측 플래그 제거
                                  },
                                }));
                              }}
                              style={{ minWidth: 'var(--width-grid-column)' }}
                            >
                              <option value="present">출석</option>
                              <option value="late">지각</option>
                              <option value="absent">결석</option>
                              <option value="excused">사유</option>
                            </Select>
                          </div>

                          {/* ActionButtons: 등원 버튼, 하원 버튼, 상세 보기 버튼 (아키텍처 문서 3.3.3) */}
                          {/* 아키텍처 문서 3.3.9: 태블릿 모드에서는 큰 터치 버튼 (등원/하원 버튼 최소 80px × 80px) */}
                          {/* 아키텍처 문서 3.3.9: 태블릿 모드 버튼 간 간격 최소 8px */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: isTablet ? 'max(var(--spacing-sm), var(--tablet-spacing-min))' : 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                            <Button
                              variant="outline"
                              size={isTablet ? 'lg' : 'sm'}
                              onClick={() => {
                                setStudentAttendanceStates(prev => ({
                                  ...prev,
                                  [student.id]: {
                                    ...state,
                                    check_in: !state.check_in,
                                    user_modified: true,
                                    ai_predicted: false,
                                  },
                                }));
                              }}
                              style={isTablet ? {
                                minWidth: 'var(--spacing-bottom-action-bar)',
                                minHeight: 'var(--spacing-bottom-action-bar)',
                                fontSize: 'max(var(--font-size-lg), var(--tablet-font-size-button-min))', // 아키텍처 문서 3.3.9: 버튼 텍스트 최소 18px
                              } : undefined}
                            >
                              등원
                            </Button>
                            <Button
                              variant="outline"
                              size={isTablet ? 'lg' : 'sm'}
                              onClick={() => {
                                setStudentAttendanceStates(prev => ({
                                  ...prev,
                                  [student.id]: {
                                    ...state,
                                    check_out: !state.check_out,
                                    user_modified: true,
                                    ai_predicted: false,
                                  },
                                }));
                              }}
                              style={isTablet ? {
                                minWidth: 'var(--spacing-bottom-action-bar)',
                                minHeight: 'var(--spacing-bottom-action-bar)',
                                fontSize: 'max(var(--font-size-lg), var(--tablet-font-size-button-min))', // 아키텍처 문서 3.3.9: 버튼 텍스트 최소 18px
                              } : undefined}
                            >
                              하원
                            </Button>
                            <Button
                              variant="ghost"
                              size={isTablet ? 'md' : 'sm'}
                              onClick={() => navigate(`/students/${student.id}`)}
                              style={isTablet ? {
                                minWidth: 'var(--spacing-xl)',
                                minHeight: 'var(--spacing-xl)',
                              } : undefined}
                            >
                              상세
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                    </Grid>
                  ) : (
                    // 모바일/PC: 1열 리스트 형태 (아키텍처 문서 431줄: Mobile 1열, 408줄: PC 테이블 형태는 출결 화면에서는 카드 사용)
                    filteredStudents.map(student => {
                      const state = studentAttendanceStates[student.id] || {
                        student_id: student.id,
                        check_in: false,
                        check_out: false,
                        status: 'present' as AttendanceStatus,
                        ai_predicted: false,
                        user_modified: false,
                      };

                      // 학생 정보 확장 (아키텍처 문서 3.3.3: 학년/반, 사진 표시)
                      const studentWithExtras = student as Student & { primary_class_name?: string };
                      const studentGrade = student.grade ? `${student.grade}학년` : '';
                      const studentClass = studentWithExtras.primary_class_name || '';
                      const gradeClassInfo = [studentGrade, studentClass].filter(Boolean).join(' ');

                      return (
                        <Card key={student.id} padding="md" variant="default">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                            {/* StudentInfo: 이름, 학년/반, 사진 (아키텍처 문서 3.3.3) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: 'var(--width-student-info-min)' }}>
                              {/* 사진 (선택) */}
                              {student.profile_image_url && (
                                <img
                                  src={student.profile_image_url}
                                  alt={student.name}
                                  style={{
                                    width: 'var(--spacing-xl)',
                                    height: 'var(--spacing-xl)',
                                    borderRadius: 'var(--border-radius-full)',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                                  {student.name}
                                </div>
                                {gradeClassInfo && (
                                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                                    {gradeClassInfo}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* AttendanceStatus: 등원 체크박스, 하원 체크박스, 지각/결석 배지, AI 예측 표시 (아키텍처 문서 3.3.3) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                                <Checkbox
                                  checked={state.check_in}
                                  onChange={(e) => {
                                    setStudentAttendanceStates(prev => ({
                                      ...prev,
                                      [student.id]: {
                                        ...state,
                                        check_in: e.target.checked,
                                        user_modified: true, // 사용자 입력 시 AI 데이터 override
                                        ai_predicted: false, // 사용자 수정 시 AI 예측 플래그 제거
                                      },
                                    }));
                                  }}
                                />
                                <span>등원</span>
                                {state.ai_predicted && !state.user_modified && (
                                  <Badge variant="soft" color="info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                    AI 예측
                                  </Badge>
                                )}
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                                <Checkbox
                                  checked={state.check_out}
                                  onChange={(e) => {
                                    setStudentAttendanceStates(prev => ({
                                      ...prev,
                                      [student.id]: {
                                        ...state,
                                        check_out: e.target.checked,
                                        user_modified: true, // 사용자 입력 시 AI 데이터 override
                                        ai_predicted: false, // 사용자 수정 시 AI 예측 플래그 제거
                                      },
                                    }));
                                  }}
                                />
                                <span>하원</span>
                              </label>
                              {/* 지각/결석 배지 (아키텍처 문서 3.3.3) */}
                              {state.status === 'late' && (
                                <Badge variant="solid" color="warning">지각</Badge>
                              )}
                              {state.status === 'absent' && (
                                <Badge variant="solid" color="error">결석</Badge>
                              )}
                              {state.status === 'excused' && (
                                <Badge variant="solid" color="info">사유</Badge>
                              )}
                              {/* 상태 변경 Select (배지와 함께 사용) */}
                              <Select
                                value={state.status}
                                onChange={(value) => {
                                  setStudentAttendanceStates(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...state,
                                      status: (Array.isArray(value) ? value[0] : value) as AttendanceStatus,
                                      user_modified: true, // 사용자 입력 시 AI 데이터 override
                                      ai_predicted: false, // 사용자 수정 시 AI 예측 플래그 제거
                                    },
                                  }));
                                }}
                                style={{ minWidth: 'var(--width-grid-column)' }}
                              >
                                <option value="present">출석</option>
                                <option value="late">지각</option>
                                <option value="absent">결석</option>
                                <option value="excused">사유</option>
                              </Select>
                            </div>

                            {/* ActionButtons: 등원 버튼, 하원 버튼, 상세 보기 버튼 (아키텍처 문서 3.3.3) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStudentAttendanceStates(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...state,
                                      check_in: !state.check_in,
                                      user_modified: true,
                                      ai_predicted: false,
                                    },
                                  }));
                                }}
                              >
                                등원
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStudentAttendanceStates(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...state,
                                      check_out: !state.check_out,
                                      user_modified: true,
                                      ai_predicted: false,
                                    },
                                  }));
                                }}
                              >
                                하원
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/students/${student.id}`)}
                              >
                                상세
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )
                )}
              </div>

              {/* AttendanceSummary: 총원/출석/지각/결석 (아키텍처 문서 3.3.3: StudentList 다음에 Summary) */}
              <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)', pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(var(--width-button-grid-min), 1fr))`, gap: 'var(--spacing-md)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                      총원
                    </div>
                    <div style={{ fontSize: isTablet ? 'max(var(--font-size-2xl), var(--tablet-font-size-title-min))' : 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                      {attendanceSummary.total}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                      출석
                    </div>
                    <div style={{ fontSize: isTablet ? 'max(var(--font-size-2xl), var(--tablet-font-size-title-min))' : 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                      {attendanceSummary.present}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                      지각
                    </div>
                    <div style={{ fontSize: isTablet ? 'max(var(--font-size-2xl), var(--tablet-font-size-title-min))' : 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
                      {attendanceSummary.late}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                      결석
                    </div>
                    <div style={{ fontSize: isTablet ? 'max(var(--font-size-2xl), var(--tablet-font-size-title-min))' : 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                      {attendanceSummary.absent}
                    </div>
                  </div>
                </div>
              </Card>

              {/* AttendanceActions: 일괄 등원/하원/저장 버튼 (아키텍처 문서 3.3.3: Summary 다음에 Actions) */}
              {/* 모바일: Bottom Action Bar, 태블릿/데스크톱: Card */}
              {/* 아키텍처 문서 3.3.9: 태블릿 모드에서는 큰 터치 버튼 (최소 120px × 60px) */}
              {isMobile ? (
                <BottomActionBar style={{ pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkCheckIn}
                    disabled={isSaving || isLoading}
                  >
                    일괄 등원
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkCheckOut}
                    disabled={isSaving || isLoading}
                  >
                    일괄 하원
                  </Button>
                  <div style={{ flex: 1 }} />
                  <Button
                    variant="solid"
                    color="primary"
                    size="sm"
                    onClick={handleSaveAttendance}
                    disabled={isSaving || isLoading}
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </Button>
                </BottomActionBar>
              ) : (
                <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)', pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
                  <div style={{ display: 'flex', gap: isTablet ? 'max(var(--spacing-md), var(--tablet-spacing-min))' : 'var(--spacing-sm)', flexWrap: 'wrap' }}> {/* 아키텍처 문서 3.3.9: 버튼 간 간격 최소 8px */}
                    <Button
                      variant="outline"
                      size={isTablet ? 'lg' : 'md'}
                      onClick={handleBulkCheckIn}
                      disabled={isSaving || isLoading}
                      style={isTablet ? {
                        minWidth: 'var(--width-button-min)',
                        minHeight: 'var(--height-button-min)',
                        fontSize: 'max(var(--font-size-lg), var(--tablet-font-size-button-min))', // 아키텍처 문서 3.3.9: 버튼 텍스트 최소 18px
                      } : undefined}
                    >
                      일괄 등원
                    </Button>
                    <Button
                      variant="outline"
                      size={isTablet ? 'lg' : 'md'}
                      onClick={handleBulkCheckOut}
                      disabled={isSaving || isLoading}
                      style={isTablet ? {
                        minWidth: 'var(--width-button-min)',
                        minHeight: 'var(--height-button-min)',
                        fontSize: 'max(var(--font-size-lg), var(--tablet-font-size-button-min))', // 아키텍처 문서 3.3.9: 버튼 텍스트 최소 18px
                      } : undefined}
                    >
                      일괄 하원
                    </Button>
                    <div style={{ flex: 1 }} />
                    {/* 통계 기능은 통계 또는 AI 인사이트 메뉴로 이동 (아키텍처 문서 3.3.8) */}
                    <Button
                      variant="solid"
                      color="primary"
                      size={isTablet ? 'lg' : 'md'}
                      onClick={handleSaveAttendance}
                      disabled={isSaving || isLoading}
                      style={isTablet ? {
                        minWidth: 'var(--width-button-min)',
                        minHeight: 'var(--height-button-min)',
                        fontSize: 'max(var(--font-size-lg), var(--tablet-font-size-button-min))', // 아키텍처 문서 3.3.9: 버튼 텍스트 최소 18px
                      } : undefined}
                    >
                      {isSaving ? '저장 중...' : '저장'}
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* QR 출결 실행 화면 (아키텍처 문서 3.3.1: 설정 활성화 시에만 표시) */}
          {viewMode === 'qr' && (
            <>
              {/* QR 스캐너 */}
              {!showQRScanner && (
                <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                      QR 출결 실행
                    </h3>
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                      QR 코드를 스캔하여 출결을 기록합니다.
                    </p>
                    <Button
                      variant="solid"
                      color="primary"
                      onClick={handleStartQRScanner}
                      size="lg"
                      style={{ minWidth: 'var(--width-student-info-min)' }}
                    >
                      QR 스캔 시작
                    </Button>
                  </div>
                </Card>
              )}

              {/* QR 스캐너 모달 */}
              {showQRScanner && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>QR 출결</h3>
                <Button variant="ghost" size="sm" onClick={handleStopQRScanner}>
                  닫기
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                <div style={{
                  width: '100%',
                  maxWidth: 'var(--width-drawer-tablet)',
                  aspectRatio: 'var(--aspect-ratio-square)',
                  backgroundColor: 'var(--color-gray-900)',
                  borderRadius: 'var(--border-radius-md)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <video
                    ref={setVideoRef}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    playsInline
                    autoPlay
                    muted
                  />
                  {qrScanning && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'var(--transform-center)',
                      width: 'var(--width-student-info-min)',
                      height: 'var(--width-student-info-min)',
                      border: `var(--border-width-base) solid var(--color-white)`,
                      borderRadius: 'var(--border-radius-md)',
                      pointerEvents: 'none'
                    }} />
                  )}
                </div>
                <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                  QR 코드를 카메라에 맞춰주세요
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', width: '100%', maxWidth: 'var(--width-drawer-tablet)' }}>
                  <Input
                    placeholder="QR 코드를 스캔하거나 학생 ID를 직접 입력하세요"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value) {
                          handleQRScan(value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                    fullWidth
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.querySelector('input[placeholder*="QR 코드"]') as HTMLInputElement;
                      if (input?.value.trim()) {
                        handleQRScan(input.value.trim());
                        input.value = '';
                      }
                    }}
                    fullWidth
                  >
                    확인
                  </Button>
                </div>
              </div>
            </Card>
          )}

        {/* 통계/히트맵/패턴 분석 기능은 통계 또는 AI 인사이트 메뉴로 이동 (아키텍처 문서 3.3.8) */}
          </>
        )}

      </Container>
    </ErrorBoundary>
  );
}

