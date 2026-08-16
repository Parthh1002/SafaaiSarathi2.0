import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught rendering exception:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-surface p-4 text-center select-none">
          <div className="mx-auto max-w-md space-y-5 rounded-3xl border border-line bg-elevated p-6 sm:p-8 shadow-xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-fluid-lg font-bold text-ink tracking-tight">Something went wrong</h2>
              <p className="text-fluid-xs text-muted leading-relaxed">
                A rendering issue occurred while loading this view on your device.
              </p>
              {this.state.error?.message && (
                <div className="mt-2 rounded-xl bg-danger/10 p-3 text-left font-mono text-[11px] text-danger break-words max-h-32 overflow-y-auto">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-fluid-xs font-bold shadow-md cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-fluid-xs font-bold cursor-pointer"
              >
                <Home className="h-4 w-4" />
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
