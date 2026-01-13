-- Check if partition tables exist
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'execution_audit_runs_%'
    OR tablename LIKE 'execution_audit_steps_%'
    OR tablename LIKE 'automation_actions_%'
    OR tablename LIKE 'ai_decision_logs_%'
    OR tablename LIKE 'chatops_messages_%'
  )
ORDER BY tablename;
