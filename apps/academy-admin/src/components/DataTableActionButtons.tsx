/**
 * DataTableActionButtons Component
 *
 * 데이터 테이블에서 사용하는 공통 액션 버튼 그룹 컴포넌트
 * - 추가/생성 버튼
 * - 업로드 버튼
 * - 다운로드 버튼
 * - 양식 다운로드 버튼
 */

import React, { forwardRef } from 'react';
import { Upload, Download, FileText } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { IconButtonGroup, type IconButtonItem } from '@ui-core/react';

// Plus 아이콘 (커스텀 SVG) - LucideIcon과 호환되도록 forwardRef 사용
export const PlusIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 2, className, style, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        display: 'inline-block', // inline-block으로 변경하여 버튼 내부에서 제대로 표시되도록
        verticalAlign: 'middle', // 중앙 정렬
        flexShrink: 0, // 축소 방지
        ...style,
      }}
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
);
PlusIcon.displayName = 'PlusIcon';

export interface DataTableActionButtonsProps {
  /** 추가/생성 버튼 클릭 핸들러 */
  onCreate?: () => void;
  /** 업로드 버튼 클릭 핸들러 (파일 선택 트리거) */
  onUpload?: () => void;
  /** 다운로드 버튼 클릭 핸들러 */
  onDownload?: () => void | Promise<void>;
  /** 양식 다운로드 버튼 클릭 핸들러 */
  onDownloadTemplate?: () => void | Promise<void>;
  /** 업로드 버튼 비활성화 여부 */
  uploadDisabled?: boolean;
  /** 추가 버튼 텍스트 (기본값: '추가') */
  createTooltip?: string;
  /** 업로드 버튼 텍스트 (기본값: '업로드') */
  uploadTooltip?: string;
  /** 다운로드 버튼 텍스트 (기본값: '다운로드') */
  downloadTooltip?: string;
  /** 양식 다운로드 버튼 텍스트 (기본값: '양식받기') */
  templateTooltip?: string;
  /** 버튼 그룹 정렬 (기본값: 'right') */
  align?: 'left' | 'center' | 'right';
  /** 추가 버튼 표시 여부 (기본값: true) */
  showCreate?: boolean;
  /** 업로드 버튼 표시 여부 (기본값: true) */
  showUpload?: boolean;
  /** 다운로드 버튼 표시 여부 (기본값: true) */
  showDownload?: boolean;
  /** 양식 다운로드 버튼 표시 여부 (기본값: true) */
  showTemplate?: boolean;
  /** 추가 버튼 variant (기본값: 'solid') */
  createVariant?: 'solid' | 'outline' | 'ghost';
  /** 추가 버튼 color (기본값: 'primary') */
  createColor?: 'primary' | 'secondary' | 'error';
}

/**
 * DataTableActionButtons 컴포넌트
 *
 * 데이터 테이블에서 사용하는 공통 액션 버튼 그룹
 */
export const DataTableActionButtons: React.FC<DataTableActionButtonsProps> = ({
  onCreate,
  onUpload,
  onDownload,
  onDownloadTemplate,
  uploadDisabled = false,
  createTooltip = '추가',
  uploadTooltip = '업로드',
  downloadTooltip = '다운로드',
  templateTooltip = '양식받기',
  align = 'right',
  showCreate = true,
  showUpload = true,
  showDownload = true,
  showTemplate = true,
  createVariant = 'solid',
  createColor = 'primary',
}) => {
  const items: IconButtonItem[] = [];

  // 추가 버튼
  if (showCreate && onCreate) {
    items.push({
      icon: PlusIcon,
      tooltip: createTooltip,
      variant: createVariant,
      color: createColor,
      onClick: onCreate,
    });
  }

  // 업로드 버튼
  if (showUpload && onUpload) {
    items.push({
      icon: Upload,
      tooltip: uploadTooltip,
      variant: 'outline',
      onClick: onUpload,
      disabled: uploadDisabled,
    });
  }

  // 다운로드 버튼
  if (showDownload && onDownload) {
    items.push({
      icon: Download,
      tooltip: downloadTooltip,
      variant: 'outline',
      onClick: () => void onDownload(),
    });
  }

  // 양식 다운로드 버튼
  if (showTemplate && onDownloadTemplate) {
    items.push({
      icon: FileText,
      tooltip: templateTooltip,
      variant: 'outline',
      onClick: () => void onDownloadTemplate(),
    });
  }

  if (items.length === 0) {
    return null;
  }

  return <IconButtonGroup items={items} align={align} />;
};

