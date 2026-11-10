import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Feather, RefreshCw, RotateCcw } from 'lucide-react';

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
    console.error('[Inkwell Atelier Error Caught]:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('inkwell_studio_v1');
    } catch {}
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#24231F] text-[#F4EFE5] font-serif">
          <div className="max-w-md w-full p-8 border border-[#B18A5A]/30 bg-[#1A1916] rounded shadow-2xl text-center space-y-6">
            <div className="w-12 h-12 mx-auto rounded-full border border-[#B18A5A] flex items-center justify-center text-[#B18A5A]">
              <Feather className="w-6 h-6" strokeWidth={1.4} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#B18A5A] mb-1">
                Atelier Sanctuary
              </p>
              <h1 className="font-serif text-2xl font-medium text-[#F4EFE5]">
                A Blot Upon the Page
              </h1>
              <p className="mt-2 text-sm text-[#F4EFE5]/70 leading-relaxed font-sans">
                An unexpected interruption occurred in the writing studio. Your manuscript data in your browser is safeguarded.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 text-left bg-black/40 border border-[#B18A5A]/20 rounded text-xs font-mono text-red-300/80 overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-sans rounded bg-[#713D43] text-[#F4EFE5] hover:opacity-90 transition-opacity cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Studio</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-sans rounded border border-[#B18A5A]/40 text-[#F4EFE5] hover:bg-white/5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Library</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
