/**
 * 알림톡 설정 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 채널 인증, 템플릿 CRUD, 발송 내역, 잔여 포인트 관리
 */

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ErrorBoundary,
  useModal,
  Container,
  Card,
  PageHeader,
  Button,
  Input,
  Badge,
  DataTable,
  type DataTableColumn,
  EmptyState,
  useResponsiveMode,
  isMobile,
  SubSidebar,
} from '@ui-core/react';
import {
  useAlimtalkSettings,
  type AlimtalkTemplateInfo,
  type AlimtalkProfile,
  type AlimtalkHistoryItem,
  type AddTemplateRequest,
  type TemplateMessageType,
  type EmphasisType,
} from '@hooks/use-alimtalk';
import { useIndustryTerms } from '@hooks/use-industry-terms';
// [SSOT] Barrel export를 통한 통합 import
import { ALIMTALK_SUB_MENU_ITEMS, DEFAULT_ALIMTALK_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { AlimtalkSubMenuId } from '../constants';
import {
  MessageSquare,
  Settings,
  FileText,
  Clock,
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// ============================================================================
// 탭 타입 정의
// ============================================================================

// Tab 관련 타입은 SubSidebar 적용으로 제거됨 (ALIMTALK_SUB_MENU_ITEMS 사용)
void [Settings, MessageSquare, FileText, Clock, CreditCard]; // 아이콘 타입 보존

// ============================================================================
// 상태 표시 컴포넌트
// ============================================================================

const StatusTab = memo(function StatusTab() {
  const { status, isLoading, error, fetchStatus } = useAlimtalkSettings();
  // React Query가 자동으로 데이터 fetch - useEffect 불필요!

  if (isLoading) {
    return <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-error)' }}>
        오류: {error.message}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <Card>
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>알림톡 연동 상태</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            {status?.configured ? (
              <>
                <CheckCircle size={24} color="var(--color-success)" />
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>연동 완료</span>
              </>
            ) : (
              <>
                <XCircle size={24} color="var(--color-error)" />
                <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>연동 필요</span>
              </>
            )}
          </div>
          {status?.configured && (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <Badge color={status.testMode ? 'warning' : 'success'}>
                {status.testMode ? '테스트 모드' : '운영 모드'}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>환경 변수 설정 안내</h3>
          <p style={{ margin: 0, marginBottom: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
            알림톡을 사용하려면 다음 환경 변수를 설정해야 합니다:
          </p>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            <li><code>KAKAO_ALIGO_API_KEY</code> - 알리고 API Key</li>
            <li><code>KAKAO_ALIGO_USER_ID</code> - 알리고 User ID</li>
            <li><code>KAKAO_ALIGO_SENDERKEY</code> - 카카오 발신 프로필 키</li>
            <li><code>ALIGO_SENDER</code> - SMS 발신 번호 (대체 발송용)</li>
            <li><code>KAKAO_ALIGO_TEST_MODE</code> - 테스트 모드 (true/false)</li>
          </ul>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={fetchStatus} disabled={isLoading}>
          <RefreshCw size={16} style={{ marginRight: 'var(--spacing-xs)' }} />
          새로고침
        </Button>
      </div>
    </div>
  );
});

// ============================================================================
// 채널 관리 컴포넌트
// ============================================================================

const ChannelsTab = memo(function ChannelsTab() {
  const { profiles, isLoading, error, fetchProfiles, requestProfileAuth } = useAlimtalkSettings();
  const { showAlert, showConfirm } = useModal();
  const [plusid, setPlusid] = useState('');
  const [phonenumber, setPhonenumber] = useState('');
  // React Query가 자동으로 데이터 fetch - useEffect 불필요!

  const handleAuthRequest = async () => {
    if (!plusid || !phonenumber) {
      showAlert('카카오채널 ID와 전화번호를 입력해주세요.', '오류');
      return;
    }

    const confirmed = await showConfirm(
      '채널 인증 요청',
      `${plusid} 채널에 대해 인증 요청을 보내시겠습니까?\n입력한 전화번호로 카카오톡 인증 메시지가 발송됩니다.`
    );

    if (!confirmed) return;

    const result = await requestProfileAuth(plusid, phonenumber);
    if (result.success) {
      void showAlert(result.message || '인증 요청이 전송되었습니다.', '성공');
      setPlusid('');
      setPhonenumber('');
      void fetchProfiles();
    } else {
      void showAlert(result.message || '인증 요청에 실패했습니다.', '오류');
    }
  };

  const columns: DataTableColumn<AlimtalkProfile>[] = useMemo(() => [
    {
      key: 'channelName',
      label: '채널명',
      render: (_value: unknown, row: AlimtalkProfile) => row.channelName || '-',
    },
    {
      key: 'senderKey',
      label: 'Sender Key',
      render: (_value: unknown, row: AlimtalkProfile) => (
        <code style={{ fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-secondary)', padding: 'var(--spacing-xxs) var(--spacing-xs)', borderRadius: 'var(--border-radius-sm)' }}>
          {row.senderKey.substring(0, 20)}...
        </code>
      ),
    },
    {
      key: 'status',
      label: '상태',
      render: (_value: unknown, row: AlimtalkProfile) => (
        <Badge color={row.status === 'A' ? 'success' : row.status === 'R' ? 'warning' : 'secondary'}>
          {row.status === 'A' ? '승인' : row.status === 'R' ? '대기' : row.status}
        </Badge>
      ),
    },
    {
      key: 'alimUseYn',
      label: '알림톡 사용',
      render: (_value: unknown, row: AlimtalkProfile) => (
        <Badge color={row.alimUseYn === 'Y' ? 'success' : 'secondary'}>
          {row.alimUseYn === 'Y' ? '사용' : '미사용'}
        </Badge>
      ),
    },
    {
      key: 'regDate',
      label: '등록일',
      render: (_value: unknown, row: AlimtalkProfile) => row.regDate || '-',
    },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <Card>
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>채널 인증 요청</h3>
          <p style={{ margin: 0, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
            알림톡을 발송하려면 카카오채널 인증이 필요합니다.
          </p>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <Input
              placeholder="카카오채널 ID (@로 시작)"
              value={plusid}
              onChange={(e) => setPlusid(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <Input
              placeholder="인증받을 전화번호"
              value={phonenumber}
              onChange={(e) => setPhonenumber(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <Button onClick={handleAuthRequest} disabled={isLoading}>
              <Send size={16} style={{ marginRight: 'var(--spacing-xs)' }} />
              인증 요청
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h3 style={{ margin: 0 }}>등록된 채널 목록</h3>
            <Button variant="outline" onClick={fetchProfiles} disabled={isLoading}>
              <RefreshCw size={16} />
            </Button>
          </div>
          {error ? (
            <div style={{ color: 'var(--color-error)' }}>오류: {error.message}</div>
          ) : profiles.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              message="등록된 채널이 없습니다."
            />
          ) : (
            <DataTable columns={columns} data={profiles} />
          )}
        </div>
      </Card>
    </div>
  );
});

// ============================================================================
// 템플릿 관리 컴포넌트
// ============================================================================

const TemplatesTab = memo(function TemplatesTab() {
  const terms = useIndustryTerms();
  const {
    templates,
    isLoading,
    error,
    fetchTemplates,
    addTemplate,
    modifyTemplate,
    deleteTemplate,
    requestReview,
  } = useAlimtalkSettings();
  const { showAlert, showConfirm } = useModal();
  // React Query가 자동으로 데이터 fetch - useEffect 불필요!
  const [isAdding, setIsAdding] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddTemplateRequest>({
    tpl_name: '',
    tpl_content: '',
    tpl_message_type: 'BA',
    tpl_emphasis_type: 'NONE',
  });

  const resetForm = () => {
    setFormData({
      tpl_name: '',
      tpl_content: '',
      tpl_message_type: 'BA',
      tpl_emphasis_type: 'NONE',
    });
    setIsAdding(false);
    setEditingCode(null);
  };

  const handleAdd = async () => {
    if (!formData.tpl_name || !formData.tpl_content) {
      showAlert('템플릿 이름과 내용을 입력해주세요.', '오류');
      return;
    }

    const result = await addTemplate(formData);
    if (result.success) {
      showAlert(`템플릿이 등록되었습니다. (코드: ${result.templtCode})`, '성공');
      resetForm();
    } else {
      showAlert(result.message || '템플릿 등록에 실패했습니다.', '오류');
    }
  };

  const handleModify = async () => {
    if (!editingCode || !formData.tpl_name || !formData.tpl_content) {
      showAlert('템플릿 이름과 내용을 입력해주세요.', '오류');
      return;
    }

    const result = await modifyTemplate({
      ...formData,
      tpl_code: editingCode,
    });
    if (result.success) {
      showAlert('템플릿이 수정되었습니다.', '성공');
      resetForm();
    } else {
      showAlert(result.message || '템플릿 수정에 실패했습니다.', '오류');
    }
  };

  const handleDelete = useCallback(async (tplCode: string) => {
    if (tplCode.startsWith('D') || tplCode.startsWith('P')) {
      void showAlert('공유 템플릿은 삭제할 수 없습니다.', '오류');
      return;
    }

    const confirmed = await showConfirm('템플릿 삭제', '정말 이 템플릿을 삭제하시겠습니까?');
    if (!confirmed) return;

    const result = await deleteTemplate(tplCode);
    if (result.success) {
      void showAlert('템플릿이 삭제되었습니다.', '성공');
    } else {
      void showAlert(result.message || '템플릿 삭제에 실패했습니다.', '오류');
    }
  }, [showAlert, showConfirm, deleteTemplate]);

  const handleReview = useCallback(async (tplCode: string) => {
    const confirmed = await showConfirm(
      '검수 요청',
      '템플릿 검수를 요청하시겠습니까?\n검수는 4-5일 정도 소요됩니다.'
    );
    if (!confirmed) return;

    const result = await requestReview(tplCode);
    if (result.success) {
      void showAlert('검수 요청이 완료되었습니다.', '성공');
    } else {
      void showAlert(result.message || '검수 요청에 실패했습니다.', '오류');
    }
  }, [showAlert, showConfirm, requestReview]);

  const startEdit = useCallback((template: AlimtalkTemplateInfo) => {
    setEditingCode(template.templtCode);
    setFormData({
      tpl_name: template.templtName,
      tpl_content: template.templtContent,
      tpl_message_type: template.templateMessageType || 'BA',
      tpl_emphasis_type: template.templateEmphasisType || 'NONE',
      emphasis_title: template.emphasisTitle,
      emphasis_subtitle: template.emphasisSubTitle,
      tpl_extra: template.extra,
      tpl_ad: template.ad,
    });
    setIsAdding(false);
  }, []);

  const getStatusBadge = useCallback((status: string, inspStatus?: string) => {
    if (status === 'A') return <Badge color="success">승인</Badge>;
    if (status === 'R') return <Badge color="warning">대기</Badge>;
    if (status === 'S') return <Badge color="error">중단</Badge>;
    if (inspStatus === 'REG') return <Badge color="info">검수중</Badge>;
    return <Badge color="secondary">{status}</Badge>;
  }, []);

  const columns: DataTableColumn<AlimtalkTemplateInfo>[] = useMemo(() => [
    {
      key: 'templtCode',
      label: '템플릿 코드',
      render: (_value: unknown, row: AlimtalkTemplateInfo) => (
        <code style={{ fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-secondary)', padding: 'var(--spacing-xxs) var(--spacing-xs)', borderRadius: 'var(--border-radius-sm)' }}>
          {row.templtCode}
        </code>
      ),
    },
    {
      key: 'templtName',
      label: '템플릿 이름',
      render: (_value: unknown, row: AlimtalkTemplateInfo) => row.templtName,
    },
    {
      key: 'templateMessageType',
      label: '메시지 유형',
      render: (_value: unknown, row: AlimtalkTemplateInfo) => {
        const types: Record<string, string> = {
          BA: '기본형',
          EX: '부가정보형',
          AD: '광고추가형',
          MI: '복합형',
        };
        return types[row.templateMessageType || 'BA'] || row.templateMessageType;
      },
    },
    {
      key: 'status',
      label: '상태',
      render: (_value: unknown, row: AlimtalkTemplateInfo) => getStatusBadge(row.status, row.inspStatus),
    },
    {
      key: 'cdate',
      label: '등록일',
      render: (_value: unknown, row: AlimtalkTemplateInfo) => row.cdate || '-',
    },
    {
      key: 'actions',
      label: '작업',
      render: (_value: unknown, row: AlimtalkTemplateInfo) => (
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
          <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
            <Edit size={14} />
          </Button>
          {row.status !== 'A' && !row.templtCode.startsWith('D') && !row.templtCode.startsWith('P') && (
            <Button variant="ghost" size="sm" onClick={() => handleReview(row.templtCode)}>
              <Send size={14} />
            </Button>
          )}
          {!row.templtCode.startsWith('D') && !row.templtCode.startsWith('P') && (
            <Button variant="ghost" size="sm" onClick={() => handleDelete(row.templtCode)}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      ),
    },
  ], [getStatusBadge, startEdit, handleReview, handleDelete]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {(isAdding || editingCode) && (
        <Card>
          <div style={{ padding: 'var(--spacing-lg)' }}>
            <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>
              {editingCode ? '템플릿 수정' : '템플릿 등록'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>
                  템플릿 이름 (최대 150자)
                </label>
                <Input
                  placeholder="예: 출석 알림"
                  value={formData.tpl_name}
                  onChange={(e) => setFormData({ ...formData, tpl_name: e.target.value })}
                  maxLength={150}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>
                  템플릿 내용 (최대 1000자)
                </label>
                <textarea
                  placeholder={`#{고객명}님, 오늘 ${terms.SESSION_LABEL}이 있습니다.`}
                  value={formData.tpl_content}
                  onChange={(e) => setFormData({ ...formData, tpl_content: e.target.value })}
                  maxLength={1000}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                  변수: #{'{변수명}'} 형식으로 사용 (예: #{'{고객명}'}, #{`{${terms.SESSION_LABEL}시간}`})
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>
                    메시지 유형
                  </label>
                  <select
                    value={formData.tpl_message_type}
                    onChange={(e) =>
                      setFormData({ ...formData, tpl_message_type: e.target.value as TemplateMessageType })
                    }
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <option value="BA">기본형</option>
                    <option value="EX">부가정보형</option>
                    <option value="AD">광고추가형</option>
                    <option value="MI">복합형</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>
                    강조 표기
                  </label>
                  <select
                    value={formData.tpl_emphasis_type}
                    onChange={(e) =>
                      setFormData({ ...formData, tpl_emphasis_type: e.target.value as EmphasisType })
                    }
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <option value="NONE">없음</option>
                    <option value="TEXT">텍스트</option>
                    <option value="IMAGE">이미지</option>
                    <option value="ITEM_LIST">아이템 리스트</option>
                  </select>
                </div>
              </div>
              {formData.tpl_emphasis_type === 'TEXT' && (
                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>
                      강조 제목
                    </label>
                    <Input
                      placeholder="강조 제목"
                      value={formData.emphasis_title || ''}
                      onChange={(e) => setFormData({ ...formData, emphasis_title: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>
                      강조 부제목
                    </label>
                    <Input
                      placeholder="강조 부제목"
                      value={formData.emphasis_subtitle || ''}
                      onChange={(e) => setFormData({ ...formData, emphasis_subtitle: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
                <Button variant="outline" onClick={resetForm}>
                  취소
                </Button>
                <Button onClick={editingCode ? handleModify : handleAdd} disabled={isLoading}>
                  {editingCode ? '수정' : '등록'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h3 style={{ margin: 0 }}>템플릿 목록</h3>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <Button variant="outline" onClick={() => fetchTemplates()} disabled={isLoading}>
                <RefreshCw size={16} />
              </Button>
              {!isAdding && !editingCode && (
                <Button onClick={() => setIsAdding(true)}>
                  <Plus size={16} style={{ marginRight: 'var(--spacing-xs)' }} />
                  템플릿 등록
                </Button>
              )}
            </div>
          </div>
          {error ? (
            <div style={{ color: 'var(--color-error)' }}>오류: {error.message}</div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              message="등록된 템플릿이 없습니다."
            />
          ) : (
            <DataTable columns={columns} data={templates} />
          )}
        </div>
      </Card>
    </div>
  );
});

// ============================================================================
// 발송 내역 컴포넌트
// ============================================================================

const HistoryTab = memo(function HistoryTab() {
  const { history, pagination, isLoading, error, fetchHistory, cancelScheduled } = useAlimtalkSettings();
  const { showAlert, showConfirm } = useModal();
  const [page, setPage] = useState(1);

  useEffect(() => {
    void fetchHistory({ page, limit: 20 });
  }, [fetchHistory, page]);

  const handleCancel = useCallback(async (mid: string) => {
    const confirmed = await showConfirm('예약 취소', '이 예약 발송을 취소하시겠습니까?');
    if (!confirmed) return;

    const result = await cancelScheduled(parseInt(mid, 10));
    if (result.success) {
      void showAlert('예약이 취소되었습니다.', '성공');
    } else {
      void showAlert(result.message || '예약 취소에 실패했습니다.', '오류');
    }
  }, [showConfirm, cancelScheduled, showAlert]);

  const getStateBadge = useCallback((state: string) => {
    if (state === '발송완료' || state === 'OK') return <Badge color="success">완료</Badge>;
    if (state === '예약중' || state === 'R') return <Badge color="info">예약</Badge>;
    if (state === '발송실패' || state === 'F') return <Badge color="error">실패</Badge>;
    return <Badge color="secondary">{state}</Badge>;
  }, []);

  const columns: DataTableColumn<AlimtalkHistoryItem>[] = useMemo(() => [
    {
      key: 'mid',
      label: '메시지 ID',
      render: (_value: unknown, row: AlimtalkHistoryItem) => row.mid,
    },
    {
      key: 'type',
      label: '유형',
      render: (_value: unknown, row: AlimtalkHistoryItem) => {
        const types: Record<string, string> = {
          AT: '알림톡',
          FT: '친구톡',
        };
        return types[row.type] || row.type;
      },
    },
    {
      key: 'cnt',
      label: '발송 건수',
      render: (_value: unknown, row: AlimtalkHistoryItem) => `${row.cnt}건`,
    },
    {
      key: 'state',
      label: '상태',
      render: (_value: unknown, row: AlimtalkHistoryItem) => getStateBadge(row.state),
    },
    {
      key: 'reserve',
      label: '예약일',
      render: (_value: unknown, row: AlimtalkHistoryItem) => row.reserve || '-',
    },
    {
      key: 'regdate',
      label: '등록일',
      render: (_value: unknown, row: AlimtalkHistoryItem) => row.regdate,
    },
    {
      key: 'actions',
      label: '작업',
      render: (_value: unknown, row: AlimtalkHistoryItem) => (
        row.state === '예약중' || row.state === 'R' ? (
          <Button variant="ghost" size="sm" onClick={() => handleCancel(row.mid)}>
            취소
          </Button>
        ) : null
      ),
    },
  ], [getStateBadge, handleCancel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <Card>
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h3 style={{ margin: 0 }}>발송 내역</h3>
            <Button variant="outline" onClick={() => fetchHistory({ page, limit: 20 })} disabled={isLoading}>
              <RefreshCw size={16} />
            </Button>
          </div>
          {error ? (
            <div style={{ color: 'var(--color-error)' }}>오류: {error.message}</div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={Clock}
              message="발송 내역이 없습니다."
            />
          ) : (
            <>
              <DataTable columns={columns} data={history} />
              {pagination.totalPage > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    이전
                  </Button>
                  <span style={{ padding: 'var(--spacing-sm)' }}>
                    {pagination.currentPage} / {pagination.totalPage}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPage}
                    onClick={() => setPage(page + 1)}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
});

// ============================================================================
// 잔여 포인트 컴포넌트
// ============================================================================

const PointsTab = memo(function PointsTab() {
  const { remainPoints, isLoading, error, fetchRemainPoints } = useAlimtalkSettings();
  // React Query가 자동으로 데이터 fetch - useEffect 불필요!

  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
        <Card>
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
              알림톡
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {remainPoints ? formatNumber(remainPoints.alimtalk) : '-'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>건</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
              친구톡 (텍스트)
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {remainPoints ? formatNumber(remainPoints.friendtalkText) : '-'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>건</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
              친구톡 (이미지)
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {remainPoints ? formatNumber(remainPoints.friendtalkImage) : '-'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>건</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
              친구톡 (와이드)
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {remainPoints ? formatNumber(remainPoints.friendtalkWide) : '-'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>건</div>
          </div>
        </Card>
      </div>

      {error && (
        <div style={{ color: 'var(--color-error)', textAlign: 'center' }}>
          오류: {error.message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={fetchRemainPoints} disabled={isLoading}>
          <RefreshCw size={16} style={{ marginRight: 'var(--spacing-xs)' }} />
          새로고침
        </Button>
      </div>

      <Card>
        <div style={{ padding: 'var(--spacing-lg)' }}>
          <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>포인트 충전 안내</h3>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            알림톡/친구톡 발송을 위한 포인트 충전은{' '}
            <a
              href="https://smartsms.aligo.in"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)' }}
            >
              알리고 웹사이트
            </a>
            에서 진행해주세요.
          </p>
        </div>
      </Card>
    </div>
  );
});

// ============================================================================
// 메인 페이지 컴포넌트
// ============================================================================

export function AlimtalkSettingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);

  // 서브 메뉴 상태
  const validIds = ALIMTALK_SUB_MENU_ITEMS.map(item => item.id) as readonly AlimtalkSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_ALIMTALK_SUB_MENU);

  const handleSubMenuChange = useCallback((id: AlimtalkSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_ALIMTALK_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);

  // 조건부 렌더링: 한 번에 1개 탭만 마운트
  const renderTabContent = () => {
    if (selectedSubMenu === 'status') return <StatusTab />;
    if (selectedSubMenu === 'channels') return <ChannelsTab />;
    if (selectedSubMenu === 'templates') return <TemplatesTab />;
    if (selectedSubMenu === 'history') return <HistoryTab />;
    if (selectedSubMenu === 'points') return <PointsTab />;
    return null;
  };

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', height: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김) */}
        {!isMobileMode && (
          <SubSidebar
            title="알림톡 설정"
            items={ALIMTALK_SUB_MENU_ITEMS}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            testId="alimtalk-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding="lg" style={{ flex: 1 }}>
          <PageHeader title={ALIMTALK_SUB_MENU_ITEMS.find(item => item.id === selectedSubMenu)?.label || "알림톡 설정"} />

          {renderTabContent()}
        </Container>
      </div>
    </ErrorBoundary>
  );
}
