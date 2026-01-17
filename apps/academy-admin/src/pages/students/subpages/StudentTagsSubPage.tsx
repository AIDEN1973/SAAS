/**
 * 태그 관리 SubPage
 *
 * [LAYER: UI_PAGE - SubPage]
 *
 * StudentsPage의 '태그 관리' 탭(tags)을 담당하는 SubPage 컴포넌트
 * 태그 목록 표시 및 태그별 학생 필터링 기능 제공
 */

import { useState, useMemo, memo, useEffect, useRef } from 'react';
import { Button, Card, Modal, useToast } from '@ui-core/react';
import { X } from 'lucide-react';
import { StatsTableLayout } from '../../../components';
import type { PeriodFilter } from '../../../components/stats';
import { useStudentTags, useStudents, useStudentsPaged } from '@hooks/use-student';
import { useClasses } from '@hooks/use-class';
import { useSchema } from '@hooks/use-schema';
import { studentTableSchema } from '../../../schemas/student.table.schema';
import { createStudentFilterSchema } from '../../../schemas/student.filter.schema';
import { apiClient } from '@api-sdk/core';
import { useQueryClient } from '@tanstack/react-query';
import { p } from '../../../utils/korean-particle-utils';

// API 응답 타입
interface TagAssignment {
  id: string;
  tag_id: string;
  entity_type: string;
  student_id?: string;
}

// 태그와 학생 수를 함께 저장하는 타입
interface TagWithCount {
  id: string;
  name: string;
  color: string;
  count: number;
}

// 태그 버튼 (기본 사이즈 - 태그관리 페이지용)
interface TagButtonLargeProps {
  tag: TagWithCount;
  isSelected: boolean;
  onClick: () => void;
  isEditMode?: boolean;
  onDelete?: () => void;
  onNameChange?: (newName: string) => void;
}

const TagButtonLarge = memo(function TagButtonLarge({ tag, isSelected, onClick, isEditMode, onDelete, onNameChange }: TagButtonLargeProps) {
  // 이미 count가 전달되므로 여기서는 조회하지 않음
  const count = tag.count;
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(tag.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNameSubmit = () => {
    if (editedName.trim() && editedName !== tag.name) {
      onNameChange?.(editedName.trim());
    } else {
      setEditedName(tag.name);
    }
    setIsEditing(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {isEditMode && !isEditing ? (
        <div
          onClick={() => setIsEditing(true)}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-sm)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-normal)',
            fontFamily: 'var(--font-family)',
            lineHeight: 'var(--line-height-tight)',
            backgroundColor: isSelected ? tag.color : 'var(--color-white)',
            color: isSelected ? 'var(--color-white)' : 'var(--color-text)',
            border: isSelected
              ? 'var(--border-width-thin) solid transparent'
              : 'var(--border-width-thin) solid var(--color-gray-200)',
            borderRadius: 'var(--border-radius-xs)',
            cursor: 'text',
            transition: 'var(--transition-all)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(var(--spacing-sm) * 2 + var(--font-size-base) * var(--line-height-tight))',
          }}
        >
          {tag.name} ({count})
        </div>
      ) : isEditMode && isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleNameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleNameSubmit();
            } else if (e.key === 'Escape') {
              setEditedName(tag.name);
              setIsEditing(false);
            }
          }}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-sm)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-normal)',
            fontFamily: 'var(--font-family)',
            lineHeight: 'var(--line-height-tight)',
            backgroundColor: 'var(--color-white)',
            color: 'var(--color-text)',
            border: 'var(--border-width-thin) solid var(--color-primary)',
            borderRadius: 'var(--border-radius-xs)',
            outline: 'none',
            height: 'calc(var(--spacing-sm) * 2 + var(--font-size-base) * var(--line-height-tight))',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <Button
          variant={isSelected ? 'solid' : 'outline'}
          size="md"
          onClick={onClick}
          style={{
            backgroundColor: isSelected ? tag.color : 'var(--color-white)',
            color: isSelected ? 'var(--color-white)' : undefined,
            borderColor: isSelected ? tag.color : undefined,
          }}
        >
          {tag.name} ({count})
        </Button>
      )}
      {isEditMode && onDelete && !isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: 'absolute',
            top: 'calc(var(--spacing-xs) * -0.8)',
            right: 'calc(var(--spacing-xs) * -0.8)',
            width: 'var(--spacing-md)',
            height: 'var(--spacing-md)',
            borderRadius: '50%',
            backgroundColor: 'var(--color-error)',
            border: 'var(--border-width-thin) solid var(--color-white)',
            color: 'var(--color-white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'var(--transition-all)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-error-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-error)';
          }}
        >
          <X size={9} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
});

