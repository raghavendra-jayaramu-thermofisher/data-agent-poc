import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssistantMarkdown } from './AssistantMarkdown';

describe('assistant markdown', () => {
  it('renders GFM without enabling raw HTML or script execution', () => {
    render(<AssistantMarkdown content={'## Result\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>window.secret="leak"</script>\n\n[unsafe](javascript:alert(1))'}/>);
    expect(screen.getByRole('heading', { name: 'Result' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('unsafe').closest('a')).toBeNull();
  });
});
