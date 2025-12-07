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

import { useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input, Badge, Switch, Select, useModal } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import { useAttendanceLogs, useCreateAttendanceLog, useDeleteAttendanceLog } from '@hooks/use-attendance';
import { useStudents } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { useConfig, useUpdateConfig } from '@hooks/use-config';
import type { AttendanceFilter, AttendanceType, AttendanceStatus } from '@services/attendance-service';
import { useResponsiveMode } from '@ui-core/react';
import type { ColorToken } from '@design-system/core';
import { createAttendanceFormSchema } from '../schemas/attendance.schema';

export function AttendancePage() {
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';

  // 필터 상태
  const [filter, setFilter] = useState<AttendanceFilter>({
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
  });
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>();

  // QR 출결 상태
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // 통계/히트맵 상태
  const [showStatistics, setShowStatistics] = useState(false);

  // 출결 설정 상태
  const [showSettings, setShowSettings] = useState(false);
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
  const { data: attendanceLogs, isLoading, error } = useAttendanceLogs({
    ...filter,
    student_id: selectedStudentId,
    class_id: selectedClassId,
  });
  const { data: students } = useStudents();
  const { data: classes } = useClasses();

  // 출결 생성/삭제
  const createAttendance = useCreateAttendanceLog();
  const deleteAttendance = useDeleteAttendanceLog();

  // 필터 핸들러
  const handleFilterChange = (key: keyof AttendanceFilter, value: any) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  // 지각/결석 자동 판정 함수
  const determineAttendanceStatus = (
    occurredAt: Date,
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
    const occurredDayOfWeek = occurredAt.getDay();

    // 요일이 맞지 않으면 수동 입력값 사용
    if (classDayOfWeek !== occurredDayOfWeek) {
      return { status: 'present', attendance_type: 'check_in' };
    }

    // 반 시작 시간 파싱
    const [startHour, startMinute] = classInfo.start_time.split(':').map(Number);
    const classStartTime = new Date(occurredAt);
    classStartTime.setHours(startHour, startMinute, 0, 0);

    // 시간 차이 계산 (분)
    const diffMinutes = Math.floor((occurredAt.getTime() - classStartTime.getTime()) / (1000 * 60));

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
      videoRef.play().catch(console.error);
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoRef, stream]);

  // 설정 저장
  const handleSaveSettings = async () => {
    try {
      await updateConfig.mutateAsync({
        attendance: {
          late_after: attendanceConfig.late_after,
          absent_after: attendanceConfig.absent_after,
          auto_notification: attendanceConfig.auto_notification,
          notification_channel: attendanceConfig.notification_channel,
        },
      });
      setShowSettings(false);
      showAlert('설정이 저장되었습니다.', '저장 완료', 'success');
    } catch (error) {
      console.error('설정 저장 실패:', error);
      showAlert('설정 저장 중 오류가 발생했습니다.', '오류', 'error');
    }
  };

  // 출결 기록 생성
  const handleCreateAttendance = async (data: any) => {
    if (!data.student_id) {
      showAlert('학생을 선택해주세요.', '입력 오류', 'warning');
      return;
    }

    try {
      const occurredAt = new Date(data.occurred_at);
      const classInfo = data.class_id 
        ? classes?.find(c => c.id === data.class_id)
        : undefined;

      // 자동 판정 (반 정보가 있고 등원인 경우)
      let finalStatus = data.status;
      let finalType = data.attendance_type;
      
      if (data.attendance_type === 'check_in' && classInfo) {
        const autoDetermined = determineAttendanceStatus(
          occurredAt,
          classInfo,
          attendanceConfig.late_after,
          attendanceConfig.absent_after
        );
        finalStatus = autoDetermined.status;
        finalType = autoDetermined.attendance_type;
      }

      await createAttendance.mutateAsync({
        student_id: data.student_id,
        class_id: data.class_id || undefined,
        occurred_at: occurredAt.toISOString(),
        attendance_type: finalType,
        status: finalStatus,
        notes: data.notes || undefined,
      });

      // [문서 요구사항] 알림 발송은 서버에서 자동 처리됨 (core-notification → 학부모 알림)
      // 클라이언트에서는 알림 발송 로직을 제거하고, 서버에서 설정에 따라 자동 발송

      setShowCreateForm(false);
    } catch (error) {
      console.error('출결 기록 생성 실패:', error);
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
      console.error('카메라 접근 실패:', error);
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
      const now = new Date();
      await handleCreateAttendance({
        student_id: studentId,
        class_id: classId,
        occurred_at: now.toISOString().slice(0, 16),
        attendance_type: 'check_in',
        status: 'present',
      });
      
      handleStopQRScanner();
      showAlert(`${student.name}님의 등원이 기록되었습니다.`, '출결 기록 완료', 'success');
    } catch (error) {
      console.error('QR 스캔 처리 실패:', error);
      showAlert('QR 코드를 인식할 수 없습니다.', 'QR 스캔 오류', 'error');
    }
  };

  // 통계 계산
  const calculateStatistics = () => {
    if (!attendanceLogs || !classes) return null;

    const stats: Record<string, {
      total: number;
      present: number;
      late: number;
      absent: number;
      attendanceRate: number;
    }> = {};

    classes.forEach(cls => {
      const classLogs = attendanceLogs.filter(log => log.class_id === cls.id);
      const present = classLogs.filter(log => log.status === 'present').length;
      const late = classLogs.filter(log => log.status === 'late').length;
      const absent = classLogs.filter(log => log.status === 'absent').length;
      const total = classLogs.length;

      stats[cls.id] = {
        total,
        present,
        late,
        absent,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });

    return stats;
  };

  // 요일별 패턴 분석
  const analyzeDayPattern = () => {
    if (!attendanceLogs) return null;

    const dayStats: Record<string, { checkIn: number; checkOut: number; late: number }> = {
      '일': { checkIn: 0, checkOut: 0, late: 0 },
      '월': { checkIn: 0, checkOut: 0, late: 0 },
      '화': { checkIn: 0, checkOut: 0, late: 0 },
      '수': { checkIn: 0, checkOut: 0, late: 0 },
      '목': { checkIn: 0, checkOut: 0, late: 0 },
      '금': { checkIn: 0, checkOut: 0, late: 0 },
      '토': { checkIn: 0, checkOut: 0, late: 0 },
    };

    attendanceLogs.forEach(log => {
      const date = new Date(log.occurred_at);
      const dayName = date.toLocaleDateString('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' });
      
      if (dayStats[dayName]) {
        if (log.attendance_type === 'check_in') dayStats[dayName].checkIn++;
        if (log.attendance_type === 'check_out') dayStats[dayName].checkOut++;
        if (log.status === 'late') dayStats[dayName].late++;
      }
    });

    return dayStats;
  };

  // 시간대별 패턴 분석
  const analyzeTimePattern = () => {
    if (!attendanceLogs) return null;

    const timeStats: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      timeStats[i] = 0;
    }

    attendanceLogs.forEach(log => {
      const date = new Date(log.occurred_at);
      const hour = date.getHours();
      timeStats[hour] = (timeStats[hour] || 0) + 1;
    });

    return timeStats;
  };

  // 반별 출결 히트맵 계산 (문서 요구사항: 반별 출결 히트맵)
  const calculateClassHeatmap = () => {
    if (!attendanceLogs || !classes) return null;

    // 날짜 범위 계산
    const dates: string[] = [];
    const dateSet = new Set<string>();
    attendanceLogs.forEach(log => {
      const dateStr = new Date(log.occurred_at).toISOString().split('T')[0];
      dateSet.add(dateStr);
    });
    dates.push(...Array.from(dateSet).sort());

    // 반별 날짜별 출결 통계
    const heatmap: Record<string, Record<string, {
      present: number;
      late: number;
      absent: number;
      total: number;
      attendanceRate: number;
    }>> = {};

    classes.forEach(cls => {
      heatmap[cls.id] = {};
      dates.forEach(dateStr => {
        heatmap[cls.id][dateStr] = {
          present: 0,
          late: 0,
          absent: 0,
          total: 0,
          attendanceRate: 0,
        };
      });
    });

    // 출결 데이터 집계
    attendanceLogs.forEach(log => {
      if (!log.class_id) return;
      const dateStr = new Date(log.occurred_at).toISOString().split('T')[0];
      const classData = heatmap[log.class_id]?.[dateStr];
      if (!classData) return;

      classData.total++;
      if (log.status === 'present') classData.present++;
      else if (log.status === 'late') classData.late++;
      else if (log.status === 'absent') classData.absent++;

      if (classData.total > 0) {
        classData.attendanceRate = Math.round((classData.present / classData.total) * 100);
      }
    });

    return { dates, heatmap };
  };

  // AI 기반 비정상 출결 탐지 (문서 요구사항: AI 기반 비정상 출결 탐지 - Phase 1 MVP 기본 구조)
  const detectAbnormalAttendance = () => {
    if (!attendanceLogs || !classes) return null;

    const anomalies: Array<{
      type: 'frequent_late' | 'sudden_absence' | 'irregular_pattern';
      student_id: string;
      student_name: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // 학생별 출결 패턴 분석
    const studentPatterns: Record<string, {
      total: number;
      late: number;
      absent: number;
      recentLate: number; // 최근 7일 지각
      recentAbsent: number; // 최근 7일 결석
    }> = {};

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    attendanceLogs.forEach(log => {
      if (!studentPatterns[log.student_id]) {
        studentPatterns[log.student_id] = {
          total: 0,
          late: 0,
          absent: 0,
          recentLate: 0,
          recentAbsent: 0,
        };
      }

      const pattern = studentPatterns[log.student_id];
      pattern.total++;
      
      if (log.status === 'late') {
        pattern.late++;
        const logDate = new Date(log.occurred_at);
        if (logDate >= sevenDaysAgo) {
          pattern.recentLate++;
        }
      } else if (log.status === 'absent') {
        pattern.absent++;
        const logDate = new Date(log.occurred_at);
        if (logDate >= sevenDaysAgo) {
          pattern.recentAbsent++;
        }
      }
    });

    // 이상 패턴 탐지
    Object.entries(studentPatterns).forEach(([studentId, pattern]) => {
      const student = students?.find(s => s.id === studentId);
      if (!student) return;

      // 1. 빈번한 지각 (최근 7일 지각률 > 30%)
      if (pattern.total > 0) {
        const recentTotal = attendanceLogs.filter(
          log => log.student_id === studentId && new Date(log.occurred_at) >= sevenDaysAgo
        ).length;
        
        if (recentTotal > 0 && (pattern.recentLate / recentTotal) > 0.3) {
          anomalies.push({
            type: 'frequent_late',
            student_id: studentId,
            student_name: student.name,
            description: `최근 7일간 지각률이 ${Math.round((pattern.recentLate / recentTotal) * 100)}%입니다.`,
            severity: pattern.recentLate >= 3 ? 'high' : 'medium',
          });
        }

        // 2. 갑작스러운 결석 (최근 7일 결석률 > 50%)
        if (recentTotal > 0 && (pattern.recentAbsent / recentTotal) > 0.5) {
          anomalies.push({
            type: 'sudden_absence',
            student_id: studentId,
            student_name: student.name,
            description: `최근 7일간 결석률이 ${Math.round((pattern.recentAbsent / recentTotal) * 100)}%입니다.`,
            severity: pattern.recentAbsent >= 3 ? 'high' : 'medium',
          });
        }

        // 3. 불규칙한 패턴 (전체 지각률 > 40% 또는 결석률 > 20%)
        const lateRate = pattern.late / pattern.total;
        const absentRate = pattern.absent / pattern.total;
        if (lateRate > 0.4 || absentRate > 0.2) {
          anomalies.push({
            type: 'irregular_pattern',
            student_id: studentId,
            student_name: student.name,
            description: `전체 지각률 ${Math.round(lateRate * 100)}%, 결석률 ${Math.round(absentRate * 100)}%입니다.`,
            severity: lateRate > 0.5 || absentRate > 0.3 ? 'high' : 'medium',
          });
        }
      }
    });

    return anomalies;
  };

  // 출석부 출력
  const handlePrintAttendance = () => {
    console.log('출석부 출력 버튼 클릭됨', { 
      attendanceLogs: attendanceLogs?.length, 
      students: students?.length, 
      classes: classes?.length,
      attendanceLogsArray: attendanceLogs,
      studentsArray: students,
      classesArray: classes
    });
    
    try {
      // 출결 기록 확인
      if (!attendanceLogs) {
        console.warn('attendanceLogs가 undefined입니다.');
        showAlert('출결 기록을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', '알림', 'info');
        return;
      }
      
      if (attendanceLogs.length === 0) {
        console.warn('출결 기록이 없습니다.');
        showAlert('출력할 출결 기록이 없습니다.\n\n먼저 "출결 기록" 버튼을 클릭하여 출결 기록을 추가해주세요.', '알림', 'info');
        return;
      }

      // 학생 정보 확인
      if (!students) {
        console.warn('students가 undefined입니다.');
        showAlert('학생 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.', '알림', 'info');
        return;
      }
      
      if (students.length === 0) {
        console.warn('학생 정보가 없습니다.');
        showAlert('학생 정보가 없습니다.\n\n먼저 학생을 등록해주세요.', '알림', 'info');
        return;
      }

      // 반 정보는 선택적이므로 경고만 표시
      if (!classes || classes.length === 0) {
        console.warn('반 정보가 없습니다. 반 정보 없이 출력합니다.');
      }
      
      console.log('출석부 출력 시작', {
        attendanceLogsCount: attendanceLogs.length,
        studentsCount: students.length,
        classesCount: classes?.length || 0
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showAlert('팝업이 차단되어 있습니다. 브라우저 설정에서 팝업을 허용해주세요.', '팝업 차단', 'warning');
        return;
      }
      
      console.log('출력 창 열기 성공');

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
              body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
              h1 { text-align: center; margin-bottom: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              @media print { @page { margin: 1cm; } }
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
                  const occurredDate = new Date(log.occurred_at);
                  const dateStr = occurredDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
                  const timeStr = occurredDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });
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
          console.error('인쇄 실패:', printError);
          showAlert('인쇄 대화상자를 열 수 없습니다. 새 창에서 직접 인쇄해주세요.', '인쇄 오류', 'warning');
        }
      }, 100);
    } catch (error) {
      console.error('출석부 출력 실패:', error);
      showAlert(
        `출석부 출력 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '오류',
        'error'
      );
    }
  };

  // 출결 기록 삭제
  const handleDeleteAttendance = async (logId: string) => {
    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '삭제 확인');
    if (!confirmed) {
      return;
    }

    try {
      await deleteAttendance.mutateAsync(logId);
    } catch (error) {
      console.error('출결 기록 삭제 실패:', error);
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

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            출결 관리
          </h1>

          {/* 필터 패널 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
              {/* 날짜 필터 */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  시작일
                </label>
                <Input
                  type="date"
                  value={filter.date_from || ''}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                />
              </div>
              <div style={{ flex: isMobile ? '1' : '0 0 auto' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  종료일
                </label>
                <Input
                  type="date"
                  value={filter.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                />
              </div>

              {/* 학생 필터 */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', minWidth: isMobile ? '100%' : '200px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  학생
                </label>
                <Select
                  value={selectedStudentId || ''}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value || undefined);
                  }}
                  fullWidth
                >
                  <option value="">전체</option>
                  {students?.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* 반 필터 */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', minWidth: isMobile ? '100%' : '200px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  반
                </label>
                <Select
                  value={selectedClassId || ''}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value || undefined);
                  }}
                  fullWidth
                >
                  <option value="">전체</option>
                  {classes?.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* 출결 타입 필터 */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', minWidth: isMobile ? '100%' : '150px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  타입
                </label>
                <Select
                  value={filter.attendance_type || ''}
                  onChange={(e) => handleFilterChange('attendance_type', e.target.value || undefined)}
                  fullWidth
                >
                  <option value="">전체</option>
                  <option value="check_in">등원</option>
                  <option value="check_out">하원</option>
                  <option value="late">지각</option>
                  <option value="absent">결석</option>
                </Select>
              </div>

              {/* 출결 상태 필터 */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', minWidth: isMobile ? '100%' : '150px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  상태
                </label>
                <Select
                  value={filter.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                  fullWidth
                >
                  <option value="">전체</option>
                  <option value="present">출석</option>
                  <option value="late">지각</option>
                  <option value="absent">결석</option>
                  <option value="excused">사유</option>
                </Select>
              </div>

              {/* 출결 기록 버튼 */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  fullWidth={isMobile}
                >
                  설정
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log('통계 버튼 클릭됨', { attendanceLogs: attendanceLogs?.length, showStatistics });
                    if (!attendanceLogs || attendanceLogs.length === 0) {
                      showAlert('출결 기록이 없어 통계를 표시할 수 없습니다.', '알림', 'info');
                      return;
                    }
                    setShowStatistics(true);
                  }}
                  fullWidth={isMobile}
                >
                  통계
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStartQRScanner}
                  fullWidth={isMobile}
                >
                  QR 출결
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log('출석부 출력 버튼 클릭 이벤트 발생', { 
                      attendanceLogs: attendanceLogs?.length,
                      disabled: !attendanceLogs || attendanceLogs.length === 0
                    });
                    handlePrintAttendance();
                  }}
                  fullWidth={isMobile}
                >
                  출석부 출력
                </Button>
                <Button
                  variant="solid"
                  color="primary"
                  onClick={() => setShowCreateForm(true)}
                  fullWidth={isMobile}
                >
                  출결 기록
                </Button>
              </div>
            </div>
          </Card>

          {/* 출결 설정 패널 */}
          {showSettings && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>출결 설정</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                  닫기
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                    지각 기준 (분)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={attendanceConfig.late_after}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setAttendanceConfig((prev) => ({ ...prev, late_after: value }));
                    }}
                    fullWidth
                  />
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                    수업 시작 시간으로부터 지각으로 처리할 기준 시간(분)입니다.
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                    결석 기준 (분)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={attendanceConfig.absent_after}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setAttendanceConfig((prev) => ({ ...prev, absent_after: value }));
                    }}
                    fullWidth
                  />
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                    수업 시작 시간으로부터 결석으로 처리할 기준 시간(분)입니다.
                  </p>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                    <Switch
                      checked={attendanceConfig.auto_notification}
                      onChange={(e) => {
                        setAttendanceConfig((prev) => ({ ...prev, auto_notification: e.target.checked }));
                      }}
                    />
                    <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
                      자동 출결 알림 발송
                    </label>
                  </div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    출결 기록 시 자동으로 학부모에게 알림을 발송합니다.
                  </p>
                </div>
                {attendanceConfig.auto_notification && (
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                      기본 알림 채널
                    </label>
                    <Select
                      value={attendanceConfig.notification_channel}
                      onChange={(e) => {
                        setAttendanceConfig((prev) => ({ ...prev, notification_channel: e.target.value as 'sms' | 'kakao' }));
                      }}
                      fullWidth
                    >
                      <option value="sms">SMS</option>
                      <option value="kakao">카카오톡</option>
                    </Select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                  <Button variant="outline" onClick={() => setShowSettings(false)}>
                    취소
                  </Button>
                  <Button variant="solid" color="primary" onClick={handleSaveSettings}>
                    저장
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 출결 기록 폼 */}
          {showCreateForm && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>출결 기록</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                  닫기
                </Button>
              </div>
              {attendanceConfig.auto_notification && (
                <div style={{ 
                  padding: 'var(--spacing-sm)', 
                  backgroundColor: 'var(--color-info-50)', 
                  borderRadius: 'var(--border-radius-sm)', 
                  fontSize: 'var(--font-size-sm)', 
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--spacing-md)'
                }}>
                  자동 알림이 활성화되어 있습니다. 출결 기록 시 학부모에게 자동으로 알림이 발송됩니다.
                </div>
              )}
              <SchemaForm
                schema={attendanceSchema}
                onSubmit={handleCreateAttendance}
                defaultValues={{
                  occurred_at: new Date().toISOString().slice(0, 16),
                  attendance_type: 'check_in',
                  status: 'present',
                }}
              />
            </Card>
          )}

          {/* 출결 로그 목록 */}
          {isLoading && (
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              로딩 중...
            </div>
          )}
          {error && (
            <Card padding="md" variant="outlined">
              <div style={{ color: 'var(--color-error)' }}>오류: {error.message}</div>
            </Card>
          )}
          {attendanceLogs && attendanceLogs.length === 0 && (
            <Card padding="md" variant="outlined">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                출결 기록이 없습니다.
              </div>
            </Card>
          )}
          {attendanceLogs && attendanceLogs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {attendanceLogs.map((log) => {
                const student = students?.find((s) => s.id === log.student_id);
                const classInfo = classes?.find((c) => c.id === log.class_id);
                const occurredDate = new Date(log.occurred_at);
                const dateStr = occurredDate.toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  timeZone: 'Asia/Seoul',
                });
                const timeStr = occurredDate.toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Seoul',
                });

                return (
                  <Card key={log.id} padding="md" variant="default">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                      <div style={{ flex: 1, minWidth: isMobile ? '100%' : '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                            {student?.name || '알 수 없음'}
                          </span>
                          {classInfo && (
                            <Badge variant="soft" color="info">
                              {classInfo.name}
                            </Badge>
                          )}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                          {dateStr} {timeStr}
                        </div>
                        {log.notes && (
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            {log.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                        <Badge variant="solid" color={getTypeBadgeColor(log.attendance_type)}>
                          {log.attendance_type === 'check_in' ? '등원' : log.attendance_type === 'check_out' ? '하원' : log.attendance_type === 'late' ? '지각' : '결석'}
                        </Badge>
                        <Badge variant="solid" color={getStatusBadgeColor(log.status)}>
                          {log.status === 'present' ? '출석' : log.status === 'late' ? '지각' : log.status === 'absent' ? '결석' : '사유'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAttendance(log.id)}
                          style={{ color: 'var(--color-error)' }}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
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
                  maxWidth: '500px', 
                  aspectRatio: '1',
                  backgroundColor: '#000',
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
                      transform: 'translate(-50%, -50%)',
                      width: '200px',
                      height: '200px',
                      border: '2px solid #fff',
                      borderRadius: '8px',
                      pointerEvents: 'none'
                    }} />
                  )}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                  QR 코드를 카메라에 맞춰주세요
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', width: '100%', maxWidth: '500px' }}>
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

          {/* 통계/히트맵 패널 */}
          {showStatistics && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>출결 통계</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowStatistics(false)}>
                  닫기
                </Button>
              </div>

              {/* 반별 통계 */}
              {classes && classes.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                    반별 출결 통계
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {classes.map((cls) => {
                      const stats = calculateStatistics();
                      const classStats = stats?.[cls.id];
                      if (!classStats) return null;

                      return (
                        <Card key={cls.id} padding="sm" variant="outlined">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
                            <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                              {cls.name}
                            </span>
                            <Badge variant="soft" color={classStats.attendanceRate >= 90 ? 'success' : classStats.attendanceRate >= 70 ? 'warning' : 'error'}>
                              출석률 {classStats.attendanceRate}%
                            </Badge>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                            <div>
                              <span style={{ color: 'var(--color-text-secondary)' }}>전체: </span>
                              <strong>{classStats.total}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--color-text-secondary)' }}>출석: </span>
                              <strong style={{ color: 'var(--color-success)' }}>{classStats.present}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--color-text-secondary)' }}>지각: </span>
                              <strong style={{ color: 'var(--color-warning)' }}>{classStats.late}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--color-text-secondary)' }}>결석: </span>
                              <strong style={{ color: 'var(--color-error)' }}>{classStats.absent}</strong>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 요일별 패턴 */}
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                  요일별 출결 패턴
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: 'var(--spacing-xs)', textAlign: 'left' }}>요일</th>
                        <th style={{ padding: 'var(--spacing-xs)', textAlign: 'right' }}>등원</th>
                        <th style={{ padding: 'var(--spacing-xs)', textAlign: 'right' }}>하원</th>
                        <th style={{ padding: 'var(--spacing-xs)', textAlign: 'right' }}>지각</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const dayPattern = analyzeDayPattern();
                        if (!dayPattern) return null;
                        return ['월', '화', '수', '목', '금', '토', '일'].map(day => (
                          <tr key={day} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: 'var(--spacing-xs)' }}>{day}</td>
                            <td style={{ padding: 'var(--spacing-xs)', textAlign: 'right' }}>{dayPattern[day]?.checkIn || 0}</td>
                            <td style={{ padding: 'var(--spacing-xs)', textAlign: 'right' }}>{dayPattern[day]?.checkOut || 0}</td>
                            <td style={{ padding: 'var(--spacing-xs)', textAlign: 'right', color: 'var(--color-warning)' }}>
                              {dayPattern[day]?.late || 0}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 반별 출결 히트맵 (문서 요구사항: 반별 출결 히트맵) */}
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                  반별 출결 히트맵
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  {(() => {
                    const heatmapData = calculateClassHeatmap();
                    if (!heatmapData) return <p style={{ color: 'var(--color-text-secondary)' }}>출결 데이터가 없습니다.</p>;
                    
                    const { dates, heatmap } = heatmapData;
                    if (dates.length === 0) return <p style={{ color: 'var(--color-text-secondary)' }}>출결 데이터가 없습니다.</p>;

                    return (
                      <div style={{ display: 'inline-block', minWidth: '100%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                              <th style={{ padding: 'var(--spacing-xs)', textAlign: 'left', position: 'sticky', left: 0, backgroundColor: 'var(--color-background)', zIndex: 1 }}>
                                반 / 날짜
                              </th>
                              {dates.slice(0, 30).map(dateStr => {
                                const date = new Date(dateStr);
                                return (
                                  <th
                                    key={dateStr}
                                    style={{
                                      padding: 'var(--spacing-xs)',
                                      textAlign: 'center',
                                      minWidth: '60px',
                                      fontSize: 'var(--font-size-xs)',
                                    }}
                                    title={date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                                  >
                                    {date.getMonth() + 1}/{date.getDate()}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {(classes || []).map(cls => (
                              <tr key={cls.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td
                                  style={{
                                    padding: 'var(--spacing-xs)',
                                    position: 'sticky',
                                    left: 0,
                                    backgroundColor: 'var(--color-background)',
                                    zIndex: 1,
                                    fontWeight: 'var(--font-weight-medium)',
                                  }}
                                >
                                  {cls.name}
                                </td>
                                {dates.slice(0, 30).map(dateStr => {
                                  const dayData = heatmap[cls.id]?.[dateStr];
                                  if (!dayData || dayData.total === 0) {
                                    return (
                                      <td
                                        key={dateStr}
                                        style={{
                                          padding: 'var(--spacing-xs)',
                                          textAlign: 'center',
                                          backgroundColor: 'var(--color-background-secondary)',
                                          color: 'var(--color-text-secondary)',
                                        }}
                                        title="데이터 없음"
                                      >
                                        -
                                      </td>
                                    );
                                  }

                                  const intensity = dayData.attendanceRate / 100;
                                  const bgColor = dayData.attendanceRate >= 90
                                    ? `rgba(34, 197, 94, ${0.3 + intensity * 0.5})` // 초록
                                    : dayData.attendanceRate >= 70
                                    ? `rgba(234, 179, 8, ${0.3 + intensity * 0.5})` // 노랑
                                    : `rgba(239, 68, 68, ${0.3 + intensity * 0.5})`; // 빨강

                                  return (
                                    <td
                                      key={dateStr}
                                      style={{
                                        padding: 'var(--spacing-xs)',
                                        textAlign: 'center',
                                        backgroundColor: bgColor,
                                        fontWeight: 'var(--font-weight-medium)',
                                        color: intensity > 0.5 ? '#fff' : 'var(--color-text)',
                                      }}
                                      title={`${dateStr}: 출석률 ${dayData.attendanceRate}% (출석: ${dayData.present}, 지각: ${dayData.late}, 결석: ${dayData.absent})`}
                                    >
                                      {dayData.attendanceRate}%
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {dates.length > 30 && (
                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', textAlign: 'center' }}>
                            최근 30일만 표시됩니다. (전체 {dates.length}일)
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 시간대별 패턴 */}
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                  시간대별 출결 히트맵
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: 'var(--spacing-xs)' }}>
                  {(() => {
                    const timePattern = analyzeTimePattern();
                    if (!timePattern) return null;
                    const maxCount = Math.max(...Object.values(timePattern));
                    return Array.from({ length: 24 }, (_, i) => {
                      const count = timePattern[i] || 0;
                      const intensity = maxCount > 0 ? count / maxCount : 0;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: 'var(--spacing-xs)',
                            backgroundColor: `rgba(34, 197, 94, ${0.2 + intensity * 0.8})`,
                            borderRadius: 'var(--border-radius-sm)',
                            textAlign: 'center',
                            fontSize: 'var(--font-size-xs)',
                            color: intensity > 0.5 ? '#fff' : 'var(--color-text)',
                          }}
                          title={`${i}시: ${count}건`}
                        >
                          <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{i}시</div>
                          <div>{count}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* AI 기반 비정상 출결 탐지 (문서 요구사항: AI 기반 비정상 출결 탐지) */}
              <div>
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                  AI 기반 비정상 출결 탐지
                </h4>
                {(() => {
                  const anomalies = detectAbnormalAttendance();
                  if (!anomalies || anomalies.length === 0) {
                    return (
                      <Card padding="sm" variant="outlined">
                        <p style={{ color: 'var(--color-success)', textAlign: 'center', padding: 'var(--spacing-md)' }}>
                          이상 패턴이 감지되지 않았습니다.
                        </p>
                      </Card>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                      {anomalies.map((anomaly, idx) => (
                        <Card key={idx} padding="sm" variant="outlined">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
                                <Badge
                                  variant="soft"
                                  color={
                                    anomaly.severity === 'high' ? 'error' :
                                    anomaly.severity === 'medium' ? 'warning' : 'info'
                                  }
                                >
                                  {anomaly.type === 'frequent_late' ? '빈번한 지각' :
                                   anomaly.type === 'sudden_absence' ? '갑작스러운 결석' :
                                   '불규칙한 패턴'}
                                </Badge>
                                <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                                  {anomaly.student_name}
                                </span>
                              </div>
                              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                                {anomaly.description}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </Card>
          )}

        </div>
      </Container>
    </ErrorBoundary>
  );
}

