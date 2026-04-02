import {
  canUseAgentRegistry,
  fetchAgentConversationDetail,
  fetchAgentConversationSummaries,
  fetchAgentRegistryAgentDetail,
  fetchAgentRegistryAgents,
  fetchAgentRegistryCategories,
  resolveAgentRegistryBaseUrl
} from '@lib/agentRegistry';

describe('agentRegistry', () => {
  const originalLocation = window.location;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://localhost:8080/')
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
    globalThis.fetch = originalFetch;
  });

  test('falls back to localhost registry in local dev', () => {
    expect(resolveAgentRegistryBaseUrl()).toBe('http://127.0.0.1:8799');
    expect(canUseAgentRegistry()).toBe(true);
  });

  test('prefers env and window overrides', () => {
    vi.stubEnv('VITE_AGENT_REGISTRY_URL', 'http://127.0.0.1:8790/agents');
    expect(resolveAgentRegistryBaseUrl()).toBe('http://127.0.0.1:8790/agents');

    (window as typeof window & {
      __agentRegistryBaseUrl?: string
    }).__agentRegistryBaseUrl = 'http://127.0.0.1:9991';
    expect(resolveAgentRegistryBaseUrl()).toBe('http://127.0.0.1:9991');
    delete (window as typeof window & {
      __agentRegistryBaseUrl?: string
    }).__agentRegistryBaseUrl;
  });

  test('fetches categories, list, detail, and conversation payloads', async() => {
    vi.stubEnv('VITE_AGENT_REGISTRY_URL', 'http://127.0.0.1:8790');

    const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      categories: [{categoryId: 'category_dating', slug: 'dating', name: '연애'}]
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      agents: [{agentId: 'agent_yeon', providerId: 'provider_int3', categoryId: 'category_dating', slug: 'yeon', name: '연이'}]
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      agent: {agentId: 'agent_yeon', providerId: 'provider_int3', categoryId: 'category_dating', slug: 'yeon', name: '연이'}
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      conversations: [{
        agent: {agentId: 'agent_yeon', providerId: 'provider_int3', categoryId: 'category_dating', slug: 'yeon', name: '연이'},
        engagement: {engagementId: 'eng_demo_1', state: 'demo_active'}
      }]
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      conversation: {
        agent: {agentId: 'agent_yeon', providerId: 'provider_int3', categoryId: 'category_dating', slug: 'yeon', name: '연이'},
        transcript: [{messageId: 'agent_yeon:intro', authorType: 'agent', authorName: '연이', kind: 'intro', text: '안녕'}]
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const categories = await fetchAgentRegistryCategories();
    const agents = await fetchAgentRegistryAgents({category: 'dating'});
    const detail = await fetchAgentRegistryAgentDetail('yeon');
    const conversations = await fetchAgentConversationSummaries();
    const conversation = await fetchAgentConversationDetail('yeon');

    expect(categories[0]?.slug).toBe('dating');
    expect(agents[0]?.slug).toBe('yeon');
    expect(detail.slug).toBe('yeon');
    expect(conversations[0]?.engagement?.engagementId).toBe('eng_demo_1');
    expect(conversation.transcript?.[0]?.text).toBe('안녕');
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8790/categories');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8790/agents?category=dating');
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:8790/agents/yeon');
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://127.0.0.1:8790/agent-conversations');
    expect(fetchMock).toHaveBeenNthCalledWith(5, 'http://127.0.0.1:8790/agent-conversations/yeon');
  });

  test('builds agent list query params for search and filters', async() => {
    vi.stubEnv('VITE_AGENT_REGISTRY_URL', 'http://127.0.0.1:8790');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      agents: []
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchAgentRegistryAgents({
      category: 'dating',
      publicationStatus: 'published',
      pricingModel: 'demo_then_paid',
      providerId: 'provider_int3',
      q: '연이'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8790/agents?category=dating&publicationStatus=published&pricingModel=demo_then_paid&providerId=provider_int3&q=%EC%97%B0%EC%9D%B4'
    );
  });
});
