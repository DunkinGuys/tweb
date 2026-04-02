import appSidebarRight from '@components/sidebarRight';
import AppConversationProfileTab from '@components/sidebarRight/tabs/conversationProfile';
import PopupAgentCheckout from '@components/popups/agentCheckout';
import {formatDateAccordingToTodayNew} from '@helpers/date';
import {attachClickEvent} from '@helpers/dom/clickEvent';
import {
  fetchAgentRegistryAgentDetail,
  type AgentRegistryAgentDetail
} from '@lib/agentRegistry';
import {
  fetchConversationDetail,
  fetchConversationProfile,
  fetchConversationMessages,
  sendConversationMessage,
  type ConversationMessage,
  type ConversationProfile,
  type ConversationSummary
} from '@lib/conversations';
import {
  confirmAgentMarketplaceCheckoutSessionForCurrentChat,
  consumeAgentMarketplaceDemoTurnForCurrentChat,
  continueAgentMarketplacePaidFlowForCurrentChat,
  createAgentMarketplaceCheckoutSessionForCurrentChat,
  createAgentMarketplaceDemoUpgradeIntentForCurrentChat,
  fetchCurrentAgentMarketplaceCheckoutSession,
  fetchCurrentAgentMarketplaceDemo,
  fetchCurrentAgentMarketplaceUpgradeIntent,
  startAgentMarketplaceDemoForCurrentChat,
  startAgentMarketplacePaidFlowForCurrentChat,
  type AgentMarketplaceCheckoutIntent,
  type AgentMarketplaceCheckoutSession,
  type AgentMarketplaceDemoEngagement
} from '@lib/agentMarketplaceDemo';

type ConversationTarget = {
  conversationId?: string,
  agentSlug?: string
};

export default class ConversationMainChat {
  public container: HTMLDivElement;

  private backgroundEl: HTMLDivElement;
  private headerEl: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private metaEl: HTMLDivElement;
  private profileButtonEl: HTMLButtonElement;
  private bubblesEl: HTMLDivElement;
  private scrollableEl: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private composerEl: HTMLDivElement;
  private composerInputEl: HTMLTextAreaElement;
  private sendButtonEl: HTMLButtonElement;
  private agent?: AgentRegistryAgentDetail;
  private conversation?: ConversationSummary | null;
  private profile?: ConversationProfile | null;
  private conversationId?: string;
  private refreshInterval?: number;

