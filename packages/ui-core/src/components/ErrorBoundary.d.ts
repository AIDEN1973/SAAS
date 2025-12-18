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
export declare class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState>;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    render(): string | number | boolean | Iterable<ReactNode> | import("react/jsx-runtime").JSX.Element | null | undefined;
    private getErrorTitle;
    private getErrorMessage;
}
//# sourceMappingURL=ErrorBoundary.d.ts.map