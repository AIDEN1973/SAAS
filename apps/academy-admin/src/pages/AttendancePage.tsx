/**
 * 출결 관리 페이지
 *
 * [LAYER: UI_PAGE]
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

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ErrorBoundary, Container, Card, Button, Badge, Select, useModal, BottomActionBar, PageHeader, useResponsiveMode, isMobile, isTablet, NotificationCardLayout, DataTable, SubSidebar, EmptyState } from '@ui-core/react';
import { CardGridLayout } from '../components/CardGridLayout';
import { Users, UserCheck, Clock, UserX, CalendarCheck, History, BarChart3, Settings, CheckCircle, Smartphone, TrendingUp, Bell } from 'lucide-react';
import { ATTENDANCE_SUB_MENU_ITEMS, DEFAULT_ATTENDANCE_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { AttendanceSubMenuId } from '../constants';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAttendanceLogs, useUpsertAttendanceLog } from '@hooks/use-attendance';
import { useStudents } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { AttendanceFilter, AttendanceStatus, AttendanceLog, CreateAttendanceLogInput } from '@services/attendance-service';
import type { Student, StudentClass } from '@services/student-service';
import { toKST } from '@lib/date-utils';
// import { useUserRole } from '@hooks/use-auth'; // TODO: 권한 체크 구현 시 사용
import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useConfig, useUpdateConfig } from '@hooks/use-config';

// 학생 출결 상태 인터페이스
interface StudentAttendanceState {
  student_id: string;
  check_in: boolean;
  check_out: boolean;
  status: AttendanceStatus;
  check_in_time?: string; // [시간 기록 중심] 등원 시간 (HH:mm 형식)
  check_out_time?: string; // [시간 기록 중심] 하원 시간 (HH:mm 형식)
  ai_predicted?: boolean; // AI 예측값 여부
  user_modified?: boolean; // 사용자가 수정했는지 여부 (사용자 입력 시 AI 데이터 override)
  manual_status_override?: boolean; // [시간 기록 중심] 사용자가 상태를 수동으로 변경했는지 여부
}

export function AttendancePage() {
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  // mode는 'xs' | 'sm' | 'md' | 'lg' | 'xl' 형식이므로 대문자로 변환
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper); // 아키텍처 문서 3.3.9: 태블릿 모드 감지 (768px ~ 1024px)
  // const { data: userRole } = useUserRole(); // TODO: 권한 체크 구현 시 사용
  const terms = useIndustryTerms();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // 역할별 권한 체크 (아키텍처 문서 2.3, 498-507줄)
  // Assistant: 출결 입력만 가능, 수정 권한 없음
  // Teacher: 출결 입력 및 수정 모두 가능
  // const canModifyAttendance = userRole !== 'assistant'; // TODO: 권한 체크 구현 시 사용


  // 오늘 출결하기 관련 상태
  // localStorage 기반 상태 초기화 (마지막 선택 반 기억)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('attendance-page-selected-class');
      // [버그 수정] "all" 또는 빈 문자열은 null로 변환 (유효한 UUID만 허용)
      if (!stored || stored.trim() === '' || stored === 'all') {
        return null;
      }
      return stored;
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('AttendancePage: localStorage 접근 실패, 기본값 사용', { error });
      }
      return null;
    }
  });
  const [selectedDate, setSelectedDate] = useState<string>(toKST().format('YYYY-MM-DD'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [checkInMethodFilter, setCheckInMethodFilter] = useState<string>('');
  const [studentAttendanceStates, setStudentAttendanceStates] = useState<Record<string, StudentAttendanceState>>({});
  const studentAttendanceStatesRef = useRef<Record<string, StudentAttendanceState>>({});
  // 최신 상태를 ref에 동기화 (useEffect 내에서 클로저 문제 방지)
  useEffect(() => {
    studentAttendanceStatesRef.current = studentAttendanceStates;
  }, [studentAttendanceStates]);
  const [isSaving, setIsSaving] = useState(false);

  // 필터 상태 (출결 기록 조회는 Advanced 메뉴로 이동 - 아키텍처 문서에 명시되지 않음)
  const [filter, setFilter] = useState<AttendanceFilter>({
    date_from: toKST().format('YYYY-MM-DD'),
    date_to: toKST().format('YYYY-MM-DD'),
  });


  // 통계/히트맵 기능은 통계 또는 AI 인사이트 메뉴로 이동 (아키텍처 문서 3.3.8)
  // const [showStatistics, setShowStatistics] = useState(false);

  // 출결 설정은 환경설정 > 출결 설정으로 이동 (아키텍처 문서 1716줄)
  // const [showSettings, setShowSettings] = useState(false);
  // const { data: config } = useConfig(); // 현재 사용되지 않음

  // 전역 모달 훅 사용
  const { showAlert } = useModal();

  // 출결 설정 조회 및 업데이트
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  void updateConfig; // TODO: 출결 설정 업데이트 기능 구현 시 사용

  // URL 쿼리 파라미터와 연동된 서브 사이드바 상태
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL에서 초기 서브 메뉴 상태 추출
  const validSubMenuIds = ATTENDANCE_SUB_MENU_ITEMS.map(item => item.id) as readonly AttendanceSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl<AttendanceSubMenuId>(
    searchParams,
    validSubMenuIds,
    DEFAULT_ATTENDANCE_SUB_MENU
  );

  // 서브 메뉴 변경 핸들러 (URL 동기화)
  const handleSubMenuChange = useCallback((id: AttendanceSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_ATTENDANCE_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  // 서브 메뉴 아이템에 아이콘 추가
  const subMenuItemsWithIcons = useMemo(() => {
    const iconMap: Record<AttendanceSubMenuId, React.ReactNode> = {
      today: <CalendarCheck size={16} />,
      history: <History size={16} />,
      statistics: <BarChart3 size={16} />,
      settings: <Settings size={16} />,
    };

    return ATTENDANCE_SUB_MENU_ITEMS.map(item => ({
      ...item,
      icon: iconMap[item.id],
    }));
  }, []);


  const handleClassIdChange = useCallback((classId: string | null) => {
    setSelectedClassId(classId);
    try {
      // [버그 수정] "all" 또는 빈 문자열은 저장하지 않음 (유효한 UUID만 저장)
      if (classId && classId.trim() !== '' && classId !== 'all') {
        localStorage.setItem('attendance-page-selected-class', classId);
      } else {
        localStorage.removeItem('attendance-page-selected-class');
      }
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('AttendancePage: localStorage 저장 실패', { error });
      }
    }
  }, []);

  // [P0-FIX] Policy Registry 기반 출결 설정 (Automation Config First 원칙)
  // Fail Closed: Policy가 없으면 지각/결석 판정 불가 (기본값 null)
  // Note: 현재 사용되지 않지만 향후 확장을 위해 유지
  // const _attendanceConfig = useMemo(() => {
  //   const lateAfter = getPolicyValue<number>('ATTENDANCE_LATE_AFTER', config);
  //   const absentAfter = getPolicyValue<number>('ATTENDANCE_ABSENT_AFTER', config);
  //   const autoNotification = getPolicyValue<boolean>('ATTENDANCE_AUTO_NOTIFICATION', config) ?? false;
  //   const notificationChannel = getPolicyValue<string>('ATTENDANCE_NOTIFICATION_CHANNEL', config) ?? 'sms';

  //   return {
  //     late_after: lateAfter,
  //     absent_after: absentAfter,
  //     auto_notification: autoNotification,
  //     notification_channel: notificationChannel as 'sms' | 'kakao_at',
  //   };
  // }, [config]);

  // 출결 기록 상태
  // const [showCreateForm, setShowCreateForm] = useState(false); // (미사용) 출결 기록 수동 생성 UI 도입 시 사용

  // 데이터 조회
  const { data: attendanceLogsData, isLoading: isLoadingLogs, error: errorLogs } = useAttendanceLogs(filter);
  const attendanceLogs: AttendanceLog[] = useMemo(() => attendanceLogsData || [], [attendanceLogsData]);
  const { data: students, isLoading: isLoadingStudents, error: errorStudents } = useStudents();
  const { data: classes, isLoading: isLoadingClasses, error: errorClasses } = useClasses();

  // 선택된 날짜의 요일에 해당하는 수업 목록
  const selectedDateClasses = useMemo(() => {
    if (!classes || !selectedDate) return [];

    // selectedDate의 요일 계산 (KST 기준)
    const dateKST = toKST(selectedDate);
    const dayOfWeekNumber = dateKST.day(); // 0(일) ~ 6(토)
    const dayOfWeekMap: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    const targetDayOfWeek = dayOfWeekMap[dayOfWeekNumber];

    // 해당 요일에 수업이 있는 활성 반만 필터링
    return classes.filter(c => c.day_of_week === targetDayOfWeek && c.status === 'active');
  }, [classes, selectedDate]);

  // 선택된 날짜에 수업이 있는 반의 ID 목록
  const selectedDateClassIds = useMemo(() => {
    if (!selectedDateClasses || selectedDateClasses.length === 0) return [];
    return selectedDateClasses.map(c => c.id);
  }, [selectedDateClasses]);

  // 선택된 날짜에 수업이 있는 학생 목록 (student_classes 조회)
  // Note: useStudentClasses는 student_id로 필터링하므로, class_id 배열 필터링은 직접 조회 필요
  const { data: studentClassesData } = useQuery({
    queryKey: ['student_classes_for_date', tenantId, selectedDateClassIds],
    queryFn: async () => {
      if (selectedDateClassIds.length === 0) return [];

      /* eslint-disable no-restricted-syntax */
      const response = await apiClient.get<StudentClass>('student_classes', {
        filters: {
          class_id: selectedDateClassIds,
          is_active: true
        },
        limit: 5000,
      });
      /* eslint-enable no-restricted-syntax */

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId && selectedDateClassIds.length > 0,
    staleTime: 30 * 1000,
  });

  // 선택된 날짜에 수업이 있는 학생 ID Set
  const todayStudentIds = useMemo(() => {
    if (!studentClassesData) return new Set<string>();
    return new Set(studentClassesData.map(sc => sc.student_id));
  }, [studentClassesData]);

  // 선택된 날짜에 수업이 있는 학생 목록 필터링
  const todayStudents = useMemo(() => {
    if (!students || todayStudentIds.size === 0) return [];
    return students.filter(s => todayStudentIds.has(s.id));
  }, [students, todayStudentIds]);

  // 정본 규칙: apiClient.get('student_classes') 직접 조회 제거, useStudents Hook 사용
  // 선택된 반의 학생 조회
  // [버그 수정] 빈 문자열('')도 falsy로 처리하여 전체 학생 조회
  const { data: selectedClassStudents } = useStudents(
    selectedClassId && selectedClassId.trim() !== '' ? { class_id: selectedClassId } : undefined
  );

  // [성능 최적화] 출석 로그를 Map으로 인덱싱 (O(n*m) → O(n+m))
  const attendanceLogsMap = useMemo(() => {
    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 📥 attendanceLogs 인덱싱 시작:', {
        totalLogs: attendanceLogs.length,
      });
    }

    const checkInMap = new Map<string, AttendanceLog>();
    const checkOutMap = new Map<string, AttendanceLog>();

    // [근본 수정] 같은 학생의 여러 로그 중 가장 최신 레코드만 유지
    // DESC 정렬된 데이터를 순차 처리하면 가장 오래된 레코드가 마지막에 덮어쓰므로,
    // 이미 Map에 존재하는 경우 timestamp 비교하여 최신 레코드만 유지
    attendanceLogs.forEach(log => {
      if (log.attendance_type === 'check_in') {
        const existingLog = checkInMap.get(log.student_id);

        // 기존 로그가 없거나, 현재 로그가 더 최신인 경우에만 저장
        if (!existingLog || new Date(log.occurred_at) > new Date(existingLog.occurred_at)) {
          if (import.meta.env?.DEV) {
            console.log('[AttendancePage] ✅ check_in 로그 (최신):', {
              student_id: log.student_id,
              status: log.status,
              occurred_at: log.occurred_at,
            });
          }
          checkInMap.set(log.student_id, log);
        } else {
          if (import.meta.env?.DEV) {
            console.log('[AttendancePage] ⏭️ check_in 로그 (구버전 스킵):', {
              student_id: log.student_id,
              status: log.status,
              occurred_at: log.occurred_at,
              existing_occurred_at: existingLog.occurred_at,
            });
          }
        }
      } else if (log.attendance_type === 'check_out') {
        const existingLog = checkOutMap.get(log.student_id);

        // 기존 로그가 없거나, 현재 로그가 더 최신인 경우에만 저장
        if (!existingLog || new Date(log.occurred_at) > new Date(existingLog.occurred_at)) {
          checkOutMap.set(log.student_id, log);
        }
      }
    });

    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 📊 인덱싱 완료:', {
        checkInCount: checkInMap.size,
        checkOutCount: checkOutMap.size,
      });
    }

    return { checkInMap, checkOutMap };
  }, [attendanceLogs]);  // selectedDate, selectedClassId는 실제로 사용되지 않음

  // 선택된 반의 학생 목록
  const filteredStudents = useMemo(() => {
    // 반이 선택된 경우: 해당 반의 학생만
    // 반이 선택되지 않은 경우: 선택된 날짜에 수업이 있는 모든 학생
    // [버그 수정] 빈 문자열('')도 "선택 안 됨"으로 처리
    const baseStudents = (selectedClassId && selectedClassId.trim() !== '')
      ? (selectedClassStudents || [])
      : todayStudents;

    if (!baseStudents || baseStudents.length === 0) return [];

    let result = baseStudents;

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(query) ||
        s.phone?.includes(query)
      );
    }

    // [키오스크 연동] 체크인 방법 필터
    // [성능 최적화] Map을 사용하여 O(n) 조회
    if (checkInMethodFilter && checkInMethodFilter !== '') {
      result = result.filter(s => {
        const log = attendanceLogsMap.checkInMap.get(s.id);
        const method = log?.check_in_method || 'manual';
        return method === checkInMethodFilter;
      });
    }

    return result;
  }, [todayStudents, selectedClassId, selectedClassStudents, searchQuery, checkInMethodFilter, attendanceLogsMap]);

  // [비활성화] AI 출석 예측 기능 비활성화
  const aiPredictions = useMemo<Record<string, { check_in: boolean; check_out: boolean; status: AttendanceStatus }>>(() => ({}), []);
  const isLoadingPredictions = false;

  // // AI 출석 예측 조회 (초기 상태에만 적용)
  // // [성능 최적화] useOptimizedQuery 사용
  // const { data: aiPredictions, isLoading: isLoadingPredictions } = useOptimizedQuery(
  //   ['ai-attendance-predictions', selectedDate, selectedClassId, filteredStudents.map(s => s.id)],
  //   async () => {
  //     if (!filteredStudents || filteredStudents.length === 0) return {};

  //     try {
  //       // AI 출석 예측 (아키텍처 문서 3.3.2: AI가 출석을 "예측"하여 기본값 설정)
  //       // 현재는 과거 출결 패턴 기반 간단한 예측 구현
  //       // 향후 Edge Function으로 AI 예측 API 호출로 확장 예정
  //       const predictions: Record<string, { check_in: boolean; check_out: boolean; status: AttendanceStatus }> = {};

  //       // 각 학생의 과거 출결 패턴 조회
  //       // 기술문서 5-2: KST 기준 날짜 처리
  //       const dateFrom = toKST(selectedDate).subtract(30, 'day').format('YYYY-MM-DD');

  //       for (const student of filteredStudents) {
  //         try {
  //           // 학생의 과거 출결 데이터 조회
  //           // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
  //           if (!tenantId) continue;
  //           const pastLogs = await fetchAttendanceLogs(tenantId, {
  //             student_id: student.id,
  //             date_from: dateFrom,
  //             date_to: selectedDate,
  //             attendance_type: 'check_in',
  //           });

  //           if (pastLogs.length > 0) {
  //             // 출석률 계산
  //             const presentCount = (pastLogs as unknown as AttendanceLog[]).filter((log: AttendanceLog) => log.status === 'present').length;
  //             const attendanceRate = presentCount / pastLogs.length;

  //             // 출석률이 70% 이상이면 출석 예측
  //             if (attendanceRate >= 0.7) {
  //               predictions[student.id] = {
  //                 check_in: true,
  //                 check_out: false,
  //                 status: attendanceRate >= 0.9 ? 'present' : 'late',
  //               };
  //             }
  //           }
  //         } catch (error) {
  //           // AI 예측 실패 시 해당 학생은 예측값 없음으로 처리 (아키텍처 문서 3.3.2: fallback_on_prediction_failure)
  //         }
  //       }

  //       return predictions;
  //     } catch (error) {
  //       // AI 예측 실패 시 빈 객체 반환 (모든 학생 미체크 상태) - 아키텍처 문서 3.3.2: fallback_on_prediction_failure
  //       return {};
  //     }
  //   },
  //   {
  //     enabled: filteredStudents.length > 0 && viewMode === 'today',
  //     // useOptimizedQuery의 기본 staleTime(5분)이 자동 적용됨
  //   }
  // );

  // 전체 로딩 상태 (아키텍처 문서 3.3.3: loading 상태)
  // isLoadingPredictions 정의 이후에 계산해야 함
  const isLoading = isLoadingLogs || isLoadingStudents || isLoadingClasses || isLoadingPredictions;

  // 전체 에러 상태 (아키텍처 문서 3.3.3: error 상태)
  const error = errorLogs || errorStudents || errorClasses;

  // [근본 수정] attendanceLogs 데이터 기반으로 studentAttendanceStates 동기화
  // React Query가 데이터를 새로 가져오면 자동으로 상태가 업데이트됨
  // 사용자가 수정 중인 상태(user_modified=true)는 보존
  useEffect(() => {
    if (isLoadingPredictions) return;
    if (filteredStudents.length === 0) return;

    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 🔄 상태 동기화 시작');
      console.log('[AttendancePage] 📊 attendanceLogsMap:', {
        checkInCount: attendanceLogsMap.checkInMap.size,
        checkOutCount: attendanceLogsMap.checkOutMap.size,
      });
    }

    // 새로운 상태 계산 (DB 데이터 기반)
    const newStates: Record<string, StudentAttendanceState> = {};

    filteredStudents.forEach(student => {
      // 사용자가 수정 중인 상태는 보존 (ref를 통해 최신 상태 참조)
      const currentState: StudentAttendanceState | undefined = studentAttendanceStatesRef.current[student.id];
      if (currentState?.user_modified) {
        newStates[student.id] = currentState;
        return;
      }

      // DB에서 저장된 출석 데이터 조회
      const savedCheckInLog = attendanceLogsMap.checkInMap.get(student.id);
      const savedCheckOutLog = attendanceLogsMap.checkOutMap.get(student.id);

      if (savedCheckInLog || savedCheckOutLog) {
        // 저장된 출석 데이터 우선 적용
        newStates[student.id] = {
          student_id: student.id,
          check_in: !!savedCheckInLog,
          check_out: !!savedCheckOutLog,
          status: savedCheckInLog?.status || 'present',
          check_in_time: savedCheckInLog ? toKST(savedCheckInLog.occurred_at).format('HH:mm') : undefined,
          check_out_time: savedCheckOutLog ? toKST(savedCheckOutLog.occurred_at).format('HH:mm') : undefined,
          ai_predicted: false,
          user_modified: false,
        };
      } else {
        // AI 예측값 또는 기본값 사용
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
          newStates[student.id] = {
            student_id: student.id,
            check_in: false,
            check_out: false,
            status: 'present',
            ai_predicted: false,
            user_modified: false,
          };
        }
      }
    });

    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 🎯 동기화 완료');
    }
    setStudentAttendanceStates(newStates);
  }, [aiPredictions, isLoadingPredictions, filteredStudents, attendanceLogsMap]);

  // 선택된 반/날짜 변경 시 상태 초기화 및 필터 업데이트
  useEffect(() => {
    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 🔄 반/날짜 변경 감지:', { selectedClassId, selectedDate });
    }

    // 필터 업데이트 (attendance_logs 재조회를 위해 필수)
    const newFilter = {
      date_from: selectedDate,
      date_to: selectedDate,
      class_id: selectedClassId || undefined,
    };
    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 🔍 필터 업데이트:', newFilter);
    }
    setFilter(newFilter);

    // 상태 초기화 (새로운 필터로 데이터가 로드되면 useEffect가 자동 동기화)
    setStudentAttendanceStates({});
  }, [selectedClassId, selectedDate]);

  // 출결 UPSERT (INSERT or UPDATE)
  const upsertAttendance = useUpsertAttendanceLog();

  // 출결 저장 핸들러
  // const _determineAttendanceStatus = (
  //   occurredAt: string | Date,
  //   classInfo: { start_time: string; day_of_week: string } | undefined,
  //   lateAfter: number | null,
  //   absentAfter: number | null
  // ): { status: AttendanceStatus; attendance_type: AttendanceType } => {
  //   if (!classInfo) {
  //     // 수업 정보가 없으면 수동 입력값 사용
  //     return { status: 'present', attendance_type: 'check_in' };
  //   }

  //   // [P0-FIX] Fail Closed: Policy가 없으면 자동 판정 불가 (수동 입력값 사용)
  //   if (lateAfter === null || absentAfter === null) {
  //     return { status: 'present', attendance_type: 'check_in' };
  //   }

  //   // 반의 요일 확인
  //   const dayMap: Record<string, number> = {
  //     'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
  //     'friday': 5, 'saturday': 6, 'sunday': 0,
  //   };
  //   const classDayOfWeek = dayMap[classInfo.day_of_week.toLowerCase()];
  //   const occurredAtKSTForDay = typeof occurredAt === 'string' ? toKST(occurredAt) : toKST(occurredAt.toISOString());
  //   const occurredDayOfWeek = occurredAtKSTForDay.day();

  //   // 요일이 맞지 않으면 수동 입력값 사용
  //   if (classDayOfWeek !== occurredDayOfWeek) {
  //     return { status: 'present', attendance_type: 'check_in' };
  //   }

  //   // 수업 시작 시간 파싱
  //   const [startHour, startMinute] = classInfo.start_time.split(':').map(Number);
  //   const occurredAtKST = typeof occurredAt === 'string' ? toKST(occurredAt) : toKST(occurredAt.toISOString());
  //   const classStartTime = occurredAtKST.hour(startHour).minute(startMinute).second(0).millisecond(0);

  //   // 시간 차이 계산 (분)
  //   const diffMinutes = occurredAtKST.diff(classStartTime, 'minute');

  //   // 자동 판정
  //   if (diffMinutes <= 0) {
  //     return { status: 'present', attendance_type: 'check_in' };
  //   } else if (diffMinutes <= lateAfter) {
  //     return { status: 'late', attendance_type: 'late' };
  //   } else if (diffMinutes <= absentAfter) {
  //     return { status: 'late', attendance_type: 'late' };
  //   } else {
  //     return { status: 'absent', attendance_type: 'absent' };
  //   }
  // };


  // 출결 설정은 환경설정 > 출결 설정으로 이동 (아키텍처 문서 3.3.7, 1716줄)
  // handleSaveSettings 함수 제거됨
  // handleCreateAttendance 함수 제거됨 (미사용)


  // 출결 저장 핸들러
  const handleSaveAttendance = useCallback(async () => {
    if (isSaving) return;

    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 💾 저장 시작');
      console.log('[AttendancePage] 📋 현재 상태:', studentAttendanceStates);
    }

    setIsSaving(true);
    try {
      // [시간 기록 중심] 등원/하원 기록을 분리하여 각각 저장
      const attendanceRecords: CreateAttendanceLogInput[] = [];

      Object.values(studentAttendanceStates).forEach(state => {
        // user_modified가 true인 경우에만 저장 (사용자가 실제로 변경한 경우)
        if (!state.user_modified) {
          return;
        }

        // 등원 기록 또는 결석 기록
        if (state.check_in || state.status === 'absent' || state.status === 'excused') {
          // [수정] 등원 시간이 있으면 사용, 없으면 (결석의 경우) 기본 시간 사용
          let occurredAt: string;

          if (state.check_in && state.check_in_time) {
            // 등원 시간이 있는 경우
            const checkInTimeStr = state.check_in_time;
            const [hour, minute] = checkInTimeStr.split(':');
            occurredAt = toKST(selectedDate)
              .hour(parseInt(hour))
              .minute(parseInt(minute))
              .second(0)
              .format('YYYY-MM-DDTHH:mm:ssZ');
          } else {
            // 결석이거나 시간 정보가 없는 경우: 선택된 반의 수업 시작 시간 사용
            const selectedClass = classes?.find(c => c.id === selectedClassId);
            if (selectedClass?.start_time) {
              const [hour, minute] = selectedClass.start_time.split(':').map(Number);
              occurredAt = toKST(selectedDate)
                .hour(hour)
                .minute(minute)
                .second(0)
                .format('YYYY-MM-DDTHH:mm:ssZ');
            } else {
              // 반 정보가 없으면 현재 시간 사용
              occurredAt = toKST().format('YYYY-MM-DDTHH:mm:ssZ');
            }
          }

          // [수정] RPC 함수가 날짜 기준으로 UPSERT하므로 id 불필요
          const record: CreateAttendanceLogInput = {
            student_id: state.student_id,
            class_id: selectedClassId || undefined,
            occurred_at: occurredAt,
            attendance_type: 'check_in',
            status: state.status,
            check_in_method: 'manual',
          };

          if (import.meta.env?.DEV) {
            console.log('[AttendancePage] 📝 출결 기록:', {
              student_id: state.student_id,
              status: state.status,
              has_check_in_time: !!state.check_in_time,
            });
          }

          attendanceRecords.push(record);
        }

        // 하원 기록
        if (state.check_out) {
          const checkOutTimeStr = state.check_out_time || toKST().format('HH:mm');
          const [hour, minute] = checkOutTimeStr.split(':');
          const occurredAt = toKST(selectedDate)
            .hour(parseInt(hour))
            .minute(parseInt(minute))
            .second(0)
            .format('YYYY-MM-DDTHH:mm:ssZ');

          // [수정] RPC 함수가 날짜 기준으로 UPSERT하므로 id 불필요
          const record: CreateAttendanceLogInput = {
            student_id: state.student_id,
            class_id: selectedClassId || undefined,
            occurred_at: occurredAt,
            attendance_type: 'check_out',
            status: state.status,
          };

          if (import.meta.env?.DEV) {
            console.log('[AttendancePage] 📝 하원 기록:', {
              student_id: state.student_id,
              time: checkOutTimeStr,
            });
          }

          attendanceRecords.push(record);
        }
      });

      // 출결 기록 생성/수정 (아키텍처 문서 3.3.3: 출결 저장)
      // UPSERT 사용: 기존 레코드가 있으면 UPDATE, 없으면 INSERT
      if (import.meta.env?.DEV) {
        console.log('[AttendancePage] 📤 총 ', attendanceRecords.length, '개 레코드 UPSERT 중...');
      }
      for (const record of attendanceRecords) {
        if (import.meta.env?.DEV) {
          console.log('[AttendancePage] 💾 UPSERT 실행:', record);
        }
        await upsertAttendance.mutateAsync(record);
      }

      // Success 상태 (아키텍처 문서 3.3.3: success 상태 - 2초 후 자동 닫기)
      if (import.meta.env?.DEV) {
        console.log('[AttendancePage] ✅ 저장 완료');
      }
      showAlert(terms.MESSAGES.SAVE_SUCCESS, terms.MESSAGES.SUCCESS, 'success');

      // [근본 수정] 저장 후 user_modified 플래그만 false로 초기화
      // 상태 자체는 비우지 않음 - React Query refetch 완료 후 useEffect가 자동 동기화
      // 이렇게 하면 refetch 중에도 현재 데이터가 유지되어 테이블이 초기화되지 않음
      if (import.meta.env?.DEV) {
        console.log('[AttendancePage] 🧹 user_modified 플래그만 초기화 (상태 유지)');
      }
      setStudentAttendanceStates(prevStates => {
        const newStates: Record<string, StudentAttendanceState> = {};
        Object.entries(prevStates).forEach(([studentId, state]) => {
          newStates[studentId] = {
            ...state,
            user_modified: false, // 플래그만 초기화, 나머지 상태는 유지
          };
        });
        return newStates;
      });
    } catch (error) {
      showAlert(terms.MESSAGES.SAVE_ERROR, terms.MESSAGES.ERROR, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [studentAttendanceStates, selectedClassId, selectedDate, isSaving, upsertAttendance, showAlert, terms, classes]);

  // 일괄 등원/하원 핸들러
  const handleBulkCheckIn = useCallback(() => {
    const newStates = { ...studentAttendanceStates };
    const currentTime = toKST().format('HH:mm'); // [시간 기록 중심] 현재 시간 자동 설정

    filteredStudents.forEach(student => {
      if (!newStates[student.id]) {
        newStates[student.id] = {
          student_id: student.id,
          check_in: true,
          check_out: false,
          status: 'present',
          check_in_time: currentTime, // [시간 기록 중심] 현재 시간 저장
          ai_predicted: false,
          user_modified: true,
        };
      } else {
        newStates[student.id] = {
          ...newStates[student.id],
          check_in: true,
          check_in_time: currentTime, // [시간 기록 중심] 현재 시간 저장
          user_modified: true,
        };
      }
    });
    setStudentAttendanceStates(newStates);
  }, [filteredStudents, studentAttendanceStates]);

  const handleBulkCheckOut = useCallback(() => {
    const newStates = { ...studentAttendanceStates };
    const currentTime = toKST().format('HH:mm'); // [시간 기록 중심] 현재 시간 자동 설정

    filteredStudents.forEach(student => {
      if (!newStates[student.id]) {
        newStates[student.id] = {
          student_id: student.id,
          check_in: false,
          check_out: true,
          status: 'present',
          check_out_time: currentTime, // [시간 기록 중심] 현재 시간 저장
          ai_predicted: false,
          user_modified: true,
        };
      } else {
        newStates[student.id] = {
          ...newStates[student.id],
          check_out: true,
          check_out_time: currentTime, // [시간 기록 중심] 현재 시간 저장
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

    // [키오스크 연동] 키오스크 출석 통계
    // [성능 최적화] Map 크기를 사용하여 O(1) 조회
    const totalCheckIns = attendanceLogsMap.checkInMap.size;
    let kioskCheckIns = 0;
    attendanceLogsMap.checkInMap.forEach(log => {
      if (log.check_in_method === 'kiosk_phone') {
        kioskCheckIns++;
      }
    });
    const kioskRate = totalCheckIns > 0 ? Math.round((kioskCheckIns / totalCheckIns) * 100) : 0;

    return { total, present, late, absent, kioskRate };
  }, [studentAttendanceStates, filteredStudents, attendanceLogsMap]);

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', height: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김) */}
        {!isMobileMode && (
          <SubSidebar
            title="출결관리"
            items={subMenuItemsWithIcons}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            testId="attendance-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding="lg" style={{ flex: 1 }}>
          <PageHeader
            title={subMenuItemsWithIcons.find(item => item.id === selectedSubMenu)?.label || '출결관리'}
          />

        {/* 오늘 출결 탭 */}
        {selectedSubMenu === 'today' && (
        <>
              {/* AttendanceSummary: 총원/출석/지각/결석 (아키텍처 문서 3.3.3: 상단 통계) */}
              <div style={{ marginBottom: 'var(--spacing-xl)', pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
                <CardGridLayout
                  cards={[
                    <NotificationCardLayout
                      key="total"
                      icon={<Users />}
                      title={terms.TOTAL_LABEL}
                      value={attendanceSummary.total}
                      unit="명"
                      layoutMode="stats"
                      iconBackgroundColor="var(--color-gray-100)"
                    />,
                    <NotificationCardLayout
                      key="present"
                      icon={<UserCheck />}
                      title={terms.PRESENT_LABEL}
                      value={attendanceSummary.present}
                      unit="명"
                      layoutMode="stats"
                      iconBackgroundColor="var(--color-success-50)"
                    />,
                    <NotificationCardLayout
                      key="late"
                      icon={<Clock />}
                      title={terms.LATE_LABEL}
                      value={attendanceSummary.late}
                      unit="명"
                      layoutMode="stats"
                      iconBackgroundColor="var(--color-warning-50)"
                    />,
                    <NotificationCardLayout
                      key="absent"
                      icon={<UserX />}
                      title={terms.ABSENCE_LABEL}
                      value={attendanceSummary.absent}
                      unit="명"
                      layoutMode="stats"
                      iconBackgroundColor="var(--color-error-50)"
                    />,
                    <NotificationCardLayout
                      key="kiosk"
                      icon={<Smartphone />}
                      title="키오스크 출석률"
                      value={attendanceSummary.kioskRate}
                      unit="%"
                      layoutMode="stats"
                      iconBackgroundColor="var(--color-primary-50)"
                      description="전체 출석 중 키오스크 사용 비율"
                    />,
                  ]}
                  desktopColumns={5}
                  tabletColumns={3}
                  mobileColumns={2}
                />
              </div>

              {/* AttendanceStudentList: 학생 리스트 + 체크박스 UI (아키텍처 문서 3.3.3: 통계 다음에 StudentList) */}
              {/* 모바일: Bottom Action Bar를 위한 하단 패딩 추가 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
                // HARD-CODE-EXCEPTION: paddingBottom 0은 레이아웃용 특수 값 (Bottom Action Bar 높이만큼 패딩)
                paddingBottom: isMobileMode ? 'var(--spacing-bottom-action-bar)' : '0',
              }}>
                {/* 로딩 상태 (아키텍처 문서 3.3.3: loading 상태) */}
                {isLoading && (
                  <Card padding="lg">
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
                        {`출결 정보를 ${terms.MESSAGES.LOADING}`}
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
                  <Card padding="lg">
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

                {/* 정상 상태: 학생 리스트 - DataTable */}
                {!isLoading && !error && (
                  <DataTable
                    data={filteredStudents}
                    keyExtractor={(student) => student.id}
                    emptyMessage={`오늘 수업 ${terms.PERSON_LABEL_PRIMARY}이(가) 없습니다.`}
                    emptyIcon={Users}
                    loading={isLoading}
                    filters={[
                      {
                        type: 'select',
                        columnKey: 'class_id',
                        label: '수업 선택',
                        options: [
                          { value: '', label: '전체 수업' },
                          ...(classes || []).map(c => ({
                            value: c.id,
                            label: c.name
                          }))
                        ],
                      },
                      {
                        type: 'dateRange',
                        columnKey: 'date',
                        label: '날짜',
                        placeholder: '날짜 선택',
                      },
                      {
                        type: 'text',
                        columnKey: 'search',
                        label: '검색',
                        placeholder: `${terms.PERSON_LABEL_PRIMARY} 이름 검색`,
                      },
                      {
                        type: 'select',
                        columnKey: 'check_in_method',
                        label: '체크인 방법',
                        options: [
                          { value: '', label: '전체' },
                          { value: 'manual', label: '수동 입력' },
                          { value: 'kiosk_phone', label: '키오스크' },
                          { value: 'qr_scan', label: 'QR 스캔' },
                          { value: 'phone_auth', label: 'SMS 인증' },
                        ],
                      },
                    ]}
                    initialFilterState={{
                      class_id: { selected: selectedClassId || '' },
                      date: { dateRange: { start: selectedDate, end: selectedDate } },
                      search: { text: searchQuery },
                      check_in_method: { selected: '' },
                    }}
                    onFilterChange={(filterState) => {
                      if (filterState.class_id?.selected !== undefined) {
                        handleClassIdChange(filterState.class_id.selected || null);
                      }
                      if (filterState.date?.dateRange?.start) {
                        setSelectedDate(filterState.date.dateRange.start);
                      }
                      if (filterState.search?.text !== undefined) {
                        setSearchQuery(filterState.search.text);
                      }
                      if (filterState.check_in_method?.selected !== undefined) {
                        setCheckInMethodFilter(filterState.check_in_method.selected);
                      }
                    }}
                    enableClientSideFiltering={false}
                    columns={[
                      {
                        key: 'name',
                        label: terms.PERSON_LABEL_PRIMARY,
                        width: '20%',
                        render: (_, student) => {
                          const studentWithExtras = student as Student & { primary_class_name?: string };
                          const studentGrade = student.grade ? `${student.grade}${terms.GRADE_LABEL}` : '';
                          const studentClass = studentWithExtras.primary_class_name || '';
                          const gradeClassInfo = [studentGrade, studentClass].filter(Boolean).join(' ');

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                              {student.profile_image_url && (
                                <img
                                  src={student.profile_image_url}
                                  alt={student.name}
                                  loading="lazy"
                                  decoding="async"
                                  style={{
                                    width: 'var(--spacing-xl)',
                                    height: 'var(--spacing-xl)',
                                    borderRadius: 'var(--border-radius-full)',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <div>
                                <div style={{
                                  fontSize: 'var(--font-size-base)',
                                  fontWeight: 'var(--font-weight-semibold)',
                                  marginBottom: 'var(--spacing-2xs)'
                                }}>
                                  {student.name}
                                </div>
                                {gradeClassInfo && (
                                  <div style={{
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-text-secondary)'
                                  }}>
                                    {gradeClassInfo}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        },
                      },
                      {
                        key: 'check_in',
                        label: '등원 시간',
                        width: '15%',
                        align: 'center' as const,
                        render: (_, student) => {
                          const state = studentAttendanceStates[student.id] || {
                            student_id: student.id,
                            check_in: false,
                            check_out: false,
                            status: 'present' as AttendanceStatus,
                            ai_predicted: false,
                            user_modified: false,
                          };

                          // [키오스크 연동] 해당 학생의 출석 로그에서 체크인 방법 확인
                          // [성능 최적화] Map을 사용하여 O(1) 조회
                          const log = attendanceLogsMap.checkInMap.get(student.id);
                          const isKioskCheckIn = log?.check_in_method === 'kiosk_phone';

                          // [시간 기록 중심] 수정된 시간 우선, 없으면 로그의 시간 사용
                          const checkInTime = state.check_in_time || (log ? toKST(log.occurred_at).format('HH:mm') : '');

                          // [시간 기록 중심] 수업 시작 시간 조회 (자동 상태 판정용)
                          const selectedClass = classes?.find(c => c.id === selectedClassId);

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', justifyContent: 'center', flexDirection: 'column' }}>
                              {/* [시간 기록 중심] 시간 입력 필드로 변경 */}
                              <input
                                type="time"
                                value={checkInTime}
                                onChange={(e) => {
                                  const newTime = e.target.value;
                                  if (!newTime) {
                                    // 시간 삭제 (빈 값 입력)
                                    setStudentAttendanceStates(prev => ({
                                      ...prev,
                                      [student.id]: {
                                        ...state,
                                        check_in: false,
                                        check_in_time: undefined,
                                        status: 'absent',
                                        manual_status_override: false, // 시간 삭제 시 플래그 초기화
                                        user_modified: true,
                                        ai_predicted: false,
                                      },
                                    }));
                                    return;
                                  }

                                  // [시간 기록 중심] 등원 시간 기반 자동 상태 판정
                                  // 단, 사용자가 수동으로 상태를 변경한 경우 자동 판정 스킵
                                  let newStatus = state.status; // 기존 상태 유지

                                  if (!state.manual_status_override) {
                                    // 자동 판정: 수동 변경이 없는 경우만
                                    newStatus = 'present';

                                    if (selectedClass) {
                                      const [inputHour, inputMinute] = newTime.split(':').map(Number);
                                      const [classHour, classMinute] = selectedClass.start_time.split(':').map(Number);

                                      const inputMinutes = inputHour * 60 + inputMinute;
                                      const classMinutes = classHour * 60 + classMinute;
                                      const diffMinutes = inputMinutes - classMinutes;

                                      // 10분 이후 등원 = 지각
                                      if (diffMinutes > 10) {
                                        newStatus = 'late';
                                      }
                                    }
                                  }

                                  // 상태 업데이트 (시간 저장 + 조건부 자동 상태 판정)
                                  setStudentAttendanceStates(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...state,
                                      check_in: true,
                                      check_in_time: newTime,
                                      status: newStatus,
                                      user_modified: true,
                                      ai_predicted: false,
                                    },
                                  }));
                                }}
                                style={{
                                  padding: 'var(--spacing-2xs) var(--spacing-xs)',
                                  border: `var(--border-width-thin) solid ${isKioskCheckIn ? 'var(--color-success-300)' : 'var(--color-border)'}`,
                                  borderRadius: 'var(--border-radius-sm)',
                                  fontSize: 'var(--font-size-sm)',
                                  backgroundColor: isKioskCheckIn ? 'var(--color-success-50)' : 'var(--color-bg-primary)',
                                  color: 'var(--color-text-primary)',
                                  width: '100px',
                                }}
                              />

                              {/* 키오스크 출석 배지 */}
                              {isKioskCheckIn && (
                                <Badge variant="soft" color="success" style={{ fontSize: 'var(--font-size-xs)' }}>
                                  키오스크
                                </Badge>
                              )}

                              {/* 지각 경고 배지 */}
                              {state.status === 'late' && state.check_in && (
                                <Badge variant="soft" color="warning" style={{ fontSize: 'var(--font-size-xs)' }}>
                                  지각
                                </Badge>
                              )}

                              {/* AI 예측 배지 */}
                              {state.ai_predicted && !state.user_modified && (
                                <Badge variant="soft" color="info" style={{ fontSize: 'var(--font-size-xs)' }}>
                                  AI 예측
                                </Badge>
                              )}
                            </div>
                          );
                        },
                      },
                      {
                        key: 'check_in_method',
                        label: '체크인 방법',
                        width: '10%',
                        align: 'center' as const,
                        render: (_, student) => {
                          // [성능 최적화] Map을 사용하여 O(1) 조회
                          const log = attendanceLogsMap.checkInMap.get(student.id);
                          if (!log?.check_in_method || log.check_in_method === 'manual') return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>;

                          return (
                            <Badge
                              variant="soft"
                              color={log.check_in_method === 'kiosk_phone' ? 'success' : 'info'}
                            >
                              {log.check_in_method === 'kiosk_phone' && '키오스크'}
                              {log.check_in_method === 'qr_scan' && 'QR'}
                              {log.check_in_method === 'phone_auth' && 'SMS'}
                            </Badge>
                          );
                        },
                      },
                      {
                        key: 'check_out',
                        label: '하원 시간',
                        width: '12%',
                        align: 'center' as const,
                        render: (_, student) => {
                          const state = studentAttendanceStates[student.id] || {
                            student_id: student.id,
                            check_in: false,
                            check_out: false,
                            status: 'present' as AttendanceStatus,
                            ai_predicted: false,
                            user_modified: false,
                          };

                          // [성능 최적화] Map을 사용하여 O(1) 조회
                          const checkOutLog = attendanceLogsMap.checkOutMap.get(student.id);

                          // [시간 기록 중심] 수정된 시간 우선, 없으면 로그의 시간 사용
                          const checkOutTime = state.check_out_time || (checkOutLog ? toKST(checkOutLog.occurred_at).format('HH:mm') : '');

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', justifyContent: 'center' }}>
                              {/* [시간 기록 중심] 시간 입력 필드로 변경 */}
                              <input
                                type="time"
                                value={checkOutTime}
                                onChange={(e) => {
                                  const newTime = e.target.value;
                                  if (!newTime) {
                                    // 시간 삭제 (빈 값 입력)
                                    setStudentAttendanceStates(prev => ({
                                      ...prev,
                                      [student.id]: {
                                        ...state,
                                        check_out: false,
                                        check_out_time: undefined,
                                        user_modified: true,
                                        ai_predicted: false,
                                      },
                                    }));
                                    return;
                                  }

                                  // 상태 업데이트 (시간 저장)
                                  setStudentAttendanceStates(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...state,
                                      check_out: true,
                                      check_out_time: newTime,
                                      user_modified: true,
                                      ai_predicted: false,
                                    },
                                  }));
                                }}
                                style={{
                                  padding: 'var(--spacing-2xs) var(--spacing-xs)',
                                  border: 'var(--border-width-thin) solid var(--color-border)',
                                  borderRadius: 'var(--border-radius-sm)',
                                  fontSize: 'var(--font-size-sm)',
                                  backgroundColor: 'var(--color-bg-primary)',
                                  color: 'var(--color-text-primary)',
                                  width: '100px',
                                }}
                              />
                            </div>
                          );
                        },
                      },
                      {
                        key: 'duration',
                        label: '체류 시간',
                        width: '10%',
                        align: 'center' as const,
                        render: (_, student) => {
                          // [시간 기록 중심] 등원~하원 간 체류 시간 계산
                          const checkInLog = attendanceLogsMap.checkInMap.get(student.id);
                          const checkOutLog = attendanceLogsMap.checkOutMap.get(student.id);

                          if (!checkInLog || !checkOutLog) {
                            return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>;
                          }

                          const checkInTime = toKST(checkInLog.occurred_at);
                          const checkOutTime = toKST(checkOutLog.occurred_at);
                          const durationMinutes = checkOutTime.diff(checkInTime, 'minute');

                          if (durationMinutes < 0) {
                            return <span style={{ color: 'var(--color-error)' }}>오류</span>;
                          }

                          const hours = Math.floor(durationMinutes / 60);
                          const minutes = durationMinutes % 60;

                          return (
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                              {hours > 0 && `${hours}시간 `}{minutes}분
                            </span>
                          );
                        },
                      },
                      {
                        key: 'status',
                        label: '출석 상태',
                        width: '15%',
                        align: 'center' as const,
                        render: (_, student) => {
                          const state = studentAttendanceStates[student.id] || {
                            student_id: student.id,
                            check_in: false,
                            check_out: false,
                            status: 'present' as AttendanceStatus,
                            ai_predicted: false,
                            user_modified: false,
                          };

                          // [개념 통합] 상태 선택 드롭다운으로 통합 (배지 제거)
                          return (
                            <Select
                              value={state.status}
                              onChange={(value) => {
                                // [시간 기록 중심] 수동 변경 시 플래그 설정
                                setStudentAttendanceStates(prev => ({
                                  ...prev,
                                  [student.id]: {
                                    ...state,
                                    status: value as AttendanceStatus,
                                    manual_status_override: true, // 수동 변경 플래그
                                    user_modified: true,
                                    ai_predicted: false,
                                  },
                                }));
                              }}
                              options={[
                                { value: 'present', label: terms.PRESENT_LABEL },
                                { value: 'late', label: terms.LATE_LABEL },
                                { value: 'absent', label: terms.ABSENCE_LABEL },
                                { value: 'excused', label: terms.EXCUSED_LABEL },
                              ]}
                              size="sm"
                            />
                          );
                        },
                      },
                    ]}
                  />
                )}
              </div>

              {/* AttendanceActions: 일괄 등원/하원/저장 버튼 (아키텍처 문서 3.3.3: StudentList 다음에 Actions) */}
              {/* 모바일: Bottom Action Bar, 태블릿/데스크톱: Card */}
              {/* 아키텍처 문서 3.3.9: 태블릿 모드에서는 큰 터치 버튼 (최소 120px × 60px) */}
              {isMobileMode ? (
                <BottomActionBar style={{ pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkCheckIn}
                    disabled={isSaving || isLoading}
                  >
                    일괄 {terms.CHECK_IN_LABEL}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkCheckOut}
                    disabled={isSaving || isLoading}
                  >
                    일괄 {terms.CHECK_OUT_LABEL}
                  </Button>
                  <div style={{ flex: 1 }} />
                  <Button
                    variant="solid"
                    color="primary"
                    size="sm"
                    onClick={handleSaveAttendance}
                    disabled={isSaving || isLoading}
                  >
                    {isSaving ? terms.MESSAGES.LOADING : terms.MESSAGES.SAVE}
                  </Button>
                </BottomActionBar>
              ) : (
                <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)', pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
                  <div style={{ display: 'flex', gap: isTabletMode ? 'max(var(--spacing-md), var(--tablet-spacing-min))' : 'var(--spacing-sm)', flexWrap: 'wrap' }}> {/* 아키텍처 문서 3.3.9: 버튼 간 간격 최소 8px */}
                    <Button
                      variant="outline"
                      size={isTabletMode ? 'lg' : 'md'}
                      onClick={handleBulkCheckIn}
                      disabled={isSaving || isLoading}
                      style={isTabletMode ? {
                        minWidth: 'var(--width-button-min)',
                        minHeight: 'var(--height-button-min)',
                        fontSize: 'max(var(--font-size-lg), var(--tablet-font-size-button-min))', // 아키텍처 문서 3.3.9: 버튼 텍스트 최소 18px
                      } : undefined}
                    >
                      일괄 {terms.CHECK_IN_LABEL}
                    </Button>
                    <Button
                      variant="outline"
                      size={isTabletMode ? 'lg' : 'md'}
                      onClick={handleBulkCheckOut}
                      disabled={isSaving || isLoading}
                      style={isTabletMode ? {
                        minWidth: 'var(--width-button-min)',
                        minHeight: 'var(--height-button-min)',
                        fontSize: 'max(var(--font-size-lg), var(--tablet-font-size-button-min))', // 아키텍처 문서 3.3.9: 버튼 텍스트 최소 18px
                      } : undefined}
                    >
                      일괄 {terms.CHECK_OUT_LABEL}
                    </Button>
                    <div style={{ flex: 1 }} />
                    {/* 통계 기능은 통계 또는 AI 인사이트 메뉴로 이동 (아키텍처 문서 3.3.8) */}
                    <Button
                      variant="solid"
                      color="primary"
                      size={isTabletMode ? 'lg' : 'md'}
                      onClick={handleSaveAttendance}
                      disabled={isSaving || isLoading}
                      style={isTabletMode ? {
                        minWidth: 'var(--width-button-min)',
                        minHeight: 'var(--height-button-min)',
                        fontSize: 'max(var(--font-size-lg), var(--tablet-font-size-button-min))', // 아키텍처 문서 3.3.9: 버튼 텍스트 최소 18px
                      } : undefined}
                    >
                      {isSaving ? `${terms.MESSAGES.LOADING}` : terms.MESSAGES.SAVE}
                    </Button>
                  </div>
                </Card>
              )}
        </>
        )}

        {/* 출결 기록 탭 */}
        {selectedSubMenu === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            <Card padding="lg">
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}>
                <History size={20} />
                출결 기록 조회
              </h3>
              {/* 필터 */}
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-lg)' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    marginBottom: 'var(--spacing-xs)',
                  }}>
                    시작일
                  </label>
                  <input
                    type="date"
                    value={filter.date_from}
                    onChange={(e) => setFilter(prev => ({ ...prev, date_from: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: 'var(--border-width-thin) solid var(--color-border)',
                      borderRadius: 'var(--border-radius-md)',
                      fontSize: 'var(--font-size-base)',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    marginBottom: 'var(--spacing-xs)',
                  }}>
                    종료일
                  </label>
                  <input
                    type="date"
                    value={filter.date_to}
                    onChange={(e) => setFilter(prev => ({ ...prev, date_to: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: 'var(--border-width-thin) solid var(--color-border)',
                      borderRadius: 'var(--border-radius-md)',
                      fontSize: 'var(--font-size-base)',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    marginBottom: 'var(--spacing-xs)',
                  }}>
                    수업
                  </label>
                  <select
                    value={filter.class_id || ''}
                    onChange={(e) => setFilter(prev => ({ ...prev, class_id: e.target.value || undefined }))}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: 'var(--border-width-thin) solid var(--color-border)',
                      borderRadius: 'var(--border-radius-md)',
                      fontSize: 'var(--font-size-base)',
                    }}
                  >
                    <option value="">전체 수업</option>
                    {(classes || []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* 출결 기록 목록 */}
              {isLoadingLogs ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                  {terms.MESSAGES.LOADING}
                </div>
              ) : attendanceLogs && attendanceLogs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {attendanceLogs.slice(0, 50).map((log) => {
                    const student = students?.find(s => s.id === log.student_id);
                    return (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--spacing-md)',
                          backgroundColor: 'var(--color-bg-secondary)',
                          borderRadius: 'var(--border-radius-md)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-2xs)' }}>
                            {student?.name || log.student_id}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            {toKST(log.occurred_at).format('YYYY-MM-DD HH:mm')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                          <Badge
                            variant="soft"
                            color={log.attendance_type === 'check_in' ? 'blue' : 'green'}
                          >
                            {log.attendance_type === 'check_in' ? terms.CHECK_IN_LABEL : terms.CHECK_OUT_LABEL}
                          </Badge>
                          <Badge
                            variant="soft"
                            color={
                              log.status === 'present' ? 'success' :
                              log.status === 'late' ? 'warning' :
                              log.status === 'absent' ? 'error' : 'gray'
                            }
                          >
                            {log.status === 'present' ? terms.PRESENT_LABEL :
                             log.status === 'late' ? terms.LATE_LABEL :
                             log.status === 'absent' ? terms.ABSENCE_LABEL : terms.EXCUSED_LABEL}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={History} message="출결 기록이 없습니다." />
              )}
            </Card>
          </div>
        )}

        {/* 출결 통계 탭 */}
        {selectedSubMenu === 'statistics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            {/* 요약 통계 */}
            <CardGridLayout
              cards={[
                <NotificationCardLayout
                  key="total"
                  icon={<Users />}
                  title="총 출결 기록"
                  value={attendanceLogs.length}
                  unit="건"
                  layoutMode="stats"
                  iconBackgroundColor="var(--color-primary-50)"
                />,
                <NotificationCardLayout
                  key="present"
                  icon={<UserCheck />}
                  title={terms.PRESENT_LABEL}
                  value={attendanceLogs.filter(log => log.status === 'present').length}
                  unit="건"
                  layoutMode="stats"
                  iconBackgroundColor="var(--color-success-50)"
                />,
                <NotificationCardLayout
                  key="late"
                  icon={<Clock />}
                  title={terms.LATE_LABEL}
                  value={attendanceLogs.filter(log => log.status === 'late').length}
                  unit="건"
                  layoutMode="stats"
                  iconBackgroundColor="var(--color-warning-50)"
                />,
                <NotificationCardLayout
                  key="absent"
                  icon={<UserX />}
                  title={terms.ABSENCE_LABEL}
                  value={attendanceLogs.filter(log => log.status === 'absent').length}
                  unit="건"
                  layoutMode="stats"
                  iconBackgroundColor="var(--color-error-50)"
                />,
              ]}
              desktopColumns={4}
              tabletColumns={2}
              mobileColumns={2}
            />

            {/* 출석률 카드 */}
            <Card padding="lg">
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}>
                <TrendingUp size={20} />
                출석률 현황
              </h3>
              {attendanceLogs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {/* 출석률 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                      <span>{terms.PRESENT_LABEL}</span>
                      <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                        {Math.round((attendanceLogs.filter(log => log.status === 'present').length / attendanceLogs.length) * 100)}%
                      </span>
                    </div>
                    <div style={{
                      height: '8px',
                      backgroundColor: 'var(--color-gray-100)',
                      borderRadius: 'var(--border-radius-full)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.round((attendanceLogs.filter(log => log.status === 'present').length / attendanceLogs.length) * 100)}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-success)',
                        borderRadius: 'var(--border-radius-full)',
                      }} />
                    </div>
                  </div>
                  {/* 지각률 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                      <span>{terms.LATE_LABEL}</span>
                      <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                        {Math.round((attendanceLogs.filter(log => log.status === 'late').length / attendanceLogs.length) * 100)}%
                      </span>
                    </div>
                    <div style={{
                      height: '8px',
                      backgroundColor: 'var(--color-gray-100)',
                      borderRadius: 'var(--border-radius-full)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.round((attendanceLogs.filter(log => log.status === 'late').length / attendanceLogs.length) * 100)}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-warning)',
                        borderRadius: 'var(--border-radius-full)',
                      }} />
                    </div>
                  </div>
                  {/* 결석률 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                      <span>{terms.ABSENCE_LABEL}</span>
                      <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                        {Math.round((attendanceLogs.filter(log => log.status === 'absent').length / attendanceLogs.length) * 100)}%
                      </span>
                    </div>
                    <div style={{
                      height: '8px',
                      backgroundColor: 'var(--color-gray-100)',
                      borderRadius: 'var(--border-radius-full)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.round((attendanceLogs.filter(log => log.status === 'absent').length / attendanceLogs.length) * 100)}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-error)',
                        borderRadius: 'var(--border-radius-full)',
                      }} />
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState icon={BarChart3} message="통계 데이터가 없습니다." />
              )}
            </Card>

            {/* 키오스크 사용 통계 */}
            <Card padding="lg">
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}>
                <Smartphone size={20} />
                체크인 방법별 통계
              </h3>
              {attendanceLogs.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-md)' }}>
                  <div style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                  }}>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                      {attendanceLogs.filter(log => log.check_in_method === 'manual' || !log.check_in_method).length}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>수동 입력</div>
                  </div>
                  <div style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-success-50)',
                    borderRadius: 'var(--border-radius-md)',
                  }}>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                      {attendanceLogs.filter(log => log.check_in_method === 'kiosk_phone').length}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success-700)' }}>키오스크</div>
                  </div>
                  <div style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-info-50)',
                    borderRadius: 'var(--border-radius-md)',
                  }}>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-info)' }}>
                      {attendanceLogs.filter(log => log.check_in_method === 'qr_scan').length}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-info-700)' }}>QR 스캔</div>
                  </div>
                </div>
              ) : (
                <EmptyState icon={Smartphone} message="체크인 데이터가 없습니다." />
              )}
            </Card>
          </div>
        )}

        {/* 출결 설정 탭 */}
        {selectedSubMenu === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            {/* 지각/결석 기준 설정 */}
            <Card padding="lg">
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}>
                <Clock size={20} />
                지각/결석 기준 설정
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                }}>
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-medium)' }}>지각 기준</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      수업 시작 후 해당 시간이 지나면 지각으로 처리됩니다.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                      {config?.attendance?.late_after || 10}분
                    </span>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                }}>
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-medium)' }}>결석 기준</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      수업 시작 후 해당 시간이 지나면 결석으로 처리됩니다.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                      {config?.attendance?.absent_after || 30}분
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 자동 알림 설정 */}
            <Card padding="lg">
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}>
                <Bell size={20} />
                자동 알림 설정
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                }}>
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-medium)' }}>등원 알림</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {terms.PERSON_LABEL_PRIMARY} 등원 시 보호자에게 자동으로 알림을 발송합니다.
                    </div>
                  </div>
                  <Badge variant="soft" color={(config?.notification?.auto_notification?.check_in) ? 'success' : 'gray'}>
                    {(config?.notification?.auto_notification?.check_in) ? '활성' : '비활성'}
                  </Badge>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                }}>
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-medium)' }}>하원 알림</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {terms.PERSON_LABEL_PRIMARY} 하원 시 보호자에게 자동으로 알림을 발송합니다.
                    </div>
                  </div>
                  <Badge variant="soft" color={(config?.notification?.auto_notification?.check_out) ? 'success' : 'gray'}>
                    {(config?.notification?.auto_notification?.check_out) ? '활성' : '비활성'}
                  </Badge>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                }}>
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-medium)' }}>결석 알림</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      결석 처리 시 보호자에게 자동으로 알림을 발송합니다.
                    </div>
                  </div>
                  <Badge variant="soft" color={(config?.notification?.auto_notification?.absent) ? 'success' : 'gray'}>
                    {(config?.notification?.auto_notification?.absent) ? '활성' : '비활성'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* 알림 채널 설정 */}
            <Card padding="lg">
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                marginBottom: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}>
                <CheckCircle size={20} />
                알림 채널 설정
              </h3>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--border-radius-md)',
              }}>
                <div>
                  <div style={{ fontWeight: 'var(--font-weight-medium)' }}>기본 알림 채널</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    출결 알림을 발송할 기본 채널을 설정합니다.
                  </div>
                </div>
                <Badge variant="solid" color="primary">
                  {config?.notification?.default_channel === 'kakao_at' ? '카카오 알림톡' :
                   config?.notification?.default_channel === 'sms' ? 'SMS' : 'SMS'}
                </Badge>
              </div>
            </Card>
          </div>
        )}

        {/* 통계/히트맵/패턴 분석 기능은 통계 또는 AI 인사이트 메뉴로 이동 (아키텍처 문서 3.3.8) */}
        </Container>
      </div>
    </ErrorBoundary>
  );
}