  constructor() {
    this.container = document.createElement('div');
    this.container.classList.add('chat', 'tabs-tab', 'conversation-main-chat');
    this.container.dataset.type = 'chat';

    this.backgroundEl = document.createElement('div');
    this.backgroundEl.classList.add('chat-background');

    this.headerEl = document.createElement('div');
    this.headerEl.classList.add('sidebar-header', 'topbar');

    const chatInfoContainer = document.createElement('div');
    chatInfoContainer.classList.add('chat-info-container');

    const chatInfo = document.createElement('div');
    chatInfo.classList.add('chat-info');
    Object.assign(chatInfo.style, {
      cursor: 'pointer'
    });

    const person = document.createElement('div');
    person.classList.add('person');

    const content = document.createElement('div');
    content.classList.add('content');

    const top = document.createElement('div');
    top.classList.add('top');

    this.titleEl = document.createElement('div');
    this.titleEl.classList.add('user-title');

    const bottom = document.createElement('div');
    bottom.classList.add('bottom');

    this.metaEl = document.createElement('div');
    this.metaEl.classList.add('info');

    top.append(this.titleEl);
    bottom.append(this.metaEl);
    content.append(top, bottom);
    person.append(content);
    chatInfo.append(person);
    attachClickEvent(chatInfo, async() => {
      await this.openProfile();
    });
    chatInfoContainer.append(chatInfo);

    this.profileButtonEl = document.createElement('button');
    this.profileButtonEl.type = 'button';
    this.profileButtonEl.textContent = '정보';
    this.profileButtonEl.classList.add('btn-circle', 'rp');
    Object.assign(this.profileButtonEl.style, {
      position: 'static',
      transform: 'none',
      width: 'auto',
      minWidth: '44px',
      padding: '0 12px',
      borderRadius: '999px',
      marginLeft: '12px'
    });
    attachClickEvent(this.profileButtonEl, async() => {
      await this.openProfile();
    });

    this.headerEl.append(chatInfoContainer);
    this.headerEl.append(this.profileButtonEl);

    this.bubblesEl = document.createElement('div');
    this.bubblesEl.classList.add('bubbles');

    this.scrollableEl = document.createElement('div');
    this.scrollableEl.classList.add('scrollable');
    Object.assign(this.scrollableEl.style, {
      height: '100%',
      overflowY: 'auto'
    });

    this.bodyEl = document.createElement('div');
    this.bodyEl.classList.add('bubbles-inner', 'is-chat');
    Object.assign(this.bodyEl.style, {
      paddingTop: '16px',
      paddingBottom: '16px'
    });

    this.scrollableEl.append(this.bodyEl);
    this.bubblesEl.append(this.scrollableEl);

    this.composerEl = document.createElement('div');
    this.composerEl.classList.add('chat-input', 'chat-input-main');

    const inputContainer = document.createElement('div');
    inputContainer.classList.add('chat-input-container', 'chat-input-main-container');

    const rowsWrapperWrapper = document.createElement('div');
    rowsWrapperWrapper.classList.add('rows-wrapper-wrapper');

    const rowsWrapper = document.createElement('div');
    rowsWrapper.classList.add('rows-wrapper', 'chat-input-wrapper', 'chat-input-main-wrapper', 'chat-rows-wrapper');

    const newMessageWrapper = document.createElement('div');
    newMessageWrapper.classList.add('new-message-wrapper', 'rows-wrapper-row');

    const inputMessageContainer = document.createElement('div');
    inputMessageContainer.classList.add('input-message-container');
    Object.assign(inputMessageContainer.style, {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '10px',
      width: '100%'
    });

    this.composerInputEl = document.createElement('textarea');
    this.composerInputEl.placeholder = '메시지를 입력해';
    Object.assign(this.composerInputEl.style, {
      width: '100%',
      minHeight: '44px',
      maxHeight: '180px',
      padding: '12px 14px',
      border: '0',
      outline: 'none',
      resize: 'vertical',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      lineHeight: '1.45'
    });
    this.composerInputEl.addEventListener('keydown', (event) => {
      if(event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendButtonEl.click();
      }
    });

    this.sendButtonEl = document.createElement('button');
    this.sendButtonEl.type = 'button';
    this.sendButtonEl.textContent = '전송';
    this.sendButtonEl.classList.add('btn-circle', 'rp', 'btn-send');
    Object.assign(this.sendButtonEl.style, {
      position: 'static',
      transform: 'none',
      flex: '0 0 auto'
    });

    attachClickEvent(this.sendButtonEl, async() => {
      await this.handleSendMessage();
    });

    inputMessageContainer.append(this.composerInputEl, this.sendButtonEl);
    newMessageWrapper.append(inputMessageContainer);
    rowsWrapper.append(newMessageWrapper);
    rowsWrapperWrapper.append(rowsWrapper);
    inputContainer.append(rowsWrapperWrapper);
    this.composerEl.append(inputContainer);

    this.container.append(this.backgroundEl, this.headerEl, this.bubblesEl, this.composerEl);
  }

  public async openConversation(target: ConversationTarget) {
    const trimmedSlug = target.agentSlug?.trim();
    const trimmedConversationId = target.conversationId?.trim();
    if(!trimmedSlug && !trimmedConversationId) {
      this.titleEl.textContent = '대화';
      this.setMeta('열 대화를 찾을 수 없어.');
      this.bodyEl.replaceChildren();
      return;
    }

    this.titleEl.textContent = '대화';
    this.setMeta('대화를 불러오는 중이야...');
    this.bodyEl.replaceChildren();

    try {
      const conversation = trimmedConversationId ? await fetchConversationDetail(trimmedConversationId).catch((): null => null) : null;
      const agentSlug = trimmedSlug || conversation?.agentMeta?.slug;
      this.conversation = conversation;
      this.conversationId = conversation?.conversationId || trimmedConversationId || undefined;
      this.profile = this.conversationId ? await fetchConversationProfile(this.conversationId).catch((): null => null) : null;
      this.agent = agentSlug ? await fetchAgentRegistryAgentDetail(agentSlug).catch((): null => null) || undefined : undefined;
      this.titleEl.textContent = conversation?.title || this.profile?.displayName || this.agent?.name || '대화';
      this.startAutoRefresh();
      await this.renderConversation();
      this.emitConversationEvent('conversation-opened');
    } catch(err) {
      this.setMeta(err instanceof Error ? err.message : String(err));
      this.bodyEl.replaceChildren();
    }
  }

