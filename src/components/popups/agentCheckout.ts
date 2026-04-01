import PopupElement from '.';

import type {AgentMarketplaceCheckoutSession, AgentMarketplaceCheckoutIntent} from '@lib/agentMarketplaceDemo';
import {attachClickEvent} from '@helpers/dom/clickEvent';

type CheckoutConfirmHandler = (checkoutSession: AgentMarketplaceCheckoutSession) => Promise<void>;

export default class PopupAgentCheckout extends PopupElement {
  constructor(
    private checkoutIntent: AgentMarketplaceCheckoutIntent,
    private checkoutSession: AgentMarketplaceCheckoutSession,
    private onConfirmPayment?: CheckoutConfirmHandler
  ) {
    const title = document.createElement('span');
    title.textContent = '결제 안내';
    super('popup-peer', {
      closable: true,
      body: true,
      scrollable: true,
      title
    });

    this.construct();
  }

  private construct() {
    this.body.classList.add('agent-checkout-popup-body');
    Object.assign(this.body.style, {
      minWidth: 'min(520px, calc(100vw - 48px))',
      maxWidth: 'min(520px, calc(100vw - 48px))',
      padding: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    });

    const hero = document.createElement('div');
    Object.assign(hero.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '14px 16px',
      borderRadius: '18px',
      background: 'linear-gradient(180deg, rgba(94, 234, 212, 0.16), rgba(94, 234, 212, 0.06))',
      border: '1px solid rgba(94, 234, 212, 0.18)'
    });

    const heroTitle = document.createElement('strong');
    heroTitle.textContent = this.checkoutIntent.agent?.name ? `${this.checkoutIntent.agent.name} 결제 안내` : 'Agent 결제 안내';
    heroTitle.dataset.role = 'checkout-title';
    Object.assign(heroTitle.style, {fontSize: '18px'});

    const heroSubtitle = document.createElement('div');
    heroSubtitle.textContent = this.checkoutIntent.headline || '정식 플로우로 이어갈 수 있어.';
    heroSubtitle.dataset.role = 'checkout-headline';
    Object.assign(heroSubtitle.style, {fontSize: '13px', lineHeight: '1.5', opacity: '0.84'});
    hero.append(heroTitle, heroSubtitle);

    const summary = document.createElement('div');
    summary.textContent = [
      this.checkoutIntent.priceMinor ? `${this.checkoutIntent.priceMinor.toLocaleString()} ${this.checkoutIntent.currency || 'KRW'}` : null,
      this.checkoutSession.paymentMethod === 'card' ? '카드 결제' : this.checkoutSession.paymentMethod || null,
      this.checkoutSession.providerName || null
    ].filter(Boolean).join(' · ');
    summary.dataset.role = 'checkout-summary';
    Object.assign(summary.style, {fontSize: '13px', lineHeight: '1.45'});

    const note = document.createElement('div');
    note.textContent = '현재는 local checkout stub이야. 이번 단계에선 가격과 결제 진행 문구를 확인하고, 다음 단계에서 실제 결제 provider로 치환하면 돼.';
    note.dataset.role = 'checkout-note';
    Object.assign(note.style, {fontSize: '12px', lineHeight: '1.5', opacity: '0.78'});

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      gap: '8px',
      marginTop: '8px'
    });

    const markPaidButton = document.createElement('button');
    markPaidButton.textContent = this.checkoutSession.state === 'paid' ? '결제 확인됨' : '결제 완료 처리';
    markPaidButton.dataset.role = 'checkout-mark-paid';
    Object.assign(markPaidButton.style, {
      display: this.onConfirmPayment ? 'inline-flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      background: 'rgba(255, 255, 255, 0.06)',
      color: 'inherit',
      cursor: this.checkoutSession.state === 'paid' ? 'default' : 'pointer',
      fontWeight: '600',
      opacity: this.checkoutSession.state === 'paid' ? '0.72' : '1'
    });

    const confirmButton = document.createElement('button');
    confirmButton.textContent = '알겠어';
    confirmButton.dataset.role = 'checkout-confirm';
    Object.assign(confirmButton.style, {
      minHeight: '36px',
      padding: '0 14px',
      borderRadius: '999px',
      border: '1px solid rgba(94, 234, 212, 0.2)',
      background: 'rgba(94, 234, 212, 0.16)',
      color: 'inherit',
      cursor: 'pointer',
      fontWeight: '600'
    });

    attachClickEvent(markPaidButton, async() => {
      if(!this.onConfirmPayment || this.checkoutSession.state === 'paid') {
        return;
      }

      const originalText = markPaidButton.textContent || '결제 완료 처리';
      markPaidButton.textContent = '확인 중...';
      markPaidButton.setAttribute('disabled', 'true');
      try {
        await this.onConfirmPayment(this.checkoutSession);
        this.checkoutSession = {
          ...this.checkoutSession,
          state: 'paid'
        };
        heroSubtitle.textContent = '결제가 확인됐어. 이제 정식 플로우로 이어갈 수 있어.';
        note.textContent = '지금은 local paid stub까지 닫은 상태야. 다음 단계에선 실제 paid engagement와 결제 provider를 붙이면 돼.';
        summary.textContent = [
          this.checkoutIntent.priceMinor ? `${this.checkoutIntent.priceMinor.toLocaleString()} ${this.checkoutIntent.currency || 'KRW'}` : null,
          '결제 확인',
          this.checkoutSession.providerName || null
        ].filter(Boolean).join(' · ');
        markPaidButton.textContent = '결제 확인됨';
        markPaidButton.style.cursor = 'default';
        markPaidButton.style.opacity = '0.72';
      } catch(err) {
        note.textContent = err instanceof Error ? err.message : String(err);
        markPaidButton.textContent = originalText;
        markPaidButton.removeAttribute('disabled');
      }
    });

    attachClickEvent(confirmButton, () => {
      this.hide();
    });
    actions.append(markPaidButton, confirmButton);

    this.body.append(hero, summary, note, actions);
    this.show();
  }
}
