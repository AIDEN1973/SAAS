/**
 * 매뉴얼 DB 마이그레이션 스크립트
 *
 * [불변 규칙] 기존 매뉴얼 파일을 DB로 마이그레이션합니다.
 *
 * 실행: npx tsx scripts/migrate-manuals-to-db.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 환경 변수 로드 (.env.local 우선)
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL과 SERVICE_ROLE_KEY 환경 변수가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 매뉴얼 데이터 import
import { allManualPages, manualPageMeta } from '../apps/academy-admin/src/data/manuals/index';

interface ManualDBRecord {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  last_updated: string;
  sections: unknown;
  routes: string[];
  source_files: string[];
  version: number;
}

async function migrateManuals() {
  console.log('========================================');
  console.log('  매뉴얼 DB 마이그레이션');
  console.log('========================================\n');

  const records: ManualDBRecord[] = [];

  for (const manual of allManualPages) {
    const meta = manualPageMeta[manual.id];

    if (!meta) {
      console.warn(`⚠ ${manual.id}: manualPageMeta에 정의되지 않음, 기본값 사용`);
    }

    records.push({
      id: manual.id,
      title: manual.title,
      description: manual.description || null,
      icon: manual.icon || meta?.icon || 'FileText',
      last_updated: manual.lastUpdated,
      sections: manual.sections,
      routes: meta?.routes || [],
      source_files: meta?.sourceFiles || [],
      version: 1,
    });
  }

  console.log(`📋 마이그레이션 대상: ${records.length}개 매뉴얼\n`);

  // 기존 데이터 확인
  const { data: existingManuals, error: fetchError } = await supabase
    .from('manuals')
    .select('id');

  if (fetchError) {
    console.error('❌ 기존 매뉴얼 조회 실패:', fetchError.message);
    process.exit(1);
  }

  const existingIds = new Set(existingManuals?.map((m) => m.id) || []);

  // 신규 vs 업데이트 분류
  const toInsert = records.filter((r) => !existingIds.has(r.id));
  const toUpdate = records.filter((r) => existingIds.has(r.id));

  // 신규 삽입
  if (toInsert.length > 0) {
    console.log(`➕ 신규 삽입: ${toInsert.length}개`);
    const { error: insertError } = await supabase.from('manuals').insert(toInsert);

    if (insertError) {
      console.error('❌ 삽입 실패:', insertError.message);
      process.exit(1);
    }

    for (const r of toInsert) {
      console.log(`   ✓ ${r.id} (${r.title})`);
    }
  }

  // 기존 업데이트
  if (toUpdate.length > 0) {
    console.log(`\n🔄 업데이트: ${toUpdate.length}개`);

    for (const r of toUpdate) {
      const { error: updateError } = await supabase
        .from('manuals')
        .update({
          title: r.title,
          description: r.description,
          icon: r.icon,
          last_updated: r.last_updated,
          sections: r.sections,
          routes: r.routes,
          source_files: r.source_files,
          // version은 트리거에서 자동 증가
        })
        .eq('id', r.id);

      if (updateError) {
        console.error(`   ✗ ${r.id}: ${updateError.message}`);
      } else {
        console.log(`   ✓ ${r.id} (${r.title})`);
      }
    }
  }

  console.log('\n========================================');
  console.log('  마이그레이션 완료');
  console.log('========================================');

  // 결과 확인
  const { data: finalManuals, error: finalError } = await supabase
    .from('manuals')
    .select('id, title, version')
    .order('id');

  if (!finalError && finalManuals) {
    console.log(`\n📊 DB 매뉴얼 현황: ${finalManuals.length}개`);
    for (const m of finalManuals) {
      console.log(`   - ${m.id}: ${m.title} (v${m.version})`);
    }
  }
}

migrateManuals().catch((err) => {
  console.error('❌ 마이그레이션 실패:', err);
  process.exit(1);
});
