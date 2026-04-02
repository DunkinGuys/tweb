import {attachClickEvent} from '@helpers/dom/clickEvent';
import {clearPlatformSessionToken, getPlatformCurrentUser, type PlatformSessionUser} from '@lib/platformSession';
import {
  fetchConversationSummaries,
  type ConversationSummary
} from '@lib/conversations';
import {resolveConversationSyntheticPeerId} from '@lib/conversationSyntheticMessagesAdapter';
import findUpTag from '@helpers/dom/findUpTag';
import appDialogsManager, {DIALOG_LIST_ELEMENT_TAG, DialogElement} from '@lib/appDialogsManager';

type AgentConversationsOptions = {
  onSelectConversation: (conversation: ConversationSummary) => void | Promise<void>
};

export default class AgentConversationsSection {
  public container: HTMLElement;

  private currentUserEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private listEl: HTMLDivElement;
  private listContentEl: HTMLDivElement;
  private onSelectConversation: AgentConversationsOptions['onSelectConversation'];
  private activeConversationId?: string;
  private conversations: ConversationSummary[] = [];

  constructor(options: AgentConversationsOptions) {
    this.onSelectConversation = options.onSelectConversation;

    this.container = document.createElement('div');
    this.container.classList.add('platform-conversations');
    Object.assign(this.container.style, {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%'
    });

    this.currentUserEl = document.createElement('div');
    this.currentUserEl.classList.add('platform-conversations-user');
    Object.assign(this.currentUserEl.style, {
      padding: '8px 12px 6px'
    });

    this.statusEl = document.createElement('div');
    this.statusEl.classList.add('platform-conversations-status');
    Object.assign(this.statusEl.style, {
      padding: '0 18px 8px',
      fontSize: '12px',
      opacity: '0.64',
      lineHeight: '1.4'
    });

    this.listEl = document.createElement('div');
    this.listEl.classList.add('chatlist');
    Object.assign(this.listEl.style, {
      display: 'flex',
      flexDirection: 'column'
    });

    this.listContentEl = document.createElement('div');
    this.listContentEl.classList.add('chatlist-content');
    Object.assign(this.listContentEl.style, {
      display: 'flex',
      flexDirection: 'column'
    });

    this.listEl.append(this.listContentEl);
    this.container.append(this.currentUserEl, this.statusEl, this.listEl);

    this.listContentEl.addEventListener('mousedown', this.onListMouseDown);

    window.addEventListener('conversation-opened', this.onConversationOpened as EventListener);
    window.addEventListener('conversation-updated', this.onConversationUpdated as EventListener);
    window.addEventListener('platform-session-updated', this.onPlatformSessionUpdated as EventListener);
  }