export interface StudentTagsSubPageProps {
  // 기간 필터
  statsPeriod: PeriodFilter;
  onStatsPeriodChange: (period: PeriodFilter) => void;

  // UI 설정
  currentSubMenuLabel: string;

  // 업종 중립 라벨
  terms: {
    TAG_LABEL: string;
    PERSON_LABEL_PRIMARY: string;
  };
}

export function StudentTagsSubPage({
  statsPeriod,
  onStatsPeriodChange,
  currentSubMenuLabel,
  terms,
}: StudentTagsSubPageProps) {
  // 선택된 태그 ID 목록 (여러 개 선택 가능)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);

  // 삭제 확인 모달 상태
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<{ id: string; name: string } | null>(null);

  // 정렬 방식 상태
  type SortType = 'alphabetical' | 'popular' | 'recent';
  const [sortType, setSortType] = useState<SortType>('recent');

  // hover 상태 관리
  const [isEditButtonHovered, setIsEditButtonHovered] = useState(false);
  const [hoveredSortButton, setHoveredSortButton] = useState<SortType | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 태그 목록 조회
  const { data: allTags } = useStudentTags();

  // 각 태그별 학생 수 조회 (병렬로 처리)
  const tagsWithCount = useMemo<TagWithCount[]>(() => {
    if (!allTags) return [];

    // 초기에는 count를 0으로 설정
    return allTags.map((tag) => ({
      ...tag,
      count: 0,
    }));
  }, [allTags]);

  // 각 태그의 실제 학생 수를 비동기로 조회
  const [tagsWithActualCount, setTagsWithActualCount] = useState<TagWithCount[]>([]);

  // 태그 학생 수 조회
  useEffect(() => {
    if (!allTags || allTags.length === 0) {
      setTagsWithActualCount([]);
      return;
    }

    const fetchCounts = async () => {
      const countsPromises = allTags.map(async (tag) => {
        const response = await apiClient.get<TagAssignment>('tag_assignments', {
          filters: { tag_id: tag.id, entity_type: 'student' },
        });
        const count = response.data?.length ?? 0;
        return {
          ...tag,
          count,
        };
      });

      const results = await Promise.all(countsPromises);
      setTagsWithActualCount(results);
    };

    void fetchCounts();
  }, [allTags]);

  // 정렬된 태그 목록
  const sortedTags = useMemo(() => {
    const tags = tagsWithActualCount.length > 0 ? tagsWithActualCount : tagsWithCount;

    if (sortType === 'alphabetical') {
      // 가나다순 정렬
      return [...tags].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    } else if (sortType === 'popular') {
      // 인기순 정렬 (학생 수 많은 순)
      return [...tags].sort((a, b) => b.count - a.count);
    } else {
      // 최신순 정렬 (기본 순서 유지 - useStudentTags에서 created_at desc로 정렬됨)
      return tags;
    }
  }, [tagsWithCount, tagsWithActualCount, sortType]);

  // 클래스 목록 조회 (필터 스키마에 필요)
  const { data: allClasses } = useClasses();

  // 스키마 조회
  const { data: tableSchemaData } = useSchema('student', studentTableSchema, 'table');
  const filterSchema = createStudentFilterSchema(allClasses);
  const { data: filterSchemaData } = useSchema('student', filterSchema, 'filter');

  // 전체 학생 수 조회 (필터 없이)
  const { data: allStudentsData } = useStudents();
  const totalStudentCount = allStudentsData?.length || 0;

  // 선택된 태그에 따른 필터 생성
  const studentFilter = useMemo(() => {
    if (selectedTagIds.length === 0) return undefined;
    return {
      tag_ids: selectedTagIds,
    };
  }, [selectedTagIds]);

  // 선택된 태그가 있는 학생 목록 조회
  const { data: studentsPaged } = useStudentsPaged({
    filter: studentFilter,
    page: 1,
    pageSize: 1000, // 태그 관리 페이지에서는 모든 학생을 표시
  });

  const students = useMemo(
    () => ((studentsPaged as { students: unknown[] } | undefined)?.students ?? []) as Record<string, unknown>[],
    [studentsPaged]
  );

  const filteredCount = useMemo(
    () => (studentsPaged as { totalCount: number } | undefined)?.totalCount ?? 0,
    [studentsPaged]
  );

  // 태그명 변경 핸들러
  const handleTagNameChange = async (tagId: string, newName: string) => {
    try {
      const updateResponse = await apiClient.patch('tags', tagId, {
        name: newName,
      });

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }

      // 캐시 무효화
      await queryClient.invalidateQueries({ queryKey: ['tags'] });

      toast(`${terms.TAG_LABEL}명이 변경되었습니다.`, 'success');
    } catch (error) {
      console.error('태그명 변경 실패:', error);
      toast(
        error instanceof Error ? error.message : `${terms.TAG_LABEL}명 변경에 실패했습니다.`,
        'error'
      );
      // 실패 시 캐시 무효화하여 원래 값으로 복구
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
    }
  };

  // 태그 삭제 핸들러
  const handleDeleteTag = async () => {
    if (!tagToDelete) return;

    try {
      // 1. tag_assignments 삭제 (해당 태그를 사용하는 모든 학생에서 제거)
      const assignmentsResponse = await apiClient.get<TagAssignment>('tag_assignments', {
        filters: { tag_id: tagToDelete.id, entity_type: 'student' },
      });

      if (assignmentsResponse.data && assignmentsResponse.data.length > 0) {
        await Promise.all(
          assignmentsResponse.data.map((assignment) =>
            apiClient.delete('tag_assignments', assignment.id)
          )
        );
      }

      // 2. 태그 삭제
      const deleteResponse = await apiClient.delete('tags', tagToDelete.id);

      if (deleteResponse.error) {
        throw new Error(deleteResponse.error.message);
      }

      // 3. 캐시 무효화
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
      await queryClient.invalidateQueries({ queryKey: ['students'] });

      toast(`${terms.TAG_LABEL} "${tagToDelete.name}"이(가) 삭제되었습니다.`, 'success');

      // 4. 모달 닫기
      setDeleteModalOpen(false);
      setTagToDelete(null);

      // 5. 선택된 태그에서 제거
      setSelectedTagIds((prev) => prev.filter((id) => id !== tagToDelete.id));
    } catch (error) {
      console.error('태그 삭제 실패:', error);
      toast(
        error instanceof Error ? error.message : `${terms.TAG_LABEL} 삭제에 실패했습니다.`,
        'error'
      );
    }
  };

  return (
    <StatsTableLayout
      title={currentSubMenuLabel}
      entityName={`${terms.TAG_LABEL}관리`}
      statsItems={[]}
      chartData={[]}
      period={statsPeriod}
      onPeriodChange={onStatsPeriodChange}
      selectedStatsKey=""
      onStatsCardClick={() => {}}
      chartTooltipUnit="명"
      chartTooltipLabel={`총 ${terms.PERSON_LABEL_PRIMARY}수`}
      tableSchema={tableSchemaData || studentTableSchema}
      tableData={students}
      totalCount={filteredCount}
      page={1}
      onPageChange={() => {}}
      filters={{}}
      actionContext={{ navigate: () => {} }}
      onRowClick={() => {}}
      filterSchema={filterSchemaData || filterSchema}
      onFilterChange={() => {}}
      filterDefaultValues={{
        search: '',
        status: '',
        grade: '',
        class_id: '',
      }}
      sectionOrderKey="students-section-order-tags"
      showTitle={true}
      hideStats={true}
      beforeTable={
        allTags && allTags.length > 0 ? (
          <div style={{ position: 'relative' }}>
            {/* 정렬 버튼 + 편집 버튼 (카드 외부 우측 상단) */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginBottom: 'var(--spacing-md)',
            }}>
              {/* 정렬 버튼 그룹 */}
              <div style={{
                display: 'flex',
                gap: 'var(--spacing-xs)',
                marginRight: 'var(--spacing-xs)',
              }}>
                <button
                  onClick={() => setSortType('recent')}
                  onMouseEnter={() => setHoveredSortButton('recent')}
                  onMouseLeave={() => setHoveredSortButton(null)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    backgroundColor: sortType === 'recent'
                      ? (hoveredSortButton === 'recent' ? 'var(--color-primary-dark)' : 'var(--color-primary)')
                      : (hoveredSortButton === 'recent' ? 'var(--color-primary-hover)' : 'var(--color-white)'),
                    color: sortType === 'recent' ? 'var(--color-white)' : 'var(--color-text-secondary)',
                    border: sortType === 'recent'
                      ? 'var(--border-width-thin) solid transparent'
                      : 'var(--border-width-thin) solid var(--color-gray-200)',
                    borderRadius: 'var(--border-radius-xs)',
                    cursor: 'pointer',
                    transition: 'var(--transition-all)',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    boxSizing: 'border-box',
                  }}
                >
                  최신순
                </button>
                <button
                  onClick={() => setSortType('alphabetical')}
                  onMouseEnter={() => setHoveredSortButton('alphabetical')}
                  onMouseLeave={() => setHoveredSortButton(null)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    backgroundColor: sortType === 'alphabetical'
                      ? (hoveredSortButton === 'alphabetical' ? 'var(--color-primary-dark)' : 'var(--color-primary)')
                      : (hoveredSortButton === 'alphabetical' ? 'var(--color-primary-hover)' : 'var(--color-white)'),
                    color: sortType === 'alphabetical' ? 'var(--color-white)' : 'var(--color-text-secondary)',
                    border: sortType === 'alphabetical'
                      ? 'var(--border-width-thin) solid transparent'
                      : 'var(--border-width-thin) solid var(--color-gray-200)',
                    borderRadius: 'var(--border-radius-xs)',
                    cursor: 'pointer',
                    transition: 'var(--transition-all)',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    boxSizing: 'border-box',
                  }}
                >
                  가나다순
                </button>
                <button
                  onClick={() => setSortType('popular')}
                  onMouseEnter={() => setHoveredSortButton('popular')}
                  onMouseLeave={() => setHoveredSortButton(null)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    backgroundColor: sortType === 'popular'
                      ? (hoveredSortButton === 'popular' ? 'var(--color-primary-dark)' : 'var(--color-primary)')
                      : (hoveredSortButton === 'popular' ? 'var(--color-primary-hover)' : 'var(--color-white)'),
                    color: sortType === 'popular' ? 'var(--color-white)' : 'var(--color-text-secondary)',
                    border: sortType === 'popular'
                      ? 'var(--border-width-thin) solid transparent'
                      : 'var(--border-width-thin) solid var(--color-gray-200)',
                    borderRadius: 'var(--border-radius-xs)',
                    cursor: 'pointer',
                    transition: 'var(--transition-all)',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    boxSizing: 'border-box',
                  }}
                >
                  인기순
                </button>
              </div>

              {/* 편집 버튼 */}
              <div style={{ position: 'relative' }}>
                {isEditMode ? (
                  <>
                    {/* 고정 툴팁 */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + var(--spacing-tooltip-offset))',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-white)',
                        fontSize: 'var(--font-size-xs)',
                        borderRadius: 'var(--border-radius-xs)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 1000,
                      }}
                    >
                      {terms.TAG_LABEL} 삭제 및 이름 변경
                      {/* 화살표 */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 0,
                          height: 0,
                          borderLeft: 'var(--spacing-xs) solid transparent',
                          borderRight: 'var(--spacing-xs) solid transparent',
                          borderTop: 'var(--spacing-xs) solid var(--color-primary)',
                        }}
                      />
                    </div>
                    <button
                      onClick={() => setIsEditMode(!isEditMode)}
                      onMouseEnter={() => setIsEditButtonHovered(true)}
                      onMouseLeave={() => setIsEditButtonHovered(false)}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        backgroundColor: isEditButtonHovered ? 'var(--color-primary-dark)' : 'var(--color-primary)',
                        color: 'var(--color-white)',
                        border: 'var(--border-width-thin) solid transparent',
                        borderRadius: 'var(--border-radius-xs)',
                        cursor: 'pointer',
                        transition: 'var(--transition-all)',
                        minWidth: 'auto',
                        minHeight: 'auto',
                        boxSizing: 'border-box',
                      }}
                    >
                      완료
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    onMouseEnter={() => setIsEditButtonHovered(true)}
                    onMouseLeave={() => setIsEditButtonHovered(false)}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      backgroundColor: isEditButtonHovered ? 'var(--color-primary-hover)' : 'var(--color-white)',
                      color: 'var(--color-text-secondary)',
                      border: 'var(--border-width-thin) solid var(--color-gray-200)',
                      borderRadius: 'var(--border-radius-xs)',
                      cursor: 'pointer',
                      transition: 'var(--transition-all)',
                      minWidth: 'auto',
                      minHeight: 'auto',
                      boxSizing: 'border-box',
                    }}
                  >
                    편집
                  </button>
                )}
              </div>
            </div>

            <Card padding="lg" variant="default" style={{
              marginBottom: 'calc(var(--spacing-xl) * 2)',
              paddingTop: 'var(--spacing-lg)',
              paddingBottom: 'var(--spacing-lg)', // 상단과 동일하게 설정하여 중앙 정렬
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                flexWrap: 'wrap',
              }}>
              {/* 전체 보기 버튼 */}
              <Button
                variant={selectedTagIds.length === 0 ? 'solid' : 'outline'}
                size="md"
                onClick={() => setSelectedTagIds([])}
                style={{
                  backgroundColor: selectedTagIds.length === 0 ? 'var(--color-text)' : 'var(--color-white)',
                  color: selectedTagIds.length === 0 ? 'var(--color-white)' : undefined,
                  borderColor: selectedTagIds.length === 0 ? 'var(--color-text)' : undefined,
                }}
              >
                전체 ({totalStudentCount})
              </Button>

              {sortedTags.map((tag) => (
                <TagButtonLarge
                  key={tag.id}
                  tag={tag}
                  isSelected={selectedTagIds.includes(tag.id)}
                  onClick={() => {
                    if (!isEditMode) {
                      setSelectedTagIds((prev) =>
                        prev.includes(tag.id)
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }
                  }}
                  isEditMode={isEditMode}
                  onDelete={() => {
                    setTagToDelete({ id: tag.id, name: tag.name });
                    setDeleteModalOpen(true);
                  }}
                  onNameChange={(newName) => handleTagNameChange(tag.id, newName)}
                />
              ))}
            </div>
          </Card>

          {/* 삭제 확인 모달 */}
          <Modal
            isOpen={deleteModalOpen}
            onClose={() => {
              setDeleteModalOpen(false);
              setTagToDelete(null);
            }}
            title={`${terms.TAG_LABEL} 삭제`}
            size="sm"
            footer={
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setTagToDelete(null);
                  }}
                  style={{ flex: 1 }}
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteTag}
                  style={{ flex: 1 }}
                >
                  삭제
                </Button>
              </>
            }
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-none)',
            }}>
              <p style={{
                margin: 0,
                color: 'var(--color-text)',
                fontSize: 'var(--font-size-base)',
                lineHeight: 'var(--line-height)',
              }}>
                {terms.TAG_LABEL} "{tagToDelete?.name}"{p.을를(tagToDelete?.name || '')} 삭제하시겠습니까?
              </p>
              <p style={{
                margin: 0,
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-base)',
                lineHeight: 'var(--line-height)',
              }}>
                이 {terms.TAG_LABEL}{p.이가(terms.TAG_LABEL)} 할당된 모든 {terms.PERSON_LABEL_PRIMARY}에서 제거됩니다.
              </p>
            </div>
          </Modal>
        </div>
        ) : undefined
      }
    />
  );
}
