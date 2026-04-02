import {SliderSuperTab} from '@components/slider';
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

    const content = document.createElement('div');
    content.classList.add('profile-content');

    const avatarWrap = document.createElement('div');
    avatarWrap.classList.add('profile-avatars-container');
    Object.assign(avatarWrap.style, {
      paddingTop: '20px',
      display: 'grid',
      placeItems: 'center'
    });

    const avatar = document.createElement('div');
    avatar.classList.add('profile-avatars-avatar', 'profile-avatars-avatar-fake');
    avatar.textContent = (profile.avatarLabel || profile.displayName.slice(0, 1) || '?').slice(0, 1);
    let avatarBackground = 'linear-gradient(135deg, rgba(148, 163, 184, 0.22), rgba(100, 116, 139, 0.18))';
    if(profile.participantType === 'agent') {
      avatarBackground = 'linear-gradient(135deg, rgba(94, 234, 212, 0.24), rgba(56, 189, 248, 0.18))';
    }
    Object.assign(avatar.style, {
      width: '104px',
      height: '104px',
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      fontWeight: '700',
      fontSize: '34px',
      color: 'var(--primary-text-color)',
      background: avatarBackground
    });
    avatarWrap.append(avatar);

    const name = document.createElement('div');
    name.classList.add('profile-name');
    name.textContent = profile.displayName;

    const subtitle = document.createElement('div');
    subtitle.classList.add('profile-subtitle');

    const subtitleText = document.createElement('div');
    subtitleText.classList.add('profile-subtitle-text');
    subtitleText.textContent = profile.headline || (profile.participantType === 'agent' ? '에이전트와 대화 중이야.' : '일반 대화 상대야.');
    subtitle.append(subtitleText);

    const meta = document.createElement('div');
    meta.classList.add('sidebar-header__subtitle');
    meta.textContent = [
      conversation.conversationKind === 'agent' ? '에이전트 대화' : '일반 대화',
      profile.updatedAt ? `최근 활동 ${new Date(profile.updatedAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}` : null
    ].filter(Boolean).join(' · ');
    Object.assign(meta.style, {
      textAlign: 'center',
      padding: '0 24px 10px'
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

    const infoList = document.createElement('div');
    infoList.classList.add('sidebar-left-section-container');

    for(const [label, value] of entries) {
      if(!value) {
        continue;
      }

      const row = document.createElement('button');
      row.type = 'button';
      row.classList.add('row');
      Object.assign(row.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '3px',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: '0'
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

    content.append(avatarWrap, name, subtitle, meta, infoList);

    if(profile.participantType === 'agent' && profile.capabilities?.length) {
      const capabilityList = document.createElement('div');
      capabilityList.classList.add('sidebar-left-section-container');
      Object.assign(capabilityList.style, {marginTop: '12px'});

      const capabilityTitle = document.createElement('div');
      capabilityTitle.textContent = 'Capability';
      Object.assign(capabilityTitle.style, {
        padding: '0 24px 10px',
        fontSize: '13px',
        fontWeight: '600',
        opacity: '0.8'
      });
      content.append(capabilityTitle);

      for(const capability of profile.capabilities) {
        const item = document.createElement('div');
        item.classList.add('row');
        item.textContent = capability.capabilityKey || 'unknown';
        Object.assign(item.style, {
          fontSize: '13px'
        });
        capabilityList.append(item);
      }

      content.append(capabilityList);
    }

    this.scrollable.append(content);
  }
}
