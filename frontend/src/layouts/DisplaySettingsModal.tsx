import {
  X,
  SlidersHorizontal,
  RotateCcw,
  MessageSquarePlus,
  LayoutDashboard,
  Database,
  BrainCircuit,
  Cpu,
  Activity,
  Settings,
  Lock,
} from 'lucide-react';
import {
  ALL_SIDEBAR_TABS,
  type SidebarTabKey,
  type TabVisibilityMap,
} from './useSidebarDisplay';

const TAB_ICONS: Record<SidebarTabKey, typeof MessageSquarePlus> = {
  '/ask': MessageSquarePlus,
  '/dashboards': LayoutDashboard,
  '/data-sources': Database,
  '/knowledge': BrainCircuit,
  '/models': Cpu,
  '/jobs': Activity,
  '/settings': Settings,
};

const TAB_DESCRIPTIONS: Record<SidebarTabKey, string> = {
  '/ask': 'Natural language analytical assistant and conversation history.',
  '/dashboards': 'Saved interactive dashboards and analytical widget grids.',
  '/data-sources': 'Connected database connections and data sync configurations.',
  '/knowledge': 'Business domain glossaries, verified SQL metrics, and table indices.',
  '/models': 'AI model providers and reasoning configurations.',
  '/jobs': 'Real-time asynchronous job executions and audit traces.',
  '/settings': 'Organization settings, memberships, and security policies.',
};

export function DisplaySettingsModal({
  isOpen,
  onClose,
  visibility,
  onToggleTab,
  onResetDefaults,
}: {
  isOpen: boolean;
  onClose(): void;
  visibility: TabVisibilityMap;
  onToggleTab(key: SidebarTabKey): void;
  onResetDefaults(): void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-[#FFFDFC] border border-[#DAD5CD] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-labelledby="display-settings-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DAD5CD] bg-[#FBFAF7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#F0EEE9] flex items-center justify-center text-[#4B123F]">
              <SlidersHorizontal size={16} />
            </div>
            <div>
              <h3 id="display-settings-title" className="font-semibold text-sm text-[#252127]">
                Display Settings
              </h3>
              <p className="text-xs text-[#625C64]">Customize navigation tabs in the sidebar</p>
            </div>
          </div>

          <button
            type="button"
            className="p-1.5 text-[#625C64] hover:text-[#252127] hover:bg-[#EAE7E1] rounded transition-colors cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab List */}
        <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {ALL_SIDEBAR_TABS.map(({ key, label, fixed }) => {
            const Icon = TAB_ICONS[key];
            const isVisible = fixed ? true : visibility[key] ?? true;
            const description = TAB_DESCRIPTIONS[key];

            return (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded border transition-all ${
                  isVisible
                    ? 'border-[#DAD5CD] bg-[#FFFDFC] hover:bg-[#FAF8F5]'
                    : 'border-[#EAE7E1] bg-[#F7F5F0] opacity-75'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 pr-2">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                      isVisible ? 'bg-[#F0EEE9] text-[#4B123F]' : 'bg-[#EAE7E1] text-[#8B848C]'
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-[#252127]">{label}</span>
                      {fixed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#EAE7E1] text-[#625C64] rounded">
                          <Lock size={9} /> Always visible
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8B848C] leading-snug truncate">
                      {description}
                    </p>
                  </div>
                </div>

                {fixed ? (
                  <div className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full bg-[#4B123F] opacity-60">
                    <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition translate-x-4.5" />
                  </div>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isVisible}
                    onClick={() => onToggleTab(key)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 focus:outline-none ${
                      isVisible ? 'bg-[#4B123F]' : 'bg-[#DAD5CD]'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-150 ${
                        isVisible ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#DAD5CD] bg-[#FBFAF7]">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs text-[#625C64] hover:text-[#252127] font-medium transition-colors cursor-pointer"
            onClick={onResetDefaults}
          >
            <RotateCcw size={12} />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            className="px-4 py-1.5 bg-[#4B123F] hover:bg-[#380E2F] text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
