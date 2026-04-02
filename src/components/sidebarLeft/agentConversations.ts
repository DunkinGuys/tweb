import SettingSection from '@components/settingSection';
import {attachClickEvent} from '@helpers/dom/clickEvent';
import {formatDateAccordingToTodayNew} from '@helpers/date';
import {clearPlatformSessionToken, getPlatformCurrentUser, type PlatformSessionUser} from '@lib/platformSession';
import {
  fetchConversationSummaries,
  type ConversationSummary
} from '@lib/conversations';

type AgentConversationsOptions = {
  onSelectConversation: (conversation: ConversationSummary) => void | Promise<void>
};

export default class AgentConversationsSection {
  public container: HTMLElement;

  private section: SettingSection;
  private listEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private currentUserEl: HTMLDivElement;
  private onSelectConversation: AgentConversationsOptions['onSelectConversation'];
  private activeConversationId?: string;
  private conversations: ConversationSummary[] = [];

  constructor(options: AgentConversationsOptions) {
    this.onSelectConversation = options.onSelectConversation;

    this.section = new SettingSection({
      name: (() => {
        const title = document.createElement('span');
        title.textContent = '대화';
        return title;
      })(),
      noDelimiter: false,
      noShadow: true
    });
    this.container = this.section.container;
    this.container.classList.add('agent-conversations-section');

    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '12px',
      opacity: '0.72',
      lineHeight: '1.45',
      marginBottom: '8px'
    });

    this.listEl = document.createElement('div');
    Object.assign(this.listEl.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    this.currentUserEl = document.createElement('div');
    Object.assign(this.currentUserEl.style, {
      display: 'none',
      marginBottom: '10px'
    });

    this.section.content.append(this.currentUserEl, this.statusEl, this.listEl);

    window.addEventListener('conversation-opened', this.onConversationOpened as EventListener);
    window.addEventListener('conversation-updated', this.onConversationUpdated as EventListener);
    window.addEventListener('platform-session-updated', this.onPlatformSessionUpdated as EventListener);
  }

  public async load() {
    this.renderCurrentUser();
    this.container.style.display = '';
    this.setStatus('대화 목록을 불러오는 중이야...');
    this.listEl.replaceChildren();

    try {
      const conversations = await fetchConversationSummaries();
      this.conversations = conversations;

      if(!conversations.length) {
        this.setStatus('아직 표시할 대화가 없어.');
        return;
      }

      this.setStatus('사람과 에이전트가 같은 목록에서 보여.');
      this.renderRows();
    } catch(err) {
      this.setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  private setStatus(text: string) {
    this.statusEl.textContent = text;
  }

  private renderCurrentUser() {
    const currentUser = getPlatformCurrentUser();
    if(!currentUser) {
      this.currentUserEl.style.display = 'none';
      this.currentUserEl.replaceChildren();
      return;
    }

    this.currentUserEl.style.display = '';
    this.currentUserEl.replaceChildren(this.createCurrentUserCard(currentUser));
  }

  private createCurrentUserCard(currentUser: PlatformSessionUser) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'grid',
      gridTemplateColumns: '42px minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: '10px',
      width: '100%',
      padding: '10px 12px',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.10)',
      background: 'rgba(255, 255, 255, 0.04)'
    });

    const avatar = document.createElement('div');
    avatar.textContent = (currentUser.avatarLabel || currentUser.displayName.slice(0, 1) || '?').slice(0, 1);
    Object.assign(avatar.style, {
      width: '42px',
      height: '42px',
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      fontWeight: '700',
      background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.22), rgba(56, 189, 248, 0.18))'
    });

    const textWrap = document.createElement('div');
    Object.assign(textWrap.style, {
      minWidth: '0',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px'
    });

    const name = document.createElement('strong');
    name.textContent = currentUser.displayName;
    Object.assign(name.style, {
      fontSize: '14px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    });

    const subtitle = document.createElement('div');
    subtitle.textContent = `${currentUser.email} · ${currentUser.authProvider}`;
    Object.assign(subtitle.style, {
      fontSize: '11px',
      opacity: '0.68',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    });

    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.textContent = '로그아웃';
    Object.assign(logoutButton.style, {
      border: '0',
      borderRadius: '999px',
      padding: '8px 10px',
      background: 'rgba(248, 113, 113, 0.12)',
      color: 'rgba(252, 165, 165, 0.96)',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: '700'
    });
    attachClickEvent(logoutButton, () => {
      clearPlatformSessionToken();
      window.location.href = `${window.location.origin}${window.location.pathname}?platform=1`;
    });

    textWrap.append(name, subtitle);
    wrapper.append(avatar, textWrap, logoutButton);
    return wrapper;
  }

  private renderRows() {
    this.listEl.replaceChildren(...this.conversations.map((conversation) => this.createAgentRow(conversation)));
  }

  private createAgentRow(conversation: ConversationSummary) {
    const agent = conversation.agentMeta;
    const engagement = agent?.engagement;
    const checkoutSession = agent?.checkoutSession;
    const hasPaidEntitlement = agent?.hasPaidEntitlement;

    const button = document.createElement('button');
    button.dataset.conversationId = conversation.conversationId;
    Object.assign(button.style, {
      display: 'grid',
      gridTemplateColumns: '42px minmax(0, 1fr)',
      alignItems: 'center',
      gap: '10px',
      width: '100%',
      padding: '10px 12px',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.10)',
      background: 'rgba(255, 255, 255, 0.04)',
      color: 'inherit',
      cursor: 'pointer',
      textAlign: 'left'
    });
    if(this.activeConversationId && this.activeConversationId === conversation.conversationId) {
      button.style.border = '1px solid rgba(94, 234, 212, 0.26)';
      button.style.background = 'rgba(94, 234, 212, 0.12)';
    }

    const avatar = document.createElement('div');
    avatar.textContent = (conversation.participants[0]?.avatarLabel || conversation.title.trim().slice(0, 1) || '?').slice(0, 1);
    Object.assign(avatar.style, {
      width: '42px',
      height: '42px',
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      fontWeight: '700',
      background: 'linear-gradient(135deg, rgba(94, 234, 212, 0.22), rgba(56, 189, 248, 0.18))'
    });

    const textWrap = document.createElement('div');
    Object.assign(textWrap.style, {
      minWidth: '0',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    });

    const topRow = document.createElement('div');
    Object.assign(topRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      justifyContent: 'space-between',
      minWidth: '0'
    });

    const leftTopRow = document.createElement('div');
    Object.assign(leftTopRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: '0'
    });

    const name = document.createElement('strong');
    name.textContent = conversation.title;
    Object.assign(name.style, {
      fontSize: '14px',
      minWidth: '0',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    });

    const rightMeta = document.createElement('div');
    Object.assign(rightMeta.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexShrink: '0',
      marginLeft: '8px'
    });

    const badge = document.createElement('span');
    const isAgentConversation = conversation.conversationKind === 'agent';
    badge.textContent = isAgentConversation ? 'AGENT' : 'USER';
    Object.assign(badge.style, {
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '0.04em',
      padding: '2px 6px',
      borderRadius: '999px',
      background: isAgentConversation ? 'rgba(94, 234, 212, 0.14)' : 'rgba(148, 163, 184, 0.16)',
      color: isAgentConversation ? 'rgba(94, 234, 212, 0.95)' : 'rgba(226, 232, 240, 0.92)'
    });

    const timestamp = document.createElement('span');
    if(conversation.updatedAt) {
      timestamp.append(formatDateAccordingToTodayNew(new Date(conversation.updatedAt)));
    }
    Object.assign(timestamp.style, {
      fontSize: '11px',
      opacity: '0.55',
      whiteSpace: 'nowrap'
    });

    const headline = document.createElement('div');
    headline.textContent = engagement?.latestSummary || conversation.latestMessage?.text || agent?.headline || '대화를 시작해봐.';
    Object.assign(headline.style, {
      fontSize: '12px',
      opacity: '0.75',
      lineHeight: '1.35',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    });

    const meta = document.createElement('div');
    meta.textContent = [
      conversation.conversationKind === 'direct' ? '일반 대화' : agent?.category?.name,
      engagement?.state === 'paid_active' ? '정식 대화 중' : null,
      engagement?.remainingTurns !== undefined ? `남은 ${engagement.remainingTurns}턴` : null,
      checkoutSession?.state === 'paid' ? '결제 완료' : null,
      hasPaidEntitlement ? '활성 구독' : null,
      !engagement && agent?.demoTurnLimit ? `데모 ${agent.demoTurnLimit}턴` : null
    ].filter(Boolean).join(' · ');
    Object.assign(meta.style, {
      fontSize: '11px',
      opacity: '0.6',
      lineHeight: '1.35'
    });

    const unreadBadge = document.createElement('span');
    if((conversation.unreadCount || 0) > 0) {
      unreadBadge.textContent = String(conversation.unreadCount);
    }
    Object.assign(unreadBadge.style, {
      minWidth: '18px',
      height: '18px',
      borderRadius: '999px',
      padding: '0 6px',
      display: (conversation.unreadCount || 0) > 0 ? 'inline-flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: '700',
      background: 'rgba(56, 189, 248, 0.18)',
      color: 'rgba(125, 211, 252, 0.98)'
    });

    leftTopRow.append(name, badge);
    rightMeta.append(timestamp, unreadBadge);
    topRow.append(leftTopRow, rightMeta);
    textWrap.append(topRow, headline, meta);
    button.append(avatar, textWrap);

    attachClickEvent(button, () => this.onSelectConversation(conversation));

    return button;
  }

  private onConversationOpened = (event: Event) => {
    const customEvent = event as CustomEvent<{conversationId?: string}>;
    this.activeConversationId = customEvent.detail?.conversationId;
    this.renderRows();
  };

  private onConversationUpdated = async(event: Event) => {
    const customEvent = event as CustomEvent<{conversationId?: string}>;
    if(customEvent.detail?.conversationId) {
      this.activeConversationId = customEvent.detail.conversationId;
    }
    await this.load();
  };

  private onPlatformSessionUpdated = () => {
    this.renderCurrentUser();
  };
}
