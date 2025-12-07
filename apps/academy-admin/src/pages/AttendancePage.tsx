/**
 * ì¶œê²° ê´€ë¦??˜ì´ì§€
 * 
 * [?”êµ¬?¬í•­]
 * - PC/?œë¸”ë¦?ëª¨ë°”??ì¶œê²°
 * - QR ì¶œê²°(? íƒ)
 * - ì¶œê²° ?Œë¦¼ ë°œì†¡(ì¹´ì¹´?¤í†¡/SMS)
 * - ì§€ê°?ê¸°ì?, ê²°ì„ ì²˜ë¦¬ ê·œì¹™ ?¤ì •
 * - ?œê°„?€ë³?ì¶œê²° ê¸°ë¡
 * - ?ë™ ì¶œê²° ë©”ì‹œì§€
 * - ì¶œì„ë¶€ ì¶œë ¥
 * - ì¶œê²° ?ˆìŠ¤? ë¦¬ ì¡°íšŒ
 */

import { useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from '@ui-core/react';
import { Container, Card, Button, Input, Badge, Switch, Select, useModal } from '@ui-core/react';
import { SchemaForm } from '@schema/engine';
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

  // ?„í„° ?íƒœ
  const [filter, setFilter] = useState<AttendanceFilter>({
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
  });
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>();

  // QR ì¶œê²° ?íƒœ
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // ?µê³„/?ˆíŠ¸ë§??íƒœ
  const [showStatistics, setShowStatistics] = useState(false);

  // ì¶œê²° ?¤ì • ?íƒœ
  const [showSettings, setShowSettings] = useState(false);
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();

  // ?„ì—­ ëª¨ë‹¬ ???¬ìš©
  const { showAlert, showConfirm } = useModal();
  
  // ?¤ì • ê°?(?œë²„?ì„œ ê°€?¸ì˜¨ ê°??ëŠ” ê¸°ë³¸ê°? - ë¡œì»¬ stateë¡?ê´€ë¦?
  const [attendanceConfig, setAttendanceConfig] = useState({
    late_after: 10,
    absent_after: 60,
    auto_notification: true,
    notification_channel: 'sms' as 'sms' | 'kakao',
  });

  // ?œë²„ ?¤ì • ë¡œë“œ
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

  // ì¶œê²° ê¸°ë¡ ?íƒœ
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ?°ì´??ì¡°íšŒ
  const { data: attendanceLogs, isLoading, error } = useAttendanceLogs({
    ...filter,
    student_id: selectedStudentId,
    class_id: selectedClassId,
  });
  const { data: students } = useStudents();
  const { data: classes } = useClasses();

  // ì¶œê²° ?ì„±/?? œ
  const createAttendance = useCreateAttendanceLog();
  const deleteAttendance = useDeleteAttendanceLog();

  // ?„í„° ?¸ë“¤??
  const handleFilterChange = (key: keyof AttendanceFilter, value: any) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  // ì§€ê°?ê²°ì„ ?ë™ ?ì • ?¨ìˆ˜
  const determineAttendanceStatus = (
    occurredAt: Date,
    classInfo: { start_time: string; day_of_week: string } | undefined,
    lateAfter: number,
    absentAfter: number
  ): { status: AttendanceStatus; attendance_type: AttendanceType } => {
    if (!classInfo) {
      // ë°??•ë³´ê°€ ?†ìœ¼ë©??˜ë™ ?…ë ¥ê°??¬ìš©
      return { status: 'present', attendance_type: 'check_in' };
    }

    // ë°˜ì˜ ?”ì¼ ?•ì¸
    const dayMap: Record<string, number> = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0,
    };
    const classDayOfWeek = dayMap[classInfo.day_of_week.toLowerCase()];
    const occurredDayOfWeek = occurredAt.getDay();

    // ?”ì¼??ë§ì? ?Šìœ¼ë©??˜ë™ ?…ë ¥ê°??¬ìš©
    if (classDayOfWeek !== occurredDayOfWeek) {
      return { status: 'present', attendance_type: 'check_in' };
    }

    // ë°??œì‘ ?œê°„ ?Œì‹±
    const [startHour, startMinute] = classInfo.start_time.split(':').map(Number);
    const classStartTime = new Date(occurredAt);
    classStartTime.setHours(startHour, startMinute, 0, 0);

    // ?œê°„ ì°¨ì´ ê³„ì‚° (ë¶?
    const diffMinutes = Math.floor((occurredAt.getTime() - classStartTime.getTime()) / (1000 * 60));

    // ?ë™ ?ì •
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

  // QR ?¤ìº??video ?”ì†Œ ?°ê²°
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

  // ?¤ì • ?€??
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
      showAlert('?¤ì •???€?¥ë˜?ˆìŠµ?ˆë‹¤.', '?€???„ë£Œ', 'success');
    } catch (error) {
      console.error('?¤ì • ?€???¤íŒ¨:', error);
      showAlert('?¤ì • ?€??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', '?¤ë¥˜', 'error');
    }
  };

  // ì¶œê²° ê¸°ë¡ ?ì„±
  const handleCreateAttendance = async (data: any) => {
    if (!data.student_id) {
      showAlert('?™ìƒ??? íƒ?´ì£¼?¸ìš”.', '?…ë ¥ ?¤ë¥˜', 'warning');
      return;
    }

    try {
      const occurredAt = new Date(data.occurred_at);
      const classInfo = data.class_id 
        ? classes?.find(c => c.id === data.class_id)
        : undefined;

      // ?ë™ ?ì • (ë°??•ë³´ê°€ ?ˆê³  ?±ì›??ê²½ìš°)
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

      // [ë¬¸ì„œ ?”êµ¬?¬í•­] ?Œë¦¼ ë°œì†¡?€ ?œë²„?ì„œ ?ë™ ì²˜ë¦¬??(core-notification ???™ë?ëª??Œë¦¼)
      // ?´ë¼?´ì–¸?¸ì—?œëŠ” ?Œë¦¼ ë°œì†¡ ë¡œì§???œê±°?˜ê³ , ?œë²„?ì„œ ?¤ì •???°ë¼ ?ë™ ë°œì†¡

      setShowCreateForm(false);
    } catch (error) {
      console.error('ì¶œê²° ê¸°ë¡ ?ì„± ?¤íŒ¨:', error);
      showAlert(
        `ì¶œê²° ê¸°ë¡ ?ì„± ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '?¤ë¥˜',
        'error'
      );
    }
  };

  // ì¶œê²° ?¤í‚¤ë§??ì„± (?™ì  ?µì…˜)
  const attendanceSchema = useMemo(
    () => createAttendanceFormSchema(students, classes),
    [students, classes]
  );

  // QR ?¤ìº???œì‘
  const handleStartQRScanner = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // ?„ë©´ ì¹´ë©”???°ì„ 
      });
      setStream(mediaStream);
      setShowQRScanner(true);
      setQrScanning(true);
    } catch (error) {
      console.error('ì¹´ë©”???‘ê·¼ ?¤íŒ¨:', error);
        showAlert('ì¹´ë©”???‘ê·¼ ê¶Œí•œ???„ìš”?©ë‹ˆ?? ë¸Œë¼?°ì? ?¤ì •?ì„œ ì¹´ë©”??ê¶Œí•œ???ˆìš©?´ì£¼?¸ìš”.', 'ê¶Œí•œ ?„ìš”', 'warning');
    }
  };

  // QR ?¤ìº??ì¢…ë£Œ
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

  // QR ì½”ë“œ ?¤ìº” ì²˜ë¦¬ (ê°„ë‹¨???ìŠ¤???…ë ¥?¼ë¡œ ?€ì²?
  const handleQRScan = async (qrData: string) => {
    try {
      // QR ì½”ë“œ ?•ì‹: student_id ?ëŠ” JSON {student_id, class_id}
      let studentId: string;
      let classId: string | undefined;

      try {
        const parsed = JSON.parse(qrData);
        studentId = parsed.student_id;
        classId = parsed.class_id;
      } catch {
        // JSON???„ë‹ˆë©?student_idë¡?ê°„ì£¼
        studentId = qrData;
      }

      const student = students?.find((s) => s.id === studentId);
      if (!student) {
        showAlert('?±ë¡?˜ì? ?Šì? ?™ìƒ?…ë‹ˆ??', '?Œë¦¼', 'warning');
        return;
      }

      // ì¶œê²° ê¸°ë¡ ?ì„± (QR ?¤ìº” ??ì¦‰ì‹œ ê¸°ë¡)
      const now = new Date();
      await handleCreateAttendance({
        student_id: studentId,
        class_id: classId,
        occurred_at: now.toISOString().slice(0, 16),
        attendance_type: 'check_in',
        status: 'present',
      });
      
      handleStopQRScanner();
      showAlert(`${student.name}?˜ì˜ ?±ì›??ê¸°ë¡?˜ì—ˆ?µë‹ˆ??`, 'ì¶œê²° ê¸°ë¡ ?„ë£Œ', 'success');
    } catch (error) {
      console.error('QR ?¤ìº” ì²˜ë¦¬ ?¤íŒ¨:', error);
      showAlert('QR ì½”ë“œë¥??¸ì‹?????†ìŠµ?ˆë‹¤.', 'QR ?¤ìº” ?¤ë¥˜', 'error');
    }
  };

  // ?µê³„ ê³„ì‚°
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

  // ?”ì¼ë³??¨í„´ ë¶„ì„
  const analyzeDayPattern = () => {
    if (!attendanceLogs) return null;

    const dayStats: Record<string, { checkIn: number; checkOut: number; late: number }> = {
      '??: { checkIn: 0, checkOut: 0, late: 0 },
      '??: { checkIn: 0, checkOut: 0, late: 0 },
      '??: { checkIn: 0, checkOut: 0, late: 0 },
      '??: { checkIn: 0, checkOut: 0, late: 0 },
      'ëª?: { checkIn: 0, checkOut: 0, late: 0 },
      'ê¸?: { checkIn: 0, checkOut: 0, late: 0 },
      '??: { checkIn: 0, checkOut: 0, late: 0 },
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

  // ?œê°„?€ë³??¨í„´ ë¶„ì„
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

  // ë°˜ë³„ ì¶œê²° ?ˆíŠ¸ë§?ê³„ì‚° (ë¬¸ì„œ ?”êµ¬?¬í•­: ë°˜ë³„ ì¶œê²° ?ˆíŠ¸ë§?
  const calculateClassHeatmap = () => {
    if (!attendanceLogs || !classes) return null;

    // ? ì§œ ë²”ìœ„ ê³„ì‚°
    const dates: string[] = [];
    const dateSet = new Set<string>();
    attendanceLogs.forEach(log => {
      const dateStr = new Date(log.occurred_at).toISOString().split('T')[0];
      dateSet.add(dateStr);
    });
    dates.push(...Array.from(dateSet).sort());

    // ë°˜ë³„ ? ì§œë³?ì¶œê²° ?µê³„
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

    // ì¶œê²° ?°ì´??ì§‘ê³„
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

  // AI ê¸°ë°˜ ë¹„ì •??ì¶œê²° ?ì? (ë¬¸ì„œ ?”êµ¬?¬í•­: AI ê¸°ë°˜ ë¹„ì •??ì¶œê²° ?ì? - Phase 1 MVP ê¸°ë³¸ êµ¬ì¡°)
  const detectAbnormalAttendance = () => {
    if (!attendanceLogs || !classes) return null;

    const anomalies: Array<{
      type: 'frequent_late' | 'sudden_absence' | 'irregular_pattern';
      student_id: string;
      student_name: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // ?™ìƒë³?ì¶œê²° ?¨í„´ ë¶„ì„
    const studentPatterns: Record<string, {
      total: number;
      late: number;
      absent: number;
      recentLate: number; // ìµœê·¼ 7??ì§€ê°?
      recentAbsent: number; // ìµœê·¼ 7??ê²°ì„
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

    // ?´ìƒ ?¨í„´ ?ì?
    Object.entries(studentPatterns).forEach(([studentId, pattern]) => {
      const student = students?.find(s => s.id === studentId);
      if (!student) return;

      // 1. ë¹ˆë²ˆ??ì§€ê°?(ìµœê·¼ 7??ì§€ê°ë¥  > 30%)
      if (pattern.total > 0) {
        const recentTotal = attendanceLogs.filter(
          log => log.student_id === studentId && new Date(log.occurred_at) >= sevenDaysAgo
        ).length;
        
        if (recentTotal > 0 && (pattern.recentLate / recentTotal) > 0.3) {
          anomalies.push({
            type: 'frequent_late',
            student_id: studentId,
            student_name: student.name,
            description: `ìµœê·¼ 7?¼ê°„ ì§€ê°ë¥ ??${Math.round((pattern.recentLate / recentTotal) * 100)}%?…ë‹ˆ??`,
            severity: pattern.recentLate >= 3 ? 'high' : 'medium',
          });
        }

        // 2. ê°‘ì‘?¤ëŸ¬??ê²°ì„ (ìµœê·¼ 7??ê²°ì„ë¥?> 50%)
        if (recentTotal > 0 && (pattern.recentAbsent / recentTotal) > 0.5) {
          anomalies.push({
            type: 'sudden_absence',
            student_id: studentId,
            student_name: student.name,
            description: `ìµœê·¼ 7?¼ê°„ ê²°ì„ë¥ ì´ ${Math.round((pattern.recentAbsent / recentTotal) * 100)}%?…ë‹ˆ??`,
            severity: pattern.recentAbsent >= 3 ? 'high' : 'medium',
          });
        }

        // 3. ë¶ˆê·œì¹™í•œ ?¨í„´ (?„ì²´ ì§€ê°ë¥  > 40% ?ëŠ” ê²°ì„ë¥?> 20%)
        const lateRate = pattern.late / pattern.total;
        const absentRate = pattern.absent / pattern.total;
        if (lateRate > 0.4 || absentRate > 0.2) {
          anomalies.push({
            type: 'irregular_pattern',
            student_id: studentId,
            student_name: student.name,
            description: `?„ì²´ ì§€ê°ë¥  ${Math.round(lateRate * 100)}%, ê²°ì„ë¥?${Math.round(absentRate * 100)}%?…ë‹ˆ??`,
            severity: lateRate > 0.5 || absentRate > 0.3 ? 'high' : 'medium',
          });
        }
      }
    });

    return anomalies;
  };

  // ì¶œì„ë¶€ ì¶œë ¥
  const handlePrintAttendance = () => {
    console.log('ì¶œì„ë¶€ ì¶œë ¥ ë²„íŠ¼ ?´ë¦­??, { 
      attendanceLogs: attendanceLogs?.length, 
      students: students?.length, 
      classes: classes?.length,
      attendanceLogsArray: attendanceLogs,
      studentsArray: students,
      classesArray: classes
    });
    
    try {
      // ì¶œê²° ê¸°ë¡ ?•ì¸
      if (!attendanceLogs) {
        console.warn('attendanceLogsê°€ undefined?…ë‹ˆ??');
        showAlert('ì¶œê²° ê¸°ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì…?ˆë‹¤. ? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.', '?Œë¦¼', 'info');
        return;
      }
      
      if (attendanceLogs.length === 0) {
        console.warn('ì¶œê²° ê¸°ë¡???†ìŠµ?ˆë‹¤.');
        showAlert('ì¶œë ¥??ì¶œê²° ê¸°ë¡???†ìŠµ?ˆë‹¤.\n\në¨¼ì? "ì¶œê²° ê¸°ë¡" ë²„íŠ¼???´ë¦­?˜ì—¬ ì¶œê²° ê¸°ë¡??ì¶”ê??´ì£¼?¸ìš”.', '?Œë¦¼', 'info');
        return;
      }

      // ?™ìƒ ?•ë³´ ?•ì¸
      if (!students) {
        console.warn('studentsê°€ undefined?…ë‹ˆ??');
        showAlert('?™ìƒ ?•ë³´ë¥?ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì…?ˆë‹¤. ? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.', '?Œë¦¼', 'info');
        return;
      }
      
      if (students.length === 0) {
        console.warn('?™ìƒ ?•ë³´ê°€ ?†ìŠµ?ˆë‹¤.');
        showAlert('?™ìƒ ?•ë³´ê°€ ?†ìŠµ?ˆë‹¤.\n\në¨¼ì? ?™ìƒ???±ë¡?´ì£¼?¸ìš”.', '?Œë¦¼', 'info');
        return;
      }

      // ë°??•ë³´??? íƒ?ì´ë¯€ë¡?ê²½ê³ ë§??œì‹œ
      if (!classes || classes.length === 0) {
        console.warn('ë°??•ë³´ê°€ ?†ìŠµ?ˆë‹¤. ë°??•ë³´ ?†ì´ ì¶œë ¥?©ë‹ˆ??');
      }
      
      console.log('ì¶œì„ë¶€ ì¶œë ¥ ?œì‘', {
        attendanceLogsCount: attendanceLogs.length,
        studentsCount: students.length,
        classesCount: classes?.length || 0
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showAlert('?ì—…??ì°¨ë‹¨?˜ì–´ ?ˆìŠµ?ˆë‹¤. ë¸Œë¼?°ì? ?¤ì •?ì„œ ?ì—…???ˆìš©?´ì£¼?¸ìš”.', '?ì—… ì°¨ë‹¨', 'warning');
        return;
      }
      
      console.log('ì¶œë ¥ ì°??´ê¸° ?±ê³µ');

      const dateStr = filter.date_from === filter.date_to 
        ? filter.date_from 
        : `${filter.date_from} ~ ${filter.date_to}`;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>ì¶œì„ë¶€ - ${dateStr}</title>
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
            <h1>ì¶œì„ë¶€</h1>
            <p><strong>ê¸°ê°„:</strong> ${dateStr}</p>
            <table>
              <thead>
                <tr>
                  <th>? ì§œ/?œê°„</th>
                  <th>?™ìƒëª?/th>
                  <th>ë°?/th>
                  <th>?€??/th>
                  <th>?íƒœ</th>
                  <th>ë¹„ê³ </th>
                </tr>
              </thead>
              <tbody>
                ${attendanceLogs.map(log => {
                  const student = students?.find((s) => s.id === log.student_id);
                  const classInfo = classes?.find((c) => c.id === log.class_id);
                  const occurredDate = new Date(log.occurred_at);
                  const dateStr = occurredDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
                  const timeStr = occurredDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' });
                  const typeStr = log.attendance_type === 'check_in' ? '?±ì›' : log.attendance_type === 'check_out' ? '?˜ì›' : log.attendance_type === 'late' ? 'ì§€ê°? : 'ê²°ì„';
                  const statusStr = log.status === 'present' ? 'ì¶œì„' : log.status === 'late' ? 'ì§€ê°? : log.status === 'absent' ? 'ê²°ì„' : '?¬ìœ ';
                  
                  return `
                    <tr>
                      <td>${dateStr} ${timeStr}</td>
                      <td>${student?.name || '?????†ìŒ'}</td>
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
      
      // ?¸ì‡„ ?€?”ìƒ???´ê¸° (?½ê°„??ì§€????
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (printError) {
          console.error('?¸ì‡„ ?¤íŒ¨:', printError);
          showAlert('?¸ì‡„ ?€?”ìƒ?ë? ?????†ìŠµ?ˆë‹¤. ??ì°½ì—??ì§ì ‘ ?¸ì‡„?´ì£¼?¸ìš”.', '?¸ì‡„ ?¤ë¥˜', 'warning');
        }
      }, 100);
    } catch (error) {
      console.error('ì¶œì„ë¶€ ì¶œë ¥ ?¤íŒ¨:', error);
      showAlert(
        `ì¶œì„ë¶€ ì¶œë ¥ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '?¤ë¥˜',
        'error'
      );
    }
  };

  // ì¶œê²° ê¸°ë¡ ?? œ
  const handleDeleteAttendance = async (logId: string) => {
    const confirmed = await showConfirm('?•ë§ ?? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?', '?? œ ?•ì¸');
    if (!confirmed) {
      return;
    }

    try {
      await deleteAttendance.mutateAsync(logId);
    } catch (error) {
      console.error('ì¶œê²° ê¸°ë¡ ?? œ ?¤íŒ¨:', error);
      showAlert(
        `ì¶œê²° ê¸°ë¡ ?? œ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '?¤ë¥˜',
        'error'
      );
    }
  };

  // ì¶œê²° ?íƒœ ë±ƒì? ?‰ìƒ
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

  // ì¶œê²° ?€??ë±ƒì? ?‰ìƒ
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
            ì¶œê²° ê´€ë¦?
          </h1>

          {/* ?„í„° ?¨ë„ */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
              {/* ? ì§œ ?„í„° */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  ?œì‘??
                </label>
                <Input
                  type="date"
                  value={filter.date_from || ''}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                />
              </div>
              <div style={{ flex: isMobile ? '1' : '0 0 auto' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  ì¢…ë£Œ??
                </label>
                <Input
                  type="date"
                  value={filter.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                />
              </div>

              {/* ?™ìƒ ?„í„° */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', minWidth: isMobile ? '100%' : '200px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  ?™ìƒ
                </label>
                <Select
                  value={selectedStudentId || ''}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value || undefined);
                  }}
                  fullWidth
                >
                  <option value="">?„ì²´</option>
                  {students?.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* ë°??„í„° */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', minWidth: isMobile ? '100%' : '200px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  ë°?
                </label>
                <Select
                  value={selectedClassId || ''}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value || undefined);
                  }}
                  fullWidth
                >
                  <option value="">?„ì²´</option>
                  {classes?.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* ì¶œê²° ?€???„í„° */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', minWidth: isMobile ? '100%' : '150px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  ?€??
                </label>
                <Select
                  value={filter.attendance_type || ''}
                  onChange={(e) => handleFilterChange('attendance_type', e.target.value || undefined)}
                  fullWidth
                >
                  <option value="">?„ì²´</option>
                  <option value="check_in">?±ì›</option>
                  <option value="check_out">?˜ì›</option>
                  <option value="late">ì§€ê°?/option>
                  <option value="absent">ê²°ì„</option>
                </Select>
              </div>

              {/* ì¶œê²° ?íƒœ ?„í„° */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', minWidth: isMobile ? '100%' : '150px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                  ?íƒœ
                </label>
                <Select
                  value={filter.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                  fullWidth
                >
                  <option value="">?„ì²´</option>
                  <option value="present">ì¶œì„</option>
                  <option value="late">ì§€ê°?/option>
                  <option value="absent">ê²°ì„</option>
                  <option value="excused">?¬ìœ </option>
                </Select>
              </div>

              {/* ì¶œê²° ê¸°ë¡ ë²„íŠ¼ */}
              <div style={{ flex: isMobile ? '1' : '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  fullWidth={isMobile}
                >
                  ?¤ì •
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log('?µê³„ ë²„íŠ¼ ?´ë¦­??, { attendanceLogs: attendanceLogs?.length, showStatistics });
                    if (!attendanceLogs || attendanceLogs.length === 0) {
                      showAlert('ì¶œê²° ê¸°ë¡???†ì–´ ?µê³„ë¥??œì‹œ?????†ìŠµ?ˆë‹¤.', '?Œë¦¼', 'info');
                      return;
                    }
                    setShowStatistics(true);
                  }}
                  fullWidth={isMobile}
                >
                  ?µê³„
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStartQRScanner}
                  fullWidth={isMobile}
                >
                  QR ì¶œê²°
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log('ì¶œì„ë¶€ ì¶œë ¥ ë²„íŠ¼ ?´ë¦­ ?´ë²¤??ë°œìƒ', { 
                      attendanceLogs: attendanceLogs?.length,
                      disabled: !attendanceLogs || attendanceLogs.length === 0
                    });
                    handlePrintAttendance();
                  }}
                  fullWidth={isMobile}
                >
                  ì¶œì„ë¶€ ì¶œë ¥
                </Button>
                <Button
                  variant="solid"
                  color="primary"
                  onClick={() => setShowCreateForm(true)}
                  fullWidth={isMobile}
                >
                  ì¶œê²° ê¸°ë¡
                </Button>
              </div>
            </div>
          </Card>

          {/* ì¶œê²° ?¤ì • ?¨ë„ */}
          {showSettings && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>ì¶œê²° ?¤ì •</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                  ?«ê¸°
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                    ì§€ê°?ê¸°ì? (ë¶?
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
                    ?˜ì—… ?œì‘ ?œê°„?¼ë¡œë¶€??ì§€ê°ìœ¼ë¡?ì²˜ë¦¬??ê¸°ì? ?œê°„(ë¶??…ë‹ˆ??
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                    ê²°ì„ ê¸°ì? (ë¶?
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
                    ?˜ì—… ?œì‘ ?œê°„?¼ë¡œë¶€??ê²°ì„?¼ë¡œ ì²˜ë¦¬??ê¸°ì? ?œê°„(ë¶??…ë‹ˆ??
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
                      ?ë™ ì¶œê²° ?Œë¦¼ ë°œì†¡
                    </label>
                  </div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    ì¶œê²° ê¸°ë¡ ???ë™?¼ë¡œ ?™ë?ëª¨ì—ê²??Œë¦¼??ë°œì†¡?©ë‹ˆ??
                  </p>
                </div>
                {attendanceConfig.auto_notification && (
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', color: 'var(--color-text)' }}>
                      ê¸°ë³¸ ?Œë¦¼ ì±„ë„
                    </label>
                    <Select
                      value={attendanceConfig.notification_channel}
                      onChange={(e) => {
                        setAttendanceConfig((prev) => ({ ...prev, notification_channel: e.target.value as 'sms' | 'kakao' }));
                      }}
                      fullWidth
                    >
                      <option value="sms">SMS</option>
                      <option value="kakao">ì¹´ì¹´?¤í†¡</option>
                    </Select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                  <Button variant="outline" onClick={() => setShowSettings(false)}>
                    ì·¨ì†Œ
                  </Button>
                  <Button variant="solid" color="primary" onClick={handleSaveSettings}>
                    ?€??
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* ì¶œê²° ê¸°ë¡ ??*/}
          {showCreateForm && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>ì¶œê²° ê¸°ë¡</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                  ?«ê¸°
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
                  ?ë™ ?Œë¦¼???œì„±?”ë˜???ˆìŠµ?ˆë‹¤. ì¶œê²° ê¸°ë¡ ???™ë?ëª¨ì—ê²??ë™?¼ë¡œ ?Œë¦¼??ë°œì†¡?©ë‹ˆ??
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

          {/* ì¶œê²° ë¡œê·¸ ëª©ë¡ */}
          {isLoading && (
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              ë¡œë”© ì¤?..
            </div>
          )}
          {error && (
            <Card padding="md" variant="outlined">
              <div style={{ color: 'var(--color-error)' }}>?¤ë¥˜: {error.message}</div>
            </Card>
          )}
          {attendanceLogs && attendanceLogs.length === 0 && (
            <Card padding="md" variant="outlined">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                ì¶œê²° ê¸°ë¡???†ìŠµ?ˆë‹¤.
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
                            {student?.name || '?????†ìŒ'}
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
                          {log.attendance_type === 'check_in' ? '?±ì›' : log.attendance_type === 'check_out' ? '?˜ì›' : log.attendance_type === 'late' ? 'ì§€ê°? : 'ê²°ì„'}
                        </Badge>
                        <Badge variant="solid" color={getStatusBadgeColor(log.status)}>
                          {log.status === 'present' ? 'ì¶œì„' : log.status === 'late' ? 'ì§€ê°? : log.status === 'absent' ? 'ê²°ì„' : '?¬ìœ '}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAttendance(log.id)}
                          style={{ color: 'var(--color-error)' }}
                        >
                          ?? œ
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* QR ?¤ìº??ëª¨ë‹¬ */}
          {showQRScanner && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>QR ì¶œê²°</h3>
                <Button variant="ghost" size="sm" onClick={handleStopQRScanner}>
                  ?«ê¸°
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
                  QR ì½”ë“œë¥?ì¹´ë©”?¼ì— ë§ì¶°ì£¼ì„¸??
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', width: '100%', maxWidth: '500px' }}>
                  <Input
                    placeholder="QR ì½”ë“œë¥??¤ìº”?˜ê±°???™ìƒ IDë¥?ì§ì ‘ ?…ë ¥?˜ì„¸??
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
                      const input = document.querySelector('input[placeholder*="QR ì½”ë“œ"]') as HTMLInputElement;
                      if (input?.value.trim()) {
                        handleQRScan(input.value.trim());
                        input.value = '';
                      }
                    }}
                    fullWidth
                  >
                    ?•ì¸
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* ?µê³„/?ˆíŠ¸ë§??¨ë„ */}
          {showStatistics && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>ì¶œê²° ?µê³„</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowStatistics(false)}>
                  ?«ê¸°
                </Button>
              </div>

              {/* ë°˜ë³„ ?µê³„ */}
              {classes && classes.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                    ë°˜ë³„ ì¶œê²° ?µê³„
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
                              ì¶œì„ë¥?{classStats.attendanceRate}%
                            </Badge>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                            <div>
                              <span style={{ color: 'var(--color-text-secondary)' }}>?„ì²´: </span>
                              <strong>{classStats.total}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--color-text-secondary)' }}>ì¶œì„: </span>
                              <strong style={{ color: 'var(--color-success)' }}>{classStats.present}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--color-text-secondary)' }}>ì§€ê°? </span>
                              <strong style={{ color: 'var(--color-warning)' }}>{classStats.late}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--color-text-secondary)' }}>ê²°ì„: </span>
                              <strong style={{ color: 'var(--color-error)' }}>{classStats.absent}</strong>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ?”ì¼ë³??¨í„´ */}
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                  ?”ì¼ë³?ì¶œê²° ?¨í„´
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: 'var(--spacing-xs)', textAlign: 'left' }}>?”ì¼</th>
                        <th style={{ padding: 'var(--spacing-xs)', textAlign: 'right' }}>?±ì›</th>
                        <th style={{ padding: 'var(--spacing-xs)', textAlign: 'right' }}>?˜ì›</th>
                        <th style={{ padding: 'var(--spacing-xs)', textAlign: 'right' }}>ì§€ê°?/th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const dayPattern = analyzeDayPattern();
                        if (!dayPattern) return null;
                        return ['??, '??, '??, 'ëª?, 'ê¸?, '??, '??].map(day => (
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

              {/* ë°˜ë³„ ì¶œê²° ?ˆíŠ¸ë§?(ë¬¸ì„œ ?”êµ¬?¬í•­: ë°˜ë³„ ì¶œê²° ?ˆíŠ¸ë§? */}
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                  ë°˜ë³„ ì¶œê²° ?ˆíŠ¸ë§?
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  {(() => {
                    const heatmapData = calculateClassHeatmap();
                    if (!heatmapData) return <p style={{ color: 'var(--color-text-secondary)' }}>ì¶œê²° ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.</p>;
                    
                    const { dates, heatmap } = heatmapData;
                    if (dates.length === 0) return <p style={{ color: 'var(--color-text-secondary)' }}>ì¶œê²° ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.</p>;

                    return (
                      <div style={{ display: 'inline-block', minWidth: '100%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                              <th style={{ padding: 'var(--spacing-xs)', textAlign: 'left', position: 'sticky', left: 0, backgroundColor: 'var(--color-background)', zIndex: 1 }}>
                                ë°?/ ? ì§œ
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
                                        title="?°ì´???†ìŒ"
                                      >
                                        -
                                      </td>
                                    );
                                  }

                                  const intensity = dayData.attendanceRate / 100;
                                  const bgColor = dayData.attendanceRate >= 90
                                    ? `rgba(34, 197, 94, ${0.3 + intensity * 0.5})` // ì´ˆë¡
                                    : dayData.attendanceRate >= 70
                                    ? `rgba(234, 179, 8, ${0.3 + intensity * 0.5})` // ?¸ë‘
                                    : `rgba(239, 68, 68, ${0.3 + intensity * 0.5})`; // ë¹¨ê°•

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
                                      title={`${dateStr}: ì¶œì„ë¥?${dayData.attendanceRate}% (ì¶œì„: ${dayData.present}, ì§€ê°? ${dayData.late}, ê²°ì„: ${dayData.absent})`}
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
                            ìµœê·¼ 30?¼ë§Œ ?œì‹œ?©ë‹ˆ?? (?„ì²´ {dates.length}??
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ?œê°„?€ë³??¨í„´ */}
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                  ?œê°„?€ë³?ì¶œê²° ?ˆíŠ¸ë§?
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
                          title={`${i}?? ${count}ê±?}
                        >
                          <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{i}??/div>
                          <div>{count}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* AI ê¸°ë°˜ ë¹„ì •??ì¶œê²° ?ì? (ë¬¸ì„œ ?”êµ¬?¬í•­: AI ê¸°ë°˜ ë¹„ì •??ì¶œê²° ?ì?) */}
              <div>
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
                  AI ê¸°ë°˜ ë¹„ì •??ì¶œê²° ?ì?
                </h4>
                {(() => {
                  const anomalies = detectAbnormalAttendance();
                  if (!anomalies || anomalies.length === 0) {
                    return (
                      <Card padding="sm" variant="outlined">
                        <p style={{ color: 'var(--color-success)', textAlign: 'center', padding: 'var(--spacing-md)' }}>
                          ?´ìƒ ?¨í„´??ê°ì??˜ì? ?Šì•˜?µë‹ˆ??
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
                                  {anomaly.type === 'frequent_late' ? 'ë¹ˆë²ˆ??ì§€ê°? :
                                   anomaly.type === 'sudden_absence' ? 'ê°‘ì‘?¤ëŸ¬??ê²°ì„' :
                                   'ë¶ˆê·œì¹™í•œ ?¨í„´'}
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

