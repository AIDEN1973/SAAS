/**
 * ⚠️ 주의: 이 파일은 pg_policies의 JSON 덤프 데이터입니다.
 * SQL 마이그레이션으로 실행되면 안 되므로 전체를 주석 처리합니다.
 *
 * 이 파일은 참고용 데이터 덤프이며, 실제 RLS 정책은 다른 마이그레이션 파일에서 관리됩니다.
 *
 * 참고: 091_fix_rls_jwt_claim_complete_migration.sql에서 실제 RLS 정책이 관리됩니다.
 */

/*
[
  {
    "schemaname": "meta",
    "tablename": "schema_registry",
    "policyname": "schema_registry_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(((EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name)))) AND (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = ANY (ARRAY['super_admin'::text, 'developer'::text, 'qa'::text])))))) OR (NOT (EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name))))))",
    "with_check": null
  },
  {
    "schemaname": "meta",
    "tablename": "schema_registry",
    "policyname": "schema_registry_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(((EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name)))) AND (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text))))) OR (NOT (EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name))))))",
    "with_check": "(((EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name)))) AND (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text))))) OR (NOT (EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name))))))"
  },
  {
    "schemaname": "meta",
    "tablename": "tenant_schema_pins",
    "policyname": "tenant_schema_pins_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id = (auth.jwt() ->> 'tenant_id')::uuid) OR ((EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name)))) AND (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text))))))",
    "with_check": null
  },
  {
    "schemaname": "meta",
    "tablename": "tenant_schema_pins",
    "policyname": "tenant_schema_pins_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(((EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name)))) AND (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text))))) OR (NOT (EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name))))))",
    "with_check": "(((EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name)))) AND (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text))))) OR (NOT (EXISTS ( SELECT 1\n   FROM information_schema.tables\n  WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_name)::name = 'user_platform_roles'::name))))))"
  },
  {
    "schemaname": "public",
    "tablename": "academy_classes",
    "policyname": "tenant_isolation_academy_classes_delete",
    "cmd": "DELETE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "academy_classes",
    "policyname": "tenant_isolation_academy_classes_insert",
    "cmd": "INSERT",
    "roles": "{authenticated}",
    "using_expression": null,
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "academy_classes",
    "policyname": "tenant_isolation_academy_classes_select",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "academy_classes",
    "policyname": "tenant_isolation_academy_classes_update",
    "cmd": "UPDATE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "academy_students",
    "policyname": "tenant_isolation_academy_students_delete",
    "cmd": "DELETE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "academy_students",
    "policyname": "tenant_isolation_academy_students_insert",
    "cmd": "INSERT",
    "roles": "{authenticated}",
    "using_expression": null,
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "academy_students",
    "policyname": "tenant_isolation_academy_students_select",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "academy_students",
    "policyname": "tenant_isolation_academy_students_update",
    "cmd": "UPDATE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "academy_teachers",
    "policyname": "tenant_isolation_academy_teachers_delete",
    "cmd": "DELETE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "academy_teachers",
    "policyname": "tenant_isolation_academy_teachers_insert",
    "cmd": "INSERT",
    "roles": "{authenticated}",
    "using_expression": null,
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "academy_teachers",
    "policyname": "tenant_isolation_academy_teachers_select",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "academy_teachers",
    "policyname": "tenant_isolation_academy_teachers_update",
    "cmd": "UPDATE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "ai_decision_logs",
    "policyname": "tenant_isolation_ai_decision_logs",
    "cmd": "ALL",
    "roles": "{public}",
    "using_expression": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)",
    "with_check": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)"
  },
  {
    "schemaname": "public",
    "tablename": "ai_insights",
    "policyname": "ai_insights_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "ai_insights",
    "policyname": "ai_insights_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "ai_suggestions",
    "policyname": "ai_suggestions_delete",
    "cmd": "DELETE",
    "roles": "{public}",
    "using_expression": "((tenant_id = ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())\n LIMIT 1)) AND (EXISTS ( SELECT 1\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.tenant_id = ai_suggestions.tenant_id) AND (user_tenant_roles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "ai_suggestions",
    "policyname": "ai_suggestions_insert",
    "cmd": "INSERT",
    "roles": "{public}",
    "using_expression": null,
    "with_check": "((tenant_id = ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())\n LIMIT 1)) AND ((EXISTS ( SELECT 1\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.tenant_id = ai_suggestions.tenant_id) AND (user_tenant_roles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'sub_admin'::text]))))) OR (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)))"
  },
  {
    "schemaname": "public",
    "tablename": "ai_suggestions",
    "policyname": "ai_suggestions_select",
    "cmd": "SELECT",
    "roles": "{public}",
    "using_expression": "(tenant_id = ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())\n LIMIT 1))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "ai_suggestions",
    "policyname": "ai_suggestions_tenant_isolation",
    "cmd": "ALL",
    "roles": "{public}",
    "using_expression": "(tenant_id = ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())\n LIMIT 1))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "ai_suggestions",
    "policyname": "ai_suggestions_update",
    "cmd": "UPDATE",
    "roles": "{public}",
    "using_expression": "((tenant_id = ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())\n LIMIT 1)) AND (EXISTS ( SELECT 1\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.tenant_id = ai_suggestions.tenant_id) AND (user_tenant_roles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'sub_admin'::text]))))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "attendance_logs",
    "policyname": "dev_bypass_attendance_logs",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "true",
    "with_check": "true"
  },
  {
    "schemaname": "public",
    "tablename": "attendance_logs",
    "policyname": "tenant_isolation_attendance_logs",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)",
    "with_check": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_actions",
    "policyname": "tenant_isolation_automation_actions",
    "cmd": "ALL",
    "roles": "{public}",
    "using_expression": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)",
    "with_check": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_safety_state",
    "policyname": "tenant_isolation_automation_safety_state",
    "cmd": "ALL",
    "roles": "{public}",
    "using_expression": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)",
    "with_check": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_undo_logs",
    "policyname": "tenant_isolation_automation_undo_logs",
    "cmd": "ALL",
    "roles": "{public}",
    "using_expression": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)",
    "with_check": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)"
  },
  {
    "schemaname": "public",
    "tablename": "class_teachers",
    "policyname": "tenant_isolation_class_teachers_delete",
    "cmd": "DELETE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "class_teachers",
    "policyname": "tenant_isolation_class_teachers_insert",
    "cmd": "INSERT",
    "roles": "{authenticated}",
    "using_expression": null,
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "class_teachers",
    "policyname": "tenant_isolation_class_teachers_select",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "class_teachers",
    "policyname": "tenant_isolation_class_teachers_update",
    "cmd": "UPDATE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "guardians",
    "policyname": "tenant_isolation_guardians",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "((((auth.jwt() ->> 'tenant_id') IS NOT NULL) AND (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))) OR (((auth.jwt() ->> 'tenant_id') IS NULL) AND (tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))))",
    "with_check": "((((auth.jwt() ->> 'tenant_id') IS NOT NULL) AND (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))) OR (((auth.jwt() ->> 'tenant_id') IS NULL) AND (tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))))"
  },
  {
    "schemaname": "public",
    "tablename": "industry_themes",
    "policyname": "industry_themes_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "true",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "industry_themes",
    "policyname": "industry_themes_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "invoice_items",
    "policyname": "invoice_items_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "invoice_items",
    "policyname": "invoice_items_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "invoices",
    "policyname": "invoices_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "invoices",
    "policyname": "invoices_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notification_templates",
    "policyname": "notification_templates_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notification_templates",
    "policyname": "notification_templates_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'sub_admin'::text])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "notifications_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "notifications",
    "policyname": "notifications_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "payment_methods",
    "policyname": "payment_methods_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "payment_methods",
    "policyname": "payment_methods_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'sub_admin'::text])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "payments",
    "policyname": "payments_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "payments",
    "policyname": "payments_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "persons",
    "policyname": "tenant_isolation_persons_delete",
    "cmd": "DELETE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "persons",
    "policyname": "tenant_isolation_persons_insert",
    "cmd": "INSERT",
    "roles": "{authenticated}",
    "using_expression": null,
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "persons",
    "policyname": "tenant_isolation_persons_select",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "persons",
    "policyname": "tenant_isolation_persons_update",
    "cmd": "UPDATE",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "policyname": "products_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "policyname": "products_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'sub_admin'::text])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "settlements",
    "policyname": "settlements_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'sub_admin'::text, 'manager'::text])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "settlements",
    "policyname": "settlements_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "student_classes",
    "policyname": "tenant_isolation_student_classes",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)",
    "with_check": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)"
  },
  {
    "schemaname": "public",
    "tablename": "student_consultations",
    "policyname": "tenant_isolation_student_consultations",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)",
    "with_check": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)"
  },
  {
    "schemaname": "public",
    "tablename": "student_task_cards",
    "policyname": "student_task_cards_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "student_task_cards",
    "policyname": "student_task_cards_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "tenant_features",
    "policyname": "tenant_isolation_tenant_features",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)",
    "with_check": "((tenant_id = (auth.jwt() ->> 'tenant_id')::uuid) AND ((auth.jwt() ->> 'tenant_role'::text) = ANY (ARRAY['owner'::text, 'admin'::text])))"
  },
  {
    "schemaname": "public",
    "tablename": "tenant_settings",
    "policyname": "tenant_isolation_tenant_settings",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))",
    "with_check": "((tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1\n   FROM user_platform_roles\n  WHERE ((user_platform_roles.user_id = auth.uid()) AND (user_platform_roles.role = 'super_admin'::text)))))"
  },
  {
    "schemaname": "public",
    "tablename": "tenant_theme_overrides",
    "policyname": "tenant_theme_overrides_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE (user_tenant_roles.user_id = auth.uid())))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "tenant_theme_overrides",
    "policyname": "tenant_theme_overrides_write",
    "cmd": "ALL",
    "roles": "{authenticated}",
    "using_expression": "(tenant_id IN ( SELECT user_tenant_roles.tenant_id\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.user_id = auth.uid()) AND (user_tenant_roles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'sub_admin'::text])))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "tenants",
    "policyname": "tenant_isolation_tenants",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(EXISTS ( SELECT 1\n   FROM user_tenant_roles\n  WHERE ((user_tenant_roles.tenant_id = tenants.id) AND (user_tenant_roles.user_id = auth.uid()))))",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_platform_roles",
    "policyname": "user_platform_roles_read",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_tenant_roles",
    "policyname": "user_tenant_roles_isolation",
    "cmd": "SELECT",
    "roles": "{authenticated}",
    "using_expression": "(user_id = auth.uid())",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "user_tenant_roles",
    "policyname": "user_tenant_roles_update",
    "cmd": "UPDATE",
    "roles": "{authenticated}",
    "using_expression": "(user_id = auth.uid())",
    "with_check": "(user_id = auth.uid())"
  }
]
*/
