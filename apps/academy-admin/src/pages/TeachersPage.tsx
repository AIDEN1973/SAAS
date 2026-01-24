/**
 * 강사관리 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 강사 프로필 보기
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary, useModal, useResponsiveMode , Container, Card, Button, Modal, PageHeader, isMobile, isTablet, EmptyState, SubSidebar, ProfileEntityCard, RightLayerMenuLayout, useIconSize, useIconStrokeWidth, IconButtonGroup, Avatar, DataTable, Badge } from '@ui-core/react';
import type { DataTableColumn } from '@ui-core/react';
import { UserCog, Link2, Copy, Check, User, Trash2, Pencil, LayoutGrid, List, UserPlus } from 'lucide-react';
import {
  useTeachers,
  useUpdateTeacher,
  useDeleteTeacher,
  useResignTeacher,
  useTeachersWithStats,
  useTeacherClasses,
  useCreateTeacherInvitation,
  usePendingTeacherRegistrations,
  useApproveTeacherRegistration,
  useRejectTeacherRegistration,
  usePositionPermissionDescription,
  POSITION_LABELS,
} from '@hooks/use-class';
import type { TeacherWithStats } from '@hooks/use-class';
import type { UpdateTeacherInput, TeacherStatus, TeacherPosition } from '@services/class-service';
import type { CreateTeacherWithAuthInput } from '@industry/academy';
import { apiClient } from '@api-sdk/core';
import { useIndustryTerms } from '@hooks/use-industry-terms';
// [SSOT] Barrel export를 통한 통합 import
import { TEACHERS_SUB_MENU_ITEMS, DEFAULT_TEACHERS_SUB_MENU, TEACHERS_MENU_LABEL_MAPPING, getSubMenuFromUrl, setSubMenuToUrl, applyDynamicLabels } from '../constants';
import type { TeachersSubMenuId } from '../constants';
import { templates } from '../utils';
import { TeacherForm } from './teachers/components/TeacherForm';
import { LayerSectionHeader } from './students/components/LayerSectionHeader';

/** 요일 레이블 매핑 */
const DAY_LABELS: Record<string, string> = {
  monday: '월',
  tuesday: '화',
  wednesday: '수',
  thursday: '목',
  friday: '금',
  saturday: '토',
  sunday: '일',
};

/**
 * 요일 배열을 표시용 문자열로 변환
 * 단일 요일: "월"
 * 복수 요일: "월, 화, 수"
 */
function formatDayOfWeek(dayOfWeek: string | string[] | null | undefined): string {
  if (!dayOfWeek) return '-';

  if (Array.isArray(dayOfWeek)) {
    if (dayOfWeek.length === 0) return '-';
    return dayOfWeek.map(d => DAY_LABELS[d] || d).join(', ');
  }

  return DAY_LABELS[dayOfWeek] || dayOfWeek;
}

