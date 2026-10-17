import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, ArrowUpToLine, ChevronLeft, ChevronRight, Copy, Check, Presentation, Minimize2 } from 'lucide-react';
import type { ConversationMessage as Message } from '../api/conversation-api';
import { AnswerVerification } from './AnswerVerification';
import { FollowUpSuggestions } from './FollowUpSuggestions';
import { AssistantMarkdown } from './AssistantMarkdown';
import { AnswerNavigation } from './AnswerNavigation';
import { createAnswerOutline } from './answer-outline';
import { MessageAnalysisDetails } from '../../agent/components/MessageAnalysisDetails';
import type { JobArtifact } from '../../agent/api/execution-api';
import { formatMarkdownForCopy } from '../../agent/lib/artifact-directives';
import { UserAvatar } from '../../components/UserAvatar';

export const ConversationMessage = memo(function ConversationMessage({
  message,
  senderName = 'You',
  question,
  onFollowUp,
  showSuggestions = false,
  followUpDisabled = false,
}: {
  message: Message;
  senderName?: string;
  question?: string;
  onFollowUp?(question: string): Promise<void> | void;
  showSuggestions?: boolean;
  followUpDisabled?: boolean;
}) {
  const assistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [artifacts, setArtifacts] = useState<JobArtifact[]>([]);
  const [presenting, setPresenting] = useState(false);
  const [selectedSection, setSelectedSection] = useState('document');
  const [placeholderHeight, setPlaceholderHeight] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const presentationBodyRef = useRef<HTMLDivElement>(null);
  const presentButtonRef = useRef<HTMLButtonElement>(null);
  const sectionCount = useMemo(() => createAnswerOutline(message.content).sections.length, [message.content]);
  const selectedIndex = selectedSection === 'document' ? 0 : Number(selectedSection.slice('section-'.length)) + 1;

  const navigateSection = useCallback((direction: 'previous' | 'next' | 'first' | 'last') => {
    if (sectionCount < 2) return;
    setSelectedSection((current) => {
      const currentIndex = current === 'document' ? 0 : Number(current.slice('section-'.length)) + 1;
      const nextIndex = direction === 'first' ? 0
        : direction === 'last' ? sectionCount
          : Math.max(0, Math.min(sectionCount, currentIndex + (direction === 'next' ? 1 : -1)));
      return nextIndex === 0 ? 'document' : `section-${nextIndex - 1}`;
    });
    if (presentationBodyRef.current) presentationBodyRef.current.scrollTop = 0;
  }, [sectionCount]);

  useEffect(() => {
    if (!presenting) return;
    const previousOverflow = document.body.style.overflow;
    const scrollRoot = rowRef.current?.closest<HTMLElement>('.main-content');
    const previousRootOverflow = scrollRoot?.style.overflowY;
    document.body.style.overflow = 'hidden';
    if (scrollRoot) scrollRoot.style.overflowY = 'hidden';
    if (presentationBodyRef.current) presentationBodyRef.current.scrollTop = 0;
    cardRef.current?.focus();
    const onPresentationKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]:not(.assistant-card--presenting)')) return;
      if (event.key === 'Escape') {
        setPresenting(false);
        requestAnimationFrame(() => presentButtonRef.current?.focus());
        return;
      }
      if (event.key === 'Tab') {
        const dialog = cardRef.current;
        const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]',
        ) ?? []).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) {
          event.preventDefault();
          dialog?.focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || sectionCount < 2) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target?.closest('[role="tablist"]') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
      const direction = event.key === 'ArrowRight' || event.key === 'PageDown' ? 'next'
        : event.key === 'ArrowLeft' || event.key === 'PageUp' ? 'previous'
          : event.key === 'Home' ? 'first'
            : event.key === 'End' ? 'last' : null;
      if (!direction) return;
      event.preventDefault();
      navigateSection(direction);
    };
    window.addEventListener('keydown', onPresentationKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (scrollRoot) scrollRoot.style.overflowY = previousRootOverflow ?? '';
      window.removeEventListener('keydown', onPresentationKey);
    };
  }, [navigateSection, presenting, sectionCount]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(formatMarkdownForCopy(message.content, artifacts));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const togglePresentation = () => {
    if (!presenting) {
      setPlaceholderHeight(cardRef.current?.getBoundingClientRect().height ?? 0);
      setSelectedSection('document');
    }
    setPresenting((value) => !value);
    if (presenting) requestAnimationFrame(() => presentButtonRef.current?.focus());
  };

  const scrollPresentation = (to: 'top' | 'bottom') => {
    const body = presentationBodyRef.current;
    if (!body) return;
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      ? 'auto'
      : 'smooth';
    body.scrollTo({ top: to === 'top' ? 0 : body.scrollHeight, behavior });
  };

  if (!assistant) {
    return (
      <div className="chat-message-row user" data-message-id={message.id}>
        <span className="message-avatar"><UserAvatar name={senderName} /></span>
        <div className="user-bubble">{message.content}</div>
      </div>
    );
  }

  const actions = (
    <div className="assistant-card-actions">
      {presenting ? (
        <>
          {sectionCount >= 2 ? (
            <div className="presentation-navigation-actions" role="group" aria-label="Presentation sections">
              <button
                type="button"
                className="assistant-card-action assistant-card-action--present-navigation"
                aria-label="Previous section"
                aria-keyshortcuts="ArrowLeft PageUp"
                title="Previous section (← or Page Up)"
                disabled={selectedIndex === 0}
                onClick={() => navigateSection('previous')}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>
              <span className="presentation-section-count" aria-live="polite">
                {selectedIndex + 1} / {sectionCount + 1}
              </span>
              <button
                type="button"
                className="assistant-card-action assistant-card-action--present-navigation"
                aria-label="Next section"
                aria-keyshortcuts="ArrowRight PageDown"
                title="Next section (→ or Page Down)"
                disabled={selectedIndex === sectionCount}
                onClick={() => navigateSection('next')}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="assistant-card-action"
            title="Go to beginning"
            aria-label="Go to beginning"
            onClick={() => scrollPresentation('top')}
          >
            <ArrowUpToLine size={16} />
          </button>
          <button
            type="button"
            className="assistant-card-action"
            title="Go to end"
            aria-label="Go to end"
            onClick={() => scrollPresentation('bottom')}
          >
            <ArrowDownToLine size={16} />
          </button>
        </>
      ) : null}
      <AnswerVerification message={message} />
      <button
        type="button"
        className="assistant-card-action"
        title="Copy answer"
        aria-label="Copy answer"
        onClick={handleCopy}
      >
        {copied ? <Check size={16} className="text-[var(--db-success)]" /> : <Copy size={16} />}
      </button>
      <button
        ref={presentButtonRef}
        type="button"
        className="assistant-card-action assistant-card-action--present"
        title={presenting ? 'Exit presentation' : 'Present answer'}
        aria-label={presenting ? 'Exit presentation' : 'Present answer'}
        onClick={togglePresentation}
      >
        {presenting ? <Minimize2 size={16} /> : <Presentation size={16} />}
        <span>{presenting ? 'Exit' : 'Present'}</span>
      </button>
    </div>
  );

  const suggestions = !presenting && showSuggestions && onFollowUp ? (
    <FollowUpSuggestions suggestions={message.metadata?.follow_up_suggestions} onSubmit={onFollowUp} disabled={followUpDisabled} />
  ) : null;

  const card = (
    <article
      ref={cardRef}
      className={`assistant-card${presenting ? ' assistant-card--presenting' : ''}`}
      role={presenting ? 'dialog' : undefined}
      aria-modal={presenting ? true : undefined}
      aria-label={presenting ? 'Answer presentation' : undefined}
      tabIndex={presenting ? -1 : undefined}
    >
      {presenting ? (
        <header className="assistant-presentation-toolbar" aria-label="Presentation controls">
          <h1 className="assistant-presentation-title">{question?.trim() || 'Analysis'}</h1>
          {actions}
        </header>
      ) : null}
      {message.job_id ? (
        <MessageAnalysisDetails
          jobId={message.job_id}
          answerMarkdown={message.content}
          onFollowUp={onFollowUp}
          onArtifactsLoaded={setArtifacts}
          footerActions={presenting ? undefined : actions}
          presenting={presenting}
          presentationBodyRef={presentationBodyRef}
          onSectionChange={() => {
            if (presentationBodyRef.current) presentationBodyRef.current.scrollTop = 0;
          }}
          selectedSection={selectedSection}
          onSelectedSectionChange={setSelectedSection}
        />
      ) : (
        <>
          <div ref={presentationBodyRef} className="assistant-card-body">
            <div className="assistant-card-content">
              <AnswerNavigation
                key={presenting ? 'presenting' : 'conversation'}
                content={message.content}
                showIdentity={!presenting}
                renderContent={(markdown) => <AssistantMarkdown content={markdown} />}
                selectedKey={selectedSection}
                onSelectedKeyChange={setSelectedSection}
                onSectionChange={presenting ? () => {
                  if (presentationBodyRef.current) presentationBodyRef.current.scrollTop = 0;
                } : undefined}
              />
            </div>
          </div>
          {!presenting ? (
            <footer className="assistant-card-footer assistant-card-footer--actions-only">
              {actions}
            </footer>
          ) : null}
        </>
      )}
    </article>
  );

  return (
    <div
      ref={rowRef}
      className="chat-message-row assistant"
      data-message-id={message.id}
      style={presenting ? { minHeight: placeholderHeight } : undefined}
    >
      {presenting ? createPortal(card, document.body) : card}
      {suggestions}
    </div>
  );
});
