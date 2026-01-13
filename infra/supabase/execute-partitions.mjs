import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://xawypsrotrfoyozhrsbb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd3lwc3JvdHJmb3lvemhyc2JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDk0NDYwNiwiZXhwIjoyMDgwNTIwNjA2fQ.s1t72EahAuqROS3d334ERIEpgiZGMs-lxCb2BGVkjZo';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const migrations = [
  '20260112000001_create_consultation_summary_jobs_retention_policy.sql',
  '20260112000002_create_ai_decision_logs_partitions_and_retention.sql',
  '20260112000003_create_automation_safety_state_retention_policy.sql',
  '20260112000010_create_execution_audit_partitions_and_retention.sql',
  '20260112000011_create_execution_audit_steps_partitions_and_retention.sql',
  '20260112000012_create_automation_actions_partitions_and_retention.sql',
  '20260112000013_create_chatops_messages_monthly_partitions.sql',
  '20260112000014_extend_partitions_to_2075.sql',
  '20260112000015_create_chatops_auto_partition_cron.sql'
];

async function checkPartitionsExist() {
  console.log('🔍 Checking if partitions exist...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT COUNT(*) as count
      FROM pg_tables
      WHERE schemaname = 'public'
        AND (
          tablename LIKE 'execution_audit_runs_%'
          OR tablename LIKE 'execution_audit_steps_%'
          OR tablename LIKE 'automation_actions_%'
          OR tablename LIKE 'ai_decision_logs_%'
          OR tablename LIKE 'chatops_messages_%'
        );
    `
  });

  if (error) {
    console.warn('⚠️  Could not check partitions (exec_sql RPC may not exist)');
    console.warn('   This is normal - we will execute migrations anyway.\n');
    return 0;
  }

  const count = data?.[0]?.count || 0;
  console.log(`   Found ${count} partition tables\n`);
  return count;
}

async function executeFile(filename) {
  const filePath = join(__dirname, 'supabase', 'migrations', filename);
  const sql = readFileSync(filePath, 'utf8');

  console.log(`📄 Executing: ${filename}`);

  // Split by statement terminator and execute each statement
  const statements = sql
    .split(/;\s*$/gm)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement) {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try alternative: direct query for simple statements
        const { error: queryError } = await supabase.from('_').select('*').limit(0);

        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.error(`❌ Cannot execute: exec_sql RPC function not available`);
          console.error(`   Please execute this file manually in Supabase Dashboard SQL Editor`);
          console.error(`   Dashboard: https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql\n`);
          return false;
        }

        console.error(`❌ Error: ${error.message}`);
        return false;
      }
    }
  }

  console.log(`✅ Success\n`);
  return true;
}

async function main() {
  console.log('🚀 Starting partition migration execution...\n');
  console.log(`📍 Project: xawypsrotrfoyozhrsbb`);
  console.log(`🔗 URL: ${SUPABASE_URL}\n`);

  const partitionCount = await checkPartitionsExist();

  if (partitionCount > 150) {
    console.log('✨ All partitions including 50-year extension already exist!\n');
    console.log('   Expected partition count after all migrations: ~160+\n');
    process.exit(0);
  }

  console.log('📝 Executing migration files...\n');

  for (const migration of migrations) {
    const success = await executeFile(migration);
    if (!success) {
      console.error(`\n❌ Migration failed. Please execute remaining files manually.`);
      console.error(`   Dashboard: https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql`);
      process.exit(1);
    }
  }

  console.log('✨ All partition migrations executed successfully!');
  console.log('\n📊 Verifying results...');

  const finalCount = await checkPartitionsExist();
  console.log(`   Total partition tables: ${finalCount}\n`);
}

main().catch(error => {
  console.error('💥 Fatal error:', error.message);
  console.error('\n📋 Manual execution required:');
  console.error('   1. Open: https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql');
  console.error('   2. Copy-paste each migration file from: infra/supabase/supabase/migrations/');
  console.error('   3. Execute files in order (20260112000001 → 20260112000015)');
  process.exit(1);
});