  private async handleSendMessage() {
    if(!this.conversationId) {
      this.setMeta('먼저 대화를 시작해야 해.');
      return;
    }

    const text = this.composerInputEl.value.trim();
    if(!text) {
      this.setMeta('보낼 메시지를 먼저 적어줘.');
      return;
    }

    const originalLabel = this.sendButtonEl.textContent || '전송';
    this.sendButtonEl.textContent = '전송 중...';
    this.sendButtonEl.setAttribute('disabled', 'true');
    try {
      await sendConversationMessage(this.conversationId, text);
      this.composerInputEl.value = '';
      await this.renderConversation();
    } catch(err) {
      this.setMeta(err instanceof Error ? err.message : String(err));
    } finally {
      this.sendButtonEl.textContent = originalLabel;
      this.sendButtonEl.removeAttribute('disabled');
    }
  }

  private async openProfile() {
    if(!this.conversationId) {
      return;
    }

    const tab = appSidebarRight.createTab(AppConversationProfileTab);
    await tab.open();
    await tab.loadProfile({conversationId: this.conversationId});
    await appSidebarRight.toggleSidebar(true);
  }

  private async renderConversation() {
    if(!this.conversationId) {
      return;
    }

    const currentConversation = await fetchConversationDetail(this.conversationId).catch((): null => null);
    const currentProfile = await fetchConversationProfile(this.conversationId).catch((): null => null);
    const currentMessages = currentConversation?.conversationId ? await fetchConversationMessages(currentConversation.conversationId).catch((): ConversationMessage[] => []) : [];
    const currentDemo = this.agent ? await fetchCurrentAgentMarketplaceDemo(this.agent).catch((): null => null) : null;
    const currentIntent = this.agent ? await fetchCurrentAgentMarketplaceUpgradeIntent(this.agent).catch((): null => null) : null;
    const currentSession = this.agent ? await fetchCurrentAgentMarketplaceCheckoutSession(this.agent).catch((): null => null) : null;

    const conversation = currentConversation ?? {
      conversationId: this.conversationId || `agent:${this.agent.slug}`,
      conversationKind: this.agent ? 'agent' : 'direct',
      title: this.agent?.name || currentProfile?.displayName || '대화',
      participants: [],
      agentMeta: this.agent ? {
        agentId: this.agent.agentId,
        slug: this.agent.slug,
        headline: this.agent.headline || null,
        category: this.agent.category || null,
        provider: this.agent.provider || null,
        demoTurnLimit: this.agent.demoTurnLimit ?? null
      } : null
    };

    this.conversation = conversation;
    this.profile = currentProfile;
    this.conversationId = conversation.conversationId;
    this.titleEl.textContent = conversation.title;

    const nodes: HTMLElement[] = [];
    if(this.agent) {
      nodes.push(this.createIntroBubble(this.agent));
    } else if(currentProfile) {
      nodes.push(this.createProfileIntroBubble(currentProfile));
    }
    nodes.push(...this.createTimeline(conversation, currentMessages, currentDemo, currentIntent, currentSession));
    if(this.agent) {
      nodes.push(this.createActionsBubble(this.agent, currentDemo, currentIntent, currentSession));
    }

    this.bodyEl.replaceChildren(...nodes);
    this.setMeta(this.buildHeaderMeta(currentProfile, this.agent, currentDemo, currentSession, conversation));
    this.scrollableEl.scrollTop = this.scrollableEl.scrollHeight;
    this.emitConversationEvent('conversation-updated');
  }

  private setMeta(text: string) {
    this.metaEl.textContent = text;
  }

  private createIntroBubble(agent: AgentRegistryAgentDetail) {
    return this.createBubble({
      author: agent.name,
      lines: [
        agent.headline || '대화를 시작해봐.',
        agent.description || '',
        [
          agent.category?.name,
          agent.provider?.displayName,
          agent.demoTurnLimit ? `데모 ${agent.demoTurnLimit}턴` : null
        ].filter(Boolean).join(' · ')
      ].filter(Boolean),
      side: 'left'
    });
  }

  private createProfileIntroBubble(profile: ConversationProfile) {
    return this.createBubble({
      author: profile.displayName,
      lines: [
        profile.headline || '대화를 시작해봐.',
        profile.description || ''
      ].filter(Boolean),
      side: 'left'
    });
  }