export function TeachersPage() {
  const { showConfirm, showAlert } = useModal();
  const terms = useIndustryTerms();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);

  // 서브 메뉴 상태
  const validIds = TEACHERS_SUB_MENU_ITEMS.map(item => item.id) as readonly TeachersSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_TEACHERS_SUB_MENU);

  const handleSubMenuChange = useCallback((id: TeachersSubMenuId) => {
    // 'add' 메뉴 선택 시 강사 등록 모달 열기 (URL 변경 없이)
    if (id === 'add') {
      setShowCreateForm(true);
      return;
    }
    const newUrl = setSubMenuToUrl(id, DEFAULT_TEACHERS_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  // [업종중립] 동적 라벨이 적용된 서브 메뉴 아이템
  const subMenuItemsWithDynamicLabels = useMemo(() => {
    return applyDynamicLabels(TEACHERS_SUB_MENU_ITEMS, TEACHERS_MENU_LABEL_MAPPING, terms);
  }, [terms]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  // 선택된 강사 ID (우측 레이어 메뉴용)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  // 수정 모드 여부
  const [isEditing, setIsEditing] = useState(false);
  // 아이콘 크기
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  // 초대 링크 생성 모달 상태
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitePosition, setInvitePosition] = useState<TeacherPosition>('teacher');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  // 승인 모달 상태 (request_id 기반으로 변경)
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [approvingRequestName, setApprovingRequestName] = useState<string>('');
  // 보기 모드 상태: 'card' | 'table'
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  // 버튼 hover 상태
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // [최적화] useTeachersWithStats로 N+1 문제 해결
  // 기존: useTeachers + 각 카드에서 useTeacherStatistics 개별 호출 (N+1)
  // 변경: useTeachersWithStats로 한 번에 조회 (1 query)
  const { data: teachers, isLoading, error } = useTeachersWithStats();
  const updateTeacher = useUpdateTeacher();
  const deleteTeacher = useDeleteTeacher();
  const resignTeacher = useResignTeacher();
  const createInvitation = useCreateTeacherInvitation();

  // 가입 신청 관련 훅
  const { data: pendingRegistrations } = usePendingTeacherRegistrations();
  const approveRegistration = useApproveTeacherRegistration();
  const rejectRegistration = useRejectTeacherRegistration();

  // 직급별 권한 설명 (설정 페이지와 연동)
  // [업종중립] terms 전달하여 동적 라벨 생성
  const permissionDescription = usePositionPermissionDescription(invitePosition, terms);

  // 모든 직급의 권한 설명 맵
  // const permissionDescriptionMap: Record<TeacherPosition, string> = {
  //   vice_principal: usePositionPermissionDescription('vice_principal', terms),
  //   manager: usePositionPermissionDescription('manager', terms),
  //   teacher: usePositionPermissionDescription('teacher', terms),
  //   assistant: usePositionPermissionDescription('assistant', terms),
  //   other: usePositionPermissionDescription('other', terms),
  // };


  const handleCreateTeacher = async (data: Record<string, unknown>) => {
    let profileImageUrl: string | undefined = undefined;

    try {
      // 프로필 이미지 업로드 처리
      const imageFile = data.profile_image instanceof File ? data.profile_image : undefined;

      if (imageFile) {
        const uploadResponse = await apiClient.uploadFile(
          imageFile,
          'teacher-profiles',
          'profiles'
        );

        if (!uploadResponse.success) {
          throw new Error(uploadResponse.error?.message || '프로필 이미지 업로드에 실패했습니다.');
        }

        profileImageUrl = uploadResponse.data;
      }

      // CreateTeacherWithAuthInput 타입으로 변환
      const input: CreateTeacherWithAuthInput = {
        name: String(data.name || ''),
        phone: String(data.phone || ''),
        position: String(data.position || 'teacher') as TeacherPosition,
        login_id: String(data.login_id || ''),
        password: String(data.password || ''),
        email: data.email ? String(data.email) : undefined,
        specialization: data.specialization ? String(data.specialization) : undefined,
        hire_date: data.hire_date ? String(data.hire_date) : undefined,
        employee_id: data.employee_id ? String(data.employee_id) : undefined,
        profile_image_url: profileImageUrl,
        bio: data.bio ? String(data.bio) : undefined,
        notes: data.notes ? String(data.notes) : undefined,
        pay_type: data.pay_type ? String(data.pay_type) : undefined,
        base_salary: data.base_salary ? Number(data.base_salary) : undefined,
        hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : undefined,
        bank_name: data.bank_name ? String(data.bank_name) : undefined,
        bank_account: data.bank_account ? String(data.bank_account) : undefined,
        salary_notes: data.salary_notes ? String(data.salary_notes) : undefined,
        status: data.status ? (data.status as TeacherStatus) : 'active',
      };

      // Edge Function 호출하여 강사 생성 (auth.users + persons + academy_teachers)
      const response = await apiClient.invokeFunction('create-teacher-direct', input as unknown as Record<string, unknown>);

      if (!response.success) {
        throw new Error(response.error?.message || '강사 등록에 실패했습니다.');
      }

      setShowCreateForm(false);
      showAlert('강사가 등록되었습니다.', '성공', 'success');
    } catch (error) {
      // 롤백: 이미지 업로드 성공 후 강사 생성 실패 시 이미지 삭제
      if (profileImageUrl) {
        await apiClient.deleteFile('teacher-profiles', profileImageUrl);
      }

      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : `${terms.PERSON_LABEL_SECONDARY} 등록에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  };

  const handleUpdateTeacher = async (teacherId: string, input: UpdateTeacherInput): Promise<void> => {
    try {
      await updateTeacher.mutateAsync({ teacherId, input });
      setIsEditing(false);
    } catch (error) {
      // 에러는 showAlert로 사용자에게 표시 (아키텍처 문서 6-3 참조)
      showAlert(
        error instanceof Error ? error.message : `${terms.PERSON_LABEL_SECONDARY} 수정에 실패했습니다.`,
        '오류',
        'error'
      );
    }
  };

  // 강사 선택 핸들러 (우측 레이어 열기)
  const handleTeacherSelect = useCallback((teacherId: string | null) => {
    setSelectedTeacherId(teacherId);
    setIsEditing(false); // 선택 변경 시 수정 모드 해제
  }, []);

  // 선택된 강사 데이터
  const selectedTeacher = useMemo(() => {
    if (!selectedTeacherId || !teachers) return null;
    return teachers.find(t => t.id === selectedTeacherId) || null;
  }, [selectedTeacherId, teachers]);

  // 초대 링크 생성 핸들러
  const handleCreateInvitation = async () => {
    try {
      const result = await createInvitation.mutateAsync({ position: invitePosition });
      setGeneratedInviteUrl(result.invite_url);
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '초대 링크 생성에 실패했습니다.',
        '오류',
        'error'
      );
    }
  };

  // 클립보드 복사 핸들러
  const handleCopyInviteUrl = async () => {
    if (!generatedInviteUrl) return;
    try {
      await navigator.clipboard.writeText(generatedInviteUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      showAlert('클립보드 복사에 실패했습니다.', '오류', 'error');
    }
  };

  // 초대 모달 닫기 핸들러
  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    setGeneratedInviteUrl(null);
    setInvitePosition('teacher');
    setIsCopied(false);
  };

  // 승인 모달 열기 핸들러 (request_id 기반)
  const handleOpenApproveModal = (requestId: string, name: string) => {
    setApprovingRequestId(requestId);
    setApprovingRequestName(name);
    setShowApproveModal(true);
  };

  // 승인 모달 닫기 핸들러
  const handleCloseApproveModal = () => {
    setShowApproveModal(false);
    setApprovingRequestId(null);
    setApprovingRequestName('');
  };

  // 가입 신청 승인 핸들러
  const handleApproveRegistration = async () => {
    if (!approvingRequestId) return;

    try {
      await approveRegistration.mutateAsync({
        request_id: approvingRequestId,
      });
      showAlert(`${terms.PERSON_LABEL_SECONDARY} 승인이 완료되었습니다.`, '성공', 'success');
      handleCloseApproveModal();
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '승인에 실패했습니다.',
        '오류',
        'error'
      );
    }
  };

  // 가입 신청 거절 핸들러
  const handleRejectRegistration = async (requestId: string) => {
    const confirmed = await showConfirm('정말 이 신청을 거절하시겠습니까?', '신청 거절');
    if (!confirmed) return;

    try {
      await rejectRegistration.mutateAsync({
        request_id: requestId,
      });
      showAlert('신청이 거절되었습니다.', '알림', 'info');
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : '거절에 실패했습니다.',
        '오류',
        'error'
      );
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!isMobileMode && (
          <SubSidebar
            title={templates.management(terms.PERSON_LABEL_SECONDARY)}
            items={subMenuItemsWithDynamicLabels}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            testId="teachers-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <div style={{ flex: 1 }}>
          <RightLayerMenuLayout
            layerMenu={{
              isOpen: !!selectedTeacherId,
              onClose: () => handleTeacherSelect(null),
              contentKey: selectedTeacherId || undefined,
              style: {
                zIndex: 'var(--z-modal)',
              },
              title: selectedTeacher ? (
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--spacing-sm)', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 'var(--font-size-3xl)',
                      fontWeight: 'var(--font-weight-extrabold)',
                      lineHeight: 'var(--line-height-tight)',
                      color: 'var(--color-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {selectedTeacher.name}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {terms.PERSON_LABEL_SECONDARY} 상세정보
                  </span>
                </span>
              ) : `${terms.PERSON_LABEL_SECONDARY} 상세`,
              children: selectedTeacher ? (
                <TeacherInfoPanel
                  teacher={selectedTeacher}
                  isEditing={isEditing}
                  titleIconSize={titleIconSize}
                  titleIconStrokeWidth={titleIconStrokeWidth}
                  isMobileMode={isMobileMode}
                  terms={terms}
                  onEdit={() => setIsEditing(true)}
                  onCancelEdit={() => setIsEditing(false)}
                  onSave={async (data) => {
                    // 프로필 이미지 업로드 처리
                    let profileImageUrl: string | undefined = undefined;
                    if (data.profile_image && data.profile_image instanceof File) {
                      const uploadResponse = await apiClient.uploadFile(
                        data.profile_image,
                        'teacher-profiles',
                        'profiles'
                      );
                      if (!uploadResponse.success) {
                        throw new Error(uploadResponse.error?.message || '프로필 이미지 업로드에 실패했습니다.');
                      }
                      profileImageUrl = uploadResponse.data;
                    }

                    // 비밀번호 검증 (입력된 경우에만)
                    const password = typeof data.password === 'string' && data.password !== '' ? data.password : undefined;
                    const passwordConfirm = typeof data.password_confirm === 'string' && data.password_confirm !== '' ? data.password_confirm : undefined;

                    if (password || passwordConfirm) {
                      if (password !== passwordConfirm) {
                        throw new Error('비밀번호가 일치하지 않습니다.');
                      }
                      if (password && password.length < 8) {
                        throw new Error('비밀번호는 8자 이상이어야 합니다.');
                      }
                    }

                    const input: UpdateTeacherInput = {
                      name: typeof data.name === 'string' && data.name !== '' ? data.name : undefined,
                      phone: typeof data.phone === 'string' && data.phone !== '' ? data.phone : undefined,
                      login_id: typeof data.login_id === 'string' && data.login_id !== '' ? data.login_id : undefined,
                      password: password,
                      employee_id: typeof data.employee_id === 'string' && data.employee_id !== '' ? data.employee_id : undefined,
                      specialization: typeof data.specialization === 'string' && data.specialization !== '' ? data.specialization : undefined,
                      hire_date: typeof data.hire_date === 'string' && data.hire_date !== '' ? data.hire_date : undefined,
                      status: data.status as TeacherStatus | undefined,
                      profile_image_url: profileImageUrl || (typeof data.profile_image_url === 'string' && data.profile_image_url !== '' ? data.profile_image_url : undefined),
                      bio: typeof data.bio === 'string' && data.bio !== '' ? data.bio : undefined,
                      notes: typeof data.notes === 'string' && data.notes !== '' ? data.notes : undefined,
                      position: typeof data.position === 'string' && data.position !== '' ? data.position as TeacherPosition : undefined,
                      pay_type: typeof data.pay_type === 'string' && data.pay_type !== '' ? data.pay_type : undefined,
                      base_salary: typeof data.base_salary === 'number' ? data.base_salary : undefined,
                      hourly_rate: typeof data.hourly_rate === 'number' ? data.hourly_rate : undefined,
                      bank_name: typeof data.bank_name === 'string' && data.bank_name !== '' ? data.bank_name : undefined,
                      bank_account: typeof data.bank_account === 'string' && data.bank_account !== '' ? data.bank_account : undefined,
                      salary_notes: typeof data.salary_notes === 'string' && data.salary_notes !== '' ? data.salary_notes : undefined,
                    };
                    await handleUpdateTeacher(selectedTeacher.id, input);
                  }}
                  onDelete={async () => {
                    const confirmed = await showConfirm(`정말 이 ${terms.PERSON_LABEL_SECONDARY}를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.`, `${terms.PERSON_LABEL_SECONDARY} 삭제`);
                    if (confirmed) {
                      try {
                        await deleteTeacher.mutateAsync(selectedTeacher.id);
                        handleTeacherSelect(null);
                      } catch (error) {
                        showAlert(
                          error instanceof Error ? error.message : `${terms.PERSON_LABEL_SECONDARY} 삭제에 실패했습니다.`,
                          '오류',
                          'error'
                        );
                      }
                    }
                  }}
                  onResign={async () => {
                    const confirmed = await showConfirm(`이 ${terms.PERSON_LABEL_SECONDARY}를 퇴직 처리하시겠습니까?`, `${terms.PERSON_LABEL_SECONDARY} 퇴직`);
                    if (confirmed) {
                      try {
                        await resignTeacher.mutateAsync(selectedTeacher.id);
                      } catch (error) {
                        showAlert(
                          error instanceof Error ? error.message : `${terms.PERSON_LABEL_SECONDARY} 퇴직 처리에 실패했습니다.`,
                          '오류',
                          'error'
                        );
                      }
                    }
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  {terms.PERSON_LABEL_SECONDARY} 정보를 불러올 수 없습니다.
                </div>
              ),
            }}
          >
            <Container maxWidth="xl" padding="lg">
          <PageHeader
            title={TEACHERS_SUB_MENU_ITEMS.find(item => item.id === selectedSubMenu)?.label || `${terms.PERSON_LABEL_SECONDARY} 관리`}
          />

          {/* 강사 목록 탭 (기본) */}
          {selectedSubMenu === 'list' && (
            <>
              {/* 배지 버튼 영역 (우측 상단) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 'var(--spacing-md)', gap: 'var(--spacing-md)' }}>
                {/* 액션 버튼들 */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                  {/* 초대 링크 버튼 */}
                  {(() => {
                    const isHovered = hoveredButton === 'invite';
                    return (
                      <button
                        type="button"
                        onClick={() => setShowInviteModal(true)}
                        onMouseEnter={() => setHoveredButton('invite')}
                        onMouseLeave={() => setHoveredButton(null)}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 'var(--font-weight-medium)',
                          border: 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-xs)',
                          backgroundColor: isHovered ? 'var(--color-primary-hover)' : 'var(--color-white)',
                          color: 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          transition: 'var(--transition-all)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)',
                        }}
                      >
                        <Link2 size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                        초대 링크
                      </button>
                    );
                  })()}

                  {/* 강사 등록 버튼 */}
                  {(() => {
                    const isHovered = hoveredButton === 'create';
                    return (
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        onMouseEnter={() => setHoveredButton('create')}
                        onMouseLeave={() => setHoveredButton(null)}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 'var(--font-weight-medium)',
                          border: 'none',
                          borderRadius: 'var(--border-radius-xs)',
                          backgroundColor: isHovered ? 'var(--color-primary-dark)' : 'var(--color-primary)',
                          color: 'var(--color-white)',
                          cursor: 'pointer',
                          transition: 'var(--transition-all)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)',
                        }}
                      >
                        <UserPlus size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                        {terms.PERSON_LABEL_SECONDARY} 등록
                      </button>
                    );
                  })()}
                </div>

                {/* 보기 모드 전환 아이콘 (정사각형 버튼) */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'stretch' }}>
                  {/* 카드형 버튼 */}
                  {(() => {
                    const isActive = viewMode === 'card';
                    const isHovered = hoveredButton === 'view-card';

                    const getBackgroundColor = () => {
                      if (isActive) {
                        return isHovered ? 'var(--color-primary-dark)' : 'var(--color-primary)';
                      }
                      return isHovered ? 'var(--color-primary-hover)' : 'var(--color-white)';
                    };

                    const buttonElement = (
                      <button
                        type="button"
                        onClick={() => setViewMode('card')}
                        onMouseEnter={() => setHoveredButton('view-card')}
                        onMouseLeave={() => setHoveredButton(null)}
                        style={{
                          width: 'calc(var(--font-size-sm) * var(--line-height) + var(--spacing-xs) * 2)',
                          height: 'calc(var(--font-size-sm) * var(--line-height) + var(--spacing-xs) * 2)',
                          padding: 0,
                          border: isActive ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-xs)',
                          backgroundColor: getBackgroundColor(),
                          color: isActive ? 'var(--color-white)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'var(--transition-all)',
                          flexShrink: 0,
                        }}
                      >
                        <LayoutGrid size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                      </button>
                    );

                    if (isActive) {
                      return (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <div style={{
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
                            zIndex: 'var(--z-tooltip)',
                          }}>
                            카드형
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: 'var(--spacing-xs) solid transparent',
                              borderRight: 'var(--spacing-xs) solid transparent',
                              borderTop: 'var(--spacing-xs) solid var(--color-primary)',
                            }} />
                          </div>
                          {buttonElement}
                        </div>
                      );
                    }

                    return <div style={{ display: 'inline-block' }}>{buttonElement}</div>;
                  })()}

                  {/* 테이블형 버튼 */}
                  {(() => {
                    const isActive = viewMode === 'table';
                    const isHovered = hoveredButton === 'view-table';

                    const getBackgroundColor = () => {
                      if (isActive) {
                        return isHovered ? 'var(--color-primary-dark)' : 'var(--color-primary)';
                      }
                      return isHovered ? 'var(--color-primary-hover)' : 'var(--color-white)';
                    };

                    const buttonElement = (
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        onMouseEnter={() => setHoveredButton('view-table')}
                        onMouseLeave={() => setHoveredButton(null)}
                        style={{
                          width: 'calc(var(--font-size-sm) * var(--line-height) + var(--spacing-xs) * 2)',
                          height: 'calc(var(--font-size-sm) * var(--line-height) + var(--spacing-xs) * 2)',
                          padding: 0,
                          border: isActive ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-xs)',
                          backgroundColor: getBackgroundColor(),
                          color: isActive ? 'var(--color-white)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'var(--transition-all)',
                          flexShrink: 0,
                        }}
                      >
                        <List size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
                      </button>
                    );

                    if (isActive) {
                      return (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <div style={{
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
                            zIndex: 'var(--z-tooltip)',
                          }}>
                            테이블형
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: 'var(--spacing-xs) solid transparent',
                              borderRight: 'var(--spacing-xs) solid transparent',
                              borderTop: 'var(--spacing-xs) solid var(--color-primary)',
                            }} />
                          </div>
                          {buttonElement}
                        </div>
                      );
                    }

                    return <div style={{ display: 'inline-block' }}>{buttonElement}</div>;
                  })()}
                </div>
              </div>

              {/* 대기 중인 가입 신청 섹션 */}
              {pendingRegistrations && pendingRegistrations.length > 0 && (
                <Card padding="md" style={{ marginBottom: 'var(--spacing-lg)', borderLeft: 'var(--border-width-thick) solid var(--color-info)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-info)' }}>
                      가입 승인 대기 ({pendingRegistrations.length}건)
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(var(--width-card-min), 1fr))`, gap: 'var(--spacing-md)' }}>
                    {pendingRegistrations.map((request) => (
                      <div
                        key={request.id}
                        style={{
                          padding: 'var(--spacing-md)',
                          backgroundColor: 'var(--color-info-50)',
                          borderRadius: 'var(--border-radius-md)',
                          border: 'var(--border-width-thin) solid var(--color-info-200)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-sm)' }}>
                          <div>
                            <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-md)' }}>
                              {request.name}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                              {POSITION_LABELS[request.position] || request.position}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              padding: 'var(--spacing-2xs) var(--spacing-xs)',
                              borderRadius: 'var(--border-radius-full)',
                              backgroundColor: 'var(--color-info-100)',
                              color: 'var(--color-info)',
                            }}
                          >
                            승인 대기
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
                          <div>전화: {request.phone}</div>
                          <div>이메일: {request.login_id}</div>
                          <div>신청일: {new Date(request.created_at).toLocaleDateString('ko-KR')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                          <Button
                            size="sm"
                            variant="solid"
                            color="primary"
                            onClick={() => handleOpenApproveModal(request.id, request.name)}
                            disabled={approveRegistration.isPending}
                            style={{ flex: 1 }}
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            color="error"
                            onClick={() => handleRejectRegistration(request.id)}
                            disabled={rejectRegistration.isPending}
                            style={{ flex: 1 }}
                          >
                            거절
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 강사 등록 폼은 Container 밖의 Modal로 이동 */}

          {/* 강사 목록 */}
          {isLoading ? (
            <Card padding="lg">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                로딩 중...
              </div>
            </Card>
          ) : error ? (
            <Card padding="md">
              <div style={{ color: 'var(--color-error)', padding: 'var(--spacing-md)' }}>
                오류: {error.message}
              </div>
            </Card>
          ) : teachers && teachers.length > 0 ? (
            viewMode === 'card' ? (
              // 카드형 보기
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobileMode
                  ? '1fr'
                  : isTabletMode
                  ? 'repeat(2, 1fr)'
                  : 'repeat(3, 1fr)',
                gap: 'var(--spacing-md)'
              }}>
                {teachers.map((teacher) => (
                  <TeacherCard
                    key={teacher.id}
                    teacher={teacher}
                    onClick={(teacherId) => handleTeacherSelect(teacherId)}
                  />
                ))}
              </div>
            ) : (
              // 테이블형 보기
              <DataTable
                data={teachers}
                onRowClick={(row) => handleTeacherSelect(row.id)}
                columns={[
                  {
                    key: 'name',
                    label: '이름',
                    width: '15%',
                    render: (_, row) => (
                      <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                        {row.name}
                      </span>
                    ),
                  },
                  {
                    key: 'position',
                    label: '직급',
                    width: '12%',
                    render: (_, row) => {
                      return (
                        <span>{row.position ? POSITION_LABELS[row.position] || row.position : '-'}</span>
                      );
                    },
                  },
                  {
                    key: 'specialization',
                    label: '전문분야',
                    width: '12%',
                    render: (_, row) => (
                      <span>{row.specialization || '-'}</span>
                    ),
                  },
                  {
                    key: 'phone',
                    label: '연락처',
                    width: '15%',
                    render: (_, row) => (
                      <span>{row.phone || '-'}</span>
                    ),
                  },
                  {
                    key: 'email',
                    label: '이메일',
                    width: '18%',
                    render: (_, row) => (
                      <span style={{ fontSize: 'var(--font-size-sm)' }}>
                        {row.email || '-'}
                      </span>
                    ),
                  },
                  {
                    key: 'classes',
                    label: `담당 ${terms.GROUP_LABEL}`,
                    width: '10%',
                    align: 'center',
                    render: (_, row) => (
                      <span>{row.total_classes || 0}개</span>
                    ),
                  },
                  {
                    key: 'students',
                    label: `담당 ${terms.PERSON_LABEL_PRIMARY}`,
                    width: '10%',
                    align: 'center',
                    render: (_, row) => (
                      <span>{row.total_students || 0}명</span>
                    ),
                  },
                  {
                    key: 'status',
                    label: '상태',
                    width: '8%',
                    align: 'center',
                    render: (_, row) => {
                      const statusConfig: Record<TeacherStatus, { color: 'success' | 'warning' | 'error' | 'info' | 'gray'; label: string }> = {
                        active: { color: 'success', label: terms.STAFF_ACTIVE },
                        on_leave: { color: 'warning', label: terms.STAFF_LEAVE },
                        resigned: { color: 'error', label: terms.STAFF_RESIGNED },
                        pending: { color: 'info', label: '승인 대기' },
                      };
                      const config = statusConfig[row.status] || { color: 'gray', label: '-' };
                      return (
                        <Badge color={config.color} variant="solid" size="sm">
                          {config.label}
                        </Badge>
                      );
                    },
                  },
                ] as DataTableColumn<TeacherWithStats>[]}
                keyExtractor={(row) => row.id}
                hideFilterControls
                stickyHeader={false}
              />
            )
          ) : (
            <Card padding="lg">
              <EmptyState
                icon={UserCog}
                message={`등록된 ${terms.PERSON_LABEL_SECONDARY}가 없습니다.`}
              />
            </Card>
          )}
            </>
          )}

          {/* 강사 통계 탭 */}
          {selectedSubMenu === 'statistics' && (
            <>
              <TeacherStatisticsTab terms={terms} />
            </>
          )}

          {/* 담당 과목 탭 */}
          {selectedSubMenu === 'assignments' && (
            <>
              <TeacherAssignmentsTab terms={terms} />
            </>
          )}

          {/* 강사 성과 탭 */}
          {selectedSubMenu === 'performance' && (
            <>
              <TeacherPerformanceTab terms={terms} />
            </>
          )}

            </Container>
          </RightLayerMenuLayout>
        </div>

        {/* [요구사항] 강사 등록 모달 - 통합 TeacherForm 사용 */}
        {showCreateForm && (() => {
          let triggerSubmit: (() => void) | null = null;
          return (
            <Modal
              isOpen={showCreateForm}
              onClose={() => setShowCreateForm(false)}
              title={`${terms.PERSON_LABEL_SECONDARY} 등록`}
              size="lg"
              footer={
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    style={{ flex: 1 }}
                  >
                    {terms.MESSAGES.CANCEL}
                  </Button>
                  <Button
                    variant="solid"
                    color="primary"
                    onClick={() => triggerSubmit?.()}
                    style={{ flex: 1 }}
                  >
                    {terms.MESSAGES.SAVE}
                  </Button>
                </>
              }
            >
              <TeacherForm
                mode="create"
                onSubmit={async (data) => {
                  await handleCreateTeacher(data);
                }}
                onSubmitTrigger={(fn) => { triggerSubmit = fn; }}
              />
            </Modal>
          );
        })()}

        {/* [요구사항] 초대 링크 생성 모달 */}
        <Modal
          isOpen={showInviteModal}
          onClose={handleCloseInviteModal}
          title="초대링크 생성"
          size="md"
          footer={!generatedInviteUrl ? (
            <>
              <Button
                variant="outline"
                onClick={handleCloseInviteModal}
                style={{ flex: 1 }}
              >
                {terms.MESSAGES.CANCEL}
              </Button>
              <Button
                variant="solid"
                color="primary"
                onClick={handleCreateInvitation}
                disabled={createInvitation.isPending}
                style={{ flex: 1 }}
              >
                {createInvitation.isPending ? '생성 중...' : '링크 생성'}
              </Button>
            </>
          ) : (
            <Button
              variant="solid"
              color="primary"
              onClick={handleCloseInviteModal}
              style={{ flex: 1 }}
            >
              완료
            </Button>
          )}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {!generatedInviteUrl ? (
              <>
                {/* 직급 선택 버튼 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-sm)' }}>
                  {(Object.entries(POSITION_LABELS) as [TeacherPosition, string][]).map(([value, label]) => {
                    const isSelected = invitePosition === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setInvitePosition(value)}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'var(--color-white)';
                          }
                        }}
                        style={{
                          padding: 'var(--spacing-md)',
                          border: isSelected
                            ? 'var(--border-width-thin) solid var(--color-primary)'
                            : 'var(--border-width-thin) solid var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-md)',
                          backgroundColor: isSelected ? 'var(--color-primary-50)' : 'var(--color-white)',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* 직급별 권한 설명 */}
                <div
                  style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-gray-50)',
                    borderRadius: 'var(--border-radius-md)',
                    color: 'var(--color-text)',
                    fontSize: 'var(--font-size-base)',
                    lineHeight: 'var(--line-height)',
                  }}
                >
                  <strong>{POSITION_LABELS[invitePosition]}</strong> : {permissionDescription}
                </div>
              </>
            ) : (
              <>
                {/* 생성된 링크 표시 */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    생성된 초대 링크
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      padding: 'var(--spacing-sm)',
                      backgroundColor: 'var(--color-background-secondary)',
                      borderRadius: 'var(--border-radius-md)',
                      border: 'var(--border-width-thin) solid var(--color-border)',
                    }}
                  >
                    <input
                      type="text"
                      value={generatedInviteUrl}
                      readOnly
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyInviteUrl}
                    >
                      {isCopied ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>

                {/* 직급 정보 */}
                <div
                  style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-success-50)',
                    borderRadius: 'var(--border-radius-md)',
                    color: 'var(--color-success)',
                    fontSize: 'var(--font-size-base)',
                  }}
                >
                  <strong>직급</strong> : {POSITION_LABELS[invitePosition]}
                  <br />
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    이 링크는 7일 후 만료됩니다.
                  </span>
                </div>

                {/* 복사 완료 메시지 */}
                {isCopied && (
                  <div
                    style={{
                      textAlign: 'center',
                      color: 'var(--color-success)',
                      fontSize: 'var(--font-size-base)',
                    }}
                  >
                    클립보드에 복사되었습니다!
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>

        {/* [요구사항] 가입 신청 승인 모달 */}
        <Modal
          isOpen={showApproveModal}
          onClose={handleCloseApproveModal}
          title={`${terms.PERSON_LABEL_SECONDARY} 가입 승인`}
          size="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-info-50)',
                borderRadius: 'var(--border-radius-md)',
                color: 'var(--color-info)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <strong>{approvingRequestName}</strong>님의 가입 신청을 승인하시겠습니까?
              <br />
              <br />
              승인 시 {terms.PERSON_LABEL_SECONDARY}의 로그인 계정이 생성됩니다.
              <br />
              (신청 시 입력한 비밀번호가 사용됩니다)
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
              <Button
                variant="outline"
                onClick={handleCloseApproveModal}
                style={{ flex: 1 }}
              >
                취소
              </Button>
              <Button
                variant="solid"
                color="primary"
                onClick={handleApproveRegistration}
                disabled={approveRegistration.isPending}
                style={{ flex: 1 }}
              >
                {approveRegistration.isPending ? '처리 중...' : '승인'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
}

/**
 * 강사 카드 (프로필 보기)
 * [요구사항] 강사 프로필 보기 - 클릭 시 우측 레이어 열림
 * [P1-1] 담당 수업 목록 표시
 * [P1-3] 강사 통계 표시
 *
 * [최적화] TeacherWithStats 타입 사용으로 N+1 문제 해결
 * - 기존: 각 카드에서 useTeacherStatistics 개별 호출 (N+1 쿼리)
 * - 변경: 부모에서 통계 포함된 데이터를 받아서 사용 (0 추가 쿼리)
 */
function TeacherCard({
  teacher,
  onClick,
}: {
  teacher: TeacherWithStats;
  onClick: (teacherId: string) => void;
}) {
  // 직급별 색상 매핑
  const getPositionBadgeColor = (position?: string): 'primary' | 'success' | 'warning' | 'error' | 'secondary' => {
    if (!position) return 'secondary';
    if (position === 'vice_principal') return 'error';
    if (position === 'manager') return 'warning';
    if (position === 'teacher') return 'primary';
    if (position === 'assistant') return 'success';
    return 'secondary';
  };

  // 직급 레이블 (SSOT: use-class Hook의 POSITION_LABELS 사용)
  const positionLabel = teacher.position ? POSITION_LABELS[teacher.position] || teacher.position : '직급 미지정';

  return (
    <ProfileEntityCard
      profileImageUrl={teacher.profile_image_url}
      badge={{
        label: teacher.specialization || '전문 분야',
        color: getPositionBadgeColor(teacher.position),
      }}
      secondaryLabel={positionLabel}
      title={teacher.name}
      description={teacher.phone || teacher.email || '-'}
      statsText={`${teacher.total_classes || 0}개 / ${teacher.total_students || 0}명`}
      onClick={() => onClick(teacher.id)}
    />
  );
}

/**
 * 강사 정보 패널 (우측 레이어 메뉴 내용)
 * [요구사항] 읽기모드/수정모드 지원
 * - 카드 클릭 시 읽기모드로 출력
 * - 수정 버튼 클릭 시 수정모드 진입
 */
function TeacherInfoPanel({
  teacher,
  isEditing,
  titleIconSize,
  titleIconStrokeWidth,
  isMobileMode,
  terms,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onResign,
}: {
  teacher: TeacherWithStats;
  isEditing: boolean;
  titleIconSize: number;
  titleIconStrokeWidth: number;
  isMobileMode: boolean;
  terms: ReturnType<typeof useIndustryTerms>;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
  onResign: () => Promise<void>;
}) {
  // 읽기 전용 필드 정의
  const readOnlyFields = useMemo(() => [
    { label: '이름', value: teacher.name || '-' },
    { label: '직급', value: teacher.position ? POSITION_LABELS[teacher.position] || teacher.position : '-' },
    { label: '전화번호', value: teacher.phone || '-' },
    { label: '이메일', value: teacher.email || '-' },
    { label: '전문분야', value: teacher.specialization || '-' },
    { label: '상태', value: teacher.status === 'active' ? terms.STAFF_ACTIVE : teacher.status === 'on_leave' ? terms.STAFF_LEAVE : teacher.status === 'resigned' ? terms.STAFF_RESIGNED : '-' },
    { label: '입사일', value: teacher.hire_date || '-' },
    { label: '사번', value: teacher.employee_id || '-' },
    { label: '담당 수업', value: `${teacher.total_classes || 0}개` },
    { label: '담당 학생', value: `${teacher.total_students || 0}명` },
    { label: '소개', value: teacher.bio || '-', colSpan: 2 },
    { label: '메모', value: teacher.notes || '-', colSpan: 2 },
  ], [teacher, terms]);

  if (!isEditing) {
    // 읽기 모드 - 수정모드(SchemaForm)와 동일한 2열 그리드 레이아웃
    // 프로필 이미지가 첫 번째 열에 rowSpan으로 배치되고, 나머지 필드가 두 번째 열에 배치됨
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <User size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              기본정보
            </span>
          }
        />
        <Card padding="md">
          {/* 수정모드와 동일한 2열 그리드 레이아웃 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobileMode ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--spacing-md)',
            }}
          >
            {/* 프로필 이미지 영역 - 수정모드와 동일하게 rowSpan: 6 */}
            <div
              style={{
                gridColumn: '1',
                gridRow: isMobileMode ? 'auto' : 'span 6',
              }}
            >
              <div
                style={{
                  borderRadius: 'var(--border-radius-sm)',
                  minHeight: 'var(--width-card-min)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--color-background-secondary)',
                  overflow: 'hidden',
                }}
              >
                {teacher.profile_image_url ? (
                  <img
                    src={teacher.profile_image_url}
                    alt={teacher.name}
                    style={{
                      maxWidth: 'var(--width-full)',
                      maxHeight: 'var(--width-card-min)',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <Avatar
                      name={teacher.name}
                      size="xl"
                    />
                    <span style={{ fontSize: 'var(--font-size-sm)' }}>
                      프로필 사진 없음
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 필드들 - 수정모드와 동일한 순서 */}
            {readOnlyFields.map((field, idx) => (
              <div
                key={idx}
                style={{
                  gridColumn: field.colSpan === 2 ? (isMobileMode ? 'span 1' : 'span 2') : undefined,
                  display: 'flex',
                  width: '100%',
                  alignItems: field.label === '메모' || field.label === '소개' ? 'flex-start' : 'center',
                  paddingTop: 'var(--spacing-sm)',
                  paddingBottom: 'var(--spacing-sm)',
                  paddingLeft: 'var(--spacing-form-horizontal-left)',
                  paddingRight: 'var(--spacing-form-horizontal-right)',
                  borderBottom: 'var(--border-width-thin) solid var(--color-table-row-border)',
                }}
              >
                {/* 항목명 */}
                <span
                  style={{
                    color: 'var(--color-form-inline-label)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 'var(--font-weight-normal)',
                    lineHeight: 'var(--line-height)',
                    minWidth: 'var(--width-form-inline-label)',
                    flexShrink: 0,
                    marginRight: 'var(--spacing-form-inline-label-gap)',
                  }}
                >
                  {field.label}
                </span>
                {/* 결과값 */}
                <span
                  style={{
                    color: 'var(--color-text)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 'var(--font-weight-normal)',
                    lineHeight: 'var(--line-height)',
                    whiteSpace: field.label === '메모' || field.label === '소개' ? 'pre-wrap' : 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {field.value}
                </span>
              </div>
            ))}
          </div>
          {/* 액션 버튼 (읽기 모드) */}
          <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
            <IconButtonGroup
              align="right"
              items={[
                // 퇴직 버튼 (active/on_leave 상태에서만)
                ...((teacher.status === 'active' || teacher.status === 'on_leave') ? [{
                  icon: UserCog,
                  tooltip: '퇴직처리',
                  variant: 'outline' as const,
                  color: 'warning' as const,
                  onClick: onResign,
                }] : []),
                // 삭제 버튼 (resigned 상태에서만)
                ...(teacher.status === 'resigned' ? [{
                  icon: Trash2,
                  tooltip: '삭제',
                  variant: 'outline' as const,
                  color: 'error' as const,
                  onClick: onDelete,
                }] : []),
                // 수정 버튼
                {
                  icon: Pencil,
                  tooltip: '수정',
                  variant: 'outline' as const,
                  onClick: onEdit,
                },
              ]}
            />
          </div>
        </Card>
      </div>
    );
  }

  // 수정 모드
  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <User size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            {terms.PERSON_LABEL_SECONDARY}정보 수정
          </span>
        }
      />
      <TeacherForm
        mode="edit"
        teacherId={teacher.id}
        onSubmit={onSave}
        onSubmitTrigger={undefined}
      />
      {/* 수정 모드 액션 버튼 */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)', padding: '0 var(--spacing-md)' }}>
        <Button
          variant="outline"
          onClick={onCancelEdit}
          style={{ flex: 1 }}
        >
          {terms.MESSAGES.CANCEL}
        </Button>
        <Button
          variant="solid"
          color="primary"
          onClick={() => {
            // TeacherForm의 submit 트리거
            const form = document.querySelector<HTMLFormElement>('.schema-form-no-border form');
            if (form) {
              form.requestSubmit();
            }
          }}
          style={{ flex: 1 }}
        >
          {terms.MESSAGES.SAVE}
        </Button>
      </div>
    </div>
  );
}

/**
 * 강사 통계 탭 컴포넌트
 * 전체 강사 현황 통계를 표시
 */
function TeacherStatisticsTab({ terms }: { terms: ReturnType<typeof useIndustryTerms> }) {
  // resigned 상태 제외하고 조회
  const { data: teachers, isLoading: isLoadingTeachers } = useTeachers();

  // 통계 계산
  const statistics = useMemo(() => {
    if (!teachers) return null;

    // 상태별 분포
    const byStatus = {
      active: teachers.filter(t => t.status === 'active').length,
      on_leave: teachers.filter(t => t.status === 'on_leave').length,
      resigned: teachers.filter(t => t.status === 'resigned').length,
    };

    // 전문 분야별 분포
    const bySpecialization: Record<string, number> = {};
    teachers.forEach(t => {
      if (t.specialization) {
        bySpecialization[t.specialization] = (bySpecialization[t.specialization] || 0) + 1;
      }
    });

    return {
      total: teachers.length,
      byStatus,
      bySpecialization,
    };
  }, [teachers]);

  if (isLoadingTeachers) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  if (!statistics) return null;

  const statusLabels: Record<TeacherStatus, string> = {
    active: terms.STAFF_ACTIVE,
    on_leave: terms.STAFF_LEAVE,
    resigned: terms.STAFF_RESIGNED,
    pending: '승인 대기',
  };

  const statusColors: Record<TeacherStatus, string> = {
    active: 'var(--color-success)',
    on_leave: 'var(--color-warning)',
    resigned: 'var(--color-error)',
    pending: 'var(--color-info)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 기본 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-student-info-min), 1fr))', gap: 'var(--spacing-md)' }}>
        <Card padding="md">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {statistics.total}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>전체 {terms.PERSON_LABEL_SECONDARY}</div>
          </div>
        </Card>
        <Card padding="md">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {statistics.byStatus.active}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{terms.STAFF_ACTIVE}</div>
          </div>
        </Card>
        <Card padding="md">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
              {statistics.byStatus.on_leave}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{terms.STAFF_LEAVE}</div>
          </div>
        </Card>
        <Card padding="md">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
              {statistics.byStatus.resigned}
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{terms.STAFF_RESIGNED}</div>
          </div>
        </Card>
      </div>

      {/* 상태별 분포 차트 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          상태별 분포
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {(Object.entries(statistics.byStatus) as [TeacherStatus, number][]).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <div style={{ width: 'var(--width-grid-column)', color: 'var(--color-text-secondary)' }}>{statusLabels[status]}</div>
              <div style={{ flex: 1, height: 'var(--spacing-lg)', backgroundColor: 'var(--color-gray-100)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: statistics.total > 0 ? `${(count / statistics.total) * 100}%` : '0%',
                    height: '100%',
                    backgroundColor: statusColors[status],
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ width: 'var(--width-table-mobile-label)', textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                {count}명
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 전문 분야별 분포 */}
      {Object.keys(statistics.bySpecialization).length > 0 && (
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
            전문 분야별 분포
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(var(--width-button-min), 1fr))', gap: 'var(--spacing-sm)' }}>
            {Object.entries(statistics.bySpecialization).map(([specialization, count]) => (
              <div
                key={specialization}
                style={{
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-primary-50)',
                  borderRadius: 'var(--border-radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                  {count}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{specialization}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 강사 목록 (간략) */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {terms.PERSON_LABEL_SECONDARY} 목록
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {teachers?.map(teacher => (
            <div
              key={teacher.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-sm)',
                borderLeft: `var(--border-width-thick) solid ${statusColors[teacher.status]}`,
              }}
            >
              <div>
                <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{teacher.name}</span>
                {teacher.specialization && (
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)' }}>
                    ({teacher.specialization})
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  padding: 'var(--spacing-2xs) var(--spacing-xs)',
                  borderRadius: 'var(--border-radius-full)',
                  backgroundColor: `${statusColors[teacher.status]}20`,
                  color: statusColors[teacher.status],
                }}
              >
                {statusLabels[teacher.status]}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * 담당 과목 탭 컴포넌트
 * 강사별 담당 과목/수업 현황을 표시
 * [최적화] useTeachersWithStats로 N+1 문제 해결
 */
function TeacherAssignmentsTab({ terms }: { terms: ReturnType<typeof useIndustryTerms> }) {
  // [최적화] useTeachersWithStats로 통계 포함된 강사 목록 조회
  const { data: teachers, isLoading: isLoadingTeachers } = useTeachersWithStats();

  if (isLoadingTeachers) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {terms.PERSON_LABEL_SECONDARY}별 담당 {terms.GROUP_LABEL}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {teachers?.filter(t => t.status === 'active').map(teacher => (
            <TeacherAssignmentItem key={teacher.id} teacher={teacher} terms={terms} />
          ))}
          {teachers?.filter(t => t.status === 'active').length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
              활성 {terms.PERSON_LABEL_SECONDARY}가 없습니다.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * 강사 담당 과목 아이템 컴포넌트
 * [최적화] TeacherWithStats 사용으로 통계 쿼리 제거
 * 수업 상세 정보는 여전히 useTeacherClasses 사용 (필요시)
 */
function TeacherAssignmentItem({
  teacher,
  terms,
}: {
  teacher: TeacherWithStats;
  terms: ReturnType<typeof useIndustryTerms>;
}) {
  // [최적화] 통계는 teacher 객체에 이미 포함됨, 수업 목록은 별도 조회 필요
  // 수업 상세 정보(이름, 시간 등)가 필요하므로 useTeacherClasses 유지
  const { data: assignedClasses } = useTeacherClasses(teacher.id);

  return (
    <div
      style={{
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
        borderLeft: 'var(--border-width-thick) solid var(--color-primary)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
        <div>
          <span style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-md)' }}>{teacher.name}</span>
          {teacher.specialization && (
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)' }}>
              {teacher.specialization}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>
            {teacher.total_classes || 0}개 {terms.GROUP_LABEL}
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
            {teacher.total_students || 0}명 {terms.PERSON_LABEL_PRIMARY}
          </span>
        </div>
      </div>

      {assignedClasses && assignedClasses.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
          {assignedClasses.map((ct) => (
            <div
              key={ct.class_id}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                backgroundColor: ct.academy_classes?.color || 'var(--color-gray-200)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{ct.academy_classes?.name}</span>
              <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-xs)' }}>
                {formatDayOfWeek(ct.academy_classes?.day_of_week)} {ct.academy_classes?.start_time?.substring(0, 5)}
              </span>
              {ct.role === 'assistant' && (
                <span style={{ color: 'var(--color-warning)', marginLeft: 'var(--spacing-xs)' }}>({terms.ASSISTANT_TEACHER})</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          담당 {terms.GROUP_LABEL}이 없습니다.
        </div>
      )}
    </div>
  );
}

/**
 * 강사 성과 탭 컴포넌트
 * 강사별 성과 분석을 표시
 * [최적화] useTeachersWithStats로 N+1 문제 해결
 */
function TeacherPerformanceTab({ terms }: { terms: ReturnType<typeof useIndustryTerms> }) {
  // [최적화] useTeachersWithStats로 통계 포함된 강사 목록 조회
  const { data: teachers, isLoading: isLoadingTeachers } = useTeachersWithStats();

  if (isLoadingTeachers) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  const activeTeachers = teachers?.filter(t => t.status === 'active') || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 성과 요약 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {terms.PERSON_LABEL_SECONDARY} 성과 현황
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {activeTeachers.map(teacher => (
            <TeacherPerformanceItem key={teacher.id} teacher={teacher} terms={terms} />
          ))}
          {activeTeachers.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
              활성 {terms.PERSON_LABEL_SECONDARY}가 없습니다.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * 강사 성과 아이템 컴포넌트
 * [최적화] TeacherWithStats 사용으로 개별 통계 쿼리 제거
 */
function TeacherPerformanceItem({
  teacher,
  terms,
}: {
  teacher: TeacherWithStats;
  terms: ReturnType<typeof useIndustryTerms>;
}) {
  // [최적화] 통계는 teacher 객체에 이미 포함됨
  // 기존 코드 (제거됨): const { data: stats } = useTeacherStatistics(teacher.id);

  // 성과 점수 계산 (담당 수업 수 * 2 + 담당 학생 수)
  const performanceScore = (teacher.total_classes || 0) * 2 + (teacher.total_students || 0);

  return (
    <div
      style={{
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
        <div>
          <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{teacher.name}</span>
          {teacher.specialization && (
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)' }}>
              {teacher.specialization}
            </span>
          )}
        </div>
        <div
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            backgroundColor: performanceScore > 20 ? 'var(--color-success-50)' : performanceScore > 10 ? 'var(--color-warning-50)' : 'var(--color-gray-100)',
            color: performanceScore > 20 ? 'var(--color-success)' : performanceScore > 10 ? 'var(--color-warning)' : 'var(--color-text-secondary)',
            borderRadius: 'var(--border-radius-full)',
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          점수: {performanceScore}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-sm)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-primary-50)', borderRadius: 'var(--border-radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
            {teacher.total_classes || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>담당 {terms.GROUP_LABEL}</div>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-success-50)', borderRadius: 'var(--border-radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
            {teacher.total_students || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>담당 {terms.PERSON_LABEL_PRIMARY}</div>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-warning-50)', borderRadius: 'var(--border-radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
            {teacher.main_teacher_classes || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{terms.HOMEROOM_TEACHER}</div>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-gray-100)', borderRadius: 'var(--border-radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-secondary)' }}>
            {teacher.assistant_classes || 0}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{terms.ASSISTANT_TEACHER}</div>
        </div>
      </div>
    </div>
  );
}
