import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Database, Sparkles, ChevronDown, Check, Loader2, X, Search } from 'lucide-react';
import type { DataSource } from '../../api/types';
import type { ModelProfile } from '../../api/types';

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
  placement?: 'docked' | 'inline';
  dataSourceSelection?: 'editable' | 'hidden';
  inputLabel?: string;
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
  placement = 'docked',
  dataSourceSelection = 'editable',
  inputLabel = 'Ask a question',
}: ChatComposerProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sourcesPickerRef = useRef<HTMLDivElement>(null);
  const modelsPickerRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [question]);

  useEffect(() => {
    if (!sourcesOpen && !modelsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!sourcesPickerRef.current?.contains(target) && !modelsPickerRef.current?.contains(target)) {
        setSourcesOpen(false);
        setModelsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSourcesOpen(false);
        setModelsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modelsOpen, sourcesOpen]);

  const activeSources = dataSources.filter((s) => s.status === 'active');
  const filteredSources = activeSources.filter((s) =>
    s.name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
    s.display_type.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const hasDataSourceScope = dataSourceSelection === 'hidden' || selectedDataSourceIds.length > 0;

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
      if (question.trim() && !isSubmitting && !disabled && hasDataSourceScope) {
        void onSubmit();
      }
    }
  };

  return (
    <div className={`chat-composer-deck chat-composer-deck--${placement}`} role="region" aria-label="Query composer">
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
          aria-label={inputLabel}
        />

        <div className="chat-composer-toolbar">
          <div className="chat-composer-chips">
            {dataSourceSelection === 'editable' ? (
              <div className="chat-composer-picker" ref={sourcesPickerRef}>
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
                    ? 'Select data source'
                    : `${selectedDataSourceIds.length} source${selectedDataSourceIds.length === 1 ? '' : 's'}`}
                </span>
                <ChevronDown size={11} />
                </button>

                {sourcesOpen && (
                  <div
                  className="chat-composer-popover chat-composer-popover--sources"
                  role="dialog"
                  aria-label="Select data sources"
                >
                  <div className="chat-composer-popover__header">
                    <div>
                      <strong>Choose data sources</strong>
                      <span>Fixed after your first question</span>
                    </div>
                    <button
                      type="button"
                      className="chat-composer-popover__close"
                      onClick={() => setSourcesOpen(false)}
                      aria-label="Close data source picker"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <label className="db-icon-search chat-composer-search">
                    <Search size={13} />
                    <input
                      type="text"
                      className="db-icon-search__input"
                      placeholder="Search sources…"
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                      aria-label="Search data sources"
                    />
                  </label>

                  <div className="chat-composer-popover__list">
                    {filteredSources.map((source) => {
                      const isSelected = selectedDataSourceIds.includes(source.id);
                      return (
                        <button
                          type="button"
                          key={source.id}
                          onClick={() => toggleSource(source.id)}
                          aria-pressed={isSelected}
                          className={`chat-composer-option ${isSelected ? 'is-selected' : ''}`}
                        >
                          <div className="chat-composer-option__label">
                            <span>{source.name}</span>
                            <small>{source.display_type}</small>
                          </div>
                          {isSelected ? <Check size={14} /> : null}
                        </button>
                      );
                    })}
                    {filteredSources.length === 0 && (
                      <p className="chat-composer-popover__empty">No matching sources</p>
                    )}
                  </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Model Profile Picker */}
            <div className="chat-composer-picker" ref={modelsPickerRef}>
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
                  className="chat-composer-popover chat-composer-popover--models"
                  role="listbox"
                  aria-label="Select model profile"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedProfileId === null}
                    onClick={() => {
                      onProfileIdChange(null);
                      setModelsOpen(false);
                    }}
                    className={`chat-composer-option ${selectedProfileId === null ? 'is-selected' : ''}`}
                  >
                    <span className="chat-composer-option__label">Workspace default</span>
                    {selectedProfileId === null ? <Check size={14} /> : null}
                  </button>

                  {profiles.filter((p) => p.enabled).map((profile) => {
                    const isSelected = selectedProfileId === profile.id;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        key={profile.id}
                        onClick={() => {
                          onProfileIdChange(profile.id);
                          setModelsOpen(false);
                        }}
                        className={`chat-composer-option ${isSelected ? 'is-selected' : ''}`}
                      >
                        <div className="chat-composer-option__label">
                          <span>{profile.display_name}</span>
                          <small className="chat-composer-option__meta--mono">{profile.model_name}</small>
                        </div>
                        {isSelected ? <Check size={14} /> : null}
                      </button>
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
            disabled={!question.trim() || isSubmitting || disabled || !hasDataSourceScope}
            onClick={() => void onSubmit()}
            aria-label="Send question"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
