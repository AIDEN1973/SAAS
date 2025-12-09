/**
 * Error Boundary
 *
 * [불변 규칙] 각 카테고리마다 다른 UI/메시지·로그 요구:
 * - Schema Validation Failure
 * - Widget Rendering Failure
 * - Data Fetch Error
 * - Version Mismatch Error
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorType?: 'schema' | 'widget' | 'data' | 'version' | 'unknown';
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 에러 타입 식별
    let errorType: ErrorBoundaryState['errorType'] = 'unknown';

    if (error.message.includes('schema') || error.message.includes('Schema')) {
      errorType = 'schema';
    } else if (error.message.includes('widget') || error.message.includes('Widget')) {
      errorType = 'widget';
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorType = 'data';
    } else if (error.message.includes('version') || error.message.includes('Version')) {
      errorType = 'version';
    }

    return {
      hasError: true,
      error,
      errorType,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 에러 로깅
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card
          variant="outlined"
          style={{
            borderColor: 'var(--color-red-500)',
          }}
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <h3
              style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-red-800)',
                marginBottom: 'var(--spacing-sm)',
                margin: 0,
              }}
            >
              {this.getErrorTitle()}
            </h3>
            <p
              style={{
                color: 'var(--color-red-600)',
                marginBottom: 'var(--spacing-md)',
                marginTop: 'var(--spacing-sm)',
              }}
            >
              {this.getErrorMessage()}
            </p>
            {this.state.error && (
              <details style={{ marginTop: 'var(--spacing-md)' }}>
                <summary
                  style={{
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  기술적 세부사항
                </summary>
                <pre
                  style={{
                    marginTop: 'var(--spacing-sm)',
                    color: 'var(--color-text-secondary)',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <Button
                variant="solid"
                color="error"
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
              >
                다시 시도
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }

  private getErrorTitle(): string {
    switch (this.state.errorType) {
      case 'schema':
        return '스키마 검증 실패';
      case 'widget':
        return '위젯 로더 실패';
      case 'data':
        return '데이터 로드 오류';
      case 'version':
        return '버전 불일치';
      default:
        return '오류가 발생했습니다';
    }
  }

  private getErrorMessage(): string {
    switch (this.state.errorType) {
      case 'schema':
        return 'UI 스키마가 올바르지 않습니다. 관리자에게 문의해주세요.';
      case 'widget':
        return '위젯을 렌더링할 수 없습니다. 페이지를 새로고침해주세요.';
      case 'data':
        return '데이터를 불러오는 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.';
      case 'version':
        return '스키마 버전이 호환되지 않습니다. 페이지를 새로고침해주세요.';
      default:
        return this.state.error?.message || '알 수 없는 오류가 발생했습니다.';
    }
  }
}
