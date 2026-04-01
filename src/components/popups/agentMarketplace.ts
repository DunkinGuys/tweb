import PopupElement from '.';
import PopupAgentCheckout from './agentCheckout';

import {
  type AgentRegistryAgentDetail,
  type AgentRegistryAgentSummary,
  type AgentRegistryCategory,
  fetchAgentRegistryAgentDetail,
  fetchAgentRegistryAgents,
  fetchAgentRegistryCategories
} from '@lib/agentRegistry';
import {
  type AgentMarketplaceCheckoutSession,
  type AgentMarketplaceCheckoutIntent,
  continueAgentMarketplacePaidFlowForCurrentChat,
  confirmAgentMarketplaceCheckoutSessionForCurrentChat,
  createAgentMarketplaceCheckoutSessionForCurrentChat,
  createAgentMarketplaceDemoUpgradeIntentForCurrentChat,
  consumeAgentMarketplaceDemoTurnForCurrentChat,
  fetchCurrentAgentMarketplaceDemo,
  fetchCurrentAgentMarketplaceCheckoutSession,
  fetchCurrentAgentMarketplaceUpgradeIntent,
  startAgentMarketplacePaidFlowForCurrentChat,
  startAgentMarketplaceDemoForCurrentChat
} from '@lib/agentMarketplaceDemo';
import {attachClickEvent} from '@helpers/dom/clickEvent';

export default class PopupAgentMarketplace extends PopupElement {
  private categoriesEl: HTMLDivElement;
  private agentsEl: HTMLDivElement;
  private detailEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private searchInputEl: HTMLInputElement;
  private pricingFilterEl: HTMLSelectElement;
  private categories: AgentRegistryCategory[] = [];
  private selectedCategory?: string;
  private selectedAgent?: AgentRegistryAgentDetail;
  private selectedEngagementId?: string;
  private searchQuery = '';
  private selectedPricingModel = '';
  private searchDebounce?: number;
  private dismissAfterStart: boolean;
  private embedded: boolean;

  constructor(options: {
    dismissAfterStart?: boolean,
    embedded?: boolean
  } = {}) {
    const title = document.createElement('span');
    title.textContent = 'Agent 둘러보기';
    super('popup-peer', {
      closable: true,
      body: true,
      scrollable: true,
      title
    });

    this.dismissAfterStart = options.dismissAfterStart !== false;
    this.embedded = options.embedded === true;

    this.construct();
  }

  public getEmbeddedBody() {
    return this.body;
  }

  private async construct() {
    this.body.classList.add('agent-marketplace-popup-body');
    Object.assign(this.body.style, {
      minWidth: this.embedded ? '100%' : 'min(880px, calc(100vw - 48px))',
      maxWidth: this.embedded ? '100%' : 'min(880px, calc(100vw - 48px))',
      padding: '16px'
    });

    this.statusEl = document.createElement('div');
    this.searchInputEl = document.createElement('input');
    this.pricingFilterEl = document.createElement('select');
    this.categoriesEl = document.createElement('div');
    this.agentsEl = document.createElement('div');
    this.detailEl = document.createElement('div');

    Object.assign(this.statusEl.style, {
      fontSize: '13px',
      opacity: '0.8',
      marginBottom: '12px'
    });
    Object.assign(this.categoriesEl.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginBottom: '16px'
    });
    const controls = this.buildControls();

    const content = document.createElement('div');
    Object.assign(content.style, {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
      gap: '16px',
      alignItems: 'start'
    });

    const agentsPane = document.createElement('div');
    const detailPane = document.createElement('div');
    Object.assign(agentsPane.style, {display: 'flex', flexDirection: 'column', gap: '12px'});
    Object.assign(detailPane.style, {display: 'flex', flexDirection: 'column', gap: '12px'});

    agentsPane.append(this.agentsEl);
    detailPane.append(this.detailEl);
    content.append(agentsPane, detailPane);
    this.body.append(this.statusEl, controls, this.categoriesEl, content);

