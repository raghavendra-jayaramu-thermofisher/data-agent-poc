import { useRouteError, useNavigate } from 'react-router';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const errorMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unexpected application error occurred.';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F6F4EF]">
      <div className="max-w-md w-full p-6 bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4 text-[#A84545]">
          <div className="p-2 bg-[#F7E7E5] rounded-full">
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-base font-semibold text-[#252127]">Application Error</h2>
        </div>

        <p className="text-xs text-[#625C64] mb-4 leading-relaxed font-mono p-2.5 bg-[#F0EEE9] rounded border border-[#DAD5CD] overflow-x-auto">
          {errorMessage}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-medium transition-colors"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={13} />
            <span>Reload Page</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-medium transition-colors"
            onClick={() => navigate('/ask')}
          >
            <Home size={13} />
            <span>Go to Ask</span>
          </button>
        </div>
      </div>
    </div>
  );
}
