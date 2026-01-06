-- academy_classes.current_count 자동 업데이트 트리거
-- [불변 규칙] student_classes 테이블의 is_active 변경 시 academy_classes.current_count 자동 업데이트
-- [요구사항] 반별 출결률/정원률/지각률 표시를 위한 정확한 current_count 유지

-- 1. current_count 자동 업데이트 함수 생성
CREATE OR REPLACE FUNCTION update_class_current_count()
RETURNS TRIGGER AS $$
BEGIN
  -- student_classes의 is_active 변경 시 academy_classes.current_count 업데이트
  IF TG_OP = 'INSERT' THEN
    -- INSERT 시: is_active가 true이면 current_count 증가
    IF NEW.is_active = true THEN
      UPDATE public.academy_classes
      SET current_count = (
        SELECT COUNT(*)::integer
        FROM public.student_classes
        WHERE class_id = NEW.class_id
          AND is_active = true
          AND tenant_id = NEW.tenant_id
      )
      WHERE id = NEW.class_id AND tenant_id = NEW.tenant_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- UPDATE 시: is_active 변경에 따라 current_count 재계산
    IF OLD.is_active != NEW.is_active OR OLD.class_id != NEW.class_id THEN
      -- 이전 반의 current_count 감소 (class_id가 변경된 경우)
      IF OLD.class_id IS NOT NULL AND OLD.is_active = true THEN
        UPDATE public.academy_classes
        SET current_count = (
          SELECT COUNT(*)::integer
          FROM public.student_classes
          WHERE class_id = OLD.class_id
            AND is_active = true
            AND tenant_id = OLD.tenant_id
        )
        WHERE id = OLD.class_id AND tenant_id = OLD.tenant_id;
      END IF;
      
      -- 새 반의 current_count 증가 (class_id가 변경되었거나 is_active가 true로 변경된 경우)
      IF NEW.class_id IS NOT NULL AND NEW.is_active = true THEN
        UPDATE public.academy_classes
        SET current_count = (
          SELECT COUNT(*)::integer
          FROM public.student_classes
          WHERE class_id = NEW.class_id
            AND is_active = true
            AND tenant_id = NEW.tenant_id
        )
        WHERE id = NEW.class_id AND tenant_id = NEW.tenant_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- DELETE 시: is_active가 true였으면 current_count 감소
    IF OLD.is_active = true THEN
      UPDATE public.academy_classes
      SET current_count = (
        SELECT COUNT(*)::integer
        FROM public.student_classes
        WHERE class_id = OLD.class_id
          AND is_active = true
          AND tenant_id = OLD.tenant_id
      )
      WHERE id = OLD.class_id AND tenant_id = OLD.tenant_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_class_current_count ON public.student_classes;
CREATE TRIGGER trigger_update_class_current_count
  AFTER INSERT OR UPDATE OR DELETE ON public.student_classes
  FOR EACH ROW
  EXECUTE FUNCTION update_class_current_count();

-- 3. 기존 데이터의 current_count 초기화 (일관성 보장)
UPDATE public.academy_classes ac
SET current_count = (
  SELECT COUNT(*)::integer
  FROM public.student_classes sc
  WHERE sc.class_id = ac.id
    AND sc.is_active = true
    AND sc.tenant_id = ac.tenant_id
);

