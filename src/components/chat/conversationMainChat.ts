import appSidebarRight from '@components/sidebarRight';
import {
  mountConversationMessageBubble,
  mountConversationServiceDescriptionCard,
  mountConversationServiceCard,
  type ConversationBubbleAction
} from '@components/chat/conversationBubbleFactory';
import AppConversationProfileTab from '@components/sidebarRight/tabs/conversationProfile';
import PopupAgentCheckout from '@components/popups/agentCheckout';
import ButtonIcon from '@components/buttonIcon';
import Icon from '@components/icon';
import InputFieldAnimated from '@components/inputFieldAnimated';
import {attachClickEvent} from '@helpers/dom/clickEvent';
import {
  type AgentRegistryAgentDetail
} from '@lib/agentRegistry';
import {
  sendConversationMessage,
  type ConversationSummary,
  type ConversationProfile
} from '@lib/conversations';
import {
  loadConversationMainChatState,
  type ConversationMainChatTarget
} from '@lib/conversationMainChatModel';
import {buildConversationMainChatViewModel} from '@lib/conversationMainChatViewModel';
import type {ConversationSyntheticMessageSeed} from '@lib/conversationSyntheticMessagesAdapter';
import {type ConversationActionDefinition} from '@lib/conversationMainChatTimeline';
import {
  confirmAgentMarketplaceCheckoutSessionForCurrentChat,
  consumeAgentMarketplaceDemoTurnForCurrentChat,
  continueAgentMarketplacePaidFlowForCurrentChat,
  createAgentMarketplaceCheckoutSessionForCurrentChat,
  createAgentMarketplaceDemoUpgradeIntentForCurrentChat,
  startAgentMarketplaceDemoForCurrentChat,
  startAgentMarketplacePaidFlowForCurrentChat,
  type AgentMarketplaceCheckoutIntent,
  type AgentMarketplaceCheckoutSession,
  type AgentMarketplaceDemoEngagement
} from '@lib/agentMarketplaceDemo';

export default class ConversationMainChat {
  public container: HTMLDivElement;

  private backgroundEl: HTMLDivElement;
  private headerEl: HTMLDivElement;
  private headerAvatarEl: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private metaEl: HTMLDivElement;
  private profileButtonEl: HTMLButtonElement;
  private bubblesEl: HTMLDivElement;
  private scrollableEl: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private composerEl: HTMLDivElement;
  private composerInputEl: HTMLElement;
  private composerInputField: InputFieldAnimated;
  private sendButtonEl: HTMLButtonElement;
  private agent?: AgentRegistryAgentDetail;
  private conversation?: ConversationSummary | null;
  private profile?: ConversationProfile | null;
  private conversationId?: string;
  private syntheticMessageSeeds: ConversationSyntheticMessageSeed[] = [];
  private refreshInterval?: number;
  private bubbleDisposers: Array<() => void> = [];

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

    this.headerAvatarEl = document.createElement('div');
    this.headerAvatarEl.classList.add('dialog-avatar');
    Object.assign(this.headerAvatarEl.style, {
      width: '42px',
      height: '42px',
      marginRight: '12px',
      flex: '0 0 auto',
      display: 'grid',
      placeItems: 'center',
      fontWeight: '700',
      fontSize: '16px'
    });

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
    person.append(this.headerAvatarEl, content);
    chatInfo.append(person);
    attachClickEvent(chatInfo, async() => {
      await this.openProfile();
    });
    chatInfoContainer.append(chatInfo);

    const chatUtils = document.createElement('div');
    chatUtils.classList.add('chat-utils');

    this.profileButtonEl = ButtonIcon('info') as HTMLButtonElement;
    attachClickEvent(this.profileButtonEl, async() => {
      await this.openProfile();
    });

    this.headerEl.append(chatInfoContainer);
    chatUtils.append(this.profileButtonEl);
    this.headerEl.append(chatUtils);

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

    this.composerInputField = new InputFieldAnimated({
      placeholder: 'Message',
      name: 'conversation-message',
      withLinebreaks: true
    });
    this.composerInputField.input.tabIndex = -1;
    this.composerInputField.input.classList.replace('input-field-input', 'input-message-input');
    this.composerInputField.inputFake.classList.replace('input-field-input', 'input-message-input');
    this.composerInputEl = this.composerInputField.input;
    this.composerInputEl.addEventListener('keydown', (event) => {
      if(event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendButtonEl.click();
      }
    });

