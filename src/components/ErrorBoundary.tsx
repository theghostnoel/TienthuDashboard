import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { formatReadableError } from '../lib/format';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: formatReadableError(
        error,
        'Đã xảy ra lỗi khi kết nối Firebase Firestore.'
      ),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center p-6">
          <div className="bg-white border border-red-200 rounded-xl p-6 max-w-lg w-full space-y-3 text-center">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
            <h1 className="text-base font-bold text-zinc-900">
              Có sự cố kết nối dữ liệu Firebase Firestore
            </h1>
            <p className="text-xs text-zinc-600 break-words leading-relaxed font-mono bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-left">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
