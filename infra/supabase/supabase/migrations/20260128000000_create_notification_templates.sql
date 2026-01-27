-- ============================================================================
-- notification_templates 테이블 생성 및 RLS 정책 설정
-- ============================================================================

-- 테이블이 이미 존재하는지 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_templates') THEN
        -- notification_templates 테이블 생성
        CREATE TABLE notification_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

            -- 템플릿 기본 정보
            name TEXT NOT NULL,
            channel TEXT NOT NULL DEFAULT 'kakao_at' CHECK (channel IN ('sms', 'kakao_at', 'alimtalk')),
            content TEXT NOT NULL,

            -- 카카오 알림톡 관련
            kakao_template_code TEXT,
            approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),

            -- 메타데이터
            is_active BOOLEAN DEFAULT true,

            -- 감사 로그
            created_at TIMESTAMPTZ DEFAULT NOW(),
            created_by UUID REFERENCES auth.users(id),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            updated_by UUID REFERENCES auth.users(id),

            -- 제약 조건
            CONSTRAINT notification_templates_tenant_name_unique UNIQUE (tenant_id, name)
        );

        -- 인덱스
        CREATE INDEX idx_notification_templates_tenant ON notification_templates(tenant_id);
        CREATE INDEX idx_notification_templates_channel ON notification_templates(tenant_id, channel, is_active);

        -- RLS 활성화
        ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

        -- RLS 정책: SELECT (테넌트별 격리)
        CREATE POLICY "notification_templates_select_policy"
            ON notification_templates
            FOR SELECT
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

        -- RLS 정책: INSERT (테넌트별 격리)
        CREATE POLICY "notification_templates_insert_policy"
            ON notification_templates
            FOR INSERT
            WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

        -- RLS 정책: UPDATE (테넌트별 격리)
        CREATE POLICY "notification_templates_update_policy"
            ON notification_templates
            FOR UPDATE
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
            WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

        -- RLS 정책: DELETE (테넌트별 격리)
        CREATE POLICY "notification_templates_delete_policy"
            ON notification_templates
            FOR DELETE
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

        -- updated_at 자동 업데이트 트리거
        CREATE TRIGGER notification_templates_updated_at
            BEFORE UPDATE ON notification_templates
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        RAISE NOTICE 'notification_templates 테이블 생성 완료';
    ELSE
        RAISE NOTICE 'notification_templates 테이블이 이미 존재합니다';
    END IF;
END $$;
