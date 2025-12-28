#!/usr/bin/env tsx
/**
 * Handler Registry 자동 업데이트 스크립트
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers/registry.ts');
const HANDLERS_DIR = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');

// 누락된 Handler 목록
const missingHandlers = [
  'attendance.exec.correct_record',
  'attendance.exec.mark_excused',
  'attendance.exec.bulk_update',
  'attendance.exec.schedule_recheck',
  'billing.exec.issue_invoices',
  'billing.exec.reissue_invoice',
  'billing.exec.record_manual_payment',
  'billing.exec.apply_discount',
  'billing.exec.apply_refund',
  'billing.exec.create_installment_plan',
  'billing.exec.fix_duplicate_invoices',
  'billing.exec.sync_gateway',
  'billing.exec.close_month',
  'message.exec.cancel_scheduled',
  'message.exec.create_template',
  'message.exec.update_template',
  'student.exec.update_profile',
  'student.exec.change_class',
  'student.exec.pause',
  'student.exec.resume',
  'student.exec.discharge',
  'student.exec.merge_duplicates',
  'student.exec.update_guardian_contact',
  'student.exec.assign_tags',
  'student.exec.bulk_register',
  'student.exec.bulk_update',
  'student.exec.data_quality_apply_fix',
  'student.exec.reactivate_from_discharged',
  'class.exec.create',
  'class.exec.update',
  'class.exec.close',
  'class.exec.bulk_reassign_teacher',
  'schedule.exec.add_session',
  'schedule.exec.move_session',
  'schedule.exec.cancel_session',
  'schedule.exec.bulk_shift',
  'note.exec.create',
  'note.exec.update',
  'report.exec.generate_monthly_report',
  'report.exec.generate_daily_brief',
  'policy.exec.enable_automation',
  'policy.exec.update_threshold',
  'rbac.exec.assign_role',
  'system.exec.run_healthcheck',
  'system.exec.rebuild_search_index',
  'system.exec.backfill_reports',
  'system.exec.retry_failed_actions',
];

// Handler 이름 생성 함수
function getHandlerName(intentKey: string): string {
  return intentKey.replace(/\./g, '_').replace(/-/g, '_') + 'Handler';
}

// 파일명 생성 함수
function getFileName(intentKey: string): string {
  return intentKey.replace(/\./g, '-') + '.ts';
}

// Registry 파일 읽기
const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');

// Import 추가
const newImports: string[] = [];
for (const intentKey of missingHandlers) {
  const handlerName = getHandlerName(intentKey);
  const fileName = getFileName(intentKey);
  const importLine = `import { ${handlerName} } from './${fileName}';`;
  newImports.push(importLine);
}

// Registry entry 추가
const newEntries: string[] = [];
for (const intentKey of missingHandlers) {
  const handlerName = getHandlerName(intentKey);
  const domain = intentKey.split('.')[0];
  const entry = `  '${intentKey}': ${handlerName},`;
  newEntries.push(entry);
}

// Import 섹션 찾기 및 추가
const importEndMarker = "import { reportScheduleMonthlyReportHandler } from './report-schedule-monthly-report.ts';";
const importIndex = registryContent.indexOf(importEndMarker);
if (importIndex === -1) {
  throw new Error('Import 섹션을 찾을 수 없습니다.');
}

const beforeImports = registryContent.substring(0, importIndex + importEndMarker.length);
const afterImports = registryContent.substring(importIndex + importEndMarker.length);

// 새로운 import 추가
const updatedImports = beforeImports + '\n' + newImports.join('\n') + '\n';

// Registry entry 섹션 찾기 및 추가
const registryEndMarker = "  'report.exec.schedule_monthly_report': reportScheduleMonthlyReportHandler,";
const registryIndex = updatedImports.indexOf(registryEndMarker);
if (registryIndex === -1) {
  throw new Error('Registry entry 섹션을 찾을 수 없습니다.');
}

const beforeRegistry = updatedImports.substring(0, registryIndex + registryEndMarker.length);
const afterRegistry = updatedImports.substring(registryIndex + registryEndMarker.length);

// 도메인별로 그룹화
const entriesByDomain: Record<string, string[]> = {};
for (const intentKey of missingHandlers) {
  const domain = intentKey.split('.')[0];
  if (!entriesByDomain[domain]) {
    entriesByDomain[domain] = [];
  }
  const handlerName = getHandlerName(intentKey);
  entriesByDomain[domain].push(`  '${intentKey}': ${handlerName},`);
}

// Registry entry 추가 (도메인별로 정리)
let newRegistryEntries = '';
for (const [domain, entries] of Object.entries(entriesByDomain)) {
  const domainComment = `\n  // ${domain} 도메인 (추가)`;
  newRegistryEntries += domainComment + '\n' + entries.join('\n');
}

const updatedRegistry = beforeRegistry + newRegistryEntries + '\n' + afterRegistry;

// 파일 저장
writeFileSync(REGISTRY_PATH, updatedRegistry, 'utf-8');
console.log('✅ Registry 업데이트 완료');
console.log(`추가된 Handler: ${missingHandlers.length}개`);

