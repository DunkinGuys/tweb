export type AgentCardPreviewAction = {
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
  actions?: AgentCardPreviewAction[]
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

  root.replaceChildren(card);

  root.setAttribute(ROOT_ATTR, 'true');
  root.dataset.source = source;
  root.dataset.title = payload.title;
  root.dataset.status = payload.status || '';

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

  for(const [index, action] of (payload.actions || []).entries()) {
    const button = document.createElement(action.type === 'url' && action.url ? 'a' : 'button');
    button.textContent = `${action.type.toUpperCase()}${action.label ? ` · ${action.label}` : ''}`;
    button.dataset.actionType = action.type;
    button.dataset.actionIndex = String(index);
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

  return root;
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
  let root = mountPoint.querySelector<HTMLElement>(`[${ROOT_ATTR}="true"]`);
  if(root) {
    return root;
  }

  root = document.createElement('div');
  root.setAttribute(ROOT_ATTR, 'true');
  mountPoint.append(root);
  return root;
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
