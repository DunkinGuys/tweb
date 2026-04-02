import {SliderSuperTab} from '@components/slider';
import SettingSection from '@components/settingSection';
import {
  fetchConversationDetail,
  fetchConversationProfile,
  type ConversationDetail,
  type ConversationProfile
} from '@lib/conversations';

type ConversationProfileOpenArgs = {
  conversationId: string
};

export default class AppConversationProfileTab extends SliderSuperTab {
  private conversationId?: string;

  public init(initialState?: ConversationProfileOpenArgs) {
    this.container.classList.add('conversation-profile-container');
    this.title.textContent = '정보';

    if(initialState?.conversationId) {
      void this.loadProfile(initialState);
    }
  }

  public async loadProfile(args: ConversationProfileOpenArgs) {
    this.conversationId = args.conversationId;
    this.scrollable.replaceChildren();

    const loading = document.createElement('div');
    loading.textContent = '프로필을 불러오는 중이야...';
    Object.assign(loading.style, {
      padding: '16px',
      fontSize: '13px',
      opacity: '0.72'
    });
    this.scrollable.append(loading);

    try {
      const [conversation, profile] = await Promise.all([
        fetchConversationDetail(args.conversationId),
        fetchConversationProfile(args.conversationId)
      ]);
      this.renderProfile(conversation, profile);
    } catch(err) {
      loading.textContent = err instanceof Error ? err.message : String(err);
    }
  }

  private renderProfile(conversation: ConversationDetail, profile: ConversationProfile) {
    this.title.textContent = profile.displayName;
    this.scrollable.replaceChildren();

    const heroSection = new SettingSection({
      name: (() => {
        const title = document.createElement('span');
        title.textContent = profile.participantType === 'agent' ? '에이전트 프로필' : '대화 상대';
        return title;
      })(),
      noDelimiter: false,
      noShadow: true
    });

    const hero = document.createElement('div');
    Object.assign(hero.style, {
      display: 'grid',
      gridTemplateColumns: '56px minmax(0, 1fr)',
      gap: '12px',
      alignItems: 'center',
      padding: '8px 0'
    });

    const avatar = document.createElement('div');
    avatar.textContent = (profile.avatarLabel || profile.displayName.slice(0, 1) || '?').slice(0, 1);
    Object.assign(avatar.style, {
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      fontWeight: '700',
      background: profile.participantType === 'agent' ?
        'linear-gradient(135deg, rgba(94, 234, 212, 0.22), rgba(56, 189, 248, 0.18))' :
        'linear-gradient(135deg, rgba(148, 163, 184, 0.18), rgba(100, 116, 139, 0.18))'
    });

    const textWrap = document.createElement('div');
    Object.assign(textWrap.style, {
      minWidth: '0',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    });

    const name = document.createElement('div');
    name.textContent = profile.displayName;
    Object.assign(name.style, {
      fontSize: '16px',
      fontWeight: '700'
    });

    const headline = document.createElement('div');
    headline.textContent = profile.headline || (profile.participantType === 'agent' ? '에이전트와 대화 중이야.' : '일반 대화 상대야.');
    Object.assign(headline.style, {
      fontSize: '13px',
      opacity: '0.78',
      lineHeight: '1.45'
    });

    const meta = document.createElement('div');
    meta.textContent = [
      conversation.conversationKind === 'agent' ? '에이전트 대화' : '일반 대화',
      profile.updatedAt ? `최근 활동 ${new Date(profile.updatedAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}` : null
    ].filter(Boolean).join(' · ');
    Object.assign(meta.style, {
      fontSize: '12px',
      opacity: '0.56'
    });

    textWrap.append(name, headline, meta);
    hero.append(avatar, textWrap);
    heroSection.content.append(hero);

    const infoSection = new SettingSection({
      name: (() => {
        const title = document.createElement('span');
        title.textContent = '상세';
        return title;
      })(),
      noDelimiter: false,
      noShadow: true
    });

    const infoList = document.createElement('div');
    Object.assign(infoList.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    });

    const entries: Array<[string, string | null | undefined]> = [
      ['참여자 타입', profile.participantType === 'agent' ? 'agent' : 'user'],
      ['설명', profile.description || null],
      ['대화 ID', conversation.conversationId],
      ['대화 종류', conversation.conversationKind],
      ['최근 요약', profile.latestSummary || null]
    ];

    if(profile.participantType === 'agent') {
      entries.push(
        ['카테고리', profile.category?.name || null],
        ['프로바이더', profile.provider?.displayName || null],
        ['가격 모델', profile.pricingModel || null],
        ['가격', profile.priceMinor ? `${profile.priceMinor.toLocaleString()} ${profile.currency || 'KRW'}` : null],
        ['상태', profile.state || null],
        ['결제 상태', profile.billing?.checkoutSession?.state || null],
        ['이용 권한', profile.billing?.hasPaidEntitlement ? '활성' : '비활성'],
      );
    }

    for(const [label, value] of entries) {
      if(!value) {
        continue;
      }

      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '3px'
      });

      const key = document.createElement('div');
      key.textContent = label;
      Object.assign(key.style, {
        fontSize: '11px',
        opacity: '0.55'
      });

      const text = document.createElement('div');
      text.textContent = value;
      Object.assign(text.style, {
        fontSize: '13px',
        lineHeight: '1.45'
      });

      row.append(key, text);
      infoList.append(row);
    }

    infoSection.content.append(infoList);

    this.scrollable.append(heroSection.container, infoSection.container);

    if(profile.participantType === 'agent' && profile.capabilities?.length) {
      const capabilitySection = new SettingSection({
        name: (() => {
          const title = document.createElement('span');
          title.textContent = 'Capability';
          return title;
        })(),
        noDelimiter: false,
        noShadow: true
      });

      const capabilityList = document.createElement('div');
      Object.assign(capabilityList.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      });

      for(const capability of profile.capabilities) {
        const item = document.createElement('div');
        item.textContent = capability.capabilityKey || 'unknown';
        Object.assign(item.style, {
          fontSize: '13px',
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.04)'
        });
        capabilityList.append(item);
      }

      capabilitySection.content.append(capabilityList);
      this.scrollable.append(capabilitySection.container);
    }
  }
}