    this.setStatus('카테고리와 에이전트 목록을 불러오는 중이야...');
    try {
      this.categories = await fetchAgentRegistryCategories();
      this.renderCategories();
      await this.loadAgents();
    } catch(err) {
      this.setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  private buildControls() {
    const controls = document.createElement('div');
    Object.assign(controls.style, {
      display: 'flex',
      gap: '10px',
      marginBottom: '14px',
      flexWrap: 'wrap'
    });

    this.searchInputEl.type = 'search';
    this.searchInputEl.placeholder = 'Agent 이름, 설명, 카테고리로 검색';
    this.searchInputEl.value = this.searchQuery;
    Object.assign(this.searchInputEl.style, {
      flex: '1 1 280px',
      minHeight: '38px',
      padding: '0 12px',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'rgba(255, 255, 255, 0.06)',
      color: 'inherit'
    });
    this.searchInputEl.addEventListener('input', () => {
      this.searchQuery = this.searchInputEl.value.trim();
      if(this.searchDebounce) {
        window.clearTimeout(this.searchDebounce);
      }
      this.searchDebounce = window.setTimeout(() => {
        void this.loadAgents();
      }, 180);
    });

    this.pricingFilterEl.replaceChildren(
      this.createOption('', '전체 가격'),
      this.createOption('demo_then_paid', '데모 후 유료'),
      this.createOption('subscription', '구독형'),
      this.createOption('per_turn', '턴당 과금')
    );
    this.pricingFilterEl.value = this.selectedPricingModel;
    Object.assign(this.pricingFilterEl.style, {
      minHeight: '38px',
      padding: '0 12px',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'rgba(255, 255, 255, 0.06)',
      color: 'inherit'
    });
    this.pricingFilterEl.addEventListener('change', () => {
      this.selectedPricingModel = this.pricingFilterEl.value;
      void this.loadAgents();
    });

    controls.append(this.searchInputEl, this.pricingFilterEl);
    return controls;
  }

  private createOption(value: string, label: string) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  private setStatus(text: string) {
    this.statusEl.textContent = text;
  }

  private renderCategories() {
    this.categoriesEl.replaceChildren(
      this.createCategoryButton(undefined, '전체'),
      ...this.categories.map((category) => this.createCategoryButton(category.slug, category.name))
    );
  }

  private createCategoryButton(slug: string | undefined, label: string) {
    const button = document.createElement('button');
    button.textContent = label;
    Object.assign(button.style, {
      minHeight: '32px',
      padding: '0 12px',
      borderRadius: '999px',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      background: slug === this.selectedCategory ? 'rgba(94, 234, 212, 0.14)' : 'rgba(255, 255, 255, 0.06)',
      cursor: 'pointer',
      color: 'inherit'
    });
    if(slug) {
      button.dataset.categorySlug = slug;
    }
    attachClickEvent(button, async() => {
      this.selectedCategory = slug;
      this.refreshCategoryButtons();
      await this.loadAgents();
    });
    return button;
  }

  private refreshCategoryButtons() {
    const buttons = Array.from(this.categoriesEl.querySelectorAll('button'));
    buttons.forEach((button, index) => {
      const slug = index === 0 ? undefined : button.dataset.categorySlug || undefined;
      button.style.background = slug === this.selectedCategory ? 'rgba(94, 234, 212, 0.14)' : 'rgba(255, 255, 255, 0.06)';
    });
  }

  private async loadAgents() {
    const searchLabel = this.searchQuery ? `검색어 "${this.searchQuery}"` : '';
    const categoryLabel = this.selectedCategory ? `카테고리 "${this.selectedCategory}"` : '';
    const pricingLabel = this.selectedPricingModel ? `가격 "${this.selectedPricingModel}"` : '';
    const contextLabel = [searchLabel, categoryLabel, pricingLabel].filter(Boolean).join(' · ');
    this.setStatus(contextLabel ? `${contextLabel} 기준으로 에이전트를 불러오는 중이야...` : '에이전트 목록을 불러오는 중이야...');
    this.agentsEl.replaceChildren();
    this.detailEl.replaceChildren();

    const agents = await fetchAgentRegistryAgents({
      category: this.selectedCategory,
      pricingModel: this.selectedPricingModel || undefined,
      publicationStatus: 'published',
      q: this.searchQuery || undefined
    });

    this.setStatus(contextLabel ? `${contextLabel} 기준으로 ${agents.length}개 에이전트를 찾았어.` : `${agents.length}개 에이전트를 찾았어.`);
    if(!agents.length) {
      this.agentsEl.textContent = '조건에 맞는 에이전트가 아직 없어.';
      return;
    }

    const cards = agents.map((agent) => this.createAgentCard(agent));
    this.agentsEl.replaceChildren(...cards);
    await this.showAgentDetail(agents[0].slug);
  }

  private createAgentCard(agent: AgentRegistryAgentSummary) {
    const button = document.createElement('button');
    button.dataset.agentSlug = agent.slug;
    Object.assign(button.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      width: '100%',
      padding: '14px',
      textAlign: 'left',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'rgba(255, 255, 255, 0.05)',
      color: 'inherit',
      cursor: 'pointer',
      marginBottom: '10px'
    });

    const name = document.createElement('strong');
    name.textContent = agent.name;
    const headline = document.createElement('div');
    headline.textContent = agent.headline || '';
    Object.assign(headline.style, {fontSize: '13px', opacity: '0.85', lineHeight: '1.45'});
    const meta = document.createElement('div');
    meta.textContent = [
      agent.category?.name,
      agent.publicationStatus,
      agent.priceMinor ? `${agent.priceMinor.toLocaleString()} ${agent.currency || 'KRW'}` : null
    ].filter(Boolean).join(' · ');
    Object.assign(meta.style, {fontSize: '12px', opacity: '0.7'});

    button.append(name, headline, meta);
    attachClickEvent(button, async() => {
      await this.showAgentDetail(agent.slug);
    });
    return button;
  }

