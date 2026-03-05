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
import { ErrorBoundary, Container, Card, Badge, useModal, PageHeader, useResponsiveMode, isMobile, isTablet, NotificationCardLayout, SubSidebar, EmptyState, RightLayerMenuLayout, EntityCard } from '@ui-core/react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { CardGridLayout } from '../components/CardGridLayout';
import { StatsDashboard } from '../components/stats/StatsDashboard';
// StatsItem type은 StatsDashboard에서 내부적으로 사용됨
import { Users, UserCheck, Clock, UserX, CalendarCheck, History, BarChart3, Settings, CheckCircle, Smartphone, TrendingUp, Bell, Play, CalendarClock, CalendarX } from 'lucide-react';
import {
  ClassAttendanceLayer,
  DailyAttendanceSection,
  calculateClassStats,
  groupAttendanceByDate,
  getDefaultDateRange,
  createAttendanceRecords,
  isClassStarted,
  ATTENDANCE_TIME_CONFIG,
  TIME_RANGE_CONFIG,
  DAY_OF_WEEK_MAP,
  DAY_NAMES,
  DATA_FETCH_LIMITS,
  type ClassInfo,
  type StudentAttendanceState,
} from '../components/attendance';
import { ATTENDANCE_SUB_MENU_ITEMS, DEFAULT_ATTENDANCE_SUB_MENU, ATTENDANCE_MENU_LABEL_MAPPING, getSubMenuFromUrl, setSubMenuToUrl, applyDynamicLabels } from '../constants';
import type { AttendanceSubMenuId } from '../constants';
import { templates } from '../utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAttendanceLogs, useUpsertAttendanceLog } from '@hooks/use-attendance';
import { useStudents } from '@hooks/use-student';
import { useClasses, useTeachersWithStats } from '@hooks/use-class';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { AttendanceFilter, AttendanceStatus, AttendanceLog, CreateAttendanceLogInput } from '@services/attendance-service';
import type { Student, StudentClass } from '@services/student-service';
import { toKST } from '@lib/date-utils';
import { createClient } from '@lib/supabase-client';
// import { useUserRole } from '@hooks/use-auth'; // [Deferred] 권한 체크 구현 시 사용
import { apiClient, getApiContext } from '@api-sdk/core';
import { useConfig, useUpdateConfig } from '@hooks/use-config';
import type { ClassTeacher } from '@services/class-service';

