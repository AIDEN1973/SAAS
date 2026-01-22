-- Create teacher-profiles storage bucket
-- [불변 규칙] RLS 기반 권한 관리

-- teacher-profiles 버킷 생성 (공개 액세스)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher-profiles',
  'teacher-profiles',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view teacher profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload teacher profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their tenant's teacher profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their tenant's teacher profile images" ON storage.objects;

-- SELECT: 모든 사용자가 teacher-profiles 버킷의 파일을 볼 수 있음 (공개 버킷)
CREATE POLICY "Anyone can view teacher profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'teacher-profiles');

-- INSERT: 인증된 사용자만 자신의 테넌트 폴더에 업로드 가능
CREATE POLICY "Authenticated users can upload teacher profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'teacher-profiles'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- UPDATE: 인증된 사용자만 자신의 테넌트 폴더의 파일 수정 가능
CREATE POLICY "Authenticated users can update their tenant's teacher profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'teacher-profiles'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
)
WITH CHECK (
  bucket_id = 'teacher-profiles'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- DELETE: 인증된 사용자만 자신의 테넌트 폴더의 파일 삭제 가능
CREATE POLICY "Authenticated users can delete their tenant's teacher profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'teacher-profiles'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);
