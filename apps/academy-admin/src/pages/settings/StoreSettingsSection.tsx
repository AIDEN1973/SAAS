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
import { useQueryClient } from '@tanstack/react-query';
import { useConfig, useUpdateConfig } from '@hooks/use-config';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { INDUSTRY_TYPE_LABELS } from '@industry/registry';
import { Upload, Store, Palette } from 'lucide-react';

export function StoreSettingsSection() {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const { data: configData, isLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  // terms는 향후 업종별 라벨링에 사용 예정
  useIndustryTerms();

  // 수정 모드 상태
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 색상 팔레트 상태 (light, DEFAULT, dark)
  const [colorPalette, setColorPalette] = useState<{
    light: string;
    DEFAULT: string;
    dark: string;
  }>({
    light: '#3b82f6',
    DEFAULT: '#2563eb',
    dark: '#1e40af',
  });

  // 현재 설정값 추출
  const storeInfo = configData?.store_info as Record<string, unknown> | undefined;
  const branding = configData?.branding as Record<string, unknown> | undefined;
  const storeName = (storeInfo?.name as string) || '';
  const storePhone = (storeInfo?.phone as string) || '';
  const storeAddress = (storeInfo?.address as string) || '';
  const industryType = (configData?.industry_type as string) || 'academy';
  const logoUrl = (branding?.logo_url as string) || '';
  const heroImageUrl = (branding?.hero_image_url as string) || '';

  // 테마 색상: 팔레트 객체 또는 단일 문자열일 수 있음
  const themeColorRaw = branding?.theme_color;
  const themeColor =
    themeColorRaw && typeof themeColorRaw === 'object' && 'DEFAULT' in themeColorRaw
      ? (themeColorRaw as { light: string; DEFAULT: string; dark: string })
      : { light: '#3b82f6', DEFAULT: (themeColorRaw as string) || '#2563eb', dark: '#1e40af' };

  // 업종 라벨은 SSOT로 @industry/registry에서 관리

  // 대표 색상 팔레트 (Google Material Design Colors)
  const colorPresets = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#84CC16', // Lime
    '#10B981', // Green
    '#14B8A6', // Teal
    '#06B6D4', // Cyan
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#64748B', // Slate
  ];

  // 필드 수정 시작
  const handleEditStart = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);

    // 테마 색상 수정 시 팔레트 초기화
    if (field === 'theme_color') {
      // branding.theme_color가 문자열이면 DEFAULT로 설정하고 light/dark는 자동 생성
      // branding.theme_color가 객체면 팔레트로 파싱
      const brandingTheme = branding?.theme_color;
      if (brandingTheme && typeof brandingTheme === 'object' && 'DEFAULT' in brandingTheme) {
        setColorPalette(brandingTheme as { light: string; DEFAULT: string; dark: string });
      } else {
        // 단일 색상 값이면 DEFAULT로 설정하고 light/dark 자동 생성
        const baseColor = currentValue || '#2563eb';
        setColorPalette({
          light: lightenColor(baseColor, 20),
          DEFAULT: baseColor,
          dark: darkenColor(baseColor, 20),
        });
      }
    }
  };

  // 프리셋 색상 선택 시 자동으로 light/dark 생성
  const handlePresetColorSelect = (color: string) => {
    setColorPalette({
      light: lightenColor(color, 20),
      DEFAULT: color,
      dark: darkenColor(color, 20),
    });
  };

  // 색상 밝게 하기 (HSL 기반)
  const lightenColor = (hex: string, percent: number): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.min(100, hsl.l + percent);

    const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
  };

  // 색상 어둡게 하기 (HSL 기반)
  const darkenColor = (hex: string, percent: number): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.max(0, hsl.l - percent);

    const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
  };

  // HEX → RGB 변환
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  // RGB → HEX 변환
  const rgbToHex = (r: number, g: number, b: number): string => {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = Math.round(x).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('')
    );
  };

  // RGB → HSL 변환
  const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  // HSL → RGB 변환
  const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return { r: r * 255, g: g * 255, b: b * 255 };
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
        // 색상 팔레트 객체로 저장
        updateData = {
          branding: {
            ...(configData?.branding as Record<string, unknown> || {}),
            theme_color: colorPalette,
          },
        };
      }

      await updateConfig.mutateAsync(updateData);

      // 테마 색상 변경 시 tenant_theme_overrides 테이블도 업데이트
      if (field === 'theme_color') {
        try {
          const { apiClient, getApiContext } = await import('@api-sdk/core');
          const context = getApiContext();
          const tenantId = context.tenantId;

          if (!tenantId) {
            throw new Error('Tenant ID is required');
          }

          // 기존 테마 오버라이드 조회
          const existingResponse = await apiClient.get<{ id: string; tenant_id: string; theme_tokens: unknown }>('tenant_theme_overrides', {
            filters: { tenant_id: tenantId },
          });

          // 전체 색상 팔레트로 테마 오버라이드
          // useTheme에서 기대하는 형식: { colors: { primary: { light, DEFAULT, dark } } }
          const themeOverride = {
            colors: {
              primary: {
                light: colorPalette.light,
                DEFAULT: colorPalette.DEFAULT,
                dark: colorPalette.dark,
              },
            },
          };

          console.log('[StoreSettings] Saving theme override:', themeOverride);

          if (existingResponse.data && existingResponse.data.length > 0) {
            // 기존 레코드가 있으면 업데이트
            const existingId = existingResponse.data[0].id;
            await apiClient.patch('tenant_theme_overrides', existingId, {
              theme_tokens: themeOverride,
              updated_at: new Date().toISOString(),
            });
          } else {
            // 기존 레코드가 없으면 생성
            await apiClient.post('tenant_theme_overrides', {
              tenant_id: tenantId,
              theme_tokens: themeOverride,
            });
          }

          // React Query 캐시 무효화 및 강제 refetch하여 테마 즉시 반영
          // 테넌트 테마와 업종 테마 모두 무효화
          await queryClient.invalidateQueries({ queryKey: ['tenant-theme', tenantId] });
          await queryClient.invalidateQueries({ queryKey: ['industry-theme'] });
          // 강제 refetch로 즉시 반영
          await queryClient.refetchQueries({ queryKey: ['tenant-theme', tenantId] });
        } catch (themeError) {
          console.error('[StoreSettings] Failed to update tenant_theme_overrides:', themeError);
          // 테마 오버라이드 실패는 치명적이지 않으므로 경고만 출력
        }
      }

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
          description="브랜드 색상 팔레트를 설정합니다. Light, Default, Dark 세 가지 변형이 UI 전체에 적용됩니다."
          action={
            editingField === 'theme_color' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {/* 색상 프리셋 팔레트 */}
                <div>
                  <label
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)',
                      fontWeight: 'var(--font-weight-medium)',
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    색상 선택
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: 'var(--spacing-xs)',
                      maxWidth: '240px',
                    }}
                  >
                    {colorPresets.map((presetColor) => (
                      <button
                        key={presetColor}
                        onClick={() => handlePresetColorSelect(presetColor)}
                        style={{
                          width: '36px',
                          height: '36px',
                          backgroundColor: presetColor,
                          border:
                            colorPalette.DEFAULT === presetColor
                              ? '3px solid var(--color-gray-900)'
                              : '1px solid var(--color-gray-300)',
                          borderRadius: 'var(--border-radius-sm)',
                          cursor: 'pointer',
                          transition: 'var(--transition-all)',
                          boxShadow:
                            colorPalette.DEFAULT === presetColor
                              ? '0 0 0 2px var(--color-white), 0 0 0 4px var(--color-gray-900)'
                              : 'none',
                        }}
                        title={presetColor}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* 선택된 색상 미리보기 */}
                <div>
                  <label
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)',
                      fontWeight: 'var(--font-weight-medium)',
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    미리보기
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: colorPalette.light,
                        borderRadius: 'var(--border-radius-sm)',
                        border: 'var(--border-width-thin) solid var(--color-gray-200)',
                      }}
                      title={`Light: ${colorPalette.light}`}
                    />
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: colorPalette.DEFAULT,
                        borderRadius: 'var(--border-radius-sm)',
                        border: 'var(--border-width-thin) solid var(--color-gray-200)',
                      }}
                      title={`Default: ${colorPalette.DEFAULT}`}
                    />
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: colorPalette.dark,
                        borderRadius: 'var(--border-radius-sm)',
                        border: 'var(--border-width-thin) solid var(--color-gray-200)',
                      }}
                      title={`Dark: ${colorPalette.dark}`}
                    />
                    <span
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {colorPalette.DEFAULT}
                    </span>
                  </div>
                </div>

                {/* 저장/취소 버튼 */}
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <Button variant="solid" size="sm" onClick={() => handleEditSave('theme_color')}>
                    저장
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEditCancel}>
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                {/* 색상 팔레트 표시 */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: themeColor.light,
                      borderRadius: 'var(--border-radius-sm)',
                      border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    }}
                    title={`Light: ${themeColor.light}`}
                  />
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: themeColor.DEFAULT,
                      borderRadius: 'var(--border-radius-sm)',
                      border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    }}
                    title={`Default: ${themeColor.DEFAULT}`}
                  />
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: themeColor.dark,
                      borderRadius: 'var(--border-radius-sm)',
                      border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    }}
                    title={`Dark: ${themeColor.dark}`}
                  />
                </div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  {themeColor.DEFAULT}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditStart('theme_color', themeColor.DEFAULT)}
                >
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
