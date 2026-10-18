import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeSummary } from './KnowledgeSummary';

describe('KnowledgeSummary', () => {
  const sampleStatus = {
    id: 'kb-1',
    data_source_id: 'ds-1',
    status: 'ready' as const,
    current_version_number: 3,
    object_count: 272,
    schema_fingerprint: '48ec9492a097c5b1b46ef32',
    generated_at: '2026-10-17T11:50:00Z',
    created_at: '2026-10-17T11:45:00Z',
    updated_at: '2026-10-17T11:50:00Z',
  };

  it('renders version, object count, and fingerprint correctly', () => {
    render(<KnowledgeSummary status={sampleStatus} />);

    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('272')).toBeInTheDocument();
    expect(screen.getByText('48ec9492a097c5b1')).toBeInTheDocument();
    expect(screen.getByText(/Active Version/i)).toBeInTheDocument();
    expect(screen.getByText(/Schema Objects/i)).toBeInTheDocument();
  });

  it('handles empty/undefined status gracefully', () => {
    render(<KnowledgeSummary status={undefined} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('allows copying the full schema fingerprint to clipboard', async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
    render(<KnowledgeSummary status={sampleStatus} />);

    const copyBtn = screen.getByTitle('Copy full fingerprint');
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);
    expect(writeTextSpy).toHaveBeenCalledWith('48ec9492a097c5b1b46ef32');
  });
});
