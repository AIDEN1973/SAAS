-- Temporarily disable the problematic trigger
-- [임시 조치] sc.status 오류 문제 해결 전까지 트리거 비활성화

-- 트리거 삭제
DROP TRIGGER IF EXISTS notify_guardians_on_class_change_trigger ON public.academy_classes;

COMMENT ON FUNCTION public.notify_guardians_on_class_change IS
'[비활성화됨] sc.status 오류로 인해 트리거 임시 제거 (163번 migration)';
