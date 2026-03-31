export type AgentCardPreviewAction = {
  id?: string,
  type: 'url' | 'copy',
  label?: string,
  url?: string,
  copy?: string
};

export type AgentCardPreviewPayload = {
  version?: string,
  schema?: string,
  title: string,
  status?: string,
  summary?: string,
  body?: string,
  sourceProposalId?: string,
  actions?: AgentCardPreviewAction[]
};

export type AgentCardPreviewSnapshot = {
  source: string | null,
  title: string | null,
  status: string | null,
  summary: string | null,
  body: string | null,
  sourceProposalId: string | null,
  lifecycleActions: Array<{
    action: string | null,
    label: string | null,
    disabled: boolean
  }>,
  followUpActions: Array<{
    action: string | null,
    label: string | null,
    disabled: boolean
  }>,
  actions: Array<{
    id: string | null,
    type: string | null,
    label: string | null
  }>
};

const ROOT_ATTR = 'data-agent-card-preview-bridge';

export function renderAgentCardPreview(
  mountPoint: HTMLElement,
  payload: AgentCardPreviewPayload,
  source = 'agent'
) {
  const root = ensurePreviewRoot(mountPoint);
  const card = document.createElement('section');
  const title = document.createElement('strong');
  const meta = document.createElement('div');
  const body = document.createElement('div');
  const actions = document.createElement('div');
  const lifecycle = document.createElement('div');
  const lifecycleNote = document.createElement('div');
  const followUpActions = document.createElement('div');

  root.replaceChildren(card);

  root.setAttribute(ROOT_ATTR, 'true');
  root.dataset.source = source;
  root.dataset.title = payload.title;
  root.dataset.status = payload.status || '';
  root.dataset.summary = payload.summary || '';
  root.dataset.body = payload.body || '';
  root.dataset.sourceProposalId = payload.sourceProposalId || '';

  Object.assign(root.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '8px 12px 4px'
  });

  Object.assign(card.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: 'min(520px, calc(100% - 24px))',
    padding: '12px 14px',
    borderRadius: '18px',
    color: 'var(--primary-text-color, #fff)',
    background: 'linear-gradient(180deg, rgba(69, 160, 255, 0.2), rgba(69, 160, 255, 0.08))',
    border: '1px solid rgba(69, 160, 255, 0.28)',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)'
  });

  title.textContent = payload.title;
  Object.assign(title.style, {
    fontSize: '15px',
    fontWeight: '600',
    lineHeight: '1.35'
  });

  const metaParts = [payload.status, payload.summary].filter(Boolean);
  meta.textContent = metaParts.join(' · ');
  meta.dataset.role = 'meta';
  Object.assign(meta.style, {
    fontSize: '12px',
    opacity: '0.8',
    lineHeight: '1.4'
  });

  body.textContent = payload.body || '';
  body.dataset.role = 'body';
  Object.assign(body.style, {
    fontSize: '13px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap'
  });

  Object.assign(actions.style, {
    display: payload.actions?.length ? 'flex' : 'none',
    flexWrap: 'wrap',
    gap: '8px'
  });
  Object.assign(lifecycle.style, {
    display: shouldRenderLifecycleControls(payload, source) ? 'flex' : 'none',
    flexWrap: 'wrap',
    gap: '8px'
  });
  lifecycle.dataset.role = 'lifecycle';
  followUpActions.dataset.role = 'follow-up-actions';
  Object.assign(followUpActions.style, {
    display: 'none',
    flexWrap: 'wrap',
    gap: '8px'
  });
  Object.assign(lifecycleNote.style, {
    display: 'none',
    fontSize: '12px',
    lineHeight: '1.4',
    opacity: '0.82',
  });
  lifecycleNote.dataset.role = 'lifecycle-note';

  for(const [index, action] of (payload.actions || []).entries()) {
    const button = document.createElement(action.type === 'url' && action.url ? 'a' : 'button');
    button.textContent = `${action.type.toUpperCase()}${action.label ? ` · ${action.label}` : ''}`;
    button.dataset.actionId = action.id || '';
    button.dataset.actionType = action.type;
    button.dataset.actionIndex = String(index);
    button.dataset.actionLabel = action.label || '';
    Object.assign(button.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '32px',
      padding: '0 12px',
      borderRadius: '999px',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      background: 'rgba(255, 255, 255, 0.08)',
      color: 'inherit',
      cursor: 'pointer',
      textDecoration: 'none',
      fontSize: '12px',
      fontWeight: '600'
    });

    if(button instanceof HTMLAnchorElement && action.url) {
      button.href = action.url;
      button.target = '_blank';
      button.rel = 'noreferrer noopener';
    } else if(action.type === 'copy' && action.copy) {
      button.addEventListener('click', () => {
        void navigator.clipboard?.writeText(action.copy!);
      });
    } else {
      button.setAttribute('disabled', 'true');
      button.style.opacity = '0.5';
      button.style.cursor = 'default';
    }

    actions.append(button);
  }

  if(shouldRenderLifecycleControls(payload, source)) {
    lifecycle.append(
      createLifecycleButton('approve', '답장 초안 받기', async(button) => {
        const {approveAgentCardPreviewForCurrentChat} = await import('@lib/agentCardPreviewGateway');
        const proposalId = payload.sourceProposalId!;
        setLifecycleButtonBusy(button, true, '초안 준비 중...');
        try {
          const replyPayload = await approveAgentCardPreviewForCurrentChat(proposalId, {
            applyReplyToComposer: true,
          });
          const replySummary = replyPayload.reply?.summary || '답장 초안을 입력창에 채워뒀어';
          root.dataset.status = 'APPROVED';
          root.dataset.summary = replySummary;
          meta.textContent = buildMetaText('APPROVED', replySummary);
          button.dataset.lifecycleCompleted = 'true';
          lifecycle.replaceChildren();
          lifecycle.style.display = 'none';
          lifecycleNote.textContent = replyPayload.reply?.text
            ? '답장 초안을 입력창에 넣어뒀어. 그대로 보내거나 조금 다듬으면 돼.'
            : '승인 처리는 끝났어.';
          lifecycleNote.style.display = '';
          followUpActions.replaceChildren(
            createFollowUpButton('send', '지금 보내기', async(button) => {
              const {sendCurrentAgentCardPreviewComposer} = await import('@lib/agentCardPreviewGateway');
              setLifecycleButtonBusy(button, true, '보내는 중...');
              try {
                sendCurrentAgentCardPreviewComposer();
                followUpActions.style.display = 'none';
                lifecycleNote.textContent = '답장을 보냈어. 이어서 반응을 보면 돼.';
              } finally {
                setLifecycleButtonBusy(button, false);
              }
            }),
            createFollowUpButton('edit', '수정하기', async(button) => {
              const {focusCurrentAgentCardPreviewComposer} = await import('@lib/agentCardPreviewGateway');
              setLifecycleButtonBusy(button, true, '입력창 여는 중...');
              try {
                focusCurrentAgentCardPreviewComposer();
              } finally {
                setLifecycleButtonBusy(button, false);
              }
            })
          );
          followUpActions.style.display = '';
        } finally {
          setLifecycleButtonBusy(button, false);
        }
      }),
      createLifecycleButton('cancel', '닫기', async(button) => {
        const {cancelAgentCardPreviewForCurrentChat} = await import('@lib/agentCardPreviewGateway');
        const proposalId = payload.sourceProposalId!;
        setLifecycleButtonBusy(button, true, '닫는 중...');
        try {
          await cancelAgentCardPreviewForCurrentChat(proposalId);
          root.remove();
        } finally {
          setLifecycleButtonBusy(button, false);
        }
      })
    );
  }

  card.append(title);

  if(meta.textContent) {
    card.append(meta);
  }

  if(body.textContent) {
    card.append(body);
  }

  if(actions.childElementCount) {
    card.append(actions);
  }

  if(lifecycle.childElementCount) {
    card.append(lifecycle);
  }

  card.append(lifecycleNote);
  card.append(followUpActions);

  return root;
}