  private async showAgentDetail(slug: string) {
    this.detailEl.textContent = '에이전트 상세를 불러오는 중이야...';
    try {
      const detail = await fetchAgentRegistryAgentDetail(slug);
      this.selectedAgent = detail;
      let currentDemo: Awaited<ReturnType<typeof fetchCurrentAgentMarketplaceDemo>> = null;
      let currentUpgradeIntent: AgentMarketplaceCheckoutIntent | null = null;
      let currentCheckoutSession: AgentMarketplaceCheckoutSession | null = null;
      try {
        currentDemo = await fetchCurrentAgentMarketplaceDemo(detail);
      } catch(err) {
        console.warn('Failed to fetch current marketplace demo state', err);
      }
      try {
        currentUpgradeIntent = await fetchCurrentAgentMarketplaceUpgradeIntent(detail);
      } catch(err) {
        console.warn('Failed to fetch current marketplace checkout state', err);
      }
      try {
        currentCheckoutSession = await fetchCurrentAgentMarketplaceCheckoutSession(detail);
      } catch(err) {
        console.warn('Failed to fetch current marketplace checkout session', err);
      }
      this.selectedEngagementId = currentDemo?.engagementId;
      this.detailEl.replaceChildren(this.buildDetail(detail, currentDemo, currentUpgradeIntent, currentCheckoutSession));
    } catch(err) {
      this.detailEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }

  private buildDetail(
    detail: AgentRegistryAgentDetail,
    currentDemo?: Awaited<ReturnType<typeof fetchCurrentAgentMarketplaceDemo>>,
    currentUpgradeIntent?: AgentMarketplaceCheckoutIntent | null,
    currentCheckoutSession?: AgentMarketplaceCheckoutSession | null
  ) {
    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '16px',
      borderRadius: '18px',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'rgba(255, 255, 255, 0.04)'
    });

    const title = document.createElement('strong');
    title.textContent = detail.name;
    Object.assign(title.style, {fontSize: '18px'});

    const headline = document.createElement('div');
    headline.textContent = detail.headline || '';
    Object.assign(headline.style, {fontSize: '14px', opacity: '0.85', lineHeight: '1.5'});

