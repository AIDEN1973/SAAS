#!/usr/bin/env tsx
/**
 * L2-B Intent 설명 업데이트 스크립트
 *
 * 챗봇.md의 모든 L2-B Intent 설명을 Domain Action Catalog 확정 완료로 업데이트합니다.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DOC_PATH = join(process.cwd(), 'docu/챗봇.md');

const oldText = `⚠️ **P0**: Domain Action Catalog가 SSOT로 확정되기 전까지는 항상 L1로 강등(Fail-Closed)됩니다.
- TaskCard 생성(업무화)까지만 수행하고 자동 실행은 금지됩니다.
- 자동 실행 활성화 조건: Domain Action Catalog에 action_key 등록, RBAC 룰/정책 경로/감사 규칙 SSOT 정의, 핸들러가 Catalog 존재를 런타임에서 검증`;

const newText = `⚠️ **P0**: Domain Action Catalog가 SSOT로 확정되었습니다. action_key가 Catalog에 등록되어 있고 정책이 활성화되어 있으면 자동 실행 가능합니다.
- **자동 실행 조건**:
  - Domain Action Catalog에 action_key 등록 (✅ 완료)
  - 정책 경로 \`domain_action.<action_key>.enabled\` 활성화 필요
  - 핸들러가 Catalog 존재를 런타임에서 검증 (Fail-Closed)
- **정책 경로 예시**: \`domain_action.student.register.enabled\` (학생 등록 실행 허용 여부)`;

const content = readFileSync(DOC_PATH, 'utf-8');
const updatedContent = content.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newText);

if (content !== updatedContent) {
  writeFileSync(DOC_PATH, updatedContent, 'utf-8');
  const count = (content.match(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(`✅ Updated ${count} L2-B intent descriptions`);
} else {
  console.log(`✅ No updates needed`);
}

