import {
  canUseAgentMarketplaceDemo,
  continueAgentMarketplacePaidFlowForCurrentChat,
  confirmAgentMarketplaceCheckoutSessionForCurrentChat,
  createAgentMarketplaceCheckoutSessionForCurrentChat,
  createAgentMarketplaceDemoUpgradeIntentForCurrentChat,
  consumeAgentMarketplaceDemoTurnForCurrentChat,
  fetchCurrentAgentMarketplaceDemo,
  fetchCurrentAgentMarketplaceCheckoutSession,
  fetchCurrentAgentMarketplaceUpgradeIntent,
  requestAgentMarketplaceDemoStart,
  resolveAgentMarketplaceDemoBaseUrl,
  startAgentMarketplacePaidFlowForCurrentChat,
  startAgentMarketplaceDemoForCurrentChat
} from '@lib/agentMarketplaceDemo';

vi.mock('@lib/agentCardPreviewBridge', () => ({
  pushAgentCardPreviewToCurrentChatAsync: vi.fn(async() => true)
}));

describe('agentMarketplaceDemo', () => {
  const originalLocation = window.location;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://localhost:8080/')
    });
    document.body.innerHTML = '<div class="input-message-input"></div>';
    (window as typeof window & {
      appImManager?: unknown
    }).appImManager = {
      chat: {
        peerId: 321,
        threadId: 654,
        monoforumThreadId: 987
      }
    };
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
    globalThis.fetch = originalFetch;
  });

  test('falls back to localhost demo service in local dev', () => {
    expect(resolveAgentMarketplaceDemoBaseUrl()).toBe('http://127.0.0.1:8799');
    expect(canUseAgentMarketplaceDemo()).toBe(true);
  });

  test('posts demo start request with current chat and runtime context', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');
    window.localStorage.setItem('agent-card-preview-runtime-context', JSON.stringify({
      kakaoId: 'demo-kakao',
      platform: 'kakao'
    }));

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      engagementId: 'eng_demo_123',
      conversationId: 'conv_demo_123',
      mode: 'demo',
      demoTurnLimit: 5,
      agent: {
        agentId: 'agent_yeon',
        slug: 'yeon',
        name: '연이'
      },
      introCard: {
        title: '연이가 대화 시작 포인트를 잡았어',
        status: 'DEMO'
      },
      introReplyDraft: {
        text: 'demo intro draft'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const payload = await requestAgentMarketplaceDemoStart({
      agentId: 'agent_yeon',
      slug: 'yeon'
    });

    expect(payload.engagementId).toBe('eng_demo_123');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/engagements/demo/start', expect.objectContaining({
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        agentId: 'agent_yeon',
        agentSlug: 'yeon',
        runtimeContext: {
          kakaoId: 'demo-kakao',
          platform: 'kakao'
        },
        peerId: 321,
        threadId: 654,
        monoforumThreadId: 987
      })
    }));
  });

  test('fetches current demo engagement for the current chat', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      engagement: {
        engagementId: 'eng_demo_current',
        mode: 'demo',
        turnUsage: 1,
        remainingTurns: 4,
        agent: {
          agentId: 'agent_yeon',
          slug: 'yeon',
          name: '연이'
        }
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const engagement = await fetchCurrentAgentMarketplaceDemo({
      agentId: 'agent_yeon',
      slug: 'yeon'
    });

    expect(engagement?.engagementId).toBe('eng_demo_current');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/engagements/current?peerId=321&agentId=agent_yeon&agentSlug=yeon&threadId=654&monoforumThreadId=987');
  });

  test('fetches current checkout intent for the current chat', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      checkoutIntent: {
        checkoutIntentId: 'checkout_demo_current',
        engagementId: 'eng_demo_current',
        state: 'ready',
        priceMinor: 4900,
        currency: 'KRW',
        pricingModel: 'demo_then_paid'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const checkoutIntent = await fetchCurrentAgentMarketplaceUpgradeIntent({
      agentId: 'agent_yeon',
      slug: 'yeon'
    });

    expect(checkoutIntent?.checkoutIntentId).toBe('checkout_demo_current');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/checkout/intents/current?peerId=321&agentId=agent_yeon&agentSlug=yeon&threadId=654&monoforumThreadId=987');
  });

  test('fetches current checkout session for the current chat', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      checkoutSession: {
        checkoutSessionId: 'checkout_session_current',
        checkoutIntentId: 'checkout_demo_current',
        engagementId: 'eng_demo_current',
        state: 'pending',
        paymentMethod: 'card',
        priceMinor: 4900,
        currency: 'KRW'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const checkoutSession = await fetchCurrentAgentMarketplaceCheckoutSession({
      agentId: 'agent_yeon',
      slug: 'yeon'
    });

    expect(checkoutSession?.checkoutSessionId).toBe('checkout_session_current');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/checkout/sessions/current?peerId=321&agentId=agent_yeon&agentSlug=yeon&threadId=654&monoforumThreadId=987');
  });

  test('hydrates composer and attaches marketplace metadata', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      engagementId: 'eng_demo_456',
      conversationId: 'conv_demo_456',
      mode: 'demo',
      demoTurnLimit: 3,
      engagement: {
        engagementId: 'eng_demo_456',
        mode: 'demo',
        turnUsage: 0,
        remainingTurns: 3
      },
      agent: {
        agentId: 'agent_fashion',
        slug: 'fashion-agent',
        name: '패션 메이트'
      },
      introCard: {
        title: '패션 메이트가 코디 체크를 시작했어',
        status: 'DEMO'
      },
      introReplyDraft: {
        text: 'fashion demo draft'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await startAgentMarketplaceDemoForCurrentChat({
      agentId: 'agent_fashion',
      slug: 'fashion-agent'
    });

    expect(response.introCard?.sourceAgentId).toBe('agent_fashion');
    expect(response.introCard?.sourceAgentSlug).toBe('fashion-agent');
    expect(response.introCard?.sourceEngagementId).toBe('eng_demo_456');
    expect(response.introCard?.sourceTurnUsage).toBe(0);
    expect(response.introCard?.sourceRemainingTurns).toBe(3);
    expect(document.querySelector('.input-message-input')?.textContent).toBe('fashion demo draft');
  });

  test('consumes a demo turn and updates preview metadata', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      engagement: {
        engagementId: 'eng_demo_789',
        mode: 'demo',
        turnUsage: 1,
        remainingTurns: 2,
        agent: {
          agentId: 'agent_yeon',
          slug: 'yeon',
          name: '연이'
        }
      },
      previewCard: {
        title: '연이가 다음 질문으로 이어갈 준비를 했어',
        status: 'DEMO_ACTIVE'
      },
      replyDraft: {
        text: 'next demo draft'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await consumeAgentMarketplaceDemoTurnForCurrentChat('eng_demo_789');

    expect(response.engagement?.remainingTurns).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/engagements/demo/consume-turn', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        engagementId: 'eng_demo_789'
      })
    }));
    expect(document.querySelector('.input-message-input')?.textContent).toBe('next demo draft');
  });

  test('creates an upgrade intent and hydrates the checkout draft', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      checkoutIntentId: 'checkout_demo_123',
      priceMinor: 9900,
      currency: 'KRW',
      pricingModel: 'subscription',
      headline: '연이 정식 답장 초안 플로우로 이어갈 수 있어',
      engagement: {
        engagementId: 'eng_demo_789',
        mode: 'demo',
        turnUsage: 5,
        remainingTurns: 0,
        agent: {
          agentId: 'agent_yeon',
          slug: 'yeon',
          name: '연이'
        }
      },
      ctaCard: {
        title: '연이 유료 전환 준비가 끝났어',
        status: 'UPGRADE_READY'
      },
      checkoutDraft: {
        text: '연이 유료 전환을 진행하고 싶어. 가격과 시작 방법을 안내해줘.'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await createAgentMarketplaceDemoUpgradeIntentForCurrentChat('eng_demo_789');

    expect(response.checkoutIntentId).toBe('checkout_demo_123');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/checkout/intents', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        engagementId: 'eng_demo_789'
      })
    }));
    expect(document.querySelector('.input-message-input')?.textContent).toBe('연이 유료 전환을 진행하고 싶어. 가격과 시작 방법을 안내해줘.');
  });

  test('creates a checkout session and hydrates the payment draft', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      checkoutSessionId: 'checkout_session_123',
      checkoutSession: {
        checkoutSessionId: 'checkout_session_123',
        checkoutIntentId: 'checkout_demo_123',
        engagementId: 'eng_demo_789',
        state: 'pending',
        paymentMethod: 'card',
        priceMinor: 4900,
        currency: 'KRW',
        agent: {
          agentId: 'agent_yeon',
          slug: 'yeon',
          name: '연이'
        }
      },
      checkoutCard: {
        title: '연이 결제 안내를 열어뒀어',
        status: 'CHECKOUT_PENDING'
      },
      checkoutDraft: {
        text: '연이 결제를 진행하고 싶어. 카드 결제 기준으로 안내해줘.'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await createAgentMarketplaceCheckoutSessionForCurrentChat('checkout_demo_123');

    expect(response.checkoutSessionId).toBe('checkout_session_123');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/checkout/sessions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        checkoutIntentId: 'checkout_demo_123'
      })
    }));
    expect(document.querySelector('.input-message-input')?.textContent).toBe('연이 결제를 진행하고 싶어. 카드 결제 기준으로 안내해줘.');
  });

  test('starts the paid flow and hydrates the first paid draft', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      engagement: {
        engagementId: 'eng_demo_paid',
        mode: 'demo',
        state: 'paid_active',
        turnUsage: 5,
        remainingTurns: 0,
        agent: {
          agentId: 'agent_yeon',
          slug: 'yeon',
          name: '연이'
        }
      },
      previewCard: {
        title: '연이 정식 플로우를 열었어',
        status: 'PAID_ACTIVE'
      },
      replyDraft: {
        text: '연이 정식 플로우로 이어서 지금 대화 맥락에 맞는 첫 답장 초안을 시작해줘.'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await startAgentMarketplacePaidFlowForCurrentChat('eng_demo_paid');

    expect(response.engagement?.state).toBe('paid_active');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/engagements/paid/start', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        engagementId: 'eng_demo_paid'
      })
    }));
    expect(document.querySelector('.input-message-input')?.textContent).toBe('연이 정식 플로우로 이어서 지금 대화 맥락에 맞는 첫 답장 초안을 시작해줘.');
  });

  test('continues the paid flow and hydrates the next paid draft', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      engagement: {
        engagementId: 'eng_demo_paid',
        mode: 'demo',
        state: 'paid_active',
        turnUsage: 5,
        paidTurnCount: 1,
        remainingTurns: 0,
        agent: {
          agentId: 'agent_yeon',
          slug: 'yeon',
          name: '연이'
        }
      },
      previewCard: {
        title: '연이가 다음 정식 초안을 준비했어',
        status: 'PAID_ACTIVE'
      },
      replyDraft: {
        text: '연이 정식 플로우에서 다음 답장 초안도 이어가줘. 이번엔 상대 반응을 반영해서 조금 더 구체적으로 써줘.'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await continueAgentMarketplacePaidFlowForCurrentChat('eng_demo_paid');

    expect(response.engagement?.paidTurnCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/engagements/paid/continue', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        engagementId: 'eng_demo_paid'
      })
    }));
    expect(document.querySelector('.input-message-input')?.textContent).toBe('연이 정식 플로우에서 다음 답장 초안도 이어가줘. 이번엔 상대 반응을 반영해서 조금 더 구체적으로 써줘.');
  });

  test('confirms a checkout session and hydrates the paid flow draft', async() => {
    vi.stubEnv('VITE_AGENT_MARKETPLACE_DEMO_URL', 'http://127.0.0.1:8791');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      checkoutSession: {
        checkoutSessionId: 'checkout_session_123',
        checkoutIntentId: 'checkout_demo_123',
        engagementId: 'eng_demo_789',
        state: 'paid',
        paymentMethod: 'card',
        priceMinor: 4900,
        currency: 'KRW',
        agent: {
          agentId: 'agent_yeon',
          slug: 'yeon',
          name: '연이'
        }
      },
      engagement: {
        engagementId: 'eng_demo_789',
        mode: 'demo',
        turnUsage: 5,
        remainingTurns: 0,
        agent: {
          agentId: 'agent_yeon',
          slug: 'yeon',
          name: '연이'
        }
      },
      previewCard: {
        title: '연이 결제가 확인됐어',
        status: 'PAID_READY'
      },
      replyDraft: {
        text: '연이 정식 플로우로 이어서 답장 초안을 계속 시작해줘.'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await confirmAgentMarketplaceCheckoutSessionForCurrentChat('checkout_session_123');

    expect(response.checkoutSession?.state).toBe('paid');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8791/checkout/sessions/confirm', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        checkoutSessionId: 'checkout_session_123'
      })
    }));
    expect(document.querySelector('.input-message-input')?.textContent).toBe('연이 정식 플로우로 이어서 답장 초안을 계속 시작해줘.');
  });
});
