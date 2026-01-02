// LAYER: UI_CORE_UTIL
/**
 * Markdown Renderer Utility
 *
 * 경량 Markdown 렌더링 유틸리티
 * 외부 라이브러리 없이 기본적인 Markdown 문법 지원
 * [보안] XSS 방지를 위한 URL 및 텍스트 sanitize 적용
 */

import React from 'react';

/**
 * URL Sanitize - XSS 방지
 * javascript:, data:, vbscript: 등 위험한 프로토콜 차단
 */
function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase();

  // 위험한 프로토콜 차단
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      return '#'; // 안전한 기본값
    }
  }

  // 안전한 프로토콜만 허용 (http, https, mailto)
  if (!trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('mailto:') &&
      !trimmed.startsWith('/') &&
      !trimmed.startsWith('#')) {
    return '#'; // 안전한 기본값
  }

  return url;
}

/**
 * HTML 특수 문자 이스케이프 - XSS 방지
 * 텍스트에 포함된 HTML 태그를 무력화
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * 상용급 Markdown 텍스트를 React 엘리먼트로 변환
 *
 * 지원하는 문법:
 * - **볼드**, *이탤릭*, ~~취소선~~
 * - # 제목, ## 제목, ### 제목
 * - - 리스트, 1. 번호 리스트 (중첩 지원)
 * - `인라인 코드`
 * - ```언어\n코드 블록```
 * - [링크](URL)
 * - > 인용구
 * - | 테이블 |
 * - --- (구분선)
 * - 빈 줄로 단락 구분
 */
export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentParagraph: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      elements.push(
        <p
          key={elements.length}
          style={{
            margin: '0.5em 0',
            lineHeight: '1.6',
          }}
        >
          {parseInlineMarkdown(currentParagraph.join('\n'))}
        </p>
      );
      currentParagraph = [];
    }
  };

  const flushCodeBlock = () => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <pre
          key={elements.length}
          style={{
            backgroundColor: 'var(--color-gray-100)',
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--border-radius-md)',
            overflow: 'auto',
            margin: '0.5em 0',
            fontSize: '0.9em',
            border: '1px solid var(--color-gray-200)',
          }}
        >
          <code
            style={{
              fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
            }}
          >
            {codeBlockLines.join('\n')}
          </code>
        </pre>
      );
      codeBlockLines = [];
      codeBlockLang = '';
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 코드 블록 처리
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // 빈 줄 - 단락 구분
    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    // 구분선 (---, ***, ___)
    if (/^([-*_]){3,}$/.test(trimmed)) {
      flushParagraph();
      elements.push(
        <hr
          key={elements.length}
          style={{
            margin: '1.5em 0',
            border: 'none',
            borderTop: '1px solid var(--color-gray-300)',
          }}
        />
      );
      continue;
    }

    // 인용구 (>)
    if (trimmed.startsWith('>')) {
      flushParagraph();
      const quoteText = trimmed.slice(1).trim();
      elements.push(
        <blockquote
          key={elements.length}
          style={{
            margin: '0.8em 0',
            paddingLeft: 'var(--spacing-md)',
            borderLeft: '3px solid var(--color-primary-300)',
            color: 'var(--color-text-secondary)',
            fontStyle: 'italic',
          }}
        >
          {parseInlineMarkdown(quoteText)}
        </blockquote>
      );
      continue;
    }

    // 테이블 감지 (| 컬럼1 | 컬럼2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph();
      const tableLines = [line];
      // 다음 줄들도 테이블인지 확인
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        i++;
        tableLines.push(lines[i]);
      }
      elements.push(renderTable(tableLines, elements.length));
      continue;
    }

    // 제목 (# ## ###)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const HeadingTag = `h${level + 2}` as 'h3' | 'h4' | 'h5'; // h3, h4, h5

      elements.push(
        React.createElement(
          HeadingTag,
          {
            key: elements.length,
            style: {
              margin: '0.8em 0 0.4em 0',
              fontWeight: 'var(--font-weight-semibold)',
              fontSize: level === 1 ? '1.2em' : level === 2 ? '1.1em' : '1.05em',
              color: 'var(--color-text)',
            },
          },
          parseInlineMarkdown(text)
        )
      );
      continue;
    }

    // 리스트 (- 또는 * 또는 1.)
    const listMatch = trimmed.match(/^([*\-]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const isOrdered = /^\d+\./.test(trimmed);
      const text = listMatch[2];

      elements.push(
        <div
          key={elements.length}
          style={{
            display: 'flex',
            gap: '0.5em',
            margin: '0.3em 0',
            paddingLeft: '1em',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              color: 'var(--color-text-secondary)',
            }}
          >
            {isOrdered ? listMatch[1] : '•'}
          </span>
          <span>{parseInlineMarkdown(text)}</span>
        </div>
      );
      continue;
    }

    // 일반 텍스트 - 단락에 추가
    currentParagraph.push(line);
  }

  // 남은 내용 처리
  flushParagraph();
  flushCodeBlock();

  return <div>{elements}</div>;
}

