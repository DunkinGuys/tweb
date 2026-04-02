import {SliderSuperTab} from '@components/slider';
import PopupAgentCheckout from '@components/popups/agentCheckout';
import {
  fetchAgentRegistryAgentDetail,
  type AgentRegistryAgentDetail
} from '@lib/agentRegistry';
import {
  fetchConversationDetail,
  fetchConversationMessages,
  sendConversationMessage,
  type ConversationMessage,
  type ConversationSummary
} from '@lib/conversations';
import {
  consumeAgentMarketplaceDemoTurnForCurrentChat,
  continueAgentMarketplacePaidFlowForCurrentChat,
  createAgentMarketplaceCheckoutSessionForCurrentChat,
  createAgentMarketplaceDemoUpgradeIntentForCurrentChat,
  fetchCurrentAgentMarketplaceCheckoutSession,
  fetchCurrentAgentMarketplaceDemo,
  fetchCurrentAgentMarketplaceUpgradeIntent,
  startAgentMarketplaceDemoForCurrentChat,
  startAgentMarketplacePaidFlowForCurrentChat,
  confirmAgentMarketplaceCheckoutSessionForCurrentChat,
  type AgentMarketplaceCheckoutIntent,
  type AgentMarketplaceCheckoutSession,
  type AgentMarketplaceDemoEngagement
} from '@lib/agentMarketplaceDemo';
import {attachClickEvent} from '@helpers/dom/clickEvent';

export default class AppAgentConversationTab extends SliderSuperTab {
  public static noSame = true;

  private bodyEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private composerEl: HTMLDivElement;
  private composerInputEl: HTMLTextAreaElement;
  private agent?: AgentRegistryAgentDetail;
  private conversationId?: string;

