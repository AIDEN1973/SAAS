-- ============================================
-- 누락된 테이블 생성 SQL
-- academy-admin 앱에서 필요한 테이블들
-- ============================================

-- ============================================
-- 1. industry_themes (업종별 테마)
-- ============================================
CREATE TABLE IF NOT EXISTS industry_themes (
  industry_type text PRIMARY KEY CHECK (industry_type IN ('academy', 'salon', 'real_estate', 'gym', 'ngo')),
  theme_tokens jsonb NOT NULL,  -- 업종별 테마 토큰
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_industry_themes_type ON industry_themes(industry_type);

-- RLS 정책 (업종별 테마는 공통 데이터이므로 모든 인증된 사용자가 읽기 가능)
ALTER TABLE industry_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY industry_themes_read ON industry_themes
FOR SELECT TO authenticated
USING (true);

CREATE POLICY industry_themes_write ON industry_themes
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_platform_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- ============================================
-- 2. tenant_theme_overrides (테넌트별 테마 오버라이드)
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_theme_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  theme_tokens jsonb NOT NULL,  -- 테넌트별 오버라이드 토큰
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_theme_overrides_tenant ON tenant_theme_overrides(tenant_id);

-- RLS 정책
ALTER TABLE tenant_theme_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_theme_overrides_read ON tenant_theme_overrides
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY tenant_theme_overrides_write ON tenant_theme_overrides
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'sub_admin')
  )
);

-- ============================================
-- 3. student_task_cards (학생 업무 카드)
-- ============================================
CREATE TABLE IF NOT EXISTS student_task_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,  -- persons.id 참조
  task_type text NOT NULL CHECK (task_type IN ('risk', 'absence', 'counseling', 'new_signup')),
  priority integer NOT NULL DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
  title text NOT NULL,
  description text NOT NULL,
  action_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,

  -- task_type별 선택적 필드 (JSONB로 저장)
  metadata jsonb DEFAULT '{}'::jsonb,

  -- risk 타입 필드
  -- risk_level, risk_reason, recommended_action

  -- absence 타입 필드
  -- absence_days, last_attendance_date, parent_contact_needed

  -- counseling 타입 필드
  -- counseling_type, urgency, scheduled_date

  -- new_signup 타입 필드
  -- signup_date, welcome_message_sent, initial_setup_needed

  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_student_task_cards_tenant ON student_task_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_task_cards_student ON student_task_cards(student_id);
CREATE INDEX IF NOT EXISTS idx_student_task_cards_task_type ON student_task_cards(task_type);
CREATE INDEX IF NOT EXISTS idx_student_task_cards_priority ON student_task_cards(priority DESC);
CREATE INDEX IF NOT EXISTS idx_student_task_cards_expires ON student_task_cards(expires_at);
CREATE INDEX IF NOT EXISTS idx_student_task_cards_tenant_expires ON student_task_cards(tenant_id, expires_at);

-- RLS 정책
ALTER TABLE student_task_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_task_cards_read ON student_task_cards
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY student_task_cards_write ON student_task_cards
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 4. notifications (알림 내역)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,  -- persons.id (학생 또는 보호자)
  recipient_type text NOT NULL CHECK (recipient_type IN ('student', 'guardian', 'teacher')),
  channel text NOT NULL CHECK (channel IN ('kakaotalk_alimtalk', 'sms', 'email', 'push')),
  type text NOT NULL CHECK (type IN ('attendance', 'billing', 'consultation', 'announcement', 'system')),
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,

  -- 관련 엔티티 참조 (선택적)
  related_entity_type text,  -- 'invoice', 'attendance_log', 'consultation' 등
  related_entity_id uuid,

  -- 메타데이터
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_entity_type, related_entity_id);

-- RLS 정책
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_read ON notifications
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY notifications_write ON notifications
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 5. notification_templates (알림 템플릿)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('kakaotalk_alimtalk', 'sms', 'email', 'push')),
  type text NOT NULL CHECK (type IN ('attendance', 'billing', 'consultation', 'announcement', 'system')),
  content text NOT NULL,  -- 템플릿 내용
  variables jsonb DEFAULT '{}'::jsonb,  -- 사용 가능한 변수 목록
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant ON notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);

