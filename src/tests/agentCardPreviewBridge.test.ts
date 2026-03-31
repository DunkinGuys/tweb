import {renderAgentCardPreview} from '@lib/agentCardPreviewBridge';

describe('agentCardPreviewBridge', () => {
  test('renders preview content and actions into the mount point', () => {
    const mountPoint = document.createElement('div');

    renderAgentCardPreview(mountPoint, {
      title: 'Agent Proposal',
      status: 'PROPOSED',
      summary: 'Generated preview payload for approval flow',
      body: 'Preview generated at 2026-03-31T02:45:00Z',
      actions: [
        {type: 'url', label: 'Open', url: 'https://example.com'},
        {type: 'copy', label: 'Copy', copy: 'preview-token'}
      ]
    });

    const root = mountPoint.querySelector('[data-agent-card-preview-bridge="true"]');
    expect(root).toBeTruthy();
    expect(root?.textContent).toContain('Agent Proposal');
    expect(root?.textContent).toContain('PROPOSED');
    expect(root?.textContent).toContain('Generated preview payload for approval flow');
    expect(root?.textContent).toContain('Preview generated at 2026-03-31T02:45:00Z');

    const actions = mountPoint.querySelectorAll<HTMLElement>('[data-action-type]');
    expect(actions).toHaveLength(2);
    expect(actions[0].dataset.actionType).toBe('url');
    expect(actions[1].dataset.actionType).toBe('copy');
  });

  test('reuses the existing preview root for repeated renders', () => {
    const mountPoint = document.createElement('div');

    renderAgentCardPreview(mountPoint, {title: 'First'});
    renderAgentCardPreview(mountPoint, {title: 'Second', body: 'Updated'});

    expect(mountPoint.querySelectorAll('[data-agent-card-preview-bridge="true"]')).toHaveLength(1);
    expect(mountPoint.textContent).toContain('Second');
    expect(mountPoint.textContent).toContain('Updated');
    expect(mountPoint.textContent).not.toContain('First');
  });
});
