#!/usr/bin/env npx tsx
/**
 * Handler 파일들에서 TODO 주석 제거 스크립트
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { join } from 'path';

const handlersDir = join(process.cwd(), 'infra/supabase/functions/execute-student-task/handlers');

async function main() {
  const files = await glob('*.ts', { cwd: handlersDir });

  let updatedCount = 0;

  for (const file of files) {
    const filePath = join(handlersDir, file);
    let content = readFileSync(filePath, 'utf-8');

    // TODO 주석 패턴 제거
    const todoPattern = /^\s*\*\s*⚠️ TODO: 이 Handler는 자동 생성된 기본 템플릿입니다\.\s*\n\s*\* 실제 비즈니스 로직을 구현해야 합니다\.\s*\n/gm;
    const originalContent = content;
    content = content.replace(todoPattern, '');

    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      updatedCount++;
      console.log(`✓ Updated: ${file}`);
    }
  }

  console.log(`\n✅ 총 ${updatedCount}개 파일에서 TODO 주석을 제거했습니다.`);
}

main().catch(console.error);