-- RLS 정책
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_templates_read ON notification_templates
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY notification_templates_write ON notification_templates
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'sub_admin')
  )
);

-- ============================================
-- 6. invoices (청구서)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,  -- persons.id 참조
  invoice_number text NOT NULL,  -- 청구서 번호 (고유)
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  amount_paid numeric(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  amount_due numeric(12, 2) NOT NULL CHECK (amount_due >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'unpaid', 'cancelled', 'overdue')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  issued_at timestamptz,
  paid_at timestamptz,

  -- 메시지 발송 관련
  messaging_delivery_failed boolean NOT NULL DEFAULT false,

  -- AI 관련
  ai_status text CHECK (ai_status IN ('unresolved', 'resolved', 'pending')),

  -- 메타데이터
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),

  UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- RLS 정책
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_read ON invoices
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY invoices_write ON invoices
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 7. invoice_items (청구서 항목)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('product', 'service', 'fee', 'discount')),
  category text,  -- 과목, 상품 카테고리 등
  name text NOT NULL,
  description text,
  quantity numeric(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(12, 2) NOT NULL CHECK (total_price >= 0),
  sort_order integer NOT NULL DEFAULT 0,

  -- 메타데이터
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant ON invoice_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_category ON invoice_items(category);

-- RLS 정책
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_items_read ON invoice_items
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY invoice_items_write ON invoice_items
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 8. payments (결제 내역)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_number text NOT NULL,  -- 결제 번호 (고유)
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  provider text NOT NULL CHECK (provider IN ('alimbank', 'toss', 'kg', 'manual', 'other')),
  payment_method text NOT NULL CHECK (payment_method IN ('card', 'bank_transfer', 'cash', 'other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,

  -- 재시도 관련
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  last_retry_at timestamptz,
  last_retry_status text CHECK (last_retry_status IN ('success', 'failed')),

  -- 웹훅 관련
  webhook_received_at timestamptz,
  webhook_data jsonb,

  -- 메타데이터
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),

  UNIQUE(tenant_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON payments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- RLS 정책
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_read ON payments
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY payments_write ON payments
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 9. products (상품)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,  -- 과목, 상품 카테고리 등
  price_type text NOT NULL CHECK (price_type IN ('monthly', 'per_session', 'package', 'one_time')),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  is_active boolean NOT NULL DEFAULT true,

  -- 패키지 상품 관련 (price_type = 'package'일 때)
  package_sessions integer,  -- 패키지 횟수
  package_validity_days integer,  -- 패키지 유효기간 (일)

  -- 메타데이터
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products(tenant_id, is_active);

-- RLS 정책
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_read ON products
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY products_write ON products
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'sub_admin')
  )
);

