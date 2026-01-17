/**
 * 상담관리 SubPage
 *
 * [LAYER: UI_PAGE - SubPage]
 *
 * StudentsPage의 '상담관리' 탭(consultations)을 담당하는 SubPage 컴포넌트
 * 상담 통계 대시보드, 상담 테이블, 상담 상세 모달을 포함
 */

import React, { useState, useEffect } from 'react';
import { Button, Select, Textarea, DatePicker, Modal } from '@ui-core/react';
import type { InlineFormField } from '@ui-core/react';
import { DataTableActionButtons, StatsTableLayout } from '../../../components';
import type { StatsItem, ChartDataItem, PeriodFilter } from '../../../components/stats';
import type { StudentConsultation, ConsultationType } from '@services/student-service';
import type { TableSchema, FilterSchema } from '@schema-engine';
import { p } from '../../../utils';

export interface StudentConsultSubPageProps {
  // 통계 데이터
  consultationStatsItems: StatsItem[];
  consultationChartData: ChartDataItem[];
  statsPeriod: PeriodFilter;
  onStatsPeriodChange: (period: PeriodFilter) => void;
  selectedConsultationStatsKey: string;
  onConsultationStatsCardClick: (key: string) => void;

  // 테이블 데이터
  consultationTableSchema: TableSchema;
  tableData: Record<string, unknown>[];
  totalCount: number;
  isLoading: boolean;
  actionContext: { navigate: (path: string) => void };
  onRowClick: (consultationId: string) => void;

  // 필터
  consultationFilterSchema: FilterSchema;
  consultationFilters: {
    search: string;
    consultation_type: string;
    date_from: string;
    date_to: string;
  };
  onConsultationFilterChange: (filters: Record<string, unknown>) => void;

  // 상담 상세 모달
  selectedConsultationId: string | null;
  allConsultations: StudentConsultation[];
  students: { id: string; name: string }[];
  onCloseModal: () => void;

  // 액션
  onDeleteConsultation: (consultationId: string, studentId: string) => Promise<void>;
  onUpdateConsultation: (consultationId: string, studentId: string, data: { consultation_type: ConsultationType; consultation_date: string; content: string }) => Promise<void>;
  onGenerateAISummary: (consultationId: string, studentId: string) => Promise<void>;
  updateConsultationPending: boolean;
  deleteConsultationPending: boolean;
  generateAISummaryPending: boolean;

  // CSV 다운로드
  onDownload: () => void;
  onDownloadTemplate: () => void;
  onCreateClick: () => void;
  onUploadClick: () => void;

  // UI 설정
  iconSize: number;
  iconStrokeWidth: number;
  currentSubMenuLabel: string;

  // 업종 중립 라벨
  terms: {
    PERSON_LABEL_PRIMARY: string;
    CONSULTATION_LABEL: string;
    CONSULTATION_LABEL_PLURAL: string;
    CONSULTATION_TYPE_LABELS: {
      counseling: string;
      learning: string;
      behavior: string;
      other: string;
    };
  };

  // 확인 모달
  showConfirm: (message: string, title: string) => Promise<boolean>;
}

