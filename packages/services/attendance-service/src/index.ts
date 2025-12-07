/**
 * Attendance Service
 * 
 * ì¶œê²° ê´€ë¦??œë¹„???ˆì´??
 * [ë¶ˆë? ê·œì¹™] Service Layer??Industry Layerë¥??˜í•‘?˜ì—¬ ?œê³µ?©ë‹ˆ??
 * [ë¶ˆë? ê·œì¹™] ?´ë¼?´ì–¸?¸ì—?œëŠ” ?€?…ë§Œ import: import type { ... } from '@services/attendance-service'
 * [ë¶ˆë? ê·œì¹™] ?œë²„ ì½”ë“œ???œë²„/Edge?ì„œë§??¬ìš©: import { attendanceService } from '@services/attendance-service/service'
 * 
 * ? ï¸ ì£¼ì˜: ??index.ts?ì„œ???€?…ë§Œ export?©ë‹ˆ??
 * ?œë²„ ì½”ë“œ???´ë¼?´ì–¸??ë²ˆë“¤???¬í•¨?˜ì? ?Šë„ë¡?'./service'?ì„œ ì§ì ‘ import?˜ì„¸??
 * 
 * ?¤ì œ ë¹„ì¦ˆ?ˆìŠ¤ ë¡œì§?€ @industry/academy/service???ˆìŠµ?ˆë‹¤.
 */

// ?€?…ë§Œ export (?´ë¼?´ì–¸?¸ì—?œë„ ?¬ìš© ê°€?? ?œë²„ ì½”ë“œ???¬í•¨?˜ì? ?ŠìŒ)
export type {
  AttendanceLog,
  CreateAttendanceLogInput,
  AttendanceFilter,
  AttendanceType,
  AttendanceStatus,
} from '@industry/academy';

// ?œë²„ ?„ìš© ì½”ë“œ????index.ts?ì„œ export?˜ì? ?ŠìŠµ?ˆë‹¤.
// ?œë²„?ì„œ??ì§ì ‘ import: import { attendanceService } from '@services/attendance-service/service'
// ?ëŠ”: import { attendanceService } from '@services/attendance-service/dist/service' (ë¹Œë“œ ??