  public init(initialState?: string | {conversationId?: string, agentSlug?: string}) {
    this.container.classList.add('agent-conversation-tab');
    this.title.textContent = '에이전트';

    this.bodyEl = document.createElement('div');
    Object.assign(this.bodyEl.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px'
    });

    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '12px',
      opacity: '0.72',
      lineHeight: '1.45'
    });

    this.composerEl = document.createElement('div');
    Object.assign(this.composerEl.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '0 16px 16px'
    });

    this.composerInputEl = document.createElement('textarea');
    this.composerInputEl.placeholder = '에이전트에게 바로 메시지를 보내봐';
    Object.assign(this.composerInputEl.style, {
      minHeight: '88px',
      padding: '12px 14px',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.04)',
      color: 'inherit',
      resize: 'vertical',
      outline: 'none'
    });

    const sendButton = document.createElement('button');
    sendButton.textContent = '메시지 보내기';
    Object.assign(sendButton.style, {
      alignSelf: 'flex-end',
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      border: '1px solid rgba(94, 234, 212, 0.22)',
      background: 'rgba(94, 234, 212, 0.16)',
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: '600'
    });

    attachClickEvent(sendButton, async() => {
      if(!this.conversationId) {
        this.setStatus('먼저 에이전트 대화를 시작해야 해.');
        return;
      }

      const text = this.composerInputEl.value.trim();
      if(!text) {
        this.setStatus('보낼 메시지를 먼저 적어줘.');
        return;
      }

      const originalLabel = sendButton.textContent || '메시지 보내기';
      sendButton.textContent = '전송 중...';
      sendButton.setAttribute('disabled', 'true');
      try {
        await sendConversationMessage(this.conversationId, text);
        this.composerInputEl.value = '';
        if(this.agent) {
          await this.renderConversation(this.agent);
        }
      } catch(err) {
        this.setStatus(err instanceof Error ? err.message : String(err));
      } finally {
        sendButton.textContent = originalLabel;
        sendButton.removeAttribute('disabled');
      }
    });

    this.composerEl.append(this.composerInputEl, sendButton);

    this.scrollable.append(this.bodyEl);
    this.scrollable.append(this.composerEl);
    this.bodyEl.append(this.statusEl);

    if(typeof initialState === 'string') {
      void this.openAgent({agentSlug: initialState});
    } else if(initialState?.agentSlug || initialState?.conversationId) {
      void this.openAgent(initialState);
    } else {
      this.setStatus('열 에이전트를 찾을 수 없어.');
    }
  }

  public async openAgent(target: {conversationId?: string, agentSlug?: string}) {
    const trimmedSlug = target.agentSlug?.trim();
    const trimmedConversationId = target.conversationId?.trim();
    if(!trimmedSlug && !trimmedConversationId) {
      this.setStatus('열 에이전트를 찾을 수 없어.');
      return;
    }

    this.setStatus('에이전트 대화를 불러오는 중이야...');
    this.bodyEl.replaceChildren(this.statusEl);

    try {
      const conversation = trimmedConversationId ? await fetchConversationDetail(trimmedConversationId).catch((): null => null) : null;
      const agentSlug = trimmedSlug || conversation?.agentMeta?.slug;
      if(!agentSlug) {
        throw new Error('에이전트 대화 정보를 찾을 수 없어.');
      }

      const agent = await fetchAgentRegistryAgentDetail(agentSlug);
      this.agent = agent;
      this.conversationId = conversation?.conversationId || trimmedConversationId || undefined;
      this.title.textContent = agent.name;
      await this.renderConversation(agent);
    } catch(err) {
      this.setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  private async renderConversation(agent: AgentRegistryAgentDetail) {
    const currentConversation = this.conversationId ? await fetchConversationDetail(this.conversationId).catch((): null => null) : null;
    const [currentDemo, currentIntent, currentSession] = await Promise.all([
      fetchCurrentAgentMarketplaceDemo(agent).catch((): null => null),
      fetchCurrentAgentMarketplaceUpgradeIntent(agent).catch((): null => null),
      fetchCurrentAgentMarketplaceCheckoutSession(agent).catch((): null => null)
    ]);
    const currentMessages = currentConversation?.conversationId ? await fetchConversationMessages(currentConversation.conversationId).catch((): ConversationMessage[] => []) : [];

    const timeline = this.createTimeline(
      currentConversation ?? {
        conversationId: this.conversationId || `agent:${agent.slug}`,
        conversationKind: 'agent',
        title: agent.name,
        participants: [],
        agentMeta: {
          agentId: agent.agentId,
          slug: agent.slug,
          headline: agent.headline || null,
          category: agent.category || null,
          provider: agent.provider || null,
          demoTurnLimit: agent.demoTurnLimit ?? null
        }
      },
      currentMessages,
      currentDemo,
      currentIntent,
      currentSession
    );

    this.bodyEl.replaceChildren(
      this.statusEl,
      this.createHeroBubble(agent),
      timeline,
      this.createActionsBubble(agent, currentDemo, currentIntent, currentSession)
    );
    this.setStatus(`${agent.name}를 독립 대화상대처럼 바로 열 수 있어.`);
  }

  private setStatus(text: string) {
    this.statusEl.textContent = text;
  }

  private createHeroBubble(agent: AgentRegistryAgentDetail) {
    return this.createBubble({
      author: agent.name,
      accent: 'rgba(94, 234, 212, 0.16)',
      lines: [
        agent.headline || '대화를 시작해봐.',
        agent.description || '',
        [
          agent.category?.name,
          agent.provider?.displayName,
          agent.demoTurnLimit ? `데모 ${agent.demoTurnLimit}턴` : null
        ].filter(Boolean).join(' · ')
      ].filter(Boolean)
    });
  }

  private createTimeline(
    conversation: ConversationSummary,
    messages: ConversationMessage[],
    currentDemo: AgentMarketplaceDemoEngagement | null,
    currentIntent: AgentMarketplaceCheckoutIntent | null,
    currentSession: AgentMarketplaceCheckoutSession | null
  ) {
    const timeline = document.createElement('div');
    Object.assign(timeline.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    });

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
        ].filter(Boolean).join(' · ') || null
      });
    }

    for(const message of transcript) {
      timeline.append(this.createTranscriptBubble(message));
    }

    if(!transcript.length) {
      timeline.append(this.createBubble({
        author: '현재 상태',
        accent: 'rgba(255,255,255,0.06)',
        lines: [
          `${conversation.title}는 아직 시작 전이야.`,
          '바로 데모를 시작해서 독립 대화방처럼 써볼 수 있어.'
        ]
      }));
    }

    if(currentIntent && !transcript.some((item) => item.kind === 'checkout_intent')) {
      timeline.append(this.createBubble({
        author: '결제 준비',
        accent: 'rgba(251, 191, 36, 0.12)',
        lines: [[
          '결제 준비됨',
          currentIntent.priceMinor ? `${currentIntent.priceMinor.toLocaleString()} ${currentIntent.currency || 'KRW'}` : null,
          currentIntent.pricingModel || null
        ].filter(Boolean).join(' · ')]
      }));
    }

    if(currentSession && !transcript.some((item) => item.kind === 'checkout_session')) {
      timeline.append(this.createBubble({
        author: '결제 세션',
        accent: 'rgba(255,255,255,0.06)',
        lines: [[
          currentSession.state === 'paid' ? '결제 완료됨' : '결제 안내 열림',
          currentSession.paymentMethod || null,
          currentSession.providerName || null
        ].filter(Boolean).join(' · ')]
      }));
    }

    return timeline;
  }

  private createActionsBubble(
    agent: AgentRegistryAgentDetail,
    currentDemo: AgentMarketplaceDemoEngagement | null,
    currentIntent: AgentMarketplaceCheckoutIntent | null,
    currentSession: AgentMarketplaceCheckoutSession | null
  ) {
    const bubble = this.createBubble({
      author: '다음 액션',
      accent: 'rgba(255,255,255,0.05)',
      lines: ['이 대화방에서 바로 다음 단계를 진행할 수 있어.']
    });

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginTop: '8px'
    });

    const addButton = (label: string, onClick: () => Promise<void> | void, tone = 'default') => {
      const button = document.createElement('button');
      button.textContent = label;
      Object.assign(button.style, {
        minHeight: '34px',
        padding: '0 12px',
        borderRadius: '999px',
        border: tone === 'primary' ? '1px solid rgba(94, 234, 212, 0.22)' : '1px solid rgba(255,255,255,0.14)',
        background: tone === 'primary' ? 'rgba(94, 234, 212, 0.16)' : 'rgba(255,255,255,0.06)',
        color: 'inherit',
        cursor: 'pointer',
        fontWeight: '600'
      });
      attachClickEvent(button, async() => {
        const original = button.textContent || label;
        button.textContent = '진행 중...';
        button.setAttribute('disabled', 'true');
        try {
          await onClick();
        } catch(err) {
          this.setStatus(err instanceof Error ? err.message : String(err));
        } finally {
          button.textContent = original;
          button.removeAttribute('disabled');
        }
      });
      actions.append(button);
    };

    addButton(currentDemo ? '대화 다시 열기' : '데모 시작', async() => {
      await startAgentMarketplaceDemoForCurrentChat(agent);
      await this.renderConversation(agent);
    }, 'primary');

    if(currentDemo && currentDemo.state !== 'paid_active') {
      addButton(currentDemo.remainingTurns === 0 ? '유료 전환 준비' : '다음 턴 진행', async() => {
        if(currentDemo.remainingTurns === 0) {
          await createAgentMarketplaceDemoUpgradeIntentForCurrentChat(currentDemo.engagementId);
        } else {
          await consumeAgentMarketplaceDemoTurnForCurrentChat(currentDemo.engagementId);
        }
        await this.renderConversation(agent);
      });
    }

    if(currentIntent) {
      addButton(currentSession ? '결제 안내 다시 보기' : '결제 안내 보기', async() => {
        const payload = currentSession ? {checkoutSession: currentSession} : await createAgentMarketplaceCheckoutSessionForCurrentChat(currentIntent.checkoutIntentId);
        if(!payload.checkoutSession) {
          throw new Error('결제 세션을 열지 못했어');
        }

        new PopupAgentCheckout(currentIntent, payload.checkoutSession, async(activeSession) => {
          await confirmAgentMarketplaceCheckoutSessionForCurrentChat(activeSession.checkoutSessionId);
          await this.renderConversation(agent);
        });

        await this.renderConversation(agent);
      });
    }

    if(currentDemo && currentSession?.state === 'paid') {
      addButton(currentDemo.state === 'paid_active' ? '정식 플로우 다시 열기' : '정식 플로우 시작', async() => {
        await startAgentMarketplacePaidFlowForCurrentChat(currentDemo.engagementId);
        await this.renderConversation(agent);
      });
    }

    if(currentDemo?.state === 'paid_active') {
      addButton('다음 정식 초안', async() => {
        await continueAgentMarketplacePaidFlowForCurrentChat(currentDemo.engagementId);
        await this.renderConversation(agent);
      });
    }

    bubble.append(actions);
    return bubble;
  }

  private createBubble(options: {
    author: string,
    lines: string[],
    accent: string
  }) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    });

    const author = document.createElement('div');
    author.textContent = options.author;
    Object.assign(author.style, {
      fontSize: '12px',
      fontWeight: '700',
      opacity: '0.68',
      paddingLeft: '6px'
    });

    const bubble = document.createElement('div');
    Object.assign(bubble.style, {
      padding: '14px 16px',
      borderRadius: '18px',
      background: options.accent,
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    for(const line of options.lines) {
      const text = document.createElement('div');
      text.textContent = line;
      Object.assign(text.style, {
        fontSize: '13px',
        lineHeight: '1.5',
        opacity: '0.92'
      });
      bubble.append(text);
    }

    wrapper.append(author, bubble);
    return wrapper;
  }

  private createTranscriptBubble(message: ConversationMessage) {
    const accent = message.authorType === 'agent' ? 'rgba(94, 234, 212, 0.16)' : 'rgba(255,255,255,0.06)';
    const lines = [message.text];
    if(message.meta) {
      lines.push(message.meta);
    }

    return this.createBubble({
      author: message.authorName,
      accent,
      lines
    });
  }
}
