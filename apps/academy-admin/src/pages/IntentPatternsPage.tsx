// LAYER: UI_PAGE
/**
 * Intent 패턴 관리 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음
 *
 * 기능:
 * 1. 저품질 패턴 확인 (주 1회)
 * 2. 신규 패턴 추가 (월 1회)
 * 3. 패턴 수정/삭제
 * 4. 전체 품질 검토 (분기 1회)
 */
import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Badge, Input, useModal } from '@ui-core/react';
import { apiClient } from '@api-sdk/core';
import { useIndustryTerms } from '@hooks/use-industry-terms';

interface IntentPattern {
  id: number;
  pattern: string;
  normalized_pattern: string;
  tool_name: string;
  action: string | null;
  confidence: number;
  usage_count: number;
  success_count: number;
  last_used_at: string | null;
  created_at: string;
}

export const IntentPatternsPage: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const [patterns, setPatterns] = useState<IntentPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low_quality' | 'unused'>('all');
  const terms = useIndustryTerms();

  // 패턴 목록 조회
  const loadPatterns = useCallback(async () => {
    setLoading(true);
    try {
      // 필터 조건 설정
      const filters: Record<string, unknown> = {};
      if (filter === 'low_quality') {
        filters.usage_count = { gt: 10 };
        filters.confidence = { lt: 0.5 };
      } else if (filter === 'unused') {
        filters.usage_count = 0;
      }

      const response = await apiClient.get<IntentPattern>('chatops_intent_patterns', {
        filters,
        orderBy: { column: 'confidence', ascending: false },
      });

      if (!response.success) {
        throw new Error(response.error?.message || '패턴 조회 실패');
      }
      setPatterns(response.data || []);
    } catch (error) {
      console.error('패턴 조회 실패:', error);
      showAlert('패턴 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, showAlert]);

  // 패턴 삭제
  const deletePattern = async (id: number) => {
    const confirmed = await showConfirm('정말 삭제하시겠습니까?', '패턴 삭제');
    if (!confirmed) return;

    try {
      const response = await apiClient.delete('chatops_intent_patterns', String(id));

      if (!response.success) {
        throw new Error(response.error?.message || '삭제 실패');
      }
      showAlert('삭제되었습니다.');
      void loadPatterns();
    } catch (error) {
      console.error('삭제 실패:', error);
      showAlert('삭제에 실패했습니다.');
    }
  };

  // 신규 패턴 추가
  const [newPattern, setNewPattern] = useState({
    pattern: '',
    tool_name: '',
    action: '',
    confidence: 0.8,
  });

  const addPattern = async () => {
    if (!newPattern.pattern || !newPattern.tool_name) {
      showAlert('패턴과 Tool 이름은 필수입니다.');
      return;
    }

    try {
      const response = await apiClient.callRPC('learn_intent_pattern', {
        user_query: newPattern.pattern,
        tool_name: newPattern.tool_name,
        action: newPattern.action || null,
        initial_confidence: newPattern.confidence,
      });

      if (!response.success) {
        throw new Error(response.error?.message || '패턴 추가 실패');
      }
      showAlert('패턴이 추가되었습니다.');
      setNewPattern({ pattern: '', tool_name: '', action: '', confidence: 0.8 });
      void loadPatterns();
    } catch (error) {
      console.error('추가 실패:', error);
      showAlert('패턴 추가에 실패했습니다.');
    }
  };

  useEffect(() => {
    void loadPatterns();
  }, [filter, loadPatterns]);

  // 성공률 계산
  const getSuccessRate = (pattern: IntentPattern) => {
    if (pattern.usage_count === 0) return 0;
    return ((pattern.success_count / pattern.usage_count) * 100).toFixed(1);
  };

  // Confidence 색상
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.5) return 'blue';
    return 'gray';
  };

  return (
    <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-xs)' }}>
          Intent 패턴 관리
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          ChatOps AI의 질문 패턴과 Tool 매핑을 관리합니다.
        </p>
      </div>

      {/* 신규 패턴 추가 섹션 */}
      <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
          신규 패턴 추가
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 'var(--spacing-md)', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              질문 패턴
            </label>
            <Input
              value={newPattern.pattern}
              onChange={(e) => setNewPattern({ ...newPattern, pattern: e.target.value })}
              placeholder={`예: ${terms.PERSON_LABEL_PRIMARY} 명단 보기`}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              Tool 이름
            </label>
            <select
              value={newPattern.tool_name}
              onChange={(e) => setNewPattern({ ...newPattern, tool_name: e.target.value })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--color-gray-300)',
              }}
            >
              <option value="">선택</option>
              <option value="manage_student">manage_student</option>
              <option value="query_attendance">query_attendance</option>
              <option value="query_billing">query_billing</option>
              <option value="send_message">send_message</option>
              <option value="query_class">query_class</option>
              <option value="get_report">get_report</option>
              <option value="discharge">discharge</option>
              <option value="pause">pause</option>
              <option value="resume">resume</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              Action (선택)
            </label>
            <Input
              value={newPattern.action}
              onChange={(e) => setNewPattern({ ...newPattern, action: e.target.value })}
              placeholder="search"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              신뢰도
            </label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={newPattern.confidence}
              onChange={(e) => setNewPattern({ ...newPattern, confidence: parseFloat(e.target.value) })}
            />
          </div>
          <Button onClick={addPattern} variant="solid">
            추가
          </Button>
        </div>
      </Card>

      {/* 필터 및 액션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <Button
            variant={filter === 'all' ? 'solid' : 'outline'}
            onClick={() => setFilter('all')}
          >
            전체
          </Button>
          <Button
            variant={filter === 'low_quality' ? 'solid' : 'outline'}
            onClick={() => setFilter('low_quality')}
          >
            저품질 패턴
          </Button>
          <Button
            variant={filter === 'unused' ? 'solid' : 'outline'}
            onClick={() => setFilter('unused')}
          >
            미사용 패턴
          </Button>
        </div>
        <Button onClick={loadPatterns} disabled={loading}>
          {loading ? '조회 중...' : '새로고침'}
        </Button>
      </div>

      {/* 패턴 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {patterns.map((pattern) => (
          <Card key={pattern.id} padding="md" style={{ borderLeft: `4px solid var(--color-${getConfidenceColor(pattern.confidence)})` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--spacing-md)', alignItems: 'center' }}>
              {/* 패턴 정보 */}
              <div>
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                  {pattern.pattern}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  <Badge variant="outline" color="blue">{pattern.tool_name}</Badge>
                  {pattern.action && (
                    <Badge variant="outline" color="gray" style={{ marginLeft: 'var(--spacing-xs)' }}>
                      {pattern.action}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 통계 */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  사용 횟수
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {pattern.usage_count}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  성공률
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {getSuccessRate(pattern)}%
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  신뢰도
                </div>
                <Badge variant="solid" color={getConfidenceColor(pattern.confidence)}>
                  {(pattern.confidence * 100).toFixed(0)}%
                </Badge>
              </div>

              {/* 액션 */}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deletePattern(pattern.id)}
                  style={{ color: 'var(--color-error)' }}
                >
                  삭제
                </Button>
              </div>
            </div>

            {/* 추가 정보 */}
            {pattern.last_used_at && (
              <div style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                마지막 사용: {new Date(pattern.last_used_at).toLocaleString('ko-KR')}
              </div>
            )}
          </Card>
        ))}

        {patterns.length === 0 && !loading && (
          <Card padding="xl" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {filter === 'low_quality' && '저품질 패턴이 없습니다.'}
              {filter === 'unused' && '미사용 패턴이 없습니다.'}
              {filter === 'all' && '등록된 패턴이 없습니다.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
