#!/usr/bin/env tsx
/**
 * 사용자 친화적인 기능 목록 생성 스크립트
 *
 * Registry의 Intent를 사용자가 이해하기 쉬운 기능 목록으로 변환합니다.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const DOC_PATH = join(process.cwd(), 'docu/챗봇.md');

const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');

// Intent 정보 추출
interface IntentInfo {
  key: string;
  description: string;
  automation_level: string;
  execution_class?: string;
  warnings?: string[];
}

const intents: IntentInfo[] = [];
const lines = registryContent.split('\n');

let currentIntent: Partial<IntentInfo> | null = null;
let inBlock = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Intent 키 찾기
  const keyMatch = line.match(/^'([a-z_]+\.[a-z_]+\.[a-z_]+)':\s*\{/);
  if (keyMatch) {
    currentIntent = { key: keyMatch[1], warnings: [] };
    inBlock = true;
    braceCount = 1;
    continue;
  }

  if (inBlock && currentIntent) {
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;

    // description 추출
    const descMatch = line.match(/description:\s*'([^']+)'/);
    if (descMatch) {
      currentIntent.description = descMatch[1];
    }

    // automation_level 추출
    const levelMatch = line.match(/automation_level:\s*'([^']+)'/);
    if (levelMatch) {
      currentIntent.automation_level = levelMatch[1];
    }

    // execution_class 추출
    const execMatch = line.match(/execution_class:\s*'([^']+)'/);
    if (execMatch) {
      currentIntent.execution_class = execMatch[1];
    }

    // warnings 추출
    const warningsMatch = line.match(/warnings:\s*\[(.*?)\]/s);
    if (warningsMatch) {
      const warningsText = warningsMatch[1];
      const warningMatches = warningsText.match(/'([^']+)'/g);
      if (warningMatches) {
        currentIntent.warnings = warningMatches.map(m => m.replace(/'/g, ''));
      }
    }

    // Intent 블록 종료
    if (braceCount === 0) {
      if (currentIntent.key && currentIntent.description && currentIntent.automation_level) {
        intents.push(currentIntent as IntentInfo);
      }
      currentIntent = null;
      inBlock = false;
    }
  }
}

// 기능 카테고리별로 그룹화
interface Feature {
  name: string;
  description: string;
  category: string;
  type: '조회' | '업무 생성' | '실행';
  conditions: string[];
  constraints: string[];
}

const features: Feature[] = [];

// Intent를 사용자 친화적인 기능으로 변환
for (const intent of intents) {
  const parts = intent.key.split('.');
  const domain = parts[0];
  const action = parts[1];
  const subtype = parts[2];

  let category = '';
  let featureName = '';
  let type: '조회' | '업무 생성' | '실행' = '조회';

  // 도메인별 카테고리
  const categoryMap: Record<string, string> = {
    attendance: '출결 관리',
    billing: '수납/청구',
    message: '메시지/공지',
    student: '학생 관리',
    class: '반/수업 관리',
    schedule: '시간표 관리',
    note: '상담/메모',
    ai: 'AI 기능',
    report: '리포트',
    policy: '정책 관리',
    rbac: '권한 관리',
    system: '시스템 관리',
  };

  category = categoryMap[domain] || domain;

  // 액션별 기능명 변환
  if (action === 'query') {
    type = '조회';
    if (subtype === 'late') featureName = '지각 학생 조회';
    else if (subtype === 'absent') featureName = '결석 학생 조회';
    else if (subtype === 'early_leave') featureName = '조퇴 학생 조회';
    else if (subtype === 'unchecked') featureName = '출결 미체크 학생 조회';
    else if (subtype === 'by_student') featureName = '학생별 출결 조회';
    else if (subtype === 'by_class') featureName = '반별 출결 조회';
    else if (subtype === 'streak_absent') featureName = '연속 결석 학생 조회';
    else if (subtype === 'rate_summary') featureName = '출결률 요약 조회';
    else if (subtype === 'rate_drop') featureName = '출결률 하락 학생 조회';
    else if (subtype === 'late_rank') featureName = '지각 순위 조회';
    else if (subtype === 'export_csv') featureName = '출결 데이터 내보내기';
    else if (subtype === 'search') featureName = '학생 검색';
    else if (subtype === 'profile') featureName = '학생 정보 조회';
    else if (subtype === 'status_list') featureName = '학생 상태 목록 조회';
    else if (subtype === 'missing_guardian_contact') featureName = '보호자 연락처 누락 학생 조회';
    else if (subtype === 'duplicates_suspected') featureName = '중복 의심 학생 조회';
    else if (subtype === 'onboarding_needed') featureName = '온보딩 필요 학생 조회';
    else if (subtype === 'data_quality_scan') featureName = '학생 데이터 품질 검사';
    else if (subtype === 'overdue_month') featureName = '월별 미납 조회';
    else if (subtype === 'overdue_list') featureName = '미납 목록 조회';
    else if (subtype === 'by_student') featureName = '학생별 수납 조회';
    else if (subtype === 'invoice_status') featureName = '청구서 상태 조회';
    else if (subtype === 'failed_payments') featureName = '결제 실패 조회';
    else if (subtype === 'refund_candidates') featureName = '환불 대상 조회';
    else if (subtype === 'kpi_summary') featureName = '수납 KPI 요약 조회';
    else if (subtype === 'unissued_invoices') featureName = '미발행 청구서 조회';
    else if (subtype === 'partial_payments') featureName = '부분 납부 조회';
    else if (subtype === 'export_statement') featureName = '명세서 내보내기';
    else if (subtype === 'sent_log') featureName = '발송 로그 조회';
    else if (subtype === 'failed_log') featureName = '발송 실패 로그 조회';
    else if (subtype === 'variables_check') featureName = '템플릿 변수 검증';
    else if (subtype === 'list') featureName = '반 목록 조회';
    else if (subtype === 'roster') featureName = '반 학생 명단 조회';
    else if (subtype === 'today') featureName = '오늘 수업 조회';
    else if (subtype === 'by_teacher') featureName = '강사별 수업 조회';
    else if (subtype === 'by_class') featureName = '반별 수업 조회';
    else if (subtype === 'export_timetable') featureName = '시간표 내보내기';
    else if (subtype === 'by_student') featureName = '학생별 상담일지 조회';
    else if (subtype === 'dashboard_kpi') featureName = '대시보드 KPI 조회';
    else if (subtype === 'attendance_summary') featureName = '출결 요약 리포트 조회';
    else if (subtype === 'billing_summary') featureName = '수납 요약 리포트 조회';
    else if (subtype === 'export_dataset') featureName = '데이터셋 내보내기';
    else if (subtype === 'health_snapshot') featureName = '시스템 헬스 스냅샷 조회';
    else if (subtype === 'my_permissions') featureName = '내 권한 조회';
    else if (subtype === 'automation_rules') featureName = '자동화 규칙 조회';
    else if (subtype === 'health') featureName = '시스템 헬스 체크';
    else featureName = intent.description;
  } else if (action === 'draft') {
    type = '조회';
    if (subtype === 'absence_notice') featureName = '결석 안내 메시지 초안 생성';
    else if (subtype === 'overdue_notice') featureName = '미납 안내 메시지 초안 생성';
    else if (subtype === 'general_notice') featureName = '일반 공지 메시지 초안 생성';
    else if (subtype === 'payment_link_notice') featureName = '결제 링크 안내 메시지 초안 생성';
    else if (subtype === 'consult_summary') featureName = '상담 요약 초안 생성';
    else featureName = intent.description;
  } else if (action === 'preview') {
    type = '조회';
    if (subtype === 'audience') featureName = '발송 대상 미리보기';
    else if (subtype === 'template_render') featureName = '템플릿 미리보기';
    else featureName = intent.description;
  } else if (action === 'task' || action === 'create') {
    type = '업무 생성';
    if (subtype === 'flag_absence_followup') featureName = '결석 후속조치 업무 생성';
    else if (subtype === 'flag_late_followup') featureName = '지각 후속조치 업무 생성';
    else if (subtype === 'create_contact_list') featureName = '연락처 목록 업무 생성';
    else if (subtype === 'flag_overdue_followup') featureName = '미납 후속조치 업무 생성';
    else if (subtype === 'prepare_invoice_batch') featureName = '청구서 일괄 준비 업무 생성';
    else if (subtype === 'prepare_refund_review') featureName = '환불 검토 업무 생성';
    else if (subtype === 'prepare_payment_link_batch') featureName = '결제 링크 일괄 준비 업무 생성';
    else if (subtype === 'flag_churn_risk_from_billing') featureName = '이탈 위험 업무 생성';
    else if (subtype === 'prepare_bulk_send') featureName = '대량 발송 준비 업무 생성';
    else if (subtype === 'test_send_request') featureName = '테스트 발송 요청 업무 생성';
    else if (subtype === 'register_prefill') featureName = '학생 등록 사전 입력 업무 생성';
    else if (subtype === 'collect_documents') featureName = '문서 수집 업무 생성';
    else if (subtype === 'propose_makeup_session') featureName = '보강 수업 제안 업무 생성';
    else if (subtype === 'prepare_monthly_report') featureName = '월간 리포트 준비 업무 생성';
    else if (subtype === 'flag_risk_signals') featureName = '위험 신호 업무 생성';
    else if (subtype === 'create_recommendations') featureName = '추천 사항 업무 생성';
    else if (subtype === 'bulk_generate_taskcards') featureName = '업무 카드 일괄 생성';
    else featureName = intent.description;
  } else if (action === 'exec') {
    type = '실행';
    if (subtype === 'notify_guardians_late') featureName = '지각 안내 발송';
    else if (subtype === 'notify_guardians_absent') featureName = '결석 안내 발송';
    else if (subtype === 'request_reason_message') featureName = '결석 사유 요청 발송';
    else if (subtype === 'send_staff_summary') featureName = '직원용 출결 요약 발송';
    else if (subtype === 'correct_record') featureName = '출결 기록 수정';
    else if (subtype === 'mark_excused') featureName = '출결 사유 처리';
    else if (subtype === 'bulk_update') featureName = '출결 기록 일괄 수정';
    else if (subtype === 'schedule_recheck') featureName = '출결 재확인 예약';
    else if (subtype === 'send_overdue_notice_1st') featureName = '1차 미납 안내 발송';
    else if (subtype === 'send_overdue_notice_2nd') featureName = '2차 미납 안내 발송';
    else if (subtype === 'send_payment_link') featureName = '결제 링크 발송';
    else if (subtype === 'schedule_overdue_notice') featureName = '미납 안내 예약 발송';
    else if (subtype === 'issue_invoices') featureName = '청구서 발행';
    else if (subtype === 'reissue_invoice') featureName = '청구서 재발행';
    else if (subtype === 'record_manual_payment') featureName = '수동 납부 기록';
    else if (subtype === 'apply_discount') featureName = '할인 적용';
    else if (subtype === 'apply_refund') featureName = '환불 처리';
    else if (subtype === 'create_installment_plan') featureName = '할부 계획 생성';
    else if (subtype === 'fix_duplicate_invoices') featureName = '중복 청구서 수정';
    else if (subtype === 'sync_gateway') featureName = '결제 게이트웨이 동기화';
    else if (subtype === 'close_month') featureName = '월 마감 처리';
    else if (subtype === 'send_to_guardian') featureName = '보호자 개별 메시지 발송';
    else if (subtype === 'send_bulk') featureName = '대량 메시지 발송';
    else if (subtype === 'schedule_bulk') featureName = '대량 메시지 예약 발송';
    else if (subtype === 'cancel_scheduled') featureName = '예약 발송 취소';
    else if (subtype === 'resend_failed') featureName = '실패 메시지 재발송';
    else if (subtype === 'optout_respect_audit') featureName = '수신 거부 감사';
    else if (subtype === 'staff_broadcast') featureName = '직원 공지 발송';
    else if (subtype === 'class_schedule_change_notice') featureName = '수업 일정 변경 안내 발송';
    else if (subtype === 'emergency_notice') featureName = '긴급 공지 발송';
    else if (subtype === 'create_template') featureName = '메시지 템플릿 생성';
    else if (subtype === 'update_template') featureName = '메시지 템플릿 수정';
    else if (subtype === 'send_welcome_message') featureName = '신규 등록 환영 메시지 발송';
    else if (subtype === 'request_documents_message') featureName = '문서 요청 메시지 발송';
    else if (subtype === 'register') featureName = '학생 등록';
    else if (subtype === 'update_profile') featureName = '학생 정보 수정';
    else if (subtype === 'change_class') featureName = '반 변경';
    else if (subtype === 'pause') featureName = '학생 휴원 처리';
    else if (subtype === 'resume') featureName = '학생 복원 처리';
    else if (subtype === 'discharge') featureName = '학생 퇴원 처리';
    else if (subtype === 'merge_duplicates') featureName = '중복 학생 병합';
    else if (subtype === 'update_guardian_contact') featureName = '보호자 연락처 수정';
    else if (subtype === 'assign_tags') featureName = '학생 태그 할당';
    else if (subtype === 'bulk_register') featureName = '학생 일괄 등록';
    else if (subtype === 'bulk_update') featureName = '학생 일괄 수정';
    else if (subtype === 'data_quality_apply_fix') featureName = '학생 데이터 품질 수정';
    else if (subtype === 'reactivate_from_discharged') featureName = '퇴원 학생 재활성화';
    else if (subtype === 'create') featureName = '반 생성';
    else if (subtype === 'update') featureName = '반 정보 수정';
    else if (subtype === 'close') featureName = '반 폐쇄';
    else if (subtype === 'bulk_reassign_teacher') featureName = '강사 일괄 재배정';
    else if (subtype === 'notify_change') featureName = '수업 일정 변경 안내 발송';
    else if (subtype === 'add_session') featureName = '수업 추가';
    else if (subtype === 'move_session') featureName = '수업 이동';
    else if (subtype === 'cancel_session') featureName = '수업 취소';
    else if (subtype === 'bulk_shift') featureName = '수업 일괄 이동';
    else if (subtype === 'create') featureName = '상담일지 작성';
    else if (subtype === 'update') featureName = '상담일지 수정';
    else if (subtype === 'summarize_student_history') featureName = '학생 이력 요약';
    else if (subtype === 'generate_followup_message') featureName = '후속 메시지 생성';
    else if (subtype === 'summarize_class_history') featureName = '반 이력 요약';
    else if (subtype === 'generate_counseling_agenda') featureName = '상담 안건 생성';
    else if (subtype === 'export_ai_briefing') featureName = 'AI 브리핑 내보내기';
    else if (subtype === 'request_staff_review') featureName = '직원 검토 요청';
    else if (subtype === 'escalate_emergency') featureName = '긴급 상황 에스컬레이션';
    else if (subtype === 'send_report') featureName = '리포트 발송';
    else if (subtype === 'schedule_monthly_report') featureName = '월간 리포트 예약 발송';
    else if (subtype === 'generate_monthly_report') featureName = '월간 리포트 생성';
    else if (subtype === 'generate_daily_brief') featureName = '일일 브리핑 생성';
    else if (subtype === 'enable_automation') featureName = '자동화 규칙 활성화';
    else if (subtype === 'update_threshold') featureName = '자동화 임계값 수정';
    else if (subtype === 'assign_role') featureName = '역할 할당';
    else if (subtype === 'run_healthcheck') featureName = '헬스체크 실행';
    else if (subtype === 'rebuild_search_index') featureName = '검색 인덱스 재구축';
    else if (subtype === 'backfill_reports') featureName = '리포트 백필';
    else if (subtype === 'retry_failed_actions') featureName = '실패 액션 재시도';
    else featureName = intent.description;
  }

  // 조건 및 제약사항 설정
  const conditions: string[] = [];
  const constraints: string[] = [];

  if (intent.automation_level === 'L0') {
    conditions.push('즉시 실행 가능 (승인 불필요)');
  } else if (intent.automation_level === 'L1') {
    conditions.push('업무 카드 생성 (실행 전 검토 필요)');
  } else if (intent.automation_level === 'L2') {
    if (intent.execution_class === 'A') {
      conditions.push('관리자 승인 필요');
      conditions.push('정책 설정 확인 필요');
    } else {
      conditions.push('업무 카드 생성 (현재 자동 실행 불가)');
      constraints.push('Domain Action Catalog 확정 후 자동 실행 가능');
    }
  }

  if (intent.warnings && intent.warnings.length > 0) {
    constraints.push(...intent.warnings);
  }

  if (action === 'exec' && subtype.includes('send') || subtype.includes('notify') || subtype.includes('broadcast')) {
    constraints.push('심야 발송 시 주의 필요');
    constraints.push('대량 발송 시 비용 확인 필요');
  }

  features.push({
    name: featureName,
    description: intent.description,
    category,
    type,
    conditions,
    constraints,
  });
}

// 카테고리별로 그룹화
const categoryMap = new Map<string, Feature[]>();
for (const feature of features) {
  if (!categoryMap.has(feature.category)) {
    categoryMap.set(feature.category, []);
  }
  categoryMap.get(feature.category)!.push(feature);
}

// 문서 생성
let docContent = `## 9-사용자. 사용 가능한 기능 목록 (145개)

이 섹션은 실제 사용자가 챗봇을 통해 사용할 수 있는 기능들을 사용자 친화적인 형식으로 정리한 것입니다.
기술적인 세부사항은 섹션 9 (Intent 카탈로그)를 참조하세요.

**기능 유형:**
- **조회**: 즉시 결과를 확인할 수 있는 기능 (승인 불필요)
- **업무 생성**: 업무 카드로 생성되어 검토 후 처리되는 기능
- **실행**: 관리자 승인 후 실제 작업이 수행되는 기능

**조건 및 제약사항:**
- **조건**: 기능 사용 시 필요한 권한이나 설정
- **제약사항**: 기능 사용 시 주의해야 할 사항

---

`;

// 카테고리별로 문서 생성
const categoryOrder = [
  '학생 관리',
  '출결 관리',
  '수납/청구',
  '메시지/공지',
  '반/수업 관리',
  '시간표 관리',
  '상담/메모',
  'AI 기능',
  '리포트',
  '정책 관리',
  '권한 관리',
  '시스템 관리',
];

for (const category of categoryOrder) {
  const categoryFeatures = categoryMap.get(category) || [];
  if (categoryFeatures.length === 0) continue;

  docContent += `### ${category} (${categoryFeatures.length}개)\n\n`;

  // 유형별로 정렬
  const byType = {
    '조회': categoryFeatures.filter(f => f.type === '조회'),
    '업무 생성': categoryFeatures.filter(f => f.type === '업무 생성'),
    '실행': categoryFeatures.filter(f => f.type === '실행'),
  };

  for (const [typeName, typeFeatures] of Object.entries(byType)) {
    if (typeFeatures.length === 0) continue;

    docContent += `#### ${typeName} (${typeFeatures.length}개)\n\n`;

    for (const feature of typeFeatures.sort((a, b) => a.name.localeCompare(b.name))) {
      docContent += `**${feature.name}**\n\n`;
      docContent += `${feature.description}\n\n`;

      if (feature.conditions.length > 0) {
        docContent += `**조건:**\n`;
        for (const condition of feature.conditions) {
          docContent += `- ${condition}\n`;
        }
        docContent += `\n`;
      }

      if (feature.constraints.length > 0) {
        docContent += `**제약사항:**\n`;
        for (const constraint of feature.constraints) {
          docContent += `- ${constraint}\n`;
        }
        docContent += `\n`;
      }

      docContent += `---\n\n`;
    }
  }
}

// 챗봇.md 파일 읽기
const docFileContent = readFileSync(DOC_PATH, 'utf-8');

// 섹션 9-사용자 찾기 및 교체
let sectionStart = docFileContent.indexOf('## 9-사용자.');
if (sectionStart < 0) {
  // 섹션 9 끝 부분 찾기
  sectionStart = docFileContent.indexOf('\n10. ', docFileContent.indexOf('9. Intent 카탈로그'));
  if (sectionStart < 0) {
    sectionStart = docFileContent.indexOf('\n## 10.', docFileContent.indexOf('9. Intent 카탈로그'));
  }
  if (sectionStart < 0) {
    sectionStart = docFileContent.length;
  }
}

let sectionEnd = docFileContent.indexOf('\n## 10.', sectionStart);
if (sectionEnd < 0) {
  sectionEnd = docFileContent.indexOf('\n10. ', sectionStart);
}
if (sectionEnd < 0) {
  sectionEnd = docFileContent.length;
}

if (sectionStart < 0 || sectionStart >= docFileContent.length) {
  // 섹션 9 끝에 추가
  const section9End = docFileContent.indexOf('\n10. ', docFileContent.indexOf('9. Intent 카탈로그'));
  const beforeSection = docFileContent.substring(0, section9End > 0 ? section9End : docFileContent.length);
  const afterSection = docFileContent.substring(section9End > 0 ? section9End : docFileContent.length);
  const newDocContent = beforeSection + '\n\n' + docContent + '\n\n' + afterSection;
  writeFileSync(DOC_PATH, newDocContent, 'utf-8');
} else {
  const beforeSection = docFileContent.substring(0, sectionStart);
  const afterSection = docFileContent.substring(sectionEnd);
  const newDocContent = beforeSection + docContent + afterSection;
  writeFileSync(DOC_PATH, newDocContent, 'utf-8');
}

console.log(`✅ 사용자 친화적인 기능 목록 생성 완료: ${features.length}개 기능`);

