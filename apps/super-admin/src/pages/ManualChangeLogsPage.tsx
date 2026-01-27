/**
 * 매뉴얼 변경 로그 페이지
 *
 * [불변 규칙] 매뉴얼 자동 업데이트 변경 내용 검토/승인
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { useState, useEffect, useCallback } from 'react';
import { Button, Input } from '@ui-core/react';
import { createClient } from '@supabase/supabase-js';
import { Check, X, Eye, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Play } from 'lucide-react';

// 간단한 word-level diff 구현
interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

function diffWords(oldText: string, newText: string): DiffPart[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // 간단한 LCS 기반 diff
  const result: DiffPart[] = [];
  let i = 0, j = 0;

  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      // 남은 새 단어들은 추가됨
      result.push({ value: newWords.slice(j).join(''), added: true });
      break;
    }
    if (j >= newWords.length) {
      // 남은 이전 단어들은 삭제됨
      result.push({ value: oldWords.slice(i).join(''), removed: true });
      break;
    }

    if (oldWords[i] === newWords[j]) {
      // 같은 단어
      result.push({ value: oldWords[i] });
      i++;
      j++;
    } else {
      // 다른 단어 - 앞쪽에 같은 단어가 있는지 찾기
      let foundInNew = -1;
      let foundInOld = -1;

      // 새 텍스트에서 현재 이전 단어를 찾기
      for (let k = j + 1; k < Math.min(j + 10, newWords.length); k++) {
        if (newWords[k] === oldWords[i]) {
          foundInNew = k;
          break;
        }
      }

      // 이전 텍스트에서 현재 새 단어를 찾기
      for (let k = i + 1; k < Math.min(i + 10, oldWords.length); k++) {
        if (oldWords[k] === newWords[j]) {
          foundInOld = k;
          break;
        }
      }

      if (foundInNew !== -1 && (foundInOld === -1 || foundInNew - j <= foundInOld - i)) {
        // 새 텍스트에 추가된 부분
        result.push({ value: newWords.slice(j, foundInNew).join(''), added: true });
        j = foundInNew;
      } else if (foundInOld !== -1) {
        // 이전 텍스트에서 삭제된 부분
        result.push({ value: oldWords.slice(i, foundInOld).join(''), removed: true });
        i = foundInOld;
      } else {
        // 둘 다 못 찾으면 현재 단어를 삭제/추가로 처리
        result.push({ value: oldWords[i], removed: true });
        result.push({ value: newWords[j], added: true });
        i++;
        j++;
      }
    }
  }

  // 연속된 같은 타입 병합
  const merged: DiffPart[] = [];
  for (const part of result) {
    const last = merged[merged.length - 1];
    if (last && last.added === part.added && last.removed === part.removed) {
      last.value += part.value;
    } else {
      merged.push({ ...part });
    }
  }

  return merged;
}

// Supabase 클라이언트 (서비스 역할)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ManualSection {
  id: string;
  title: string;
  type: string;
  intro?: string;
  features?: string[];
  stepGuides?: {
    title: string;
    steps: { step: number; content: string }[];
    alert?: { type: string; content: string };
  }[];
  screenGroups?: {
    title: string;
    items: { title: string; description: string }[];
  }[];
  technicalFeatures?: string[];
}

interface ManualChangeLog {
  id: string;
  manual_id: string;
  manual_title: string;
  change_type: 'create' | 'update' | 'delete';
  previous_content: Record<string, unknown> | null;
  new_content: Record<string, unknown>;
  diff_summary: string | null;
  trigger_type: 'auto' | 'manual' | 'ci';
  triggered_by: string | null;
  trigger_reason: string | null;
  changed_files: string[] | null;
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_CONFIG = {
  pending: { label: '검토 대기', color: 'var(--color-warning)', icon: Clock },
  approved: { label: '승인됨', color: 'var(--color-success)', icon: CheckCircle },
  rejected: { label: '거부됨', color: 'var(--color-error)', icon: XCircle },
  auto_approved: { label: '자동 승인', color: 'var(--color-info)', icon: AlertCircle },
};

const CHANGE_TYPE_LABELS = {
  create: '신규 생성',
  update: '업데이트',
  delete: '삭제',
};

const TRIGGER_TYPE_LABELS = {
  auto: '자동 감지',
  manual: '수동 실행',
  ci: 'CI/CD',
};

// Edge Function URL
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-update-check`;

interface ManualMeta {
  id: string;
  koreanName: string;
  icon: string;
  routes: string[];
  sourceFiles: string[];
}

export function ManualChangeLogsPage() {
  const [logs, setLogs] = useState<ManualChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedLog, setSelectedLog] = useState<ManualChangeLog | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // 매뉴얼 업데이트 관련 상태
  const [manualList, setManualList] = useState<ManualMeta[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string>('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);

  // 로그 목록 조회
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('manual_change_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // 매뉴얼 목록 조회
  const fetchManualList = useCallback(async () => {
    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ action: 'list' }),
      });

      const data = await response.json() as { success: boolean; manuals?: ManualMeta[]; error?: string };
      if (data.success && data.manuals) {
        setManualList(data.manuals);
      }
    } catch (err) {
      console.error('Failed to fetch manual list:', err);
    }
  }, []);

  useEffect(() => {
    void fetchManualList();
  }, [fetchManualList]);

  // 매뉴얼 업데이트 실행
  const handleManualUpdate = async () => {
    if (!selectedManualId) return;

    setUpdateLoading(true);
    setUpdateResult(null);

    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ action: 'update', manualId: selectedManualId }),
      });

      const data = await response.json() as { success: boolean; message?: string; error?: string; title?: string; sectionsCount?: number };

      if (data.success) {
        setUpdateResult({
          success: true,
          message: `${data.title} 매뉴얼이 생성되었습니다. (${data.sectionsCount}개 섹션)`,
        });
        // 로그 목록 새로고침
        void fetchLogs();
      } else {
        setUpdateResult({
          success: false,
          message: data.error || '업데이트 실패',
        });
      }
    } catch (err) {
      setUpdateResult({
        success: false,
        message: err instanceof Error ? err.message : '업데이트 중 오류 발생',
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  // 승인/거부 처리
  const handleReview = async (log: ManualChangeLog, action: 'approved' | 'rejected') => {
    setActionLoading(true);
    try {
      // 승인 시 manuals 테이블에도 저장
      if (action === 'approved' && log.new_content) {
        const newContent = log.new_content;
        const manualData = {
          id: log.manual_id,
          title: newContent.title as string,
          description: newContent.description as string,
          icon: newContent.icon as string,
          last_updated: newContent.lastUpdated as string,
          sections: newContent.sections,
          routes: manualList.find((m) => m.id === log.manual_id)?.routes || [],
          source_files: manualList.find((m) => m.id === log.manual_id)?.sourceFiles || [],
        };

        // upsert로 기존 데이터가 있으면 업데이트, 없으면 삽입
        const { error: upsertError } = await supabase
          .from('manuals')
          .upsert(manualData, { onConflict: 'id' });

        if (upsertError) {
          console.error('Manual upsert error:', upsertError);
          throw new Error(`매뉴얼 저장 실패: ${upsertError.message}`);
        }
      }

      // 변경 로그 상태 업데이트
      const { error: updateError } = await supabase
        .from('manual_change_logs')
        .update({
          status: action,
          reviewed_by: 'super-admin@samdle.com', // TODO: 실제 로그인 사용자
          reviewed_at: new Date().toISOString(),
          review_comment: reviewComment || null,
        })
        .eq('id', log.id);

      if (updateError) throw updateError;

      setSelectedLog(null);
      setReviewComment('');
      void fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 실패');
    } finally {
      setActionLoading(false);
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 텍스트 diff 하이라이트 렌더링
  const renderTextDiff = (oldText: string | undefined, newText: string | undefined, side: 'old' | 'new') => {
    if (!oldText && !newText) return null;
    if (!oldText) return <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.3)' }}>{newText}</span>;
    if (!newText) return <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.3)', textDecoration: 'line-through' }}>{oldText}</span>;

    // 텍스트가 동일하면 그냥 반환
    if (oldText === newText) return <span>{side === 'old' ? oldText : newText}</span>;

    const diff = diffWords(oldText, newText);

    return (
      <>
        {diff.map((part, i) => {
          if (part.added) {
            // 새 내용 쪽에서만 표시
            return side === 'new' ? (
              <span key={i} style={{ backgroundColor: 'rgba(34, 197, 94, 0.4)', fontWeight: 'var(--font-weight-medium)' }}>
                {part.value}
              </span>
            ) : null;
          }
          if (part.removed) {
            // 이전 내용 쪽에서만 표시
            return side === 'old' ? (
              <span key={i} style={{ backgroundColor: 'rgba(239, 68, 68, 0.4)', textDecoration: 'line-through' }}>
                {part.value}
              </span>
            ) : null;
          }
          // 변경되지 않은 부분
          return <span key={i}>{part.value}</span>;
        })}
      </>
    );
  };

  // 배열 diff (features, technicalFeatures 등)
  const renderArrayDiff = (oldArr: string[] | undefined, newArr: string[] | undefined, side: 'old' | 'new') => {
    const old = oldArr || [];
    const next = newArr || [];

    // 동일하면 그냥 렌더링
    if (JSON.stringify(old) === JSON.stringify(next)) {
      const arr = side === 'old' ? old : next;
      return (
        <ul style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
          {arr.map((item, i) => (
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{item}</li>
          ))}
        </ul>
      );
    }

    // 변경사항이 있으면 각 항목별로 비교
    const maxLen = Math.max(old.length, next.length);
    const items: React.ReactNode[] = [];

    for (let i = 0; i < maxLen; i++) {
      const oldItem = old[i];
      const newItem = next[i];

      if (side === 'old') {
        if (oldItem === undefined) continue; // 새로 추가된 항목 (old에 없음)
        if (newItem === undefined) {
          // 삭제된 항목
          items.push(
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)', backgroundColor: 'rgba(239, 68, 68, 0.3)', textDecoration: 'line-through' }}>
              {oldItem}
            </li>
          );
        } else if (oldItem !== newItem) {
          // 수정된 항목
          items.push(
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>
              {renderTextDiff(oldItem, newItem, 'old')}
            </li>
          );
        } else {
          // 동일한 항목
          items.push(
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{oldItem}</li>
          );
        }
      } else {
        if (newItem === undefined) continue; // 삭제된 항목 (new에 없음)
        if (oldItem === undefined) {
          // 새로 추가된 항목
          items.push(
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)', backgroundColor: 'rgba(34, 197, 94, 0.3)' }}>
              {newItem}
            </li>
          );
        } else if (oldItem !== newItem) {
          // 수정된 항목
          items.push(
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>
              {renderTextDiff(oldItem, newItem, 'new')}
            </li>
          );
        } else {
          // 동일한 항목
          items.push(
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{newItem}</li>
          );
        }
      }
    }

    return items.length > 0 ? (
      <ul style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>{items}</ul>
    ) : null;
  };

  // 섹션이 실제로 변경되었는지 체크
  const isSectionChanged = (prevSection: ManualSection | undefined, nextSection: ManualSection | undefined): boolean => {
    if (!prevSection || !nextSection) return true;
    return JSON.stringify(prevSection) !== JSON.stringify(nextSection);
  };

  // 섹션 내용 비교 렌더링 (diff 하이라이트 포함)
  const renderSectionContentWithDiff = (
    prevSection: ManualSection | undefined,
    nextSection: ManualSection | undefined,
    side: 'old' | 'new'
  ) => {
    const section = side === 'old' ? prevSection : nextSection;
    if (!section) return <span style={{ color: 'var(--color-text-tertiary)' }}>내용 없음</span>;

    const items: React.ReactNode[] = [];
    const isChanged = isSectionChanged(prevSection, nextSection);

    // intro 비교
    if (section.intro || (side === 'new' && prevSection?.intro)) {
      const oldIntro = prevSection?.intro;
      const newIntro = nextSection?.intro;

      if (isChanged && oldIntro !== newIntro) {
        items.push(
          <p key="intro" style={{ margin: 'var(--spacing-xs) 0', color: 'var(--color-text-secondary)' }}>
            {renderTextDiff(oldIntro, newIntro, side)}
          </p>
        );
      } else if (section.intro) {
        items.push(
          <p key="intro" style={{ margin: 'var(--spacing-xs) 0', color: 'var(--color-text-secondary)' }}>
            {section.intro}
          </p>
        );
      }
    }

    // features 비교
    if (section.features?.length || prevSection?.features?.length || nextSection?.features?.length) {
      const oldFeatures = prevSection?.features;
      const newFeatures = nextSection?.features;

      if (isChanged && JSON.stringify(oldFeatures) !== JSON.stringify(newFeatures)) {
        items.push(
          <div key="features">{renderArrayDiff(oldFeatures, newFeatures, side)}</div>
        );
      } else if (section.features?.length) {
        items.push(
          <ul key="features" style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
            {section.features.map((f, i) => (
              <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{f}</li>
            ))}
          </ul>
        );
      }
    }

    // stepGuides 비교
    if (section.stepGuides?.length) {
      const oldGuides = prevSection?.stepGuides;
      const newGuides = nextSection?.stepGuides;
      const guidesChanged = JSON.stringify(oldGuides) !== JSON.stringify(newGuides);

      items.push(
        <div key="steps" style={{ marginTop: 'var(--spacing-xs)' }}>
          {section.stepGuides.map((guide, gi) => {
            const oldGuide = oldGuides?.[gi];
            const newGuide = newGuides?.[gi];
            const guideChanged = guidesChanged && JSON.stringify(oldGuide) !== JSON.stringify(newGuide);

            return (
              <div key={gi} style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong style={{ fontSize: 'var(--font-size-xs)' }}>
                  {guideChanged && oldGuide?.title !== newGuide?.title
                    ? renderTextDiff(oldGuide?.title, newGuide?.title, side)
                    : guide.title}
                </strong>
                <ol style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
                  {guide.steps.map((step, si) => {
                    const oldStep = oldGuide?.steps?.[si];
                    const newStep = newGuide?.steps?.[si];
                    const stepChanged = guideChanged && oldStep?.content !== newStep?.content;

                    return (
                      <li key={step.step} style={{ marginBottom: '2px' }}>
                        {stepChanged
                          ? renderTextDiff(oldStep?.content, newStep?.content, side)
                          : step.content}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      );
    }

    // screenGroups 비교
    if (section.screenGroups?.length) {
      const oldGroups = prevSection?.screenGroups;
      const newGroups = nextSection?.screenGroups;
      const groupsChanged = JSON.stringify(oldGroups) !== JSON.stringify(newGroups);

      items.push(
        <div key="screens" style={{ marginTop: 'var(--spacing-xs)' }}>
          {section.screenGroups.map((group, gi) => {
            const oldGroup = oldGroups?.[gi];
            const newGroup = newGroups?.[gi];
            const groupChanged = groupsChanged && JSON.stringify(oldGroup) !== JSON.stringify(newGroup);

            return (
              <div key={gi} style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong style={{ fontSize: 'var(--font-size-xs)' }}>
                  {groupChanged && oldGroup?.title !== newGroup?.title
                    ? renderTextDiff(oldGroup?.title, newGroup?.title, side)
                    : group.title}
                </strong>
                <ul style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
                  {group.items.map((item, ii) => {
                    const oldItem = oldGroup?.items?.[ii];
                    const newItem = newGroup?.items?.[ii];
                    const itemChanged = groupChanged && (oldItem?.title !== newItem?.title || oldItem?.description !== newItem?.description);

                    return (
                      <li key={ii} style={{ marginBottom: '2px' }}>
                        <strong>
                          {itemChanged && oldItem?.title !== newItem?.title
                            ? renderTextDiff(oldItem?.title, newItem?.title, side)
                            : item.title}:
                        </strong>{' '}
                        {itemChanged && oldItem?.description !== newItem?.description
                          ? renderTextDiff(oldItem?.description, newItem?.description, side)
                          : item.description}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      );
    }

    // technicalFeatures 비교
    if (section.technicalFeatures?.length || prevSection?.technicalFeatures?.length || nextSection?.technicalFeatures?.length) {
      const oldFeatures = prevSection?.technicalFeatures;
      const newFeatures = nextSection?.technicalFeatures;

      if (isChanged && JSON.stringify(oldFeatures) !== JSON.stringify(newFeatures)) {
        items.push(
          <div key="technical" style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
            {renderArrayDiff(oldFeatures, newFeatures, side)}
          </div>
        );
      } else if (section.technicalFeatures?.length) {
        items.push(
          <ul key="technical" style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
            {section.technicalFeatures.map((f, i) => (
              <li key={i} style={{ marginBottom: 'var(--spacing-xs)', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>{f}</li>
            ))}
          </ul>
        );
      }
    }

    return items.length > 0 ? items : <span style={{ color: 'var(--color-text-tertiary)' }}>내용 없음</span>;
  };

  // 섹션 내용 렌더링 헬퍼
  const renderSectionContent = (section: ManualSection) => {
    const items: React.ReactNode[] = [];

    // intro
    if (section.intro) {
      items.push(
        <p key="intro" style={{ margin: 'var(--spacing-xs) 0', color: 'var(--color-text-secondary)' }}>
          {section.intro}
        </p>
      );
    }

    // features
    if (section.features && section.features.length > 0) {
      items.push(
        <ul key="features" style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
          {section.features.map((f, i) => (
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>{f}</li>
          ))}
        </ul>
      );
    }

    // stepGuides
    if (section.stepGuides && section.stepGuides.length > 0) {
      items.push(
        <div key="steps" style={{ marginTop: 'var(--spacing-xs)' }}>
          {section.stepGuides.map((guide, gi) => (
            <div key={gi} style={{ marginBottom: 'var(--spacing-sm)' }}>
              <strong style={{ fontSize: 'var(--font-size-xs)' }}>{guide.title}</strong>
              <ol style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
                {guide.steps.map((step) => (
                  <li key={step.step} style={{ marginBottom: '2px' }}>{step.content}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      );
    }

    // screenGroups (화면 뜯어보기)
    if (section.screenGroups && section.screenGroups.length > 0) {
      items.push(
        <div key="screens" style={{ marginTop: 'var(--spacing-xs)' }}>
          {section.screenGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 'var(--spacing-sm)' }}>
              <strong style={{ fontSize: 'var(--font-size-xs)' }}>{group.title}</strong>
              <ul style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
                {group.items.map((item, ii) => (
                  <li key={ii} style={{ marginBottom: '2px' }}>
                    <strong>{item.title}:</strong> {item.description}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    // technicalFeatures (기술적 특징)
    if (section.technicalFeatures && section.technicalFeatures.length > 0) {
      items.push(
        <ul key="technical" style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
          {section.technicalFeatures.map((f, i) => (
            <li key={i} style={{ marginBottom: 'var(--spacing-xs)', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>{f}</li>
          ))}
        </ul>
      );
    }

    return items.length > 0 ? items : <span style={{ color: 'var(--color-text-tertiary)' }}>내용 없음</span>;
  };

  // 변경 내용 비교 뷰어
  const renderDiffViewer = (log: ManualChangeLog) => {
    const prev = log.previous_content;
    const next = log.new_content;

    // sections 비교
    const prevSections = (prev?.sections as ManualSection[]) || [];
    const nextSections = (next?.sections as ManualSection[]) || [];

    // 섹션 ID로 매핑
    const prevSectionMap = new Map(prevSections.map((s) => [s.id, s]));
    const nextSectionMap = new Map(nextSections.map((s) => [s.id, s]));

    // 모든 섹션 ID 수집
    const allSectionIds = new Set([...prevSectionMap.keys(), ...nextSectionMap.keys()]);

    return (
      <div style={{ marginTop: 'var(--spacing-md)' }}>
        {/* 요약 정보 */}
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ flex: 1, padding: 'var(--spacing-md)', backgroundColor: 'var(--color-error-bg)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ margin: 0, marginBottom: 'var(--spacing-sm)', color: 'var(--color-error)' }}>이전 내용</h4>
            {prev ? (
              <div style={{ fontSize: 'var(--font-size-sm)' }}>
                <p><strong>제목:</strong> {prev.title as string}</p>
                <p><strong>설명:</strong> {prev.description as string}</p>
                <p><strong>섹션 수:</strong> {prevSections.length}개</p>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-tertiary)' }}>신규 생성 (이전 내용 없음)</p>
            )}
          </div>

          <div style={{ flex: 1, padding: 'var(--spacing-md)', backgroundColor: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ margin: 0, marginBottom: 'var(--spacing-sm)', color: 'var(--color-success)' }}>새 내용</h4>
            <div style={{ fontSize: 'var(--font-size-sm)' }}>
              <p><strong>제목:</strong> {next.title as string}</p>
              <p><strong>설명:</strong> {next.description as string}</p>
              <p><strong>섹션 수:</strong> {nextSections.length}개</p>
            </div>
          </div>
        </div>

        {/* 섹션별 상세 비교 */}
        <div style={{ border: 'var(--border-width-thin) solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)', backgroundColor: 'var(--color-gray-100)', fontWeight: 'var(--font-weight-semibold)', borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)' }}>
            섹션별 상세 비교
          </div>
          {Array.from(allSectionIds).map((sectionId) => {
            const prevSection = prevSectionMap.get(sectionId);
            const nextSection = nextSectionMap.get(sectionId);
            const isAdded = !prevSection && nextSection;
            const isRemoved = prevSection && !nextSection;
            const isModified = prevSection && nextSection;
            const hasActualChanges = isModified && isSectionChanged(prevSection, nextSection);

            return (
              <div
                key={sectionId}
                style={{
                  borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
                }}
              >
                {/* 섹션 헤더 */}
                <div
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    backgroundColor: isAdded ? 'var(--color-success-bg)' : isRemoved ? 'var(--color-error-bg)' : hasActualChanges ? 'var(--color-warning-bg)' : 'var(--color-white)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                  }}
                >
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    padding: '2px var(--spacing-xs)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isAdded ? 'var(--color-success)' : isRemoved ? 'var(--color-error)' : hasActualChanges ? 'var(--color-warning)' : 'var(--color-gray-400)',
                    color: 'var(--color-white)',
                  }}>
                    {isAdded ? '추가' : isRemoved ? '삭제' : hasActualChanges ? '수정됨' : '동일'}
                  </span>
                  <strong>{nextSection?.title || prevSection?.title}</strong>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    ({sectionId})
                  </span>
                </div>

                {/* 섹션 내용 비교 */}
                {isModified && (
                  <div style={{ display: 'flex', fontSize: 'var(--font-size-sm)' }}>
                    {/* 이전 내용 */}
                    <div style={{ flex: 1, padding: 'var(--spacing-sm) var(--spacing-md)', backgroundColor: 'var(--color-error-bg)', borderRight: 'var(--border-width-thin) solid var(--color-gray-200)' }}>
                      {renderSectionContentWithDiff(prevSection, nextSection, 'old')}
                    </div>
                    {/* 새 내용 */}
                    <div style={{ flex: 1, padding: 'var(--spacing-sm) var(--spacing-md)', backgroundColor: 'var(--color-success-bg)' }}>
                      {renderSectionContentWithDiff(prevSection, nextSection, 'new')}
                    </div>
                  </div>
                )}

                {/* 추가된 섹션 */}
                {isAdded && nextSection && (
                  <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)', backgroundColor: 'var(--color-success-bg)', fontSize: 'var(--font-size-sm)' }}>
                    {renderSectionContent(nextSection)}
                  </div>
                )}

                {/* 삭제된 섹션 */}
                {isRemoved && prevSection && (
                  <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)', backgroundColor: 'var(--color-error-bg)', fontSize: 'var(--font-size-sm)', textDecoration: 'line-through', opacity: 0.7 }}>
                    {renderSectionContent(prevSection)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ margin: 0, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-2xl)' }}>
          매뉴얼 변경 로그
        </h1>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          AI가 자동 생성한 매뉴얼 변경 내용을 검토하고 승인/거부할 수 있습니다.
        </p>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
        {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus(status)}
          >
            {status === 'all' ? '전체' : STATUS_CONFIG[status].label}
            {status === 'pending' && logs.filter(l => l.status === 'pending').length > 0 && (
              <span style={{
                marginLeft: 'var(--spacing-xs)',
                backgroundColor: 'var(--color-error)',
                color: 'var(--color-white)',
                borderRadius: 'var(--radius-full)',
                padding: '0 var(--spacing-xs)',
                fontSize: 'var(--font-size-xs)',
              }}>
                {logs.filter(l => l.status === 'pending').length}
              </span>
            )}
          </Button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Button
            variant="solid"
            size="sm"
            onClick={() => setShowUpdateModal(true)}
          >
            <Play size={14} style={{ marginRight: 'var(--spacing-xs)' }} />
            매뉴얼 업데이트 실행
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchLogs()}
          >
            <RefreshCw size={14} style={{ marginRight: 'var(--spacing-xs)' }} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 매뉴얼 업데이트 모달 */}
      {showUpdateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--overlay-background)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            if (!updateLoading) {
              setShowUpdateModal(false);
              setUpdateResult(null);
              setSelectedManualId('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-xl)',
              width: '500px',
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, marginBottom: 'var(--spacing-lg)' }}>매뉴얼 업데이트 실행</h2>

            {updateResult ? (
              <div>
                <div
                  style={{
                    padding: 'var(--spacing-lg)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: updateResult.success ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                    color: updateResult.success ? 'var(--color-success)' : 'var(--color-error)',
                    marginBottom: 'var(--spacing-lg)',
                  }}
                >
                  {updateResult.success ? (
                    <CheckCircle size={20} style={{ marginRight: 'var(--spacing-sm)', verticalAlign: 'middle' }} />
                  ) : (
                    <XCircle size={20} style={{ marginRight: 'var(--spacing-sm)', verticalAlign: 'middle' }} />
                  )}
                  {updateResult.message}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="solid"
                    onClick={() => {
                      setShowUpdateModal(false);
                      setUpdateResult(null);
                      setSelectedManualId('');
                    }}
                  >
                    닫기
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                  AI를 사용하여 매뉴얼을 자동 생성합니다. 생성된 매뉴얼은 검토 대기 상태로 등록됩니다.
                </p>

                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'var(--font-weight-medium)' }}>
                    업데이트할 매뉴얼 선택
                  </label>
                  <select
                    value={selectedManualId}
                    onChange={(e) => setSelectedManualId(e.target.value)}
                    disabled={updateLoading}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      border: 'var(--border-width-thin) solid var(--color-gray-300)',
                      fontSize: 'var(--font-size-md)',
                    }}
                  >
                    <option value="">선택하세요</option>
                    {manualList.map((manual) => (
                      <option key={manual.id} value={manual.id}>
                        {manual.koreanName} ({manual.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowUpdateModal(false);
                      setSelectedManualId('');
                    }}
                    disabled={updateLoading}
                  >
                    취소
                  </Button>
                  <Button
                    variant="solid"
                    onClick={() => void handleManualUpdate()}
                    disabled={!selectedManualId || updateLoading}
                  >
                    {updateLoading ? (
                      <>
                        <RefreshCw size={14} style={{ marginRight: 'var(--spacing-xs)', animation: 'spin 1s linear infinite' }} />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Play size={14} style={{ marginRight: 'var(--spacing-xs)' }} />
                        업데이트 실행
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-error-bg)',
          color: 'var(--color-error)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-lg)',
        }}>
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && logs.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-2xl)',
          color: 'var(--color-text-secondary)',
          backgroundColor: 'var(--color-gray-50)',
          borderRadius: 'var(--radius-lg)',
        }}>
          {filterStatus === 'all'
            ? '아직 매뉴얼 변경 로그가 없습니다.'
            : `${STATUS_CONFIG[filterStatus as keyof typeof STATUS_CONFIG].label} 상태의 로그가 없습니다.`
          }
        </div>
      )}

      {/* 로그 목록 */}
      {!loading && logs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {logs.map((log) => {
            const StatusIcon = STATUS_CONFIG[log.status].icon;
            const isSelected = selectedLog?.id === log.id;

            return (
              <div
                key={log.id}
                style={{
                  border: 'var(--border-width-thin) solid var(--color-gray-200)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  backgroundColor: 'var(--color-white)',
                }}
              >
                {/* 로그 헤더 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    borderBottom: isSelected ? 'var(--border-width-thin) solid var(--color-gray-200)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedLog(isSelected ? null : log)}
                >
                  {/* 상태 아이콘 */}
                  <StatusIcon
                    size={20}
                    style={{ color: STATUS_CONFIG[log.status].color, flexShrink: 0 }}
                  />

                  {/* 매뉴얼 정보 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                      {log.manual_title}
                      <span style={{
                        marginLeft: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 'var(--font-weight-normal)',
                      }}>
                        ({log.manual_id})
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {CHANGE_TYPE_LABELS[log.change_type]} · {TRIGGER_TYPE_LABELS[log.trigger_type]}
                      {log.trigger_reason && ` · ${log.trigger_reason}`}
                    </div>
                  </div>

                  {/* 시간 및 상태 */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {formatDate(log.created_at)}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: STATUS_CONFIG[log.status].color,
                      fontWeight: 'var(--font-weight-medium)',
                    }}>
                      {STATUS_CONFIG[log.status].label}
                    </div>
                  </div>

                  {/* 펼치기 아이콘 */}
                  <Eye
                    size={18}
                    style={{
                      color: 'var(--color-text-tertiary)',
                      transform: isSelected ? 'rotate(0deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </div>

                {/* 상세 내용 (펼쳐진 상태) */}
                {isSelected && (
                  <div style={{ padding: 'var(--spacing-lg)', backgroundColor: 'var(--color-gray-50)' }}>
                    {/* 변경된 파일 */}
                    {log.changed_files && log.changed_files.length > 0 && (
                      <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <strong>변경된 소스 파일:</strong>
                        <ul style={{ margin: 'var(--spacing-xs) 0 0', paddingLeft: 'var(--spacing-lg)' }}>
                          {log.changed_files.map((file, i) => (
                            <li key={i} style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'monospace' }}>{file}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 변경 요약 */}
                    {log.diff_summary && (
                      <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <strong>변경 요약:</strong>
                        <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)' }}>{log.diff_summary}</p>
                      </div>
                    )}

                    {/* Diff 뷰어 */}
                    {renderDiffViewer(log)}

                    {/* 검토 정보 (이미 검토된 경우) */}
                    {log.reviewed_at && (
                      <div style={{
                        marginTop: 'var(--spacing-lg)',
                        padding: 'var(--spacing-md)',
                        backgroundColor: 'var(--color-white)',
                        borderRadius: 'var(--radius-md)',
                        border: 'var(--border-width-thin) solid var(--color-gray-200)',
                      }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          검토자: {log.reviewed_by} · {formatDate(log.reviewed_at)}
                        </div>
                        {log.review_comment && (
                          <div style={{ marginTop: 'var(--spacing-xs)' }}>
                            코멘트: {log.review_comment}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 검토 액션 (pending 상태인 경우) */}
                    {log.status === 'pending' && (
                      <div style={{ marginTop: 'var(--spacing-lg)' }}>
                        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                          <Input
                            placeholder="검토 코멘트 (선택)"
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                          <Button
                            variant="solid"
                            onClick={() => void handleReview(log, 'approved')}
                            disabled={actionLoading}
                            style={{ backgroundColor: 'var(--color-success)' }}
                          >
                            <Check size={16} style={{ marginRight: 'var(--spacing-xs)' }} />
                            승인
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void handleReview(log, 'rejected')}
                            disabled={actionLoading}
                            style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                          >
                            <X size={16} style={{ marginRight: 'var(--spacing-xs)' }} />
                            거부
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
