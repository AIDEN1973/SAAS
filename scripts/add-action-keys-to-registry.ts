#!/usr/bin/env tsx
/**
 * Intent Registry에 action_key 추가 스크립트
 *
 * 모든 L2-B Intent에 Domain Action Catalog의 action_key를 자동으로 추가합니다.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');

// Intent key → action_key 매핑
const intentToActionKey: Record<string, string> = {
  'attendance.exec.correct_record': 'attendance.correct_record',
  'attendance.exec.mark_excused': 'attendance.mark_excused',
  'attendance.exec.bulk_update': 'attendance.bulk_update',
  'attendance.exec.schedule_recheck': 'attendance.schedule_recheck',
  'billing.exec.issue_invoices': 'billing.issue_invoices',
  'billing.exec.reissue_invoice': 'billing.reissue_invoice',
  'billing.exec.record_manual_payment': 'billing.record_manual_payment',
  'billing.exec.apply_discount': 'billing.apply_discount',
  'billing.exec.apply_refund': 'billing.apply_refund',
  'billing.exec.create_installment_plan': 'billing.create_installment_plan',
  'billing.exec.fix_duplicate_invoices': 'billing.fix_duplicate_invoices',
  'billing.exec.sync_gateway': 'billing.sync_gateway',
  'billing.exec.close_month': 'billing.close_month',
  'message.exec.cancel_scheduled': 'message.cancel_scheduled',
  'message.exec.create_template': 'message.create_template',
  'message.exec.update_template': 'message.update_template',
  'student.exec.register': 'student.register',
  'student.exec.update_profile': 'student.update_profile',
  'student.exec.change_class': 'student.change_class',
  'student.exec.pause': 'student.pause',
  'student.exec.resume': 'student.resume',
  'student.exec.discharge': 'student.discharge',
  'student.exec.merge_duplicates': 'student.merge_duplicates',
  'student.exec.update_guardian_contact': 'student.update_guardian_contact',
  'student.exec.assign_tags': 'student.assign_tags',
  'student.exec.bulk_register': 'student.bulk_register',
  'student.exec.bulk_update': 'student.bulk_update',
  'student.exec.data_quality_apply_fix': 'student.data_quality_apply_fix',
  'student.exec.reactivate_from_discharged': 'student.reactivate_from_discharged',
  'class.exec.create': 'class.create',
  'class.exec.update': 'class.update',
  'class.exec.close': 'class.close',
  'schedule.exec.add_session': 'schedule.add_session',
  'schedule.exec.move_session': 'schedule.move_session',
  'schedule.exec.cancel_session': 'schedule.cancel_session',
  'schedule.exec.bulk_shift': 'schedule.bulk_shift',
  'class.exec.bulk_reassign_teacher': 'class.bulk_reassign_teacher', // Note: This might need to be added to catalog
  'note.exec.create': 'note.create',
  'note.exec.update': 'note.update',
  'report.exec.generate_monthly_report': 'report.generate_monthly_report',
  'report.exec.generate_daily_brief': 'report.generate_daily_brief',
  'system.exec.run_healthcheck': 'system.run_healthcheck',
  'system.exec.rebuild_search_index': 'system.rebuild_search_index',
  'system.exec.backfill_reports': 'system.backfill_reports',
  'system.exec.retry_failed_actions': 'system.retry_failed_actions',
  'policy.exec.enable_automation': 'policy.enable_automation',
  'policy.exec.update_threshold': 'policy.update_threshold',
  'rbac.exec.assign_role': 'rbac.assign_role',
};

const content = readFileSync(REGISTRY_PATH, 'utf-8');
const lines = content.split('\n');

let updated = false;
let i = 0;

while (i < lines.length) {
  const line = lines[i];

  // Intent 키 찾기
  const keyMatch = line.match(/^  '([a-z_]+\.[a-z_]+\.[a-z_]+)':\s*\{/);
  if (keyMatch) {
    const intentKey = keyMatch[1];
    const actionKey = intentToActionKey[intentKey];

    if (actionKey) {
      // execution_class: 'B' 찾기
      let foundExecutionClass = false;
      let j = i + 1;

      while (j < lines.length && !lines[j].trim().startsWith('}')) {
        if (lines[j].includes("execution_class: 'B'")) {
          foundExecutionClass = true;

          // action_key가 이미 있는지 확인
          let hasActionKey = false;
          for (let k = i; k < j; k++) {
            if (lines[k].includes('action_key:')) {
              hasActionKey = true;
              break;
            }
          }

          // action_key가 없으면 추가
          if (!hasActionKey) {
            // execution_class 다음 줄에 action_key 추가
            const indent = lines[j].match(/^(\s*)/)?.[1] || '    ';
            lines.splice(j + 1, 0, `${indent}action_key: '${actionKey}', // Domain Action Catalog`);
            updated = true;
            console.log(`✅ Added action_key to ${intentKey}`);
          } else {
            console.log(`⏭️  ${intentKey} already has action_key`);
          }

          break;
        }
        j++;
      }
    }
  }

  i++;
}

if (updated) {
  writeFileSync(REGISTRY_PATH, lines.join('\n'), 'utf-8');
  console.log(`\n✅ Registry updated successfully`);
} else {
  console.log(`\n✅ No updates needed`);
}