export function getCurrentAgentCardPreviewSnapshot(mountPoint?: HTMLElement): AgentCardPreviewSnapshot | null {
  const root = resolvePreviewRoot(mountPoint);
  if(!root) {
    return null;
  }

  const lifecycleActions = Array.from(root.querySelectorAll<HTMLElement>('[data-lifecycle-action]')).map((action) => ({
    action: action.dataset.lifecycleAction || null,
    label: action.dataset.lifecycleLabel || null,
    disabled: action.hasAttribute('disabled'),
  }));
  const followUpActionItems = Array.from(root.querySelectorAll<HTMLElement>('[data-follow-up-action]')).map((action) => ({
    action: action.dataset.followUpAction || null,
    label: action.dataset.followUpLabel || null,
    disabled: action.hasAttribute('disabled'),
  }));
  const actions = Array.from(root.querySelectorAll<HTMLElement>('[data-action-type]')).map((action) => ({
    id: action.dataset.actionId || null,
    type: action.dataset.actionType || null,
    label: action.dataset.actionLabel || null,
  }));

  return {
    source: root.dataset.source || null,
    title: root.dataset.title || null,
    status: root.dataset.status || null,
    summary: root.dataset.summary || null,
    body: root.dataset.body || null,
    sourceProposalId: root.dataset.sourceProposalId || null,
    lifecycleActions,
    followUpActions: followUpActionItems,
    actions,
  };
}

