/**
 * 출결 관리 페이지 데이터 훅
 * AttendancePage의 모든 상태, 데이터 페칭, 핸들러를 캡슐화
 *
 * [LAYER: UI_PAGE]
 */

import { createElement, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useResponsiveMode, isMobile, isTablet, useModal } from '@ui-core/react';
import { CalendarCheck, Users, History, BarChart3, Settings } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getDefaultDateRange,
  createAttendanceRecords,
  isClassStarted,
  ATTENDANCE_TIME_CONFIG,
  TIME_RANGE_CONFIG,
  DAY_OF_WEEK_MAP,
  type ClassInfo,
  type StudentAttendanceState,
} from '../../../components/attendance';
import { ATTENDANCE_SUB_MENU_ITEMS, DEFAULT_ATTENDANCE_SUB_MENU, ATTENDANCE_MENU_LABEL_MAPPING, getSubMenuFromUrl, setSubMenuToUrl, applyDynamicLabels } from '../../../constants';
import type { AttendanceSubMenuId } from '../../../constants';
import { templates } from '../../../utils';
import { useAttendanceLogs, useUpsertAttendanceLog } from '@hooks/use-attendance';
import { useStudents } from '@hooks/use-student';
import { useClasses, useTeachersWithStats } from '@hooks/use-class';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { useConfig, useUpdateConfig } from '@hooks/use-config';
import { apiClient, getApiContext } from '@api-sdk/core';
import { createClient } from '@lib/supabase-client';
import { toKST } from '@lib/date-utils';
import type { AttendanceFilter, AttendanceStatus, AttendanceLog, CreateAttendanceLogInput } from '@services/attendance-service';
import type { Student, StudentClass } from '@services/student-service';
import type { ClassTeacher } from '@services/class-service';
import type { TimeRangeFilter } from '../components/TimeRangeFilterBadges';

