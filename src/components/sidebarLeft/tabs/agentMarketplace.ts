import {SliderSuperTab} from '@components/slider';
import PopupAgentMarketplace from '@components/popups/agentMarketplace';

export default class AppAgentMarketplaceTab extends SliderSuperTab {
  public static noSame = true;

  private embeddedMarketplace?: PopupAgentMarketplace;

  public init(initialAgentSlug?: string) {
    this.container.classList.add('agent-marketplace-tab');
    this.title.textContent = '에이전트';

    this.embeddedMarketplace = new PopupAgentMarketplace({
      dismissAfterStart: false,
      embedded: true,
      initialAgentSlug
    });

    const marketplaceBody = this.embeddedMarketplace.getEmbeddedBody();
    Object.assign(marketplaceBody.style, {
      paddingTop: '0'
    });

    this.scrollable.container.classList.add('agent-marketplace-tab__scrollable');
    this.scrollable.append(marketplaceBody);
  }
}