    const description = document.createElement('div');
    description.textContent = detail.description || '';
    Object.assign(description.style, {fontSize: '13px', lineHeight: '1.55', opacity: '0.9'});

    const meta = document.createElement('div');
    meta.textContent = [
      detail.category?.name,
      detail.provider?.displayName,
      detail.publicationStatus,
      detail.demoTurnLimit ? `데모 ${detail.demoTurnLimit}턴` : null,
      detail.priceMinor ? `${detail.priceMinor.toLocaleString()} ${detail.currency || 'KRW'}` : null
    ].filter(Boolean).join(' · ');
    Object.assign(meta.style, {fontSize: '12px', opacity: '0.72', lineHeight: '1.4'});

    const capabilitiesTitle = document.createElement('div');
    capabilitiesTitle.textContent = 'Capabilities';
    Object.assign(capabilitiesTitle.style, {fontSize: '12px', opacity: '0.65', textTransform: 'uppercase'});

    const capabilities = document.createElement('div');
    Object.assign(capabilities.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px'
    });
    for(const capability of detail.capabilities || []) {
      const badge = document.createElement('div');
      badge.textContent = capability.capabilityKey;
      Object.assign(badge.style, {
        padding: '6px 10px',
        borderRadius: '999px',
        background: 'rgba(94, 234, 212, 0.12)',
        fontSize: '12px'
      });
      capabilities.append(badge);
    }

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      gap: '8px',
      marginTop: '6px'
    });

    const startDemoButton = document.createElement('button');
    startDemoButton.textContent = currentDemo ? '데모 다시 열기' : '데모 시작';
    startDemoButton.dataset.agentId = detail.agentId;
    startDemoButton.dataset.agentSlug = detail.slug;
    Object.assign(startDemoButton.style, {
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      border: '1px solid rgba(94, 234, 212, 0.22)',
      background: 'rgba(94, 234, 212, 0.16)',
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: '600'
    });

    const continueDemoButton = document.createElement('button');
    const isPaidActive = currentDemo?.state === 'paid_active';
    const isUpgradeReady = !isPaidActive && currentDemo?.remainingTurns === 0;
    continueDemoButton.textContent = isUpgradeReady ? '유료 전환 준비' : '다음 턴 진행';
    continueDemoButton.dataset.engagementId = currentDemo?.engagementId || '';
    Object.assign(continueDemoButton.style, {
      display: currentDemo && !isPaidActive ? 'inline-flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      background: 'rgba(255, 255, 255, 0.06)',
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: '600'
    });
    attachClickEvent(continueDemoButton, async() => {
      if(!currentDemo?.engagementId) {
        return;
      }

      const originalLabel = continueDemoButton.textContent || '다음 턴 진행';
      continueDemoButton.textContent = isUpgradeReady ? '준비 중...' : '진행 중...';
      continueDemoButton.setAttribute('disabled', 'true');
      try {
        const nextEngagement = isUpgradeReady ?
          (await createAgentMarketplaceDemoUpgradeIntentForCurrentChat(currentDemo.engagementId)).engagement :
          (await consumeAgentMarketplaceDemoTurnForCurrentChat(currentDemo.engagementId)).engagement;
        const nextLabel = nextEngagement?.remainingTurns === 0 ? '유료 전환 준비' : '다음 턴 진행';
        this.setStatus(nextEngagement?.remainingTurns === 0 ?
          isUpgradeReady ?
            `${detail.name} 유료 전환 문의 초안을 입력창에 넣어뒀어. 가격 기준을 보고 이어가면 돼.` :
            `${detail.name} 데모를 모두 사용했어. 이제 유료 전환 기준으로 이어갈 수 있어.` :
          `${detail.name} 데모를 한 턴 더 진행했어. 남은 ${nextEngagement?.remainingTurns ?? 0}턴을 확인해봐.`);
        if(this.selectedAgent?.agentId === detail.agentId) {
          this.selectedEngagementId = nextEngagement?.engagementId;
          const refreshedDemo = await fetchCurrentAgentMarketplaceDemo(detail);
          const refreshedUpgradeIntent = await fetchCurrentAgentMarketplaceUpgradeIntent(detail);
          const refreshedCheckoutSession = await fetchCurrentAgentMarketplaceCheckoutSession(detail);
          this.detailEl.replaceChildren(this.buildDetail(detail, refreshedDemo, refreshedUpgradeIntent, refreshedCheckoutSession));
        } else {
          continueDemoButton.textContent = nextLabel;
        }
      } catch(err) {
        this.setStatus(err instanceof Error ? err.message : String(err));
        continueDemoButton.textContent = originalLabel;
        continueDemoButton.removeAttribute('disabled');
      }
    });

    const demoState = document.createElement('div');
    if(currentDemo) {
      demoState.textContent = [
        isPaidActive ? '현재 채팅에서 정식 플로우 진행 중' : '현재 채팅에서 데모 진행 중',
        currentDemo.remainingTurns !== undefined ? `남은 ${currentDemo.remainingTurns}턴` : null,
        currentDemo.turnUsage !== undefined ? `사용 ${currentDemo.turnUsage}턴` : null,
        isPaidActive && currentDemo.paidTurnCount !== undefined ? `정식 ${currentDemo.paidTurnCount}턴` : null,
        currentDemo.remainingTurns === 0 && detail.priceMinor ? `${detail.priceMinor.toLocaleString()} ${detail.currency || 'KRW'}` : null
      ].filter(Boolean).join(' · ');
      demoState.dataset.engagementId = currentDemo.engagementId;
      Object.assign(demoState.style, {
        fontSize: '12px',
        opacity: '0.78',
        lineHeight: '1.4'
      });
    }

    const checkoutState = document.createElement('div');
    if(currentUpgradeIntent) {
      let checkoutModeLabel: string | null = null;
      if(currentCheckoutSession?.state === 'paid') {
        checkoutModeLabel = '정식 플로우 초안 준비됨';
      } else if(currentCheckoutSession?.paymentMethod === 'card') {
        checkoutModeLabel = '카드 결제';
      } else if(currentUpgradeIntent.pricingModel === 'subscription') {
        checkoutModeLabel = '구독형';
      }
      checkoutState.textContent = [
        currentCheckoutSession?.state === 'paid' ? '현재 채팅에서 결제 완료됨' : currentCheckoutSession ? '현재 채팅에서 결제 안내 열림' : '현재 채팅에서 결제 준비됨',
        currentUpgradeIntent.priceMinor ? `${currentUpgradeIntent.priceMinor.toLocaleString()} ${currentUpgradeIntent.currency || 'KRW'}` : null,
        checkoutModeLabel,
        currentCheckoutSession?.state === 'paid' ? '결제 확인됨' : '문의 초안 준비됨'
      ].filter(Boolean).join(' · ');
      checkoutState.dataset.checkoutIntentId = currentUpgradeIntent.checkoutIntentId;
      if(currentCheckoutSession) {
        checkoutState.dataset.checkoutSessionId = currentCheckoutSession.checkoutSessionId;
      }
      Object.assign(checkoutState.style, {
        fontSize: '12px',
        opacity: '0.78',
        lineHeight: '1.4',
        color: 'rgba(94, 234, 212, 0.92)'
      });
    }

    const checkoutButton = document.createElement('button');
    checkoutButton.textContent = currentCheckoutSession?.state === 'paid' ? '결제 상태 다시 보기' : currentCheckoutSession ? '결제 안내 다시 보기' : '결제 안내 보기';
    checkoutButton.dataset.checkoutIntentId = currentUpgradeIntent?.checkoutIntentId || '';
    Object.assign(checkoutButton.style, {
      display: currentUpgradeIntent ? 'inline-flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      border: '1px solid rgba(94, 234, 212, 0.18)',
      background: 'rgba(94, 234, 212, 0.10)',
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: '600'
    });

    const startPaidButton = document.createElement('button');
    startPaidButton.textContent = currentDemo?.state === 'paid_active' ? '정식 플로우 다시 열기' : '정식 플로우 시작';
    startPaidButton.dataset.engagementId = currentDemo?.engagementId || '';
    Object.assign(startPaidButton.style, {
      display: currentCheckoutSession?.state === 'paid' ? 'inline-flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      border: '1px solid rgba(251, 191, 36, 0.2)',
      background: 'rgba(251, 191, 36, 0.12)',
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: '600'
    });
    attachClickEvent(startPaidButton, async() => {
      if(!currentDemo?.engagementId) {
        return;
      }

      const originalLabel = startPaidButton.textContent || '정식 플로우 시작';
      startPaidButton.textContent = '시작 중...';
      startPaidButton.setAttribute('disabled', 'true');
      try {
        const result = await startAgentMarketplacePaidFlowForCurrentChat(currentDemo.engagementId);
        this.setStatus(`${detail.name} 정식 플로우를 현재 채팅에 이어붙였어. 이제 paid baseline 위에서 다음 단계를 붙이면 돼.`);
        if(this.selectedAgent?.agentId === detail.agentId) {
          this.selectedEngagementId = result.engagement?.engagementId;
          const refreshedDemo = await fetchCurrentAgentMarketplaceDemo(detail);
          const refreshedUpgradeIntent = await fetchCurrentAgentMarketplaceUpgradeIntent(detail);
          const refreshedCheckoutSession = await fetchCurrentAgentMarketplaceCheckoutSession(detail);
          this.detailEl.replaceChildren(this.buildDetail(detail, refreshedDemo, refreshedUpgradeIntent, refreshedCheckoutSession));
        } else {
          startPaidButton.textContent = originalLabel;
        }
      } catch(err) {
        this.setStatus(err instanceof Error ? err.message : String(err));
        startPaidButton.textContent = originalLabel;
        startPaidButton.removeAttribute('disabled');
      }
    });

    const continuePaidButton = document.createElement('button');
    continuePaidButton.textContent = '다음 정식 초안';
    continuePaidButton.dataset.engagementId = currentDemo?.engagementId || '';
    Object.assign(continuePaidButton.style, {
      display: isPaidActive ? 'inline-flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      border: '1px solid rgba(249, 115, 22, 0.2)',
      background: 'rgba(249, 115, 22, 0.10)',
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: '600'
    });
    attachClickEvent(continuePaidButton, async() => {
      if(!currentDemo?.engagementId) {
        return;
      }

      const originalLabel = continuePaidButton.textContent || '다음 정식 초안';
      continuePaidButton.textContent = '진행 중...';
      continuePaidButton.setAttribute('disabled', 'true');
      try {
        const result = await continueAgentMarketplacePaidFlowForCurrentChat(currentDemo.engagementId);
        this.setStatus(`${detail.name} 정식 플로우를 한 턴 더 진행했어. 다음 초안이 입력창에 들어갔는지 확인해봐.`);
        if(this.selectedAgent?.agentId === detail.agentId) {
          this.selectedEngagementId = result.engagement?.engagementId;
          const refreshedDemo = await fetchCurrentAgentMarketplaceDemo(detail);
          const refreshedUpgradeIntent = await fetchCurrentAgentMarketplaceUpgradeIntent(detail);
          const refreshedCheckoutSession = await fetchCurrentAgentMarketplaceCheckoutSession(detail);
          this.detailEl.replaceChildren(this.buildDetail(detail, refreshedDemo, refreshedUpgradeIntent, refreshedCheckoutSession));
        } else {
          continuePaidButton.textContent = originalLabel;
        }
      } catch(err) {
        this.setStatus(err instanceof Error ? err.message : String(err));
        continuePaidButton.textContent = originalLabel;
        continuePaidButton.removeAttribute('disabled');
      }
    });
    attachClickEvent(checkoutButton, async() => {
      if(!currentUpgradeIntent?.checkoutIntentId) {
        return;
      }

      const originalLabel = checkoutButton.textContent || '결제 안내 보기';
      checkoutButton.textContent = '안내 여는 중...';
      checkoutButton.setAttribute('disabled', 'true');
      try {
        const sessionPayload = currentCheckoutSession ? {
          checkoutSession: currentCheckoutSession
        } : await createAgentMarketplaceCheckoutSessionForCurrentChat(currentUpgradeIntent.checkoutIntentId);
        const checkoutSession = sessionPayload.checkoutSession;
        if(!checkoutSession) {
          throw new Error('결제 세션을 열지 못했어');
        }

        new PopupAgentCheckout(currentUpgradeIntent, checkoutSession, async(activeSession) => {
          await confirmAgentMarketplaceCheckoutSessionForCurrentChat(activeSession.checkoutSessionId);
          this.setStatus(`${detail.name} 결제를 완료 처리했어. 이제 정식 플로우 초안을 기준으로 이어가면 돼.`);
          const refreshedDemo = await fetchCurrentAgentMarketplaceDemo(detail);
          const refreshedUpgradeIntent = await fetchCurrentAgentMarketplaceUpgradeIntent(detail);
          const refreshedCheckoutSession = await fetchCurrentAgentMarketplaceCheckoutSession(detail);
          this.detailEl.replaceChildren(this.buildDetail(detail, refreshedDemo, refreshedUpgradeIntent, refreshedCheckoutSession));
        });
        let checkoutStatusText = `${detail.name} 결제 안내를 열었어. 가격과 진행 문구를 먼저 확인하면 돼.`;
        if(checkoutSession.state === 'paid') {
          checkoutStatusText = `${detail.name} 결제 상태를 다시 열었어. 정식 플로우 시작 초안을 확인해봐.`;
        }
        this.setStatus(checkoutStatusText);
        const refreshedDemo = await fetchCurrentAgentMarketplaceDemo(detail);
        const refreshedUpgradeIntent = await fetchCurrentAgentMarketplaceUpgradeIntent(detail);
        const refreshedCheckoutSession = await fetchCurrentAgentMarketplaceCheckoutSession(detail);
        this.detailEl.replaceChildren(this.buildDetail(detail, refreshedDemo, refreshedUpgradeIntent, refreshedCheckoutSession));
      } catch(err) {
        this.setStatus(err instanceof Error ? err.message : String(err));
        checkoutButton.textContent = originalLabel;
        checkoutButton.removeAttribute('disabled');
      }
    });

    attachClickEvent(startDemoButton, async() => {
      if(!this.selectedAgent || this.selectedAgent.agentId !== detail.agentId) {
        return;
      }

      const originalLabel = startDemoButton.textContent || '데모 시작';
      startDemoButton.textContent = '데모 여는 중...';
      startDemoButton.setAttribute('disabled', 'true');
      try {
        const response = await startAgentMarketplaceDemoForCurrentChat(this.selectedAgent);
        this.selectedEngagementId = response.engagementId;
        this.setStatus(`${detail.name} 데모를 현재 채팅에 띄웠어. ${response.demoTurnLimit || detail.demoTurnLimit || 0}턴 안에서 흐름을 확인하면 돼.`);
        if(this.dismissAfterStart) {
          this.hide();
        } else if(this.selectedAgent?.agentId === detail.agentId) {
          const refreshedDemo = await fetchCurrentAgentMarketplaceDemo(detail);
          const refreshedUpgradeIntent = await fetchCurrentAgentMarketplaceUpgradeIntent(detail);
          const refreshedCheckoutSession = await fetchCurrentAgentMarketplaceCheckoutSession(detail);
          this.detailEl.replaceChildren(this.buildDetail(detail, refreshedDemo, refreshedUpgradeIntent, refreshedCheckoutSession));
        }
      } catch(err) {
        this.setStatus(err instanceof Error ? err.message : String(err));
      } finally {
        startDemoButton.textContent = originalLabel;
        startDemoButton.removeAttribute('disabled');
      }
    });
    actions.append(startDemoButton, continueDemoButton, checkoutButton, startPaidButton, continuePaidButton);

    container.append(title, headline, meta, description, capabilitiesTitle, capabilities);
    if(currentDemo) {
      container.append(demoState);
    }
    if(currentUpgradeIntent) {
      container.append(checkoutState);
    }
    container.append(actions);
    return container;
  }
}
