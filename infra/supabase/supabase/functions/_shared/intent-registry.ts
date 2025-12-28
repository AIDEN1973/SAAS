/**
 * Intent Registry for Edge Functions
 *
 * 챗봇.md 8.2, 12.1 참조
 * 목적: Edge Function에서 사용할 수 있는 간소화된 Intent Registry
 *
 * [SSOT] packages/chatops-intents/src/registry.ts가 Intent Registry의 SSOT입니다.
 * 이 파일은 환경 제약(Deno)으로 인한 간소화된 버전이며, SSOT와 동기화되어야 합니다.
 *
 * [불변 규칙] 새로운 Intent를 추가할 때는 SSOT(packages/chatops-intents/src/registry.ts)에
 * 먼저 추가한 후, 이 파일에도 동일한 intent_key로 추가해야 합니다.
 *
 * 주의: Edge Function은 Deno 환경이므로, npm 패키지를 직접 import하기 어렵습니다.
 * 따라서 이 파일은 registry의 핵심 정보만 포함합니다.
 * 실제 스키마 검증은 서버 측에서 수행해야 합니다.
 *
 * ⚠️ 자동 생성 파일: 이 파일은 scripts/generate-edge-intent-registry.ts에 의해 자동 생성됩니다.
 * 수동 수정 금지: SSOT Registry를 수정한 후 이 스크립트를 실행하여 동기화하세요.
 */

import type { IntentRegistryItem } from './intent-parser.ts';

/**
 * Intent Registry (간소화된 버전)
 *
 * [SSOT] packages/chatops-intents/src/registry.ts가 SSOT입니다.
 * 이 registry는 SSOT와 동기화되어야 하며, 새로운 Intent를 추가할 때는
 * SSOT에 먼저 추가한 후 이 파일에도 동일한 intent_key로 추가해야 합니다.
 */