  private createTimeline(
    conversation: ConversationSummary,
    messages: ConversationMessage[],
    currentDemo: AgentMarketplaceDemoEngagement | null,
    currentIntent: AgentMarketplaceCheckoutIntent | null,
    currentSession: AgentMarketplaceCheckoutSession | null
  ) {
    const nodes: HTMLElement[] = [];
    const transcript = [...messages];

    if(currentDemo && !transcript.some((item) => item.kind === 'state')) {
      transcript.push({
        messageId: `${currentDemo.engagementId}:live-state`,
        conversationId: conversation.conversationId,
        authorType: 'system',
        authorName: '현재 상태',
        kind: 'state',
        text: `${conversation.title}와의 대화 상태가 이어지고 있어.`,
        meta: [
          currentDemo.state === 'paid_active' ? '정식 플로우 진행 중' : '데모 진행 중',
          currentDemo.remainingTurns !== undefined ? `남은 ${currentDemo.remainingTurns}턴` : null,
          currentDemo.turnUsage !== undefined ? `사용 ${currentDemo.turnUsage}턴` : null
        ].filter(Boolean).join(' · ') || null,
        createdAt: conversation.updatedAt || null
      });
    }

    for(const message of transcript) {
      nodes.push(this.createTranscriptBubble(message));
    }

    if(!transcript.length) {
      nodes.push(this.createBubble({
        author: '현재 상태',
        lines: [
          `${conversation.title}는 아직 시작 전이야.`,
          '바로 메시지를 보내거나 데모를 시작할 수 있어.'
        ],
        side: 'center'
      }));
    }

    if(currentIntent && !transcript.some((item) => item.kind === 'checkout_intent')) {
      nodes.push(this.createBubble({
        author: '결제 준비',
        lines: [[
          '결제 준비됨',
          currentIntent.priceMinor ? `${currentIntent.priceMinor.toLocaleString()} ${currentIntent.currency || 'KRW'}` : null,
          currentIntent.pricingModel || null
        ].filter(Boolean).join(' · ')],
        side: 'center'
      }));
    }

    if(currentSession && !transcript.some((item) => item.kind === 'checkout_session')) {
      nodes.push(this.createBubble({
        author: '결제 세션',
        lines: [[
          currentSession.state === 'paid' ? '결제 완료됨' : '결제 안내 열림',
          currentSession.paymentMethod || null,
          currentSession.providerName || null
        ].filter(Boolean).join(' · ')],
        side: 'center'
      }));
    }

    return nodes;
  }

