/**
 * 매장 정보 설정 섹션
 *
 * [LAYER: UI_SECTION]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 *
 * 포함 항목:
 * - 기본 정보: 상호명, 연락처, 주소, 업종
 * - 브랜딩: 로고 이미지, 대표 이미지, 테마 색상
 */

import React, { useState } from 'react';
import {
  SettingsSection,
  SettingsRow,
  Button,
  Input,
  useModal,
  Badge,
} from '@ui-core/react';
import { useConfig, useUpdateConfig } from '@hooks/use-config';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { INDUSTRY_TYPE_LABELS } from '@industry/registry';
import { Upload, Store, Palette } from 'lucide-react';

export function StoreSettingsSection() {
  const { showAlert } = useModal();
  const { data: configData, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  // terms는 향후 업종별 라벨링에 사용 예정
  useIndustryTerms();

  // 수정 모드 상태
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 현재 설정값 추출
  const storeInfo = configData?.store_info as Record<string, unknown> | undefined;
  const branding = configData?.branding as Record<string, unknown> | undefined;
  const storeName = (storeInfo?.name as string) || '';
  const storePhone = (storeInfo?.phone as string) || '';
  const storeAddress = (storeInfo?.address as string) || '';
  const industryType = (configData?.industry_type as string) || 'academy';
  const logoUrl = (branding?.logo_url as string) || '';
  const heroImageUrl = (branding?.hero_image_url as string) || '';
  const themeColor = (branding?.theme_color as string) || '#3B82F6';

  // 업종 라벨은 SSOT로 @industry/registry에서 관리

  // 필드 수정 시작
  const handleEditStart = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  // 필드 수정 취소
  const handleEditCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  // 필드 수정 저장
  const handleEditSave = async (field: string) => {
    try {
      let updateData: Record<string, unknown> = {};

      if (field === 'name' || field === 'phone' || field === 'address') {
        updateData = {
          store_info: {
            ...(configData?.store_info as Record<string, unknown> || {}),
            [field]: editValue,
          },
        };
      } else if (field === 'theme_color') {
        updateData = {
          branding: {
            ...(configData?.branding as Record<string, unknown> || {}),
            theme_color: editValue,
          },
        };
      }

      await updateConfig.mutateAsync(updateData);
      showAlert('설정이 저장되었습니다.', '성공');
      handleEditCancel();
    } catch (error) {
      showAlert('설정 저장에 실패했습니다.', '오류');
    }
  };

  // 이미지 업로드 (미구현 - 플레이스홀더)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleImageUpload = (_field: string) => {
    showAlert('이미지 업로드 기능은 준비 중입니다.', '안내');
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        설정을 불러오는 중...
      </div>
    );
  }

  return (
    <div>
      {/* 기본 정보 섹션 */}
      <SettingsSection title="기본 정보" icon={<Store size={22} strokeWidth={1.5} />}>
        {/* 상호명 */}
        <SettingsRow
          title="상호명"
          description="매장의 공식 상호명입니다."
          action={
            editingField === 'name' ? (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  size="sm"
                  style={{ width: '200px' }}
                />
                <Button variant="solid" size="sm" onClick={() => handleEditSave('name')}>
                  저장
                </Button>
                <Button variant="outline" size="sm" onClick={handleEditCancel}>
                  취소
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
                  {storeName || '(미설정)'}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleEditStart('name', storeName)}>
                  수정
                </Button>
              </div>
            )
          }
        />

        {/* 연락처 */}
        <SettingsRow
          title="연락처"
          description="고객 문의용 대표 전화번호입니다."
          action={
            editingField === 'phone' ? (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <Input
                  type="tel"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  size="sm"
                  style={{ width: '200px' }}
                  placeholder="02-1234-5678"
                />
                <Button variant="solid" size="sm" onClick={() => handleEditSave('phone')}>
                  저장
                </Button>
                <Button variant="outline" size="sm" onClick={handleEditCancel}>
                  취소
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
                  {storePhone || '(미설정)'}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleEditStart('phone', storePhone)}>
                  수정
                </Button>
              </div>
            )
          }
        />

        {/* 주소 */}
        <SettingsRow
          title="주소"
          description="매장의 실제 주소입니다."
          action={
            editingField === 'address' ? (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  size="sm"
                  style={{ width: '280px' }}
                  placeholder="서울시 강남구..."
                />
                <Button variant="solid" size="sm" onClick={() => handleEditSave('address')}>
                  저장
                </Button>
                <Button variant="outline" size="sm" onClick={handleEditCancel}>
                  취소
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
                  {storeAddress || '(미설정)'}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleEditStart('address', storeAddress)}>
                  수정
                </Button>
              </div>
            )
          }
        />

        {/* 업종 */}
        <SettingsRow
          title="업종"
          description="현재 선택된 업종 타입입니다. 업종 변경은 고객센터에 문의해주세요."
          action={
            <Badge variant="soft" color="primary">
              {INDUSTRY_TYPE_LABELS[industryType] || industryType}
            </Badge>
          }
          isLast
        />
      </SettingsSection>

      {/* 브랜딩 섹션 */}
      <SettingsSection title="브랜딩" icon={<Palette size={22} strokeWidth={1.5} />}>
        {/* 로고 이미지 */}
        <SettingsRow
          title="로고 이미지"
          description="사이드바 및 문서에 표시되는 로고입니다. (권장: 200x200px, PNG/SVG)"
          action={
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="로고"
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                  }}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImageUpload('logo')}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
              >
                <Upload size={14} />
                업로드
              </Button>
            </div>
          }
        />

        {/* 대표 이미지 */}
        <SettingsRow
          title="대표 이미지"
          description="랜딩 페이지 등에 표시되는 대표 이미지입니다. (권장: 1200x630px, JPG/PNG)"
          action={
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
              {heroImageUrl && (
                <img
                  src={heroImageUrl}
                  alt="대표 이미지"
                  style={{
                    width: '48px',
                    height: '32px',
                    objectFit: 'cover',
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                  }}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImageUpload('hero')}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
              >
                <Upload size={14} />
                업로드
              </Button>
            </div>
          }
        />

        {/* 테마 색상 */}
        <SettingsRow
          title="테마 색상"
          description="브랜드 색상을 설정합니다. UI 강조색으로 사용됩니다."
          action={
            editingField === 'theme_color' ? (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <input
                  type="color"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{
                    width: '40px',
                    height: '32px',
                    padding: 0,
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    borderRadius: 'var(--border-radius-sm)',
                    cursor: 'pointer',
                  }}
                />
                <Input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  size="sm"
                  style={{ width: '100px' }}
                  placeholder="#3B82F6"
                />
                <Button variant="solid" size="sm" onClick={() => handleEditSave('theme_color')}>
                  저장
                </Button>
                <Button variant="outline" size="sm" onClick={handleEditCancel}>
                  취소
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: themeColor,
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                  }}
                />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
                  {themeColor}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleEditStart('theme_color', themeColor)}>
                  변경
                </Button>
              </div>
            )
          }
          isLast
        />
      </SettingsSection>
    </div>
  );
}

export default StoreSettingsSection;
