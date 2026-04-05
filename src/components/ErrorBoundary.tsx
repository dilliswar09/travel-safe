import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong. Please try again.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.operationType && parsed.authInfo) {
            isFirestoreError = true;
            errorMessage = `Security Access Denied: You don't have permission to ${parsed.operationType} at ${parsed.path || 'this location'}.`;
          }
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center border border-slate-100">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">
              {isFirestoreError ? "Access Restricted" : "Application Error"}
            </h2>
            <p className="text-slate-500 font-medium mb-10 leading-relaxed">
              {errorMessage}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={this.handleReset}
                className="btn-primary w-full h-14"
              >
                <RefreshCcw size={18} />
                <span className="uppercase tracking-widest font-black">Retry Connection</span>
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="btn-ghost w-full h-14"
              >
                <Home size={18} />
                <span className="uppercase tracking-widest font-black">Back to Home</span>
              </button>
            </div>
            {isFirestoreError && (
              <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Error Code: PERMISSION_DENIED
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