-- ============================================
-- 10. ai_insights (AI 인사이트)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id uuid,  -- persons.id 참조 (nullable, 전체 인사이트 가능)
  insight_type text NOT NULL CHECK (insight_type IN ('attendance', 'performance', 'risk', 'consultation', 'general')),
  title text NOT NULL,
  summary text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,  -- 상세 인사이트 데이터
  confidence_score numeric(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed', 'archived')),

  -- 관련 엔티티 참조
  related_entity_type text,  -- 'attendance_log', 'consultation', 'invoice' 등
  related_entity_id uuid,

  -- 메타데이터
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant ON ai_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_student ON ai_insights(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_status ON ai_insights(status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant_status ON ai_insights(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_related ON ai_insights(related_entity_type, related_entity_id);

-- RLS 정책
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_insights_read ON ai_insights
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY ai_insights_write ON ai_insights
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 트리거: invoice_items의 total_price 자동 계산
-- ============================================
CREATE OR REPLACE FUNCTION calculate_invoice_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_price := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_invoice_item_total
BEFORE INSERT OR UPDATE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_item_total();

-- ============================================
-- 트리거: invoices의 amount_due 자동 계산
-- ============================================
CREATE OR REPLACE FUNCTION calculate_invoice_amount_due()
RETURNS TRIGGER AS $$
BEGIN
  -- amount_paid는 payments 테이블에서 집계하여 업데이트됨 (Edge Function에서 처리)
  -- amount_due는 amount - amount_paid로 계산
  NEW.amount_due := NEW.amount - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_invoice_amount_due
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_amount_due();

-- ============================================
-- 트리거: updated_at 자동 업데이트
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 updated_at 트리거 추가
CREATE TRIGGER trigger_update_notification_templates_updated_at
BEFORE UPDATE ON notification_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_ai_insights_updated_at
BEFORE UPDATE ON ai_insights
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 11. payment_methods (테넌트별 결제 수단 설정)
-- ============================================
-- 아키텍처 문서 3.4.1 섹션 참조: 결제수단 미등록 체크
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('alimbank', 'toss', 'kg', 'nice', 'other')),
  method_type text NOT NULL CHECK (method_type IN ('card', 'bank_transfer', 'virtual_account', 'easy_pay', 'other')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,

  -- Provider별 설정 (JSONB로 저장)
  config jsonb DEFAULT '{}'::jsonb,
  -- 예: alimbank의 경우 { "merchant_id": "...", "api_key": "..." } 등

  -- 메타데이터
  name text,  -- 결제 수단 이름 (예: "기본 카드", "계좌이체")
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_active ON payment_methods(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(tenant_id, is_default) WHERE is_default = true;

-- RLS 정책
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_methods_read ON payment_methods
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY payment_methods_write ON payment_methods
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'sub_admin')
  )
);

CREATE TRIGGER trigger_update_payment_methods_updated_at
BEFORE UPDATE ON payment_methods
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 12. settlements (정산 기록)
-- ============================================
-- 아키텍처 문서 3.4.6 섹션 참조: 정산/회계 기능
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  settlement_number text NOT NULL,  -- 정산 번호 (고유)
  settlement_period_start date NOT NULL,  -- 정산 기간 시작일
  settlement_period_end date NOT NULL,  -- 정산 기간 종료일
  total_revenue numeric(12, 2) NOT NULL DEFAULT 0,  -- 총 매출
  total_refund numeric(12, 2) NOT NULL DEFAULT 0,  -- 총 환불
  net_revenue numeric(12, 2) NOT NULL DEFAULT 0,  -- 순매출 (총 매출 - 총 환불)
  commission_rate numeric(5, 2),  -- 수수료율 (%)
  commission_amount numeric(12, 2),  -- 수수료 금액
  settlement_amount numeric(12, 2) NOT NULL DEFAULT 0,  -- 정산 금액 (순매출 - 수수료)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  settled_at timestamptz,  -- 정산 완료일시
  settlement_date date,  -- 정산일

  -- Provider별 정산 정보
  provider text,  -- 정산 제공자 (alimbank, toss 등)
  provider_settlement_id text,  -- Provider의 정산 ID
  provider_settlement_data jsonb DEFAULT '{}'::jsonb,  -- Provider별 정산 상세 데이터

  -- 메타데이터
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),

  UNIQUE(tenant_id, settlement_number)
);

CREATE INDEX IF NOT EXISTS idx_settlements_tenant ON settlements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(settlement_period_start, settlement_period_end);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_settled_at ON settlements(settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_tenant_period ON settlements(tenant_id, settlement_period_start DESC);

-- RLS 정책
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY settlements_read ON settlements
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'sub_admin', 'manager')
  )
);

