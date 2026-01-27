import React, { useState } from 'react';
import { Button, Card, Input, Spinner, Badge, useModal } from '@ui-core/react';
import { useRecommendFilterTags, type FilterTagRecommendation } from '@hooks/use-filter-recommendation';
import { useFilterTags } from '@hooks/use-filter-tags';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { Search, Sparkles, AlertCircle } from 'lucide-react';

export interface AIFilterRecommendationProps {
  tenantId: string;
  accessToken: string;
  onApplyRecommendation: (tagIds: string[]) => void;
}

/**
 * AI 필터 태그 추천 컴포넌트 (자연어 쿼리)
 *
 * - 사용자가 자연어로 입력한 질의를 분석하여 적합한 필터 태그 추천
 * - GPT-4o-mini 사용
 * - 독립 UI (Agent Engine 연동 없음)
 */
export function AIFilterRecommendation({
  tenantId,
  accessToken,
  onApplyRecommendation,
}: AIFilterRecommendationProps) {
  const { showAlert } = useModal();
  const terms = useIndustryTerms();
  const [query, setQuery] = useState<string>('');
  const [recommendation, setRecommendation] = useState<FilterTagRecommendation | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const { mutate: recommendTags, isPending } = useRecommendFilterTags(accessToken);
  const { data: allTags } = useFilterTags();

  const handleRecommend = () => {
    if (!query.trim()) {
      showAlert('검색어를 입력해주세요.', '알림');
      return;
    }

    recommendTags(
      {
        tenantId,
        naturalLanguageQuery: query,
      },
      {
        onSuccess: (data) => {
          setRecommendation(data);
          // 자동으로 첫 번째 추천 태그 선택
          setSelectedTagId(data.tag_ids[0] || null);
        },
        onError: (error) => {
          console.error('AI 필터 추천 실패:', error);
          showAlert('AI 필터 추천에 실패했습니다. 다시 시도해주세요.', '오류');
        },
      }
    );
  };

  const handleApply = () => {
    if (recommendation && selectedTagId) {
      onApplyRecommendation([selectedTagId]);
      setRecommendation(null);
      setSelectedTagId(null);
      setQuery('');
    }
  };

  const handleTagSelection = (tagId: string) => {
    setSelectedTagId(tagId);
  };

  const getConfidenceBadgeColor = (
    confidence: 'high' | 'medium' | 'low'
  ): 'green' | 'yellow' | 'blue' => {
    switch (confidence) {
      case 'high':
        return 'green';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'blue';
    }
  };

  const getConfidenceLabel = (confidence: 'high' | 'medium' | 'low'): string => {
    switch (confidence) {
      case 'high':
        return '높음';
      case 'medium':
        return '보통';
      case 'low':
        return '낮음';
    }
  };

  return (
    <Card
      padding="lg"
      style={{
        backgroundColor: 'var(--color-purple-50)',
        borderColor: 'var(--color-purple-200)',
        borderWidth: 'var(--border-width-thin)',
        borderStyle: 'solid',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Sparkles size={20} style={{ color: 'var(--color-purple-600)' }} />
          <span
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            AI 필터 추천
          </span>
          <Badge variant="soft" color="blue">자연어 검색</Badge>
        </div>
      </div>

      <p
        style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        자연어로 원하는 조건을 입력하면 AI가 적합한 필터 태그를 추천합니다.
      </p>

      {/* 자연어 입력 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-secondary)',
          }}
        >
          검색 질의
        </label>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`예: ${terms.PERSON_LABEL_PRIMARY} 중에서 출석률이 낮은 사람`}
            disabled={isPending}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleRecommend();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button onClick={handleRecommend} disabled={isPending || !query.trim()}>
            {isPending ? (
              <>
                <Spinner size="sm" />
                <span style={{ marginLeft: 'var(--spacing-sm)' }}>분석 중...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span style={{ marginLeft: 'var(--spacing-sm)' }}>추천 받기</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 예시 질의 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
        <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-tertiary)' }}>예시:</span>
        {[
          `출석률이 낮은 ${terms.PERSON_LABEL_PRIMARY}`,
          '이번 달에 결제 예정인 회원',
          `신규 등록 ${terms.PERSON_LABEL_PRIMARY}`,
        ].map((example) => (
          <button
            key={example}
            onClick={() => setQuery(example)}
            style={{
              fontSize: 'var(--font-size-base)',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: 'var(--color-white)',
              border: 'var(--border-width-thin) solid var(--color-purple-200)',
              borderRadius: 'var(--border-radius-sm)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.5 : 1,
            }}
            disabled={isPending}
          >
            {example}
          </button>
        ))}
      </div>

      {/* 추천 결과 */}
      {recommendation && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
            paddingTop: 'var(--spacing-md)',
            borderTop: 'var(--border-width-thin) solid var(--color-purple-200)',
            marginTop: 'var(--spacing-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
              추천 결과
            </h4>
            <Badge variant="soft" color={getConfidenceBadgeColor(recommendation.confidence)}>
              신뢰도: {getConfidenceLabel(recommendation.confidence)}
            </Badge>
          </div>

          {recommendation.tag_ids.length > 0 ? (
            <>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  추천된 필터 태그 ({recommendation.tag_ids.length}개) - 클릭하여 선택
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                  {recommendation.tag_ids.map((tagId) => {
                    const tag = allTags?.find((t) => t.id === tagId);
                    const isSelected = selectedTagId === tagId;
                    return (
                      <Badge
                        key={tagId}
                        variant={isSelected ? 'solid' : 'outline'}
                        color="blue"
                        style={{
                          cursor: 'pointer',
                          opacity: isSelected ? 1 : 0.6,
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => handleTagSelection(tagId)}
                      >
                        {tag?.display_label || tag?.name || tagId}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  추천 이유
                </label>
                <div
                  style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-yellow-50)',
                    border: 'var(--border-width-thin) solid var(--color-yellow-200)',
                    borderRadius: 'var(--border-radius-md)',
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {recommendation.reasoning}
                </div>
              </div>

              {recommendation.suggested_query && recommendation.suggested_query !== query && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    제안된 질의문
                  </label>
                  <div
                    style={{
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-blue-50)',
                      border: 'var(--border-width-thin) solid var(--color-blue-200)',
                      borderRadius: 'var(--border-radius-md)',
                      fontSize: 'var(--font-size-base)',
                      color: 'var(--color-text-primary)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-sm)',
                    }}
                  >
                    <AlertCircle size={16} style={{ color: 'var(--color-blue-600)', flexShrink: 0, marginTop: '2px' }} />
                    <span>{recommendation.suggested_query}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleApply}
                  fullWidth
                  disabled={!selectedTagId}
                >
                  필터 적용
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRecommendation(null);
                    setSelectedTagId(null);
                  }}
                  fullWidth
                >
                  다시 검색
                </Button>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-orange-50)',
                border: 'var(--border-width-thin) solid var(--color-orange-200)',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
                <AlertCircle size={16} style={{ color: 'var(--color-orange-600)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', margin: 0 }}>
                    추천된 태그가 없습니다
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>{recommendation.reasoning}</p>
                  {recommendation.suggested_query && (
                    <p style={{ marginTop: 'var(--spacing-sm)', color: 'var(--color-blue-600)', margin: '8px 0 0 0' }}>
                      제안: &quot;{recommendation.suggested_query}&quot;로 다시 검색해보세요.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
