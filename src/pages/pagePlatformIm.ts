import Page from '@/pages/page';
import blurActiveElement from '@helpers/dom/blurActiveElement';
import loadFonts from '@helpers/dom/loadFonts';
import rootScope from '@lib/rootScope';
import {fetchConversationSummaries} from '@lib/conversations';
import {fetchMe} from '@lib/platformAuth';
import {clearPlatformSessionToken, getPlatformSessionToken, setPlatformCurrentUser} from '@lib/platformSession';

let isPlatformShellMounted = false;

async function getAppImManager() {
  return (await import('@lib/appImManager')).default;
}

async function ensurePlatformShellStarted() {
  const [appDialogsManager] = await Promise.all([
    import('@lib/appDialogsManager'),
    loadFonts()
  ]).then(([dialogsManager]) => {
    return [dialogsManager.default] as const;
  });

  appDialogsManager.start();
}

async function onFirstMount() {
  const sessionToken = getPlatformSessionToken();
  if(!sessionToken) {
    const pagePlatformAuth = (await import('./pagePlatformAuth')).default;
    await pagePlatformAuth.mount();
    return;
  }

  try {
    const currentUser = await fetchMe(sessionToken);
    setPlatformCurrentUser(currentUser.user ?? null);
  } catch(err) {
    console.warn('Platform session is invalid, returning to platform auth', err);
    clearPlatformSessionToken();
    const pagePlatformAuth = (await import('./pagePlatformAuth')).default;
    await pagePlatformAuth.mount();
    return;
  }

  rootScope.managers.appStateManager.pushToState('authState', {_: 'authStateSignedIn'});
  page.pageEl.style.display = '';
  document.body.classList.add('is-platform-im');

  blurActiveElement();

  if(!isPlatformShellMounted) {
    await ensurePlatformShellStarted();
    isPlatformShellMounted = true;
  } else {
    const appImManager = await getAppImManager();
    appImManager.ensureCenterMounted();
  }

  const appImManager = await getAppImManager();
  appImManager.ensureCenterMounted();

  document.body.classList.remove('has-auth-pages');

  const authPages = document.getElementById('auth-pages');
  if(authPages) {
    authPages.style.display = 'none';
  }

  await openInitialConversation();
}

async function openInitialConversation() {
  const conversations = await fetchConversationSummaries().catch((): Awaited<ReturnType<typeof fetchConversationSummaries>> => []);
  const firstConversation = conversations[0];
  if(!firstConversation) {
    return;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  const appImManager = await getAppImManager();
  try {
    await appImManager.openConversationSurface({
      conversationId: firstConversation.conversationId,
      agentSlug: firstConversation.agentMeta?.slug
    }, false);
  } catch(err) {
    console.error('Failed to open initial platform conversation', err);
  }
}

const page = new Page('page-chats', false, onFirstMount);
export default page;
