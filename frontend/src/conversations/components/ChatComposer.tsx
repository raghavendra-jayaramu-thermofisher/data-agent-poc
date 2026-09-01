import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Database, Sparkles, ChevronDown, Check, Loader2, X, Search } from 'lucide-react';
import type { DataSource } from '../../api/types';
import type { ModelProfile } from '../../models/api/models-api';
import { BRANDING } from '../../lib/branding';

type ChatComposerProps = {
  question: string;
  onQuestionChange(value: string): void;
  onSubmit(): Promise<void> | void;
  dataSources: DataSource[];
  selectedDataSourceIds: string[];
  onDataSourceIdsChange(ids: string[]): void;
  profiles: ModelProfile[];
  selectedProfileId: string | null;
  onProfileIdChange(id: string | null): void;
  isSubmitting?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatComposer({
  question,
  onQuestionChange,
  onSubmit,
  dataSources,
  selectedDataSourceIds,
  onDataSourceIdsChange,
  profiles,
  selectedProfileId,
  onProfileIdChange,
  isSubmitting = false,
  disabled = false,
  placeholder = 'Ask a question about your business data…',
}: ChatComposerProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [question]);

  const activeSources = dataSources.filter((s) => s.status === 'active');
  const filteredSources = activeSources.filter((s) =>
    s.name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
    s.display_type.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  const toggleSource = (sourceId: string) => {
    if (selectedDataSourceIds.includes(sourceId)) {
      onDataSourceIdsChange(selectedDataSourceIds.filter((id) => id !== sourceId));
    } else {
      if (selectedDataSourceIds.length >= 10) return;
      onDataSourceIdsChange([...selectedDataSourceIds, sourceId]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (question.trim() && !isSubmitting && !disabled && activeSources.length > 0) {
        void onSubmit();
      }
    }
  };

  return (
    <div className="chat-composer-deck" role="region" aria-label="Query composer">
      <div className="chat-composer-card">
        <textarea
          ref={textareaRef}
          className="chat-composer-textarea"
          rows={1}
          placeholder={placeholder}
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSubmitting}
          aria-label="Ask a question"
        />

        <div className="chat-composer-toolbar">
          <div className="chat-composer-chips">
            {/* Data Source Picker */}
            <div className="relative">
              <button
                type="button"
                className={`chat-composer-chip ${selectedDataSourceIds.length > 0 ? 'active' : ''}`}
                onClick={() => {
                  setSourcesOpen(!sourcesOpen);
                  setModelsOpen(false);
                }}
                aria-haspopup="dialog"
                aria-expanded={sourcesOpen}
              >
                <Database size={12} />
                <span>
                  {selectedDataSourceIds.length === 0
                    ? 'All active sources'
                    : `${selectedDataSourceIds.length} source${selectedDataSourceIds.length === 1 ? '' : 's'}`}
                </span>
                <ChevronDown size={11} />
              </button>

              {sourcesOpen && (
                <div
                  className="absolute bottom-full left-0 mb-2 w-72 bg-[#FFFDFC] border border-[#DAD5CD] rounded-md shadow-lg p-2 z-50 text-xs"
                  role="dialog"
                  aria-label="Select data sources"
                >
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#E7E3DC]">
                    <span className="font-semibold text-[#252127]">Scope Data Sources</span>
                    <button
                      type="button"
                      className="text-[#8B848C] hover:text-[#252127]"
                      onClick={() => setSourcesOpen(false)}
                      aria-label="Close"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2 top-2 text-[#8B848C]" />
                    <input
                      type="text"
                      className="w-full h-7 pl-6 pr-2 bg-[#F0EEE9] border border-[#DAD5CD] rounded text-xs text-[#252127] placeholder-[#8B848C] outline-none focus:border-[#9A4D86]"
                      placeholder="Search sources…"
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredSources.map((source) => {
                      const isSelected = selectedDataSourceIds.includes(source.id);
                      return (
                        <div
                          key={source.id}
                          onClick={() => toggleSource(source.id)}
                          className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#F4E8F0] text-[#4B123F] font-medium' : 'hover:bg-[#F0EEE9] text-[#252127]'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="truncate">{source.name}</span>
                            <span className="text-[10px] text-[#625C64] uppercase">{source.display_type}</span>
                          </div>
                          {isSelected ? <Check size={13} className="text-[#4B123F] flex-shrink-0" /> : null}
                        </div>
                      );
                    })}
                    {filteredSources.length === 0 && (
                      <p className="text-center py-2 text-[#8B848C]">No matching sources</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Model Profile Picker */}
            <div className="relative">
              <button
                type="button"
                className={`chat-composer-chip ${selectedProfileId ? 'active' : ''}`}
                onClick={() => {
                  setModelsOpen(!modelsOpen);
                  setSourcesOpen(false);
                }}
                aria-haspopup="listbox"
                aria-expanded={modelsOpen}
              >
                <Sparkles size={12} />
                <span>{selectedProfile?.display_name || 'Default model'}</span>
                <ChevronDown size={11} />
              </button>

              {modelsOpen && (
                <div
                  className="absolute bottom-full left-0 mb-2 w-64 bg-[#FFFDFC] border border-[#DAD5CD] rounded-md shadow-lg p-1.5 z-50 text-xs"
                  role="listbox"
                  aria-label="Select model profile"
                >
                  <div
                    onClick={() => {
                      onProfileIdChange(null);
                      setModelsOpen(false);
                    }}
                    className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                      selectedProfileId === null ? 'bg-[#F4E8F0] text-[#4B123F] font-medium' : 'hover:bg-[#F0EEE9] text-[#252127]'
                    }`}
                  >
                    <span>Workspace default</span>
                    {selectedProfileId === null ? <Check size={13} className="text-[#4B123F]" /> : null}
                  </div>

                  {profiles.filter((p) => p.enabled).map((profile) => {
                    const isSelected = selectedProfileId === profile.id;
                    return (
                      <div
                        key={profile.id}
                        onClick={() => {
                          onProfileIdChange(profile.id);
                          setModelsOpen(false);
                        }}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#F4E8F0] text-[#4B123F] font-medium' : 'hover:bg-[#F0EEE9] text-[#252127]'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate">{profile.display_name}</span>
                          <span className="text-[10px] text-[#8B848C] font-mono">{profile.model_name}</span>
                        </div>
                        {isSelected ? <Check size={13} className="text-[#4B123F] flex-shrink-0" /> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Send Action */}
          <button
            type="button"
            className="chat-send-btn"
            disabled={!question.trim() || isSubmitting || disabled || activeSources.length === 0}
            onClick={() => void onSubmit()}
            aria-label="Send question"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} />}
          </button>
        </div>
      </div>

      <p className="chat-composer-disclaimer">
        {BRANDING.chatDisclaimer}
      </p>
    </div>
  );
}
