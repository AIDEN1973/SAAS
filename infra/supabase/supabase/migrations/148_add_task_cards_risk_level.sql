-- task_cards 테이블에 risk_level 컬럼 추가
-- [목적] AI 승인 자동화 확대: Low-Risk 작업은 승인 없이 자동 실행
-- [불변 규칙] risk_level 기반 자동 승인은 Policy로 제어됨

-- 1. task_cards 테이블에 risk_level 컬럼 추가
ALTER TABLE public.task_cards
ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'medium'
CHECK (risk_level IN ('low', 'medium', 'high'));

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_task_cards_risk_level
ON public.task_cards(tenant_id, risk_level)
WHERE status IN ('pending', 'approved');

-- 3. 컬럼 주석
COMMENT ON COLUMN public.task_cards.risk_level IS
'위험 수준: low(자동승인 가능), medium(조건부), high(승인필수). Policy: automation_approval.auto_approve_threshold로 제어';

-- 4. 기존 데이터 백필 (모두 medium으로 설정)
-- ⚠️ 주의: 기존 TaskCard는 모두 medium으로 설정하여 기존 승인 플로우 유지
UPDATE public.task_cards
SET risk_level = 'medium'
WHERE risk_level IS NULL;

-- 5. RLS 정책은 기존 것 유지 (risk_level은 필터 조건에 사용되지 않음)
-- task_cards는 이미 tenant_id 기반 RLS가 설정되어 있음