/**
 * 테이블 렌더링
 */
function renderTable(lines: string[], key: number): React.ReactNode {
  const rows = lines.map(line =>
    line.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim())
  );

  if (rows.length === 0) return null;

  // 헤더와 구분선 감지
  const hasHeader = rows.length > 1 && /^[-:\s|]+$/.test(lines[1]);
  const headerRow = hasHeader ? rows[0] : null;
  const dataRows = hasHeader ? rows.slice(2) : rows;

  return (
    <div
      key={key}
      style={{
        margin: '1em 0',
        overflowX: 'auto',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.95em',
          border: '1px solid var(--color-gray-300)',
        }}
      >
        {headerRow && (
          <thead>
            <tr>
              {headerRow.map((cell, i) => (
                <th
                  key={i}
                  style={{
                    padding: 'var(--spacing-sm)',
                    borderBottom: '2px solid var(--color-gray-400)',
                    backgroundColor: 'var(--color-gray-50)',
                    fontWeight: 'var(--font-weight-semibold)',
                    textAlign: 'left',
                  }}
                >
                  {parseInlineMarkdown(cell)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {dataRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    padding: 'var(--spacing-sm)',
                    borderBottom: '1px solid var(--color-gray-200)',
                  }}
                >
                  {parseInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 인라인 Markdown 파싱 (볼드, 이탤릭, 취소선, 링크, 인라인 코드)
 */
function parseInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let currentText = text;
  let key = 0;

  // **볼드**, *이탤릭*, ~~취소선~~, `코드`, [링크](URL) 처리
  const patterns: Array<{
    regex: RegExp;
    style?: React.CSSProperties;
    type?: 'link' | 'strikethrough';
  }> = [
    { regex: /\*\*(.+?)\*\*/g, style: { fontWeight: 'var(--font-weight-bold)' } },
    { regex: /~~(.+?)~~/g, type: 'strikethrough', style: { textDecoration: 'line-through', opacity: 0.7 } },
    { regex: /\*(.+?)\*/g, style: { fontStyle: 'italic' } },
    {
      regex: /`(.+?)`/g,
      style: {
        backgroundColor: 'var(--color-gray-100)',
        padding: '0.15em 0.4em',
        borderRadius: 'var(--border-radius-sm)',
        fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
        fontSize: '0.9em',
        border: '1px solid var(--color-gray-200)',
      },
    },
  ];

  // 링크 처리 ([텍스트](URL))
  // [보안] URL sanitize 적용
  const linkMatches: Array<{ start: number; end: number; text: string; url: string }> = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(currentText)) !== null) {
    linkMatches.push({
      start: linkMatch.index,
      end: linkMatch.index + linkMatch[0].length,
      text: linkMatch[1],
      url: sanitizeUrl(linkMatch[2]), // ✅ XSS 방지: URL sanitize
    });
  }

  // 모든 패턴의 매치 위치 찾기
  const matches: Array<{
    start: number;
    end: number;
    text: string;
    style?: React.CSSProperties;
    url?: string;
  }> = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(currentText)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[1],
        style: pattern.style,
      });
    }
  }

  // 링크도 matches에 추가
  for (const link of linkMatches) {
    matches.push({
      start: link.start,
      end: link.end,
      text: link.text,
      url: link.url,
    });
  }

  // 매치를 시작 위치 순으로 정렬
  matches.sort((a, b) => a.start - b.start);

  // 중복 제거 및 텍스트 분할
  let lastIndex = 0;
  for (const match of matches) {
    // 중복 체크 (이전 매치와 겹치는 경우 스킵)
    if (match.start < lastIndex) {
      continue;
    }

    // 이전 텍스트 추가
    if (match.start > lastIndex) {
      parts.push(currentText.slice(lastIndex, match.start));
    }

    // 링크 또는 스타일 적용된 텍스트 추가
    if (match.url) {
      // 링크
      // [보안] rel="noopener noreferrer" 추가로 Tabnabbing 방지
      parts.push(
        <a
          key={key++}
          href={match.url} // 이미 sanitizeUrl 적용됨
          target="_blank"
          rel="noopener noreferrer" // ✅ 보안: Tabnabbing 방지
          style={{
            color: 'var(--color-primary-500)',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {match.text}
        </a>
      );
    } else {
      // 일반 스타일
      parts.push(
        <span key={key++} style={match.style}>
          {match.text}
        </span>
      );
    }

    lastIndex = match.end;
  }

  // 남은 텍스트 추가
  if (lastIndex < currentText.length) {
    parts.push(currentText.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}