export function pushAgentCardPreviewToCurrentChat(
  payload: AgentCardPreviewPayload,
  source = 'agent'
) {
  const appImManager = getAppImManager();
  const chat = appImManager?.chat;
  const chatInner = chat?.bubbles?.chatInner;

  if(!chat?.peerId || !chatInner || !(chatInner instanceof HTMLElement)) {
    return false;
  }

  renderAgentCardPreview(chatInner, payload, source);
  void chat.bubbles.scrollToEnd?.();
  return true;
}

function ensurePreviewRoot(mountPoint: HTMLElement) {
  let root = resolvePreviewRoot(mountPoint);
  if(root) {
    return root;
  }

  root = document.createElement('div');
  root.setAttribute(ROOT_ATTR, 'true');
  mountPoint.append(root);
  return root;
}

function buildMetaText(status?: string, summary?: string) {
  return [status, summary].filter(Boolean).join(' · ');
}

function shouldRenderLifecycleControls(payload: AgentCardPreviewPayload, source: string) {
  return !!payload.sourceProposalId && source === 'agent-gateway';
}

function createLifecycleButton(
  action: string,
  label: string,
  onClick: (button: HTMLButtonElement) => Promise<void>
) {
  const button = document.createElement('button');
  button.textContent = label;
  button.dataset.lifecycleAction = action;
  button.dataset.lifecycleLabel = label;
  Object.assign(button.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '30px',
    padding: '0 12px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: action === 'approve' ? 'rgba(94, 234, 212, 0.14)' : 'rgba(255, 255, 255, 0.06)',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  });
  button.addEventListener('click', () => {
    void onClick(button).catch((err) => {
      console.error(`Failed to execute preview lifecycle action: ${action}`, err);
      setLifecycleButtonBusy(button, false);
    });
  });
  return button;
}

function createFollowUpButton(
  action: string,
  label: string,
  onClick: (button: HTMLButtonElement) => Promise<void>
) {
  const button = createLifecycleButton(action, label, onClick);
  button.dataset.followUpAction = action;
  button.dataset.followUpLabel = label;
  button.removeAttribute('data-lifecycle-action');
  button.removeAttribute('data-lifecycle-label');
  return button;
}

function setLifecycleButtonBusy(button: HTMLButtonElement, busy: boolean, label?: string) {
  if(busy) {
    button.dataset.lifecycleOriginalLabel = button.textContent || '';
    button.textContent = label || 'Working...';
    button.setAttribute('disabled', 'true');
    button.style.opacity = '0.7';
    button.style.cursor = 'progress';
    return;
  }

  if(button.dataset.lifecycleOriginalLabel && !button.textContent) {
    button.textContent = button.dataset.lifecycleOriginalLabel;
  }

  if(!button.textContent) {
    button.textContent = button.dataset.lifecycleLabel || 'Action';
  }

  if(button.dataset.lifecycleCompleted === 'true') {
    return;
  }

  button.removeAttribute('disabled');
  button.style.opacity = '1';
  button.style.cursor = 'pointer';
}

function resolvePreviewRoot(mountPoint?: HTMLElement) {
  return mountPoint?.querySelector<HTMLElement>(`[${ROOT_ATTR}="true"]`) || null;
}

function getAppImManager() {
  return (window as typeof window & {
    appImManager?: {
      chat?: {
        peerId?: number,
        bubbles?: {
          chatInner?: HTMLElement,
          scrollToEnd?: () => Promise<unknown> | unknown
        }
      }
    }
  }).appImManager;
}