export const intentRegistry: Record<string, IntentRegistryItem> = {
  // 출결(Attendance) 도메인

  'attendance.query.late': {
    intent_key: 'attendance.query.late',
    automation_level: 'L0',
    description: '지각한 대상 조회',
    examples: [
      '지각한 학생 조회',
      '오늘 지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '이번 주 지각자',
      '지각한 원생 리스트',
      '늦은 회원 목록',
      '최근 지각한 수강생',
    ],
  },

  'attendance.create.notify_guardians_late': {
    intent_key: 'attendance.create.notify_guardians_late',
    automation_level: 'L1',
    description: '지각 대상 보호자 알림 TaskCard 생성',
    examples: [
      '지각한 학생 목록 생성',
      '오늘 늦게 온 애들 알림',
      '이번 주 지각자 리스트 만들어 줘',
      '지각학생조회 해줘',
      '늦은 대상들 보호자에게 알림',
      '지각한 원생들 알려줘',
      '지각한 수강생들 목록 생성해 줘',
      '이번 주 지각한 회원들 알려줘',
    ],
  },

  'attendance.exec.notify_guardians_late': {
    intent_key: 'attendance.exec.notify_guardians_late',
    automation_level: 'L2',
    execution_class: 'A',
    description: '지각 대상 보호자 알림 발송 실행',
    examples: [
      '지각 학생 보호자에게 알림 보내기',
      '오늘 늦게 온 원생들 체크해줘',
      '이번 주 지각자 목록 알려줘',
      '지각한 회원들에게 메시지 발송해',
      '늦은 대상들 알림 보내기',
      '지각학생 조회해줘',
      '오늘 지각한 수강생들 보여줘',
      '늦은 아이들 보호자에게 알림 보내기',
    ],
  },

  'attendance.exec.notify_guardians_absent': {
    intent_key: 'attendance.exec.notify_guardians_absent',
    automation_level: 'L2',
    execution_class: 'A',
    description: '결석 대상 보호자 알림 발송 실행',
    examples: [
      '결석한 대상 알림 보내줘',
      '오늘 결석한 원생들 알려줘',
      '결석자 목록 전송해',
      '결석한 수강생들 찾아줘',
      '이번 주 결석자들 리스트',
      '결석한 회원들에게 알림 보내',
      '결석한 애들 연락처 조회해',
      '결석한 학생들한테 알림 전송',
    ],
  },

  'attendance.exec.request_reason_message': {
    intent_key: 'attendance.exec.request_reason_message',
    automation_level: 'L2',
    execution_class: 'A',
    description: '결석 사유 요청 메시지 발송 실행',
    examples: [
      '결석 사유 요청해줘',
      '이번 주 결석한 원생들 목록',
      '결석한 학생들 사유 알려줘',
      '오늘 결석한 대상 확인',
      '결석자 사유 리스트 보여줘',
      '결석한 수강생들 사유 요청',
      '결석한 애들 사유 좀 보내줘',
      '결석 사유 메시지 발송해줘',
    ],
  },

  'attendance.exec.send_staff_summary': {
    intent_key: 'attendance.exec.send_staff_summary',
    automation_level: 'L2',
    execution_class: 'A',
    description: '직원용 출결 요약 발송 실행',
    examples: [
      '직원 출결 요약 보내줘',
      '이번 주 출결 요약 좀 확인해봐',
      '출결 요약 발송 부탁해',
      '오늘 출결 정리해서 보내줘',
      '지각한 직원 목록 보여줘',
      '이번 달 지각자들 요약해줘',
      '늦은 직원들 리스트 보내줘',
      '출결 상태 요약해서 발송해줘',
    ],
  },



  // 학생 라이프사이클(Student) 도메인

  'student.query.search': {
    intent_key: 'student.query.search',
    automation_level: 'L0',
    description: '학생 검색',
    examples: [
      '박소영 검색',
      '박소영 찾기',
      '박소영 조회',
      '학생 검색',
      '대상 검색',
      '회원 검색',
      '원생 검색',
      '수강생 찾기',
    ],
  },



  // 출결(Attendance) 도메인

  'attendance.query.by_student': {
    intent_key: 'attendance.query.by_student',
    automation_level: 'L0',
    description: '특정 학생의 출결 조회',
    examples: [
      '오늘 지각한 학생',
      '이번 주 지각자 목록',
      '지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '지각한 원생들 확인해',
      '최근 지각한 수강생',
      '늦은 학생 목록',
    ],
  },

  'attendance.query.absent': {
    intent_key: 'attendance.query.absent',
    automation_level: 'L0',
    description: '결석한 대상 조회',
    examples: [
      '오늘 결석한 대상 조회',
      '결석한 애들 보여줘',
      '결석자 리스트',
      '이번 주 결석한 원생들',
      '결석학생조회',
      '오늘 지각한 수강생',
      '늦게 온 사람들 목록',
      '지각한 회원 리스트',
    ],
  },

  'attendance.query.early_leave': {
    intent_key: 'attendance.query.early_leave',
    automation_level: 'L0',
    description: '조퇴한 대상 조회',
    examples: [
      '조퇴한 원생 리스트',
      '오늘 조퇴한 대상 보여줘',
      '이번 주 조퇴자 조회',
      '조퇴 학생 목록',
      '조퇴한 애들 확인해',
      '조퇴한 회원들',
      '조퇴한 수강생 조회해 줘',
      '조퇴자 리스트',
    ],
  },

  'attendance.query.unchecked': {
    intent_key: 'attendance.query.unchecked',
    automation_level: 'L0',
    description: '출결 미체크 대상 조회',
    examples: [
      '오늘 지각한 대상 조회',
      '지각한 원생 리스트 보여줘',
      '이번 주 지각자 확인해줘',
      '지각학생조회',
      '늦게 온 수강생들',
      '지각한 회원들 목록',
      '오늘 늦은 학생들',
      '이번 주 지각한 애들',
    ],
  },

  'attendance.query.by_class': {
    intent_key: 'attendance.query.by_class',
    automation_level: 'L0',
    description: '반별 출결 조회',
    examples: [
      '반별 출결 조회',
      '1반 출결 확인',
      '수학반 출석 현황',
      '영어반 출결 조회',
      '반별 출석률 확인',
      '특정 반 출결 조회',
      '반 출결 내역',
      '반 출석 현황 보여줘',
    ],
  },

  'attendance.query.streak_absent': {
    intent_key: 'attendance.query.streak_absent',
    automation_level: 'L0',
    description: '연속 결석 대상 조회',
    examples: [
      '연속 결석한 대상 조회',
      '최근에 결석한 수강생 목록 보여줘',
      '지각한 회원들 확인',
      '이번 주 결석한 애들 리스트',
      '지각자 조회해 줘',
      '결석 대상 리스트',
      '연속으로 결석한 원생들',
      '오늘 지각한 회원들',
    ],
  },

  'attendance.query.rate_summary': {
    intent_key: 'attendance.query.rate_summary',
    automation_level: 'L0',
    description: '출결률 요약 조회',
    examples: [
      '출결률 요약 보여줘',
      '이번 주 출결 상황 확인',
      '지각한 원생 리스트',
      '오늘 지각자들',
      '지각 학생들 알려줘',
      '이번 달 출결 요약',
      '지각한 회원 목록',
      '최근 출결 현황',
    ],
  },

  'attendance.query.rate_drop': {
    intent_key: 'attendance.query.rate_drop',
    automation_level: 'L0',
    description: '출결률 하락 대상 조회',
    examples: [
      '지각한 원생 조회',
      '이번 주 지각자 리스트 보여줘',
      '늦은 학생 목록',
      '오늘 지각한 대상 확인해줘',
      '지각학생조회',
      '지각한 애들 리스트',
      '이번 달 지각자들',
      '늦게 온 수강생들 보여줘',
    ],
  },

  'attendance.query.late_rank': {
    intent_key: 'attendance.query.late_rank',
    automation_level: 'L0',
    description: '지각 랭킹 조회',
    examples: [
      '지각 랭킹 조회해줘',
      '오늘 지각한 원생들 보여줘',
      '이번 주 지각자 명단은?',
      '늦게 온 회원들 확인할 수 있어?',
      '지각한 애들 리스트',
      '늦은 학생 목록 알고 싶어',
      '지각학생조회 해줘',
      '최근 지각자 랭킹은 어떻게 돼?',
    ],
  },

  'attendance.query.export_csv': {
    intent_key: 'attendance.query.export_csv',
    automation_level: 'L0',
    description: '출결 데이터 CSV 내보내기',
    examples: [
      '출결 데이터 CSV로 내보내기',
      '지각한 대상들 CSV로 저장해줘',
      '지각학생 목록을 CSV로',
      '이번 주 늦은 학생들 CSV 파일로',
      '오늘 지각한 원생들 내보내기',
      '늦게 온 수강생들 CSV로 export',
      '지각자 CSV 파일로 만들어줘',
      '지각한 회원들 리스트를 CSV로',
    ],
  },

  'attendance.task.flag_absence_followup': {
    intent_key: 'attendance.task.flag_absence_followup',
    automation_level: 'L1',
    description: '결석 후속 조치 TaskCard 생성',
    examples: [
      '결석한 대상 목록 생성',
      '결석자 후속 조치 하기',
      '오늘 결석한 원생 보여줘',
      '이번 주 결석 학생 조회',
      '결석한 회원들 리스트',
      '결석자 관리 태스크 카드 만들기',
      '결석한 수강생 목록 확인',
      '결석한 애들 후속 처리',
    ],
  },

  'attendance.task.flag_late_followup': {
    intent_key: 'attendance.task.flag_late_followup',
    automation_level: 'L1',
    description: '지각 후속 조치 TaskCard 생성',
    examples: [
      '지각한 원생 조회',
      '오늘 늦게 온 회원 리스트',
      '이번 주 지각자 확인해줘',
      '늦은 대상 목록 보여줘',
      '지각학생조회 해줘',
      '지각한 수강생들 정보',
      '지각자 목록 생성',
      '이번 달 지각한 애들 보여줘',
    ],
  },

  'attendance.task.create_contact_list': {
    intent_key: 'attendance.task.create_contact_list',
    automation_level: 'L1',
    description: '연락처 목록 생성 TaskCard',
    examples: [
      '지각한 대상 목록 생성해줘',
      '이번 주 지각자들 보여줘',
      '지각학생 리스트 만들어',
      '늦은 원생들 리스트 필요해',
      '오늘 지각한 수강생들 확인할래',
      '지각한 애들 연락처 목록 필요해',
      '늦게 온 회원들 조회해줘',
      '이번 달 지각한 대상들 정리해줘',
    ],
  },

  'attendance.exec.correct_record': {
    intent_key: 'attendance.exec.correct_record',
    automation_level: 'L2',
    execution_class: 'B',
    description: '출결 기록 수정 실행',
    examples: [
      '지각한 학생 조회',
      '이번 주 지각자 목록 보여줘',
      '늦은 원생들 확인해',
      '오늘 지각자',
      '지각학생조회',
      '오늘 지각한 대상',
      '늦게 온 회원들 리스트',
      '이번 주 지각한 수강생들',
    ],
  },

  'attendance.exec.mark_excused': {
    intent_key: 'attendance.exec.mark_excused',
    automation_level: 'L2',
    execution_class: 'B',
    description: '출결 기록 사유 처리 실행',
    examples: [
      '출결 사유 처리해줘',
      '지각 사유 처리하기',
      '결석 사유 처리',
      '출결 기록 사유 처리',
      '사유 처리 실행',
      '출결 사유 등록',
      '지각 사유 등록해줘',
      '결석 사유 등록하기',
    ],
  },

  'attendance.exec.bulk_update': {
    intent_key: 'attendance.exec.bulk_update',
    automation_level: 'L2',
    execution_class: 'B',
    description: '출결 기록 일괄 수정 실행',
    examples: [
      '전체 출결 기록 수정하기',
      '이번 주 지각자 목록 보여줘',
      '지각한 원생들 일괄 수정',
      '오늘 늦은 학생들 조회',
      '지각학생 수정해줘',
      '지각한 수강생들 한 번에 업데이트',
      '이번 달 지각자 일괄 처리',
      '늦게 온 대상들 수정하기',
    ],
  },

  'attendance.exec.schedule_recheck': {
    intent_key: 'attendance.exec.schedule_recheck',
    automation_level: 'L2',
    execution_class: 'B',
    description: '출결 재확인 예약 실행',
    examples: [
      '지각자 목록 확인',
      '오늘 지각한 원생들 보여줘',
      '이번 주 지각한 대상 조회',
      '늦은 학생들 리스트',
      '지각학생조회 해줘',
      '오늘 늦게 온 수강생들',
      '이번 주 지각자 확인해',
      '지각자 재확인 예약',
    ],
  },



  // 수납/청구(Billing) 도메인

  'billing.query.overdue_month': {
    intent_key: 'billing.query.overdue_month',
    automation_level: 'L0',
    description: '월별 연체 조회',
    examples: [
      '이번 달 연체된 대상 확인',
      '지난달 지각자 리스트 보여줘',
      '지각한 수강생 목록',
      '이번 주 연체된 회원 목록',
      '연체된 원생 조회',
      '지각자 현황',
      '이번 달 늦은 학생들',
      '지각학생조회',
    ],
  },

  'billing.query.overdue_list': {
    intent_key: 'billing.query.overdue_list',
    automation_level: 'L0',
    description: '연체 목록 조회',
    examples: [
      '연체 목록 조회',
      '미납자 목록',
      '돈 안낸 사람',
      '돈 안낸 학생',
      '납부 안한 사람들',
      '결제 안한 학생',
      '미결제자 목록',
      '연체자 조회',
      '미결제자 조회',
      '연체자 목록',
      '미납 학생들',
      '납부 안된 사람',
    ],
  },

  'billing.query.by_student': {
    intent_key: 'billing.query.by_student',
    automation_level: 'L0',
    description: '특정 학생의 청구 조회',
    examples: [
      '학생 청구 내역 조회',
      '이번 달 청구서 확인할 수 있어?',
      '청구 내역 확인',
      '결제 내역 조회',
      '납부 내역 확인',
      '수납 내역 조회',
      '청구서 목록',
      '결제 내역 보여줘',
    ],
  },

  'billing.query.invoice_status': {
    intent_key: 'billing.query.invoice_status',
    automation_level: 'L0',
    description: '청구서 상태 조회',
    examples: [
      '청구서 상태가 궁금해요',
      '내 청구서 확인해줄래?',
      '청구서조회',
      '현재 청구서 진행 상황 알려줘',
      '청구서 상태 어떤지 알고싶어',
      '이번 달 청구서 상태는 어때?',
      '청구서가 어떻게 되었는지 보여줘',
      '내 청구서 진행 상태 확인해줘',
    ],
  },

  'billing.query.failed_payments': {
    intent_key: 'billing.query.failed_payments',
    automation_level: 'L0',
    description: '결제 실패 목록 조회',
    examples: [
      '결제 실패한 목록 좀 보여줘',
      '실패한 결제 내역 조회',
      '결제실패리스트',
      '결제 못한 회원들 확인해줘',
      '이번 달 결제 실패자',
      '최근 결제 실패한 원생 목록',
      '지금까지 결제 실패한 대상들',
      '결제 안 된 수강생 리스트',
    ],
  },

  'billing.query.refund_candidates': {
    intent_key: 'billing.query.refund_candidates',
    automation_level: 'L0',
    description: '환불 후보 조회',
    examples: [
      '환불 받을 수 있는 대상 조회',
      '환불 후보 리스트 보여줘',
      '환불 가능한 원생들',
      '환불 대상 확인해줘',
      '이번 달 환불할 수 있는 수강생',
      '환불 가능한 애들 목록',
      '환불 후보 원생들 리스트',
      '환불 조건에 맞는 회원 조회',
    ],
  },

  'billing.query.kpi_summary': {
    intent_key: 'billing.query.kpi_summary',
    automation_level: 'L0',
    description: '수납 KPI 요약 조회',
    examples: [
      '수납 KPI 요약 조회해줘',
      '오늘 수납 KPI는 어때?',
      '이번 달 수납 성과 요약 부탁해',
      '최근 수납 KPI 정리해줘',
      '수납 KPI 요약 확인할 수 있을까?',
      '이번 주 수납 KPIs 알려줘',
      '수납 성과 보고서 보여줘',
      '회원 수납 KPI 현황 궁금해',
    ],
  },

  'billing.query.unissued_invoices': {
    intent_key: 'billing.query.unissued_invoices',
    automation_level: 'L0',
    description: '미발행 청구서 조회',
    examples: [
      '미발행 청구서 확인해줘',
      '청구서 아직 안 나온 거 있나?',
      '안 나온 청구서 목록 보여줘',
      '발행되지 않은 청구서 조회할래',
      '이번 달 미발행 청구서 있나요?',
      '청구서 리스트 중 안 나온 것 찾아줘',
      '미발행된 청구서 좀 보여줘',
      '아직 발행 안 된 청구서 목록',
    ],
  },

  'billing.query.partial_payments': {
    intent_key: 'billing.query.partial_payments',
    automation_level: 'L0',
    description: '부분 결제 목록 조회',
    examples: [
      '부분 결제 내역 보여줘',
      '부분 결제 목록 조회해줘',
      '부분 결제한 원생들',
      '부분 결제한 대상 확인',
      '이번 달 부분 결제 내역',
      '최근 부분 결제한 수강생 목록',
      '부분 결제 내역 리스트',
      '부분 결제 현황 봐야해',
    ],
  },

  'billing.query.export_statement': {
    intent_key: 'billing.query.export_statement',
    automation_level: 'L0',
    description: '명세서 내보내기',
    examples: [
      '명세서 내보내기 해줄래?',
      '이번 달 명세서 가져와',
      '명세서 출력해줘',
      '나의 명세서 내보내줘',
      '지난주 명세서 파일로 내보내기',
      '명세서 좀 뽑아줘',
      '최근 명세서 내보내기 요청',
      '수강생 명세서 내보내주세요',
    ],
  },

  'billing.task.flag_overdue_followup': {
    intent_key: 'billing.task.flag_overdue_followup',
    automation_level: 'L1',
    description: '연체 후속 조치 TaskCard 생성',
    examples: [
      '연체된 대상 조회해줘',
      '이번 달 연체자 목록 보여줘',
      '연체자 리스트 생성해',
      '지각한 회원들 확인',
      '오늘 연체된 수강생들',
      '늦은 원생들 리스트',
      '이번 주 연체자들 보여줘',
      '연체 후속 조치 카드 만들어',
    ],
  },

  'billing.task.prepare_invoice_batch': {
    intent_key: 'billing.task.prepare_invoice_batch',
    automation_level: 'L1',
    description: '청구서 일괄 준비 TaskCard 생성',
    examples: [
      '청구서 일괄 준비해줘',
      '청구서 다 만들기',
      '청구서 준비',
      '청구서 일괄작성',
      '회원 청구서 한꺼번에 준비해줘',
      '이번 달 청구서 준비하기',
      '모든 대상 청구서 준비',
      '수강생 청구서 일괄 처리해',
    ],
  },

  'billing.task.prepare_refund_review': {
    intent_key: 'billing.task.prepare_refund_review',
    automation_level: 'L1',
    description: '환불 검토 TaskCard 생성',
    examples: [
      '환불 검토 요청해줘',
      '환불 검토 TaskCard 만들어줘',
      '환불 리뷰 준비해',
      '환불 관련 검토 시작해',
      '환불 검토할 대상 리스트',
      '이번 달 환불 검토 요청',
      '환불 검토 TaskCard 생성해',
      '환불 검토할 수강생 목록 보여줘',
    ],
  },

  'billing.task.prepare_payment_link_batch': {
    intent_key: 'billing.task.prepare_payment_link_batch',
    automation_level: 'L1',
    description: '결제 링크 일괄 준비 TaskCard 생성',
    examples: [
      '결제 링크 일괄 준비해줘',
      '결제 링크 만들어줘',
      '결제링크 일괄 준비',
      '회원들 결제 링크 생성',
      '대상 결제 링크 준비 부탁해',
      '이번 주 결제 링크 일괄로 생성해줘',
      '수강생 결제 링크 한번에 준비해',
      '원생 결제 링크 일괄로 만들어줘',
    ],
  },

  'billing.task.flag_churn_risk_from_billing': {
    intent_key: 'billing.task.flag_churn_risk_from_billing',
    automation_level: 'L1',
    description: '수납 기반 이탈 위험 플래깅 TaskCard 생성',
    examples: [
      '이탈 위험 대상 플래그 설정',
      '이탈 가능성 있는 회원 표시해줘',
      '수납 기반 이탈 리스크 플래그',
      '위험한 수강생 목록 보여줘',
      '오늘 수납 못한 대상 플래그',
      '이번 달 이탈 위험 회원들',
      '연체된 원생 플래그 생성',
      '지금 이탈 위험한 대상 확인',
    ],
  },

  'billing.exec.send_payment_link': {
    intent_key: 'billing.exec.send_payment_link',
    automation_level: 'L2',
    execution_class: 'A',
    description: '결제 링크 발송 실행',
    examples: [
      '결제 링크 보내줘',
      '지금 결제 링크 발송해',
      '결제링크전송',
      '결제 관련 링크 좀 보내주세요',
      '수강생들에게 결제 링크 발송해줘',
      '회원 결제 링크 전달 부탁해',
      '지금 당장 결제 링크 보내',
      '결제 링크를 오늘 꼭 보내줘',
    ],
  },

  'billing.exec.schedule_overdue_notice': {
    intent_key: 'billing.exec.schedule_overdue_notice',
    automation_level: 'L2',
    execution_class: 'A',
    description: '연체 안내 예약 발송 실행',
    examples: [
      '연체 안내 예약해줘',
      '이번 달 연체된 회원들 알려줘',
      '연체자 목록 예약 발송해',
      '연체된 수강생들 보고 싶어',
      '오늘 연체된 대상들 발송',
      '연체 안내 문자 보내는 거 예약해',
      '이번 주 연체한 애들 보여줘',
      '연체 안내 문자 예약할게',
    ],
  },

  'billing.exec.issue_invoices': {
    intent_key: 'billing.exec.issue_invoices',
    automation_level: 'L2',
    execution_class: 'B',
    description: '청구서 발행 실행',
    examples: [
      '청구서 발행해 줘',
      '청구서 만들기 부탁해',
      '청구서 발행할게',
      '이번 달 청구서 발행해 주세요',
      '이번 주에 발행할 청구서 리스트',
      '지금 청구서 발행해',
      '청구서 발행 요청해요',
      '오늘 날짜로 청구서 발행',
    ],
  },

  'billing.exec.reissue_invoice': {
    intent_key: 'billing.exec.reissue_invoice',
    automation_level: 'L2',
    execution_class: 'B',
    description: '청구서 재발행 실행',
    examples: [
      '청구서 다시 발행해줘',
      '청구서 재발급 부탁해',
      '청구서 재발행할 수 있어?',
      '청구서 다시 만들어줘',
      '청구서 발행 다시 해줘',
      '재발행된 청구서 요청해',
      '청구서 재발행해줘',
      '청구서 다시 보내줘',
    ],
  },

  'billing.exec.record_manual_payment': {
    intent_key: 'billing.exec.record_manual_payment',
    automation_level: 'L2',
    execution_class: 'B',
    description: '수동 결제 기록 실행',
    examples: [
      '수동 결제로 결제 기록하기',
      '오늘 결제한 것들 수동으로 입력해줘',
      '회원의 결제 내역 추가해',
      '원생 결제 기록을 수동으로 작성할래',
      '이번 달 수강생 결제 내역 입력해줘',
      '결제 내역을 수동으로 기록할 수 있을까?',
      '대상 결제 정보 추가하기',
      '지금까지의 결제 내역 수동으로 정리해줘',
    ],
  },

  'billing.exec.apply_discount': {
    intent_key: 'billing.exec.apply_discount',
    automation_level: 'L2',
    execution_class: 'B',
    description: '할인 적용 실행',
    examples: [
      '할인 적용해줘',
      '할인 해주세요',
      '지금 할인 적용',
      '할인 적용하는 방법 알려줘',
      '할인 적용 요청합니다',
      '회원 할인 적용해줘',
      '수강생 할인 적용해줘',
      '이번 달 할인 적용해',
    ],
  },

  'billing.exec.apply_refund': {
    intent_key: 'billing.exec.apply_refund',
    automation_level: 'L2',
    execution_class: 'B',
    description: '환불 적용 실행',
    examples: [
      '환불 신청해줘',
      '환불 처리 부탁해',
      '환불적용',
      '환불 진행할 수 있어?',
      '오늘 환불 요청한 건 있나요?',
      '이번 달 환불 신청 리스트 보여줘',
      '환불이 필요해, 어떻게 해야 돼?',
      '환불 절차 시작해줘',
    ],
  },

  'billing.exec.create_installment_plan': {
    intent_key: 'billing.exec.create_installment_plan',
    automation_level: 'L2',
    execution_class: 'B',
    description: '할부 계획 생성 실행',
    examples: [
      '할부 계획 생성해줘',
      '할부 계획 만들어주세요',
      '할부로 결제할 수 있게 해줘',
      '이번 달 할부 계획 세워줘',
      '회원의 할부 계획을 설정해줘',
      '수강생 할부 계획 생성하기',
      '지금 할부 계획을 작성해줘',
      '할부 계획 등록해줘',
    ],
  },

  'billing.exec.fix_duplicate_invoices': {
    intent_key: 'billing.exec.fix_duplicate_invoices',
    automation_level: 'L2',
    execution_class: 'B',
    description: '중복 청구서 수정 실행',
    examples: [
      '중복 청구서 수정해줘',
      '중복된 인보이스 고쳐주세요',
      '청구서 중복 수정 실행',
      '중복된 청구서 삭제하고 싶어',
      '청구서 중복 문제 해결 부탁해',
      '중복 청구서 다 처리해줘',
      '이중 청구서 수정 작업 해줘',
      '중복 인보이스 정리해 줘',
    ],
  },

  'billing.exec.sync_gateway': {
    intent_key: 'billing.exec.sync_gateway',
    automation_level: 'L2',
    execution_class: 'B',
    description: '결제 게이트웨이 동기화 실행',
    examples: [
      '결제 게이트웨이 동기화해줘',
      '지금 결제 시스템 동기화 실행해',
      '결제 게이트웨이 동기화 요청',
      '동기화 작업 해줘, 결제 게이트웨이',
      '결제 시스템 지금 바로 동기화',
      '결제 게이트웨이 동기화 부탁해',
      '결제 관련 데이터 동기화 시켜줘',
      '결제 게이트웨이 업데이트 실행해',
    ],
  },

  'billing.exec.close_month': {
    intent_key: 'billing.exec.close_month',
    automation_level: 'L2',
    execution_class: 'B',
    description: '월 마감 처리 실행',
    examples: [
      '이번 달 마감 처리 해줘',
      '월 마감 실행해',
      '이번 달 결산 진행 부탁',
      '이번 달 정산 처리해 줘',
      '마감 처리 시작해',
      '이번 달 결제 마감 부탁해',
      '월말 정산 시작해줘',
      '이번 월 마감 작업 진행해',
    ],
  },



  // 메시지/공지(Messaging) 도메인

  'message.query.sent_log': {
    intent_key: 'message.query.sent_log',
    automation_level: 'L0',
    description: '발송 로그 조회',
    examples: [
      '오늘 지각한 원생 조회',
      '이번 주 지각자 목록 보여줘',
      '늦게 온 회원들 확인해',
      '지각한 학생들 리스트',
      '지각학생조회',
      '최근 지각한 대상',
      '오늘 지각한 수강생',
      '늦은 학생들 리스트',
    ],
  },

  'message.query.failed_log': {
    intent_key: 'message.query.failed_log',
    automation_level: 'L0',
    description: '발송 실패 로그 조회',
    examples: [
      '발송 실패 로그 확인해줘',
      '실패한 발송 내역 보여줘',
      '발송실패로그조회',
      '실패한 메시지 내역',
      '오늘 발송 실패한 목록',
      '최근에 실패한 로그',
      '지난주 발송 실패 내역',
      '어제 발송 실패 기록',
    ],
  },

  'message.draft.absence_notice': {
    intent_key: 'message.draft.absence_notice',
    automation_level: 'L0',
    description: '결석 안내 초안 생성',
    examples: [
      '지각 학생 목록 보여줘',
      '오늘 늦게 온 원생들 확인해줘',
      '이번 주 지각한 수강생 조회',
      '지각자 리스트',
      '지각한 대상들',
      '이번 주 지각한 애들',
      '늦은 회원 목록',
      '지각학생조회',
    ],
  },

  'message.draft.overdue_notice': {
    intent_key: 'message.draft.overdue_notice',
    automation_level: 'L0',
    description: '연체 안내 초안 생성',
    examples: [
      '연체 안내 초안 작성해줘',
      '지각한 원생 목록 보여줘',
      '이번 주 지각자 리스트',
      '지각한 회원들 확인해',
      '오늘 늦게 온 학생들',
      '연체된 대상 조회',
      '지각학생정보',
      '늦은 수강생들 리스트',
    ],
  },

  'message.draft.general_notice': {
    intent_key: 'message.draft.general_notice',
    automation_level: 'L0',
    description: '일반 공지 초안 생성',
    examples: [
      '이번 주 지각한 원생 목록',
      '지각자 리스트 보여줘',
      '지각한 학생 조회해줘',
      '오늘 지각한 대상들',
      '늦게 온 회원들 확인',
      '이번 주 늦은 수강생',
      '지각학생조회 해주세요',
      '지각한 애들 리스트',
    ],
  },

  'message.preview.audience': {
    intent_key: 'message.preview.audience',
    automation_level: 'L0',
    description: '수신 대상 미리보기',
    examples: [
      '지각한 학생 조회',
      '이번 주 지각자 리스트',
      '늦게 온 원생들 보여줘',
      '지각학생조회',
      '오늘 지각한 대상',
      '지각한 수강생 목록',
      '최근 지각자 확인',
      '늦은 회원들 리스트',
    ],
  },

  'message.preview.template_render': {
    intent_key: 'message.preview.template_render',
    automation_level: 'L0',
    description: '템플릿 렌더링 미리보기',
    examples: [
      '지각한 원생 조회',
      '오늘 지각자 리스트 보여줘',
      '지각학생목록',
      '늦게 온 수강생들',
      '이번 주 지각한 대상',
      '지각한 회원 확인해줘',
      '이번 주 늦은 학생들',
      '지각한 애들 리스트',
    ],
  },

  'message.draft.payment_link_notice': {
    intent_key: 'message.draft.payment_link_notice',
    automation_level: 'L0',
    description: '결제 링크 안내 초안 생성',
    examples: [
      '결제 링크 보내줘',
      '결제할 수 있는 링크 알려줘',
      '결제 링크 좀 주세요',
      '결제 관련 링크 정리해줘',
      '오늘 결제 링크 공유해',
      '결제링크',
      '결제 링크 안내해줘',
      '이번 달 결제 링크 정보',
    ],
  },

  'message.query.variables_check': {
    intent_key: 'message.query.variables_check',
    automation_level: 'L0',
    description: '템플릿 변수 검증',
    examples: [
      '지각한 학생 조회',
      '오늘 지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '이번 주 지각자',
      '오늘 수업에 늦은 원생',
      '지각한 회원 리스트',
      '지각한 수강생 목록',
    ],
  },

  'message.task.prepare_bulk_send': {
    intent_key: 'message.task.prepare_bulk_send',
    automation_level: 'L1',
    description: '일괄 발송 준비 TaskCard 생성',
    examples: [
      '지각한 회원 목록 준비해줘',
      '이번 주 지각한 수강생들 보여줘',
      '지각한 대상 조회',
      '오늘 늦게 온 원생들 리스트',
      '지각학생리스트',
      '늦은 수강생들 확인해',
      '이번 달 지각자들 조회하기',
      '지각한 사람들 준비해줘',
    ],
  },

  'message.task.test_send_request': {
    intent_key: 'message.task.test_send_request',
    automation_level: 'L1',
    description: '테스트 발송 요청 TaskCard 생성',
    examples: [
      '테스트 발송 요청 해줘',
      '테스트 발송해 줘',
      '테스트 요청 보내기',
      '테스트발송요청',
      '테스트 발송할 수 있어?',
      '이번 주 테스트 발송 요청',
      '상황별 테스트 발송하기',
      '지금 테스트 요청 해줘',
    ],
  },

  'message.exec.send_to_guardian': {
    intent_key: 'message.exec.send_to_guardian',
    automation_level: 'L2',
    execution_class: 'A',
    description: '보호자 메시지 발송 실행',
    examples: [
      '오늘 지각한 원생들에게 메시지 보내줘',
      '지각학생 목록 전송해줘',
      '이번 주 늦은 학생들한테 연락해',
      '지각한 수강생들 보여줘',
      '지각한 애들한테 메시지 보내',
      '늦게 온 대상들한테 알림 전송',
      '오늘 지각한 회원들 리스트',
      '지각자들에게 메시지 보내주세요',
    ],
  },

  'message.exec.send_bulk': {
    intent_key: 'message.exec.send_bulk',
    automation_level: 'L2',
    execution_class: 'A',
    description: '일괄 메시지 발송 실행',
    examples: [
      '이번 주 지각한 대상에게 메시지 보내기',
      '지각한 원생들한테 일괄 발송해줘',
      '지각학생조회 하고 일괄 메시지 발송',
      '오늘 지각한 애들한테 연락해',
      '늦게 온 사람들에게 메시지 전송',
      '지각자 목록에 메시지 보내기',
      '지각한 수강생들에게 일괄적으로 메시지 보내',
      '이번 주 지각자에게 공지사항 보내기',
    ],
  },

  'message.exec.schedule_bulk': {
    intent_key: 'message.exec.schedule_bulk',
    automation_level: 'L2',
    execution_class: 'A',
    description: '일괄 메시지 예약 발송 실행',
    examples: [
      '지각한 원생 목록 조회',
      '오늘 지각한 학생들 보여줘',
      '이번 주 지각자 리스트',
      '지각학생조회',
      '늦게 온 대상 확인',
      '오늘 지각한 회원들',
      '지각자 관리하기',
      '이번 주 지각자들 조회',
    ],
  },

  'message.exec.resend_failed': {
    intent_key: 'message.exec.resend_failed',
    automation_level: 'L2',
    execution_class: 'A',
    description: '실패 메시지 재발송 실행',
    examples: [
      '실패한 메시지 다시 보내줘',
      '재발송 해주세요',
      '메시지 재전송 해줘',
      '실패했던 메시지 다시 보내는 거야',
      '이전 실패 메시지 다시 보내',
      '다시 한번 그 메시지 보내줄래?',
      '안됐던 메시지 재전송 부탁해',
      '그 실패 메시지 다시 보내줘',
    ],
  },

  'message.exec.optout_respect_audit': {
    intent_key: 'message.exec.optout_respect_audit',
    automation_level: 'L2',
    execution_class: 'A',
    description: '수신거부 감사 실행',
    examples: [
      '수신 거부 감사 실시해 줘',
      '오늘 수신 거부한 회원 목록 보여줘',
      '최근 수신 거부한 대상 확인할 수 있어?',
      '이번 주 수신 거부한 수강생 리스트',
      '수신 거부자 감사 실행해',
      '지금까지 수신 거부한 사람들 조회',
      '지난 달 수신 거부한 원생들',
      '지금 수신 거부 감사 진행할 수 있어?',
    ],
  },

  'message.exec.staff_broadcast': {
    intent_key: 'message.exec.staff_broadcast',
    automation_level: 'L2',
    execution_class: 'A',
    description: '직원 브로드캐스트 실행',
    examples: [
      '지각한 대상 조회',
      '늦게 온 애들 보여줘',
      '당일 지각자 리스트',
      '이번 주 지각학생 목록',
      '오늘 지각한 수강생들',
      '지각한 회원 리스트',
      '지각자 조회하기',
      '이번 주 늦은 학생들',
    ],
  },

  'message.exec.class_schedule_change_notice': {
    intent_key: 'message.exec.class_schedule_change_notice',
    automation_level: 'L2',
    execution_class: 'A',
    description: '수업 일정 변경 안내 실행',
    examples: [
      '수업 일정 변경 안내 해줘',
      '수업 시간 바뀐 거 알려줘',
      '변경된 수업 일정 봐야 해',
      '이번 주 수업 스케줄 변경',
      '수업 일정 변경사항 확인',
      '수업 시간 변동사항 알려줘',
      '수업 일정 수정된 거 보여줘',
      '오늘 변경된 수업 시간',
    ],
  },

  'message.exec.emergency_notice': {
    intent_key: 'message.exec.emergency_notice',
    automation_level: 'L2',
    execution_class: 'A',
    description: '긴급 공지 실행',
    examples: [
      '지각한 원생 조회',
      '오늘 지각한 수강생 목록 보여줘',
      '이번 주 늦은 대상 확인해줘',
      '늦었거나 지각한 회원 리스트',
      '지각자 목록 불러와',
      '지각학생조회',
      '오늘 늦게 온 사람들',
      '이번 주 지각한 애들 보여줘',
    ],
  },

  'message.exec.cancel_scheduled': {
    intent_key: 'message.exec.cancel_scheduled',
    automation_level: 'L2',
    execution_class: 'B',
    description: '예약 발송 취소 실행',
    examples: [
      '예약 발송 취소해줘',
      '발송 예약 취소할게',
      '예약취소',
      '예약한 발송 없애줘',
      '그냥 예약 취소해',
      '발송 취소 부탁해',
      '예약 취소할 수 있어?',
      '이번 주 발송 예약 취소',
    ],
  },

  'message.exec.create_template': {
    intent_key: 'message.exec.create_template',
    automation_level: 'L2',
    execution_class: 'B',
    description: '메시지 템플릿 생성 실행',
    examples: [
      '메시지 템플릿 만들기',
      '새로운 메시지 템플릿 생성해줘',
      '메시지템플릿생성',
      '알림 템플릿 추가하고 싶어',
      '새 템플릿 생성할 수 있어?',
      '원생들에게 보낼 메시지 템플릿 만들어줘',
      '오늘의 공지사항 템플릿 생성',
      '이번 주 공지용 메시지 템플릿 제작',
    ],
  },

  'message.exec.update_template': {
    intent_key: 'message.exec.update_template',
    automation_level: 'L2',
    execution_class: 'B',
    description: '메시지 템플릿 수정 실행',
    examples: [
      '메시지 템플릿 수정해줘',
      '템플릿 업데이트 해주세요',
      '메시지 양식 바꿔줘',
      '기존 템플릿 수정하기',
      '템플릿 수정할 대상 알려줘',
      '메시지 템플릿 변경해주렴',
      '템플릿 업데이트를 진행해줘',
      '현재 템플릿 고쳐줘',
    ],
  },



  // 학생 라이프사이클(Student) 도메인

  'student.query.profile': {
    intent_key: 'student.query.profile',
    automation_level: 'L0',
    description: '학생 프로필 조회',
    examples: [
      '박소영 프로필',
      '박소영 정보',
      '박소영 전화번호',
      '박소영 연락처',
      '박소영 학생 정보',
      '박소영 대상 정보',
      '박소영 상세 정보',
      '학생 프로필 조회',
    ],
  },

  'student.query.status_list': {
    intent_key: 'student.query.status_list',
    automation_level: 'L0',
    description: '상태별 학생 목록 조회',
    examples: [
      '지각한 학생 목록 조회',
      '오늘 지각한 수강생들 보여줘',
      '이번 주 늦게 온 애들',
      '늦은 학생들 리스트',
      '지각학생조회',
      '오늘 지각자 명단',
      '늦은 대상을 확인해줘',
      '이번 주 지각한 원생들',
    ],
  },

  'student.query.missing_guardian_contact': {
    intent_key: 'student.query.missing_guardian_contact',
    automation_level: 'L0',
    description: '보호자 연락처 누락 학생 조회',
    examples: [
      '보호자 연락처 없는 학생 조회',
      '보호자 연락처 누락된 애들 보여줘',
      '보호자 연락처 결핍 원생 찾기',
      '연락처 없는 회원 리스트',
      '이번 주 보호자 연락처 없는 수강생',
      '연락처 미제출 학생 목록',
      '보호자 연락처 없는 대상 조회',
      '어제 보호자 연락처 누락된 학생들',
    ],
  },

  'student.query.duplicates_suspected': {
    intent_key: 'student.query.duplicates_suspected',
    automation_level: 'L0',
    description: '중복 의심 학생 조회',
    examples: [
      '중복 의심 학생 조회',
      '중복된 회원 있나?',
      '중복학생리스트',
      '중복 의심되는 수강생들',
      '이번 달 중복된 대상',
      '중복된 원생 목록 보여줘',
      '중복 의심 학생들 확인해',
      '중복된 애들 리스트',
    ],
  },

  'student.query.onboarding_needed': {
    intent_key: 'student.query.onboarding_needed',
    automation_level: 'L0',
    description: '온보딩 필요 학생 조회',
    examples: [
      '온보딩이 필요한 학생 리스트',
      '지각 학생들 확인해줘',
      '지각한 원생 조회',
      '늦게 온 수강생 목록',
      '이번 주 늦은 학생들',
      '온보딩 필요 회원 보여줘',
      '오늘 지각한 대상',
      '지각학생조회',
    ],
  },

  'student.query.data_quality_scan': {
    intent_key: 'student.query.data_quality_scan',
    automation_level: 'L0',
    description: '학생 데이터 품질 검증',
    examples: [
      '오늘 지각한 학생 리스트',
      '지각한 애들 보여줘',
      '이번 주 지각자 확인',
      '지각학생조회',
      '늦은 원생 목록',
      '이번 달 지각자',
      '늦게 온 사람들',
      '오늘 지각 리스트',
    ],
  },

  'student.task.register_prefill': {
    intent_key: 'student.task.register_prefill',
    automation_level: 'L1',
    description: '학생 등록 사전 입력 TaskCard 생성',
    examples: [
      '대상 등록 사전 입력해줘',
      '신규 원생 정보 미리 채워줘',
      '회원 등록할 때 정보 미리 넣기',
      '수강생 등록할 때 필요한 정보 알려줘',
      '대상 등록할 때 미리 준비할 것',
      '신입생 정보 미리 입력해줘',
      '이번 주 수강생 등록 정보 미리 채우기',
      '원생 등록할 때 필요한 사항 정리해줘',
    ],
  },

  'student.task.collect_documents': {
    intent_key: 'student.task.collect_documents',
    automation_level: 'L1',
    description: '문서 수집 TaskCard 생성',
    examples: [
      '지각한 원생 목록',
      '이번 주 늦게 온 학생들',
      '오늘 지각한 수강생 조회해줘',
      '지각자 리스트 보여줘',
      '늦은 회원 확인',
      '이번 주 지각 학생들',
      '지각학생조회',
      '오늘 지각한 애들 보여줘',
    ],
  },

  'student.exec.send_welcome_message': {
    intent_key: 'student.exec.send_welcome_message',
    automation_level: 'L2',
    execution_class: 'A',
    description: '신규 등록 환영 메시지 발송 실행',
    examples: [
      '신규 등록한 학생들에게 환영 메시지 보내줘',
      '새로 온 회원들한테 환영 인사 전송해',
      '신규 수강생들 환영 메시지 발송해줘',
      '오늘 등록한 원생들에게 메시지 보내기',
      '신규 대상들에게 환영 메세지 전송해',
      '새로 등록한 애들한테 환영 메시지 부탁해',
      '이번 주 신규 등록자들에게 환영 메시지 전발송',
      '신규 회원들한테 자동으로 환영 메시지 보내줘',
    ],
  },

  'student.exec.request_documents_message': {
    intent_key: 'student.exec.request_documents_message',
    automation_level: 'L2',
    execution_class: 'A',
    description: '문서 요청 메시지 발송 실행',
    examples: [
      '지각한 회원 목록 요청',
      '오늘 지각한 수강생 리스트 보여줘',
      '이번 주 늦은 원생들 조회',
      '지각 학생 자료 보내줘',
      '늦게 온 대상 리스트 확인해줘',
      '지각자 명단 요청할게',
      '이번 주 지각한 애들 보여줘',
      '지각학생조회 해줘',
    ],
  },

  'student.exec.register': {
    intent_key: 'student.exec.register',
    automation_level: 'L2',
    execution_class: 'B',
    description: '학생 등록 실행',
    examples: [
      '신규 수강생 등록해줘',
      '회원 등록 리스트 보여줘',
      '대상 등록하기',
      '새로운 원생 추가해',
      '이번 학기 수강생 등록',
      '신규 학생 등록할게',
      '오늘 등록한 수강생 확인',
      '회원 추가 요청합니다',
    ],
  },

  'student.exec.update_profile': {
    intent_key: 'student.exec.update_profile',
    automation_level: 'L2',
    execution_class: 'B',
    description: '학생 프로필 수정 실행',
    examples: [
      '프로필 수정하기',
      '내 정보 업데이트 해줘',
      '내 프로필 바꿔줘',
      '회원 정보 변경할게',
      '수강생 프로필 수정',
      '대상 정보 업데이트',
      '원생 프로필 수정해줘',
      '내 정보 수정하고 싶어',
    ],
  },

  'student.exec.change_class': {
    intent_key: 'student.exec.change_class',
    automation_level: 'L2',
    execution_class: 'B',
    description: '반 변경 실행',
    examples: [
      '반 변경해주세요',
      '수강생 반 바꿔줘',
      '회원 반 변경',
      '대상 클래스 변경 요청',
      '수업 반 바꾸고 싶어요',
      '원생 반 변경할 수 있나요?',
      '이번 학기 반 변경해 주세요',
      '클래스 변경 처리 부탁드립니다',
    ],
  },

  'student.exec.pause': {
    intent_key: 'student.exec.pause',
    automation_level: 'L2',
    execution_class: 'B',
    description: '학생 휴원 처리 실행',
    examples: [
      '학생 휴원 처리해줘',
      '오늘 지각한 원생들 보여줘',
      '이번 주 지각자 목록',
      '지각한 회원 조회',
      '늦은 애들 리스트',
      '지각학생조회 해주세요',
      '늦게 온 대상들 확인',
      '오늘 지각한 수강생들',
    ],
  },

  'student.exec.resume': {
    intent_key: 'student.exec.resume',
    automation_level: 'L2',
    execution_class: 'B',
    description: '학생 재개 처리 실행',
    examples: [
      '지각한 학생 리스트',
      '이번 주 지각자 보여줘',
      '지각학생조회 해줘',
      '늦게 온 회원들',
      '오늘 지각한 원생들',
      '지각자 목록 확인',
      '늦은 수강생들 리스트',
      '이번 달 지각한 대상',
    ],
  },

  'student.exec.discharge': {
    intent_key: 'student.exec.discharge',
    automation_level: 'L2',
    execution_class: 'B',
    description: '학생 퇴원 처리 실행',
    examples: [
      '학생 퇴원 처리해줘',
      '퇴원할 대상 목록 보여줘',
      '원생 퇴원 신청 진행',
      '퇴원 대상 확인 부탁해',
      '이번 주 퇴원한 수강생',
      '퇴원 처리할 회원 리스트',
      '대상 퇴원 요청 실행',
      '퇴원할 학생들 처리해줘',
    ],
  },

  'student.exec.merge_duplicates': {
    intent_key: 'student.exec.merge_duplicates',
    automation_level: 'L2',
    execution_class: 'B',
    description: '중복 학생 병합 실행',
    examples: [
      '중복된 원생 병합해줘',
      '학생 A와 B 통합하기',
      '회원 정보 중복 제거 요청',
      '수강생 병합 작업 실행해',
      '중복된 대상 합치기',
      '원생 중복 확인하고 병합해',
      '중복된 학생들 통합해줘',
      '지금 중복된 수강생 병합해',
    ],
  },

  'student.exec.update_guardian_contact': {
    intent_key: 'student.exec.update_guardian_contact',
    automation_level: 'L2',
    execution_class: 'B',
    description: '보호자 연락처 수정 실행',
    examples: [
      '보호자 연락처 수정해줘',
      '보호자 전화번호 바꾸고 싶어',
      '학생 A의 보호자 연락처 업데이트',
      '원생 보호자 정보 수정 요청',
      '회원의 연락처를 변경할 수 있을까?',
      '수강생 보호자 연락처 변경해줘',
      '보호자 연락처 업데이트할 때 어떤 정보 필요해?',
      '대상 보호자 전화번호를 수정해 주세요',
    ],
  },

  'student.exec.assign_tags': {
    intent_key: 'student.exec.assign_tags',
    automation_level: 'L2',
    execution_class: 'B',
    description: '학생 태그 할당 실행',
    examples: [
      '지각한 학생 태그 달아줘',
      '이번 주 지각자들 보여줘',
      '지각학생조회 해줘',
      '늦게 온 원생 목록',
      '오늘 지각한 회원 태그 추가',
      '지각자들 리스트 업',
      '지각한 수강생들 확인',
      '이번 달 늦은 학생들 태그',
    ],
  },

  'student.exec.bulk_register': {
    intent_key: 'student.exec.bulk_register',
    automation_level: 'L2',
    execution_class: 'B',
    description: '학생 일괄 등록 실행',
    examples: [
      '학생 일괄 등록해줘',
      '원생들 한꺼번에 등록하기',
      '수강생들 등록하기',
      '회원 일괄 등록 요청',
      '이번 주에 등록할 대상들',
      '대상 일괄 등록 실행해',
      '모든 학생 등록하기',
      '한 번에 수강생 등록해줘',
    ],
  },

  'student.exec.bulk_update': {
    intent_key: 'student.exec.bulk_update',
    automation_level: 'L2',
    execution_class: 'B',
    description: '학생 일괄 수정 실행',
    examples: [
      '지각한 학생 일괄 수정해줘',
      '이번 주 지각자들 업데이트 할게',
      '지각학생 일괄 수정',
      '오늘 늦게 온 애들 수정해',
      '늦은 학생 목록 한 번에 고치기',
      '지각한 원생들 한꺼번에 업데이트',
      '이번 주 지각자들 수정해줘',
      '지각한 수강생들 한 번에 수정하기',
    ],
  },

  'student.exec.data_quality_apply_fix': {
    intent_key: 'student.exec.data_quality_apply_fix',
    automation_level: 'L2',
    execution_class: 'B',
    description: '데이터 품질 자동 수정 실행',
    examples: [
      '데이터 품질 자동 수정 실행해줘',
      '지금 데이터 품질 수정해',
      '데이터 품질 문제 해결해줘',
      '데이터 품질 체크하고 수정 부탁해',
      '수정할 데이터 품질 실행해줘',
      '지금 데이터 품질 자동으로 고쳐줘',
      '데이터 품질 문제 해결할 수 있어?',
      '데이터 품질 자동 수정 시작해',
    ],
  },

  'student.exec.reactivate_from_discharged': {
    intent_key: 'student.exec.reactivate_from_discharged',
    automation_level: 'L2',
    execution_class: 'B',
    description: '퇴원 학생 재활성화 실행',
    examples: [
      '퇴원한 학생 재활성화 해줘',
      '대상 다시 활성화 시켜줘',
      '재활성화할 원생 목록 보여줘',
      '퇴원한 애들 다시 등록할 수 있게 해줘',
      '지금 퇴원한 수강생들 재활성화',
      '퇴원자 복원 부탁해',
      '재활성화 대상 조회해줘',
      '이번 달 퇴원한 회원 재활성화 요청',
    ],
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'class.query.list': {
    intent_key: 'class.query.list',
    automation_level: 'L0',
    description: '반 목록 조회',
    examples: [
      '지각한 대상 목록',
      '오늘 지각한 원생 보여줘',
      '이번 주 지각자 조회',
      '늦게 온 회원 리스트',
      '지각학생조회',
      '지각한 수강생 리스트',
      '늦은 학생들 확인해줘',
      '어제 지각한 사람들',
    ],
  },

  'class.query.roster': {
    intent_key: 'class.query.roster',
    automation_level: 'L0',
    description: '반 명단 조회',
    examples: [
      '지각한 학생 조회',
      '오늘 지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들 목록',
      '이번 주 지각자 확인',
      '지각한 원생 리스트',
      '이번 수업에 늦은 수강생',
      '지각한 대상 명단',
    ],
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'schedule.query.today': {
    intent_key: 'schedule.query.today',
    automation_level: 'L0',
    description: '오늘 시간표 조회',
    examples: [
      '오늘 시간표 알아봐',
      '오늘 수업 일정 뭐야?',
      '지금 시간표 보여줘',
      '오늘의 수업 리스트',
      '오늘의 강의 확인',
      '오늘 수업이 어떻게 되지?',
      '오늘 강의 일정 알려줘',
      '오늘의 수업 내용',
    ],
  },

  'schedule.query.by_teacher': {
    intent_key: 'schedule.query.by_teacher',
    automation_level: 'L0',
    description: '강사별 시간표 조회',
    examples: [
      '강사별 시간표 확인해줘',
      '이번 주 강사 스케줄 보여줘',
      '선생님 시간표 조회할게',
      '강사 A의 수업 일정은?',
      '강사 B의 오늘 스케줄 알려줘',
      '이번 달 강사별 시간표',
      '선생님 수업 시간 언제야?',
      '강사별로 수업 시간표 정리해줘',
    ],
  },

  'schedule.query.by_class': {
    intent_key: 'schedule.query.by_class',
    automation_level: 'L0',
    description: '반별 시간표 조회',
    examples: [
      '오늘 수업 시간표 조회',
      '이번 주 반별 일정 보여줘',
      '반별 시간표 확인해줘',
      '이번 주 수업 내용 알려줘',
      '오늘 수업 시간표는?',
      '각 반 시간표는 어떻게 되나요?',
      '내 반 시간표 확인하고 싶어',
      '이번 주 반별 일정 리스트',
    ],
  },

  'schedule.query.export_timetable': {
    intent_key: 'schedule.query.export_timetable',
    automation_level: 'L0',
    description: '시간표 내보내기',
    examples: [
      '시간표 내보내기',
      '시간표를 엑셀로 저장해줘',
      '시간표 출력할 수 있어?',
      '내 시간표를 다운받고 싶어',
      '이번 주 시간표 내보내기',
      '내가 만든 시간표 엑셀로 변환해',
      '시간표 파일로 받을 수 있나?',
      '수업 일정 내보내기',
    ],
  },

  'schedule.task.propose_makeup_session': {
    intent_key: 'schedule.task.propose_makeup_session',
    automation_level: 'L1',
    description: '보강 수업 제안 TaskCard 생성',
    examples: [
      '보강 수업 제안해주세요',
      '지각한 수강생에게 보강 수업 알림',
      '오늘 지각한 대상들 보강 수업 제안',
      '늦은 회원들한테 보강 수업 제안해줘',
      '이번 주 지각자 목록에서 보강 수업 제안',
      '지각학생 보강 수업 하자',
      '늦게 온 원생들 보강 수업 제안해',
      '지각한 애들 보강 수업 만들어줘',
    ],
  },

  'schedule.exec.notify_change': {
    intent_key: 'schedule.exec.notify_change',
    automation_level: 'L2',
    execution_class: 'A',
    description: '시간표 변경 안내 실행',
    examples: [
      '시간표 변경사항 알려줘',
      '이번 주 수업 변경된 거 있나요?',
      '시간표 바뀐 거 공지해줘',
      '변경된 시간표 확인',
      '새로운 시간표 내용 궁금해',
      '최근 시간표 변경사항',
      '시간표 변경된 부분 좀 알려줘',
      '오늘 수업 시간 바뀐 거 있어?',
    ],
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'class.exec.create': {
    intent_key: 'class.exec.create',
    automation_level: 'L2',
    execution_class: 'B',
    description: '반 생성 실행',
    examples: [
      '반 생성해줘',
      '새로운 반 만들어',
      '반생성',
      '이번 학기 수강생 반 생성',
      '새 반 등록 부탁해',
      '원생 그룹 생성',
      '수강생 반 만들기',
      '회원 반 추가',
    ],
  },

  'class.exec.update': {
    intent_key: 'class.exec.update',
    automation_level: 'L2',
    execution_class: 'B',
    description: '반 정보 수정 실행',
    examples: [
      '지각한 학생 목록 업데이트',
      '오늘 지각한 원생들 보여줘',
      '이번 주 지각자 수정해줘',
      '지각학생정보 수정할래',
      '늦게 온 대상 수정하기',
      '지각자 리스트 변경해줘',
      '이번 주 지각한 애들 리스트',
      '지각한 수강생 조회해',
    ],
  },

  'class.exec.close': {
    intent_key: 'class.exec.close',
    automation_level: 'L2',
    execution_class: 'B',
    description: '반 폐쇄 실행',
    examples: [
      '지각학생 조회',
      '지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '이번 주 지각자',
      '오늘 지각한 학생',
      '지각한 수강생 리스트',
      '늦은 대상 목록',
    ],
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'schedule.exec.add_session': {
    intent_key: 'schedule.exec.add_session',
    automation_level: 'L2',
    execution_class: 'B',
    description: '수업 세션 추가 실행',
    examples: [
      '수업 세션 추가해줘',
      '새로운 강의 세션 만들어줘',
      '오늘 수업 추가할게',
      '다음 주 수업 등록해',
      '세션 추가하려고 하는데',
      '새로운 수업을 추가해줘',
      '수업 시간 정해줘',
      '강의 세션 추가하기',
    ],
  },

  'schedule.exec.move_session': {
    intent_key: 'schedule.exec.move_session',
    automation_level: 'L2',
    execution_class: 'B',
    description: '수업 세션 이동 실행',
    examples: [
      '수업 세션 이동해줘',
      '세션 옮기는 방법 알려줘',
      '이 수업 일정 변경할래',
      '다음 주 수업 일정 바꿔줘',
      '이번 주 세션 이동 요청',
      '원생 수업 시간 조정해',
      '수업 시간 이동하고 싶은데',
      '회원 세션 옮기는 법 알려줄래?',
    ],
  },

  'schedule.exec.cancel_session': {
    intent_key: 'schedule.exec.cancel_session',
    automation_level: 'L2',
    execution_class: 'B',
    description: '수업 세션 취소 실행',
    examples: [
      '수업 세션 취소해줘',
      '이번 주 수업 없애줘',
      '세션 삭제 부탁해',
      '오늘 수업 취소할 수 있어?',
      '지금 예정된 수업을 취소하고 싶어',
      '다음 주 수업을 없애줘',
      '수업 세션 취소할게',
      '수업 일정 변경해줘',
    ],
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'class.exec.bulk_reassign_teacher': {
    intent_key: 'class.exec.bulk_reassign_teacher',
    automation_level: 'L2',
    execution_class: 'B',
    description: '강사 일괄 재배정 실행',
    examples: [
      '강사 재배정 해줘',
      '선생님들 일괄로 바꾸기',
      '교사 재배정 실행',
      '강사 한꺼번에 변경',
      '모든 강사 재배정 요청',
      '강사 교체할게요',
      '재배정할 강사 목록 보여줘',
      '강사들 일괄 재배정해줘',
    ],
  },



  // 반/수업/시간표(Class/Schedule) 도메인

  'schedule.exec.bulk_shift': {
    intent_key: 'schedule.exec.bulk_shift',
    automation_level: 'L2',
    execution_class: 'B',
    description: '시간표 일괄 이동 실행',
    examples: [
      '시간표 일괄 이동해줘',
      '시간표 옮기기 해줘',
      '이번 주 수업 시간 변경',
      '수업 시간표 조정 부탁해',
      '시간표 이동 요청',
      '시간표 변경해줘',
      '모든 수업 시간 일괄 변경',
      '시간표 일괄 수정해줘',
    ],
  },



  // 상담/학습/메모 + AI(Notes/AI) 도메인

  'note.query.by_student': {
    intent_key: 'note.query.by_student',
    automation_level: 'L0',
    description: '학생별 상담일지 조회',
    examples: [
      '오늘 상담일지 확인해줘',
      '상담일지 조회할 대상 알려줘',
      '이번 달 상담한 원생 리스트',
      '상담일지: 늦게 온 수강생',
      '지각한 회원들 목록 보여줘',
      '지각학생 목록 확인',
      '최근 상담한 대상들',
      '이번 주 상담받은 애들',
    ],
  },

  'note.draft.consult_summary': {
    intent_key: 'note.draft.consult_summary',
    automation_level: 'L0',
    description: '상담 요약 초안 생성',
    examples: [
      '상담 요약 초안 작성해줘',
      '상담 내용을 정리해줘',
      '이번 상담의 요약 필요해',
      '상담 요약 초안 만들기',
      '상담한 내용 간단히 정리해줘',
      '상담 결과 요약해줘',
      '상담 내용 요약해',
      '상담 요약서 작성 부탁해',
    ],
  },



  // 상담/학습/메모 + AI(Notes/AI) 도메인

  'ai.summarize.student_history': {
    intent_key: 'ai.summarize.student_history',
    automation_level: 'L0',
    description: '학생 이력 요약',
    examples: [
      '지각한 학생 조회',
      '오늘 지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '이번 주 지각자 확인해줘',
      '지각한 원생 리스트',
      '지각한 수강생 정보',
      '이번 달 지각자 목록',
    ],
  },

  'ai.generate.followup_message': {
    intent_key: 'ai.generate.followup_message',
    automation_level: 'L0',
    description: '후속 메시지 생성',
    examples: [
      '오늘 지각한 대상 조회해줘',
      '이번 주 지각자 리스트 보여줘',
      '지각한 원생 목록 확인해',
      '늦은 학생들 알려줘',
      '지각학생조회 해줘',
      '이번 달 지각한 수강생들',
      '늦게 온 애들 리스트',
      '오늘 지각한 회원들 보여줘',
    ],
  },

  'ai.summarize.class_history': {
    intent_key: 'ai.summarize.class_history',
    automation_level: 'L0',
    description: '반 이력 요약',
    examples: [
      '지각한 학생 목록',
      '오늘 지각한 원생 보여줘',
      '이번 주 지각자 조회',
      '늦게 온 애들 리스트',
      '지각학생조회',
      '지각한 회원 확인해줘',
      '오늘 지각한 대상',
      '지각한 수강생들 리스트',
    ],
  },

  'ai.generate.counseling_agenda': {
    intent_key: 'ai.generate.counseling_agenda',
    automation_level: 'L0',
    description: '상담 안건 초안 생성',
    examples: [
      '상담 안건 초안 만들어줘',
      '상담할 내용 정리해줘',
      '이번 주 상담 안건 리스트',
      '상담 주제 아이디어 있어?',
      '다음 상담 안건 작성해',
      '상담할 사항들 정리해줘',
      '상담 계획서 초안 작성',
      '상담 안건 리스트 보여줘',
    ],
  },

  'ai.query.export_ai_briefing': {
    intent_key: 'ai.query.export_ai_briefing',
    automation_level: 'L0',
    description: 'AI 브리핑 내보내기',
    examples: [
      'AI 브리핑 내보내줘',
      'AI briefing export 해줘',
      'AI 브리핑 자료 출력 부탁해',
      'AI 브리핑 결과를 내보내고 싶어',
      'AI 브리핑 파일 만들어줘',
      'AI 브리핑 내보내기',
      'AI 관련 자료를 export 해줘',
      'AI 브리핑 정보 출력해줘',
    ],
  },

  'ai.task.flag_risk_signals': {
    intent_key: 'ai.task.flag_risk_signals',
    automation_level: 'L1',
    description: '위험 신호 플래깅 TaskCard 생성',
    examples: [
      '위험 신호 플래깅 해줘',
      '위험 신호가 있는 원생 목록 보여줘',
      '위험신호플래그',
      '위험 신호 플래깅할 대상',
      '오늘 위험 신호 있는 수강생',
      '이번 주 위험 신호 확인',
      '위험 신호 플래그링 해줄래?',
      '위험 신호가 있는 회원 목록',
    ],
  },

  'ai.task.create_recommendations': {
    intent_key: 'ai.task.create_recommendations',
    automation_level: 'L1',
    description: '일일 추천 생성 TaskCard',
    examples: [
      '오늘 추천 목록 생성',
      '추천 카드 만들어줘',
      '추천목록생성',
      '이번 주 추천 사항',
      '추천 리스트 작성해',
      '추천할 내용 보여줘',
      '내일의 추천 생성',
      '오늘의 추천 리스트',
    ],
  },

  'ai.task.bulk_generate_taskcards': {
    intent_key: 'ai.task.bulk_generate_taskcards',
    automation_level: 'L1',
    description: 'TaskCard 일괄 생성 TaskCard',
    examples: [
      '일괄로 TaskCard 생성해줘',
      'TaskCard를 한꺼번에 만들어줄래?',
      'TaskCard 일괄 생성',
      '모든 대상에 대한 TaskCard 생성하기',
      '이번 달 과제 카드 한 번에 만들어줘',
      '수강생들의 TaskCard를 일괄적으로 생성해줘',
      '회원들 TaskCard 일괄로 생성',
      '대상별 TaskCard 한 번에 만들기',
    ],
  },

  'ai.exec.request_staff_review': {
    intent_key: 'ai.exec.request_staff_review',
    automation_level: 'L2',
    execution_class: 'A',
    description: '직원 검토 요청 실행',
    examples: [
      '지각한 직원 목록 요청',
      '오늘 지각한 원생 보여줘',
      '이번 주 늦은 회원 리스트',
      '지각자 조회해줘',
      '늦게 온 대상 확인',
      '이번 달 지각자 목록',
      '지각한 수강생 리스트 부탁해',
      '오늘 지각한 애들 리스트',
    ],
  },

  'ai.exec.escalate_emergency': {
    intent_key: 'ai.exec.escalate_emergency',
    automation_level: 'L2',
    execution_class: 'A',
    description: '긴급 에스컬레이션 실행',
    examples: [
      '긴급 상황 에스컬레이션 실행해줘',
      '지금 즉시 에스컬레이션 해줘',
      '긴급 에스컬레이션 요청',
      '빨리 긴급 상황으로 올려줘',
      '지금 당장 에스컬레이션 부탁해',
      '긴급한 상황이니 에스컬레이션 해줘',
      '긴급 에스컬레이션 진행해',
      '즉시 에스컬레이션 실행해줘',
    ],
  },



  // 상담/학습/메모 + AI(Notes/AI) 도메인

  'note.exec.create': {
    intent_key: 'note.exec.create',
    automation_level: 'L2',
    execution_class: 'B',
    description: '상담일지 생성 실행',
    examples: [
      '상담일지 작성해줘',
      '오늘 상담한 내용 기록하기',
      '상담일지 생성',
      '이번 주 상담한 대상 리스트',
      '상담 내용 추가할래',
      '상담일지 작성할게',
      '최근 상담한 원생들 기록',
      '상담일지 만들어줘',
    ],
  },

  'note.exec.update': {
    intent_key: 'note.exec.update',
    automation_level: 'L2',
    execution_class: 'B',
    description: '상담일지 수정 실행',
    examples: [
      '상담일지 수정해줘',
      '상담 내용 바꿔줄래?',
      '상담일지 업데이트',
      '상담기록 수정하기',
      '상담일지 내용 변경',
      '상담일지 다시 작성할게',
      '상담 내용 업데이트 해줘',
      '상담일지 수정 부탁해',
    ],
  },



  // 리포트/대시보드(Reports) 도메인

  'report.query.dashboard_kpi': {
    intent_key: 'report.query.dashboard_kpi',
    automation_level: 'L0',
    description: '대시보드 KPI 조회',
    examples: [
      'KPI 대시보드 확인해줘',
      '오늘의 성과 지표 보여줘',
      '이번 달 KPI 조회',
      '회원 KPI 현황 알려줘',
      '현재 학생들 KPI 상태는 어때?',
      '지금 원생들의 KPI 결과',
      '수강생 KPI 대시보드 좀 봐',
      '이번 주 KPI 분석해줘',
    ],
  },

  'report.query.attendance_summary': {
    intent_key: 'report.query.attendance_summary',
    automation_level: 'L0',
    description: '출결 요약 리포트 조회',
    examples: [
      '오늘 출결 요약 리포트 보여줘',
      '이번 주 지각한 원생 리스트',
      '지각학생 조회해줘',
      '최근 지각한 대상 목록',
      '지각자 요약 리포트',
      '늦은 수강생들 정보',
      '지각한 애들 리스트',
      '오늘 늦게 온 회원들',
    ],
  },

  'report.query.billing_summary': {
    intent_key: 'report.query.billing_summary',
    automation_level: 'L0',
    description: '수납 요약 리포트 조회',
    examples: [
      '수납 요약 리포트 보여줘',
      '오늘의 수납 요약은?',
      '이번 달 수납 내역 조회',
      '수납요약리포트',
      '회원 수납 현황 알려줘',
      '지난 주 수납 요약 리포트',
      '지금까지의 수납 내역 확인해줘',
      '원생 수납 상황 좀 보여줘',
    ],
  },

  'report.query.export_dataset': {
    intent_key: 'report.query.export_dataset',
    automation_level: 'L0',
    description: '데이터셋 내보내기',
    examples: [
      '데이터셋 내보내기',
      '학생 데이터 내보내고 싶어',
      '내보낼 데이터셋 선택해줘',
      '원생 데이터 내보내기',
      '이번 주 수강생 목록 내보내기',
      '회원 데이터셋 export 해줘',
      '수강생 정보 내보내기',
      '대상 데이터 내보내기 요청',
    ],
  },

  'report.query.health_snapshot': {
    intent_key: 'report.query.health_snapshot',
    automation_level: 'L0',
    description: '헬스 스냅샷 조회',
    examples: [
      '헬스 스냅샷 조회',
      '내 헬스 상태 보여줘',
      '헬스 스냅샷 확인해',
      '현재 건강 상태',
      '오늘의 헬스 스냅샷',
      '최근 헬스 데이터',
      '회원 헬스 스냅샷',
      '원생 건강 상태 조회',
    ],
  },

  'report.task.prepare_monthly_report': {
    intent_key: 'report.task.prepare_monthly_report',
    automation_level: 'L1',
    description: '월간 리포트 준비 TaskCard 생성',
    examples: [
      '이번 달 리포트 준비해줘',
      '월간 리포트 생성해',
      '이번 달 리포트 만들기',
      '월간 보고서 작성 부탁해',
      '이번 달 수강생 현황 리포트',
      '이번 달의 회원 리포트 준비',
      '이번 달 대상 통계 보고서',
      '월간 리포트 자동으로 만들어줘',
    ],
  },

  'report.exec.send_report': {
    intent_key: 'report.exec.send_report',
    automation_level: 'L2',
    execution_class: 'A',
    description: '리포트 발송 실행',
    examples: [
      '오늘 지각한 원생 목록 보내줘',
      '이번 주 지각자 리포트 실행해',
      '지각한 학생들 리스트 보여줘',
      '지각자 조회해줘',
      '늦게 온 회원들 리포트 발송',
      '이번 달 지각학생들 정보 요청',
      '지각학생조회 해주세요',
      '늦은 수강생 명단 보내줘',
    ],
  },

  'report.exec.schedule_monthly_report': {
    intent_key: 'report.exec.schedule_monthly_report',
    automation_level: 'L2',
    execution_class: 'A',
    description: '월간 리포트 예약 발송 실행',
    examples: [
      '월간 리포트 발송해줘',
      '이번 달 리포트 보내줘',
      '매월 리포트 예약 실행',
      '이번 달 리포트 확인하고 보내',
      '다음 주 월간 리포트 실행해',
      '이번 달의 리포트 자동으로 보내줘',
      '월간 리포트 예약 발송 부탁해',
      '이번 달 리포트 진행해줘',
    ],
  },

  'report.exec.generate_monthly_report': {
    intent_key: 'report.exec.generate_monthly_report',
    automation_level: 'L2',
    execution_class: 'B',
    description: '월간 리포트 생성 실행',
    examples: [
      '이번 달 리포트 생성해줘',
      '월간 리포트 만들어줘',
      '이번 달 수강생 리포트',
      '최근 한 달간 회원 리포트',
      '이번 달 대상에 대한 리포트',
      '월간 보고서 생성 부탁해',
      '이달 수강생 통계 리포트',
      '지난 달 회원 리포트 생성',
    ],
  },

  'report.exec.generate_daily_brief': {
    intent_key: 'report.exec.generate_daily_brief',
    automation_level: 'L2',
    execution_class: 'B',
    description: '일일 브리핑 생성 실행',
    examples: [
      '오늘 지각한 수강생 목록 생성해줘',
      '늦게 온 회원들 브리핑 해줘',
      '지각자 리스트 보여줘',
      '이번 주 지각한 대상 보고서 작성해',
      '지각한 애들 오늘 브리핑하자',
      '지각학생조회 해줘',
      '오늘 지각한 원생 리스트 만들어줘',
      '늦은 학생들 정보 업데이트 해줘',
    ],
  },



  // 정책/권한/시스템(System) 도메인

  'rbac.query.my_permissions': {
    intent_key: 'rbac.query.my_permissions',
    automation_level: 'L0',
    description: '내 권한 조회',
    examples: [
      '내 권한이 뭐야?',
      '내가 가진 권한 조회해줘',
      '내 권한 리스트 보여줘',
      '지금 내 권한 상태가 궁금해',
      '현재 내 권한은 어떻게 되지?',
      '내 권한 확인할 수 있을까?',
      '내가 어떤 권한이 있는지 알고 싶어',
      '내 권한 목록 좀 보여줘',
    ],
  },



  // 정책/권한/시스템(System) 도메인

  'policy.query.automation_rules': {
    intent_key: 'policy.query.automation_rules',
    automation_level: 'L0',
    description: '자동화 규칙 조회',
    examples: [
      '자동화 규칙 확인해줘',
      '자동화 룰 좀 보여줘',
      '자동화 규칙 리스트',
      '현재 설정된 자동화 규칙',
      '자동화 룰 조회해',
      '자동화 규칙 목록 어떤 게 있어?',
      '지금 적용된 자동화 규칙',
      '자동화 규칙들 다 볼 수 있을까?',
    ],
  },



  // 정책/권한/시스템(System) 도메인

  'system.query.health': {
    intent_key: 'system.query.health',
    automation_level: 'L0',
    description: '시스템 헬스 체크',
    examples: [
      '지각한 대상 조회',
      '오늘 지각한 원생들 보여줘',
      '이번 주 늦은 학생 목록',
      '늦게 온 회원들 확인해줘',
      '지각학생조회',
      '이번 주 지각자 리스트',
      '오늘 지각한 수강생들',
      '지각한 애들 리스트업',
    ],
  },



  // 정책/권한/시스템(System) 도메인

  'policy.exec.enable_automation': {
    intent_key: 'policy.exec.enable_automation',
    automation_level: 'L2',
    execution_class: 'B',
    description: '자동화 활성화 실행',
    examples: [
      '자동화 활성화 해줘',
      '자동화 켜줘',
      '자동화 기능 사용 시작',
      '지각 학생들을 자동으로 관리해',
      '오늘 지각한 대상을 자동으로 처리해',
      '이번 주 지각자 자동으로 활성화',
      '지각한 원생 목록 자동으로 보여줘',
      '지각자 자동 조회 시작',
    ],
  },

  'policy.exec.update_threshold': {
    intent_key: 'policy.exec.update_threshold',
    automation_level: 'L2',
    execution_class: 'B',
    description: '정책 임계값 수정 실행',
    examples: [
      '정책 임계값을 수정해줘',
      '현재 설정된 임계값 변경할 수 있어?',
      '임계값 업데이트 부탁해',
      '기존 임계값을 고쳐줘',
      '임계값 수정해주세요',
      '새로운 임계값으로 바꿔줘',
      '지금 임계값을 변경하고 싶어',
      '정책의 임계값을 수정해줘',
    ],
  },



  // 정책/권한/시스템(System) 도메인

  'rbac.exec.assign_role': {
    intent_key: 'rbac.exec.assign_role',
    automation_level: 'L2',
    execution_class: 'B',
    description: '역할 할당 실행',
    examples: [
      '오늘 지각한 대상 목록 보여줘',
      '이번 주 지각자 조회',
      '늦게 온 수강생 리스트',
      '지각한 원생 조회해줘',
      '이번 달 지각한 애들',
      '지각학생조회 실행해',
      '늦은 회원들 리스트',
      '이번 주에 지각한 사람들 확인',
    ],
  },



  // 정책/권한/시스템(System) 도메인

  'system.exec.run_healthcheck': {
    intent_key: 'system.exec.run_healthcheck',
    automation_level: 'L2',
    execution_class: 'B',
    description: '헬스체크 실행',
    examples: [
      '헬스체크 실행해줘',
      '오늘의 건강 상태 점검해',
      '현재 시스템 헬스체크 부탁',
      '시스템 상태 확인해줘',
      '헬스체크 실행하기',
      '지금 헬스체크 돌려줘',
      '시스템 점검 시작해',
      '헬스체크 결과 보여줘',
    ],
  },

  'system.exec.rebuild_search_index': {
    intent_key: 'system.exec.rebuild_search_index',
    automation_level: 'L2',
    execution_class: 'B',
    description: '검색 인덱스 재구축 실행',
    examples: [
      '검색 인덱스 재구축해줘',
      '인덱스 다시 만들어줘',
      '재구축 실행',
      '검색 인덱스 다시 설정',
      '인덱스 재구축 부탁해',
      '검색 인덱스 새로 고침',
      '인덱스 재구축하기',
      '검색 인덱스 업데이트 해줄래?',
    ],
  },

  'system.exec.backfill_reports': {
    intent_key: 'system.exec.backfill_reports',
    automation_level: 'L2',
    execution_class: 'B',
    description: '리포트 백필 실행',
    examples: [
      '리포트 백필 해줘',
      '리포트 데이터 채워줘',
      '백필 실행해줘',
      '리포트 재생성해줘',
      '과거 리포트 생성',
      '리포트 데이터 보완',
      '백필 작업 실행',
      '리포트 데이터 복구',
    ],
  },

  'system.exec.retry_failed_actions': {
    intent_key: 'system.exec.retry_failed_actions',
    automation_level: 'L2',
    execution_class: 'B',
    description: '실패 액션 재시도 실행',
    examples: [
      '실패한 작업 다시 시도해줘',
      '실행 실패한 거 재시도',
      '실패한 액션 재실행',
      '작업이 실패했으니 다시 해줘',
      '실패한 작업들 다시 실행해',
      '업데이트 실패한 것들 재시도',
      '실패한 액션 다시 해보자',
      '실패한 요청 다시 시도해',
    ],
  },
};

/**
 * Intent Registry 조회 함수
 */
export function getIntent(intent_key: string): IntentRegistryItem | undefined {
  return intentRegistry[intent_key];
}

/**
 * Intent 존재 여부 확인
 */
export function hasIntent(intent_key: string): boolean {
  return intent_key in intentRegistry;
}
