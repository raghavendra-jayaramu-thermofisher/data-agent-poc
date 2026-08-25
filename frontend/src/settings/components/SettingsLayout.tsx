import { Outlet } from 'react-router';
import { SlidersHorizontal } from 'lucide-react';

export function SettingsLayout() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="pb-4 mb-6 border-b border-[#DAD5CD]">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal size={20} className="text-[#4B123F]" />
          <h1 className="text-xl font-semibold text-[#252127]">Workspace Settings</h1>
        </div>
        <p className="text-xs text-[#625C64]">
          Workspace governance, membership roles, security audits, and operational diagnostics.
        </p>
      </header>

      <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-6 shadow-xs">
        <Outlet />
      </div>
    </div>
  );
}