export function useAttendancePageData() {
  // ==================== 반응형 ====================
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);

  // ==================== 기본 상태 ====================
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  useEffect(() => { setSidebarCollapsed(isTabletMode); }, [isTabletMode]);

  const terms = useIndustryTerms();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { showAlert } = useModal();
  const queryClient = useQueryClient();

  // ==================== 데이터 페칭 ====================
  const { data: teachers } = useTeachersWithStats();
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

  const classTeachersMap = useMemo(() => {
    if (!allClassTeachers || !teachers) {
      return new Map<string, Array<{ name: string; profile_image_url?: string | null }>>();
    }
    const map = new Map<string, Array<{ name: string; profile_image_url?: string | null }>>();
    allClassTeachers.forEach(ct => {
      const teacher = teachers.find(t => t.id === ct.teacher_id);
      if (teacher) {
        if (!map.has(ct.class_id)) map.set(ct.class_id, []);
        map.get(ct.class_id)!.push({ name: teacher.name, profile_image_url: teacher.profile_image_url });
      }
    });
    return map;
  }, [allClassTeachers, teachers]);

  // ==================== 출결 상태 ====================
  const [selectedClassId, _setSelectedClassId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('attendance-page-selected-class');
      if (!stored || stored.trim() === '' || stored === 'all') return null;
      return stored;
    } catch { return null; }
  });
  void _setSelectedClassId;
  const [selectedDate, _setSelectedDate] = useState<string>(toKST().format('YYYY-MM-DD'));
  void _setSelectedDate;
  const [searchQuery, _setSearchQuery] = useState<string>('');
  void _setSearchQuery;
  const [checkInMethodFilter, _setCheckInMethodFilter] = useState<string>('');
  void _setCheckInMethodFilter;
  const [studentAttendanceStates, setStudentAttendanceStates] = useState<Record<string, StudentAttendanceState>>({});
  const studentAttendanceStatesRef = useRef<Record<string, StudentAttendanceState>>({});
  useEffect(() => { studentAttendanceStatesRef.current = studentAttendanceStates; }, [studentAttendanceStates]);
  const [isSaving, _setIsSaving] = useState(false);
  void _setIsSaving;
  const [selectedClassIdForLayer, setSelectedClassIdForLayer] = useState<string | null>(null);

  // 필터 상태
  const defaultDateRange = getDefaultDateRange();
  const [filter, setFilter] = useState<AttendanceFilter>({
    date_from: defaultDateRange.dateFrom,
    date_to: defaultDateRange.dateTo,
  });

  // 시간대 필터
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('all');

  // 출결 설정
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  void updateConfig;

  // ==================== URL 서브 메뉴 ====================
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const validSubMenuIds = ATTENDANCE_SUB_MENU_ITEMS.map(item => item.id) as readonly AttendanceSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl<AttendanceSubMenuId>(searchParams, validSubMenuIds, DEFAULT_ATTENDANCE_SUB_MENU);

  const handleSubMenuChange = useCallback((id: AttendanceSubMenuId) => {
    navigate(setSubMenuToUrl(id, DEFAULT_ATTENDANCE_SUB_MENU));
  }, [navigate]);

  const subMenuItemsWithIcons = useMemo(() => {
    const iconMap: Record<AttendanceSubMenuId, ReturnType<typeof createElement>> = {
      today: createElement(CalendarCheck, { size: 16 }),
      'by-student': createElement(Users, { size: 16 }),
      history: createElement(History, { size: 16 }),
      statistics: createElement(BarChart3, { size: 16 }),
      settings: createElement(Settings, { size: 16 }),
    };
    const itemsWithDynamicLabels = applyDynamicLabels(ATTENDANCE_SUB_MENU_ITEMS, ATTENDANCE_MENU_LABEL_MAPPING, terms);
    return itemsWithDynamicLabels.map(item => ({
      ...item,
      icon: iconMap[item.id],
    }));
  }, [terms]);

  // ==================== 데이터 조회 ====================
  const { data: attendanceLogsData, isLoading: isLoadingLogs, error: errorLogs } = useAttendanceLogs(filter);
  const attendanceLogs: AttendanceLog[] = useMemo(() => attendanceLogsData || [], [attendanceLogsData]);
  const { data: students, isLoading: isLoadingStudents, error: errorStudents } = useStudents();
  const { data: classes, isLoading: isLoadingClasses, error: errorClasses } = useClasses();

  // 선택된 날짜의 요일에 해당하는 수업 목록
  const selectedDateClasses = useMemo(() => {
    if (!classes || !selectedDate) return [];
    const dateKST = toKST(selectedDate);
    const dayOfWeekNumber = dateKST.day();
    const targetDayOfWeek = DAY_OF_WEEK_MAP[dayOfWeekNumber];
    return classes.filter(c => {
      const dayOfWeek = c.day_of_week;
      const hasDay = Array.isArray(dayOfWeek)
        ? dayOfWeek.includes(targetDayOfWeek as typeof dayOfWeek[number])
        : dayOfWeek === targetDayOfWeek;
      return hasDay && c.status === 'active';
    });
  }, [classes, selectedDate]);

  // 시간대별 필터
  const filteredByTimeRange = useMemo(() => {
    if (timeRangeFilter === 'all') return selectedDateClasses;
    return selectedDateClasses.filter(cls => {
      const startHour = parseInt(cls.start_time.substring(0, 2), 10);
      switch (timeRangeFilter) {
        case 'morning': return startHour >= TIME_RANGE_CONFIG.MORNING.START && startHour < TIME_RANGE_CONFIG.MORNING.END;
        case 'afternoon': return startHour >= TIME_RANGE_CONFIG.AFTERNOON.START && startHour < TIME_RANGE_CONFIG.AFTERNOON.END;
        case 'evening': return startHour >= TIME_RANGE_CONFIG.EVENING.START && startHour < TIME_RANGE_CONFIG.EVENING.END;
        default: return true;
      }
    });
  }, [selectedDateClasses, timeRangeFilter]);

  const selectedDateClassIds = useMemo(() => {
    if (!selectedDateClasses || selectedDateClasses.length === 0) return [];
    return selectedDateClasses.map(c => c.id);
  }, [selectedDateClasses]);

  // 학생-수업 매핑
  const { data: studentClassesData } = useQuery({
    queryKey: ['student_classes_for_date', tenantId, selectedDateClassIds],
    queryFn: async () => {
      if (selectedDateClassIds.length === 0) return [];
      const PAGE_SIZE = 1000;
      let allData: StudentClass[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        // eslint-disable-next-line no-restricted-syntax -- batch query by multiple class_ids not supported by hook
        const response = await apiClient.get<StudentClass>('student_classes', {
          filters: { class_id: selectedDateClassIds, is_active: true },
          range: { from, to: from + PAGE_SIZE - 1 },
        });
        if (response.error) throw new Error(response.error.message);
        const chunk = response.data || [];
        allData = allData.concat(chunk);
        hasMore = chunk.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allData;
    },
    enabled: !!tenantId && selectedDateClassIds.length > 0,
    staleTime: 30 * 1000,
  });

  const todayStudentIds = useMemo(() => {
    if (!studentClassesData) return new Set<string>();
    return new Set(studentClassesData.map(sc => sc.student_id));
  }, [studentClassesData]);

  const todayStudents = useMemo(() => {
    if (!students || todayStudentIds.size === 0) return [];
    return students.filter(s => todayStudentIds.has(s.id));
  }, [students, todayStudentIds]);

  const { data: selectedClassStudents } = useStudents(
    selectedClassId && selectedClassId.trim() !== '' ? { class_id: selectedClassId } : undefined
  );

  // ==================== 출결 로그 인덱싱 ====================
  const attendanceLogsMap = useMemo(() => {
    const checkInMap = new Map<string, AttendanceLog>();
    const checkOutMap = new Map<string, AttendanceLog>();
    const classAttendanceMap = new Map<string, AttendanceLog>();

    attendanceLogs.forEach(log => {
      if (log.attendance_type === 'check_in') {
        const existingLog = checkInMap.get(log.student_id);
        if (!existingLog || new Date(log.occurred_at) > new Date(existingLog.occurred_at)) {
          checkInMap.set(log.student_id, log);
        }
      } else if (log.attendance_type === 'check_out') {
        const existingLog = checkOutMap.get(log.student_id);
        if (!existingLog || new Date(log.occurred_at) > new Date(existingLog.occurred_at)) {
          checkOutMap.set(log.student_id, log);
        }
      } else if (log.attendance_type === null && log.class_id) {
        const activeClassId = selectedClassIdForLayer || selectedClassId;
        if (!activeClassId || activeClassId === log.class_id) {
          const key = `${log.student_id}-${log.class_id}`;
          const existingLog = classAttendanceMap.get(key);
          const existingTime = existingLog ? new Date(existingLog.occurred_at).getTime() : 0;
          const currentTime = new Date(log.occurred_at).getTime();
          const existingId = existingLog?.id ? Number(existingLog.id) : 0;
          const currentId = log.id ? Number(log.id) : 0;
          const isNewer = !existingLog || currentTime > existingTime || (currentTime === existingTime && currentId > existingId);
          if (isNewer) {
            classAttendanceMap.set(key, log);
          }
        }
      }
    });

    return { checkInMap, checkOutMap, classAttendanceMap };
  }, [attendanceLogs, selectedClassId, selectedClassIdForLayer]);

  // ==================== 학생 필터링 ====================
  const filteredStudents = useMemo(() => {
    const baseStudents = (selectedClassId && selectedClassId.trim() !== '')
      ? (selectedClassStudents || [])
      : todayStudents;
    if (!baseStudents || baseStudents.length === 0) return [];
    let result = baseStudents;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => s.name?.toLowerCase().includes(query) || s.phone?.includes(query));
    }
    if (checkInMethodFilter && checkInMethodFilter !== '') {
      result = result.filter(s => {
        const log = attendanceLogsMap.checkInMap.get(s.id);
        return (log?.check_in_method || 'manual') === checkInMethodFilter;
      });
    }
    return result;
  }, [todayStudents, selectedClassId, selectedClassStudents, searchQuery, checkInMethodFilter, attendanceLogsMap]);

  // AI 예측 (비활성화)
  const aiPredictions = useMemo<Record<string, { check_in: boolean; check_out: boolean; status: AttendanceStatus }>>(() => ({}), []);
  const isLoadingPredictions = false;

  const isLoading = isLoadingLogs || isLoadingStudents || isLoadingClasses || isLoadingPredictions;
  const _error = errorLogs || errorStudents || errorClasses;
  void _error;

  // ==================== 상태 동기화 ====================
  useEffect(() => {
    if (isLoadingPredictions) return;
    if (filteredStudents.length === 0) return;

    const newStates: Record<string, StudentAttendanceState> = {};
    filteredStudents.forEach(student => {
      const currentState: StudentAttendanceState | undefined = studentAttendanceStatesRef.current[student.id];
      if (currentState?.user_modified) {
        newStates[student.id] = currentState;
        return;
      }

      const savedCheckInLog = attendanceLogsMap.checkInMap.get(student.id);
      const savedCheckOutLog = attendanceLogsMap.checkOutMap.get(student.id);
      const activeClassId = selectedClassIdForLayer || selectedClassId;
      const classAttendanceKey = activeClassId ? `${student.id}-${activeClassId}` : undefined;
      const savedClassAttendanceLog = classAttendanceKey
        ? attendanceLogsMap.classAttendanceMap.get(classAttendanceKey)
        : undefined;

      if (savedCheckInLog || savedCheckOutLog || savedClassAttendanceLog) {
        const status = savedClassAttendanceLog?.status ?? null;
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
            status: null,
            ai_predicted: false,
            user_modified: false,
          };
        }
      }
    });

    setStudentAttendanceStates(newStates);
  }, [aiPredictions, isLoadingPredictions, filteredStudents, attendanceLogsMap, selectedClassId, selectedClassIdForLayer]);

  // 수업/날짜 변경 시 필터 업데이트
  useEffect(() => {
    setFilter({
      date_from: selectedDate,
      date_to: selectedDate,
      class_id: selectedClassId || undefined,
    });
    setStudentAttendanceStates({});
  }, [selectedClassId, selectedDate]);

  // ==================== 출결 UPSERT ====================
  const upsertAttendance = useUpsertAttendanceLog();

  // ==================== 출결 요약 통계 ====================
  const attendanceSummary = useMemo(() => {
    const filteredClassIds = new Set(filteredByTimeRange.map(cls => cls.id));
    const relevantStudents = studentClassesData?.filter(sc => filteredClassIds.has(sc.class_id)).map(sc => sc.student_id) || [];
    const relevantStudentSet = new Set(relevantStudents);
    const states = Object.entries(studentAttendanceStates).filter(([studentId]) => relevantStudentSet.has(studentId));
    const total = relevantStudents.length;
    const present = states.filter(([, s]) => s.check_in && s.status === 'present').length;
    const late = states.filter(([, s]) => s.check_in && s.status === 'late').length;
    const absent = states.filter(([, s]) => s.status === 'absent').length;
    return { total, present, late, absent };
  }, [studentAttendanceStates, filteredByTimeRange, studentClassesData]);

  // 차트 데이터
  const attendanceChartData = useMemo(() => {
    if (!filteredByTimeRange || filteredByTimeRange.length === 0) return [];
    return filteredByTimeRange.map((cls) => {
      const classStudents = studentClassesData?.filter(sc => sc.class_id === cls.id) || [];
      const studentIds = new Set(classStudents.map(sc => sc.student_id));
      const states = Object.entries(studentAttendanceStates).filter(([studentId]) => studentIds.has(studentId));
      const present = states.filter(([, s]) => s.check_in && s.status === 'present').length;
      const late = states.filter(([, s]) => s.check_in && s.status === 'late').length;
      return { name: cls.name, value: present + late, color: 'var(--color-primary)' };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredByTimeRange, studentClassesData, studentAttendanceStates]);

  // ==================== 수업별 학생 매핑 ====================
  const studentsByClass = useMemo(() => {
    const map = new Map<string, Student[]>();
    if (!studentClassesData || !students) return map;
    studentClassesData.forEach((sc) => {
      const student = students.find((s) => s.id === sc.student_id);
      if (student) {
        if (!map.has(sc.class_id)) map.set(sc.class_id, []);
        map.get(sc.class_id)!.push(student);
      }
    });
    return map;
  }, [studentClassesData, students]);

  // 선택된 수업 정보 (레이어용)
  const selectedClassForLayer = useMemo(() => {
    if (!selectedClassIdForLayer) return null;
    const cls = selectedDateClasses.find((c) => c.id === selectedClassIdForLayer);
    if (!cls) return null;
    return {
      id: cls.id, name: cls.name,
      start_time: cls.start_time, end_time: cls.end_time,
      day_of_week: cls.day_of_week, status: cls.status,
    } as ClassInfo;
  }, [selectedClassIdForLayer, selectedDateClasses]);

  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassIdForLayer) return [];
    return studentsByClass.get(selectedClassIdForLayer) || [];
  }, [selectedClassIdForLayer, studentsByClass]);

  // ==================== 핸들러 ====================
  const handleClassClick = useCallback((classId: string) => {
    setSelectedClassIdForLayer(classId);
  }, []);

  const handleLayerClose = useCallback(() => {
    setSelectedClassIdForLayer(null);
  }, []);

  const handleLayerAttendanceChange = useCallback(
    (studentId: string, changes: Partial<StudentAttendanceState>) => {
      setStudentAttendanceStates((prev) => {
        const current = prev[studentId] || {
          student_id: studentId,
          check_in: false, check_out: false,
          status: null, user_modified: false,
        };
        return { ...prev, [studentId]: { ...current, ...changes } };
      });
    },
    []
  );

  // 자동 출석 확정 (scheduled → present)
  useEffect(() => {
    if (!selectedClassForLayer) return;
    const checkAndConvertScheduled = () => {
      if (!isClassStarted(selectedClassForLayer.start_time)) return;
      Object.entries(studentAttendanceStates).forEach(([studentId, state]) => {
        if (state.status === 'scheduled') {
          handleLayerAttendanceChange(studentId, {
            status: 'present', user_modified: false, ai_predicted: false,
          });
        }
      });
    };
    checkAndConvertScheduled();
    const interval = setInterval(checkAndConvertScheduled, 60000);
    return () => clearInterval(interval);
  }, [selectedClassForLayer, studentAttendanceStates, handleLayerAttendanceChange]);

  const handleLayerBulkCheckIn = useCallback(() => {
    const currentTime = toKST().format('HH:mm');
    const classStartTime = selectedClassForLayer?.start_time;
    let autoStatus: 'present' | 'late' = 'present';
    if (classStartTime) {
      const [ciH, ciM] = currentTime.split(':').map(Number);
      const [csH, csM] = classStartTime.split(':').map(Number);
      const diff = (ciH * 60 + ciM) - (csH * 60 + csM);
      if (diff > ATTENDANCE_TIME_CONFIG.LATE_THRESHOLD_MINUTES) autoStatus = 'late';
    }
    studentsInSelectedClass.forEach((student) => {
      handleLayerAttendanceChange(student.id, {
        check_in: true, check_in_time: currentTime,
        status: autoStatus, user_modified: true, ai_predicted: false,
      });
    });
  }, [studentsInSelectedClass, selectedClassForLayer, handleLayerAttendanceChange]);

  const handleSaveStudent = useCallback(async (studentId: string, stateOverride: Partial<StudentAttendanceState>) => {
    if (!selectedClassIdForLayer) return;
    const student = studentsInSelectedClass.find((s) => s.id === studentId);
    const currentState = studentAttendanceStates[studentId];
    if (!student) return;

    const state = { ...currentState, ...stateOverride };

    try {
      const attendanceRecords: CreateAttendanceLogInput[] = [];

      if (state.status === null) {
        const supabase = createClient();
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

        if (deleteError) throw deleteError;
      } else {
        const selectedClass = selectedDateClasses.find((c) => c.id === selectedClassIdForLayer);
        const eventRecords = createAttendanceRecords(state, selectedDate, selectedClass?.start_time);
        attendanceRecords.push(...eventRecords);

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

        for (const record of attendanceRecords) {
          await upsertAttendance.mutateAsync(record);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['attendance_logs'] });

      setStudentAttendanceStates((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], user_modified: false },
      }));

      showAlert(terms.MESSAGES.SAVE_SUCCESS, terms.MESSAGES.SUCCESS, 'success');
    } catch (error) {
      showAlert(terms.MESSAGES.SAVE_ERROR, terms.MESSAGES.ERROR, 'error');
      throw error;
    }
  }, [
    selectedClassIdForLayer, studentsInSelectedClass, studentAttendanceStates,
    selectedDate, selectedDateClasses, upsertAttendance, showAlert, terms, queryClient,
  ]);

  return {
    // 반응형
    isMobileMode,
    isTabletMode,
    // 서브 사이드바
    sidebarCollapsed,
    setSidebarCollapsed,
    selectedSubMenu,
    handleSubMenuChange,
    subMenuItemsWithIcons,
    // 용어
    terms,
    // 로딩/에러
    isLoading,
    isLoadingLogs,
    // 데이터
    attendanceLogs,
    classes,
    students,
    config,
    // 필터
    filter,
    setFilter,
    timeRangeFilter,
    setTimeRangeFilter,
    // 수업 카드
    filteredByTimeRange,
    selectedDate,
    studentsByClass,
    studentAttendanceStates,
    classTeachersMap,
    attendanceLogsMap,
    // 요약/차트
    attendanceSummary,
    attendanceChartData,
    // 레이어 메뉴
    selectedClassIdForLayer,
    selectedClassForLayer,
    studentsInSelectedClass,
    handleClassClick,
    handleLayerClose,
    handleLayerAttendanceChange,
    handleLayerBulkCheckIn,
    handleSaveStudent,
    isSaving,
    // 유틸
    templates,
  };
}
