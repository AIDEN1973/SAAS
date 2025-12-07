/**
 * Error Boundary
 * 
 * [ë¶ˆë? ê·œì¹™] ê°?ì¹´í…Œê³ ë¦¬ë§ˆë‹¤ ?¤ë¥¸ UI/ë©”ì‹œì§€Â·ë¡œê·¸ ?„ìš”:
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
    // ?ëŸ¬ ?€???ë³„
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

    // ?ëŸ¬ ë¡œê¹…
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
                fontSize: 'var(--font-size-lg)',
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
                fontSize: 'var(--font-size-sm)',
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
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  ê¸°ìˆ ???¸ë??¬í•­
                </summary>
                <pre
                  style={{
                    marginTop: 'var(--spacing-sm)',
                    fontSize: 'var(--font-size-xs)',
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
                ?¤ì‹œ ?œë„
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
        return '?¤í‚¤ë§?ê²€ì¦??¤íŒ¨';
      case 'widget':
        return '?„ì ¯ ?Œë”ë§??¤íŒ¨';
      case 'data':
        return '?°ì´??ë¡œë“œ ?¤ë¥˜';
      case 'version':
        return 'ë²„ì „ ë¶ˆì¼ì¹?;
      default:
        return '?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤';
    }
  }

  private getErrorMessage(): string {
    switch (this.state.errorType) {
      case 'schema':
        return 'UI ?¤í‚¤ë§ˆê? ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤. ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?˜ì„¸??';
      case 'widget':
        return '?„ì ¯???Œë”ë§í•  ???†ìŠµ?ˆë‹¤. ?˜ì´ì§€ë¥??ˆë¡œê³ ì¹¨?´ì£¼?¸ìš”.';
      case 'data':
        return '?°ì´?°ë? ë¶ˆëŸ¬?¤ëŠ” ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤. ?¤íŠ¸?Œí¬ ?°ê²°???•ì¸?˜ì„¸??';
      case 'version':
        return '?¤í‚¤ë§?ë²„ì „???¸í™˜?˜ì? ?ŠìŠµ?ˆë‹¤. ?˜ì´ì§€ë¥??ˆë¡œê³ ì¹¨?´ì£¼?¸ìš”.';
      default:
        return this.state.error?.message || '?????†ëŠ” ?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.';
    }
  }
}
