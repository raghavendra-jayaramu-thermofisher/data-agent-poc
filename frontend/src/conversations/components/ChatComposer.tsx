import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Database, Sparkles, ChevronDown, Check, Loader2, X, Search, Terminal } from 'lucide-react';
import type { DataSource } from '../../api/types';
import type { ModelProfile } from '../../api/types';
import { useInstructions } from '../../settings/hooks/useInstructions';
import type { AgentInstruction } from '../../settings/api/instructions-api';

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

  const instructionsQuery = useInstructions();
  const [autocompleteDismissed, setAutocompleteDismissed] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const availableCommands = (instructionsQuery.data ?? []).filter(
    (item) => item.enabled && Boolean(item.command)
  );

  const commandMatch = question.match(/^\/([a-zA-Z0-9_-]*)$/);
  const isTypingCommand = Boolean(commandMatch);
  const commandQuery = commandMatch?.[1]?.toLowerCase() ?? '';

  const matchingCommands = availableCommands.filter(
    (inst) =>
      (inst.command ?? '').toLowerCase().includes(commandQuery) ||
      inst.name.toLowerCase().includes(commandQuery) ||
      (inst.description && inst.description.toLowerCase().includes(commandQuery))
  );

  const activeCommandMatch = question.match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
  const activeCommandName = activeCommandMatch?.[1]?.toLowerCase() ?? null;
  const activeInstruction = activeCommandName
    ? availableCommands.find((c) => c.command?.toLowerCase() === activeCommandName)
    : null;

  useEffect(() => {
    setSelectedIndex(0);
    if (!question.startsWith('/')) {
      setAutocompleteDismissed(false);
    }
  }, [commandQuery, question]);

  const selectCommand = (item?: AgentInstruction) => {
    if (!item?.command) return;
    onQuestionChange(`/${item.command} `);
    setAutocompleteDismissed(true);
    textareaRef.current?.focus();
  };

  const removeActiveCommand = () => {
    if (activeCommandMatch) {
      onQuestionChange(activeCommandMatch[2] ?? '');
      textareaRef.current?.focus();
    }
  };

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
    if (isTypingCommand && !autocompleteDismissed && matchingCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % matchingCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + matchingCommands.length) % matchingCommands.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const commandToSelect = matchingCommands[selectedIndex];
        if (commandToSelect) {
          selectCommand(commandToSelect);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteDismissed(true);
        return;
      }
    }

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
        {/* Slash Command Autocomplete Popover */}
        {isTypingCommand && !autocompleteDismissed && (
          <div
            className="chat-composer-popover chat-composer-popover--commands"
            role="listbox"
            aria-label="Slash command suggestions"
          >
            <div className="chat-composer-popover__header">
              <div>
                  <strong>Skills</strong>
                <span>Tab or Enter to select</span>
              </div>
              <button
                type="button"
                className="chat-composer-popover__close"
                onClick={() => setAutocompleteDismissed(true)}
                aria-label="Close command suggestions"
              >
                <X size={14} />
              </button>
            </div>
            <div className="chat-composer-popover__list">
              {availableCommands.length === 0 ? (
                <p className="chat-composer-popover__empty">
                  No command skills configured. Add them in Skills.
                </p>
              ) : matchingCommands.length === 0 ? (
                <p className="chat-composer-popover__empty">
                  No commands matching &ldquo;/{commandQuery}&rdquo;
                </p>
              ) : (
                matchingCommands.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      className={`chat-composer-option ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => selectCommand(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="chat-composer-option__label">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-[#4B123F]">/{item.command}</span>
                          <span className="text-xs text-[#252127] font-medium">{item.name}</span>
                        </div>
                        {item.description && (
                          <small className="text-[#625C64] truncate">{item.description}</small>
                        )}
                      </div>
                      {item.prompt_template && (
                        <span className="text-[10px] text-[#8B848C] font-mono shrink-0 max-w-[120px] truncate">
                          template
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

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
            {activeInstruction && (
              <div
                className="chat-composer-chip active"
                title={activeInstruction.description || activeInstruction.name}
              >
                <Terminal size={12} />
                <span className="font-mono font-semibold">/{activeInstruction.command}</span>
                <button
                  type="button"
                  onClick={removeActiveCommand}
                  className="ml-0.5 p-0.5 hover:bg-black/10 rounded cursor-pointer"
                  title="Remove slash command"
                  aria-label="Remove slash command"
                >
                  <X size={11} />
                </button>
              </div>
            )}

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
                    : selectedDataSourceIds.length === 1
                      ? dataSources.find((source) => source.id === selectedDataSourceIds[0])?.name ?? '1 source'
                      : `${selectedDataSourceIds.length} sources`}
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
