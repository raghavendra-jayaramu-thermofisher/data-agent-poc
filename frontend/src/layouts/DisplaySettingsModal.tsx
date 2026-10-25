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
  LayoutTemplate,
  CircleDollarSign,
} from 'lucide-react';
import { Modal } from '@heroui/react';
import { ALL_SIDEBAR_TABS, type SidebarTabKey, type TabVisibilityMap } from './useSidebarDisplay';

const TAB_ICONS: Record<SidebarTabKey, typeof MessageSquarePlus> = {
  '/ask': MessageSquarePlus,
  '/dashboards': LayoutDashboard,
  '/data-sources': Database,
  '/knowledge': BrainCircuit,
  '/skills': LayoutTemplate,
  '/models': Cpu,
  '/jobs': Activity,
  '/settings': Settings,
};

const TAB_DESCRIPTIONS: Record<SidebarTabKey, string> = {
  '/ask': 'Natural language analytical assistant and conversation history.',
  '/dashboards': 'Saved interactive dashboards and analytical widget grids.',
  '/data-sources': 'Connected database connections and data sync configurations.',
  '/knowledge': 'Business domain glossaries, verified SQL metrics, and table indices.',
  '/skills': 'Reusable AI instructions and slash commands for analysis.',
  '/models': 'AI model providers and reasoning configurations.',
  '/jobs': 'Real-time asynchronous job executions and audit traces.',
  '/settings': 'Organization settings, memberships, and security policies.',
};

export function DisplaySettingsModal({
  isOpen,
  onClose,
  visibility,
  onToggleTab,
  showCost,
  onToggleShowCost,
  onResetDefaults,
}: {
  isOpen: boolean;
  onClose(): void;
  visibility: TabVisibilityMap;
  onToggleTab(key: SidebarTabKey): void;
  showCost: boolean;
  onToggleShowCost(): void;
  onResetDefaults(): void;
}) {
  if (!isOpen) return null;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="display-settings-backdrop"
    >
      <Modal.Container size="md">
        <Modal.Dialog
          className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          aria-labelledby="display-settings-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--db-border-default)] bg-[var(--db-surface)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[var(--db-surface-muted)] flex items-center justify-center text-[var(--db-primary)]">
                <SlidersHorizontal size={16} />
              </div>
              <div>
                <h3
                  id="display-settings-title"
                  className="font-semibold text-sm text-[var(--db-text-primary)]"
                >
                  Display settings
                </h3>
                <p className="text-xs text-[var(--db-text-secondary)]">
                  Choose what the app shows
                </p>
              </div>
            </div>

            <button
              type="button"
              className="p-1.5 text-[var(--db-text-secondary)] hover:text-[var(--db-text-primary)] hover:bg-[var(--db-surface-hover)] rounded transition-colors cursor-pointer"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab List */}
          <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
            <h4 className="text-[11px] font-semibold text-[var(--db-text-muted)]">Navigation</h4>
            {ALL_SIDEBAR_TABS.filter(({ key }) => key !== '/settings').map(
              ({ key, label, fixed }) => {
                const Icon = TAB_ICONS[key];
                const isVisible = fixed ? true : (visibility[key] ?? true);
                const description = TAB_DESCRIPTIONS[key];

                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 rounded border transition-all ${
                      isVisible
                        ? 'border-[var(--db-border-default)] bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)]'
                        : 'border-[var(--db-surface-hover)] bg-[var(--db-surface-muted)] opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 pr-2">
                      <div
                        className={`w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                          isVisible
                            ? 'bg-[var(--db-surface-muted)] text-[var(--db-primary)]'
                            : 'bg-[var(--db-surface-hover)] text-[var(--db-text-muted)]'
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-[var(--db-text-primary)]">
                            {key === '/ask' ? 'New chat' : label}
                          </span>
                          {fixed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[var(--db-surface-hover)] text-[var(--db-text-secondary)] rounded">
                              <Lock size={9} /> Always visible
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--db-text-muted)] leading-snug truncate">
                          {description}
                        </p>
                      </div>
                    </div>

                    {fixed ? (
                      <div className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full bg-[var(--db-primary)] opacity-60">
                        <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition translate-x-4.5" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-label={`Show ${label.toLowerCase()}`}
                        aria-checked={isVisible}
                        onClick={() => onToggleTab(key)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 focus:outline-none ${
                          isVisible ? 'bg-[var(--db-primary)]' : 'bg-[var(--db-border-default)]'
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
              },
            )}

            <h4 className="pt-2 text-[11px] font-semibold text-[var(--db-text-muted)]">Analysis</h4>
            <div
              className={`flex items-center justify-between p-3 rounded border transition-all ${
                showCost
                  ? 'border-[var(--db-border-default)] bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)]'
                  : 'border-[var(--db-surface-hover)] bg-[var(--db-surface-muted)] opacity-75'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 pr-2">
                <div
                  className={`w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                    showCost
                      ? 'bg-[var(--db-surface-muted)] text-[var(--db-primary)]'
                      : 'bg-[var(--db-surface-hover)] text-[var(--db-text-muted)]'
                  }`}
                >
                  <CircleDollarSign size={15} />
                </div>
                <div className="min-w-0">
                  <span className="font-medium text-xs text-[var(--db-text-primary)]">Cost</span>
                  <p className="text-[11px] text-[var(--db-text-muted)] leading-snug">
                    Live cost while an analysis runs and the total cost of each answer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Show cost"
                aria-checked={showCost}
                onClick={onToggleShowCost}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 focus:outline-none ${
                  showCost ? 'bg-[var(--db-primary)]' : 'bg-[var(--db-border-default)]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-150 ${
                    showCost ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--db-border-default)] bg-[var(--db-surface)]">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--db-text-secondary)] hover:text-[var(--db-text-primary)] font-medium transition-colors cursor-pointer"
              onClick={onResetDefaults}
            >
              <RotateCcw size={12} />
              <span>Reset to defaults</span>
            </button>

            <button
              type="button"
              className="px-4 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
