import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JobArtifact } from '../../agent/api/execution-api';
import { AssistantResponseRenderer } from './AssistantResponseRenderer';

vi.mock('../../agent/components/ArtifactRenderer', () => ({
  ArtifactRenderer: ({ artifacts }: { artifacts: JobArtifact[] }) => (
    <div data-testid={`artifact-${artifacts[0]?.id}`}>{artifacts[0]?.name}</div>
  ),
}));

const artifactId = '11111111-1111-4111-8111-111111111111';
const artifact: JobArtifact = {
  id: artifactId,
  job_id: 'job-1',
  kind: 'chart',
  name: 'Orders by status',
  source_sql_execution_id: null,
  payload: {},
  created_at: '2026-09-24T00:00:00Z',
};

describe('AssistantResponseRenderer', () => {
  it('renders an artifact between the surrounding Markdown sections', () => {
    render(
      <AssistantResponseRenderer
        jobId="job-1"
        markdown={`### Answer\n\nBefore output.\n\n[[artifact:${artifactId}]]\n\nAfter output.`}
        artifacts={[artifact]}
        sql={[]}
      />,
    );

    const before = screen.getByText('Before output.');
    const output = screen.getByTestId(`artifact-${artifactId}`);
    const after = screen.getByText('After output.');
    expect(before.compareDocumentPosition(output) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(output.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a safe placeholder when a referenced artifact cannot load', () => {
    render(
      <AssistantResponseRenderer
        jobId="job-1"
        markdown={`### Answer\n\n[[artifact:${artifactId}]]`}
        artifacts={[]}
        sql={[]}
      />,
    );
    expect(screen.getByText('Output unavailable')).toBeInTheDocument();
  });

  it('keeps historical Markdown without directives unchanged', () => {
    render(
      <AssistantResponseRenderer
        jobId="job-1"
        markdown={'### Answer\n\nHistorical answer.'}
        artifacts={[artifact]}
        sql={[]}
      />,
    );
    expect(screen.getByText('Historical answer.')).toBeInTheDocument();
    expect(screen.queryByTestId(`artifact-${artifactId}`)).not.toBeInTheDocument();
  });

  it('keeps inline artifacts with their section tab and restores the full answer', async () => {
    const user = userEvent.setup();
    render(
      <AssistantResponseRenderer
        jobId="job-1"
        markdown={`# Report\n\n## Findings\nBefore output.\n\n[[artifact:${artifactId}]]\n\n## Actions\nAfter output.`}
        artifacts={[artifact]}
        sql={[]}
      />,
    );

    expect(screen.queryByRole('navigation', { name: 'Table of contents' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Findings' }));
    expect(screen.getByTestId(`artifact-${artifactId}`)).toBeInTheDocument();
    expect(screen.queryByText('After output.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Actions' }));
    expect(screen.getByText('After output.')).toBeInTheDocument();
    expect(screen.queryByTestId(`artifact-${artifactId}`)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Full answer' }));
    expect(screen.getByRole('tab', { name: 'Full answer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId(`artifact-${artifactId}`)).toBeInTheDocument();
  });
});