CREATE POLICY settlements_write ON settlements
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE TRIGGER trigger_update_settlements_updated_at
BEFORE UPDATE ON settlements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 13. analytics.daily_region_metrics (지역 단위 집계 KPI)
-- ============================================
-- 아키텍처 문서 3.6.5 섹션 및 통계문서 참조
-- 전체 기술문서 PART 3 15-3-3 섹션 참조
-- 주의: 이 테이블은 analytics 스키마에 생성되므로, 스키마가 없으면 먼저 생성 필요
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.daily_region_metrics (
  industry_type text NOT NULL CHECK (industry_type IN ('academy', 'salon', 'real_estate', 'gym', 'ngo')),
  region_level text NOT NULL CHECK (region_level IN ('dong', 'gu_gun', 'si', 'nation')),
  region_code text NOT NULL,  -- core_regions.code
  date_kst date NOT NULL,

  store_count integer NOT NULL DEFAULT 0,  -- 해당 지역/업종의 매장 수

  -- 공통 KPI의 통계 값들
  revenue_avg numeric(18, 2) NOT NULL DEFAULT 0,
  revenue_median numeric(18, 2) NOT NULL DEFAULT 0,
  revenue_p25 numeric(18, 2) NOT NULL DEFAULT 0,
  revenue_p75 numeric(18, 2) NOT NULL DEFAULT 0,

  active_members_avg numeric(18, 2) NOT NULL DEFAULT 0,
  active_members_median numeric(18, 2) NOT NULL DEFAULT 0,
  active_members_p25 numeric(18, 2) NOT NULL DEFAULT 0,
  active_members_p75 numeric(18, 2) NOT NULL DEFAULT 0,

  -- 필요 시 업종별 KPI 요약
  lesson_count_avg numeric(18, 2) NULL,  -- 학원: 수업 수 평균
  contract_count_avg numeric(18, 2) NULL,  -- 부동산: 계약 수 평균

  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (industry_type, region_level, region_code, date_kst)
);

CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_industry_region ON analytics.daily_region_metrics(industry_type, region_level, region_code, date_kst);
CREATE INDEX IF NOT EXISTS idx_daily_region_metrics_date ON analytics.daily_region_metrics(date_kst DESC);

-- RLS 정책 (지역 통계는 집계·익명화된 데이터이므로 읽기 전용)
ALTER TABLE analytics.daily_region_metrics ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 자기 업종의 지역 통계만 조회 가능
CREATE POLICY daily_region_metrics_read ON analytics.daily_region_metrics
FOR SELECT TO authenticated
USING (
  -- 사용자의 업종과 일치하는 통계만 조회 가능
  industry_type = (
    SELECT t.industry_type
    FROM tenants t
    JOIN user_tenant_roles utr ON t.id = utr.tenant_id
    WHERE utr.user_id = auth.uid()
    LIMIT 1
  )
);

-- ============================================
-- 14. regional_metrics_daily (Materialized View)
-- ============================================
-- 아키텍처 문서 3.6.5 섹션 및 통계문서 참조
-- regional_metrics_daily는 analytics.daily_region_metrics를 기반으로 생성되는 Materialized View
-- 주의: Materialized View는 실제 데이터를 저장하므로, REFRESH MATERIALIZED VIEW 명령으로 주기적으로 갱신 필요
-- 아키텍처 문서 3574줄 참조: 1일 1회 (00:30) 집계

-- Materialized View 생성 (analytics.daily_region_metrics를 기반으로)
-- 참고: Materialized View는 실제 구현 시 더 복잡한 집계 로직이 필요할 수 있음
CREATE MATERIALIZED VIEW IF NOT EXISTS regional_metrics_daily AS
SELECT
  industry_type,
  region_level,
  region_code,
  date_kst,
  store_count,
  revenue_avg,
  revenue_median,
  revenue_p25,
  revenue_p75,
  active_members_avg,
  active_members_median,
  active_members_p25,
  active_members_p75,
  lesson_count_avg,
  contract_count_avg,
  created_at
FROM analytics.daily_region_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '90 days'  -- 최근 90일 데이터만 유지
ORDER BY date_kst DESC, industry_type, region_level, region_code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_regional_metrics_daily_pk
ON regional_metrics_daily(industry_type, region_level, region_code, date_kst);

CREATE INDEX IF NOT EXISTS idx_regional_metrics_daily_date
ON regional_metrics_daily(date_kst DESC);

-- RLS 정책 (Materialized View는 읽기 전용)
-- 참고: Materialized View는 RLS를 직접 지원하지 않으므로, 뷰를 통해 접근 제어 필요
-- 실제 구현 시에는 뷰를 통해 RLS를 적용하거나, 애플리케이션 레벨에서 필터링 필요

-- Materialized View 갱신 함수 (Cron Job에서 호출)
CREATE OR REPLACE FUNCTION refresh_regional_metrics_daily()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY regional_metrics_daily;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
