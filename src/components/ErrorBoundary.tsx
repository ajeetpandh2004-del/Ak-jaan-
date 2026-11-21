import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Connectify ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Something went wrong while communicating with Connectify.';
      if (this.state.errorMessage.includes('Missing or insufficient permissions')) {
        friendly = 'Access was denied by Firestore security rules. Please verify you are signed in with a verified account.';
      } else if (this.state.errorMessage.includes('Quota exceeded')) {
        friendly = 'Daily Firestore free-tier quota was reached. Quota resets tomorrow.';
      }
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAFAFA] dark:bg-[#09090B]">
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-display font-bold text-zinc-950 dark:text-zinc-50">
              Connection Interrupted
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Connectify
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
