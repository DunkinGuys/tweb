import Page from '@/pages/page';
import Button from '@components/button';
import {attachClickEvent} from '@helpers/dom/clickEvent';
import {createGoogleSession, fetchMe, getGoogleAuthStartUrl, isGoogleRedirectEnabled} from '@lib/platformAuth';
import {clearPlatformSessionToken, getPlatformSessionToken, setPlatformCurrentUser, setPlatformSessionToken} from '@lib/platformSession';

async function onFirstMount() {
  page.pageEl.innerHTML = '';
  page.pageEl.style.display = '';
  document.body.classList.remove('is-platform-im');

  const existingToken = getPlatformSessionToken();
  if(existingToken) {
    try {
      await fetchMe(existingToken);
      redirectToPlatformIm();
      return;
    } catch(err) {
      console.warn('Platform session bootstrap failed, clearing token', err);
      clearPlatformSessionToken();
    }
  }

  document.body.classList.add('has-auth-pages');

  const container = document.createElement('div');
  container.classList.add('container');

  const title = document.createElement('h4');
  title.classList.add('text-center');
  title.textContent = 'Luminite 로그인';

  const subtitle = document.createElement('div');
  subtitle.classList.add('subtitle', 'text-center');
  subtitle.textContent = 'Telegram 로그인 대신 우리 대화 백엔드로 바로 들어가는 제품 전환 경로야.';

  const inputWrapper = document.createElement('form');
  inputWrapper.classList.add('input-wrapper');
  Object.assign(inputWrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  });

  const googleSignInButton = Button('btn-primary btn-color-primary');
  googleSignInButton.textContent = 'Google로 계속';
  googleSignInButton.style.width = '100%';
  googleSignInButton.style.marginBottom = '8px';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.placeholder = 'Google 이메일';
  styleInput(emailInput);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = '표시 이름';
  styleInput(nameInput);

  const continueButton = Button('btn-primary btn-color-primary');
  continueButton.type = 'submit';
  continueButton.textContent = '실험용 세션으로 계속';
  const fallbackLabel = document.createElement('div');
  fallbackLabel.classList.add('subtitle', 'text-center');
  fallbackLabel.style.fontSize = '12px';
  fallbackLabel.style.opacity = '0.75';
  fallbackLabel.textContent = '실험용 fallback';
  const hint = document.createElement('div');
  hint.classList.add('subtitle', 'text-center');
  hint.style.marginTop = '12px';
  hint.style.fontSize = '14px';
  hint.textContent = 'Google session을 확인한 뒤 우리 대화 백엔드 세션으로 바꿔.';

  const setBusy = (busy: boolean, message?: string) => {
    continueButton.toggleAttribute('disabled', busy);
    googleSignInButton.toggleAttribute('disabled', busy);
    continueButton.textContent = message || '실험용 세션으로 계속';
  };

  const onSubmit = async() => {
    const email = emailInput.value.trim();
    const displayName = nameInput.value.trim();

    if(!email || !displayName) {
      hint.textContent = '이메일과 표시 이름을 먼저 적어줘.';
      return;
    }

    setBusy(true, '세션을 만드는 중...');
    hint.textContent = 'Luminite session을 준비하고 있어.';

    try {
      const result = await createGoogleSession({
        email,
        displayName,
        avatarLabel: displayName.slice(0, 1).toUpperCase()
      });

      if(!result.session?.sessionToken) {
        throw new Error('Session token is missing');
      }

      setPlatformSessionToken(result.session.sessionToken);
      setPlatformCurrentUser(result.user ?? null);
      redirectToPlatformIm();
    } catch(err) {
      console.error('Platform auth failed', err);
      hint.textContent = err instanceof Error ? err.message : String(err);
      setBusy(false);
    }
  };

  const onGoogleRedirect = () => {
    setBusy(true, 'Google 로그인으로 이동하는 중...');
    hint.textContent = 'Google 로그인 후 다시 메신저로 돌아올 거야.';
    window.location.href = getGoogleAuthStartUrl(`${window.location.origin}/?platform=1`);
  };

  inputWrapper.addEventListener('submit', (event) => {
    event.preventDefault();
    void onSubmit();
  });

  if(isGoogleRedirectEnabled()) {
    hint.textContent = '정식 Google 로그인 경로가 기본이야.';
    attachClickEvent(googleSignInButton, () => {
      onGoogleRedirect();
    });
    fallbackLabel.style.display = 'none';
    emailInput.style.display = 'none';
    nameInput.style.display = 'none';
    continueButton.style.display = 'none';
  } else {
    googleSignInButton.style.display = 'none';
    hint.textContent = '지금은 개발용 fallback session으로 들어가. 정식 Google 로그인은 배포 설정이 준비되면 켤 거야.';
    continueButton.addEventListener('click', (event) => {
      event.preventDefault();
      void onSubmit();
    });
  }
  inputWrapper.append(googleSignInButton, fallbackLabel, emailInput, nameInput, continueButton, hint);
  container.append(title, subtitle, inputWrapper);
  page.pageEl.append(container);
}

function redirectToPlatformIm() {
  const url = new URL(window.location.href);
  url.searchParams.set('platform', '1');
  window.location.href = url.toString();
}

function styleInput(input: HTMLInputElement) {
  Object.assign(input.style, {
    width: '100%',
    height: '52px',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: 'inherit',
    font: 'inherit',
    padding: '0 16px',
    marginBottom: '12px'
  });
}

const page = new Page('page-sign', true, onFirstMount);
export default page;