    const sendButtonContainer = document.createElement('div');
    sendButtonContainer.classList.add('btn-send-container');

    this.sendButtonEl = ButtonIcon() as HTMLButtonElement;
    this.sendButtonEl.classList.add('btn-circle', 'btn-send', 'animated-button-icon', 'send');
    this.sendButtonEl.append(Icon('send', 'animated-button-icon-icon', 'btn-send-icon-send'));

    attachClickEvent(this.sendButtonEl, async() => {
      await this.handleSendMessage();
    });

    sendButtonContainer.append(this.sendButtonEl);
    inputMessageContainer.append(
      this.composerInputField.input,
      this.composerInputField.placeholder,
      this.composerInputField.inputFake,
      sendButtonContainer
    );
    this.composerInputField.onFakeInput();
    newMessageWrapper.append(inputMessageContainer);
    rowsWrapper.append(newMessageWrapper);
    rowsWrapperWrapper.append(rowsWrapper);
    inputContainer.append(rowsWrapperWrapper);
    this.composerEl.append(inputContainer);

    this.container.append(this.backgroundEl, this.headerEl, this.bubblesEl, this.composerEl);
  }

  public async openConversation(target: ConversationMainChatTarget) {
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
    this.clearBubbleDisposers();

    try {
      const state = await loadConversationMainChatState(target);
      this.conversation = state.conversation;
      this.conversationId = state.conversationId;
      this.profile = state.profile;
      this.agent = state.agent;
      const viewModel = buildConversationMainChatViewModel(state);
      this.titleEl.textContent = viewModel.title;
      this.updateHeaderAvatar(viewModel.avatarLabel, viewModel.avatarBackground);
      this.startAutoRefresh();
      await this.renderConversation(state);
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

    const text = this.readComposerText();
    if(!text) {
      this.setMeta('보낼 메시지를 먼저 적어줘.');
      return;
    }

    this.sendButtonEl.classList.add('is-loading');
    this.sendButtonEl.setAttribute('disabled', 'true');
    try {
      await sendConversationMessage(this.conversationId, text);
      this.composerInputField.setValueSilently('');
      this.composerInputField.onFakeInput();
      await this.renderConversation();
    } catch(err) {
      this.setMeta(err instanceof Error ? err.message : String(err));
    } finally {
      this.sendButtonEl.classList.remove('is-loading');
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

  private async renderConversation(prefetchedState?: Awaited<ReturnType<typeof loadConversationMainChatState>>) {
    const target = {
      conversationId: this.conversationId,
      agentSlug: this.agent?.slug
    };
    if(!target.conversationId && !target.agentSlug) {
      return;
    }

    const state = prefetchedState || await loadConversationMainChatState(target);

    this.conversation = state.conversation;
    this.profile = state.profile;
    this.agent = state.agent;
    this.conversationId = state.conversationId;
    const viewModel = buildConversationMainChatViewModel(state);
    this.titleEl.textContent = viewModel.title;
    this.updateHeaderAvatar(viewModel.avatarLabel, viewModel.avatarBackground);
    this.syntheticMessageSeeds = viewModel.syntheticMessageSeeds;

    const nodes = this.createTimeline(viewModel.timelineItems);
    if(this.agent) {
      nodes.push(this.createActionsBubble(this.agent, viewModel.actionDefinitions, state.demo, state.checkoutIntent, state.checkoutSession));
    }

    this.clearBubbleDisposers();
    this.bodyEl.replaceChildren(...nodes);
    this.setMeta(viewModel.meta);
    this.scrollableEl.scrollTop = this.scrollableEl.scrollHeight;
    this.emitConversationEvent('conversation-updated');
  }

  private setMeta(text: string) {
    this.metaEl.textContent = text;
  }

  private createTimeline(items: ReturnType<typeof buildConversationMainChatViewModel>['timelineItems']) {
    const nodes: HTMLElement[] = [];

    for(const item of items) {
      if(item.kind === 'description') {
        nodes.push(this.mountServiceDescriptionCard(item));
      } else if(item.kind === 'service') {
        nodes.push(this.mountServiceCard(item.lines));
      } else {
        nodes.push(this.mountMessageBubble(item) as HTMLElement);
      }
    }

    return nodes;
  }

  private createActionsBubble(
    agent: AgentRegistryAgentDetail,
    actions: ConversationActionDefinition[],
    currentDemo: AgentMarketplaceDemoEngagement | null,
    currentIntent: AgentMarketplaceCheckoutIntent | null,
    currentSession: AgentMarketplaceCheckoutSession | null
  ) {
    const primaryRow: ConversationBubbleAction[] = [];
    const secondaryRow: ConversationBubbleAction[] = [];

    for(const action of actions) {
      const row = action.row === 'primary' ? primaryRow : secondaryRow;
      row.push({
        label: action.label,
        onClick: () => {
          void this.handleActionIntent(action, agent, currentDemo, currentIntent, currentSession);
        }
      });
    }

    const actionRows = [primaryRow, secondaryRow].filter((row) => row.length);
    return this.mountServiceCard([
      '이 대화에서 바로 다음 단계를 진행할 수 있어.'
    ], actionRows);
  }

  private async handleActionIntent(
    action: ConversationActionDefinition,
    agent: AgentRegistryAgentDetail,
    currentDemo: AgentMarketplaceDemoEngagement | null,
    currentIntent: AgentMarketplaceCheckoutIntent | null,
    currentSession: AgentMarketplaceCheckoutSession | null
  ) {
    this.setMeta(`${action.label} 진행 중이야...`);
    try {
      switch(action.intent) {
        case 'start_demo':
          await startAgentMarketplaceDemoForCurrentChat(agent);
          break;
        case 'advance_demo':
          if(!currentDemo) {
            throw new Error('진행 중인 데모가 없어.');
          }
          await consumeAgentMarketplaceDemoTurnForCurrentChat(currentDemo.engagementId);
          break;
        case 'prepare_upgrade':
          if(!currentDemo) {
            throw new Error('전환할 데모가 없어.');
          }
          await createAgentMarketplaceDemoUpgradeIntentForCurrentChat(currentDemo.engagementId);
          break;
        case 'open_checkout': {
          if(!currentIntent) {
            throw new Error('결제 의도가 없어.');
          }

          const payload = currentSession ? {checkoutSession: currentSession} : await createAgentMarketplaceCheckoutSessionForCurrentChat(currentIntent.checkoutIntentId);
          if(!payload.checkoutSession) {
            throw new Error('결제 세션을 열지 못했어.');
          }

          new PopupAgentCheckout(currentIntent, payload.checkoutSession, async(activeSession) => {
            await confirmAgentMarketplaceCheckoutSessionForCurrentChat(activeSession.checkoutSessionId);
            await this.renderConversation();
          });
          break;
        }
        case 'start_paid':
          if(!currentDemo) {
            throw new Error('정식 플로우를 시작할 대화가 없어.');
          }
          await startAgentMarketplacePaidFlowForCurrentChat(currentDemo.engagementId);
          break;
        case 'continue_paid':
          if(!currentDemo) {
            throw new Error('이어갈 정식 대화가 없어.');
          }
          await continueAgentMarketplacePaidFlowForCurrentChat(currentDemo.engagementId);
          break;
      }

      await this.renderConversation();
    } catch(err) {
      this.setMeta(err instanceof Error ? err.message : String(err));
    }
  }

  private mountMessageBubble(options: {
    author?: string,
    lines: string[],
    side: 'left' | 'right' | 'center',
    timestamp?: string | null
  }) {
    const {element, dispose} = mountConversationMessageBubble(options);
    this.bubbleDisposers.push(dispose);
    return element;
  }

  private mountServiceCard(lines: Array<string | null | undefined>, actionRows?: ConversationBubbleAction[][]) {
    const {element, dispose} = mountConversationServiceCard({
      side: 'center',
      lines: lines.filter(Boolean) as string[],
      actionRows
    });
    this.bubbleDisposers.push(dispose);
    return element;
  }

  private mountServiceDescriptionCard(options: {
    title: string,
    subtitle?: string | null,
    bullets?: string[]
  }) {
    const {element, dispose} = mountConversationServiceDescriptionCard(options);
    this.bubbleDisposers.push(dispose);
    return element;
  }

  private clearBubbleDisposers() {
    for(const dispose of this.bubbleDisposers.splice(0)) {
      dispose();
    }
  }

  private readComposerText() {
    return this.composerInputEl.innerText.replace(/\u00A0/g, ' ').trim();
  }

  private updateHeaderAvatar(label: string, avatarBackground: string) {
    this.headerAvatarEl.textContent = label;
    this.headerAvatarEl.style.background = avatarBackground;
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