export function AttendancePage() {
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  // mode는 'xs' | 'sm' | 'md' | 'lg' | 'xl' 형식이므로 대문자로 변환
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper); // 아키텍처 문서 3.3.9: 태블릿 모드 감지 (768px ~ 1024px)
  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);
  // const { data: userRole } = useUserRole(); // [Deferred] 권한 체크 구현 시 사용
  const terms = useIndustryTerms();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // Fetch teachers data using useTeachersWithStats hook (includes persons JOIN for name)
  const { data: teachers } = useTeachersWithStats();

  // Fetch all class_teachers assignments
  const { data: allClassTeachers } = useQuery({
    queryKey: ['all-class-teachers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const response = await apiClient.get<ClassTeacher>('class_teachers', {
        filters: { is_active: true },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data || [];
    },
    enabled: !!tenantId,
  });

  // Create class -> teachers mapping for efficient lookup (includes profile images)
  const classTeachersMap = useMemo(() => {
    if (!allClassTeachers || !teachers) {
      return new Map<string, Array<{ name: string; profile_image_url?: string | null }>>();
    }

    const map = new Map<string, Array<{ name: string; profile_image_url?: string | null }>>();
    allClassTeachers.forEach(ct => {
      const teacher = teachers.find(t => t.id === ct.teacher_id);

      if (teacher) {
        if (!map.has(ct.class_id)) {
          map.set(ct.class_id, []);
        }
        map.get(ct.class_id)!.push({
          name: teacher.name,
          profile_image_url: teacher.profile_image_url
        });
      }
    });

    return map;
  }, [allClassTeachers, teachers]);

  // 역할별 권한 체크 (아키텍처 문서 2.3, 498-507줄)
  // Assistant: 출결 입력만 가능, 수정 권한 없음
  // Teacher: 출결 입력 및 수정 모두 가능
  // const canModifyAttendance = userRole !== 'assistant'; // [Deferred] 권한 체크 구현 시 사용


  // 오늘 출결하기 관련 상태
  // localStorage 기반 상태 초기화 (마지막 선택 수업 기억)
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
  const [selectedDate, _setSelectedDate] = useState<string>(toKST().format('YYYY-MM-DD'));
  void _setSelectedDate; // [Deferred] 날짜 선택 UI 구현 시 사용
  const [searchQuery, _setSearchQuery] = useState<string>('');
  void _setSearchQuery; // [Deferred] 검색 UI 구현 시 사용
  const [checkInMethodFilter, _setCheckInMethodFilter] = useState<string>('');
  void _setCheckInMethodFilter; // [Deferred] 필터 UI 구현 시 사용
  const [studentAttendanceStates, setStudentAttendanceStates] = useState<Record<string, StudentAttendanceState>>({});
  const studentAttendanceStatesRef = useRef<Record<string, StudentAttendanceState>>({});
  // 최신 상태를 ref에 동기화 (useEffect 내에서 클로저 문제 방지)
  useEffect(() => {
    studentAttendanceStatesRef.current = studentAttendanceStates;
  }, [studentAttendanceStates]);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  // 새로운 UI 관련 상태
  const [selectedClassIdForLayer, setSelectedClassIdForLayer] = useState<string | null>(null);

  // 필터 상태 (출결 기록 조회는 Advanced 메뉴로 이동 - 아키텍처 문서에 명시되지 않음)
  const defaultDateRange = getDefaultDateRange();
  const [filter, setFilter] = useState<AttendanceFilter>({
    date_from: defaultDateRange.dateFrom,
    date_to: defaultDateRange.dateTo,
  });

  // History 탭 전용 상태
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [expandedHistoryClasses, setExpandedHistoryClasses] = useState<Set<string>>(new Set());

  // 시간대 필터 상태 (전체/오전/오후/저녁)
  type TimeRangeFilter = 'all' | 'morning' | 'afternoon' | 'evening';
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('all');


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
  void updateConfig; // [Deferred] 출결 설정 업데이트 기능 구현 시 사용

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

  // [업종중립] 동적 라벨 + 아이콘이 적용된 서브 메뉴 아이템
  const subMenuItemsWithIcons = useMemo(() => {
    const iconMap: Record<AttendanceSubMenuId, React.ReactNode> = {
      today: <CalendarCheck size={16} />,
      'by-student': <Users size={16} />,
      history: <History size={16} />,
      statistics: <BarChart3 size={16} />,
      settings: <Settings size={16} />,
    };

    // 먼저 동적 라벨 적용
    const itemsWithDynamicLabels = applyDynamicLabels(ATTENDANCE_SUB_MENU_ITEMS, ATTENDANCE_MENU_LABEL_MAPPING, terms);

    // 그 다음 아이콘 추가
    return itemsWithDynamicLabels.map(item => ({
      ...item,
      icon: iconMap[item.id],
    }));
  }, [terms]);


  // [Deferred] 수업 선택 UI 구현 시 사용
  const _handleClassIdChange = useCallback((classId: string | null) => {
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
  void _handleClassIdChange;

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
    const targetDayOfWeek = DAY_OF_WEEK_MAP[dayOfWeekNumber];

    // 해당 요일에 수업이 있는 활성 반만 필터링
    // day_of_week가 배열이므로 includes로 확인
    return classes.filter(c => {
      const dayOfWeek = c.day_of_week;
      // 배열인 경우 includes 사용, 단일 값인 경우 직접 비교 (하위 호환)
      const hasDay = Array.isArray(dayOfWeek)
        ? dayOfWeek.includes(targetDayOfWeek as typeof dayOfWeek[number])
        : dayOfWeek === targetDayOfWeek;
      return hasDay && c.status === 'active';
    });
  }, [classes, selectedDate]);

  // 시간대별로 수업 필터링
  const filteredByTimeRange = useMemo(() => {
    if (timeRangeFilter === 'all') return selectedDateClasses;

    return selectedDateClasses.filter(cls => {
      const startHour = parseInt(cls.start_time.substring(0, 2), 10);

      switch (timeRangeFilter) {
        case 'morning':
          return startHour >= TIME_RANGE_CONFIG.MORNING.START && startHour < TIME_RANGE_CONFIG.MORNING.END;
        case 'afternoon':
          return startHour >= TIME_RANGE_CONFIG.AFTERNOON.START && startHour < TIME_RANGE_CONFIG.AFTERNOON.END;
        case 'evening':
          return startHour >= TIME_RANGE_CONFIG.EVENING.START && startHour < TIME_RANGE_CONFIG.EVENING.END;
        default:
          return true;
      }
    });
  }, [selectedDateClasses, timeRangeFilter]);

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
        limit: DATA_FETCH_LIMITS.STUDENT_CLASSES,
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
  // [Phase 5] check_in/check_out 이벤트 + 수업 출석 레코드(scheduled 등)를 모두 로드
  const attendanceLogsMap = useMemo(() => {
    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 📥 attendanceLogs 인덱싱 시작:', {
        totalLogs: attendanceLogs.length,
      });
    }

    const checkInMap = new Map<string, AttendanceLog>();
    const checkOutMap = new Map<string, AttendanceLog>();
    const classAttendanceMap = new Map<string, AttendanceLog>(); // 수업 출석 레코드 (scheduled/present/late/absent/excused)

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
      } else if (log.attendance_type === null && log.class_id) {
        // 수업 출석 레코드 (attendance_type이 null이고 class_id가 있는 경우)
        // [Phase 7] 레이어가 열려있으면 selectedClassIdForLayer, 아니면 selectedClassId
        const activeClassId = selectedClassIdForLayer || selectedClassId;
        if (!activeClassId || activeClassId === log.class_id) {
          const key = `${log.student_id}-${log.class_id}`;
          const existingLog = classAttendanceMap.get(key);

          // [수정] 타임스탬프가 동일할 때 ID로 2차 비교 (높은 ID = 최신)
          const existingTime = existingLog ? new Date(existingLog.occurred_at).getTime() : 0;
          const currentTime = new Date(log.occurred_at).getTime();
          const existingId = existingLog?.id ? Number(existingLog.id) : 0;
          const currentId = log.id ? Number(log.id) : 0;

          const isNewer = !existingLog ||
            currentTime > existingTime ||
            (currentTime === existingTime && currentId > existingId);

          if (isNewer) {
            if (import.meta.env?.DEV) {
              console.log('[AttendancePage] ✅ 수업 출석 레코드 인덱싱:', {
                student_id: log.student_id,
                class_id: log.class_id,
                status: log.status,
                id: log.id,
                attendance_type: log.attendance_type,
              });
            }
            classAttendanceMap.set(key, log);
          }
        }
      }
    });

    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 📊 인덱싱 완료:', {
        checkInCount: checkInMap.size,
        checkOutCount: checkOutMap.size,
        classAttendanceCount: classAttendanceMap.size,
      });
    }

    return { checkInMap, checkOutMap, classAttendanceMap };
  }, [attendanceLogs, selectedClassId, selectedClassIdForLayer]);

  // 선택된 수업의 학생 목록
  const filteredStudents = useMemo(() => {
    // 수업이 선택된 경우: 해당 수업의 학생만
    // 수업이 선택되지 않은 경우: 선택된 날짜에 수업이 있는 모든 학생
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
  // [Deferred] 에러 UI 표시 구현 시 사용
  const _error = errorLogs || errorStudents || errorClasses;
  void _error;

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
        classAttendanceCount: attendanceLogsMap.classAttendanceMap.size,
        selectedClassId,
        selectedClassIdForLayer,
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

      // [Phase 7] 수업 출석 레코드 조회 (scheduled 등)
      // 레이어가 열려있으면 selectedClassIdForLayer 사용, 아니면 selectedClassId 사용
      const activeClassId = selectedClassIdForLayer || selectedClassId;
      const classAttendanceKey = activeClassId ? `${student.id}-${activeClassId}` : undefined;
      const savedClassAttendanceLog = classAttendanceKey
        ? attendanceLogsMap.classAttendanceMap.get(classAttendanceKey)
        : undefined;

      // [Phase 5] check_in/check_out 이벤트 + 수업 출석 레코드를 조합
      if (savedCheckInLog || savedCheckOutLog || savedClassAttendanceLog) {
        // [Phase 7] 수업 출석 레코드가 있으면 해당 status 사용
        // 수업 출석 레코드가 없으면 null (토글로 취소된 경우 또는 아직 미설정)
        const status = savedClassAttendanceLog?.status ?? null;

        if (import.meta.env?.DEV) {
          console.log('[AttendancePage] 🔍 데이터 동기화:', {
            studentId: student.id,
            studentName: student.name,
            savedClassAttendanceLog: savedClassAttendanceLog,
            savedCheckInLog: !!savedCheckInLog,
            finalStatus: status,
          });
        }

        newStates[student.id] = {
          student_id: student.id,
          check_in: !!savedCheckInLog,
          check_out: !!savedCheckOutLog,
          status: status,
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
          // [Phase 7] 레코드 없음 = 상태 미확정 (null)
          newStates[student.id] = {
            student_id: student.id,
            check_in: false,
            check_out: false,
            status: null,
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
  }, [aiPredictions, isLoadingPredictions, filteredStudents, attendanceLogsMap, selectedClassId, selectedClassIdForLayer]);

  // 선택된 수업/날짜 변경 시 상태 초기화 및 필터 업데이트
  useEffect(() => {
    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 🔄 수업/날짜 변경 감지:', { selectedClassId, selectedDate });
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


  // 출결 저장 핸들러 - [Deferred] 레이어 UI 외부 저장 버튼 구현 시 사용
  const _handleSaveAttendance = useCallback(async () => {
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

        // createAttendanceRecords 유틸리티 사용
        const selectedClass = classes?.find(c => c.id === selectedClassId);
        const records = createAttendanceRecords(
          state,
          selectedDate,
          selectedClass?.start_time
        );

        // class_id 추가 (유틸리티에서는 undefined로 생성됨)
        records.forEach(record => {
          record.class_id = selectedClassId || undefined;

          if (import.meta.env?.DEV) {
            console.log('[AttendancePage] 📝 출결 기록:', {
              student_id: record.student_id,
              type: record.attendance_type,
              status: record.status,
            });
          }

          attendanceRecords.push(record);
        });
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
  void _handleSaveAttendance;

  // 일괄 등원/하원 핸들러 - [Deferred] 레이어 UI 외부 일괄 등원 버튼 구현 시 사용
  const _handleBulkCheckIn = useCallback(() => {
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
  void _handleBulkCheckIn;

  // [Deferred] 레이어 UI 외부 일괄 하원 버튼 구현 시 사용
  const _handleBulkCheckOut = useCallback(() => {
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
  void _handleBulkCheckOut;

  // 출결 요약 통계 (시간대 필터 적용)
  const attendanceSummary = useMemo(() => {
    // 시간대 필터링된 수업에 속한 학생들만 집계
    const filteredClassIds = new Set(filteredByTimeRange.map(cls => cls.id));
    const relevantStudents = studentClassesData?.filter(sc =>
      filteredClassIds.has(sc.class_id)
    ).map(sc => sc.student_id) || [];

    const relevantStudentSet = new Set(relevantStudents);
    const states = Object.entries(studentAttendanceStates).filter(([studentId]) =>
      relevantStudentSet.has(studentId)
    );

    const total = relevantStudents.length;
    const present = states.filter(([, s]) => s.check_in && s.status === 'present').length;
    const late = states.filter(([, s]) => s.check_in && s.status === 'late').length;
    const absent = states.filter(([, s]) => s.status === 'absent').length;

    return { total, present, late, absent };
  }, [studentAttendanceStates, filteredByTimeRange, studentClassesData]);

  // 차트 데이터 생성 (수업별 출석 현황)
  const attendanceChartData = useMemo(() => {
    if (!filteredByTimeRange || filteredByTimeRange.length === 0) {
      if (import.meta.env?.DEV) {
        console.log('[Chart] No classes in time range');
      }
      return [];
    }

    const chartData = filteredByTimeRange.map((cls) => {
      // 해당 수업의 학생들
      const classStudents = studentClassesData?.filter(sc => sc.class_id === cls.id) || [];
      const studentIds = new Set(classStudents.map(sc => sc.student_id));

      // 출석 통계 계산
      const states = Object.entries(studentAttendanceStates).filter(([studentId]) =>
        studentIds.has(studentId)
      );

      const present = states.filter(([, s]) => s.check_in && s.status === 'present').length;
      const late = states.filter(([, s]) => s.check_in && s.status === 'late').length;
      // absent는 현재 차트에서 미사용이나 향후 확장을 위해 계산
      void states.filter(([, s]) => s.status === 'absent').length;

      return {
        name: cls.name,
        value: present + late, // 출석 + 지각 = 등원한 학생
        color: 'var(--color-primary)',
      };
    }).sort((a, b) => a.name.localeCompare(b.name)); // 수업명 가나다순 정렬

    if (import.meta.env?.DEV) {
      console.log('[Chart] Attendance Chart Data:', chartData);
      console.log('[Chart] Chart Data Length:', chartData.length);
      console.log('[Chart] Sample Data:', chartData[0]);
    }

    return chartData;
  }, [filteredByTimeRange, studentClassesData, studentAttendanceStates]);

  // ========== 새로운 시간대별 그룹화 UI ==========

  // 수업별 학생 매핑 (studentClassesData 기반)
  const studentsByClass = useMemo(() => {
    const map = new Map<string, Student[]>();
    if (!studentClassesData || !students) return map;

    studentClassesData.forEach((sc) => {
      const student = students.find((s) => s.id === sc.student_id);
      if (student) {
        if (!map.has(sc.class_id)) {
          map.set(sc.class_id, []);
        }
        map.get(sc.class_id)!.push(student);
      }
    });

    return map;
  }, [studentClassesData, students]);

  // 선택된 수업 정보
  const selectedClassForLayer = useMemo(() => {
    if (!selectedClassIdForLayer) return null;
    const cls = selectedDateClasses.find((c) => c.id === selectedClassIdForLayer);
    if (!cls) return null;
    return {
      id: cls.id,
      name: cls.name,
      start_time: cls.start_time,
      end_time: cls.end_time,
      day_of_week: cls.day_of_week,
      status: cls.status,
    } as ClassInfo;
  }, [selectedClassIdForLayer, selectedDateClasses]);

  // 선택된 수업의 학생 목록
  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassIdForLayer) return [];
    return studentsByClass.get(selectedClassIdForLayer) || [];
  }, [selectedClassIdForLayer, studentsByClass]);

  // 수업 클릭 핸들러 (레이어 열기)
  const handleClassClick = useCallback((classId: string) => {
    setSelectedClassIdForLayer(classId);
  }, []);

  // 레이어 닫기 핸들러
  const handleLayerClose = useCallback(() => {
    setSelectedClassIdForLayer(null);
  }, []);

  // 레이어 내 출결 상태 변경 핸들러
  const handleLayerAttendanceChange = useCallback(
    (studentId: string, changes: Partial<StudentAttendanceState>) => {
      setStudentAttendanceStates((prev) => {
        const current = prev[studentId] || {
          student_id: studentId,
          check_in: false,
          check_out: false,
          status: null, // 초기 상태는 null (미확정)
          user_modified: false,
        };
        return {
          ...prev,
          [studentId]: {
            ...current,
            ...changes,
          },
        };
      });
    },
    []
  );

  // 클라이언트 실시간 자동 출석 확정 (scheduled → present 변환)
  useEffect(() => {
    if (!selectedClassForLayer) return;

    const checkAndConvertScheduled = () => {
      // 수업이 시작되었는지 확인
      if (!isClassStarted(selectedClassForLayer.start_time)) {
        return;
      }

      // scheduled 상태인 학생들을 찾아서 자동으로 present로 변환
      Object.entries(studentAttendanceStates).forEach(([studentId, state]) => {
        if (state.status === 'scheduled') {
          if (import.meta.env?.DEV) {
            console.log('[AttendancePage] 🔄 자동 출석 확정:', {
              studentId,
              classStartTime: selectedClassForLayer.start_time,
              from: 'scheduled',
              to: 'present',
            });
          }

          handleLayerAttendanceChange(studentId, {
            status: 'present',
            user_modified: false,
            ai_predicted: false,
          });
        }
      });
    };

    // 즉시 한 번 실행
    checkAndConvertScheduled();

    // 1분마다 재확인 (실시간 업데이트)
    const interval = setInterval(checkAndConvertScheduled, 60000);

    return () => clearInterval(interval);
  }, [selectedClassForLayer, studentAttendanceStates, handleLayerAttendanceChange]);

  // 레이어 내 일괄 등원 핸들러 (등원 시간 기반 출석/지각 자동 판정)
  const handleLayerBulkCheckIn = useCallback(() => {
    const currentTime = toKST().format('HH:mm');
    const classStartTime = selectedClassForLayer?.start_time;

    // 자동 판정: 등원 시간 vs 수업 시작 시간
    let autoStatus: 'present' | 'late' = 'present';
    if (classStartTime) {
      const [ciH, ciM] = currentTime.split(':').map(Number);
      const [csH, csM] = classStartTime.split(':').map(Number);
      const diff = (ciH * 60 + ciM) - (csH * 60 + csM);
      if (diff > ATTENDANCE_TIME_CONFIG.LATE_THRESHOLD_MINUTES) {
        autoStatus = 'late';
      }
    }

    studentsInSelectedClass.forEach((student) => {
      handleLayerAttendanceChange(student.id, {
        check_in: true,
        check_in_time: currentTime,
        status: autoStatus,
        user_modified: true,
        ai_predicted: false,
      });
    });
  }, [studentsInSelectedClass, selectedClassForLayer, handleLayerAttendanceChange]);

  // 개별 학생 저장 핸들러 (stateOverride: 현재 저장할 상태를 직접 전달받음)
  const handleSaveStudent = useCallback(async (studentId: string, stateOverride: Partial<StudentAttendanceState>) => {
    if (!selectedClassIdForLayer) return;

    const student = studentsInSelectedClass.find((s) => s.id === studentId);
    const currentState = studentAttendanceStates[studentId];

    if (!student) return;

    // stateOverride를 currentState에 병합하여 최신 상태로 저장
    const state = { ...currentState, ...stateOverride };

    if (import.meta.env?.DEV) {
      console.log('[AttendancePage] 💾 개별 학생 저장 시작:', {
        studentId,
        studentName: student.name,
        currentState,
        stateOverride,
        mergedState: state,
      });
    }

    try {
      const attendanceRecords: CreateAttendanceLogInput[] = [];

      // status가 null인 경우: DB 레코드 삭제 (출석 취소)
      if (state.status === null) {
        const supabase = createClient();

        // KST 날짜를 UTC 범위로 변환
        const kstStartTime = toKST(selectedDate).startOf('day');
        const kstEndTime = toKST(selectedDate).endOf('day');
        const utcStart = kstStartTime.utc().format('YYYY-MM-DDTHH:mm:ssZ');
        const utcEnd = kstEndTime.utc().format('YYYY-MM-DDTHH:mm:ssZ');

        const { error: deleteError } = await supabase
          .from('attendance_logs')
          .delete()
          .eq('student_id', studentId)
          .eq('class_id', selectedClassIdForLayer)
          .is('attendance_type', null)
          .gte('occurred_at', utcStart)
          .lte('occurred_at', utcEnd);

        if (deleteError) {
          console.error('[AttendancePage] ❌ 삭제 오류:', deleteError);
          throw deleteError;
        }
      } else {
        // [Phase 7] 이중 레코드 패턴: check_in/check_out 이벤트 + 수업 출석 레코드
        const selectedClass = selectedDateClasses.find((c) => c.id === selectedClassIdForLayer);

        // 1. check_in/check_out 이벤트 레코드
        const eventRecords = createAttendanceRecords(
          state,
          selectedDate,
          selectedClass?.start_time
        );
        attendanceRecords.push(...eventRecords);

        // 2. 수업 출석 레코드
        const occurredAt = state.check_in && state.check_in_time
          ? (() => {
              const [hour, minute] = state.check_in_time.split(':').map(Number);
              return toKST(selectedDate).hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm:ssZ');
            })()
          : selectedClass?.start_time
            ? (() => {
                const [hour, minute] = selectedClass.start_time.split(':').map(Number);
                return toKST(selectedDate).hour(hour).minute(minute).second(0).format('YYYY-MM-DDTHH:mm:ssZ');
              })()
            : toKST().format('YYYY-MM-DDTHH:mm:ssZ');

        attendanceRecords.push({
          student_id: studentId,
          class_id: selectedClassIdForLayer,
          occurred_at: occurredAt,
          attendance_type: null,
          status: state.status,
          check_in_method: state.check_in ? 'manual' : undefined,
        });

        // UPSERT 레코드 처리
        for (const record of attendanceRecords) {
          await upsertAttendance.mutateAsync(record);
        }
      }

      // 저장 완료 후 데이터 다시 불러오기
      await queryClient.invalidateQueries({ queryKey: ['attendance_logs'] });

      // user_modified 플래그 초기화
      setStudentAttendanceStates((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          user_modified: false,
        },
      }));

      showAlert(terms.MESSAGES.SAVE_SUCCESS, terms.MESSAGES.SUCCESS, 'success');
    } catch (error) {
      showAlert(terms.MESSAGES.SAVE_ERROR, terms.MESSAGES.ERROR, 'error');
      throw error;
    }
  }, [
    selectedClassIdForLayer,
    studentsInSelectedClass,
    studentAttendanceStates,
    selectedDate,
    selectedDateClasses,
    upsertAttendance,
    showAlert,
    terms,
    queryClient,
  ]);

  // ========== END 새로운 시간대별 그룹화 UI ==========

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!isMobileMode && (
          <SubSidebar
            title={templates.management(terms.ATTENDANCE_LABEL)}
            items={subMenuItemsWithIcons}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            testId="attendance-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <div style={{ flex: 1 }}>
          {/* 수업별 출결 탭 */}
          {selectedSubMenu === 'today' && (
            <RightLayerMenuLayout
              layerMenu={{
                isOpen: !!selectedClassIdForLayer,
                onClose: handleLayerClose,
                title: selectedClassForLayer ? (
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--spacing-sm)', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 'var(--font-size-3xl)',
                        fontWeight: 'var(--font-weight-extrabold)',
                        lineHeight: 'var(--line-height-tight)',
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {selectedClassForLayer.name}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {terms.ATTENDANCE_LABEL} {selectedClassForLayer.start_time.substring(0, 5)} ~ {selectedClassForLayer.end_time.substring(0, 5)}
                    </span>
                  </span>
                ) : terms.ATTENDANCE_LABEL,
                contentKey: selectedClassIdForLayer || undefined,
                children: selectedClassForLayer && (
                  <ClassAttendanceLayer
                    classInfo={selectedClassForLayer}
                    students={studentsInSelectedClass}
                    attendanceStates={studentAttendanceStates}
                    checkInLogsMap={attendanceLogsMap.checkInMap}
                    onAttendanceChange={handleLayerAttendanceChange}
                    onBulkCheckIn={handleLayerBulkCheckIn}
                    onSaveStudent={handleSaveStudent}
                    isSaving={isSaving}
                  />
                ),
              }}
            >
              {/* 메인 콘텐츠 */}
              <Container maxWidth="xl" padding="lg">
                <PageHeader
                  title={subMenuItemsWithIcons.find(item => item.id === selectedSubMenu)?.label || templates.management(terms.ATTENDANCE_LABEL)}
                  style={{ marginBottom: 'var(--spacing-xl)' }}
                />

              {/* AttendanceSummary: 총원/출석/지각/결석 (아키텍처 문서 3.3.3: 상단 통계) */}
              <div style={{ marginBottom: 'calc(var(--spacing-xl) * 2)', pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
                {/* 시간대 필터 배지 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: 'var(--spacing-md)',
                }}>
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    {[
                      { value: 'all', label: '전체' },
                      { value: 'morning', label: '오전' },
                      { value: 'afternoon', label: '오후' },
                      { value: 'evening', label: '저녁' },
                    ].map((option) => {
                      const isSelected = timeRangeFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setTimeRangeFilter(option.value as TimeRangeFilter)}
                          style={{
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-medium)',
                            backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-white)',
                            color: isSelected ? 'var(--color-white)' : 'var(--color-text-secondary)',
                            border: isSelected ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                            borderRadius: 'var(--border-radius-xs)',
                            cursor: 'pointer',
                            transition: 'var(--transition-all)',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'var(--color-white)';
                            }
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 통계 카드 */}
                <div style={{ contain: 'layout style' }}>
                <StatsDashboard
                  statsItems={[
                    {
                      key: 'total',
                      icon: Users,
                      title: terms.TOTAL_LABEL,
                      value: attendanceSummary.total,
                      unit: '명',
                      iconBackgroundColor: 'var(--color-gray-100)',
                    },
                    {
                      key: 'present',
                      icon: UserCheck,
                      title: terms.PRESENT_LABEL,
                      value: attendanceSummary.present,
                      unit: '명',
                      iconBackgroundColor: 'var(--color-success-50)',
                    },
                    {
                      key: 'late',
                      icon: Clock,
                      title: terms.LATE_LABEL,
                      value: attendanceSummary.late,
                      unit: '명',
                      iconBackgroundColor: 'var(--color-warning-50)',
                    },
                    {
                      key: 'absent',
                      icon: UserX,
                      title: terms.ABSENCE_LABEL,
                      value: attendanceSummary.absent,
                      unit: '명',
                      iconBackgroundColor: 'var(--color-error-50)',
                    },
                  ]}
                  chartData={attendanceChartData}
                  hideChart={true}
                  showPeriodFilter={false}
                  chartType="bar"
                  showZeroValues={true}
                  desktopColumns={4}
                  tabletColumns={2}
                  mobileColumns={2}
                  chartTooltipUnit="명"
                  chartTooltipLabel="등원 학생수"
                />
                </div>
              </div>

              {/* 수업 카드 목록 - 시간대별 분류 */}
              {(() => {
                const now = toKST();
                const today = now.format('YYYY-MM-DD');
                const currentTime = now.format('HH:mm');

                // 수업 분류
                const pastClasses: typeof filteredByTimeRange = [];
                const currentClasses: typeof filteredByTimeRange = [];
                const upcomingClasses: typeof filteredByTimeRange = [];

                filteredByTimeRange.forEach((cls) => {
                  const startTime = cls.start_time.substring(0, 5);
                  const endTime = cls.end_time.substring(0, 5);

                  if (selectedDate !== today) {
                    // 오늘이 아닌 경우
                    if (selectedDate < today) {
                      pastClasses.push(cls);
                    } else {
                      upcomingClasses.push(cls);
                    }
                  } else {
                    // 오늘인 경우
                    if (currentTime >= endTime) {
                      pastClasses.push(cls);
                    } else if (currentTime >= startTime && currentTime < endTime) {
                      currentClasses.push(cls);
                    } else {
                      upcomingClasses.push(cls);
                    }
                  }
                });

                // 과목별 배지 색상 매핑
                const getBadgeColor = (subject?: string, isEnded?: boolean): 'primary' | 'success' | 'warning' | 'error' | 'secondary' | 'gray' => {
                  if (isEnded) return 'gray';
                  const subjectLower = (subject || '').toLowerCase();
                  if (subjectLower.includes('국어') || subjectLower.includes('korean')) return 'primary';
                  if (subjectLower.includes('수학') || subjectLower.includes('math')) return 'error';
                  if (subjectLower.includes('과학') || subjectLower.includes('science')) return 'success';
                  if (subjectLower.includes('영어') || subjectLower.includes('english')) return 'warning';
                  return 'secondary';
                };

                // 요일 배열 생성 헬퍼 함수
                const getDayOfWeekArray = (dayOfWeek: string | string[] | null | undefined): string[] => {
                  if (!dayOfWeek) return [];
                  if (Array.isArray(dayOfWeek)) {
                    return dayOfWeek.map(d => {
                      const dayMap: Record<string, string> = {
                        monday: '월', tuesday: '화', wednesday: '수',
                        thursday: '목', friday: '금', saturday: '토', sunday: '일'
                      };
                      return dayMap[d] || d;
                    });
                  }
                  const dayMap: Record<string, string> = {
                    monday: '월', tuesday: '화', wednesday: '수',
                    thursday: '목', friday: '금', saturday: '토', sunday: '일'
                  };
                  return [dayMap[dayOfWeek] || dayOfWeek];
                };

                // 수업 카드 렌더링 함수
                const renderClassCard = (classInfo: typeof filteredByTimeRange[0], type: 'past' | 'current' | 'upcoming') => {
                  const classStudents = studentsByClass.get(classInfo.id) || [];
                  const stats = calculateClassStats(classStudents, studentAttendanceStates);
                  const isEnded = type === 'past';
                  const isCurrent = type === 'current';

                  // 지각/결석 있는지 확인 (진행 중인 수업만)
                  const hasIssues = isCurrent && (stats.late > 0 || stats.absent > 0);

                  // 카드 스타일
                  const cardStyle: React.CSSProperties = isEnded
                    ? {
                        opacity: 0.75,
                        filter: 'grayscale(100%)',
                      }
                    : hasIssues
                    ? {
                        border: '2px solid var(--color-error)',
                        animation: 'pulse-border 2s ease-in-out infinite',
                      }
                    : {};

                  // 강사 정보 조회
                  const teacherInfo = classTeachersMap.get(classInfo.id);
                  const teacherProfiles = teacherInfo
                    ? teacherInfo.map(t => ({
                        imageUrl: t.profile_image_url,
                        name: t.name
                      }))
                    : undefined;

                  // 과목명과 강사명 조합 (배지 레이블)
                  const subjectAndTeacher = teacherInfo && teacherInfo.length > 0
                    ? `${classInfo.subject || '수업'} / ${teacherInfo.map(t => t.name).join(', ')}`
                    : classInfo.subject || '수업';

                  // 요일 배열
                  const dayOfWeekArray = getDayOfWeekArray(classInfo.day_of_week);

                  // 등록된 학생 수 계산 (studentsByClass에서 조회)
                  const studentCount = classStudents.length;

                  return (
                    <React.Fragment key={classInfo.id}>
                      {hasIssues && (
                        <style>
                          {`
                            @keyframes pulse-border {
                              0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-error) 40%, transparent); }
                              50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-error) 0%, transparent); }
                            }
                          `}
                        </style>
                      )}
                      <EntityCard
                        badge={{
                          label: subjectAndTeacher,
                          color: getBadgeColor(classInfo.subject, isEnded),
                        }}
                        title={classInfo.name}
                        mainValue={studentCount}
                        subValue={` / ${classInfo.capacity || 0}`}
                        dayOfWeek={dayOfWeekArray.length > 0 ? dayOfWeekArray : undefined}
                        description={`${classInfo.start_time.substring(0, 5)}~${classInfo.end_time.substring(0, 5)}`}
                        onClick={() => handleClassClick(classInfo.id)}
                        disabled={isEnded}
                        style={cardStyle}
                        valueAtBottom={true}
                        profiles={teacherProfiles}
                      />
                    </React.Fragment>
                  );
                };

                // 섹션 헤더 스타일 - [Deferred] 섹션 헤더 UI 구현 시 사용
                const _sectionHeaderStyle: React.CSSProperties = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  marginBottom: 'var(--spacing-md)',
                };
                void _sectionHeaderStyle;

                const sectionTitleStyle: React.CSSProperties = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-extrabold)',
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--spacing-md)',
                };

                const gridStyle: React.CSSProperties = {
                  display: 'grid',
                  gridTemplateColumns: isMobileMode ? '1fr' : isTabletMode ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                  gap: 'var(--spacing-md)',
                };

                return (
                  <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
                    {/* 진행 중 수업 */}
                    {currentClasses.length > 0 && (
                      <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
                        <div style={sectionTitleStyle}>
                          <Play size={22} strokeWidth={1.5} style={{ color: 'var(--color-text-primary)' }} />
                          진행 중 수업 ({currentClasses.length}개)
                        </div>
                        <div style={gridStyle}>
                          {currentClasses.map((cls) => renderClassCard(cls, 'current'))}
                        </div>
                      </div>
                    )}

                    {/* 다음 수업 */}
                    {upcomingClasses.length > 0 && (
                      <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
                        <div style={sectionTitleStyle}>
                          <CalendarClock size={22} strokeWidth={1.5} style={{ color: 'var(--color-text-primary)' }} />
                          다음 수업 ({upcomingClasses.length}개)
                        </div>
                        <div style={gridStyle}>
                          {upcomingClasses.map((cls) => renderClassCard(cls, 'upcoming'))}
                        </div>
                      </div>
                    )}

                    {/* 지난 수업 */}
                    {pastClasses.length > 0 && (
                      <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
                        <div style={sectionTitleStyle}>
                          <CalendarX size={22} strokeWidth={1.5} style={{ color: 'var(--color-text-primary)' }} />
                          지난 수업 ({pastClasses.length}개)
                        </div>
                        <div style={gridStyle}>
                          {pastClasses.map((cls) => renderClassCard(cls, 'past'))}
                        </div>
                      </div>
                    )}

                    {/* 수업이 없는 경우 */}
                    {filteredByTimeRange.length === 0 && (
                      <Card padding="xl">
                        <EmptyState
                          icon={Users}
                          message={
                            timeRangeFilter === 'all'
                              ? `${selectedDate} (${DAY_NAMES[toKST(selectedDate).day()]})에 예정된 수업이 없습니다.`
                              : `${selectedDate} (${DAY_NAMES[toKST(selectedDate).day()]}) ${TIME_RANGE_CONFIG[timeRangeFilter.toUpperCase() as keyof typeof TIME_RANGE_CONFIG].LABEL}에 예정된 수업이 없습니다.`
                          }
                        />
                      </Card>
                    )}
                  </div>
                );
              })()}
              </Container>
            </RightLayerMenuLayout>
          )}

        {/* 학생별 출결 탭 */}
        {selectedSubMenu === 'by-student' && (
          <Container>
            <EmptyState
              message={`${terms.PERSON_LABEL_PRIMARY}별 ${terms.ATTENDANCE_LABEL}`}
              description="준비 중인 기능입니다."
            />
          </Container>
        )}

        {/* 출결기록 탭 */}
        {selectedSubMenu === 'history' && (() => {
          // 수업 맵 생성 (classId -> classInfo)
          const classMap = new Map<string, { id: string; name: string; start_time: string; end_time: string }>();
          (classes || []).forEach(c => {
            classMap.set(c.id, { id: c.id, name: c.name, start_time: c.start_time, end_time: c.end_time });
          });

          // 학생 맵 생성 (studentId -> studentName)
          const studentMap = new Map<string, string>();
          (students || []).forEach(s => {
            studentMap.set(s.id, s.name);
          });

          // 로그 필터링 (학생명 검색)
          const filteredLogs = historySearchQuery
            ? attendanceLogs.filter(log => {
                const studentName = studentMap.get(log.student_id) || '';
                return studentName.toLowerCase().includes(historySearchQuery.toLowerCase());
              })
            : attendanceLogs;

          // 날짜별 그룹화
          const dailyGroups = groupAttendanceByDate(filteredLogs, classMap, studentMap);

          // 수업 펼침/접힘 토글 핸들러
          const handleToggleClass = (classKey: string) => {
            setExpandedHistoryClasses(prev => {
              const next = new Set(prev);
              if (next.has(classKey)) {
                next.delete(classKey);
              } else {
                next.add(classKey);
              }
              return next;
            });
          };

          return (
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
                출결기록
              </h3>
              {/* 필터 */}
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-lg)' }}>
                <div style={{ flex: 1, minWidth: '140px', maxWidth: '180px' }}>
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
                <div style={{ flex: 1, minWidth: '140px', maxWidth: '180px' }}>
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
                <div style={{ flex: 1, minWidth: '140px', maxWidth: '200px' }}>
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
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    marginBottom: 'var(--spacing-xs)',
                  }}>
                    {terms.PERSON_LABEL_PRIMARY}명 검색
                  </label>
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder={`${terms.PERSON_LABEL_PRIMARY}명으로 검색...`}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: 'var(--border-width-thin) solid var(--color-border)',
                      borderRadius: 'var(--border-radius-md)',
                      fontSize: 'var(--font-size-base)',
                    }}
                  />
                </div>
              </div>

              {/* 범례 */}
              <div style={{
                display: 'flex',
                gap: 'var(--spacing-lg)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 'var(--border-radius-md)',
                marginBottom: 'var(--spacing-lg)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                flexWrap: 'wrap',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xs)' }}>
                  <span style={{ color: 'var(--color-success)' }}>✓</span> {terms.PRESENT_LABEL}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xs)' }}>
                  <span style={{ color: 'var(--color-warning)' }}>△</span> {terms.LATE_LABEL}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xs)' }}>
                  <span style={{ color: 'var(--color-error)' }}>✗</span> {terms.ABSENCE_LABEL}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xs)' }}>
                  <span style={{ color: 'var(--color-info)' }}>○</span> {terms.EXCUSED_LABEL}
                </span>
              </div>

              {/* 출결 기록 - 날짜별 타임라인 뷰 */}
              {isLoadingLogs ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                  {terms.MESSAGES.LOADING}
                </div>
              ) : dailyGroups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {dailyGroups.map((group) => (
                    <DailyAttendanceSection
                      key={group.date}
                      group={group}
                      expandedClassIds={expandedHistoryClasses}
                      onToggleClass={handleToggleClass}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={History} message="선택한 기간에 출결 기록이 없습니다." />
              )}
            </Card>
          </div>
          );
        })()}

        {/* 출결통계 탭 */}
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

        {/* 출결설정 탭 */}
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
        </div>
      </div>
    </ErrorBoundary>
  );
}
