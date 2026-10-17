import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs } from '@heroui/react';
import type { ReactNode } from 'react';
import { createAnswerOutline } from './answer-outline';
import { BrandLogo } from '../../components/BrandLogo';
import { BRANDING } from '../../lib/branding';

export function AnswerNavigation({
  content,
  renderContent,
  onSectionChange,
  selectedKey,
  onSelectedKeyChange,
  showIdentity = true,
}: {
  content: string;
  renderContent: (markdown: string) => ReactNode;
  onSectionChange?: () => void;
  selectedKey?: string;
  onSelectedKeyChange?: (key: string) => void;
  showIdentity?: boolean;
}) {
  const outline = useMemo(() => createAnswerOutline(content), [content]);
  const [selected, setSelected] = useState('document');
  const navigationRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef('document');
  const requestedKey = selectedKey ?? selected;
  const active = outline.sections.some((_, index) => requestedKey === `section-${index}`)
    ? requestedKey
    : 'document';

  useEffect(() => {
    const previousActive = previousActiveRef.current;
    previousActiveRef.current = active;
    const scroller = navigationRef.current?.querySelector<HTMLElement>(
      '[data-slot="tabs-list-container"] [data-slot="scroll-shadow"]',
    );
    const selectedTab = navigationRef.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!scroller || !selectedTab || typeof scroller.scrollBy !== 'function') return;

    const viewport = scroller.getBoundingClientRect();
    const selectedBounds = selectedTab.getBoundingClientRect();
    const previousBounds = selectedTab.previousElementSibling?.getBoundingClientRect();
    const nextBounds = selectedTab.nextElementSibling?.getBoundingClientRect();
    const edge = 12;
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      ? 'auto'
      : 'smooth';
    const tabIndex = (key: string) =>
      key === 'document' ? 0 : Number(key.slice('section-'.length)) + 1;

    if (tabIndex(active) < tabIndex(previousActive)) {
      const leftEdge = previousBounds?.left ?? selectedBounds.left;
      if (leftEdge < viewport.left + edge) {
        scroller.scrollBy({ left: leftEdge - viewport.left - edge, behavior });
      } else if (selectedBounds.right > viewport.right - edge) {
        scroller.scrollBy({ left: selectedBounds.right - viewport.right + edge, behavior });
      }
    } else {
      const rightEdge = nextBounds?.right ?? selectedBounds.right;
      if (rightEdge > viewport.right - edge) {
        scroller.scrollBy({ left: rightEdge - viewport.right + edge, behavior });
      } else if (selectedBounds.left < viewport.left + edge) {
        scroller.scrollBy({ left: selectedBounds.left - viewport.left - edge, behavior });
      }
    }
  }, [active]);

  if (outline.sections.length < 2) {
    return (
      <>
        {showIdentity && (
          <div className="answer-identity">
            <BrandLogo />
            <span>{BRANDING.name}</span>
          </div>
        )}
        <div className="answer-main-content">{renderContent(content)}</div>
      </>
    );
  }

  return (
    <div
      ref={navigationRef}
      className={`answer-navigation${showIdentity ? ' answer-navigation--identified' : ''}`}
    >
      {showIdentity && (
        <span className="answer-brand-mark">
          <BrandLogo />
        </span>
      )}
      <Tabs
        className="answer-section-tabs"
        variant="secondary"
        selectedKey={active}
        onSelectionChange={(key) => {
          if (onSelectedKeyChange) onSelectedKeyChange(String(key));
          else setSelected(String(key));
          onSectionChange?.();
        }}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Answer sections">
            <Tabs.Tab id="document">
              Full answer
              <Tabs.Indicator />
            </Tabs.Tab>
            {outline.sections.map((section, index) => (
              <Tabs.Tab id={`section-${index}`} key={`${section.start}-${index}`}>
                {section.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="document">
          {active === 'document' ? (
            <div className="answer-main-content">{renderContent(content)}</div>
          ) : null}
        </Tabs.Panel>
        {outline.sections.map((section, index) => (
          <Tabs.Panel id={`section-${index}`} key={`${section.start}-${index}`}>
            {active === `section-${index}` ? (
              <div className="answer-main-content">
                {renderContent(content.slice(section.start, section.end))}
              </div>
            ) : null}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