export function StudentConsultSubPage({
  consultationStatsItems,
  consultationChartData,
  statsPeriod,
  onStatsPeriodChange,
  selectedConsultationStatsKey,
  onConsultationStatsCardClick,
  consultationTableSchema,
  tableData,
  totalCount,
  isLoading,
  actionContext,
  onRowClick,
  consultationFilterSchema,
  consultationFilters,
  onConsultationFilterChange,
  selectedConsultationId,
  allConsultations,
  students,
  onCloseModal,
  onDeleteConsultation,
  onUpdateConsultation,
  onGenerateAISummary,
  updateConsultationPending,
  deleteConsultationPending,
  generateAISummaryPending,
  onDownload,
  onDownloadTemplate,
  onCreateClick,
  onUploadClick,
  iconSize,
  iconStrokeWidth,
  currentSubMenuLabel,
  terms,
  showConfirm,
}: StudentConsultSubPageProps) {
  // 상담 상세 모달 편집 상태
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    consultation_type: ConsultationType;
    consultation_date: string;
    content: string;
  }>({
    consultation_type: 'counseling',
    consultation_date: '',
    content: '',
  });

  // 선택된 상담이 변경될 때 편집 폼 데이터 동기화
  useEffect(() => {
    if (selectedConsultationId && allConsultations) {
      const consultation = allConsultations.find(c => c.id === selectedConsultationId);
      if (consultation) {
        setEditFormData({
          consultation_type: consultation.consultation_type,
          consultation_date: consultation.consultation_date,
          content: consultation.content || '',
        });
        setIsEditingInModal(false);
      }
    }
  }, [selectedConsultationId, allConsultations]);

  // 선택된 상담 정보
  const selectedConsultation = selectedConsultationId
    ? allConsultations.find(c => c.id === selectedConsultationId)
    : null;

  const student = selectedConsultation
    ? students.find(s => s.id === selectedConsultation.student_id)
    : null;

  const handleDelete = async () => {
    if (!selectedConsultation?.student_id || !selectedConsultationId) return;

    const confirmed = await showConfirm(
      `${terms.CONSULTATION_LABEL_PLURAL}${p.을를(terms.CONSULTATION_LABEL_PLURAL)} 삭제하시겠습니까?`,
      `${terms.CONSULTATION_LABEL_PLURAL} 삭제`
    );
    if (confirmed) {
      await onDeleteConsultation(selectedConsultationId, selectedConsultation.student_id);
    }
  };

  const handleEdit = () => {
    setIsEditingInModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedConsultation?.student_id || !selectedConsultationId) return;
    await onUpdateConsultation(selectedConsultationId, selectedConsultation.student_id, editFormData);
    setIsEditingInModal(false);
  };

  const handleCancelEdit = () => {
    setIsEditingInModal(false);
    if (selectedConsultation) {
      setEditFormData({
        consultation_type: selectedConsultation.consultation_type,
        consultation_date: selectedConsultation.consultation_date,
        content: selectedConsultation.content || '',
      });
    }
  };

  const handleGenerateAISummary = async () => {
    if (!selectedConsultation?.student_id || !selectedConsultationId) return;
    await onGenerateAISummary(selectedConsultationId, selectedConsultation.student_id);
  };

  // 모달 인라인 필드 구성
  const inlineFields: InlineFormField[] = selectedConsultation ? [
    {
      label: terms.PERSON_LABEL_PRIMARY,
      value: student?.name || '알 수 없음',
    },
    {
      label: '상담 구분',
      value: isEditingInModal ? (
        <Select
          value={editFormData.consultation_type}
          onChange={(value) => setEditFormData({ ...editFormData, consultation_type: String(value) as ConsultationType })}
          fullWidth
        >
          <option value="counseling">{terms.CONSULTATION_TYPE_LABELS.counseling}</option>
          <option value="learning">{terms.CONSULTATION_TYPE_LABELS.learning}</option>
          <option value="behavior">{terms.CONSULTATION_TYPE_LABELS.behavior}</option>
          <option value="other">{terms.CONSULTATION_TYPE_LABELS.other}</option>
        </Select>
      ) : (
        terms.CONSULTATION_TYPE_LABELS[selectedConsultation.consultation_type as keyof typeof terms.CONSULTATION_TYPE_LABELS] || selectedConsultation.consultation_type
      ),
    },
    {
      label: '상담일',
      value: isEditingInModal ? (
        <DatePicker
          value={editFormData.consultation_date}
          onChange={(value) => setEditFormData({ ...editFormData, consultation_date: value })}
          fullWidth
        />
      ) : (
        selectedConsultation.consultation_date
      ),
    },
    {
      label: '상담 내용',
      value: isEditingInModal ? (
        <Textarea
          value={editFormData.content}
          onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
          placeholder="상담 내용을 입력하세요"
          fullWidth
          style={{ resize: 'none', minHeight: '100px', height: 'auto', overflow: 'hidden' }}
        />
      ) : (
        selectedConsultation.content || '내용 없음'
      ),
      colSpan: 2,
      whiteSpace: 'pre-wrap',
    },
    ...(!isEditingInModal && selectedConsultation.ai_summary ? [{
      label: 'AI 요약',
      value: selectedConsultation.ai_summary,
      colSpan: 2 as const,
      whiteSpace: 'pre-wrap' as const,
    }] : []),
  ] : [];

  return (
    <>
      <StatsTableLayout
        title={currentSubMenuLabel}
        entityName="상담목록"
        statsItems={consultationStatsItems}
        chartData={consultationChartData}
        period={statsPeriod}
        onPeriodChange={onStatsPeriodChange}
        selectedStatsKey={selectedConsultationStatsKey}
        onStatsCardClick={onConsultationStatsCardClick}
        chartTooltipUnit="건"
        chartTooltipLabel="총 상담수"
        tableSchema={consultationTableSchema}
        tableData={isLoading ? [] : tableData}
        totalCount={totalCount}
        page={1}
        onPageChange={() => {}}
        filters={{}}
        actionContext={actionContext}
        onRowClick={(row) => {
          const consultationId = (row as { id?: string }).id;
          if (consultationId) {
            onRowClick(consultationId);
          }
        }}
        filterSchema={consultationFilterSchema}
        onFilterChange={onConsultationFilterChange}
        filterDefaultValues={{
          search: consultationFilters.search,
          consultation_type: consultationFilters.consultation_type,
          date_from: consultationFilters.date_from,
          date_to: consultationFilters.date_to,
        }}
        customActions={
          <DataTableActionButtons
            align="right"
            onCreate={onCreateClick}
            onUpload={onUploadClick}
            onDownload={onDownload}
            onDownloadTemplate={onDownloadTemplate}
            uploadDisabled={false}
            createTooltip="상담 등록"
          />
        }
        iconSize={iconSize}
        iconStrokeWidth={iconStrokeWidth}
        sectionOrderKey="students-section-order-consultations"
        showTitle={true}
      />

      {/* 상담 상세 모달 */}
      {selectedConsultationId && selectedConsultation && (
        <Modal
          isOpen={true}
          onClose={onCloseModal}
          title={isEditingInModal ? `${terms.CONSULTATION_LABEL_PLURAL} 수정` : `${terms.CONSULTATION_LABEL_PLURAL} 상세`}
          size="xl"
          bodyLayout="form-inline"
          inlineFields={inlineFields}
          footer={
            isEditingInModal ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  style={{ flex: 1 }}
                >
                  취소
                </Button>
                <Button
                  variant="solid"
                  onClick={handleSaveEdit}
                  disabled={updateConsultationPending}
                  style={{ flex: 1 }}
                >
                  저장
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteConsultationPending}
                  style={{ flex: 1 }}
                >
                  삭제
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  style={{ flex: 1 }}
                >
                  수정
                </Button>
                <Button
                  variant="solid"
                  onClick={handleGenerateAISummary}
                  disabled={generateAISummaryPending}
                  style={{ flex: 1 }}
                >
                  {selectedConsultation.ai_summary ? 'AI 재요약' : 'AI 요약'}
                </Button>
              </>
            )
          }
        />
      )}
    </>
  );
}