  public async load() {
    this.renderCurrentUser();
    this.setStatus('대화 목록을 불러오는 중이야...');
    this.listContentEl.replaceChildren();

    try {
      const conversations = await fetchConversationSummaries();
      this.conversations = conversations;

      if(!conversations.length) {
        this.setStatus('아직 표시할 대화가 없어.');
        return;
      }

      this.setStatus('');
      this.renderRows();
    } catch(err) {
      this.setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  private setStatus(text: string) {
    this.statusEl.textContent = text;
    this.statusEl.style.display = text ? '' : 'none';
  }

  private renderCurrentUser() {
    const currentUser = getPlatformCurrentUser();
    if(!currentUser) {
      this.currentUserEl.style.display = 'none';
      this.currentUserEl.replaceChildren();
      return;
    }

    this.currentUserEl.style.display = '';
    this.currentUserEl.replaceChildren(this.createCurrentUserRow(currentUser));
  }

  private createCurrentUserRow(currentUser: PlatformSessionUser) {
    const peerId = resolveConversationSyntheticPeerId(`platform-user:${currentUser.userId}`);
    const dialogElement = new DialogElement({
      peerId,
      fromName: currentUser.displayName,
      noIcons: true,
      controlled: true,
      dontSetActive: true,
      wrapOptions: {}
    });
    const row = dialogElement.dom.listEl as HTMLAnchorElement;
    row.removeAttribute('href');
    row.style.cursor = 'default';
    row.style.paddingInlineEnd = '12px';

    dialogElement.dom.lastMessageSpan.textContent = currentUser.email;
    dialogElement.dom.lastMessageSpan.classList.add('dialog-subtitle-span-overflow');
    dialogElement.dom.subtitleEl.classList.add('has-multiple-badges');
    dialogElement.dom.lastTimeSpan.textContent = currentUser.authProvider;

    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.textContent = '로그아웃';
    logoutButton.classList.add('dialog-subtitle-badge', 'badge', 'badge-20');
    Object.assign(logoutButton.style, {
      border: '0',
      background: 'rgba(248, 113, 113, 0.16)',
      color: 'rgba(254, 202, 202, 0.96)',
      cursor: 'pointer'
    });
    attachClickEvent(logoutButton, () => {
      clearPlatformSessionToken();
      window.location.href = `${window.location.origin}${window.location.pathname}`;
    });
    dialogElement.dom.subtitleEl.append(logoutButton);
    return row;
  }

  private renderRows() {
    const rows = this.conversations.map((conversation) => this.createConversationRow(conversation));
    this.listContentEl.replaceChildren(...rows);

    rows.forEach((row) => {
      const isActive = !!this.activeConversationId && row.dataset.conversationId === this.activeConversationId;
      appDialogsManager.setDialogActive(row, isActive);
    });
  }

  private createConversationRow(conversation: ConversationSummary) {
    const peerId = resolveConversationSyntheticPeerId(
      conversation.conversationId || conversation.agentMeta?.slug || conversation.title
    );
    const dialogElement = new DialogElement({
      peerId,
      fromName: conversation.title,
      noIcons: true,
      controlled: true,
      wrapOptions: {}
    });
    const row = dialogElement.dom.listEl as HTMLAnchorElement;
    row.href = `#${conversation.conversationId}`;
    row.dataset.conversationId = conversation.conversationId;
    row.dataset.participantType = conversation.agentMeta ? 'agent' : 'user';
    row.dataset.peerId = String(peerId);

    dialogElement.dom.lastMessageSpan.textContent = this.buildSubtitle(conversation);
    dialogElement.dom.lastMessageSpan.classList.add('dialog-subtitle-span-last');
    dialogElement.dom.lastMessageSpan.parentElement?.classList.add('has-multiple-badges');

    if(conversation.updatedAt) {
      dialogElement.dom.lastTimeSpan.textContent = new Date(conversation.updatedAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    const unreadCount = Number(conversation.unreadCount || 0);
    if(unreadCount > 0) {
      dialogElement.createUnreadBadge();
      if(dialogElement.dom.unreadBadge) {
        dialogElement.dom.unreadBadge.textContent = String(unreadCount);
      }
    } else if(conversation.agentMeta) {
      const stateLabel = this.buildAgentStateBadgeLabel(conversation);
      if(stateLabel) {
        const stateBadge = document.createElement('div');
        stateBadge.className = 'dialog-subtitle-badge badge badge-20';
        stateBadge.textContent = stateLabel;
        Object.assign(stateBadge.style, {
          background: 'rgba(94, 234, 212, 0.14)',
          color: 'rgba(153, 246, 228, 0.95)'
        });
        dialogElement.dom.subtitleEl.append(stateBadge);
      }
    }

    return row;
  }

  private onListMouseDown = (event: MouseEvent) => {
    if(event.button !== 0) {
      return;
    }

    const row = findUpTag(event.target, DIALOG_LIST_ELEMENT_TAG) as HTMLAnchorElement;
    if(!row) {
      return;
    }

    const conversationId = row.dataset.conversationId?.trim();
    if(!conversationId) {
      return;
    }

    const conversation = this.conversations.find((item) => item.conversationId === conversationId);
    if(!conversation) {
      return;
    }

    this.activeConversationId = conversation.conversationId;
    this.renderRows();
    void this.onSelectConversation(conversation);
  };

  private createAvatar(label: string, kind: 'agent' | 'user') {
    const avatar = document.createElement('div');
    avatar.classList.add('dialog-avatar');
    avatar.textContent = (label.trim().slice(0, 1) || '?').toUpperCase();
    Object.assign(avatar.style, {
      width: '54px',
      height: '54px',
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      flex: '0 0 auto',
      fontWeight: '700',
      color: 'rgba(255,255,255,0.96)',
      background: kind === 'agent' ?
        'linear-gradient(135deg, rgba(94, 234, 212, 0.34), rgba(56, 189, 248, 0.22))' :
        'linear-gradient(135deg, rgba(148, 163, 184, 0.28), rgba(100, 116, 139, 0.18))'
    });
    return avatar;
  }

  private buildSubtitle(conversation: ConversationSummary) {
    const latestText = conversation.latestMessage?.text?.trim();
    const draft = conversation.draft?.trim();
    const preview = draft ? `초안: ${draft}` : latestText;
    const pieces = [preview];

    if(conversation.agentMeta?.engagement?.state === 'paid_active') {
      pieces.push('정식 대화 중');
    } else if(conversation.agentMeta?.engagement?.remainingTurns !== undefined) {
      pieces.push(`남은 ${conversation.agentMeta.engagement.remainingTurns}턴`);
    }

    return pieces.filter(Boolean).join(' · ') || '대화를 시작해봐.';
  }

  private buildAgentStateBadgeLabel(conversation: ConversationSummary) {
    const state = conversation.agentMeta?.engagement?.state;
    if(state === 'paid_active') {
      return 'LIVE';
    }

    if(conversation.agentMeta?.hasPaidEntitlement) {
      return 'PAID';
    }

    if(state === 'demo_active') {
      return 'DEMO';
    }

    return '';
  }

  private onConversationOpened = (event: CustomEvent<{conversationId?: string}>) => {
    const conversationId = event.detail?.conversationId;
    if(!conversationId) {
      return;
    }

    this.activeConversationId = conversationId;
    this.renderRows();
  };

  private onConversationUpdated = (event: CustomEvent<{conversationId?: string}>) => {
    const conversationId = event.detail?.conversationId;
    if(conversationId) {
      this.activeConversationId = conversationId;
    }

    void this.load();
  };

  private onPlatformSessionUpdated = () => {
    this.renderCurrentUser();
  };
}
