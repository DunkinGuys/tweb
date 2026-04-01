import {getCurrentAgentCardPreviewSnapshot, renderAgentCardPreview} from '@lib/agentCardPreviewBridge';

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

  test('returns a structured snapshot from the current preview DOM', () => {
    const mountPoint = document.createElement('div');

    renderAgentCardPreview(mountPoint, {
      title: 'Snapshot Proof',
      status: 'PROPOSED',
      summary: 'Summary text',
      body: 'Body text',
      sourceProposalId: 'proposal_123',
      sourceTurnUsage: 1,
      sourceRemainingTurns: 4,
      actions: [
        {id: 'proposal_123:action:1', type: 'copy', label: '답장 복사', copy: 'hello'}
      ]
    });

    expect(getCurrentAgentCardPreviewSnapshot(mountPoint)).toEqual({
      source: 'agent',
      title: 'Snapshot Proof',
      status: 'PROPOSED',
      summary: 'Summary text',
      body: 'Body text',
      sourceProposalId: 'proposal_123',
      sourceAgentId: null,
      sourceAgentSlug: null,
      sourceEngagementId: null,
      sourceTurnUsage: 1,
      sourceRemainingTurns: 4,
      lifecycleActions: [],
      followUpActions: [],
      actions: [
        {
          id: 'proposal_123:action:1',
          type: 'copy',
          label: '답장 복사'
        }
      ]
    });
  });

  test('renders lifecycle controls for gateway-backed proposals', () => {
    const mountPoint = document.createElement('div');

    renderAgentCardPreview(mountPoint, {
      title: 'Gateway Proposal',
      status: 'PROPOSED',
      sourceProposalId: 'proposal_456'
    }, 'agent-gateway');

    expect(getCurrentAgentCardPreviewSnapshot(mountPoint)?.lifecycleActions).toEqual([
      {action: 'approve', label: '답장 초안 받기', disabled: false},
      {action: 'cancel', label: '닫기', disabled: false}
    ]);
    expect(getCurrentAgentCardPreviewSnapshot(mountPoint)?.followUpActions).toEqual([]);
  });
});
