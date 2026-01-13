const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://xawypsrotrfoyozhrsbb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd3lwc3JvdHJmb3lvemhyc2JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDk0NDYwNiwiZXhwIjoyMDgwNTIwNjA2fQ.s1t72EahAuqROS3d334ERIEpgiZGMs-lxCb2BGVkjZo';

const migrations = [
  '20260112000001_create_consultation_summary_jobs_retention_policy.sql',
  '20260112000002_create_ai_decision_logs_partitions_and_retention.sql',
  '20260112000003_create_automation_safety_state_retention_policy.sql',
  '20260112000010_create_execution_audit_partitions_and_retention.sql',
  '20260112000011_create_execution_audit_steps_partitions_and_retention.sql',
  '20260112000012_create_automation_actions_partitions_and_retention.sql',
  '20260112000013_create_chatops_messages_monthly_partitions.sql'
];

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'xawypsrotrfoyozhrsbb.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🚀 Starting partition migration execution...\n');

  for (const migration of migrations) {
    const filePath = path.join(__dirname, 'supabase', 'migrations', migration);

    console.log(`📄 Executing: ${migration}`);

    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      await executeSQL(sql);
      console.log(`✅ Success: ${migration}\n`);
    } catch (error) {
      console.error(`❌ Failed: ${migration}`);
      console.error(`   Error: ${error.message}\n`);
      process.exit(1);
    }
  }

  console.log('✨ All partition migrations executed successfully!');
}

main().catch(console.error);