  private createActionsBubble(
    agent: AgentRegistryAgentDetail,
    currentDemo: AgentMarketplaceDemoEngagement | null,
    currentIntent: AgentMarketplaceCheckoutIntent | null,
    currentSession: AgentMarketplaceCheckoutSession | null
  ) {
    const {bubble, content} = this.createBubbleWithContentHandle({
      author: '다음 액션',
      lines: ['이 대화에서 바로 다음 단계를 진행할 수 있어.'],
      side: 'center'
    });

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginTop: '10px'
    });

    const addButton = (label: string, onClick: () => Promise<void> | void) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.add('btn-primary', 'btn-transparent');
      button.textContent = label;
      Object.assign(button.style, {
        minHeight: '34px',
        padding: '0 12px',
        borderRadius: '999px'
      });

      attachClickEvent(button, async() => {
        const original = button.textContent || label;
        button.textContent = '진행 중...';
        button.setAttribute('disabled', 'true');
        try {
          await onClick();
        } catch(err) {
          this.setMeta(err instanceof Error ? err.message : String(err));
        } finally {
          button.textContent = original;
          button.removeAttribute('disabled');
        }
      });

      actions.append(button);
    };

    addButton(currentDemo ? '대화 다시 열기' : '데모 시작', async() => {
      await startAgentMarketplaceDemoForCurrentChat(agent);
      await this.renderConversation();
    });

    if(currentDemo && currentDemo.state !== 'paid_active') {
      addButton(currentDemo.remainingTurns === 0 ? '유료 전환 준비' : '다음 턴 진행', async() => {
        if(currentDemo.remainingTurns === 0) {
          await createAgentMarketplaceDemoUpgradeIntentForCurrentChat(currentDemo.engagementId);
        } else {
          await consumeAgentMarketplaceDemoTurnForCurrentChat(currentDemo.engagementId);
        }
        await this.renderConversation();
      });
    }

    if(currentIntent) {
      addButton(currentSession ? '결제 안내 다시 보기' : '결제 안내 보기', async() => {
        const payload = currentSession ? {checkoutSession: currentSession} : await createAgentMarketplaceCheckoutSessionForCurrentChat(currentIntent.checkoutIntentId);
        if(!payload.checkoutSession) {
          throw new Error('결제 세션을 열지 못했어.');
        }

        new PopupAgentCheckout(currentIntent, payload.checkoutSession, async(activeSession) => {
          await confirmAgentMarketplaceCheckoutSessionForCurrentChat(activeSession.checkoutSessionId);
          await this.renderConversation();
        });

        await this.renderConversation();
      });
    }

    if(currentDemo && currentSession?.state === 'paid') {
      addButton(currentDemo.state === 'paid_active' ? '정식 플로우 다시 열기' : '정식 플로우 시작', async() => {
        await startAgentMarketplacePaidFlowForCurrentChat(currentDemo.engagementId);
        await this.renderConversation();
      });
    }

    if(currentDemo?.state === 'paid_active') {
      addButton('다음 정식 초안', async() => {
        await continueAgentMarketplacePaidFlowForCurrentChat(currentDemo.engagementId);
        await this.renderConversation();
      });
    }

    content.append(actions);
    return bubble;
  }

  private createBubble(options: {
    author: string,
    lines: string[],
    side: 'left' | 'right' | 'center',
    timestamp?: string | null
  }): HTMLElement {
    return this.createBubbleWithContentHandle(options).bubble;
  }

  private createBubbleWithContentHandle(options: {
    author: string,
    lines: string[],
    side: 'left' | 'right' | 'center',
    timestamp?: string | null
  }): {bubble: HTMLElement, content: HTMLElement} {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble', 'is-group-first', 'is-group-last');

    if(options.side === 'right') {
      bubble.classList.add('is-out');
    } else if(options.side === 'left') {
      bubble.classList.add('is-in');
    } else {
      bubble.classList.add('service');
    }

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('bubble-content-wrapper');

    const content = document.createElement('div');
    content.classList.add('bubble-content');

    if(options.side !== 'center') {
      const name = document.createElement('div');
      name.classList.add('name');
      name.textContent = options.author;
      content.append(name);
    }

    if(options.side === 'center') {
      const serviceMessage = document.createElement('div');
      serviceMessage.classList.add('service-msg');
      serviceMessage.textContent = options.lines.join('\n');
      Object.assign(serviceMessage.style, {
        whiteSpace: 'pre-wrap'
      });
      content.append(serviceMessage);
    } else {
      for(const line of options.lines) {
        const message = document.createElement('div');
        message.classList.add('message');
        message.textContent = line;
        Object.assign(message.style, {
          whiteSpace: 'pre-wrap'
        });
        content.append(message);
      }
    }

    if(options.timestamp) {
      const time = document.createElement('div');
      time.classList.add('time');
      const inner = document.createElement('span');
      inner.classList.add('time-inner');
      inner.append(formatDateAccordingToTodayNew(new Date(options.timestamp)));
      time.append(inner);
      content.append(time);
    }

    contentWrapper.append(content);
    bubble.append(contentWrapper);

    return {bubble, content};
  }

  private createTranscriptBubble(message: ConversationMessage) {
    const side = message.authorType === 'user' ? 'right' : message.authorType === 'agent' ? 'left' : 'center';
    const lines = message.meta ? [message.text, message.meta] : [message.text];

    return this.createBubble({
      author: message.authorName,
      lines,
      side,
      timestamp: message.createdAt || null
    }) as HTMLElement;
  }

  private buildHeaderMeta(
    profile: ConversationProfile | null,
    agent: AgentRegistryAgentDetail | undefined,
    currentDemo: AgentMarketplaceDemoEngagement | null,
    currentSession: AgentMarketplaceCheckoutSession | null,
    currentConversation: ConversationSummary | null
  ) {
    const shared = [
      currentConversation?.updatedAt ? `최근 활동 ${this.formatConversationTime(currentConversation.updatedAt)}` : null
    ];

    if(agent) {
      return [
        agent.category?.name || null,
        currentDemo?.state === 'paid_active' ? '정식 대화 중' : currentDemo ? '데모 진행 중' : '대화 시작 전',
        currentDemo?.remainingTurns !== undefined ? `남은 ${currentDemo.remainingTurns}턴` : null,
        currentSession?.state === 'paid' ? '결제 완료' : null,
        ...shared
      ].filter(Boolean).join(' · ');
    }

    return [
      profile?.headline || '일반 대화',
      ...shared
    ].filter(Boolean).join(' · ');
  }

  private formatConversationTime(value: string) {
    return new Date(value).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private startAutoRefresh() {
    if(this.refreshInterval) {
      window.clearInterval(this.refreshInterval);
    }

    this.refreshInterval = window.setInterval(() => {
      if(this.agent) {
        void this.renderConversation();
      }
    }, 12000);
  }

  private emitConversationEvent(name: 'conversation-opened' | 'conversation-updated') {
    window.dispatchEvent(new CustomEvent(name, {
      detail: {
        conversationId: this.conversationId,
        conversationKind: this.conversation?.conversationKind || 'agent',
        agentSlug: this.agent?.slug
      }
    }));
  }
}
